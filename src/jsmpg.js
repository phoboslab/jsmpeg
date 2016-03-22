// jsmpeg by Dominic Szablewski - phoboslab.org, github.com/phoboslab
//
// Consider this to be under MIT license. It's largely based an an Open Source
// Decoder for Java under GPL, while I looked at another Decoder from Nokia
// (under no particular license?) for certain aspects.
// I'm not sure if this work is "derivative" enough to have a different license
// but then again, who still cares about MPEG1?
//
// Based on "Java MPEG-1 Video Decoder and Player" by Korandi Zoltan:
// http://sourceforge.net/projects/javampeg1video/
//
// Inspired by "MPEG Decoder in Java ME" by Nokia:
// http://www.developer.nokia.com/Community/Wiki/MPEG_decoder_in_Java_ME


var requestAnimFrame = (function(){
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function( callback ){
            window.setTimeout(callback, 1000 / 60);
        };
})();

var jsmpeg = window.jsmpeg = function( url, opts ) {
    opts = opts || {};
    this.progressive = (opts.progressive !== false);
    this.benchmark = !!opts.benchmark;
    this.canvas = opts.canvas || document.createElement('canvas');
    this.autoplay = !!opts.autoplay;
    this.preloader = opts.preloader;
    this.wantsToPlay = this.autoplay;
    this.loop = !!opts.loop;
    this.seekable = !!opts.seekable;
    this.externalLoadCallback = opts.onload || null;
    this.externalDecodeCallback = opts.ondecodeframe || null;
    this.externalFinishedCallback = opts.onfinished || null;

    this.registry = []; // (add|remove|dispatch)Event registry
    this.timer = null; // timeprogress setTimeout
    this.duration = null; //
    this.currentTime = null; //
    this.paused = true;

    this.customIntraQuantMatrix = new Uint8Array(64);
    this.customNonIntraQuantMatrix = new Uint8Array(64);
    this.blockData = new Int32Array(64);
    this.zeroBlockData = new Int32Array(64);
    this.fillArray(this.zeroBlockData, 0);

    // use WebGL for YCbCrToRGBA conversion if possible (much faster)
    if( !opts.forceCanvas2D && this.initWebGL() ) {
        this.renderFrame = this.renderFrameGL;
    } else {
        this.canvasContext = this.canvas.getContext('2d');
        this.renderFrame = this.renderFrame2D;
    }

    if( url instanceof WebSocket ) {
        this.client = url;
        this.client.onopen = this.initSocketClient.bind(this);
    }
    else {
        this.load(url);
    }
};



// ----------------------------------------------------------------------------
// Streaming over WebSockets

jsmpeg.prototype.waitForIntraFrame = true;
jsmpeg.prototype.socketBufferSize = 512 * 1024; // 512kb each

