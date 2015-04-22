(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.jsmpeg = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var inherits = require('util').inherits;

var VideoLoader = require('./VideoLoader.js');
var BitReader = require('./BitReader.js');
var Decoder = require('./Decoder.js');

var requestAnimationFrame = (function() {
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame || function(callback) {
      window.setTimeout(callback, 1000 / 60);
    };
})();

var getTime = function() {
  if (window.performance) {
    if (window.performance.now) {
      return window.performance.now();
    }
  }
  return Date.now();
};

var jsmpeg = module.exports = function(url, opts) {
  opts = opts || {};

  this.url = url;
  this.load();

  this.canvas = opts.canvas || document.createElement('canvas');
  this.ctx = this.canvas.getContext('2d');

  this.autoplay = !!opts.autoplay;
  this.loop = !!opts.loop;

  // this.lateTime = 0;
  this.firstSequenceHeader = 0;
  // this.targetTime = 0;

  this.decoder = new Decoder(this.canvas);
  this.time = 0;
};

inherits(jsmpeg, EventEmitter2);


jsmpeg.prototype.scheduleDecoding = function() {
  this.decoder.decodePicture();
};

jsmpeg.prototype.load = function() {
  this.videoLoader = new VideoLoader(this.url);
  this.videoLoader.once('load', (function() {
    this.loadBuffer(this.videoLoader.getNext());
  }.bind(this)));
  this.videoLoader.load();
};

jsmpeg.prototype.loadBuffer = function(buffer) {
  this.decoder.loadBuffer(buffer);

  // Load the first frame
  this.processFrame();

  if (this.autoplay) {
    this.play();
  }
};

jsmpeg.prototype.play = function() {
  if (this.playing) {
    return;
  }

  this.playing = true;
  this.animate();
};

jsmpeg.prototype.pause = function() {
  this.playing = false;
};

jsmpeg.prototype.stop = function() {
  this.videoLoader.index = 0;
  this.loadBuffer(this.videoLoader.getNext());
  this.playing = false;
};

jsmpeg.prototype.processFrame = function() {
  if (this.decoder.nextFrame()) {
    this.ctx.drawImage(
      this.decoder.canvas,
      0, 0, this.decoder.width, this.decoder.height,
      0, 0, this.canvas.width, this.canvas.height
    );
  } else {
    this.stop();

    var video = this.videoLoader.getNext();
    if (video) {
      this.loadBuffer(video);
      this.play();
    } else {
      if (this.loop && !this.videoLoader.loading) {
        this.videoLoader.index = 0;
        this.loadBuffer(this.videoLoader.getNext());
        this.play();
      } else {
        if (this.videoLoader.loading) {
          this.videoLoader.once('load', (function() {
            var video = this.videoLoader.getNext();
            if (video) {
              this.loadBuffer(video);
              this.play();
            }
          }.bind(this)));
        }
        return;
      }
    }
  }
};

jsmpeg.prototype.animate = function() {
  if (!this.playing) {
    return;
  }

  var now = getTime();
  if (!this.lastTime) {
    this.lastTime = now;
  }
  var interval = 1000 / this.decoder.pictureRate;
  var delta = now - this.lastTime;

  if (delta > interval) {
    this.processFrame();
    this.lastTime = now - (delta % interval);
    this.time += interval;
  }

  requestAnimationFrame(this.animate.bind(this));
};

},{"./BitReader.js":7,"./Decoder.js":9,"./VideoLoader.js":10,"eventemitter2":6,"util":5}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],5:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":4,"_process":3,"inherits":2}],6:[function(require,module,exports){
/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              console.trace();
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) { return false; }
    }

    // Loop through the *_all* functions and invoke them.
    if (this._all) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        this._all[i].apply(this, args);
      }
    }

    // If there is no 'error' event listener then throw.
    if (type === 'error') {

      if (!this._all &&
        !this._events.error &&
        !(this.wildcard && this.listenerTree.error)) {

        if (arguments[1] instanceof Error) {
          throw arguments[1]; // Unhandled 'error' event
        } else {
          throw new Error("Uncaught, unspecified 'error' event.");
        }
        return false;
      }
    }

    var handler;

    if(this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    }
    else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      if (arguments.length === 1) {
        handler.call(this);
      }
      else if (arguments.length > 1)
        switch (arguments.length) {
          case 2:
            handler.call(this, arguments[1]);
            break;
          case 3:
            handler.call(this, arguments[1], arguments[2]);
            break;
          // slower
          default:
            var l = arguments.length;
            var args = new Array(l - 1);
            for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
            handler.apply(this, args);
        }
      return true;
    }
    else if (handler) {
      var l = arguments.length;
      var args = new Array(l - 1);
      for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

      var listeners = handler.slice();
      for (var i = 0, l = listeners.length; i < l; i++) {
        this.event = type;
        listeners[i].apply(this, args);
      }
      return (listeners.length > 0) || !!this._all;
    }
    else {
      return !!this._all;
    }

  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          console.trace();
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }
        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          return this;
        }
      }
    } else {
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define(function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    exports.EventEmitter2 = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

},{}],7:[function(require,module,exports){
var BitReader = module.exports = function(arrayBuffer) {
  this.bytes = new Uint8Array(arrayBuffer);
  this.length = this.bytes.length;
  this.writePos = this.bytes.length;
  this.index = 0;
};

BitReader.NOT_FOUND = -1;

BitReader.prototype.findNextMPEGStartCode = function() {
  for (var i = (this.index + 7 >> 3); i < this.writePos; i++) {
    if (
      this.bytes[i] == 0x00 &&
      this.bytes[i + 1] == 0x00 &&
      this.bytes[i + 2] == 0x01
    ) {
      this.index = (i + 4) << 3;
      return this.bytes[i + 3];
    }
  }
  this.index = (this.writePos << 3);
  return BitReader.NOT_FOUND;
};

BitReader.prototype.nextBytesAreStartCode = function() {
  var i = (this.index + 7 >> 3);
  return (
    i >= this.writePos || (
    this.bytes[i] == 0x00 &&
    this.bytes[i + 1] == 0x00 &&
    this.bytes[i + 2] == 0x01
    )
  );
};

BitReader.prototype.nextBits = function(count) {
  var byteOffset = this.index >> 3;
  var room = (8 - this.index % 8);

  if (room >= count) {
    return (this.bytes[byteOffset] >> (room - count)) & (0xff >> (8 - count));
  }

  var leftover = (this.index + count) % 8;
  var end = (this.index + count - 1) >> 3;
  var value = this.bytes[byteOffset] & (0xff >> (8 - room)); // Fill out first byte

  for (byteOffset++; byteOffset < end; byteOffset++) {
    value <<= 8; // Shift and
    value |= this.bytes[byteOffset]; // Put next byte
  }

  if (leftover > 0) {
    value <<= leftover; // Make room for remaining bits
    value |= (this.bytes[byteOffset] >> (8 - leftover));
  } else {
    value <<= 8;
    value |= this.bytes[byteOffset];
  }

  return value;
};

BitReader.prototype.getBits = function(count) {
  var value = this.nextBits(count);
  this.index += count;
  return value;
};

BitReader.prototype.advance = function(count) {
  return (this.index += count);
};

BitReader.prototype.rewind = function(count) {
  return (this.index -= count);
};

},{}],8:[function(require,module,exports){
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

},{"./utils.js":12}],9:[function(require,module,exports){
var BitReader = require('./BitReader.js');
var WebGLRenderer = require('./WebGLRenderer.js');
var CanvasRenderer = require('./CanvasRenderer.js');
var utils = require('./utils.js');

var Decoder = module.exports = function(options) {
  options = options || {};

  this.canvas = document.createElement('canvas');
  // use WebGL for YCbCrToRGBA conversion if possible (much faster)
  if (!options.forceCanva2D) {
    var webGLRenderer = new WebGLRenderer(this, this.canvas);
    if (webGLRenderer.initGL()) {
      this.renderer = webGLRenderer;
    }
  }
  if (!this.renderer) {
    this.renderer = new CanvasRenderer(this, this.canvas);
  }

  this.customIntraQuantMatrix = new Uint8Array(64);
  this.customNonIntraQuantMatrix = new Uint8Array(64);
  this.blockData = new Int32Array(64);
  this.zeroBlockData = new Int32Array(64);
  utils.fillArray(this.zeroBlockData, 0);

  this.pictureCodingType = 0;
  this.fullPelForward = false;
  this.forwardFCode = 0;
  this.forwardRSize = 0;
  this.forwardF = 0;

  this.quantizerScale = 0;
  this.sliceBegin = false;

  this.macroblockAddress = 0;
  this.mbRow = 0;
  this.mbCol = 0;

  this.macroblockType = 0;
  this.macroblockIntra = false;
  this.macroblockMotFw = false;

  this.motionFwH = 0;
  this.motionFwV = 0;
  this.motionFwHPrev = 0;
  this.motionFwVPrev = 0;

  this.cachedFrameCount = 0;
};

Decoder.prototype.renderFrame = function(Y, Cb, Cr) {
  this.renderer.render(Y, Cb, Cr);
};

Decoder.prototype.nextFrame = function () {
  if (!this.buffer) {
    return false;
  }

  while (true) {
    var code = this.getStartCode();

    if (code == START_SEQUENCE) {
      this.decodeSequenceHeader();
    } else if (code == START_PICTURE) {
      this.decodePicture();
      return true;
    } else if (code == BitReader.NOT_FOUND) {
      return false;
    } else {
      // ignore
    }
  }
};

Decoder.prototype.decodeSequenceHeader = function() {
  this.width = this.buffer.getBits(12);
  this.height = this.buffer.getBits(12);
  this.buffer.advance(4); // skip pixel aspect ratio
  this.pictureRate = PICTURE_RATE[this.buffer.getBits(4)];
  this.buffer.advance(18 + 1 + 10 + 1); // skip bitRate, marker, bufferSize and constrained bit

  // init buffers and renderer
  this.initBuffers();
  this.renderer.init();

  if (this.buffer.getBits(1)) { // load custom intra quant matrix?
    for (var i = 0; i < 64; i++) {
      this.customIntraQuantMatrix[ZIG_ZAG[i]] = this.buffer.getBits(8);
    }
    this.intraQuantMatrix = this.customIntraQuantMatrix;
  }

  if (this.buffer.getBits(1)) { // load custom non intra quant matrix?
    for (var j = 0; i < 64; i++) {
      this.customNonIntraQuantMatrix[ZIG_ZAG[j]] = this.buffer.getBits(8);
    }
    this.nonIntraQuantMatrix = this.customNonIntraQuantMatrix;
  }
};

Decoder.prototype.initBuffers = function() {
  this.intraQuantMatrix = DEFAULT_INTRA_QUANT_MATRIX;
  this.nonIntraQuantMatrix = DEFAULT_NON_INTRA_QUANT_MATRIX;

  this.mbWidth = (this.width + 15) >> 4;
  this.mbHeight = (this.height + 15) >> 4;
  this.mbSize = this.mbWidth * this.mbHeight;

  this.codedWidth = this.mbWidth << 4;
  this.codedHeight = this.mbHeight << 4;
  this.codedSize = this.codedWidth * this.codedHeight;

  this.halfWidth = this.mbWidth << 3;
  this.halfHeight = this.mbHeight << 3;
  this.quarterSize = this.codedSize >> 2;

  // Sequence already started? Don't allocate buffers again
  if (this.sequenceStarted) {
    return;
  }
  this.sequenceStarted = true;

  // Allocated buffers and resize the canvas
  this.Y = new utils.MaybeClampedUint8Array(this.codedSize);
  this.Y32 = new Uint32Array(this.Y.buffer);
  this.Cr = new utils.MaybeClampedUint8Array(this.codedSize >> 2);
  this.Cr32 = new Uint32Array(this.Cr.buffer);
  this.Cb = new utils.MaybeClampedUint8Array(this.codedSize >> 2);
  this.Cb32 = new Uint32Array(this.Cb.buffer);

  this.forwardY = new utils.MaybeClampedUint8Array(this.codedSize);
  this.forwardY32 = new Uint32Array(this.forwardY.buffer);
  this.forwardCr = new utils.MaybeClampedUint8Array(this.codedSize >> 2);
  this.forwardCr32 = new Uint32Array(this.forwardCr.buffer);
  this.forwardCb = new utils.MaybeClampedUint8Array(this.codedSize >> 2);
  this.forwardCb32 = new Uint32Array(this.forwardCb.buffer);

  this.canvas.width = this.width;
  this.canvas.height = this.height;
};

Decoder.prototype.loadBuffer = function(buffer) {
  this.buffer = new BitReader(buffer);

  this.findStartCode(START_SEQUENCE);
  this.firstSequenceHeader = this.buffer.index;
  this.decodeSequenceHeader();
};

Decoder.prototype.getStartCode = function() {
  return this.buffer.findNextMPEGStartCode();
};

Decoder.prototype.decodePicture = function(skipOutput) {
  this.buffer.advance(10); // skip temporalReference
  this.pictureCodingType = this.buffer.getBits(3);
  this.buffer.advance(16); // skip vbv_delay

  // Skip B and D frames or unknown coding type
  if (this.pictureCodingType <= 0 || this.pictureCodingType >= PICTURE_TYPE_B) {
    return;
  }

  // full_pel_forward, forward_f_code
  if (this.pictureCodingType == PICTURE_TYPE_P) {
    this.fullPelForward = this.buffer.getBits(1);
    this.forwardFCode = this.buffer.getBits(3);
    if (this.forwardFCode == 0) {
      // Ignore picture with zero forward_f_code
      return;
    }
    this.forwardRSize = this.forwardFCode - 1;
    this.forwardF = 1 << this.forwardRSize;
  }

  var code = 0;
  do {
    code = this.buffer.findNextMPEGStartCode();
  } while (code == START_EXTENSION || code == START_USER_DATA);


  while (code >= START_SLICE_FIRST && code <= START_SLICE_LAST) {
    this.decodeSlice((code & 0x000000FF));
    code = this.buffer.findNextMPEGStartCode();
  }

  // We found the next start code; rewind 32bits and let the main loop handle it.
  this.buffer.rewind(32);

  if (skipOutput != DECODE_SKIP_OUTPUT) {
    this.renderFrame(this.Y, this.Cb, this.Cr);

    if (this.externalDecodeCallback) {
      this.externalDecodeCallback(this, this.canvas);
    }
  }

  // If this is a reference picutre then rotate the prediction pointers
  if (this.pictureCodingType == PICTURE_TYPE_I || this.pictureCodingType == PICTURE_TYPE_P) {
    var tmpY = this.forwardY;
    var tmpY32 = this.forwardY32;
    var tmpCr = this.forwardCr;
    var tmpCr32 = this.forwardCr32;
    var tmpCb = this.forwardCb;
    var tmpCb32 = this.forwardCb32;

    this.forwardY = this.Y;
    this.forwardY32 = this.Y32;
    this.forwardCr = this.Cr;
    this.forwardCr32 = this.Cr32;
    this.forwardCb = this.Cb;
    this.forwardCb32 = this.Cb32;

    this.Y = tmpY;
    this.Y32 = tmpY32;
    this.Cr = tmpCr;
    this.Cr32 = tmpCr32;
    this.Cb = tmpCb;
    this.Cb32 = tmpCb32;
  }
};

Decoder.prototype.decodeSlice = function(slice) {
  this.sliceBegin = true;
  this.macroblockAddress = (slice - 1) * this.mbWidth - 1;

  // Reset motion vectors and DC predictors
  this.motionFwH = this.motionFwHPrev = 0;
  this.motionFwV = this.motionFwVPrev = 0;
  this.dcPredictorY = 128;
  this.dcPredictorCr = 128;
  this.dcPredictorCb = 128;

  this.quantizerScale = this.buffer.getBits(5);

  // skip extra bits
  while (this.buffer.getBits(1)) {
    this.buffer.advance(8);
  }

  do {
    this.decodeMacroblock();
    // We may have to ignore Video Stream Start Codes here (0xE0)!?
  } while (!this.buffer.nextBytesAreStartCode());
};

Decoder.prototype.decodeMacroblock = function() {
  // Decode macroblock_address_increment
  var increment = 0;
  var t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);

  while (t == 34) {
    // macroblock_stuffing
    t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);
  }
  while (t == 35) {
    // macroblock_escape
    increment += 33;
    t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);
  }
  increment += t;

  // Process any skipped macroblocks
  if (this.sliceBegin) {
    // The first macroblock_address_increment of each slice is relative
    // to beginning of the preverious row, not the preverious macroblock
    this.sliceBegin = false;
    this.macroblockAddress += increment;
  } else {
    if (this.macroblockAddress + increment >= this.mbSize) {
      // Illegal (too large) macroblock_address_increment
      return;
    }
    if (increment > 1) {
      // Skipped macroblocks reset DC predictors
      this.dcPredictorY = 128;
      this.dcPredictorCr = 128;
      this.dcPredictorCb = 128;

      // Skipped macroblocks in P-pictures reset motion vectors
      if (this.pictureCodingType == PICTURE_TYPE_P) {
        this.motionFwH = this.motionFwHPrev = 0;
        this.motionFwV = this.motionFwVPrev = 0;
      }
    }

    // Predict skipped macroblocks
    while (increment > 1) {
      this.macroblockAddress++;
      this.mbRow = (this.macroblockAddress / this.mbWidth) | 0;
      this.mbCol = this.macroblockAddress % this.mbWidth;
      this.copyMacroblock(this.motionFwH, this.motionFwV, this.forwardY, this.forwardCr, this.forwardCb);
      increment--;
    }
    this.macroblockAddress++;
  }
  this.mbRow = (this.macroblockAddress / this.mbWidth) | 0;
  this.mbCol = this.macroblockAddress % this.mbWidth;

  // Process the current macroblock
  this.macroblockType = this.readCode(MACROBLOCK_TYPE_TABLES[this.pictureCodingType]);
  this.macroblockIntra = (this.macroblockType & 0x01);
  this.macroblockMotFw = (this.macroblockType & 0x08);

  // Quantizer scale
  if ((this.macroblockType & 0x10) != 0) {
    this.quantizerScale = this.buffer.getBits(5);
  }

  if (this.macroblockIntra) {
    // Intra-coded macroblocks reset motion vectors
    this.motionFwH = this.motionFwHPrev = 0;
    this.motionFwV = this.motionFwVPrev = 0;
  } else {
    // Non-intra macroblocks reset DC predictors
    this.dcPredictorY = 128;
    this.dcPredictorCr = 128;
    this.dcPredictorCb = 128;

    this.decodeMotionVectors();
    this.copyMacroblock(this.motionFwH, this.motionFwV, this.forwardY, this.forwardCr, this.forwardCb);
  }

  // Decode blocks
  var cbp = ((this.macroblockType & 0x02) != 0)
    ? this.readCode(CODE_BLOCK_PATTERN)
    : (this.macroblockIntra ? 0x3f : 0);

  for (var block = 0, mask = 0x20; block < 6; block++) {
    if ((cbp & mask) != 0) {
      this.decodeBlock(block);
    }
    mask >>= 1;
  }
};


