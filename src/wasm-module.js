JSMpeg.WASMModule = (function(){ "use strict";

var WASM = function() {
	this.stackSize = 5 * 1024 * 1024; // emscripten default
	this.pageSize = 64 * 1024; // wasm page size
	this.onInitCallback = null;
};

WASM.prototype.write = function(buffer) {
	this.loadFromBuffer(buffer, this.onInitCallback);
};

WASM.prototype.loadFromFile = function(url, callback) {
	this.onInitCallback = callback;
	var ajax = new JSMpeg.Source.Ajax(url);
	ajax.connect(this);
	ajax.start();
};

WASM.prototype.loadFromBuffer = function(buffer, callback) {
	this.moduleInfo = this.readDylinkSection(buffer);
	if (!this.moduleInfo) {
		this.callback && this.callback(null);
		return;
	}

	this.memory = new WebAssembly.Memory({initial: 256});
	var env = {
		memory: this.memory,
		memoryBase: 0,
		table: new WebAssembly.Table({initial: this.moduleInfo.tableSize, element: 'anyfunc'}),
		tableBase: 0,
		abort: this.c_abort.bind(this),
		___assert_fail: this.c_assertFail.bind(this),
		_sbrk: this.c_sbrk.bind(this)
	};

	this.brk = this.align(this.moduleInfo.memorySize + this.stackSize);
	WebAssembly.instantiate(buffer, {env: env}).then(function(results){
		this.instance = results.instance;
		if (this.instance.exports.__post_instantiate) {
			this.instance.exports.__post_instantiate();
		}
		this.createHeapViews();
		callback && callback(this);
	}.bind(this))
};

WASM.prototype.createHeapViews = function() {
	this.instance.heapU8 = new Uint8Array(this.memory.buffer);
	this.instance.heapU32 = new Uint32Array(this.memory.buffer);
	this.instance.heapF32 = new Float32Array(this.memory.buffer);
};

WASM.prototype.align = function(addr) {
	var a = Math.pow(2, this.moduleInfo.memoryAlignment);
	return Math.ceil(addr / a) * a;
};

WASM.prototype.c_sbrk = function(size) {
	var previousBrk = this.brk;
	this.brk += size;

	if (this.brk > this.memory.buffer.byteLength) {
		var bytesNeeded = this.brk - this.memory.buffer.byteLength;
		var pagesNeeded = Math.ceil(bytesNeeded / this.pageSize);
		this.memory.grow(pagesNeeded);
		this.createHeapViews();
	}
	return previousBrk;
};

WASM.prototype.c_abort = function(size) {
	console.warn('JSMPeg: WASM abort', arguments);
};

WASM.prototype.c_assertFail = function(size) {
	console.warn('JSMPeg: WASM ___assert_fail', arguments);
};


WASM.prototype.readDylinkSection = function(buffer) {
	// Read the WASM header and dylink section of the .wasm binary data
	// to get the needed table size and static data size.

	// https://github.com/WebAssembly/tool-conventions/blob/master/DynamicLinking.md
	// https://github.com/kripken/emscripten/blob/20602efb955a7c6c20865a495932427e205651d2/src/support.js

	var bytes = new Uint8Array(buffer);
	var next = 0;

	var readVarUint = function () {
		var ret = 0;
		var mul = 1;
		while (1) {
			var byte = bytes[next++];
			ret += ((byte & 0x7f) * mul);
			mul *= 0x80;
			if (!(byte & 0x80)) {
				return ret
			}
		}
	}

	var matchNextBytes = function(expected) {
		for (var i = 0; i < expected.length; i++) {
			var b = typeof(expected[i]) === 'string' 
				? expected[i].charCodeAt(0)
				: expected[i];
			if (bytes[next++] !== b) {
				return false;
			}
		}
		return true;
	};

	

	// Make sure we have a wasm header
	if (!matchNextBytes([0, 'a', 's', 'm'])) {
		console.warn('JSMpeg: WASM header not found');
		return null;
	}

	// Make sure we have a dylink section
	var next = 9;
	var sectionSize = readVarUint();
	if (!matchNextBytes([6, 'd', 'y', 'l', 'i', 'n', 'k'])) {
		console.warn('JSMpeg: No dylink section found in WASM');
		return null;
	}

	return {
		memorySize: readVarUint(),
		memoryAlignment: readVarUint(),
		tableSize: readVarUint(),
		tableAlignment: readVarUint()
	};
};

WASM.IsSupported = function() {
	return (!!window.WebAssembly);
};

return WASM;

})();