jsmpeg.prototype.initSocketClient = function() {
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
    // struct { char magic[4] = 'jsmp'; unsigned short width, height; };
    if(
        data[0] === SOCKET_MAGIC_BYTES.charCodeAt(0) &&
        data[1] === SOCKET_MAGIC_BYTES.charCodeAt(1) &&
        data[2] === SOCKET_MAGIC_BYTES.charCodeAt(2) &&
        data[3] === SOCKET_MAGIC_BYTES.charCodeAt(3)
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

jsmpeg.prototype.scheduleDecoding = function() {
    this.decodePicture();
    this.currentPictureDecoded = true;
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
    return (this.client && this.client.readyState === this.client.OPEN);
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
        if( this.pictureCodingType !== PICTURE_TYPE_I ) { return; }

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



// ----------------------------------------------------------------------------
// Loading via Ajax

jsmpeg.prototype.intraFrames = [];
jsmpeg.prototype.currentFrame = -1;
jsmpeg.prototype.currentTime = 0;
jsmpeg.prototype.frameCount = 0;
jsmpeg.prototype.duration = 0;
jsmpeg.prototype.progressiveMinSize = 128 * 1024;


jsmpeg.prototype.fetchReaderPump = function(reader) {
    var that = this;
    reader.read().then(function (result) {
        that.fetchReaderReceive(reader, result);
    });
};

jsmpeg.prototype.fetchReaderReceive = function(reader, result) {
    if( result.done ) {
        if( this.seekable ) {
            var currentBufferPos = this.buffer.index;
            this.collectIntraFrames();
            this.buffer.index = currentBufferPos;
        }

        this.duration = this.frameCount / this.pictureRate;
        this.lastFrameIndex = this.buffer.writePos << 3;
        return;
    }

    this.buffer.bytes.set(result.value, this.buffer.writePos);
    this.buffer.writePos += result.value.byteLength;

    // Find the last picture start code - we have to be careful not trying
    // to decode any frames that aren't fully loaded yet.
    this.lastFrameIndex =  this.findLastPictureStartCode();

    // Initialize the sequence headers and start playback if we have enough data
    // (at least 128kb)
    if( !this.sequenceStarted && this.buffer.writePos >= this.progressiveMinSize ) {
        this.findStartCode(START_SEQUENCE);
        this.firstSequenceHeader = this.buffer.index;
        this.decodeSequenceHeader();

        // Load the first frame
        this.nextFrame();

        if( this.autoplay ) {
            this.play();
        }

        if( this.externalLoadCallback ) {
            this.externalLoadCallback(this);
        }
    }

    // If the player starved previously, restart playback now
    else if( this.sequenceStarted && this.wantsToPlay && !this.playing ) {
        this.play();
    }

    // Not enough data to start playback yet - show loading progress
    else if( !this.sequenceStarted ) {
        var status = {loaded: this.buffer.writePos, total: this.progressiveMinSize};
        if( this.gl ) {
            this.updateLoaderGL(status);
        }
        else {
            this.updateLoader2D(status);
        }
    }

    this.fetchReaderPump(reader);
};

jsmpeg.prototype.findLastPictureStartCode = function() {
    var bufferBytes = this.buffer.bytes;
    for( var i = this.buffer.writePos; i > 3; i-- ) {
        if(
            bufferBytes[i] == START_PICTURE &&
            bufferBytes[i-1] === 0x01 &&
            bufferBytes[i-2] === 0x00 &&
            bufferBytes[i-3] === 0x00
        ) {
            return (i-3) << 3;
        }
    }
    return 0;
};

jsmpeg.prototype.load = function( url ) {
    this.url = url;

    var that = this;
    if(
        this.progressive &&
        window.fetch &&
        window.ReadableByteStream
    ) {
        var reqHeaders = new Headers();
        reqHeaders.append('Content-Type', 'video/mpeg');
        fetch(url, {headers: reqHeaders}).then(function (res) {
            var contentLength = res.headers.get('Content-Length');
            var reader = res.body.getReader();

            that.buffer = new BitReader(new ArrayBuffer(contentLength));
            that.buffer.writePos = 0;
            that.fetchReaderPump(reader);
            that.preloader({
                loaded: contentLength,
                total: contentLength
            });
        });
    }
    else {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function() {
            if( request.readyState === request.DONE && request.status === 200 ) {
                that.loadCallback(request.response);
            }
        };

        request.onprogress = this.gl
            ? ( this.preloader || this.updateLoaderGL ).bind(this)
            : ( this.preloader || this.updateLoader2D ).bind(this)
        ;

        request.open('GET', url);
        request.responseType = 'arraybuffer';
        request.send();
    }
};

jsmpeg.prototype.updateLoader2D = function( ev ) {
    var
        p = ev.loaded / ev.total,
        w = this.canvas.width,
        h = this.canvas.height,
        ctx = this.canvasContext;

    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, h - h*p, w, h*p);
};

jsmpeg.prototype.updateLoaderGL = function( ev ) {
    var gl = this.gl;
    gl.uniform1f(gl.getUniformLocation(this.loadingProgram, 'loaded'), (ev.loaded / ev.total));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};


jsmpeg.prototype.loadCallback = function(file) {
    this.buffer = new BitReader(file);

    if( this.seekable ) {
        this.collectIntraFrames();
        this.buffer.index = 0;
    }

    this.findStartCode(START_SEQUENCE);
    this.firstSequenceHeader = this.buffer.index;
    this.decodeSequenceHeader();

    // Calculate the duration. This only works if the video is seekable and we have a frame count
    this.duration = this.frameCount / this.pictureRate;

    // Load the first frame
    this.nextFrame();

    if( this.autoplay ) {
        this.play();
    }

    if( this.externalLoadCallback ) {
        this.externalLoadCallback(this);
    }
};

jsmpeg.prototype.collectIntraFrames = function() {
    // Loop through the whole buffer and collect all intraFrames to build our seek index.
    // We also keep track of total frame count here
    var frame;
    for( frame = 0; this.findStartCode(START_PICTURE) !== BitReader.NOT_FOUND; frame++ ) {

        // Check if the found picture is an intra frame and remember the position
        this.buffer.advance(10); // skip temporalReference
        if( this.buffer.getBits(3) === PICTURE_TYPE_I ) {
            // Remember index 13 bits back, before temporalReference and picture type
            this.intraFrames.push({frame: frame, index: this.buffer.index - 13});
        }
    }

    this.frameCount = frame;
};

jsmpeg.prototype.seekToFrame = function(seekFrame, seekExact) {
    if( seekFrame < 0 || seekFrame >= this.frameCount || !this.intraFrames.length ) {
        return false;
    }

    // Find the last intra frame before or equal to seek frame
    var target = null;
    for( var i = 0; i < this.intraFrames.length && this.intraFrames[i].frame <= seekFrame; i++ ) {
        target = this.intraFrames[i];
    }

    this.buffer.index = target.index;
    this.currentFrame = target.frame-1;

    // If we're seeking to the exact frame, we may have to decode some more frames before
    // the one we want
    if( seekExact ) {
        for( var frame = target.frame; frame < seekFrame; frame++ ) {
            this.decodePicture(DECODE_SKIP_OUTPUT);
            this.findStartCode(START_PICTURE);
        }
        this.currentFrame = seekFrame-1;
    }

    // Decode and display the picture we have seeked to
    this.decodePicture();
    return true;
};

jsmpeg.prototype.seekToTime = function(time, seekExact) {
    this.seekToFrame( (time * this.pictureRate)|0, seekExact );
};

jsmpeg.prototype.play = function() {
    if( this.playing ) { return; }
    this.targetTime = this.now();
    this.playing = true;
    this.paused = !this.playing;
    this.wantsToPlay = true;
    this.scheduleNextFrame();
    this.dispatchEvent('playing');
    this.dispatchEvent('play');

    var _this = this;
    var duration = this.calculateDuration();
    this.timer = setInterval(function(){
        var progress = _this.calculateProgress();
        _this.dispatchEvent('timeupdate', { currentTime: (progress * duration), currentProgress: progress });
    }, 25);
};

jsmpeg.prototype.pause = function() {
    this.playing = false;
    this.paused = !this.playing;
    this.wantsToPlay = false;
    clearInterval(this.timer);
    this.dispatchEvent('pause');
};

jsmpeg.prototype.stop = function() {
    this.currentFrame = -1;
    if( this.buffer ) {
        this.buffer.index = this.firstSequenceHeader;
    }
    this.playing = false;
    if( this.client ) {
        this.client.close();
        this.client = null;
    }
    this.wantsToPlay = false;
    clearInterval(this.timer);
    this.dispatchEvent('ended');
};



// ----------------------------------------------------------------------------
// Utilities

jsmpeg.prototype.readCode = function(codeTable) {
    var state = 0;
    do {
        state = codeTable[state + this.buffer.getBits(1)];
    } while( state >= 0 && codeTable[state] !== 0 );
    return codeTable[state+2];
};

jsmpeg.prototype.findStartCode = function( code ) {
    var current = 0;
    while( true ) {
        current = this.buffer.findNextMPEGStartCode();
        if( current === code || current === BitReader.NOT_FOUND ) {
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

    this.buffer.index = 0; // TODO: review reseting buffer.index here
    while( this.findStartCode(START_PICTURE) !== BitReader.NOT_FOUND ) {
        frames++;
    }
    this.buffer.index = currentPlaybackIndex;

    this.cachedFrameCount = frames;
    return frames;
};

jsmpeg.prototype.calculateDuration = function() {
    var duration = this.duration = this.calculateFrameCount() * (1/this.pictureRate);
    return duration;
};

jsmpeg.prototype.calculateProgress = function() {
    var octa = 0.125; //8bit
    var progress = (this.buffer.index / this.buffer.length * octa) || 0;
    this.currentTime = this.duration * progress;
    return progress;
};

jsmpeg.prototype.dispatchEvent = function(type, data) {
    var registry = this.registry,
        i = registry.length
    ;
    while (i--) {
        var event = registry[i];
        if (event.type == type) {
            event.callback.call(this, { type: type, data: data, target: this.canvas });
        }
    }
};

jsmpeg.prototype.addEventListener = function(type, callback/*, capture*/) {
    this.registry.push({type: type, callback: callback});
};

jsmpeg.prototype.removeEventListener = function(type, callback) {
    var registry = this.registry,
        i = registry.length
    ;
    while (i--) {
        var event = registry[i];
        event.type = (type && (event.callback === callback) && registry.splice(i, 1));
    }
};

// ----------------------------------------------------------------------------
// Sequence Layer

jsmpeg.prototype.pictureRate = 30;
jsmpeg.prototype.lateTime = 0;
jsmpeg.prototype.firstSequenceHeader = 0;
jsmpeg.prototype.targetTime = 0;

jsmpeg.prototype.benchmark = false;
jsmpeg.prototype.benchFrame = 0;
jsmpeg.prototype.benchDecodeTimes = 0;
jsmpeg.prototype.benchAvgFrameTime = 0;

jsmpeg.prototype.now = function() {
    return window.performance && window.performance.now
        ? window.performance.now()
        : Date.now();
};

jsmpeg.prototype.nextFrame = function() {
    if( !this.buffer ) { return; }

    var frameStart = this.now();
    while(true) {
        var code = this.buffer.findNextMPEGStartCode();

        if( code === START_SEQUENCE ) {
            this.decodeSequenceHeader();
        }
        else if( code === START_PICTURE ) {
            if( this.progressive && this.buffer.index >= this.lastFrameIndex ) {
                // Starved
                this.playing = false;
                return;
            }
            if( this.playing ) {
                this.scheduleNextFrame();
            }
            this.decodePicture();
            this.benchDecodeTimes += this.now() - frameStart;
            return this.canvas;
        }
        else if( code === BitReader.NOT_FOUND ) {
            this.stop(); // Jump back to the beginning

            if( this.externalFinishedCallback ) {
                this.externalFinishedCallback(this);
            }

            // Only loop if we found a sequence header
            if( this.loop && this.sequenceStarted ) {
                this.play();
            }
            return null;
        }
        else {
            // ignore (GROUP, USER_DATA, EXTENSION, SLICES...)
        }
    }
};

jsmpeg.prototype.scheduleNextFrame = function() {
    this.lateTime = this.now() - this.targetTime;
    var wait = Math.max(0, (1000/this.pictureRate) - this.lateTime);
    this.targetTime = this.now() + wait;

    if( this.benchmark ) {
        this.benchFrame++;
        if( this.benchFrame >= 120 ) {
            this.benchAvgFrameTime = this.benchDecodeTimes / this.benchFrame;
            this.benchFrame = 0;
            this.benchDecodeTimes = 0;
            if( window.console ) { console.log('Average time per frame:', this.benchAvgFrameTime, 'ms'); }
        }
        setTimeout( this.nextFrame.bind(this), 0);
    }
    else if( wait < 18) {
        this.scheduleAnimation();
    }
    else {
        setTimeout( this.scheduleAnimation.bind(this), wait );
    }
};

jsmpeg.prototype.scheduleAnimation = function() {
    requestAnimFrame( this.nextFrame.bind(this), this.canvas );
};

jsmpeg.prototype.decodeSequenceHeader = function() {
    this.width = this.buffer.getBits(12);
    this.height = this.buffer.getBits(12);
    this.buffer.advance(4); // skip pixel aspect ratio
    this.pictureRate = PICTURE_RATE[this.buffer.getBits(4)];
    this.buffer.advance(18 + 1 + 10 + 1); // skip bitRate, marker, bufferSize and constrained bit

    this.initBuffers();

    var i;

    if( this.buffer.getBits(1) ) { // load custom intra quant matrix?
        for( i = 0; i < 64; i++ ) {
            this.customIntraQuantMatrix[ZIG_ZAG[i]] = this.buffer.getBits(8);
        }
        this.intraQuantMatrix = this.customIntraQuantMatrix;
    }

    if( this.buffer.getBits(1) ) { // load custom non intra quant matrix?
        for( i = 0; i < 64; i++ ) {
            this.customNonIntraQuantMatrix[ZIG_ZAG[i]] = this.buffer.getBits(8);
        }
        this.nonIntraQuantMatrix = this.customNonIntraQuantMatrix;
    }
};

jsmpeg.prototype.initBuffers = function() {
    this.intraQuantMatrix = DEFAULT_INTRA_QUANT_MATRIX;
    this.nonIntraQuantMatrix = DEFAULT_NON_INTRA_QUANT_MATRIX;

    this.mbWidth = (this.width + 15) >> 4;
    this.mbHeight = (this.height + 15) >> 4;
    this.mbSize = this.mbWidth * this.mbHeight;

    this.codedWidth = this.mbWidth << 4;
    this.codedHeight = this.mbHeight << 4;
    this.codedSize = this.codedWidth * this.codedHeight;

    this.halfWidth = this.mbWidth << 3;
    this.halfHeight = this.mbHeight << 3;
    this.quarterSize = this.codedSize >> 2;

    // Sequence already started? Don't allocate buffers again
    if( this.sequenceStarted ) { return; }
    this.sequenceStarted = true;


    // Manually clamp values when writing macroblocks for shitty browsers
    // that don't support Uint8ClampedArray
    var MaybeClampedUint8Array = window.Uint8ClampedArray || window.Uint8Array;
    if( !window.Uint8ClampedArray ) {
        this.copyBlockToDestination = this.copyBlockToDestinationClamp;
        this.addBlockToDestination = this.addBlockToDestinationClamp;
    }

    // Allocated buffers and resize the canvas
    this.currentY = new MaybeClampedUint8Array(this.codedSize);
    this.currentY32 = new Uint32Array(this.currentY.buffer);

    this.currentCr = new MaybeClampedUint8Array(this.codedSize >> 2);
    this.currentCr32 = new Uint32Array(this.currentCr.buffer);

    this.currentCb = new MaybeClampedUint8Array(this.codedSize >> 2);
    this.currentCb32 = new Uint32Array(this.currentCb.buffer);


    this.forwardY = new MaybeClampedUint8Array(this.codedSize);
    this.forwardY32 = new Uint32Array(this.forwardY.buffer);

    this.forwardCr = new MaybeClampedUint8Array(this.codedSize >> 2);
    this.forwardCr32 = new Uint32Array(this.forwardCr.buffer);

    this.forwardCb = new MaybeClampedUint8Array(this.codedSize >> 2);
    this.forwardCb32 = new Uint32Array(this.forwardCb.buffer);

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    if( this.gl ) {
        this.gl.useProgram(this.program);
        this.gl.viewport(0, 0, this.width, this.height);
    }
    else {
        this.currentRGBA = this.canvasContext.getImageData(0, 0, this.width, this.height);
        this.fillArray(this.currentRGBA.data, 255);
    }
};




// ----------------------------------------------------------------------------
// Picture Layer

jsmpeg.prototype.currentY = null;
jsmpeg.prototype.currentCr = null;
jsmpeg.prototype.currentCb = null;

jsmpeg.prototype.currentRGBA = null;

jsmpeg.prototype.pictureCodingType = 0;

// Buffers for motion compensation
jsmpeg.prototype.forwardY = null;
jsmpeg.prototype.forwardCr = null;
jsmpeg.prototype.forwardCb = null;

jsmpeg.prototype.fullPelForward = false;
jsmpeg.prototype.forwardFCode = 0;
jsmpeg.prototype.forwardRSize = 0;
jsmpeg.prototype.forwardF = 0;


jsmpeg.prototype.decodePicture = function(skipOutput) {
    this.currentFrame++;
    this.currentTime = this.currentFrame / this.pictureRate;

    this.buffer.advance(10); // skip temporalReference
    this.pictureCodingType = this.buffer.getBits(3);
    this.buffer.advance(16); // skip vbv_delay

    // Skip B and D frames or unknown coding type
    if( this.pictureCodingType <= 0 || this.pictureCodingType >= PICTURE_TYPE_B ) {
        return;
    }

    // full_pel_forward, forward_f_code
    if( this.pictureCodingType === PICTURE_TYPE_P ) {
        this.fullPelForward = this.buffer.getBits(1);
        this.forwardFCode = this.buffer.getBits(3);
        if( this.forwardFCode === 0 ) {
            // Ignore picture with zero forward_f_code
            return;
        }
        this.forwardRSize = this.forwardFCode - 1;
        this.forwardF = 1 << this.forwardRSize;
    }

    var code = 0;
    do {
        code = this.buffer.findNextMPEGStartCode();
    } while( code === START_EXTENSION || code === START_USER_DATA );


    while( code >= START_SLICE_FIRST && code <= START_SLICE_LAST ) {
        this.decodeSlice( (code & 0x000000FF) );
        code = this.buffer.findNextMPEGStartCode();
    }

    // We found the next start code; rewind 32bits and let the main loop handle it.
    this.buffer.rewind(32);

    // Record this frame, if the recorder wants it
    if (this.recordFrameFromCurrentBuffer) {
        this.recordFrameFromCurrentBuffer();
    }


    if( skipOutput !== DECODE_SKIP_OUTPUT ) {
        this.renderFrame();

        if(this.externalDecodeCallback) {
            this.externalDecodeCallback(this, this.canvas);
        }
    }

    // If this is a reference picutre then rotate the prediction pointers
    if( this.pictureCodingType === PICTURE_TYPE_I || this.pictureCodingType === PICTURE_TYPE_P ) {
        var
            tmpY = this.forwardY,
            tmpY32 = this.forwardY32,
            tmpCr = this.forwardCr,
            tmpCr32 = this.forwardCr32,
            tmpCb = this.forwardCb,
            tmpCb32 = this.forwardCb32;

        this.forwardY = this.currentY;
        this.forwardY32 = this.currentY32;
        this.forwardCr = this.currentCr;
        this.forwardCr32 = this.currentCr32;
        this.forwardCb = this.currentCb;
        this.forwardCb32 = this.currentCb32;

        this.currentY = tmpY;
        this.currentY32 = tmpY32;
        this.currentCr = tmpCr;
        this.currentCr32 = tmpCr32;
        this.currentCb = tmpCb;
        this.currentCb32 = tmpCb32;
    }
};

jsmpeg.prototype.YCbCrToRGBA = function() {
    var pY = this.currentY;
    var pCb = this.currentCb;
    var pCr = this.currentCr;
    var pRGBA = this.currentRGBA.data;

    // Chroma values are the same for each block of 4 pixels, so we proccess
    // 2 lines at a time, 2 neighboring pixels each.
    // I wish we could use 32bit writes to the RGBA buffer instead of writing
    // each byte separately, but we need the automatic clamping of the RGBA
    // buffer.

    var yIndex1 = 0;
    var yIndex2 = this.codedWidth;
    var yNext2Lines = this.codedWidth + (this.codedWidth - this.width);

    var cIndex = 0;
    var cNextLine = this.halfWidth - (this.width >> 1);

    var rgbaIndex1 = 0;
    var rgbaIndex2 = this.width * 4;
    var rgbaNext2Lines = this.width * 4;

    var cols = this.width >> 1;
    var rows = this.height >> 1;

    var cb, cr, r, g, b;

    for( var row = 0; row < rows; row++ ) {
        for( var col = 0; col < cols; col++ ) {
            cb = pCb[cIndex];
            cr = pCr[cIndex];
            cIndex++;

            r = (cr + ((cr * 103) >> 8)) - 179;
            g = ((cb * 88) >> 8) - 44 + ((cr * 183) >> 8) - 91;
            b = (cb + ((cb * 198) >> 8)) - 227;

            // Line 1
            var y1 = pY[yIndex1++];
            var y2 = pY[yIndex1++];
            pRGBA[rgbaIndex1]   = y1 + r;
            pRGBA[rgbaIndex1+1] = y1 - g;
            pRGBA[rgbaIndex1+2] = y1 + b;
            pRGBA[rgbaIndex1+4] = y2 + r;
            pRGBA[rgbaIndex1+5] = y2 - g;
            pRGBA[rgbaIndex1+6] = y2 + b;
            rgbaIndex1 += 8;

            // Line 2
            var y3 = pY[yIndex2++];
            var y4 = pY[yIndex2++];
            pRGBA[rgbaIndex2]   = y3 + r;
            pRGBA[rgbaIndex2+1] = y3 - g;
            pRGBA[rgbaIndex2+2] = y3 + b;
            pRGBA[rgbaIndex2+4] = y4 + r;
            pRGBA[rgbaIndex2+5] = y4 - g;
            pRGBA[rgbaIndex2+6] = y4 + b;
            rgbaIndex2 += 8;
        }

        yIndex1 += yNext2Lines;
        yIndex2 += yNext2Lines;
        rgbaIndex1 += rgbaNext2Lines;
        rgbaIndex2 += rgbaNext2Lines;
        cIndex += cNextLine;
    }
};

jsmpeg.prototype.renderFrame2D = function() {
    this.YCbCrToRGBA();
    this.canvasContext.putImageData(this.currentRGBA, 0, 0);
};


// ----------------------------------------------------------------------------
// Accelerated WebGL YCbCrToRGBA conversion

jsmpeg.prototype.gl = null;
jsmpeg.prototype.program = null;
jsmpeg.prototype.YTexture = null;
jsmpeg.prototype.CBTexture = null;
jsmpeg.prototype.CRTexture = null;

jsmpeg.prototype.createTexture = function(index, name) {
    var gl = this.gl;
    var texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(this.program, name), index);

    return texture;
};

jsmpeg.prototype.compileShader = function(type, source) {
    var gl = this.gl;
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if( !gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
};

jsmpeg.prototype.initWebGL = function() {
    var gl;

    // attempt to get a webgl context
    try {
        gl = this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    } catch (e) {
        return false;
    }

    if (!gl) {
        return false;
    }

    // init buffers
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

    // The main YCbCrToRGBA Shader
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.compileShader(gl.VERTEX_SHADER, SHADER_VERTEX_IDENTITY));
    gl.attachShader(this.program, this.compileShader(gl.FRAGMENT_SHADER, SHADER_FRAGMENT_YCBCRTORGBA));
    gl.linkProgram(this.program);

    if( !gl.getProgramParameter(this.program, gl.LINK_STATUS) ) {
        throw new Error(gl.getProgramInfoLog(this.program));
    }

    gl.useProgram(this.program);

    // setup textures
    this.YTexture = this.createTexture(0, 'YTexture');
    this.CBTexture = this.createTexture(1, 'CBTexture');
    this.CRTexture = this.createTexture(2, 'CRTexture');

    var vertexAttr = gl.getAttribLocation(this.program, 'vertex');
    gl.enableVertexAttribArray(vertexAttr);
    gl.vertexAttribPointer(vertexAttr, 2, gl.FLOAT, false, 0, 0);


    // Shader for the loading screen
    this.loadingProgram = gl.createProgram();
    gl.attachShader(this.loadingProgram, this.compileShader(gl.VERTEX_SHADER, SHADER_VERTEX_IDENTITY));
    gl.attachShader(this.loadingProgram, this.compileShader(gl.FRAGMENT_SHADER, SHADER_FRAGMENT_LOADING));
    gl.linkProgram(this.loadingProgram);

    gl.useProgram(this.loadingProgram);

    vertexAttr = gl.getAttribLocation(this.loadingProgram, 'vertex');
    gl.enableVertexAttribArray(vertexAttr);
    gl.vertexAttribPointer(vertexAttr, 2, gl.FLOAT, false, 0, 0);

    return true;
};

jsmpeg.prototype.renderFrameGL = function() {
    var gl = this.gl;

    // WebGL doesn't like Uint8ClampedArrays, so we have to create a Uint8Array view for
    // each plane
    var uint8Y = new Uint8Array(this.currentY.buffer),
        uint8Cr = new Uint8Array(this.currentCr.buffer),
        uint8Cb = new Uint8Array(this.currentCb.buffer);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.YTexture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth, this.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.CBTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth, this.height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.CRTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth, this.height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};


// ----------------------------------------------------------------------------
// Slice Layer

jsmpeg.prototype.quantizerScale = 0;
jsmpeg.prototype.sliceBegin = false;

jsmpeg.prototype.decodeSlice = function(slice) {
    this.sliceBegin = true;
    this.macroblockAddress = (slice - 1) * this.mbWidth - 1;

    // Reset motion vectors and DC predictors
    this.motionFwH = this.motionFwHPrev = 0;
    this.motionFwV = this.motionFwVPrev = 0;
    this.dcPredictorY  = 128;
    this.dcPredictorCr = 128;
    this.dcPredictorCb = 128;

    this.quantizerScale = this.buffer.getBits(5);

    // skip extra bits
    while( this.buffer.getBits(1) ) {
        this.buffer.advance(8);
    }

    do {
        this.decodeMacroblock();
        // We may have to ignore Video Stream Start Codes here (0xE0)!?
    } while( !this.buffer.nextBytesAreStartCode() );
};


// ----------------------------------------------------------------------------
// Macroblock Layer

jsmpeg.prototype.macroblockAddress = 0;
jsmpeg.prototype.mbRow = 0;
jsmpeg.prototype.mbCol = 0;

jsmpeg.prototype.macroblockType = 0;
jsmpeg.prototype.macroblockIntra = false;
jsmpeg.prototype.macroblockMotFw = false;

jsmpeg.prototype.motionFwH = 0;
jsmpeg.prototype.motionFwV = 0;
jsmpeg.prototype.motionFwHPrev = 0;
jsmpeg.prototype.motionFwVPrev = 0;

jsmpeg.prototype.decodeMacroblock = function() {
    // Decode macroblock_address_increment
    var
        increment = 0,
        t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);

    while( t === 34 ) {
        // macroblock_stuffing
        t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);
    }
    while( t === 35 ) {
        // macroblock_escape
        increment += 33;
        t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);
    }
    increment += t;

    // Process any skipped macroblocks
    if( this.sliceBegin ) {
        // The first macroblock_address_increment of each slice is relative
        // to beginning of the preverious row, not the preverious macroblock
        this.sliceBegin = false;
        this.macroblockAddress += increment;
    }
    else {
        if( this.macroblockAddress + increment >= this.mbSize ) {
            // Illegal (too large) macroblock_address_increment
            return;
        }
        if( increment > 1 ) {
            // Skipped macroblocks reset DC predictors
            this.dcPredictorY  = 128;
            this.dcPredictorCr = 128;
            this.dcPredictorCb = 128;

            // Skipped macroblocks in P-pictures reset motion vectors
            if( this.pictureCodingType === PICTURE_TYPE_P ) {
                this.motionFwH = this.motionFwHPrev = 0;
                this.motionFwV = this.motionFwVPrev = 0;
            }
        }

        // Predict skipped macroblocks
        while( increment > 1) {
            this.macroblockAddress++;
            this.mbRow = (this.macroblockAddress / this.mbWidth)|0;
            this.mbCol = this.macroblockAddress % this.mbWidth;
            this.copyMacroblock(this.motionFwH, this.motionFwV, this.forwardY, this.forwardCr, this.forwardCb);
            increment--;
        }
        this.macroblockAddress++;
    }
    this.mbRow = (this.macroblockAddress / this.mbWidth)|0;
    this.mbCol = this.macroblockAddress % this.mbWidth;

    // Process the current macroblock
    this.macroblockType = this.readCode(MACROBLOCK_TYPE_TABLES[this.pictureCodingType]);
    this.macroblockIntra = (this.macroblockType & 0x01);
    this.macroblockMotFw = (this.macroblockType & 0x08);

    // Quantizer scale
    if( (this.macroblockType & 0x10) !== 0 ) {
        this.quantizerScale = this.buffer.getBits(5);
    }

    if( this.macroblockIntra ) {
        // Intra-coded macroblocks reset motion vectors
        this.motionFwH = this.motionFwHPrev = 0;
        this.motionFwV = this.motionFwVPrev = 0;
    }
    else {
        // Non-intra macroblocks reset DC predictors
        this.dcPredictorY = 128;
        this.dcPredictorCr = 128;
        this.dcPredictorCb = 128;

        this.decodeMotionVectors();
        this.copyMacroblock(this.motionFwH, this.motionFwV, this.forwardY, this.forwardCr, this.forwardCb);
    }

    // Decode blocks
    var cbp = ((this.macroblockType & 0x02) !== 0)
        ? this.readCode(CODE_BLOCK_PATTERN)
        : (this.macroblockIntra ? 0x3f : 0);

    for( var block = 0, mask = 0x20; block < 6; block++ ) {
        if( (cbp & mask) !== 0 ) {
            this.decodeBlock(block);
        }
        mask >>= 1;
    }
};


