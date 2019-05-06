JSMpeg.Renderer.WebGL = (function(){ "use strict";

var WebGLRenderer = function(options) {
	this.canvas = options.canvas || document.createElement('canvas');
	this.width = this.canvas.width;
	this.height = this.canvas.height;
	this.enabled = true;

	this.hasTextureData = {};

	var contextCreateOptions = {
		preserveDrawingBuffer: !!options.preserveDrawingBuffer,
		alpha: false,
		depth: false,
		stencil: false,
		antialias: false,
		premultipliedAlpha: false
	};

	this.gl = 
		this.canvas.getContext('webgl', contextCreateOptions) || 
		this.canvas.getContext('experimental-webgl', contextCreateOptions);

	if (!this.gl) {
		throw new Error('Failed to get WebGL Context');
	}

	var gl = this.gl;
	var vertexAttr = null;

	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

	// Init buffers
	this.vertexBuffer = gl.createBuffer();
	var vertexCoords = new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertexCoords, gl.STATIC_DRAW);

	// Setup the main YCrCbToRGBA shader
	this.program = this.createProgram(
		WebGLRenderer.SHADER.VERTEX_IDENTITY,
		WebGLRenderer.SHADER.FRAGMENT_YCRCB_TO_RGBA
	);
	vertexAttr = gl.getAttribLocation(this.program, 'vertex');
	gl.enableVertexAttribArray(vertexAttr);
	gl.vertexAttribPointer(vertexAttr, 2, gl.FLOAT, false, 0, 0);

	this.textureY = this.createTexture(0, 'textureY');
	this.textureCb = this.createTexture(1, 'textureCb');
	this.textureCr = this.createTexture(2, 'textureCr');


	// Setup the loading animation shader
	this.loadingProgram = this.createProgram(
		WebGLRenderer.SHADER.VERTEX_IDENTITY,
		WebGLRenderer.SHADER.FRAGMENT_LOADING
	);
	vertexAttr = gl.getAttribLocation(this.loadingProgram, 'vertex');
	gl.enableVertexAttribArray(vertexAttr);
	gl.vertexAttribPointer(vertexAttr, 2, gl.FLOAT, false, 0, 0);

	this.shouldCreateUnclampedViews = !this.allowsClampedTextureData();
};

WebGLRenderer.prototype.destroy = function() {
	var gl = this.gl;
	
	gl.deleteTexture(this.textureY);
	gl.deleteTexture(this.textureCb);
	gl.deleteTexture(this.textureCr);

	gl.deleteProgram(this.program);
	gl.deleteProgram(this.loadingProgram);

	gl.deleteBuffer(this.vertexBuffer);

	gl.getExtension('WEBGL_lose_context').loseContext();
	this.canvas.remove();
};

WebGLRenderer.prototype.resize = function(width, height) {
	this.width = width|0;
	this.height = height|0;

	this.canvas.width = this.width;
	this.canvas.height = this.height;

	this.gl.useProgram(this.program);

	var codedWidth = ((this.width + 15) >> 4) << 4;
	this.gl.viewport(0, 0, codedWidth, this.height);
};

WebGLRenderer.prototype.createTexture = function(index, name) {
	var gl = this.gl;
	var texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.uniform1i(gl.getUniformLocation(this.program, name), index);

	return texture;
};

WebGLRenderer.prototype.createProgram = function(vsh, fsh) {
	var gl = this.gl;
	var program = gl.createProgram();

	gl.attachShader(program, this.compileShader(gl.VERTEX_SHADER, vsh));
	gl.attachShader(program, this.compileShader(gl.FRAGMENT_SHADER, fsh));
	gl.linkProgram(program);
	gl.useProgram(program);

	return program;
};

WebGLRenderer.prototype.compileShader = function(type, source) {
	var gl = this.gl;
	var shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(gl.getShaderInfoLog(shader));
	}

	return shader;
};

