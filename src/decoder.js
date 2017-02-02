JSMpeg.Decoder.Base = (function(){ "use strict";

var BaseDecoder = function(options) {
	this.destination = null;
	this.canPlay = false;

	this.collectTimestamps = !options.streaming;
	this.timestamps = [];
	this.timestampIndex = 0;

	this.startTime = 0;
	this.decodedTime = 0;

	Object.defineProperty(this, 'currentTime', {get: this.getCurrentTime});
};

BaseDecoder.prototype.connect = function(destination) {
	this.destination = destination;
};

BaseDecoder.prototype.write = function(pts, buffers) {
	if (this.collectTimestamps) {
		if (this.timestamps.length === 0) {
			this.startTime = pts;
			this.decodedTime = pts;
		}
		this.timestamps.push({index: this.bits.byteLength << 3, time: pts});
	}

	this.bits.write(buffers);
	this.canPlay = true;
};

BaseDecoder.prototype.seek = function(time) {
	if (!this.collectTimestamps) {
		return;
	}

	this.timestampIndex = 0;
	for (var i = 0; i < this.timestamps.length; i++) {
		if (this.timestamps[i].time > time) {
			break;
		}
		this.timestampIndex = i;
	}

	var ts = this.timestamps[this.timestampIndex];
	if (ts) {
		this.bits.index = ts.index;
		this.decodedTime = ts.time;
	}
	else {
		this.bits.index = 0;
		this.decodedTime = this.startTime;
	}
};

BaseDecoder.prototype.decode = function() {
	this.advanceDecodedTime(0);
};

BaseDecoder.prototype.advanceDecodedTime = function(seconds) {
	if (this.collectTimestamps) {
		var newTimestampIndex = -1;
		for (var i = this.timestampIndex; i < this.timestamps.length; i++) {
			if (this.timestamps[i].index > this.bits.index) {
				break;
			}
			newTimestampIndex = i;
		}

		// Did we find a new PTS, different from the last? If so, we don't have
		// to advance the decoded time manually and can instead sync it exactly
		// to the PTS.
		if (
			newTimestampIndex !== -1 && 
			newTimestampIndex !== this.timestampIndex
		) {
			this.timestampIndex = newTimestampIndex;
			this.decodedTime = this.timestamps[this.timestampIndex].time;
			return;
		}
	}

	this.decodedTime += seconds;
};

BaseDecoder.prototype.getCurrentTime = function() {
	return this.decodedTime;
};

return BaseDecoder;

})();