jsmpeg.prototype.decodeMotionVectors = function() {
    var code, d, r = 0;

    // Forward
    if( this.macroblockMotFw ) {
        // Horizontal forward
        code = this.readCode(MOTION);
        if( (code !== 0) && (this.forwardF !== 1) ) {
            r = this.buffer.getBits(this.forwardRSize);
            d = ((Math.abs(code) - 1) << this.forwardRSize) + r + 1;
            if( code < 0 ) {
                d = -d;
            }
        }
        else {
            d = code;
        }

        this.motionFwHPrev += d;
        if( this.motionFwHPrev > (this.forwardF << 4) - 1 ) {
            this.motionFwHPrev -= this.forwardF << 5;
        }
        else if( this.motionFwHPrev < ((-this.forwardF) << 4) ) {
            this.motionFwHPrev += this.forwardF << 5;
        }

        this.motionFwH = this.motionFwHPrev;
        if( this.fullPelForward ) {
            this.motionFwH <<= 1;
        }

        // Vertical forward
        code = this.readCode(MOTION);
        if( (code !== 0) && (this.forwardF !== 1) ) {
            r = this.buffer.getBits(this.forwardRSize);
            d = ((Math.abs(code) - 1) << this.forwardRSize) + r + 1;
            if( code < 0 ) {
                d = -d;
            }
        }
        else {
            d = code;
        }

        this.motionFwVPrev += d;
        if( this.motionFwVPrev > (this.forwardF << 4) - 1 ) {
            this.motionFwVPrev -= this.forwardF << 5;
        }
        else if( this.motionFwVPrev < ((-this.forwardF) << 4) ) {
            this.motionFwVPrev += this.forwardF << 5;
        }

        this.motionFwV = this.motionFwVPrev;
        if( this.fullPelForward ) {
            this.motionFwV <<= 1;
        }
    }
    else if( this.pictureCodingType === PICTURE_TYPE_P ) {
        // No motion information in P-picture, reset vectors
        this.motionFwH = this.motionFwHPrev = 0;
        this.motionFwV = this.motionFwVPrev = 0;
    }
};

