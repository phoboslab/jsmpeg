var utils = require('./utils.js');

var CanvasRenderer = module.exports = function(decoder, canvas) {
  this.decoder = decoder;
  this.canvas = canvas;
  this.ctx = this.canvas.getContext('2d');
};

CanvasRenderer.prototype.init = function() {
  this.imageData = this.ctx.getImageData(0, 0, this.decoder.width, this.decoder.height);
  utils.fillArray(this.imageData.data, 255);
};

CanvasRenderer.prototype.render = function(Y, Cb, Cr) {
  this.YCbCrToRGBA(Y, Cb, Cr);
  this.ctx.putImageData(this.imageData, 0, 0);
};

CanvasRenderer.prototype.YCbCrToRGBA = function(Y, Cb, Cr) {
  var RGBA = this.imageData.data;

  // Chroma values are the same for each block of 4 pixels, so we proccess
  // 2 lines at a time, 2 neighboring pixels each.
  // I wish we could use 32bit writes to the RGBA buffer instead of writing
  // each byte separately, but we need the automatic clamping of the RGBA
  // buffer.
  var yIndex1 = 0;
  var yIndex2 = this.decoder.codedWidth;
  var yNext2Lines = this.decoder.codedWidth + (this.decoder.codedWidth - this.decoder.width);

  var cIndex = 0;
  var cNextLine = this.decoder.halfWidth - (this.decoder.width >> 1);

  var rgbaIndex1 = 0;
  var rgbaIndex2 = this.decoder.width * 4;
  var rgbaNext2Lines = this.decoder.width * 4;

  var cols = this.decoder.width >> 1;
  var rows = this.decoder.height >> 1;

  var y;
  var cb;
  var cr;
  var r;
  var g;
  var b;

  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      cb = Cb[cIndex];
      cr = Cr[cIndex];
      cIndex++;

      r = (cr + ((cr * 103) >> 8)) - 179;
      g = ((cb * 88) >> 8) - 44 + ((cr * 183) >> 8) - 91;
      b = (cb + ((cb * 198) >> 8)) - 227;

      // Line 1
      var y1 = Y[yIndex1++];
      var y2 = Y[yIndex1++];
      RGBA[rgbaIndex1] = y1 + r;
      RGBA[rgbaIndex1 + 1] = y1 - g;
      RGBA[rgbaIndex1 + 2] = y1 + b;
      RGBA[rgbaIndex1 + 4] = y2 + r;
      RGBA[rgbaIndex1 + 5] = y2 - g;
      RGBA[rgbaIndex1 + 6] = y2 + b;
      rgbaIndex1 += 8;

      // Line 2
      var y3 = Y[yIndex2++];
      var y4 = Y[yIndex2++];
      RGBA[rgbaIndex2] = y3 + r;
      RGBA[rgbaIndex2 + 1] = y3 - g;
      RGBA[rgbaIndex2 + 2] = y3 + b;
      RGBA[rgbaIndex2 + 4] = y4 + r;
      RGBA[rgbaIndex2 + 5] = y4 - g;
      RGBA[rgbaIndex2 + 6] = y4 + b;
      rgbaIndex2 += 8;
    }

    yIndex1 += yNext2Lines;
    yIndex2 += yNext2Lines;
    rgbaIndex1 += rgbaNext2Lines;
    rgbaIndex2 += rgbaNext2Lines;
    cIndex += cNextLine;
  }
};