Decoder.prototype.decodeMotionVectors = function() {
  var code;
  var d;
  var r = 0;

  // Forward
  if (this.macroblockMotFw) {
    // Horizontal forward
    code = this.readCode(MOTION);
    if ((code != 0) && (this.forwardF != 1)) {
      r = this.buffer.getBits(this.forwardRSize);
      d = ((Math.abs(code) - 1) << this.forwardRSize) + r + 1;
      if (code < 0) {
        d = -d;
      }
    } else {
      d = code;
    }

    this.motionFwHPrev += d;
    if (this.motionFwHPrev > (this.forwardF << 4) - 1) {
      this.motionFwHPrev -= this.forwardF << 5;
    } else if (this.motionFwHPrev < ((-this.forwardF) << 4)) {
      this.motionFwHPrev += this.forwardF << 5;
    }

    this.motionFwH = this.motionFwHPrev;
    if (this.fullPelForward) {
      this.motionFwH <<= 1;
    }

    // Vertical forward
    code = this.readCode(MOTION);
    if ((code != 0) && (this.forwardF != 1)) {
      r = this.buffer.getBits(this.forwardRSize);
      d = ((Math.abs(code) - 1) << this.forwardRSize) + r + 1;
      if (code < 0) {
        d = -d;
      }
    } else {
      d = code;
    }

    this.motionFwVPrev += d;
    if (this.motionFwVPrev > (this.forwardF << 4) - 1) {
      this.motionFwVPrev -= this.forwardF << 5;
    } else if (this.motionFwVPrev < ((-this.forwardF) << 4)) {
      this.motionFwVPrev += this.forwardF << 5;
    }

    this.motionFwV = this.motionFwVPrev;
    if (this.fullPelForward) {
      this.motionFwV <<= 1;
    }
  } else if (this.pictureCodingType == PICTURE_TYPE_P) {
    // No motion information in P-picture, reset vectors
    this.motionFwH = this.motionFwHPrev = 0;
    this.motionFwV = this.motionFwVPrev = 0;
  }
};

