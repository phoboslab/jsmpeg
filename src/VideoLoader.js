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
        loaded: false
      };
      this.videos.push(video);
    }
    if (!video.loaded) {
      this.queue.push(url);
    }
  }
};

VideoLoader.prototype.getNext = function() {
  var video = this.findByIndex(this.index);
  if (video) {
    this.index++;
    return video.data;
  }
  return null;
};

VideoLoader.prototype._load = function(url) {
  var request = new XMLHttpRequest();
  request.onreadystatechange = (function() {
    if (request.readyState == request.DONE && request.status == 200) {
      var video = this.findByURL(url);
      video.data = request.response;
      video.loaded = true;
      this.emit('load');

      if (this.queue.length > 0) {
        this.load();
      } else {
        this.loading = false;
      }
    }
  }).bind(this);

  request.open('GET', url);
  request.responseType = "arraybuffer";
  request.send();
};

VideoLoader.prototype.load = function() {
  if (this.queue.length > 0) {
    this.loading = true;
    var url = this.queue[0];
    this.queue = this.queue.slice(1);
    this._load(url);
  }
};
