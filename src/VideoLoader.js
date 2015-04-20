var VideoLoader = module.exports = function(urls, onLoadFinish) {
  this.videos = [];
  this.queue = urls || [];
  this.loading = false;
  this.onLoadFinish = onLoadFinish;
};

VideoLoader.prototype.load = function() {
  var request = new XMLHttpRequest();
  request.onreadystatechange = (function() {
    if (request.readyState == request.DONE && request.status == 200) {
      this.videos.push(request.response);
      if (this.queue.length > 1) {
        this.queue = this.queue.slice(1);
        this.load();
      } else {
        if (this.onLoadFinish) {
          this.onLoadFinish();
        }
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

VideoLoader.prototype.add = function(url) {
  this.queue.push(url);

  if (!this.loading) {
    this.load();
  }
};
