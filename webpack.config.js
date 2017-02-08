
const resolve = require('path').resolve;

module.exports = {
	entry: './src/jsmpeg.js',
	output: {
		path: resolve(__dirname, 'dist'),
		library: 'JSMpeg',
		libraryTarget: 'umd',
		filename: 'jsmpeg.js'
	}
};
