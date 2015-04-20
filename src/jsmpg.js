var requestAnimFrame = (function(){
  return window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	function( callback ){
	  window.setTimeout(callback, 1000 / 60);
	};
})();

var jsmpeg = function(opts) {
  opts = opts || {};
  this.canvas = opts.canvas || document.createElement('canvas');
  this.autoplay = !!opts.autoplay;
  this.loop = !!opts.loop;
  this.externalLoadCallback = opts.onload || null;
  this.externalDecodeCallback = opts.ondecodeframe || null;
  this.externalFinishedCallback = opts.onfinished || null;

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

  // this.load(url);
};

jsmpeg.prototype.scheduleDecoding = function() {
  this.decodePicture();
};


jsmpeg.prototype.load = function( url ) {
  this.url = url;

  var request = new XMLHttpRequest();
  var that = this;
  request.onreadystatechange = function() {
	if( request.readyState == request.DONE && request.status == 200 ) {
	  that.loadCallback(request.response);
	}
  };

  request.open('GET', url);
  request.responseType = "arraybuffer";
  request.send();
};

jsmpeg.prototype.loadBuffer = function(buffer) {
  this.buffer = new BitReader(buffer);

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
};

jsmpeg.prototype.play = function() {
  if( this.playing ) { return; }
  this.targetTime = this.now();
  this.playing = true;
  this.scheduleNextFrame();
};

jsmpeg.prototype.pause = function() {
  this.playing = false;
};

jsmpeg.prototype.stop = function() {
  if( this.buffer ) {
	this.buffer.index = this.firstSequenceHeader;
  }
  this.playing = false;
  if( this.client ) {
	this.client.close();
	this.client = null;
  }
};

jsmpeg.prototype.pictureRate = 30;
jsmpeg.prototype.lateTime = 0;
jsmpeg.prototype.firstSequenceHeader = 0;
jsmpeg.prototype.targetTime = 0;

jsmpeg.prototype.now = function() {
  return window.performance
	? window.performance.now()
	: Date.now();
};

jsmpeg.prototype.nextFrame = function() {
  if( !this.buffer ) { return; }

  var frameStart = this.now();
  while(true) {
	var code = this.buffer.findNextMPEGStartCode();

	if( code == START_SEQUENCE ) {
	  this.decodeSequenceHeader();
	} else if( code == START_PICTURE ) {
	  if( this.playing ) {
		this.scheduleNextFrame();
	  }
	  this.decodePicture();
	  this.benchDecodeTimes += this.now() - frameStart;
      return;
	} else if( code == BitReader.NOT_FOUND ) {
	  this.stop(); // Jump back to the beginning

	  if( this.externalFinishedCallback ) {
		this.externalFinishedCallback(this);
	  }

	  // Only loop if we found a sequence header
	  if( this.loop && this.sequenceStarted ) {
		this.play();
	  }
	  return;
	} else {
	  // ignore (GROUP, USER_DATA, EXTENSION, SLICES...)
	}
  }
};

jsmpeg.prototype.scheduleNextFrame = function() {
  this.lateTime = this.now() - this.targetTime;
  var wait = Math.max(0, (1000/this.pictureRate) - this.lateTime);
  this.targetTime = this.now() + wait;

  if (wait < 18) {
	this.scheduleAnimation();
  } else {
	setTimeout( this.scheduleAnimation.bind(this), wait );
  }
};

jsmpeg.prototype.scheduleAnimation = function() {
  requestAnimFrame( this.nextFrame.bind(this), this.canvas );
};

jsmpeg.prototype.renderFrame2D = function() {
  this.YCbCrToRGBA();
  this.canvasContext.putImageData(this.currentRGBA, 0, 0);
};