jsmpeg.prototype.copyMacroblock = function(motionH, motionV, sY, sCr, sCb ) {
    var
        width, scan,
        H, V, oddH, oddV,
        src, dest, last;

    // We use 32bit writes here
    var dY = this.currentY32;
    var dCb = this.currentCb32;
    var dCr = this.currentCr32;

    // Luminance
    width = this.codedWidth;
    scan = width - 16;

    H = motionH >> 1;
    V = motionV >> 1;
    oddH = (motionH & 1) === 1;
    oddV = (motionV & 1) === 1;

    src = ((this.mbRow << 4) + V) * width + (this.mbCol << 4) + H;
    dest = (this.mbRow * width + this.mbCol) << 2;
    last = dest + (width << 2);

    var x;
    var y1, y2, y;
    if( oddH ) {
        if( oddV ) {
            while( dest < last ) {
                y1 = sY[src] + sY[src+width]; src++;
                for( x = 0; x < 4; x++ ) {
                    y2 = sY[src] + sY[src+width]; src++;
                    y = (((y1 + y2 + 2) >> 2) & 0xff);

                    y1 = sY[src] + sY[src+width]; src++;
                    y |= (((y1 + y2 + 2) << 6) & 0xff00);

                    y2 = sY[src] + sY[src+width]; src++;
                    y |= (((y1 + y2 + 2) << 14) & 0xff0000);

                    y1 = sY[src] + sY[src+width]; src++;
                    y |= (((y1 + y2 + 2) << 22) & 0xff000000);

                    dY[dest++] = y;
                }
                dest += scan >> 2; src += scan-1;
            }
        }
        else {
            while( dest < last ) {
                y1 = sY[src++];
                for( x = 0; x < 4; x++ ) {
                    y2 = sY[src++];
                    y = (((y1 + y2 + 1) >> 1) & 0xff);

                    y1 = sY[src++];
                    y |= (((y1 + y2 + 1) << 7) & 0xff00);

                    y2 = sY[src++];
                    y |= (((y1 + y2 + 1) << 15) & 0xff0000);

                    y1 = sY[src++];
                    y |= (((y1 + y2 + 1) << 23) & 0xff000000);

                    dY[dest++] = y;
                }
                dest += scan >> 2; src += scan-1;
            }
        }
    }
    else {
        if( oddV ) {
            while( dest < last ) {
                for( x = 0; x < 4; x++ ) {
                    y = (((sY[src] + sY[src+width] + 1) >> 1) & 0xff); src++;
                    y |= (((sY[src] + sY[src+width] + 1) << 7) & 0xff00); src++;
                    y |= (((sY[src] + sY[src+width] + 1) << 15) & 0xff0000); src++;
                    y |= (((sY[src] + sY[src+width] + 1) << 23) & 0xff000000); src++;

                    dY[dest++] = y;
                }
                dest += scan >> 2; src += scan;
            }
        }
        else {
            while( dest < last ) {
                for( x = 0; x < 4; x++ ) {
                    y = sY[src]; src++;
                    y |= sY[src] << 8; src++;
                    y |= sY[src] << 16; src++;
                    y |= sY[src] << 24; src++;

                    dY[dest++] = y;
                }
                dest += scan >> 2; src += scan;
            }
        }
    }

    // Chrominance

    width = this.halfWidth;
    scan = width - 8;

    H = (motionH/2) >> 1;
    V = (motionV/2) >> 1;
    oddH = ((motionH/2) & 1) === 1;
    oddV = ((motionV/2) & 1) === 1;

    src = ((this.mbRow << 3) + V) * width + (this.mbCol << 3) + H;
    dest = (this.mbRow * width + this.mbCol) << 1;
    last = dest + (width << 1);

    var cr1, cr2, cr;
    var cb1, cb2, cb;
    if( oddH ) {
        if( oddV ) {
            while( dest < last ) {
                cr1 = sCr[src] + sCr[src+width];
                cb1 = sCb[src] + sCb[src+width];
                src++;
                for( x = 0; x < 2; x++ ) {
                    cr2 = sCr[src] + sCr[src+width];
                    cb2 = sCb[src] + sCb[src+width]; src++;
                    cr = (((cr1 + cr2 + 2) >> 2) & 0xff);
                    cb = (((cb1 + cb2 + 2) >> 2) & 0xff);

                    cr1 = sCr[src] + sCr[src+width];
                    cb1 = sCb[src] + sCb[src+width]; src++;
                    cr |= (((cr1 + cr2 + 2) << 6) & 0xff00);
                    cb |= (((cb1 + cb2 + 2) << 6) & 0xff00);

                    cr2 = sCr[src] + sCr[src+width];
                    cb2 = sCb[src] + sCb[src+width]; src++;
                    cr |= (((cr1 + cr2 + 2) << 14) & 0xff0000);
                    cb |= (((cb1 + cb2 + 2) << 14) & 0xff0000);

                    cr1 = sCr[src] + sCr[src+width];
                    cb1 = sCb[src] + sCb[src+width]; src++;
                    cr |= (((cr1 + cr2 + 2) << 22) & 0xff000000);
                    cb |= (((cb1 + cb2 + 2) << 22) & 0xff000000);

                    dCr[dest] = cr;
                    dCb[dest] = cb;
                    dest++;
                }
                dest += scan >> 2; src += scan-1;
            }
        }
        else {
            while( dest < last ) {
                cr1 = sCr[src];
                cb1 = sCb[src];
                src++;
                for( x = 0; x < 2; x++ ) {
                    cr2 = sCr[src];
                    cb2 = sCb[src++];
                    cr = (((cr1 + cr2 + 1) >> 1) & 0xff);
                    cb = (((cb1 + cb2 + 1) >> 1) & 0xff);

                    cr1 = sCr[src];
                    cb1 = sCb[src++];
                    cr |= (((cr1 + cr2 + 1) << 7) & 0xff00);
                    cb |= (((cb1 + cb2 + 1) << 7) & 0xff00);

                    cr2 = sCr[src];
                    cb2 = sCb[src++];
                    cr |= (((cr1 + cr2 + 1) << 15) & 0xff0000);
                    cb |= (((cb1 + cb2 + 1) << 15) & 0xff0000);

                    cr1 = sCr[src];
                    cb1 = sCb[src++];
                    cr |= (((cr1 + cr2 + 1) << 23) & 0xff000000);
                    cb |= (((cb1 + cb2 + 1) << 23) & 0xff000000);

                    dCr[dest] = cr;
                    dCb[dest] = cb;
                    dest++;
                }
                dest += scan >> 2; src += scan-1;
            }
        }
    }
    else {
        if( oddV ) {
            while( dest < last ) {
                for( x = 0; x < 2; x++ ) {
                    cr = (((sCr[src] + sCr[src+width] + 1) >> 1) & 0xff);
                    cb = (((sCb[src] + sCb[src+width] + 1) >> 1) & 0xff); src++;

                    cr |= (((sCr[src] + sCr[src+width] + 1) << 7) & 0xff00);
                    cb |= (((sCb[src] + sCb[src+width] + 1) << 7) & 0xff00); src++;

                    cr |= (((sCr[src] + sCr[src+width] + 1) << 15) & 0xff0000);
                    cb |= (((sCb[src] + sCb[src+width] + 1) << 15) & 0xff0000); src++;

                    cr |= (((sCr[src] + sCr[src+width] + 1) << 23) & 0xff000000);
                    cb |= (((sCb[src] + sCb[src+width] + 1) << 23) & 0xff000000); src++;

                    dCr[dest] = cr;
                    dCb[dest] = cb;
                    dest++;
                }
                dest += scan >> 2; src += scan;
            }
        }
        else {
            while( dest < last ) {
                for( x = 0; x < 2; x++ ) {
                    cr = sCr[src];
                    cb = sCb[src]; src++;

                    cr |= sCr[src] << 8;
                    cb |= sCb[src] << 8; src++;

                    cr |= sCr[src] << 16;
                    cb |= sCb[src] << 16; src++;

                    cr |= sCr[src] << 24;
                    cb |= sCb[src] << 24; src++;

                    dCr[dest] = cr;
                    dCb[dest] = cb;
                    dest++;
                }
                dest += scan >> 2; src += scan;
            }
        }
    }
};


