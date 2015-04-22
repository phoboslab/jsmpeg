var copyBlockToDestination = function(blockData, destArray, destIndex, scan) {
  for (var n = 0; n < 64; n += 8, destIndex += scan + 8) {
    destArray[destIndex + 0] = blockData[n + 0];
    destArray[destIndex + 1] = blockData[n + 1];
    destArray[destIndex + 2] = blockData[n + 2];
    destArray[destIndex + 3] = blockData[n + 3];
    destArray[destIndex + 4] = blockData[n + 4];
    destArray[destIndex + 5] = blockData[n + 5];
    destArray[destIndex + 6] = blockData[n + 6];
    destArray[destIndex + 7] = blockData[n + 7];
  }
};

var addBlockToDestination = function(blockData, destArray, destIndex, scan) {
  for (var n = 0; n < 64; n += 8, destIndex += scan + 8) {
    destArray[destIndex + 0] += blockData[n + 0];
    destArray[destIndex + 1] += blockData[n + 1];
    destArray[destIndex + 2] += blockData[n + 2];
    destArray[destIndex + 3] += blockData[n + 3];
    destArray[destIndex + 4] += blockData[n + 4];
    destArray[destIndex + 5] += blockData[n + 5];
    destArray[destIndex + 6] += blockData[n + 6];
    destArray[destIndex + 7] += blockData[n + 7];
  }
};

// Clamping version for shitty browsers (IE) that don't support Uint8ClampedArray
var copyBlockToDestinationClamp = function(blockData, destArray, destIndex, scan) {
  var n = 0;
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      var p = blockData[n++];
      destArray[destIndex++] = p > 255 ? 255 : (p < 0 ? 0 : p);
    }
    destIndex += scan;
  }
};

var addBlockToDestinationClamp = function(blockData, destArray, destIndex, scan) {
  var n = 0;
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      var p = blockData[n++] + destArray[destIndex];
      destArray[destIndex++] = p > 255 ? 255 : (p < 0 ? 0 : p);
    }
    destIndex += scan;
  }
};


// Manually clamp values when writing macroblocks for shitty browsers
// that don't support Uint8ClampedArray
module.exports.MaybeClampedUint8Array = window.Uint8ClampedArray || window.Uint8Array;

if (!window.Uint8ClampedArray) {
  module.exports.copyBlockToDestination = copyBlockToDestination;
  module.exports.addBlockToDestination = addBlockToDestination;
} else {
  module.exports.copyBlockToDestination = copyBlockToDestinationClamp;
  module.exports.addBlockToDestination = addBlockToDestinationClamp;
}


module.exports.copyValueToDestination = function(value, destArray, destIndex, scan) {
  for (var n = 0; n < 64; n += 8, destIndex += scan + 8) {
    destArray[destIndex + 0] = value;
    destArray[destIndex + 1] = value;
    destArray[destIndex + 2] = value;
    destArray[destIndex + 3] = value;
    destArray[destIndex + 4] = value;
    destArray[destIndex + 5] = value;
    destArray[destIndex + 6] = value;
    destArray[destIndex + 7] = value;
  }
};

module.exports.addValueToDestination = function(value, destArray, destIndex, scan) {
  for (var n = 0; n < 64; n += 8, destIndex += scan + 8) {
    destArray[destIndex + 0] += value;
    destArray[destIndex + 1] += value;
    destArray[destIndex + 2] += value;
    destArray[destIndex + 3] += value;
    destArray[destIndex + 4] += value;
    destArray[destIndex + 5] += value;
    destArray[destIndex + 6] += value;
    destArray[destIndex + 7] += value;
  }
};

module.exports.fillArray = function(a, value) {
  for (var i = 0, length = a.length; i < length; i++) {
    a[i] = value;
  }
};
