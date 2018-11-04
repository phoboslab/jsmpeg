JSMpeg.Decoder.MP2AudioWASM = (function(){ "use strict";

// Based on kjmp2 by Martin J. Fiedler
// http://keyj.emphy.de/kjmp2/

var MP2WASM = function(options) {
	JSMpeg.Decoder.Base.call(this, options);

	this.onDecodeCallback = options.onAudioDecode;
	this.module = options.wasmModule;

	this.bufferSize = options.audioBufferSize || 128*1024;
	this.bufferMode = options.streaming
		? JSMpeg.BitBuffer.MODE.EVICT
		: JSMpeg.BitBuffer.MODE.EXPAND;

	this.sampleRate = 0;
};

MP2WASM.prototype = Object.create(JSMpeg.Decoder.Base.prototype);
MP2WASM.prototype.constructor = MP2WASM;

MP2WASM.prototype.initializeWasmDecoder = function() {
	if (!this.module.instance) {
		console.warn('JSMpeg: WASM module not compiled yet');
		return;
	}
	this.instance = this.module.instance;
	this.functions = this.module.instance.exports;
	this.decoder = this.functions._mp2_decoder_create(this.bufferSize, this.bufferMode);
};

MP2WASM.prototype.destroy = function() {
	if (!this.decoder) {
		return;
	}
	this.functions._mp2_decoder_destroy(this.decoder);
};

MP2WASM.prototype.bufferGetIndex = function() {
	if (!this.decoder) {
		return;
	}
	return this.functions._mp2_decoder_get_index(this.decoder);
};

MP2WASM.prototype.bufferSetIndex = function(index) {
	if (!this.decoder) {
		return;
	}
	this.functions._mp2_decoder_set_index(this.decoder, index);
};

MP2WASM.prototype.bufferWrite = function(buffers) {
	if (!this.decoder) {
		this.initializeWasmDecoder();
	}

	var totalLength = 0;
	for (var i = 0; i < buffers.length; i++) {
		totalLength += buffers[i].length;
	}

	var ptr = this.functions._mp2_decoder_get_write_ptr(this.decoder, totalLength);
	for (var i = 0; i < buffers.length; i++) {
		this.instance.heapU8.set(buffers[i], ptr);
		ptr += buffers[i].length;
	}
	
	this.functions._mp2_decoder_did_write(this.decoder, totalLength);
	return totalLength;
};

MP2WASM.prototype.decode = function() {
	var startTime = JSMpeg.Now();

	if (!this.decoder) {
		return false;
	}	

	var decodedBytes = this.functions._mp2_decoder_decode(this.decoder);
	if (decodedBytes === 0) {
		return false;
	}

	if (!this.sampleRate) {
		this.sampleRate = this.functions._mp2_decoder_get_sample_rate(this.decoder);
	}

	if (this.destination) {
		// Create a Float32 View into the modules output channel data
		var leftPtr = this.functions._mp2_decoder_get_left_channel_ptr(this.decoder),
			rightPtr = this.functions._mp2_decoder_get_right_channel_ptr(this.decoder);

		var leftOffset = leftPtr / Float32Array.BYTES_PER_ELEMENT,
			rightOffset = rightPtr / Float32Array.BYTES_PER_ELEMENT;

		var left = this.instance.heapF32.subarray(leftOffset, leftOffset + MP2WASM.SAMPLES_PER_FRAME),
			right = this.instance.heapF32.subarray(rightOffset, rightOffset + MP2WASM.SAMPLES_PER_FRAME);

		this.destination.play(this.sampleRate, left, right);
	}

	this.advanceDecodedTime(MP2WASM.SAMPLES_PER_FRAME / this.sampleRate);

	var elapsedTime = JSMpeg.Now() - startTime;
	if (this.onDecodeCallback) {
		this.onDecodeCallback(this, elapsedTime);
	}
	return true;
};


MP2WASM.prototype.getCurrentTime = function() {
	var enqueuedTime = this.destination ? this.destination.enqueuedTime : 0;
	return this.decodedTime - enqueuedTime;
};

MP2WASM.SAMPLES_PER_FRAME = 1152;

return MP2WASM;

})();

