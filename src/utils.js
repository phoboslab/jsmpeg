jsmpeg.prototype.readCode = function(codeTable) {
  var state = 0;
  do {
	state = codeTable[state + this.buffer.getBits(1)];
  } while( state >= 0 && codeTable[state] != 0 );
  return codeTable[state+2];
};

jsmpeg.prototype.findStartCode = function( code ) {
  var current = 0;
  while( true ) {
	current = this.buffer.findNextMPEGStartCode();
	if( current == code || current == BitReader.NOT_FOUND ) {
	  return current;
	}
  }
  return BitReader.NOT_FOUND;
};

jsmpeg.prototype.fillArray = function(a, value) {
  for( var i = 0, length = a.length; i < length; i++ ) {
	a[i] = value;
  }
};

jsmpeg.prototype.cachedFrameCount = 0;
jsmpeg.prototype.calculateFrameCount = function() {
  if( !this.buffer || this.cachedFrameCount ) {
	return this.cachedFrameCount;
  }

  // Remember the buffer position, so we can rewind to the beginning and
  // reset to the current position afterwards
  var currentPlaybackIndex = this.buffer.index,
	  frames = 0;

  this.buffer.index = 0;
  while( this.findStartCode(START_PICTURE) !== BitReader.NOT_FOUND ) {
	frames++;
  }
  this.buffer.index = currentPlaybackIndex;

  this.cachedFrameCount = frames;
  return frames;
};

jsmpeg.prototype.calculateDuration = function() {
  return this.calculateFrameCount() * (1/this.pictureRate);
};