// ----------------------------------------------------------------------------
// Block layer

//jsmpeg.prototype.dcPredictorY;
//jsmpeg.prototype.dcPredictorCr;
//jsmpeg.prototype.dcPredictorCb;

jsmpeg.prototype.blockData = null;
jsmpeg.prototype.decodeBlock = function(block) {

    var
        n = 0,
        quantMatrix;

    // Decode DC coefficient of intra-coded blocks
    if( this.macroblockIntra ) {
        var
            predictor,
            dctSize;

        // DC prediction

        if( block < 4 ) {
            predictor = this.dcPredictorY;
            dctSize = this.readCode(DCT_DC_SIZE_LUMINANCE);
        }
        else {
            predictor = (block === 4 ? this.dcPredictorCr : this.dcPredictorCb);
            dctSize = this.readCode(DCT_DC_SIZE_CHROMINANCE);
        }

        // Read DC coeff
        if( dctSize > 0 ) {
            var differential = this.buffer.getBits(dctSize);
            if( (differential & (1 << (dctSize - 1))) !== 0 ) {
                this.blockData[0] = predictor + differential;
            }
            else {
                this.blockData[0] = predictor + ((-1 << dctSize)|(differential+1));
            }
        }
        else {
            this.blockData[0] = predictor;
        }

        // Save predictor value
        if( block < 4 ) {
            this.dcPredictorY = this.blockData[0];
        }
        else if( block === 4 ) {
            this.dcPredictorCr = this.blockData[0];
        }
        else {
            this.dcPredictorCb = this.blockData[0];
        }

        // Dequantize + premultiply
        this.blockData[0] <<= (3 + 5);

        quantMatrix = this.intraQuantMatrix;
        n = 1;
    }
    else {
        quantMatrix = this.nonIntraQuantMatrix;
    }

    // Decode AC coefficients (+DC for non-intra)
    var level = 0;
    while( true ) {
        var
            run = 0,
            coeff = this.readCode(DCT_COEFF);

        if( (coeff === 0x0001) && (n > 0) && (this.buffer.getBits(1) === 0) ) {
            // end_of_block
            break;
        }
        if( coeff === 0xffff ) {
            // escape
            run = this.buffer.getBits(6);
            level = this.buffer.getBits(8);
            if( level === 0 ) {
                level = this.buffer.getBits(8);
            }
            else if( level === 128 ) {
                level = this.buffer.getBits(8) - 256;
            }
            else if( level > 128 ) {
                level = level - 256;
            }
        }
        else {
            run = coeff >> 8;
            level = coeff & 0xff;
            if( this.buffer.getBits(1) ) {
                level = -level;
            }
        }

        n += run;
        var dezigZagged = ZIG_ZAG[n];
        n++;

        // Dequantize, oddify, clip
        level <<= 1;
        if( !this.macroblockIntra ) {
            level += (level < 0 ? -1 : 1);
        }
        level = (level * this.quantizerScale * quantMatrix[dezigZagged]) >> 4;
        if( (level & 1) === 0 ) {
            level -= level > 0 ? 1 : -1;
        }
        if( level > 2047 ) {
            level = 2047;
        }
        else if( level < -2048 ) {
            level = -2048;
        }

        // Save premultiplied coefficient
        this.blockData[dezigZagged] = level * PREMULTIPLIER_MATRIX[dezigZagged];
    }

    // Move block to its place
    var
        destArray,
        destIndex,
        scan;

    if( block < 4 ) {
        destArray = this.currentY;
        scan = this.codedWidth - 8;
        destIndex = (this.mbRow * this.codedWidth + this.mbCol) << 4;
        if( (block & 1) !== 0 ) {
            destIndex += 8;
        }
        if( (block & 2) !== 0 ) {
            destIndex += this.codedWidth << 3;
        }
    }
    else {
        destArray = (block === 4) ? this.currentCb : this.currentCr;
        scan = (this.codedWidth >> 1) - 8;
        destIndex = ((this.mbRow * this.codedWidth) << 2) + (this.mbCol << 3);
    }

    if( this.macroblockIntra ) {
        // Overwrite (no prediction)
        if (n === 1) {
            this.copyValueToDestination((this.blockData[0] + 128) >> 8, destArray, destIndex, scan);
            this.blockData[0] = 0;
        } else {
            this.IDCT();
            this.copyBlockToDestination(this.blockData, destArray, destIndex, scan);
            this.blockData.set(this.zeroBlockData);
        }
    }
    else {
        // Add data to the predicted macroblock
        if (n === 1) {
            this.addValueToDestination((this.blockData[0] + 128) >> 8, destArray, destIndex, scan);
            this.blockData[0] = 0;
        } else {
            this.IDCT();
            this.addBlockToDestination(this.blockData, destArray, destIndex, scan);
            this.blockData.set(this.zeroBlockData);
        }
    }

    n = 0;
};