Decoder.prototype.copyMacroblock = function(motionH, motionV, sY, sCr, sCb) {
  var width;
  var scan;
  var H;
  var V;
  var oddH;
  var oddV;
  var src;
  var dest;
  var last;

  // We use 32bit writes here
  var dY = this.Y32;
  var dCb = this.Cb32;
  var dCr = this.Cr32;

  // Luminance
  width = this.codedWidth;
  scan = width - 16;

  H = motionH >> 1;
  V = motionV >> 1;
  oddH = (motionH & 1) == 1;
  oddV = (motionV & 1) == 1;

  src = ((this.mbRow << 4) + V) * width + (this.mbCol << 4) + H;
  dest = (this.mbRow * width + this.mbCol) << 2;
  last = dest + (width << 2);

  var y1;
  var y2;
  var y;
  if (oddH) {
    if (oddV) {
      while (dest < last) {
        y1 = sY[src] + sY[src + width]; src++;
        for (var x = 0; x < 4; x++) {
          y2 = sY[src] + sY[src + width]; src++;
          y = (((y1 + y2 + 2) >> 2) & 0xff);

          y1 = sY[src] + sY[src + width]; src++;
          y |= (((y1 + y2 + 2) << 6) & 0xff00);

          y2 = sY[src] + sY[src + width]; src++;
          y |= (((y1 + y2 + 2) << 14) & 0xff0000);

          y1 = sY[src] + sY[src + width]; src++;
          y |= (((y1 + y2 + 2) << 22) & 0xff000000);

          dY[dest++] = y;
        }
        dest += scan >> 2;
        src += scan - 1;
      }
    } else {
      while (dest < last) {
        y1 = sY[src++];
        for (var x = 0; x < 4; x++) {
          y2 = sY[src++];
          y = (((y1 + y2 + 1) >> 1) & 0xff);

          y1 = sY[src++];
          y |= (((y1 + y2 + 1) << 7) & 0xff00);

          y2 = sY[src++];
          y |= (((y1 + y2 + 1) << 15) & 0xff0000);

          y1 = sY[src++];
          y |= (((y1 + y2 + 1) << 23) & 0xff000000);

          dY[dest++] = y;
        }
        dest += scan >> 2;
        src += scan - 1;
      }
    }
  } else {
    if (oddV) {
      while (dest < last) {
        for (var x = 0; x < 4; x++) {
          y = (((sY[src] + sY[src + width] + 1) >> 1) & 0xff); src++;
          y |= (((sY[src] + sY[src + width] + 1) << 7) & 0xff00); src++;
          y |= (((sY[src] + sY[src + width] + 1) << 15) & 0xff0000); src++;
          y |= (((sY[src] + sY[src + width] + 1) << 23) & 0xff000000); src++;

          dY[dest++] = y;
        }
        dest += scan >> 2;
        src += scan;
      }
    } else {
      while (dest < last) {
        for (var x = 0; x < 4; x++) {
          y = sY[src]; src++;
          y |= sY[src] << 8; src++;
          y |= sY[src] << 16; src++;
          y |= sY[src] << 24; src++;

          dY[dest++] = y;
        }
        dest += scan >> 2;
        src += scan;
      }
    }
  }

  // Chrominance

  width = this.halfWidth;
  scan = width - 8;

  H = (motionH / 2) >> 1;
  V = (motionV / 2) >> 1;
  oddH = ((motionH / 2) & 1) == 1;
  oddV = ((motionV / 2) & 1) == 1;

  src = ((this.mbRow << 3) + V) * width + (this.mbCol << 3) + H;
  dest = (this.mbRow * width + this.mbCol) << 1;
  last = dest + (width << 1);

  var cr1;
  var cr2;
  var cr;
  var cb1;
  var cb2;
  var cb;
  if (oddH) {
    if (oddV) {
      while (dest < last) {
        cr1 = sCr[src] + sCr[src + width];
        cb1 = sCb[src] + sCb[src + width];
        src++;
        for (var x = 0; x < 2; x++) {
          cr2 = sCr[src] + sCr[src + width];
          cb2 = sCb[src] + sCb[src + width]; src++;
          cr = (((cr1 + cr2 + 2) >> 2) & 0xff);
          cb = (((cb1 + cb2 + 2) >> 2) & 0xff);

          cr1 = sCr[src] + sCr[src + width];
          cb1 = sCb[src] + sCb[src + width]; src++;
          cr |= (((cr1 + cr2 + 2) << 6) & 0xff00);
          cb |= (((cb1 + cb2 + 2) << 6) & 0xff00);

          cr2 = sCr[src] + sCr[src + width];
          cb2 = sCb[src] + sCb[src + width]; src++;
          cr |= (((cr1 + cr2 + 2) << 14) & 0xff0000);
          cb |= (((cb1 + cb2 + 2) << 14) & 0xff0000);

          cr1 = sCr[src] + sCr[src + width];
          cb1 = sCb[src] + sCb[src + width]; src++;
          cr |= (((cr1 + cr2 + 2) << 22) & 0xff000000);
          cb |= (((cb1 + cb2 + 2) << 22) & 0xff000000);

          dCr[dest] = cr;
          dCb[dest] = cb;
          dest++;
        }
        dest += scan >> 2;
        src += scan - 1;
      }
    } else {
      while (dest < last) {
        cr1 = sCr[src];
        cb1 = sCb[src];
        src++;
        for (var x = 0; x < 2; x++) {
          cr2 = sCr[src];
          cb2 = sCb[src++];
          cr = (((cr1 + cr2 + 1) >> 1) & 0xff);
          cb = (((cb1 + cb2 + 1) >> 1) & 0xff);

          cr1 = sCr[src];
          cb1 = sCb[src++];
          cr |= (((cr1 + cr2 + 1) << 7) & 0xff00);
          cb |= (((cb1 + cb2 + 1) << 7) & 0xff00);

          cr2 = sCr[src];
          cb2 = sCb[src++];
          cr |= (((cr1 + cr2 + 1) << 15) & 0xff0000);
          cb |= (((cb1 + cb2 + 1) << 15) & 0xff0000);

          cr1 = sCr[src];
          cb1 = sCb[src++];
          cr |= (((cr1 + cr2 + 1) << 23) & 0xff000000);
          cb |= (((cb1 + cb2 + 1) << 23) & 0xff000000);

          dCr[dest] = cr;
          dCb[dest] = cb;
          dest++;
        }
        dest += scan >> 2;
        src += scan - 1;
      }
    }
  } else {
    if (oddV) {
      while (dest < last) {
        for (var x = 0; x < 2; x++) {
          cr = (((sCr[src] + sCr[src + width] + 1) >> 1) & 0xff);
          cb = (((sCb[src] + sCb[src + width] + 1) >> 1) & 0xff); src++;

          cr |= (((sCr[src] + sCr[src + width] + 1) << 7) & 0xff00);
          cb |= (((sCb[src] + sCb[src + width] + 1) << 7) & 0xff00); src++;

          cr |= (((sCr[src] + sCr[src + width] + 1) << 15) & 0xff0000);
          cb |= (((sCb[src] + sCb[src + width] + 1) << 15) & 0xff0000); src++;

          cr |= (((sCr[src] + sCr[src + width] + 1) << 23) & 0xff000000);
          cb |= (((sCb[src] + sCb[src + width] + 1) << 23) & 0xff000000); src++;

          dCr[dest] = cr;
          dCb[dest] = cb;
          dest++;
        }
        dest += scan >> 2;
        src += scan;
      }
    } else {
      while (dest < last) {
        for (var x = 0; x < 2; x++) {
          cr = sCr[src];
          cb = sCb[src]; src++;

          cr |= sCr[src] << 8;
          cb |= sCb[src] << 8; src++;

          cr |= sCr[src] << 16;
          cb |= sCb[src] << 16; src++;

          cr |= sCr[src] << 24;
          cb |= sCb[src] << 24; src++;

          dCr[dest] = cr;
          dCb[dest] = cb;
          dest++;
        }
        dest += scan >> 2;
        src += scan;
      }
    }
  }
};

