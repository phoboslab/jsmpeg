JSMpeg.AudioOutput.WebAudio = (function() { "use strict";

var WebAudioOut = function(options) {
	this.context = WebAudioOut.CachedContext =
		WebAudioOut.CachedContext ||
		new (window.AudioContext || window.webkitAudioContext)();

	this.gain = this.context.createGain();
	this.destination = this.gain;

	// Keep track of the number of connections to this AudioContext, so we
	// can safely close() it when we're the only one connected to it.
	this.gain.connect(this.context.destination);
	this.context._connections = (this.context._connections || 0) + 1;
	
	this.startTime = 0;
	this.buffer = null;
	this.wallclockStartTime = 0;
	this.volume = 1;
	this.enabled = true;

	this.unlocked = !WebAudioOut.NeedsUnlocking();
	
	Object.defineProperty(this, 'enqueuedTime', {get: this.getEnqueuedTime});
};

WebAudioOut.prototype.destroy = function() {
	this.gain.disconnect();
	this.context._connections--;

	if (this.context._connections === 0) {
		this.context.close();
		WebAudioOut.CachedContext = null;
	}
};

WebAudioOut.prototype.play = function(sampleRate, left, right) {
	if (!this.enabled) {
		return;
	}

	// If the context is not unlocked yet, we simply advance the start time
	// to "fake" actually playing audio. This will keep the video in sync.
	if (!this.unlocked) {
		var ts = JSMpeg.Now()
		if (this.wallclockStartTime < ts) {
			this.wallclockStartTime = ts;
		}
		this.wallclockStartTime += left.length / sampleRate;
		return;
	}


	this.gain.gain.value = this.volume;

	var buffer = this.context.createBuffer(2, left.length, sampleRate);
	buffer.getChannelData(0).set(left);
	buffer.getChannelData(1).set(right);

	var source = this.context.createBufferSource();
	source.buffer = buffer;
	source.connect(this.destination);

	var now = this.context.currentTime;
	var duration = buffer.duration;
	if (this.startTime < now) {
		this.startTime = now;
		this.wallclockStartTime = JSMpeg.Now();
	}

	source.start(this.startTime);
	this.startTime += duration;
	this.wallclockStartTime += duration;
};

WebAudioOut.prototype.stop = function() {
	// Meh; there seems to be no simple way to get a list of currently
	// active source nodes from the Audio Context, and maintaining this
	// list ourselfs would be a pain, so we just set the gain to 0
	// to cut off all enqueued audio instantly.
	this.gain.gain.value = 0;
};

WebAudioOut.prototype.getEnqueuedTime = function() {
	// The AudioContext.currentTime is only updated every so often, so if we
	// want to get exact timing, we need to rely on the system time.
	return Math.max(this.wallclockStartTime - JSMpeg.Now(), 0)
};

WebAudioOut.prototype.resetEnqueuedTime = function() {
	this.startTime = this.context.currentTime;
	this.wallclockStartTime = JSMpeg.Now();
};

WebAudioOut.prototype.unlock = function(callback) {
	if (this.unlocked) {
		if (callback) {
			callback();
		}
		return;
	}

	this.unlockCallback = callback;
	
	// Create empty buffer and play it
	var buffer = this.context.createBuffer(1, 1, 22050);
	var source = this.context.createBufferSource();
	source.buffer = buffer;
	source.connect(this.destination);
	source.start(0);

	setTimeout(this.checkIfUnlocked.bind(this, source, 0), 0);
};

WebAudioOut.prototype.checkIfUnlocked = function(source, attempt) {
	if (
		source.playbackState === source.PLAYING_STATE || 
		source.playbackState === source.FINISHED_STATE
	) {
		this.unlocked = true;
		if (this.unlockCallback) {
			this.unlockCallback();
			this.unlockCallback = null;	
		}
	}
	else if (attempt < 10) {
		// Jeez, what a shit show. Thanks iOS!
		setTimeout(this.checkIfUnlocked.bind(this, source, attempt+1), 100);
	}
};

WebAudioOut.NeedsUnlocking = function() {
	return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

WebAudioOut.IsSupported = function() {
	return (window.AudioContext || window.webkitAudioContext);
};

WebAudioOut.CachedContext = null;

return WebAudioOut;

})();