jsmpeg.prototype.copyBlockToDestination = function(blockData, destArray, destIndex, scan) {
    for( var n = 0; n < 64; n += 8, destIndex += scan+8 ) {
        destArray[destIndex+0] = blockData[n+0];
        destArray[destIndex+1] = blockData[n+1];
        destArray[destIndex+2] = blockData[n+2];
        destArray[destIndex+3] = blockData[n+3];
        destArray[destIndex+4] = blockData[n+4];
        destArray[destIndex+5] = blockData[n+5];
        destArray[destIndex+6] = blockData[n+6];
        destArray[destIndex+7] = blockData[n+7];
    }
};

jsmpeg.prototype.addBlockToDestination = function(blockData, destArray, destIndex, scan) {
    for( var n = 0; n < 64; n += 8, destIndex += scan+8 ) {
        destArray[destIndex+0] += blockData[n+0];
        destArray[destIndex+1] += blockData[n+1];
        destArray[destIndex+2] += blockData[n+2];
        destArray[destIndex+3] += blockData[n+3];
        destArray[destIndex+4] += blockData[n+4];
        destArray[destIndex+5] += blockData[n+5];
        destArray[destIndex+6] += blockData[n+6];
        destArray[destIndex+7] += blockData[n+7];
    }
};

jsmpeg.prototype.copyValueToDestination = function(value, destArray, destIndex, scan) {
    for( var n = 0; n < 64; n += 8, destIndex += scan+8 ) {
        destArray[destIndex+0] = value;
        destArray[destIndex+1] = value;
        destArray[destIndex+2] = value;
        destArray[destIndex+3] = value;
        destArray[destIndex+4] = value;
        destArray[destIndex+5] = value;
        destArray[destIndex+6] = value;
        destArray[destIndex+7] = value;
    }
};

