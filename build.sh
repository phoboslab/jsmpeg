#!/bin/sh

# Concat all .js sources
cat \
	src/jsmpeg.js \
	src/video-element.js \
	src/player.js \
	src/buffer.js \
	src/ajax.js \
	src/ajax-progressive.js \
	src/websocket.js \
	src/ts.js \
	src/decoder.js \
	src/mpeg1.js \
	src/mpeg1-wasm.js \
	src/mp2.js \
	src/mp2-wasm.js \
	src/webgl.js \
	src/canvas2d.js \
	src/webaudio.js \
	src/wasm-module.js \
	> jsmpeg.js

# Append the base64'd wasm from the upstream build
echo "JSMpeg.WASM_BINARY_INLINED='$(cat wasm.base64)';" \
	>> jsmpeg.js

# Minify
./node_modules/.bin/uglifyjs jsmpeg.js -o jsmpeg.min.js

# Cleanup
rm jsmpeg.js

# Copy to where we need it
cp jsmpeg.min.js ../sa-ksf-sdk/jsmpeg.min.js
