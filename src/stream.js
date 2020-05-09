JSMpeg.Source.Stream = (function(){ "use strict";

var StreamSource = function(stream, options) {
	this.stream = stream;
	this.destination = null;

	this.completed = false;
	this.established = false;
	this.progress = 0;

	// Streaming is obiously true when using a stream
	this.streaming = true;
};

StreamSource.prototype.connect = function(destination) {
	this.destination = destination;
};

StreamSource.prototype.setStream = function(stream) {
	if (this.stream) {
		this.stream.destroy();
	}

	this.stream = stream;
	this.start();
};

StreamSource.prototype.start = function() {

	var that = this;

	if (!this.stream) {
		return;
	}

	this.stream.on('data', function onData(chunk) {
		that.onLoad(chunk);
	});
};

StreamSource.prototype.resume = function(secondsHeadroom) {
	// Nothing to do here
};

StreamSource.prototype.destroy = function() {
	if (this.stream) {
		this.stream.destroy();
	}
};

StreamSource.prototype.onLoad = function(data) {
	this.established = true;
	this.completed = true;
	this.progress = 1;

	if (this.destination) {
		this.destination.write(data);
	}
};

return StreamSource;

})();