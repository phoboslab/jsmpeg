JSMpeg.Source.AjaxChunks = (function(){ "use strict";

if (!String.prototype.padStart) {
	String.prototype.padStart = function padStart(targetLength,padString) {
		targetLength = targetLength>>0; //floor if number or convert non-number to 0;
		padString = String(padString || ' ');
		if (this.length > targetLength) {
			return String(this);
		}
		else {
			targetLength = targetLength-this.length;
			if (targetLength > padString.length) {
				padString += padString.repeat(targetLength/padString.length); //append to original to ensure we are longer than needed
			}
			return padString.slice(0,targetLength) + String(this);
		}
	};
}

var AjaxChunksSource = function(url, options) {
	this.url = url;
	this.destination = null;
	this.request = null;

	this.completed = false;
	this.established = false;
	this.progress = 0;
	
	this.chunkIdx = 0;
	this.chunkDigits = options.chunkDigits || 2;

	this.isLoading = false;
	this.loadStartTime = 0;
	this.throttled = options.throttled !== false;
	this.aborted = false;
};

AjaxChunksSource.prototype.connect = function(destination) {
	this.destination = destination;
};

AjaxChunksSource.prototype.start = function() {
	this.loadNextChunk();
};

AjaxChunksSource.prototype.resume = function(secondsHeadroom) {
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

AjaxChunksSource.prototype.destroy = function() {
	this.request.abort();
	this.aborted = true;
};

AjaxChunksSource.prototype.loadNextChunk = function() {
	if (this.aborted || this.completed) {
		this.completed = true;
		return;
	}
	
	this.isLoading = true;
	this.loadStartTime = JSMpeg.Now();
	this.request = new XMLHttpRequest();

	this.request.onreadystatechange = function() {		
		if (
			this.request.readyState === this.request.DONE && 
			this.request.status === 200
		) {
			this.onChunkLoad(this.request.response);
		}
		else if (
			this.request.readyState === this.request.DONE &&
			this.request.status === 404
		) {
			// Regular case - just eof.
			this.completed = true;
		}
		else if (this.request.readyState === this.request.DONE) {
			// Retry?
			if (this.loadFails++ < 3) {
				this.loadNextChunk();
			}
		}
	}.bind(this);
	
	if (this.chunkIdx === 0) {
		this.request.onprogress = this.onProgress.bind(this);
	}

	this.request.open('GET', this.url+'.'+this.chunkIdx.toString().padStart(this.chunkDigits,'0'));
	this.request.responseType = "arraybuffer";
	this.request.send();
};

AjaxChunksSource.prototype.onProgress = function(ev) {
	this.progress = (ev.loaded / ev.total);
};

AjaxChunksSource.prototype.onChunkLoad = function(data) {
	this.established = true;
	this.progress = 1;
	this.chunkIdx++;
	if (this.chunkSize && data.byteLength < this.chunkSize)
		this.completed = true;
	this.chunkSize = data.byteLength || 1;
	this.loadFails = 0;
	this.isLoading = false;

	if (this.destination) {
		this.destination.write(data);
	}

	this.loadTime = JSMpeg.Now() - this.loadStartTime;
	if (!this.throttled) {
		this.loadNextChunk();
	}
};

return AjaxChunksSource;

})();


