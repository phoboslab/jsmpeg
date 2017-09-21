const fs = require('fs');
const uglify = require('uglify-js');

const srcFiles = {
    './src/jsmpeg.js': fs.readFileSync("./src/jsmpeg.js", "utf-8"),
	'./src/video-element.js': fs.readFileSync("./src/video-element.js", "utf-8"),
	'./src/player.js': fs.readFileSync("./src/player.js", "utf-8"),
	'./src/buffer.js': fs.readFileSync("./src/buffer.js", "utf-8"),
	'./src/ajax.js': fs.readFileSync("./src/ajax.js", "utf-8"),
	'./src/ajax-progressive.js': fs.readFileSync("./src/ajax-progressive.js", "utf-8"),
	'./src/websocket.js': fs.readFileSync("./src/websocket.js", "utf-8"),
	'./src/ts.js': fs.readFileSync("./src/ts.js", "utf-8"),
	'./src/decoder.js': fs.readFileSync("./src/decoder.js", "utf-8"),
	'./src/mpeg1.js': fs.readFileSync("./src/mpeg1.js", "utf-8"),
	'./src/mp2.js': fs.readFileSync("./src/mp2.js", "utf-8"),
	'./src/webgl.js': fs.readFileSync("./src/webgl.js", "utf-8"),
	'./src/canvas2d.js': fs.readFileSync("./src/canvas2d.js", "utf-8"),
	'./src/webaudio.js': fs.readFileSync("./src/webaudio.js", "utf-8")
};

const options = {

};

const uglifiedOutput = uglify.minify(srcFiles, options).code;

fs.writeFileSync('jsmpeg.min.js', uglifiedOutput, 'utf8');