Decoder.prototype.decodeBlock = function(block) {
  var n = 0;
  var quantMatrix;

  // Decode DC coefficient of intra-coded blocks
  if (this.macroblockIntra) {
    var predictor;
    var dctSize;

    // DC prediction

    if (block < 4) {
      predictor = this.dcPredictorY;
      dctSize = this.readCode(DCT_DC_SIZE_LUMINANCE);
    } else {
      predictor = (block == 4 ? this.dcPredictorCr : this.dcPredictorCb);
      dctSize = this.readCode(DCT_DC_SIZE_CHROMINANCE);
    }

    // Read DC coeff
    if (dctSize > 0) {
      var differential = this.buffer.getBits(dctSize);
      if ((differential & (1 << (dctSize - 1))) != 0) {
        this.blockData[0] = predictor + differential;
      } else {
        this.blockData[0] = predictor + ((-1 << dctSize) | (differential + 1));
      }
    } else {
      this.blockData[0] = predictor;
    }

    // Save predictor value
    if (block < 4) {
      this.dcPredictorY = this.blockData[0];
    } else if (block == 4) {
      this.dcPredictorCr = this.blockData[0];
    } else {
      this.dcPredictorCb = this.blockData[0];
    }

    // Dequantize + premultiply
    this.blockData[0] <<= (3 + 5);

    quantMatrix = this.intraQuantMatrix;
    n = 1;
  } else {
    quantMatrix = this.nonIntraQuantMatrix;
  }

  // Decode AC coefficients (+DC for non-intra)
  var level = 0;
  while (true) {
    var run = 0;
    var coeff = this.readCode(DCT_COEFF);

    if ((coeff == 0x0001) && (n > 0) && (this.buffer.getBits(1) == 0)) {
      // end_of_block
      break;
    }
    if (coeff == 0xffff) {
      // escape
      run = this.buffer.getBits(6);
      level = this.buffer.getBits(8);
      if (level == 0) {
        level = this.buffer.getBits(8);
      } else if (level == 128) {
        level = this.buffer.getBits(8) - 256;
      } else if (level > 128) {
        level = level - 256;
      }
    } else {
      run = coeff >> 8;
      level = coeff & 0xff;
      if (this.buffer.getBits(1)) {
        level = -level;
      }
    }

    n += run;
    var dezigZagged = ZIG_ZAG[n];
    n++;

    // Dequantize, oddify, clip
    level <<= 1;
    if (!this.macroblockIntra) {
      level += (level < 0 ? -1 : 1);
    }
    level = (level * this.quantizerScale * quantMatrix[dezigZagged]) >> 4;
    if ((level & 1) == 0) {
      level -= level > 0 ? 1 : -1;
    }
    if (level > 2047) {
      level = 2047;
    } else if (level < -2048) {
      level = -2048;
    }

    // Save premultiplied coefficient
    this.blockData[dezigZagged] = level * PREMULTIPLIER_MATRIX[dezigZagged];
  }
  ;

  // Move block to its place
  var destArray;
  var destIndex;
  var scan;

  if (block < 4) {
    destArray = this.Y;
    scan = this.codedWidth - 8;
    destIndex = (this.mbRow * this.codedWidth + this.mbCol) << 4;
    if ((block & 1) != 0) {
      destIndex += 8;
    }
    if ((block & 2) != 0) {
      destIndex += this.codedWidth << 3;
    }
  } else {
    destArray = (block == 4) ? this.Cb : this.Cr;
    scan = (this.codedWidth >> 1) - 8;
    destIndex = ((this.mbRow * this.codedWidth) << 2) + (this.mbCol << 3);
  }

  if (this.macroblockIntra) {
    // Overwrite (no prediction)
    if (n == 1) {
      utils.copyValueToDestination((this.blockData[0] + 128) >> 8, destArray, destIndex, scan);
      this.blockData[0] = 0;
    } else {
      this.IDCT();
      utils.copyBlockToDestination(this.blockData, destArray, destIndex, scan);
      this.blockData.set(this.zeroBlockData);
    }
  } else {
    // Add data to the predicted macroblock
    if (n == 1) {
      utils.addValueToDestination((this.blockData[0] + 128) >> 8, destArray, destIndex, scan);
      this.blockData[0] = 0;
    } else {
      this.IDCT();
      utils.addBlockToDestination(this.blockData, destArray, destIndex, scan);
      this.blockData.set(this.zeroBlockData);
    }
  }

  n = 0;
};

Decoder.prototype.IDCT = function() {
  // See http://vsr.informatik.tu-chemnitz.de/~jan/MPEG/HTML/IDCT.html
  // for more info.

  var b1;
  var b3;
  var b4;
  var b6;
  var b7;
  var tmp1;
  var tmp2;
  var m0;
  var x0;
  var x1;
  var x2;
  var x3;
  var x4;
  var y3;
  var y4;
  var y5;
  var y6;
  var y7;
  var i;
  var blockData = this.blockData;

  // Transform columns
  for (i = 0; i < 8; ++i) {
    b1 = blockData[4 * 8 + i];
    b3 = blockData[2 * 8 + i] + blockData[6 * 8 + i];
    b4 = blockData[5 * 8 + i] - blockData[3 * 8 + i];
    tmp1 = blockData[1 * 8 + i] + blockData[7 * 8 + i];
    tmp2 = blockData[3 * 8 + i] + blockData[5 * 8 + i];
    b6 = blockData[1 * 8 + i] - blockData[7 * 8 + i];
    b7 = tmp1 + tmp2;
    m0 = blockData[0 * 8 + i];
    x4 = ((b6 * 473 - b4 * 196 + 128) >> 8) - b7;
    x0 = x4 - (((tmp1 - tmp2) * 362 + 128) >> 8);
    x1 = m0 - b1;
    x2 = (((blockData[2 * 8 + i] - blockData[6 * 8 + i]) * 362 + 128) >> 8) - b3;
    x3 = m0 + b1;
    y3 = x1 + x2;
    y4 = x3 + b3;
    y5 = x1 - x2;
    y6 = x3 - b3;
    y7 = -x0 - ((b4 * 473 + b6 * 196 + 128) >> 8);
    blockData[0 * 8 + i] = b7 + y4;
    blockData[1 * 8 + i] = x4 + y3;
    blockData[2 * 8 + i] = y5 - x0;
    blockData[3 * 8 + i] = y6 - y7;
    blockData[4 * 8 + i] = y6 + y7;
    blockData[5 * 8 + i] = x0 + y5;
    blockData[6 * 8 + i] = y3 - x4;
    blockData[7 * 8 + i] = y4 - b7;
  }

  // Transform rows
  for (i = 0; i < 64; i += 8) {
    b1 = blockData[4 + i];
    b3 = blockData[2 + i] + blockData[6 + i];
    b4 = blockData[5 + i] - blockData[3 + i];
    tmp1 = blockData[1 + i] + blockData[7 + i];
    tmp2 = blockData[3 + i] + blockData[5 + i];
    b6 = blockData[1 + i] - blockData[7 + i];
    b7 = tmp1 + tmp2;
    m0 = blockData[0 + i];
    x4 = ((b6 * 473 - b4 * 196 + 128) >> 8) - b7;
    x0 = x4 - (((tmp1 - tmp2) * 362 + 128) >> 8);
    x1 = m0 - b1;
    x2 = (((blockData[2 + i] - blockData[6 + i]) * 362 + 128) >> 8) - b3;
    x3 = m0 + b1;
    y3 = x1 + x2;
    y4 = x3 + b3;
    y5 = x1 - x2;
    y6 = x3 - b3;
    y7 = -x0 - ((b4 * 473 + b6 * 196 + 128) >> 8);
    blockData[0 + i] = (b7 + y4 + 128) >> 8;
    blockData[1 + i] = (x4 + y3 + 128) >> 8;
    blockData[2 + i] = (y5 - x0 + 128) >> 8;
    blockData[3 + i] = (y6 - y7 + 128) >> 8;
    blockData[4 + i] = (y6 + y7 + 128) >> 8;
    blockData[5 + i] = (x0 + y5 + 128) >> 8;
    blockData[6 + i] = (y3 - x4 + 128) >> 8;
    blockData[7 + i] = (y4 - b7 + 128) >> 8;
  }
};

Decoder.prototype.readCode = function(codeTable) {
  var state = 0;
  do {
    state = codeTable[state + this.buffer.getBits(1)];
  } while (state >= 0 && codeTable[state] != 0);
  return codeTable[state + 2];
};

Decoder.prototype.findStartCode = function(code) {
  var current = 0;
  while (true) {
    current = this.buffer.findNextMPEGStartCode();
    if (current == code || current == BitReader.NOT_FOUND) {
      return current;
    }
  }
  return BitReader.NOT_FOUND;
};


var PICTURE_RATE = [
    0.000, 23.976, 24.000, 25.000, 29.970, 30.000, 50.000, 59.940,
    60.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000
];

var ZIG_ZAG = new Uint8Array([
    0, 1, 8, 16, 9, 2, 3, 10,
    17, 24, 32, 25, 18, 11, 4, 5,
    12, 19, 26, 33, 40, 48, 41, 34,
    27, 20, 13, 6, 7, 14, 21, 28,
    35, 42, 49, 56, 57, 50, 43, 36,
    29, 22, 15, 23, 30, 37, 44, 51,
    58, 59, 52, 45, 38, 31, 39, 46,
    53, 60, 61, 54, 47, 55, 62, 63
]);

var DEFAULT_INTRA_QUANT_MATRIX = new Uint8Array([
    8, 16, 19, 22, 26, 27, 29, 34,
    16, 16, 22, 24, 27, 29, 34, 37,
    19, 22, 26, 27, 29, 34, 34, 38,
    22, 22, 26, 27, 29, 34, 37, 40,
    22, 26, 27, 29, 32, 35, 40, 48,
    26, 27, 29, 32, 35, 40, 48, 58,
    26, 27, 29, 34, 38, 46, 56, 69,
    27, 29, 35, 38, 46, 56, 69, 83
]);

var DEFAULT_NON_INTRA_QUANT_MATRIX = new Uint8Array([
    16, 16, 16, 16, 16, 16, 16, 16,
    16, 16, 16, 16, 16, 16, 16, 16,
    16, 16, 16, 16, 16, 16, 16, 16,
    16, 16, 16, 16, 16, 16, 16, 16,
    16, 16, 16, 16, 16, 16, 16, 16,
    16, 16, 16, 16, 16, 16, 16, 16,
    16, 16, 16, 16, 16, 16, 16, 16,
    16, 16, 16, 16, 16, 16, 16, 16
]);

