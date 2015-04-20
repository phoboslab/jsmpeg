// ----------------------------------------------------------------------------
// Accelerated WebGL YCbCrToRGBA conversion

jsmpeg.prototype.gl = null;
jsmpeg.prototype.program = null;
jsmpeg.prototype.YTexture = null;
jsmpeg.prototype.CBTexture = null;
jsmpeg.prototype.CRTexture = null;

jsmpeg.prototype.createTexture = function(index, name) {
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

jsmpeg.prototype.compileShader = function(type, source) {
	var gl = this.gl;
	var shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if( !gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
		throw new Error(gl.getShaderInfoLog(shader));
	}

	return shader;
};

jsmpeg.prototype.initWebGL = function() {
	// attempt to get a webgl context
	try {
		var gl = this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
	} catch (e) {
		return false;
	}

	if (!gl) {
		return false;
	}

	// init buffers
	this.buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

	// The main YCbCrToRGBA Shader
	this.program = gl.createProgram();
	gl.attachShader(this.program, this.compileShader(gl.VERTEX_SHADER, SHADER_VERTEX_IDENTITY));
	gl.attachShader(this.program, this.compileShader(gl.FRAGMENT_SHADER, SHADER_FRAGMENT_YCBCRTORGBA));
	gl.linkProgram(this.program);

	if( !gl.getProgramParameter(this.program, gl.LINK_STATUS) ) {
		throw new Error(gl.getProgramInfoLog(this.program));
	}

	gl.useProgram(this.program);

	// setup textures
	this.YTexture = this.createTexture(0, 'YTexture');
	this.CBTexture = this.createTexture(1, 'CBTexture');
	this.CRTexture = this.createTexture(2, 'CRTexture');

	var vertexAttr = gl.getAttribLocation(this.program, 'vertex');
	gl.enableVertexAttribArray(vertexAttr);
	gl.vertexAttribPointer(vertexAttr, 2, gl.FLOAT, false, 0, 0);


	// Shader for the loading screen
	this.loadingProgram = gl.createProgram();
	gl.attachShader(this.loadingProgram, this.compileShader(gl.VERTEX_SHADER, SHADER_VERTEX_IDENTITY));
	gl.attachShader(this.loadingProgram, this.compileShader(gl.FRAGMENT_SHADER, SHADER_FRAGMENT_LOADING));
	gl.linkProgram(this.loadingProgram);

	gl.useProgram(this.loadingProgram);

	vertexAttr = gl.getAttribLocation(this.loadingProgram, 'vertex');
	gl.enableVertexAttribArray(vertexAttr);
	gl.vertexAttribPointer(vertexAttr, 2, gl.FLOAT, false, 0, 0);

	return true;
};

jsmpeg.prototype.renderFrameGL = function() {
	var gl = this.gl;

	// WebGL doesn't like Uint8ClampedArrays, so we have to create a Uint8Array view for
	// each plane
	var uint8Y = new Uint8Array(this.currentY.buffer),
		uint8Cr = new Uint8Array(this.currentCr.buffer),
		uint8Cb = new Uint8Array(this.currentCb.buffer);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, this.YTexture);

	gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth, this.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y);

	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, this.CBTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth, this.height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr);

	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, this.CRTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth, this.height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

// Shaders for accelerated WebGL YCbCrToRGBA conversion
SHADER_FRAGMENT_YCBCRTORGBA = [
  'precision mediump float;',
  'uniform sampler2D YTexture;',
  'uniform sampler2D CBTexture;',
  'uniform sampler2D CRTexture;',
  'varying vec2 texCoord;',

  'void main() {',
  'float y = texture2D(YTexture, texCoord).r;',
  'float cr = texture2D(CBTexture, texCoord).r - 0.5;',
  'float cb = texture2D(CRTexture, texCoord).r - 0.5;',

  'gl_FragColor = vec4(',
  'y + 1.4 * cr,',
  'y + -0.343 * cb - 0.711 * cr,',
  'y + 1.765 * cb,',
  '1.0',
  ');',
  '}'
].join('\n'),

SHADER_FRAGMENT_LOADING = [
  'precision mediump float;',
  'uniform float loaded;',
  'varying vec2 texCoord;',

  'void main() {',
  'float c = ceil(loaded-(1.0-texCoord.y));',
  //'float c = ceil(loaded-(1.0-texCoord.y) +sin((texCoord.x+loaded)*16.0)*0.01);', // Fancy wave anim
  'gl_FragColor = vec4(c,c,c,1);',
  '}'
].join('\n'),

SHADER_VERTEX_IDENTITY = [
  'attribute vec2 vertex;',
  'varying vec2 texCoord;',

  'void main() {',
  'texCoord = vertex;',
  'gl_Position = vec4((vertex * 2.0 - 1.0) * vec2(1, -1), 0.0, 1.0);',
  '}'
].join('\n');
