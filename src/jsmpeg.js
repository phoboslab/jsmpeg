var EventEmitter2 = require('eventemitter2').EventEmitter2;
var util = require('util');

var VideoLoader = require('./VideoLoader.js');
var BitReader = require('./BitReader.js');
var Decoder = require('./Decoder.js');

var requestAnimationFrame = (function() {
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame || function(callback) {
      window.setTimeout(callback, 1000 / 60);
    };
})();

var getTime = function() {
  return window.performance
    ? window.performance.now()
    : Date.now();
};


var jsmpeg = module.exports = function(url, opts) {
  opts = opts || {};

  this.url = url;
  this.load();

  this.canvas = opts.canvas || document.createElement('canvas');
  this.ctx = this.canvas.getContext('2d');

  this.autoplay = !!opts.autoplay;
  this.loop = !!opts.loop;

  // this.pictureRate = 30;
  this.lateTime = 0;
  this.firstSequenceHeader = 0;
  this.targetTime = 0;

  this.decoder = new Decoder(this.canvas);
  this.time = 0;
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
  this.processFrame();

  if (this.autoplay) {
    this.play();
  }
};

jsmpeg.prototype.play = function() {
  if (this.playing) {
    return;
  }

  this.startTime = getTime();
  this.playing = true;
  this.animate();
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

jsmpeg.prototype.processFrame = function() {
  if (this.decoder.nextFrame()) {
    this.ctx.drawImage(
      this.decoder.canvas,
      0, 0, this.decoder.width, this.decoder.height,
      0, 0, this.canvas.width, this.canvas.height
    );
  } else {
    this.stop();
    console.log(getTime() - this.startTime);

    var video = this.videoLoader.getNext();
    if (video) {
      this.loadBuffer(video);
      this.play();
    } else {
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
  }
};

jsmpeg.prototype.animate = function() {
  if (!this.playing) {
    return;
  }

  var now = getTime();
  if (!this.lastTime) {
    this.lastTime = now;
  }
  var interval = 1000 / this.decoder.pictureRate;
  var delta = now - this.lastTime;

  if (delta > interval) {
    this.processFrame();
    this.lastTime = now - (delta % interval);
    this.time += interval;
  }

  requestAnimationFrame(this.animate.bind(this));
};