WebGLRenderer.prototype.allowsClampedTextureData = function() {
	var gl = this.gl;
	var texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0,
		gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8ClampedArray([0])
	);
	return (gl.getError() === 0);
};

WebGLRenderer.prototype.renderProgress = function(progress) {
	var gl = this.gl;

	gl.useProgram(this.loadingProgram);

	var loc = gl.getUniformLocation(this.loadingProgram, 'progress');
	gl.uniform1f(loc, progress);
	
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

WebGLRenderer.prototype.render = function(y, cb, cr, isClampedArray) {
	if (!this.enabled) {
		return;
	}

	var gl = this.gl;
	var w = ((this.width + 15) >> 4) << 4,
		h = this.height,
		w2 = w >> 1,
		h2 = h >> 1;

	// In some browsers WebGL doesn't like Uint8ClampedArrays (this is a bug
	// and should be fixed soon-ish), so we have to create a Uint8Array view 
	// for each plane.
	if (isClampedArray && this.shouldCreateUnclampedViews) {
		y = new Uint8Array(y.buffer),
		cb = new Uint8Array(cb.buffer),
		cr = new Uint8Array(cr.buffer);	
	}

	gl.useProgram(this.program);

	this.updateTexture(gl.TEXTURE0, this.textureY, w, h, y);
	this.updateTexture(gl.TEXTURE1, this.textureCb, w2, h2, cb);
	this.updateTexture(gl.TEXTURE2, this.textureCr, w2, h2, cr);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

WebGLRenderer.prototype.updateTexture = function(unit, texture, w, h, data) {
	var gl = this.gl;
	gl.activeTexture(unit);
	gl.bindTexture(gl.TEXTURE_2D, texture);

	if (this.hasTextureData[unit]) {
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
	}
	else {
		this.hasTextureData[unit] = true;
		gl.texImage2D(
			gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, 
			gl.LUMINANCE, gl.UNSIGNED_BYTE, data
		);
	}
}

WebGLRenderer.IsSupported = function() {
	try {
		if (!window.WebGLRenderingContext) {
			return false;
		}

		var canvas = document.createElement('canvas'); 
		return !!(
			canvas.getContext('webgl') || 
			canvas.getContext('experimental-webgl')
		);
	}
	catch (err) {
		return false;
	} 
};

WebGLRenderer.SHADER = {
	FRAGMENT_YCRCB_TO_RGBA: [
		'precision mediump float;',
		'uniform sampler2D textureY;',
		'uniform sampler2D textureCb;',
		'uniform sampler2D textureCr;',
		'varying vec2 texCoord;',

		'mat4 rec601 = mat4(',
			'1.16438,  0.00000,  1.59603, -0.87079,',
			'1.16438, -0.39176, -0.81297,  0.52959,',
			'1.16438,  2.01723,  0.00000, -1.08139,',
			'0, 0, 0, 1',
		');',

		'void main() {',
			'float y = texture2D(textureY, texCoord).r;',
			'float cb = texture2D(textureCb, texCoord).r;',
			'float cr = texture2D(textureCr, texCoord).r;',

			'gl_FragColor = vec4(y, cr, cb, 1.0) * rec601;',
		'}'
	].join('\n'),

	FRAGMENT_LOADING: [
		'precision mediump float;',
		'uniform float progress;',
		'varying vec2 texCoord;',

		'void main() {',
			'float c = ceil(progress-(1.0-texCoord.y));',
			'gl_FragColor = vec4(c,c,c,1);',
		'}'
	].join('\n'),

	VERTEX_IDENTITY: [
		'attribute vec2 vertex;',
		'varying vec2 texCoord;',

		'void main() {',
			'texCoord = vertex;',
			'gl_Position = vec4((vertex * 2.0 - 1.0) * vec2(1, -1), 0.0, 1.0);',
		'}'
	].join('\n')
};

return WebGLRenderer;

})();

