// ----------------------------------------------------------------------------
// Recording from WebSockets

jsmpeg_prototype.isRecording = false;
jsmpeg_prototype.recorderWaitForIntraFrame = false;
jsmpeg_prototype.recordedFrames = 0;
jsmpeg_prototype.recordedSize = 0;
jsmpeg_prototype.didStartRecordingCallback = null;

jsmpeg_prototype.recordBuffers = [];

jsmpeg_prototype.canRecord = function(){
    return (this.client && this.client.readyState === this.client.OPEN);
};

jsmpeg_prototype.startRecording = function(callback) {
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

jsmpeg_prototype.recordFrameFromCurrentBuffer = function() {
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

jsmpeg_prototype.discardRecordBuffers = function() {
    this.recordBuffers = [];
    this.recordedFrames = 0;
};

jsmpeg_prototype.stopRecording = function() {
    var blob = new Blob(this.recordBuffers, {type: 'video/mpeg'});
    this.discardRecordBuffers();
    this.isRecording = false;
    return blob;
};

