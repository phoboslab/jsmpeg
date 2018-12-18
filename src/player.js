JSMpeg.Player = (function(){ "use strict";

var Player = function(url, options) {
	this.options = options || {};

	if (options.source) {
		this.source = new options.source(url, options);
		options.streaming = !!this.source.streaming;
	}
	else if (url.match(/^wss?:\/\//)) {
		this.source = new JSMpeg.Source.WebSocket(url, options);
		options.streaming = true;
	}
	else if (options.progressive !== false) {
		this.source = new JSMpeg.Source.AjaxProgressive(url, options);
		options.streaming = false;
	}
	else {
		this.source = new JSMpeg.Source.Ajax(url, options);
		options.streaming = false;
	}

	this.maxAudioLag = options.maxAudioLag || 0.25;
	this.loop = options.loop !== false;
	this.autoplay = !!options.autoplay || options.streaming;

	this.demuxer = new JSMpeg.Demuxer.TS(options);
	this.source.connect(this.demuxer);

	if (!options.disableWebAssembly && JSMpeg.WASMModule.IsSupported()) {
		this.wasmModule = new JSMpeg.WASMModule();
		options.wasmModule = this.wasmModule;
	}

	if (options.video !== false) {
		this.video = options.wasmModule
			? new JSMpeg.Decoder.MPEG1VideoWASM(options)
			: new JSMpeg.Decoder.MPEG1Video(options);

		this.renderer = !options.disableGl && JSMpeg.Renderer.WebGL.IsSupported()
			? new JSMpeg.Renderer.WebGL(options)
			: new JSMpeg.Renderer.Canvas2D(options);
		
		this.demuxer.connect(JSMpeg.Demuxer.TS.STREAM.VIDEO_1, this.video);
		this.video.connect(this.renderer);
	}

	if (options.audio !== false && JSMpeg.AudioOutput.WebAudio.IsSupported()) {
		this.audio = options.wasmModule
			? new JSMpeg.Decoder.MP2AudioWASM(options)
			: new JSMpeg.Decoder.MP2Audio(options);
		this.audioOut = new JSMpeg.AudioOutput.WebAudio(options);
		this.demuxer.connect(JSMpeg.Demuxer.TS.STREAM.AUDIO_1, this.audio);
		this.audio.connect(this.audioOut);
	}

	Object.defineProperty(this, 'currentTime', {
		get: this.getCurrentTime,
		set: this.setCurrentTime
	});
	Object.defineProperty(this, 'volume', {
		get: this.getVolume,
		set: this.setVolume
	});

	this.paused = true;
	this.unpauseOnShow = false;
	if (options.pauseWhenHidden !== false) {
		document.addEventListener('visibilitychange', this.showHide.bind(this));
	}

	// If we have WebAssembly support, wait until the module is compiled before
	// loading the source. Otherwise the decoders won't know what to do with 
	// the source data.
	if (this.wasmModule) {
		if (JSMpeg.WASM_BINARY_INLINED) {
			var wasm = JSMpeg.Base64ToArrayBuffer(JSMpeg.WASM_BINARY_INLINED);
			this.wasmModule.loadFromBuffer(wasm, this.startLoading.bind(this));
		}
		else {
			this.wasmModule.loadFromFile('jsmpeg.wasm',  this.startLoading.bind(this));
		}
	}
	else {
		this.startLoading();
		
	}
};

Player.prototype.startLoading = function() {
	this.source.start();
	if (this.autoplay) {
		this.play();
	}
};

Player.prototype.showHide = function(ev) {
	if (document.visibilityState === 'hidden') {
		this.unpauseOnShow = this.wantsToPlay;
		this.pause();
	}
	else if (this.unpauseOnShow) {
		this.play();
	}
};

Player.prototype.play = function(ev) {
	if (this.animationId) {
		return;
	}

	this.animationId = requestAnimationFrame(this.update.bind(this));
	this.wantsToPlay = true;
	this.paused = false;
};

Player.prototype.pause = function(ev) {
	if (this.paused) {
		return;
	}

	cancelAnimationFrame(this.animationId);
	this.animationId = null;
	this.wantsToPlay = false;
	this.isPlaying = false;
	this.paused = true;

	if (this.audio && this.audio.canPlay) {
		// Seek to the currentTime again - audio may already be enqueued a bit
		// further, so we have to rewind it.
		this.audioOut.stop();
		this.seek(this.currentTime);
	}

	if (this.options.onPause) {
		this.options.onPause(this);
	}
};

Player.prototype.getVolume = function() {
	return this.audioOut ? this.audioOut.volume : 0;
};

Player.prototype.setVolume = function(volume) {
	if (this.audioOut) {
		this.audioOut.volume = volume;
	}
};

Player.prototype.stop = function(ev) {
	this.pause();
	this.seek(0);
	if (this.video && this.options.decodeFirstFrame !== false) {
		this.video.decode();
	}
};

Player.prototype.destroy = function() {
	this.pause();
	this.source.destroy();
	this.video && this.video.destroy();
	this.renderer && this.renderer.destroy();
	this.audio && this.audio.destroy();
	this.audioOut && this.audioOut.destroy();
};

Player.prototype.seek = function(time) {
	var startOffset = this.audio && this.audio.canPlay
		? this.audio.startTime
		: this.video.startTime;

	if (this.video) {
		this.video.seek(time + startOffset);
	}
	if (this.audio) {
		this.audio.seek(time + startOffset);
	}

	this.startTime = JSMpeg.Now() - time;
};

Player.prototype.getCurrentTime = function() {
	return this.audio && this.audio.canPlay
		? this.audio.currentTime - this.audio.startTime
		: this.video.currentTime - this.video.startTime;
};

Player.prototype.setCurrentTime = function(time) {
	this.seek(time);
};

Player.prototype.update = function() {
	this.animationId = requestAnimationFrame(this.update.bind(this));

	if (!this.source.established) {
		if (this.renderer) {
			this.renderer.renderProgress(this.source.progress);
		}
		return;
	}

	if (!this.isPlaying) {
		this.isPlaying = true;
		this.startTime = JSMpeg.Now() - this.currentTime;

		if (this.options.onPlay) {
			this.options.onPlay(this);
		}
	}

	if (this.options.streaming) {
		this.updateForStreaming();
	}
	else {
		this.updateForStaticFile();
	}
};

Player.prototype.updateForStreaming = function() {
	// When streaming, immediately decode everything we have buffered up until
	// now to minimize playback latency.

	if (this.video) {
		this.video.decode();
	}

	if (this.audio) {
		var decoded = false;
		do {
			// If there's a lot of audio enqueued already, disable output and
			// catch up with the encoding.
			if (this.audioOut.enqueuedTime > this.maxAudioLag) {
				this.audioOut.resetEnqueuedTime();
				this.audioOut.enabled = false;
			}
			decoded = this.audio.decode();		
		} while (decoded);
		this.audioOut.enabled = true;
	}
};

Player.prototype.nextFrame = function() {
	if (this.source.established && this.video) {
		return this.video.decode();
	}
	return false;
};

Player.prototype.updateForStaticFile = function() {
	var notEnoughData = false,
		headroom = 0;

	// If we have an audio track, we always try to sync the video to the audio.
	// Gaps and discontinuities are far more percetable in audio than in video.

	if (this.audio && this.audio.canPlay) {
		// Do we have to decode and enqueue some more audio data?
		while (
			!notEnoughData && 
			this.audio.decodedTime - this.audio.currentTime < 0.25
		) {
			notEnoughData = !this.audio.decode();
		}

		// Sync video to audio
		if (this.video && this.video.currentTime < this.audio.currentTime) {
			notEnoughData = !this.video.decode();
		}

		headroom = this.demuxer.currentTime - this.audio.currentTime;
	}


	else if (this.video) {
		// Video only - sync it to player's wallclock
		var targetTime = (JSMpeg.Now() - this.startTime) + this.video.startTime,
			lateTime = targetTime - this.video.currentTime,
			frameTime = 1/this.video.frameRate;

		if (this.video && lateTime > 0) {
			// If the video is too far behind (>2 frames), simply reset the
			// target time to the next frame instead of trying to catch up.
			if (lateTime > frameTime * 2) {
				this.startTime += lateTime;
			}

			notEnoughData = !this.video.decode();
		}

		headroom = this.demuxer.currentTime - targetTime;
	}

	// Notify the source of the playhead headroom, so it can decide whether to
	// continue loading further data.
	this.source.resume(headroom);

	// If we failed to decode and the source is complete, it means we reached
	// the end of our data. We may want to loop.
	if (notEnoughData && this.source.completed) {
		if (this.loop) {
			this.seek(0);
		}
		else {
			this.pause();
			if (this.options.onEnded) {
				this.options.onEnded(this);
			}
		}
	}

	// If there's not enough data and the source is not completed, we have
	// just stalled.
	else if (notEnoughData && this.options.onStalled) {
		this.options.onStalled(this);
	}
};

return Player;

})();