jsmpeg.prototype.addValueToDestination = function(value, destArray, destIndex, scan) {
    for( var n = 0; n < 64; n += 8, destIndex += scan+8 ) {
        destArray[destIndex+0] += value;
        destArray[destIndex+1] += value;
        destArray[destIndex+2] += value;
        destArray[destIndex+3] += value;
        destArray[destIndex+4] += value;
        destArray[destIndex+5] += value;
        destArray[destIndex+6] += value;
        destArray[destIndex+7] += value;
    }
};

// Clamping version for shitty browsers (IE) that don't support Uint8ClampedArray
jsmpeg.prototype.copyBlockToDestinationClamp = function(blockData, destArray, destIndex, scan) {
    var n = 0;
    for( var i = 0; i < 8; i++ ) {
        for( var j = 0; j < 8; j++ ) {
            var p = blockData[n++];
            destArray[destIndex++] = p > 255 ? 255 : (p < 0 ? 0 : p);
        }
        destIndex += scan;
    }
};

jsmpeg.prototype.addBlockToDestinationClamp = function(blockData, destArray, destIndex, scan) {
    var n = 0;
    for( var i = 0; i < 8; i++ ) {
        for( var j = 0; j < 8; j++ ) {
            var p = blockData[n++] + destArray[destIndex];
            destArray[destIndex++] = p > 255 ? 255 : (p < 0 ? 0 : p);
        }
        destIndex += scan;
    }
};

