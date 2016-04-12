// ----------------------------------------------------------------------------
// Streaming over WebSockets

jsmpeg_prototype.waitForIntraFrame = true;
jsmpeg_prototype.socketBufferSize = 512 * 1024; // 512kb each

jsmpeg_prototype.initSocketClient = function() {
    this.buffer = new BitReader(new ArrayBuffer(this.socketBufferSize));

    this.nextPictureBuffer = new BitReader(new ArrayBuffer(this.socketBufferSize));
    this.nextPictureBuffer.writePos = 0;
    this.nextPictureBuffer.chunkBegin = 0;
    this.nextPictureBuffer.lastWriteBeforeWrap = 0;

    if (this.client) {
        this.client.binaryType = 'arraybuffer';
        this.client.onmessage = this.receiveSocketMessage.bind(this);
    }
};

jsmpeg_prototype.decodeSocketHeader = function( data ) {
    // Custom header sent to all newly connected clients when streaming
    // over websockets:
    // struct { char magic[4] = 'jsmp'; unsigned short width, height; };
    if(
        data[0] === SOCKET_MAGIC_BYTES.charCodeAt(0) &&
        data[1] === SOCKET_MAGIC_BYTES.charCodeAt(1) &&
        data[2] === SOCKET_MAGIC_BYTES.charCodeAt(2) &&
        data[3] === SOCKET_MAGIC_BYTES.charCodeAt(3)
    ) {
        this.width  = (data[4] * 256 + data[5]);
        this.height = (data[6] * 256 + data[7]);
        this.initBuffers();
    }
};

jsmpeg_prototype.receiveSocketMessage = function( event ) {
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
            startCode === BitReader.NOT_FOUND ||
            ((next.index >> 3) > next.writePos)
        ) {
            // We reached the end with no picture found yet; move back a few bytes
            // in case we are at the beginning of a start code and exit.
            next.index = Math.max((next.writePos-3), 0) << 3;
            return;
        }
        else if( startCode === START_PICTURE ) {
            break;
        }
    }

    // If we are still here, we found the next picture start code!

    // Skip picture decoding until we find the first intra frame?
    if( this.waitForIntraFrame ) {
        next.advance(10); // skip temporalReference
        if( next.getBits(3) === PICTURE_TYPE_I ) {
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

jsmpeg_prototype.scheduleDecoding = function() {
    this.decodePicture();
    this.currentPictureDecoded = true;
};