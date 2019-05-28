JSMpeg.Source.Ajax = (function(){ "use strict";

var AjaxSource = function(url, options) {
	this.url = url;
	this.destination = null;
	this.request = null;
	this.streaming = false;

	this.completed = false;
	this.established = false;
	this.progress = 0;

	this.onEstablishedCallback = options.onSourceEstablished;
	this.onCompletedCallback = options.onSourceCompleted;
};

AjaxSource.prototype.connect = function(destination) {
	this.destination = destination;
};

AjaxSource.prototype.start = function() {
	this.request = new XMLHttpRequest();

	this.request.onreadystatechange = function() {
		if (
			this.request.readyState === this.request.DONE && 
			this.request.status === 200
		) {
			this.onLoad(this.request.response);
		}
	}.bind(this);

	this.request.onprogress = this.onProgress.bind(this);
	this.request.open('GET', this.url);
	this.request.responseType = "arraybuffer";
	this.request.send();
};

AjaxSource.prototype.resume = function(secondsHeadroom) {
	// Nothing to do here
};

AjaxSource.prototype.destroy = function() {
	this.request.abort();
};

AjaxSource.prototype.onProgress = function(ev) {
	this.progress = (ev.loaded / ev.total);
};

AjaxSource.prototype.onLoad = function(data) {
	this.established = true;
	this.completed = true;
	this.progress = 1;

	if (this.onEstablishedCallback) {
		this.onEstablishedCallback(this);
	}
	if (this.onCompletedCallback) {
		this.onCompletedCallback(this);
	}

	if (this.destination) {
		this.destination.write(data);
	}
};

return AjaxSource;

})();