jsmpeg.prototype.IDCT = function() {
    // See http://vsr.informatik.tu-chemnitz.de/~jan/MPEG/HTML/IDCT.html
    // for more info.

    var
        b1, b3, b4, b6, b7, tmp1, tmp2, m0,
        x0, x1, x2, x3, x4, y3, y4, y5, y6, y7,
        i,
        blockData = this.blockData;

    // Transform columns
    for( i = 0; i < 8; ++i ) {
        b1 =  blockData[4*8+i];
        b3 =  blockData[2*8+i] + blockData[6*8+i];
        b4 =  blockData[5*8+i] - blockData[3*8+i];
        tmp1 = blockData[1*8+i] + blockData[7*8+i];
        tmp2 = blockData[3*8+i] + blockData[5*8+i];
        b6 = blockData[1*8+i] - blockData[7*8+i];
        b7 = tmp1 + tmp2;
        m0 =  blockData[0*8+i];
        x4 =  ((b6*473 - b4*196 + 128) >> 8) - b7;
        x0 =  x4 - (((tmp1 - tmp2)*362 + 128) >> 8);
        x1 =  m0 - b1;
        x2 =  (((blockData[2*8+i] - blockData[6*8+i])*362 + 128) >> 8) - b3;
        x3 =  m0 + b1;
        y3 =  x1 + x2;
        y4 =  x3 + b3;
        y5 =  x1 - x2;
        y6 =  x3 - b3;
        y7 = -x0 - ((b4*473 + b6*196 + 128) >> 8);
        blockData[0*8+i] =  b7 + y4;
        blockData[1*8+i] =  x4 + y3;
        blockData[2*8+i] =  y5 - x0;
        blockData[3*8+i] =  y6 - y7;
        blockData[4*8+i] =  y6 + y7;
        blockData[5*8+i] =  x0 + y5;
        blockData[6*8+i] =  y3 - x4;
        blockData[7*8+i] =  y4 - b7;
    }

    // Transform rows
    for( i = 0; i < 64; i += 8 ) {
        b1 =  blockData[4+i];
        b3 =  blockData[2+i] + blockData[6+i];
        b4 =  blockData[5+i] - blockData[3+i];
        tmp1 = blockData[1+i] + blockData[7+i];
        tmp2 = blockData[3+i] + blockData[5+i];
        b6 = blockData[1+i] - blockData[7+i];
        b7 = tmp1 + tmp2;
        m0 =  blockData[0+i];
        x4 =  ((b6*473 - b4*196 + 128) >> 8) - b7;
        x0 =  x4 - (((tmp1 - tmp2)*362 + 128) >> 8);
        x1 =  m0 - b1;
        x2 =  (((blockData[2+i] - blockData[6+i])*362 + 128) >> 8) - b3;
        x3 =  m0 + b1;
        y3 =  x1 + x2;
        y4 =  x3 + b3;
        y5 =  x1 - x2;
        y6 =  x3 - b3;
        y7 = -x0 - ((b4*473 + b6*196 + 128) >> 8);
        blockData[0+i] =  (b7 + y4 + 128) >> 8;
        blockData[1+i] =  (x4 + y3 + 128) >> 8;
        blockData[2+i] =  (y5 - x0 + 128) >> 8;
        blockData[3+i] =  (y6 - y7 + 128) >> 8;
        blockData[4+i] =  (y6 + y7 + 128) >> 8;
        blockData[5+i] =  (x0 + y5 + 128) >> 8;
        blockData[6+i] =  (y3 - x4 + 128) >> 8;
        blockData[7+i] =  (y4 - b7 + 128) >> 8;
    }
};

// ----------------------------------------------------------------------------
// Bit Reader

var BitReader = function(arrayBuffer) {
    this.bytes = new Uint8Array(arrayBuffer);
    this.length = this.bytes.length;
    this.writePos = this.bytes.length;
    this.index = 0;
};

BitReader.NOT_FOUND = -1;

BitReader.prototype.findNextMPEGStartCode = function() {
    for( var i = (this.index+7 >> 3); i < this.writePos; i++ ) {
        if(
            this.bytes[i] === 0x00 &&
            this.bytes[i+1] === 0x00 &&
            this.bytes[i+2] === 0x01
        ) {
            this.index = (i+4) << 3;
            return this.bytes[i+3];
        }
    }
    this.index = (this.writePos << 3);
    return BitReader.NOT_FOUND;
};

BitReader.prototype.nextBytesAreStartCode = function() {
    var i = (this.index+7 >> 3);
    return (
        i >= this.writePos || (
            this.bytes[i] === 0x00 &&
            this.bytes[i+1] === 0x00 &&
            this.bytes[i+2] === 0x01
        )
    );
};

BitReader.prototype.nextBits = function(count) {
    var
        byteOffset = this.index >> 3,
        room = (8 - this.index % 8);

    if( room >= count ) {
        return (this.bytes[byteOffset] >> (room - count)) & (0xff >> (8-count));
    }

    var
        leftover = (this.index + count) % 8, // Leftover bits in last byte
        end = (this.index + count -1) >> 3,
        value = this.bytes[byteOffset] & (0xff >> (8-room)); // Fill out first byte

    for( byteOffset++; byteOffset < end; byteOffset++ ) {
        value <<= 8; // Shift and
        value |= this.bytes[byteOffset]; // Put next byte
    }

    if (leftover > 0) {
        value <<= leftover; // Make room for remaining bits
        value |= (this.bytes[byteOffset] >> (8 - leftover));
    }
    else {
        value <<= 8;
        value |= this.bytes[byteOffset];
    }

    return value;
};

BitReader.prototype.getBits = function(count) {
    var value = this.nextBits(count);
    this.index += count;
    return value;
};

BitReader.prototype.advance = function(count) {
    return (this.index += count);
};

BitReader.prototype.rewind = function(count) {
    return (this.index -= count);
};

var global_load_callback = window.__jsmpeg_global_load_callback;
if (global_load_callback) {
    global_load_callback.call(this, jsmpeg);
}