var PREMULTIPLIER_MATRIX = new Uint8Array([
    32, 44, 42, 38, 32, 25, 17, 9,
    44, 62, 58, 52, 44, 35, 24, 12,
    42, 58, 55, 49, 42, 33, 23, 12,
    38, 52, 49, 44, 38, 30, 20, 10,
    32, 44, 42, 38, 32, 25, 17, 9,
    25, 35, 33, 30, 25, 20, 14, 7,
    17, 24, 23, 20, 17, 14, 9, 5,
    9, 12, 12, 10, 9, 7, 5, 2
]);

var MACROBLOCK_ADDRESS_INCREMENT = new Int16Array([
    1 * 3, 2 * 3, 0, //   0
    3 * 3, 4 * 3, 0, //   1  0
    0, 0, 1, //   2  1.
    5 * 3, 6 * 3, 0, //   3  00
    7 * 3, 8 * 3, 0, //   4  01
    9 * 3, 10 * 3, 0, //   5  000
    11 * 3, 12 * 3, 0, //   6  001
    0, 0, 3, //   7  010.
    0, 0, 2, //   8  011.
    13 * 3, 14 * 3, 0, //   9  0000
    15 * 3, 16 * 3, 0, //  10  0001
    0, 0, 5, //  11  0010.
    0, 0, 4, //  12  0011.
    17 * 3, 18 * 3, 0, //  13  0000 0
    19 * 3, 20 * 3, 0, //  14  0000 1
    0, 0, 7, //  15  0001 0.
    0, 0, 6, //  16  0001 1.
    21 * 3, 22 * 3, 0, //  17  0000 00
    23 * 3, 24 * 3, 0, //  18  0000 01
    25 * 3, 26 * 3, 0, //  19  0000 10
    27 * 3, 28 * 3, 0, //  20  0000 11
    -1, 29 * 3, 0, //  21  0000 000
    -1, 30 * 3, 0, //  22  0000 001
    31 * 3, 32 * 3, 0, //  23  0000 010
    33 * 3, 34 * 3, 0, //  24  0000 011
    35 * 3, 36 * 3, 0, //  25  0000 100
    37 * 3, 38 * 3, 0, //  26  0000 101
    0, 0, 9, //  27  0000 110.
    0, 0, 8, //  28  0000 111.
    39 * 3, 40 * 3, 0, //  29  0000 0001
    41 * 3, 42 * 3, 0, //  30  0000 0011
    43 * 3, 44 * 3, 0, //  31  0000 0100
    45 * 3, 46 * 3, 0, //  32  0000 0101
    0, 0, 15, //  33  0000 0110.
    0, 0, 14, //  34  0000 0111.
    0, 0, 13, //  35  0000 1000.
    0, 0, 12, //  36  0000 1001.
    0, 0, 11, //  37  0000 1010.
    0, 0, 10, //  38  0000 1011.
    47 * 3, -1, 0, //  39  0000 0001 0
    -1, 48 * 3, 0, //  40  0000 0001 1
    49 * 3, 50 * 3, 0, //  41  0000 0011 0
    51 * 3, 52 * 3, 0, //  42  0000 0011 1
    53 * 3, 54 * 3, 0, //  43  0000 0100 0
    55 * 3, 56 * 3, 0, //  44  0000 0100 1
    57 * 3, 58 * 3, 0, //  45  0000 0101 0
    59 * 3, 60 * 3, 0, //  46  0000 0101 1
    61 * 3, -1, 0, //  47  0000 0001 00
    -1, 62 * 3, 0, //  48  0000 0001 11
    63 * 3, 64 * 3, 0, //  49  0000 0011 00
    65 * 3, 66 * 3, 0, //  50  0000 0011 01
    67 * 3, 68 * 3, 0, //  51  0000 0011 10
    69 * 3, 70 * 3, 0, //  52  0000 0011 11
    71 * 3, 72 * 3, 0, //  53  0000 0100 00
    73 * 3, 74 * 3, 0, //  54  0000 0100 01
    0, 0, 21, //  55  0000 0100 10.
    0, 0, 20, //  56  0000 0100 11.
    0, 0, 19, //  57  0000 0101 00.
    0, 0, 18, //  58  0000 0101 01.
    0, 0, 17, //  59  0000 0101 10.
    0, 0, 16, //  60  0000 0101 11.
    0, 0, 35, //  61  0000 0001 000. -- macroblock_escape
    0, 0, 34, //  62  0000 0001 111. -- macroblock_stuffing
    0, 0, 33, //  63  0000 0011 000.
    0, 0, 32, //  64  0000 0011 001.
    0, 0, 31, //  65  0000 0011 010.
    0, 0, 30, //  66  0000 0011 011.
    0, 0, 29, //  67  0000 0011 100.
    0, 0, 28, //  68  0000 0011 101.
    0, 0, 27, //  69  0000 0011 110.
    0, 0, 26, //  70  0000 0011 111.
    0, 0, 25, //  71  0000 0100 000.
    0, 0, 24, //  72  0000 0100 001.
    0, 0, 23, //  73  0000 0100 010.
    0, 0, 22 //  74  0000 0100 011.
]);

var MACROBLOCK_TYPE_I = new Int8Array([
    1 * 3, 2 * 3, 0, //   0
    -1, 3 * 3, 0, //   1  0
    0, 0, 0x01, //   2  1.
    0, 0, 0x11 //   3  01.
]);

var MACROBLOCK_TYPE_P = new Int8Array([
    1 * 3, 2 * 3, 0, //  0
    3 * 3, 4 * 3, 0, //  1  0
    0, 0, 0x0a, //  2  1.
    5 * 3, 6 * 3, 0, //  3  00
    0, 0, 0x02, //  4  01.
    7 * 3, 8 * 3, 0, //  5  000
    0, 0, 0x08, //  6  001.
    9 * 3, 10 * 3, 0, //  7  0000
    11 * 3, 12 * 3, 0, //  8  0001
    -1, 13 * 3, 0, //  9  00000
    0, 0, 0x12, // 10  00001.
    0, 0, 0x1a, // 11  00010.
    0, 0, 0x01, // 12  00011.
    0, 0, 0x11 // 13  000001.
]);

var MACROBLOCK_TYPE_B = new Int8Array([
    1 * 3, 2 * 3, 0, //  0
    3 * 3, 5 * 3, 0, //  1  0
    4 * 3, 6 * 3, 0, //  2  1
    8 * 3, 7 * 3, 0, //  3  00
    0, 0, 0x0c, //  4  10.
    9 * 3, 10 * 3, 0, //  5  01
    0, 0, 0x0e, //  6  11.
    13 * 3, 14 * 3, 0, //  7  001
    12 * 3, 11 * 3, 0, //  8  000
    0, 0, 0x04, //  9  010.
    0, 0, 0x06, // 10  011.
    18 * 3, 16 * 3, 0, // 11  0001
    15 * 3, 17 * 3, 0, // 12  0000
    0, 0, 0x08, // 13  0010.
    0, 0, 0x0a, // 14  0011.
    -1, 19 * 3, 0, // 15  00000
    0, 0, 0x01, // 16  00011.
    20 * 3, 21 * 3, 0, // 17  00001
    0, 0, 0x1e, // 18  00010.
    0, 0, 0x11, // 19  000001.
    0, 0, 0x16, // 20  000010.
    0, 0, 0x1a // 21  000011.
]);

