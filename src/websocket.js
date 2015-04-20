// ----------------------------------------------------------------------------
// Streaming over WebSockets

jsmpeg.prototype.waitForIntraFrame = true;
jsmpeg.prototype.socketBufferSize = 512 * 1024; // 512kb each
jsmpeg.prototype.onlostconnection = null;

jsmpeg.prototype.initSocketClient = function( client ) {
  this.buffer = new BitReader(new ArrayBuffer(this.socketBufferSize));

  this.nextPictureBuffer = new BitReader(new ArrayBuffer(this.socketBufferSize));
  this.nextPictureBuffer.writePos = 0;
  this.nextPictureBuffer.chunkBegin = 0;
  this.nextPictureBuffer.lastWriteBeforeWrap = 0;

  this.client.binaryType = 'arraybuffer';
  this.client.onmessage = this.receiveSocketMessage.bind(this);
};

jsmpeg.prototype.decodeSocketHeader = function( data ) {
  // Custom header sent to all newly connected clients when streaming
  // over websockets:
  // struct { char magic[4] = "jsmp"; unsigned short width, height; };
  if(
	data[0] == SOCKET_MAGIC_BYTES.charCodeAt(0) &&
	  data[1] == SOCKET_MAGIC_BYTES.charCodeAt(1) &&
	  data[2] == SOCKET_MAGIC_BYTES.charCodeAt(2) &&
	  data[3] == SOCKET_MAGIC_BYTES.charCodeAt(3)
  ) {
	this.width = (data[4] * 256 + data[5]);
	this.height = (data[6] * 256 + data[7]);
	this.initBuffers();
  }
};

jsmpeg.prototype.receiveSocketMessage = function( event ) {
  var messageData = new Uint8Array(event.data);

  if( !this.sequenceStarted ) {
	this.decodeSocketHeader(messageData);
  }

  var current = this.buffer;
  var next = this.nextPictureBuffer;

  if( next.writePos + messageData.length > next.length ) {
	next.lastWriteBeforeWrap = next.writePos;
	next.writePos = 0;
	next.index = 0;
  }

  next.bytes.set( messageData, next.writePos );
  next.writePos += messageData.length;

  var startCode = 0;
  while( true ) {
	startCode = next.findNextMPEGStartCode();
	if(
	  startCode == BitReader.NOT_FOUND ||
		((next.index >> 3) > next.writePos)
	) {
	  // We reached the end with no picture found yet; move back a few bytes
	  // in case we are at the beginning of a start code and exit.
	  next.index = Math.max((next.writePos-3), 0) << 3;
	  return;
	}
	else if( startCode == START_PICTURE ) {
	  break;
	}
  }

  // If we are still here, we found the next picture start code!


  // Skip picture decoding until we find the first intra frame?
  if( this.waitForIntraFrame ) {
	next.advance(10); // skip temporalReference
	if( next.getBits(3) == PICTURE_TYPE_I ) {
	  this.waitForIntraFrame = false;
	  next.chunkBegin = (next.index-13) >> 3;
	}
	return;
  }

  // Last picture hasn't been decoded yet? Decode now but skip output
  // before scheduling the next one
  if( !this.currentPictureDecoded ) {
	this.decodePicture(DECODE_SKIP_OUTPUT);
  }


  // Copy the picture chunk over to 'this.buffer' and schedule decoding.
  var chunkEnd = ((next.index) >> 3);

  if( chunkEnd > next.chunkBegin ) {
	// Just copy the current picture chunk
	current.bytes.set( next.bytes.subarray(next.chunkBegin, chunkEnd) );
	current.writePos = chunkEnd - next.chunkBegin;
  }
  else {
	// We wrapped the nextPictureBuffer around, so we have to copy the last part
	// till the end, as well as from 0 to the current writePos
	current.bytes.set( next.bytes.subarray(next.chunkBegin, next.lastWriteBeforeWrap) );
	var written = next.lastWriteBeforeWrap - next.chunkBegin;
	current.bytes.set( next.bytes.subarray(0, chunkEnd), written );
	current.writePos = chunkEnd + written;
  }

  current.index = 0;
  next.chunkBegin = chunkEnd;

  // Decode!
  this.currentPictureDecoded = false;
  requestAnimFrame( this.scheduleDecoding.bind(this), this.canvas );
};


// ----------------------------------------------------------------------------
// Recording from WebSockets

jsmpeg.prototype.isRecording = false;
jsmpeg.prototype.recorderWaitForIntraFrame = false;
jsmpeg.prototype.recordedFrames = 0;
jsmpeg.prototype.recordedSize = 0;
jsmpeg.prototype.didStartRecordingCallback = null;

jsmpeg.prototype.recordBuffers = [];

jsmpeg.prototype.canRecord = function(){
  return (this.client && this.client.readyState == this.client.OPEN);
};

jsmpeg.prototype.startRecording = function(callback) {
  if( !this.canRecord() ) {
	return;
  }

  // Discard old buffers and set for recording
  this.discardRecordBuffers();
  this.isRecording = true;
  this.recorderWaitForIntraFrame = true;
  this.didStartRecordingCallback = callback || null;

  this.recordedFrames = 0;
  this.recordedSize = 0;

  // Fudge a simple Sequence Header for the MPEG file

  // 3 bytes width & height, 12 bits each
  var wh1 = (this.width >> 4),
	  wh2 = ((this.width & 0xf) << 4) | (this.height >> 8),
	  wh3 = (this.height & 0xff);

  this.recordBuffers.push(new Uint8Array([
	0x00, 0x00, 0x01, 0xb3, // Sequence Start Code
	wh1, wh2, wh3, // Width & height
	0x13, // aspect ratio & framerate
	0xff, 0xff, 0xe1, 0x58, // Meh. Bitrate and other boring stuff
	0x00, 0x00, 0x01, 0xb8, 0x00, 0x08, 0x00, // GOP
	0x00, 0x00, 0x00, 0x01, 0x00 // First Picture Start Code
  ]));
};

jsmpeg.prototype.recordFrameFromCurrentBuffer = function() {
  if( !this.isRecording ) { return; }

  if( this.recorderWaitForIntraFrame ) {
	// Not an intra frame? Exit.
	if( this.pictureCodingType != PICTURE_TYPE_I ) { return; }

	// Start recording!
	this.recorderWaitForIntraFrame = false;
	if( this.didStartRecordingCallback ) {
	  this.didStartRecordingCallback( this );
	}
  }

  this.recordedFrames++;
  this.recordedSize += this.buffer.writePos;

  // Copy the actual subrange for the current picture into a new Buffer
  this.recordBuffers.push(new Uint8Array(this.buffer.bytes.subarray(0, this.buffer.writePos)));
};

jsmpeg.prototype.discardRecordBuffers = function() {
  this.recordBuffers = [];
  this.recordedFrames = 0;
};

jsmpeg.prototype.stopRecording = function() {
  var blob = new Blob(this.recordBuffers, {type: 'video/mpeg'});
  this.discardRecordBuffers();
  this.isRecording = false;
  return blob;
};
