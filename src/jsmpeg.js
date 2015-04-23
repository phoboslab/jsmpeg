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
  this.videoIndex = 0;
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
      this.doPreload(options.preloadTimeout);
    }
  }
};

inherits(jsmpeg, EventEmitter2);


jsmpeg.prototype.doPreload = function(timeout) {
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

  this.videoLoader.once('load', (function(video) {
    this.emit('preload');
    this.loadVideo(video);
  }.bind(this)));
  if (typeof timeout !== 'undefined') {
    this.videoLoader.once('timeout', (function() {
      this.emit('preloadTimeout');
    }).bind(this));
  }
  this.videoLoader.load(timeout);
};


jsmpeg.prototype.load = function() {
  if (!this.playing) {
    this.videoLoader.once('load', (function(video) {
      this.loadVideo(video);
    }.bind(this)));
  }
  this.videoLoader.add(this.url);
  this.videoLoader.load();
};


jsmpeg.prototype.loadVideo = function(video) {
  this.videoIndex = video.index;
  this.decoder.loadBuffer(video.data);

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
  this.loadVideo(this.videoLoader.findByIndex(0));
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
    var video = this.videoLoader.findByIndex(this.videoIndex+1);
    if (!video) {
      if (this.loop) {
        video = this.videoLoader.findByIndex(0);
        this.loadVideo(video);
      } else {
        this.pause();
      }
    } else {
      if (video.status === 'loaded') {
        this.loadVideo(video);
      } else {
        this.pause();
        this.videoLoader.once('load', (function(video) {
          if (video) {
            this.loadVideo(video);
            this.play();
          }
        }.bind(this)));
        if (video.status != 'loading') {
          this.load();
        }
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