var CODE_BLOCK_PATTERN = new Int16Array([
    2 * 3, 1 * 3, 0, //   0
    3 * 3, 6 * 3, 0, //   1  1
    4 * 3, 5 * 3, 0, //   2  0
    8 * 3, 11 * 3, 0, //   3  10
    12 * 3, 13 * 3, 0, //   4  00
    9 * 3, 7 * 3, 0, //   5  01
    10 * 3, 14 * 3, 0, //   6  11
    20 * 3, 19 * 3, 0, //   7  011
    18 * 3, 16 * 3, 0, //   8  100
    23 * 3, 17 * 3, 0, //   9  010
    27 * 3, 25 * 3, 0, //  10  110
    21 * 3, 28 * 3, 0, //  11  101
    15 * 3, 22 * 3, 0, //  12  000
    24 * 3, 26 * 3, 0, //  13  001
    0, 0, 60, //  14  111.
    35 * 3, 40 * 3, 0, //  15  0000
    44 * 3, 48 * 3, 0, //  16  1001
    38 * 3, 36 * 3, 0, //  17  0101
    42 * 3, 47 * 3, 0, //  18  1000
    29 * 3, 31 * 3, 0, //  19  0111
    39 * 3, 32 * 3, 0, //  20  0110
    0, 0, 32, //  21  1010.
    45 * 3, 46 * 3, 0, //  22  0001
    33 * 3, 41 * 3, 0, //  23  0100
    43 * 3, 34 * 3, 0, //  24  0010
    0, 0, 4, //  25  1101.
    30 * 3, 37 * 3, 0, //  26  0011
    0, 0, 8, //  27  1100.
    0, 0, 16, //  28  1011.
    0, 0, 44, //  29  0111 0.
    50 * 3, 56 * 3, 0, //  30  0011 0
    0, 0, 28, //  31  0111 1.
    0, 0, 52, //  32  0110 1.
    0, 0, 62, //  33  0100 0.
    61 * 3, 59 * 3, 0, //  34  0010 1
    52 * 3, 60 * 3, 0, //  35  0000 0
    0, 0, 1, //  36  0101 1.
    55 * 3, 54 * 3, 0, //  37  0011 1
    0, 0, 61, //  38  0101 0.
    0, 0, 56, //  39  0110 0.
    57 * 3, 58 * 3, 0, //  40  0000 1
    0, 0, 2, //  41  0100 1.
    0, 0, 40, //  42  1000 0.
    51 * 3, 62 * 3, 0, //  43  0010 0
    0, 0, 48, //  44  1001 0.
    64 * 3, 63 * 3, 0, //  45  0001 0
    49 * 3, 53 * 3, 0, //  46  0001 1
    0, 0, 20, //  47  1000 1.
    0, 0, 12, //  48  1001 1.
    80 * 3, 83 * 3, 0, //  49  0001 10
    0, 0, 63, //  50  0011 00.
    77 * 3, 75 * 3, 0, //  51  0010 00
    65 * 3, 73 * 3, 0, //  52  0000 00
    84 * 3, 66 * 3, 0, //  53  0001 11
    0, 0, 24, //  54  0011 11.
    0, 0, 36, //  55  0011 10.
    0, 0, 3, //  56  0011 01.
    69 * 3, 87 * 3, 0, //  57  0000 10
    81 * 3, 79 * 3, 0, //  58  0000 11
    68 * 3, 71 * 3, 0, //  59  0010 11
    70 * 3, 78 * 3, 0, //  60  0000 01
    67 * 3, 76 * 3, 0, //  61  0010 10
    72 * 3, 74 * 3, 0, //  62  0010 01
    86 * 3, 85 * 3, 0, //  63  0001 01
    88 * 3, 82 * 3, 0, //  64  0001 00
    -1, 94 * 3, 0, //  65  0000 000
    95 * 3, 97 * 3, 0, //  66  0001 111
    0, 0, 33, //  67  0010 100.
    0, 0, 9, //  68  0010 110.
    106 * 3, 110 * 3, 0, //  69  0000 100
    102 * 3, 116 * 3, 0, //  70  0000 010
    0, 0, 5, //  71  0010 111.
    0, 0, 10, //  72  0010 010.
    93 * 3, 89 * 3, 0, //  73  0000 001
    0, 0, 6, //  74  0010 011.
    0, 0, 18, //  75  0010 001.
    0, 0, 17, //  76  0010 101.
    0, 0, 34, //  77  0010 000.
    113 * 3, 119 * 3, 0, //  78  0000 011
    103 * 3, 104 * 3, 0, //  79  0000 111
    90 * 3, 92 * 3, 0, //  80  0001 100
    109 * 3, 107 * 3, 0, //  81  0000 110
    117 * 3, 118 * 3, 0, //  82  0001 001
    101 * 3, 99 * 3, 0, //  83  0001 101
    98 * 3, 96 * 3, 0, //  84  0001 110
    100 * 3, 91 * 3, 0, //  85  0001 011
    114 * 3, 115 * 3, 0, //  86  0001 010
    105 * 3, 108 * 3, 0, //  87  0000 101
    112 * 3, 111 * 3, 0, //  88  0001 000
    121 * 3, 125 * 3, 0, //  89  0000 0011
    0, 0, 41, //  90  0001 1000.
    0, 0, 14, //  91  0001 0111.
    0, 0, 21, //  92  0001 1001.
    124 * 3, 122 * 3, 0, //  93  0000 0010
    120 * 3, 123 * 3, 0, //  94  0000 0001
    0, 0, 11, //  95  0001 1110.
    0, 0, 19, //  96  0001 1101.
    0, 0, 7, //  97  0001 1111.
    0, 0, 35, //  98  0001 1100.
    0, 0, 13, //  99  0001 1011.
    0, 0, 50, // 100  0001 0110.
    0, 0, 49, // 101  0001 1010.
    0, 0, 58, // 102  0000 0100.
    0, 0, 37, // 103  0000 1110.
    0, 0, 25, // 104  0000 1111.
    0, 0, 45, // 105  0000 1010.
    0, 0, 57, // 106  0000 1000.
    0, 0, 26, // 107  0000 1101.
    0, 0, 29, // 108  0000 1011.
    0, 0, 38, // 109  0000 1100.
    0, 0, 53, // 110  0000 1001.
    0, 0, 23, // 111  0001 0001.
    0, 0, 43, // 112  0001 0000.
    0, 0, 46, // 113  0000 0110.
    0, 0, 42, // 114  0001 0100.
    0, 0, 22, // 115  0001 0101.
    0, 0, 54, // 116  0000 0101.
    0, 0, 51, // 117  0001 0010.
    0, 0, 15, // 118  0001 0011.
    0, 0, 30, // 119  0000 0111.
    0, 0, 39, // 120  0000 0001 0.
    0, 0, 47, // 121  0000 0011 0.
    0, 0, 55, // 122  0000 0010 1.
    0, 0, 27, // 123  0000 0001 1.
    0, 0, 59, // 124  0000 0010 0.
    0, 0, 31 // 125  0000 0011 1.
]);

var MOTION = new Int16Array([
    1 * 3, 2 * 3, 0, //   0
    4 * 3, 3 * 3, 0, //   1  0
    0, 0, 0, //   2  1.
    6 * 3, 5 * 3, 0, //   3  01
    8 * 3, 7 * 3, 0, //   4  00
    0, 0, -1, //   5  011.
    0, 0, 1, //   6  010.
    9 * 3, 10 * 3, 0, //   7  001
    12 * 3, 11 * 3, 0, //   8  000
    0, 0, 2, //   9  0010.
    0, 0, -2, //  10  0011.
    14 * 3, 15 * 3, 0, //  11  0001
    16 * 3, 13 * 3, 0, //  12  0000
    20 * 3, 18 * 3, 0, //  13  0000 1
    0, 0, 3, //  14  0001 0.
    0, 0, -3, //  15  0001 1.
    17 * 3, 19 * 3, 0, //  16  0000 0
    -1, 23 * 3, 0, //  17  0000 00
    27 * 3, 25 * 3, 0, //  18  0000 11
    26 * 3, 21 * 3, 0, //  19  0000 01
    24 * 3, 22 * 3, 0, //  20  0000 10
    32 * 3, 28 * 3, 0, //  21  0000 011
    29 * 3, 31 * 3, 0, //  22  0000 101
    -1, 33 * 3, 0, //  23  0000 001
    36 * 3, 35 * 3, 0, //  24  0000 100
    0, 0, -4, //  25  0000 111.
    30 * 3, 34 * 3, 0, //  26  0000 010
    0, 0, 4, //  27  0000 110.
    0, 0, -7, //  28  0000 0111.
    0, 0, 5, //  29  0000 1010.
    37 * 3, 41 * 3, 0, //  30  0000 0100
    0, 0, -5, //  31  0000 1011.
    0, 0, 7, //  32  0000 0110.
    38 * 3, 40 * 3, 0, //  33  0000 0011
    42 * 3, 39 * 3, 0, //  34  0000 0101
    0, 0, -6, //  35  0000 1001.
    0, 0, 6, //  36  0000 1000.
    51 * 3, 54 * 3, 0, //  37  0000 0100 0
    50 * 3, 49 * 3, 0, //  38  0000 0011 0
    45 * 3, 46 * 3, 0, //  39  0000 0101 1
    52 * 3, 47 * 3, 0, //  40  0000 0011 1
    43 * 3, 53 * 3, 0, //  41  0000 0100 1
    44 * 3, 48 * 3, 0, //  42  0000 0101 0
    0, 0, 10, //  43  0000 0100 10.
    0, 0, 9, //  44  0000 0101 00.
    0, 0, 8, //  45  0000 0101 10.
    0, 0, -8, //  46  0000 0101 11.
    57 * 3, 66 * 3, 0, //  47  0000 0011 11
    0, 0, -9, //  48  0000 0101 01.
    60 * 3, 64 * 3, 0, //  49  0000 0011 01
    56 * 3, 61 * 3, 0, //  50  0000 0011 00
    55 * 3, 62 * 3, 0, //  51  0000 0100 00
    58 * 3, 63 * 3, 0, //  52  0000 0011 10
    0, 0, -10, //  53  0000 0100 11.
    59 * 3, 65 * 3, 0, //  54  0000 0100 01
    0, 0, 12, //  55  0000 0100 000.
    0, 0, 16, //  56  0000 0011 000.
    0, 0, 13, //  57  0000 0011 110.
    0, 0, 14, //  58  0000 0011 100.
    0, 0, 11, //  59  0000 0100 010.
    0, 0, 15, //  60  0000 0011 010.
    0, 0, -16, //  61  0000 0011 001.
    0, 0, -12, //  62  0000 0100 001.
    0, 0, -14, //  63  0000 0011 101.
    0, 0, -15, //  64  0000 0011 011.
    0, 0, -11, //  65  0000 0100 011.
    0, 0, -13 //  66  0000 0011 111.
]);

var DCT_DC_SIZE_LUMINANCE = new Int8Array([
    2 * 3, 1 * 3, 0, //   0
    6 * 3, 5 * 3, 0, //   1  1
    3 * 3, 4 * 3, 0, //   2  0
    0, 0, 1, //   3  00.
    0, 0, 2, //   4  01.
    9 * 3, 8 * 3, 0, //   5  11
    7 * 3, 10 * 3, 0, //   6  10
    0, 0, 0, //   7  100.
    12 * 3, 11 * 3, 0, //   8  111
    0, 0, 4, //   9  110.
    0, 0, 3, //  10  101.
    13 * 3, 14 * 3, 0, //  11  1111
    0, 0, 5, //  12  1110.
    0, 0, 6, //  13  1111 0.
    16 * 3, 15 * 3, 0, //  14  1111 1
    17 * 3, -1, 0, //  15  1111 11
    0, 0, 7, //  16  1111 10.
    0, 0, 8 //  17  1111 110.
]);

var DCT_DC_SIZE_CHROMINANCE = new Int8Array([
    2 * 3, 1 * 3, 0, //   0
    4 * 3, 3 * 3, 0, //   1  1
    6 * 3, 5 * 3, 0, //   2  0
    8 * 3, 7 * 3, 0, //   3  11
    0, 0, 2, //   4  10.
    0, 0, 1, //   5  01.
    0, 0, 0, //   6  00.
    10 * 3, 9 * 3, 0, //   7  111
    0, 0, 3, //   8  110.
    12 * 3, 11 * 3, 0, //   9  1111
    0, 0, 4, //  10  1110.
    14 * 3, 13 * 3, 0, //  11  1111 1
    0, 0, 5, //  12  1111 0.
    16 * 3, 15 * 3, 0, //  13  1111 11
    0, 0, 6, //  14  1111 10.
    17 * 3, -1, 0, //  15  1111 111
    0, 0, 7, //  16  1111 110.
    0, 0, 8 //  17  1111 1110.
]);

