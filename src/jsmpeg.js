var EventEmitter2 = require('eventemitter2').EventEmitter2;
var util = require('util');

var VideoLoader = require('./VideoLoader.js');
var BitReader = require('./BitReader.js');
var Decoder = require('./Decoder.js');

var requestAnimFrame = (function() {
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame || function(callback) {
      window.setTimeout(callback, 1000 / 60);
    };
})();

var jsmpeg = module.exports = function(url, opts) {
  opts = opts || {};

  this.url = url;
  this.load();

  this.canvas = opts.canvas || document.createElement('canvas');
  this.ctx = this.canvas.getContext('2d');

  this.autoplay = !!opts.autoplay;
  this.loop = !!opts.loop;

  this.pictureRate = 30;
  this.lateTime = 0;
  this.firstSequenceHeader = 0;
  this.targetTime = 0;

  this.decoder = new Decoder(this.canvas);
};

util.inherits(jsmpeg, EventEmitter2);


jsmpeg.prototype.scheduleDecoding = function() {
  this.decoder.decodePicture();
};

jsmpeg.prototype.load = function() {
  this.videoLoader = new VideoLoader(this.url);
  this.videoLoader.once('load', (function() {
    this.loadBuffer(this.videoLoader.getNext());
    // this.play();
  }.bind(this)));
  this.videoLoader.load();
};

jsmpeg.prototype.loadBuffer = function(buffer) {
  this.decoder.loadBuffer(buffer);

  // Load the first frame
  this.nextFrame();

  if (this.autoplay) {
    this.play();
  }
};

jsmpeg.prototype.play = function() {
  if (this.playing) {
    return;
  }
  this.targetTime = this.now();
  this.playing = true;
  this.scheduleNextFrame();
};

jsmpeg.prototype.pause = function() {
  this.playing = false;
};

jsmpeg.prototype.stop = function() {
  if (this.buffer) {
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
  if (!this.decoder.buffer) {
    return;
  }

  while (true) {
    var code = this.decoder.getStartCode();

    if (code == 0xB3 /* START_SEQUENCE */ ) {
      this.decoder.decodeSequenceHeader();
    } else if (code == 0x00 /* START_PICTURE */ ) {
      if (this.playing) {
        this.scheduleNextFrame();
      }
      this.decoder.decodePicture();
      this.ctx.drawImage(this.decoder.canvas,
        0, 0, this.decoder.width, this.decoder.height,
        0, 0, this.canvas.width, this.canvas.height);
      return;
    } else if (code == BitReader.NOT_FOUND) {
      this.stop(); // Jump back to the beginning
      var video = this.videoLoader.getNext();
      if (video) {
        this.loadBuffer(video);
        this.play();
      } else {
        // Only loop if we found a sequence header
        if (this.loop && !this.videoLoader.loading) {
          this.videoLoader.index = 0;
          this.loadBuffer(this.videoLoader.getNext());
          this.play();
        } else {
          if (this.videoLoader.loading) {
            this.videoLoader.once('load', (function() {
              var video = this.videoLoader.getNext();
              if (video) {
                this.loadBuffer(video);
                this.play();
              }
            }.bind(this)));
          }
          return;
        }
      }
    } else {
      // ignore (GROUP, USER_DATA, EXTENSION, SLICES...)
    }
  }
};

jsmpeg.prototype.scheduleNextFrame = function() {
  this.lateTime = this.now() - this.targetTime;
  var wait = Math.max(0, (1000 / this.pictureRate) - this.lateTime);
  this.targetTime = this.now() + wait;

  if (wait < 18) {
    this.scheduleAnimation();
  } else {
    setTimeout(this.scheduleAnimation.bind(this), wait);
  }
};

jsmpeg.prototype.scheduleAnimation = function() {
  requestAnimFrame(this.nextFrame.bind(this), this.canvas);
};
