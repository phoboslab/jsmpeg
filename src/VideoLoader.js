var EventEmitter2 = require('eventemitter2').EventEmitter2;
var inherits = require('util').inherits;

var VideoLoader = module.exports = function() {
  this.videos = [];
  this.index = 0;
  this.queue = [];
  this.loading = false;
};

inherits(VideoLoader, EventEmitter2);

VideoLoader.prototype.findByIndex = function(index) {
  for (var j = 0; j < this.videos.length; j++) {
    var video = this.videos[j];
    if (video.index === index) {
      return video;
    }
  }
  return null;
};

VideoLoader.prototype.findByURL = function(url) {
  for (var j = 0; j < this.videos.length; j++) {
    var video = this.videos[j];
    if (video.url === url) {
      return video;
    }
  }
  return null;
};

VideoLoader.prototype.findByStatus = function(status) {
  for (var j = 0; j < this.videos.length; j++) {
    var video = this.videos[j];
    if (video.status === status) {
      return video;
    }
  }
  return null;
};

VideoLoader.prototype.add = function(urls) {
  urls = Array.isArray(urls) ? urls : [urls];
  for (var i = 0; i < urls.length; i++) {
    var url = urls[i];
    var video = this.findByURL(url);
    if (!video) {
      video = {
        index: this.videos.length,
        url: url,
        data: null,
        status: 'declared'
      };
      this.videos.push(video);
    }
    if (video.status !== 'loading' && video.status !== 'loaded') {
      // video.status = 'loading';
      this.queue.push(url);
    }
  }
};

VideoLoader.prototype._load = function(url, timeout) {
  var request = new XMLHttpRequest();

  request.onreadystatechange = (function() {
    if (request.readyState == request.DONE && request.status == 200) {
      var video = this.findByURL(url);
      video.data = request.response;
      video.status = 'loaded';
      this.emit('load', video);

      if (this.queue.length > 0) {
        this.load();
      } else {
        this.loading = false;
      }
    }
  }).bind(this);

  if (typeof timeout !== 'undefined') {
    request.timeout = timeout;

    request.ontimeout = (function() {
      var video = this.findByURL(url);
      this.emit('timeout', video);
    }).bind(this);
  }
  var video = this.findByURL(url);
  video.status = 'loading';
  request.open('GET', url);
  request.responseType = "arraybuffer";
  request.send();
};

VideoLoader.prototype.load = function(timeout) {
  if (this.queue.length > 0 && !this.findByStatus('loading')) {
    this.loading = true;
    var url = this.queue[0];
    this.queue = this.queue.slice(1);
    this._load(url, timeout);
  }
};