var DCT_COEFF = new Int32Array([
    1 * 3, 2 * 3, 0, //   0
    4 * 3, 3 * 3, 0, //   1  0
    0, 0, 0x0001, //   2  1.
    7 * 3, 8 * 3, 0, //   3  01
    6 * 3, 5 * 3, 0, //   4  00
    13 * 3, 9 * 3, 0, //   5  001
    11 * 3, 10 * 3, 0, //   6  000
    14 * 3, 12 * 3, 0, //   7  010
    0, 0, 0x0101, //   8  011.
    20 * 3, 22 * 3, 0, //   9  0011
    18 * 3, 21 * 3, 0, //  10  0001
    16 * 3, 19 * 3, 0, //  11  0000
    0, 0, 0x0201, //  12  0101.
    17 * 3, 15 * 3, 0, //  13  0010
    0, 0, 0x0002, //  14  0100.
    0, 0, 0x0003, //  15  0010 1.
    27 * 3, 25 * 3, 0, //  16  0000 0
    29 * 3, 31 * 3, 0, //  17  0010 0
    24 * 3, 26 * 3, 0, //  18  0001 0
    32 * 3, 30 * 3, 0, //  19  0000 1
    0, 0, 0x0401, //  20  0011 0.
    23 * 3, 28 * 3, 0, //  21  0001 1
    0, 0, 0x0301, //  22  0011 1.
    0, 0, 0x0102, //  23  0001 10.
    0, 0, 0x0701, //  24  0001 00.
    0, 0, 0xffff, //  25  0000 01. -- escape
    0, 0, 0x0601, //  26  0001 01.
    37 * 3, 36 * 3, 0, //  27  0000 00
    0, 0, 0x0501, //  28  0001 11.
    35 * 3, 34 * 3, 0, //  29  0010 00
    39 * 3, 38 * 3, 0, //  30  0000 11
    33 * 3, 42 * 3, 0, //  31  0010 01
    40 * 3, 41 * 3, 0, //  32  0000 10
    52 * 3, 50 * 3, 0, //  33  0010 010
    54 * 3, 53 * 3, 0, //  34  0010 001
    48 * 3, 49 * 3, 0, //  35  0010 000
    43 * 3, 45 * 3, 0, //  36  0000 001
    46 * 3, 44 * 3, 0, //  37  0000 000
    0, 0, 0x0801, //  38  0000 111.
    0, 0, 0x0004, //  39  0000 110.
    0, 0, 0x0202, //  40  0000 100.
    0, 0, 0x0901, //  41  0000 101.
    51 * 3, 47 * 3, 0, //  42  0010 011
    55 * 3, 57 * 3, 0, //  43  0000 0010
    60 * 3, 56 * 3, 0, //  44  0000 0001
    59 * 3, 58 * 3, 0, //  45  0000 0011
    61 * 3, 62 * 3, 0, //  46  0000 0000
    0, 0, 0x0a01, //  47  0010 0111.
    0, 0, 0x0d01, //  48  0010 0000.
    0, 0, 0x0006, //  49  0010 0001.
    0, 0, 0x0103, //  50  0010 0101.
    0, 0, 0x0005, //  51  0010 0110.
    0, 0, 0x0302, //  52  0010 0100.
    0, 0, 0x0b01, //  53  0010 0011.
    0, 0, 0x0c01, //  54  0010 0010.
    76 * 3, 75 * 3, 0, //  55  0000 0010 0
    67 * 3, 70 * 3, 0, //  56  0000 0001 1
    73 * 3, 71 * 3, 0, //  57  0000 0010 1
    78 * 3, 74 * 3, 0, //  58  0000 0011 1
    72 * 3, 77 * 3, 0, //  59  0000 0011 0
    69 * 3, 64 * 3, 0, //  60  0000 0001 0
    68 * 3, 63 * 3, 0, //  61  0000 0000 0
    66 * 3, 65 * 3, 0, //  62  0000 0000 1
    81 * 3, 87 * 3, 0, //  63  0000 0000 01
    91 * 3, 80 * 3, 0, //  64  0000 0001 01
    82 * 3, 79 * 3, 0, //  65  0000 0000 11
    83 * 3, 86 * 3, 0, //  66  0000 0000 10
    93 * 3, 92 * 3, 0, //  67  0000 0001 10
    84 * 3, 85 * 3, 0, //  68  0000 0000 00
    90 * 3, 94 * 3, 0, //  69  0000 0001 00
    88 * 3, 89 * 3, 0, //  70  0000 0001 11
    0, 0, 0x0203, //  71  0000 0010 11.
    0, 0, 0x0104, //  72  0000 0011 00.
    0, 0, 0x0007, //  73  0000 0010 10.
    0, 0, 0x0402, //  74  0000 0011 11.
    0, 0, 0x0502, //  75  0000 0010 01.
    0, 0, 0x1001, //  76  0000 0010 00.
    0, 0, 0x0f01, //  77  0000 0011 01.
    0, 0, 0x0e01, //  78  0000 0011 10.
    105 * 3, 107 * 3, 0, //  79  0000 0000 111
    111 * 3, 114 * 3, 0, //  80  0000 0001 011
    104 * 3, 97 * 3, 0, //  81  0000 0000 010
    125 * 3, 119 * 3, 0, //  82  0000 0000 110
    96 * 3, 98 * 3, 0, //  83  0000 0000 100
    -1, 123 * 3, 0, //  84  0000 0000 000
    95 * 3, 101 * 3, 0, //  85  0000 0000 001
    106 * 3, 121 * 3, 0, //  86  0000 0000 101
    99 * 3, 102 * 3, 0, //  87  0000 0000 011
    113 * 3, 103 * 3, 0, //  88  0000 0001 110
    112 * 3, 116 * 3, 0, //  89  0000 0001 111
    110 * 3, 100 * 3, 0, //  90  0000 0001 000
    124 * 3, 115 * 3, 0, //  91  0000 0001 010
    117 * 3, 122 * 3, 0, //  92  0000 0001 101
    109 * 3, 118 * 3, 0, //  93  0000 0001 100
    120 * 3, 108 * 3, 0, //  94  0000 0001 001
    127 * 3, 136 * 3, 0, //  95  0000 0000 0010
    139 * 3, 140 * 3, 0, //  96  0000 0000 1000
    130 * 3, 126 * 3, 0, //  97  0000 0000 0101
    145 * 3, 146 * 3, 0, //  98  0000 0000 1001
    128 * 3, 129 * 3, 0, //  99  0000 0000 0110
    0, 0, 0x0802, // 100  0000 0001 0001.
    132 * 3, 134 * 3, 0, // 101  0000 0000 0011
    155 * 3, 154 * 3, 0, // 102  0000 0000 0111
    0, 0, 0x0008, // 103  0000 0001 1101.
    137 * 3, 133 * 3, 0, // 104  0000 0000 0100
    143 * 3, 144 * 3, 0, // 105  0000 0000 1110
    151 * 3, 138 * 3, 0, // 106  0000 0000 1010
    142 * 3, 141 * 3, 0, // 107  0000 0000 1111
    0, 0, 0x000a, // 108  0000 0001 0011.
    0, 0, 0x0009, // 109  0000 0001 1000.
    0, 0, 0x000b, // 110  0000 0001 0000.
    0, 0, 0x1501, // 111  0000 0001 0110.
    0, 0, 0x0602, // 112  0000 0001 1110.
    0, 0, 0x0303, // 113  0000 0001 1100.
    0, 0, 0x1401, // 114  0000 0001 0111.
    0, 0, 0x0702, // 115  0000 0001 0101.
    0, 0, 0x1101, // 116  0000 0001 1111.
    0, 0, 0x1201, // 117  0000 0001 1010.
    0, 0, 0x1301, // 118  0000 0001 1001.
    148 * 3, 152 * 3, 0, // 119  0000 0000 1101
    0, 0, 0x0403, // 120  0000 0001 0010.
    153 * 3, 150 * 3, 0, // 121  0000 0000 1011
    0, 0, 0x0105, // 122  0000 0001 1011.
    131 * 3, 135 * 3, 0, // 123  0000 0000 0001
    0, 0, 0x0204, // 124  0000 0001 0100.
    149 * 3, 147 * 3, 0, // 125  0000 0000 1100
    172 * 3, 173 * 3, 0, // 126  0000 0000 0101 1
    162 * 3, 158 * 3, 0, // 127  0000 0000 0010 0
    170 * 3, 161 * 3, 0, // 128  0000 0000 0110 0
    168 * 3, 166 * 3, 0, // 129  0000 0000 0110 1
    157 * 3, 179 * 3, 0, // 130  0000 0000 0101 0
    169 * 3, 167 * 3, 0, // 131  0000 0000 0001 0
    174 * 3, 171 * 3, 0, // 132  0000 0000 0011 0
    178 * 3, 177 * 3, 0, // 133  0000 0000 0100 1
    156 * 3, 159 * 3, 0, // 134  0000 0000 0011 1
    164 * 3, 165 * 3, 0, // 135  0000 0000 0001 1
    183 * 3, 182 * 3, 0, // 136  0000 0000 0010 1
    175 * 3, 176 * 3, 0, // 137  0000 0000 0100 0
    0, 0, 0x0107, // 138  0000 0000 1010 1.
    0, 0, 0x0a02, // 139  0000 0000 1000 0.
    0, 0, 0x0902, // 140  0000 0000 1000 1.
    0, 0, 0x1601, // 141  0000 0000 1111 1.
    0, 0, 0x1701, // 142  0000 0000 1111 0.
    0, 0, 0x1901, // 143  0000 0000 1110 0.
    0, 0, 0x1801, // 144  0000 0000 1110 1.
    0, 0, 0x0503, // 145  0000 0000 1001 0.
    0, 0, 0x0304, // 146  0000 0000 1001 1.
    0, 0, 0x000d, // 147  0000 0000 1100 1.
    0, 0, 0x000c, // 148  0000 0000 1101 0.
    0, 0, 0x000e, // 149  0000 0000 1100 0.
    0, 0, 0x000f, // 150  0000 0000 1011 1.
    0, 0, 0x0205, // 151  0000 0000 1010 0.
    0, 0, 0x1a01, // 152  0000 0000 1101 1.
    0, 0, 0x0106, // 153  0000 0000 1011 0.
    180 * 3, 181 * 3, 0, // 154  0000 0000 0111 1
    160 * 3, 163 * 3, 0, // 155  0000 0000 0111 0
    196 * 3, 199 * 3, 0, // 156  0000 0000 0011 10
    0, 0, 0x001b, // 157  0000 0000 0101 00.
    203 * 3, 185 * 3, 0, // 158  0000 0000 0010 01
    202 * 3, 201 * 3, 0, // 159  0000 0000 0011 11
    0, 0, 0x0013, // 160  0000 0000 0111 00.
    0, 0, 0x0016, // 161  0000 0000 0110 01.
    197 * 3, 207 * 3, 0, // 162  0000 0000 0010 00
    0, 0, 0x0012, // 163  0000 0000 0111 01.
    191 * 3, 192 * 3, 0, // 164  0000 0000 0001 10
    188 * 3, 190 * 3, 0, // 165  0000 0000 0001 11
    0, 0, 0x0014, // 166  0000 0000 0110 11.
    184 * 3, 194 * 3, 0, // 167  0000 0000 0001 01
    0, 0, 0x0015, // 168  0000 0000 0110 10.
    186 * 3, 193 * 3, 0, // 169  0000 0000 0001 00
    0, 0, 0x0017, // 170  0000 0000 0110 00.
    204 * 3, 198 * 3, 0, // 171  0000 0000 0011 01
    0, 0, 0x0019, // 172  0000 0000 0101 10.
    0, 0, 0x0018, // 173  0000 0000 0101 11.
    200 * 3, 205 * 3, 0, // 174  0000 0000 0011 00
    0, 0, 0x001f, // 175  0000 0000 0100 00.
    0, 0, 0x001e, // 176  0000 0000 0100 01.
    0, 0, 0x001c, // 177  0000 0000 0100 11.
    0, 0, 0x001d, // 178  0000 0000 0100 10.
    0, 0, 0x001a, // 179  0000 0000 0101 01.
    0, 0, 0x0011, // 180  0000 0000 0111 10.
    0, 0, 0x0010, // 181  0000 0000 0111 11.
    189 * 3, 206 * 3, 0, // 182  0000 0000 0010 11
    187 * 3, 195 * 3, 0, // 183  0000 0000 0010 10
    218 * 3, 211 * 3, 0, // 184  0000 0000 0001 010
    0, 0, 0x0025, // 185  0000 0000 0010 011.
    215 * 3, 216 * 3, 0, // 186  0000 0000 0001 000
    0, 0, 0x0024, // 187  0000 0000 0010 100.
    210 * 3, 212 * 3, 0, // 188  0000 0000 0001 110
    0, 0, 0x0022, // 189  0000 0000 0010 110.
    213 * 3, 209 * 3, 0, // 190  0000 0000 0001 111
    221 * 3, 222 * 3, 0, // 191  0000 0000 0001 100
    219 * 3, 208 * 3, 0, // 192  0000 0000 0001 101
    217 * 3, 214 * 3, 0, // 193  0000 0000 0001 001
    223 * 3, 220 * 3, 0, // 194  0000 0000 0001 011
    0, 0, 0x0023, // 195  0000 0000 0010 101.
    0, 0, 0x010b, // 196  0000 0000 0011 100.
    0, 0, 0x0028, // 197  0000 0000 0010 000.
    0, 0, 0x010c, // 198  0000 0000 0011 011.
    0, 0, 0x010a, // 199  0000 0000 0011 101.
    0, 0, 0x0020, // 200  0000 0000 0011 000.
    0, 0, 0x0108, // 201  0000 0000 0011 111.
    0, 0, 0x0109, // 202  0000 0000 0011 110.
    0, 0, 0x0026, // 203  0000 0000 0010 010.
    0, 0, 0x010d, // 204  0000 0000 0011 010.
    0, 0, 0x010e, // 205  0000 0000 0011 001.
    0, 0, 0x0021, // 206  0000 0000 0010 111.
    0, 0, 0x0027, // 207  0000 0000 0010 001.
    0, 0, 0x1f01, // 208  0000 0000 0001 1011.
    0, 0, 0x1b01, // 209  0000 0000 0001 1111.
    0, 0, 0x1e01, // 210  0000 0000 0001 1100.
    0, 0, 0x1002, // 211  0000 0000 0001 0101.
    0, 0, 0x1d01, // 212  0000 0000 0001 1101.
    0, 0, 0x1c01, // 213  0000 0000 0001 1110.
    0, 0, 0x010f, // 214  0000 0000 0001 0011.
    0, 0, 0x0112, // 215  0000 0000 0001 0000.
    0, 0, 0x0111, // 216  0000 0000 0001 0001.
    0, 0, 0x0110, // 217  0000 0000 0001 0010.
    0, 0, 0x0603, // 218  0000 0000 0001 0100.
    0, 0, 0x0b02, // 219  0000 0000 0001 1010.
    0, 0, 0x0e02, // 220  0000 0000 0001 0111.
    0, 0, 0x0d02, // 221  0000 0000 0001 1000.
    0, 0, 0x0c02, // 222  0000 0000 0001 1001.
    0, 0, 0x0f02 // 223  0000 0000 0001 0110.
]);

