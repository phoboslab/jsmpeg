var EventEmitter2 = require('eventemitter2').EventEmitter2;
var inherits = require('util').inherits;

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
  if (window.performance) {
    if (window.performance.now) {
      return window.performance.now();
    }
  }
  return Date.now();
};

var jsmpeg = module.exports = function(url, options) {
  options = options || {};

  this.url = url;
  this.el = this.canvas = options.canvas || document.createElement('canvas');
  this.ctx = this.canvas.getContext('2d');

  this.videoLoader = new VideoLoader();
  this.autoplay = !!options.autoplay;
  this.preload = options.preload || 'auto';
  this.loop = !!options.loop;

  this.decoder = new Decoder(this.canvas);
  this.time = 0;

  if (this.autoplay) {
    this.load();
  } else {
    if (this.preload != 'none') {
      this.doPreload();
    }
  }
};

inherits(jsmpeg, EventEmitter2);


jsmpeg.prototype.doPreload = function() {
  if (this.preload === 'meta') {
    // ignore
    return;
  }

  if (this.preload === 'auto') {
    // load all videos
    this.videoLoader.add(this.url);
  }

  if (typeof this.preload === 'number') {
    if (this.preload > 0 && Array.isArray(this.url)) {
      var urls = this.url.slice(0, this.preload);
      this.videoLoader.add(urls);
    } else {
      // load all videos
      this.videoLoader.add(this.url);
    }
  }

  this.videoLoader.once('load', (function() {
    this.emit('preload');
    this.loadVideoBuffer(this.videoLoader.getNext());
  }.bind(this)));
  this.videoLoader.load();
};


jsmpeg.prototype.load = function() {
  if (!this.playing) {
    this.videoLoader.once('load', (function() {
      this.loadVideoBuffer(this.videoLoader.getNext());
    }.bind(this)));
  }
  this.videoLoader.add(this.url);
  this.videoLoader.load();
};


jsmpeg.prototype.loadVideoBuffer = function(buffer) {
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

  this.playing = true;
  this.load();
  this.animate();
};

jsmpeg.prototype.pause = function() {
  this.playing = false;
};

jsmpeg.prototype.stop = function() {
  // this.videoLoader.index = 0;
  // this.loadVideoBuffer(this.videoLoader.getNext());
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

    var video = this.videoLoader.getNext();
    if (video) {
      this.loadVideoBuffer(video);
      this.play();
    } else {
      if (this.loop && !this.videoLoader.loading) {
        this.videoLoader.index = 0;
        this.loadVideoBuffer(this.videoLoader.getNext());
        this.play();
      } else {
        if (this.videoLoader.loading) {
          this.videoLoader.once('load', (function() {
            var video = this.videoLoader.getNext();
            if (video) {
              this.loadVideoBuffer(video);
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
