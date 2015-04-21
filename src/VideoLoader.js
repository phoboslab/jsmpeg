var EventEmitter2 = require('eventemitter2').EventEmitter2;
var util = require('util');

var VideoLoader = module.exports = function(urls) {
  this.videos = [];
  this.index = 0;
  if (urls) {
    urls = Array.isArray(urls) ? urls : [urls];
  }
  this.queue = urls || [];
  this.loading = false;
};

util.inherits(VideoLoader, EventEmitter2);

VideoLoader.prototype.getNext = function() {
  if (this.index < this.videos.length) {
    var video = this.videos[this.index];
    this.index++;
    return video;
  }
  return null;
};

VideoLoader.prototype.load = function() {
  var request = new XMLHttpRequest();
  request.onreadystatechange = (function() {
    if (request.readyState == request.DONE && request.status == 200) {
      this.videos.push(request.response);
      this.emit('load');
      if (this.queue.length > 1) {
        this.queue = this.queue.slice(1);
        this.load();
      } else {
        this.emit('loadingComplete');
        this.loading = false;
      }
	}
  }).bind(this);

  if (this.queue.length > 0) {
    this.loading = true;
    request.open('GET', this.queue[0]);
    request.responseType = "arraybuffer";
    request.send();
  }
};
