JSMpeg.Source.AjaxProgressive = (function(){ "use strict";

var AjaxProgressiveSource = function(url, options) {
	this.url = url;
	this.destination = null;
	this.request = null;
	this.streaming = false;

	this.completed = false;
	this.established = false;
	this.progress = 0;

	this.fileSize = 0;
	this.loadedSize = 0;
	this.chunkSize = options.chunkSize || 1024*1024;

	this.isLoading = false;
	this.loadStartTime = 0;
	this.throttled = options.throttled !== false;
	this.aborted = false;

	this.onEstablishedCallback = options.onSourceEstablished;
	this.onCompletedCallback = options.onSourceCompleted;
};

AjaxProgressiveSource.prototype.connect = function(destination) {
	this.destination = destination;
};

AjaxProgressiveSource.prototype.start = function() {
	this.request = new XMLHttpRequest();

	this.request.onreadystatechange = function() {
		if (this.request.readyState === this.request.DONE) {
			this.fileSize = parseInt(
				this.request.getResponseHeader("Content-Length")
			);
			this.loadNextChunk();
		}
	}.bind(this);

	this.request.onprogress = this.onProgress.bind(this);
	this.request.open('HEAD', this.url);
	this.request.send();
};

AjaxProgressiveSource.prototype.resume = function(secondsHeadroom) {
	if (this.isLoading || !this.throttled) {
		return;
	}

	// Guess the worst case loading time with lots of safety margin. This is
	// somewhat arbitrary...
	var worstCaseLoadingTime = this.loadTime * 8 + 2;
	if (worstCaseLoadingTime > secondsHeadroom) {
		this.loadNextChunk();
	}
};

AjaxProgressiveSource.prototype.destroy = function() {
	this.request.abort();
	this.aborted = true;
};

AjaxProgressiveSource.prototype.loadNextChunk = function() {
	var start = this.loadedSize,
		end = Math.min(this.loadedSize + this.chunkSize-1, this.fileSize-1);
	
	if (start >= this.fileSize || this.aborted) {
		this.completed = true;
		if (this.onCompletedCallback) {
			this.onCompletedCallback(this);
		}
		return;
	}
	
	this.isLoading = true;
	this.loadStartTime = JSMpeg.Now();
	this.request = new XMLHttpRequest();

	this.request.onreadystatechange = function() {		
		if (
			this.request.readyState === this.request.DONE && 
			this.request.status >= 200 && this.request.status < 300
		) {
			this.onChunkLoad(this.request.response);
		}
		else if (this.request.readyState === this.request.DONE) {
			// Retry?
			if (this.loadFails++ < 3) {
				this.loadNextChunk();
			}
		}
	}.bind(this);
	
	if (start === 0) {
		this.request.onprogress = this.onProgress.bind(this);
	}

	this.request.open('GET', this.url+'?'+start+"-"+end);
	this.request.setRequestHeader("Range", "bytes="+start+"-"+end);
	this.request.responseType = "arraybuffer";
	this.request.send();
};

AjaxProgressiveSource.prototype.onProgress = function(ev) {
	this.progress = (ev.loaded / ev.total);
};

AjaxProgressiveSource.prototype.onChunkLoad = function(data) {
	var isFirstChunk = !this.established;
	this.established = true;
	this.progress = 1;
	
	this.loadedSize += data.byteLength;
	this.loadFails = 0;
	this.isLoading = false;

	if (isFirstChunk && this.onEstablishedCallback) {
		this.onEstablishedCallback(this);
	}

	if (this.destination) {
		this.destination.write(data);
	}

	this.loadTime = JSMpeg.Now() - this.loadStartTime;
	if (!this.throttled) {
		this.loadNextChunk();
	}
};

return AjaxProgressiveSource;

})();


