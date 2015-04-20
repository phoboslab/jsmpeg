var VideoLoader = require('./VideoLoader.js');
var BitReader = require('./BitReader.js');
var Decoder = require('./Decoder.js');

var requestAnimFrame = (function(){
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function( callback ){
      window.setTimeout(callback, 1000 / 60);
    };
})();

var jsmpeg = module.exports = function(urls, opts) {
  this.videoIndex = 0;
  urls = Array.isArray(urls) ? urls : [urls];
  this.videoLoader = new VideoLoader(urls, (function() {
    this.loadBuffer(this.videoLoader.videos[this.videoIndex]);
    this.videoIndex++;
    this.play();
  }.bind(this)));
  this.videoLoader.load();

  opts = opts || {};
  this.canvas = opts.canvas || document.createElement('canvas');
  this.autoplay = !!opts.autoplay;
  this.loop = !!opts.loop;

  this.pictureRate = 30;
  this.lateTime = 0;
  this.firstSequenceHeader = 0;
  this.targetTime = 0;

  this.decoder = new Decoder(this.canvas);
};

jsmpeg.prototype.scheduleDecoding = function() {
  this.decoder.decodePicture();
};

/*
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
 */

jsmpeg.prototype.loadBuffer = function(buffer) {
  this.decoder.loadBuffer(buffer);

  // Load the first frame
  this.nextFrame();

  if( this.autoplay ) {
    this.play();
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
};

jsmpeg.prototype.now = function() {
  return window.performance
    ? window.performance.now()
    : Date.now();
};

jsmpeg.prototype.nextFrame = function() {
  // if( !this.buffer ) { return; }
  if (!this.decoder.buffer) {
    return;
  }

  while (true) {
    var code = this.decoder.getStartCode();

    if( code == 0xB3 /* START_SEQUENCE */ ) {
      this.decoder.decodeSequenceHeader();
    } else if ( code == 0x00 /* START_PICTURE */ ) {
      if( this.playing ) {
        this.scheduleNextFrame();
      }
      this.decoder.decodePicture();
      return;
    } else if ( code == BitReader.NOT_FOUND ) {
      this.stop(); // Jump back to the beginning
      if (this.videoIndex < this.videoLoader.videos.length ) {
        this.loadBuffer(this.videoLoader.videos[this.videoIndex]);
        this.videoIndex++;
        this.play();
      } else {
        // Only loop if we found a sequence header
        if( this.loop && this.sequenceStarted ) {
          this.play();
        }
        return;
      }
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