var DECODE_SKIP_OUTPUT = 1;

var PICTURE_TYPE_I = 1;
var PICTURE_TYPE_P = 2;
var PICTURE_TYPE_B = 3;
var PICTURE_TYPE_D = 4;
var START_SEQUENCE = 0xB3;
var START_SLICE_FIRST = 0x01;
var START_SLICE_LAST = 0xAF;
var START_PICTURE = 0x00;
var START_EXTENSION = 0xB5;
var START_USER_DATA = 0xB2;

var MACROBLOCK_TYPE_TABLES = [
  null,
  MACROBLOCK_TYPE_I,
  MACROBLOCK_TYPE_P,
  MACROBLOCK_TYPE_B
];

},{"./BitReader.js":7,"./CanvasRenderer.js":8,"./WebGLRenderer.js":11,"./utils.js":12}],10:[function(require,module,exports){
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var inherits = require('util').inherits;

var VideoLoader = module.exports = function(urls) {
  this.videos = [];
  this.index = 0;
  if (urls) {
    urls = Array.isArray(urls) ? urls : [urls];
  }
  this.queue = urls || [];
  this.loading = false;
};

inherits(VideoLoader, EventEmitter2);

VideoLoader.prototype.getNext = function() {
  if (this.index < this.videos.length) {
    var video = this.videos[this.index];
    this.index++;
    return video;
  }
  return null;
};

VideoLoader.prototype.load = function() {
  var request = new XMLHttpRequest();
  request.onreadystatechange = (function() {
    if (request.readyState == request.DONE && request.status == 200) {
      this.videos.push(request.response);
      this.emit('load');
      if (this.queue.length > 1) {
        this.queue = this.queue.slice(1);
        this.load();
      } else {
        this.emit('loadingComplete');
        this.loading = false;
      }
    }
  }).bind(this);

  if (this.queue.length > 0) {
    this.loading = true;
    request.open('GET', this.queue[0]);
    request.responseType = "arraybuffer";
    request.send();
  }
};

},{"eventemitter2":6,"util":5}],11:[function(require,module,exports){
var WebGLRenderer = module.exports = function(decoder, canvas) {
  this.decoder = decoder;
  this.canvas = canvas;

  this.gl = null;
  this.program = null;
  this.YTexture = null;
  this.CBTexture = null;
  this.CRTexture = null;
};

WebGLRenderer.prototype.init = function() {
  this.gl.useProgram(this.program);
  this.gl.viewport(0, 0, this.decoder.width, this.decoder.height);
};

WebGLRenderer.prototype.initGL = function() {
  try {
    var gl = this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
  } catch ( e ) {
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

  if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(this.program));
  }

  this.gl.useProgram(this.program);

  // setup textures
  this.YTexture = this.createTexture(0, 'YTexture');
  this.CBTexture = this.createTexture(1, 'CBTexture');
  this.CRTexture = this.createTexture(2, 'CRTexture');

  var vertexAttr = gl.getAttribLocation(this.program, 'vertex');
  gl.enableVertexAttribArray(vertexAttr);
  gl.vertexAttribPointer(vertexAttr, 2, gl.FLOAT, false, 0, 0);

  return true;
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

WebGLRenderer.prototype.render = function(Y, Cb, Cr) {
  var gl = this.gl;

  var uint8Y = new Uint8Array(Y.buffer);
  var uint8Cr = new Uint8Array(Cr.buffer);
  var uint8Cb = new Uint8Array(Cb.buffer);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.YTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.decoder.codedWidth, this.decoder.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, this.CBTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.decoder.halfWidth, this.decoder.height / 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr);

  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, this.CRTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.decoder.halfWidth, this.decoder.height / 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
};

// Shaders for accelerated WebGLRenderer YCbCrToRGBA conversion
var SHADER_FRAGMENT_YCBCRTORGBA = [
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
].join('\n');

var SHADER_VERTEX_IDENTITY = [
  'attribute vec2 vertex;',
  'varying vec2 texCoord;',

  'void main() {',
  'texCoord = vertex;',
  'gl_Position = vec4((vertex * 2.0 - 1.0) * vec2(1, -1), 0.0, 1.0);',
  '}'
].join('\n');

},{}],12:[function(require,module,exports){
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

},{}]},{},[1])(1)
});