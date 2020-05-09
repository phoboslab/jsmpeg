#!/bin/sh


# Build the .wasm Module first

# Since we're compiling a side module here, so that we can load it without the
# runtime cruft, we have to explicitly compile in support for malloc and
# friends.
# Note memcpy, memmove and memset are explicitly exported, otherwise they will
# be eliminated by the SIDE_MODULE=2 setting - not sure why that happens.

# This NEEDS to be compiled with emscripten 1.38.47. Newer versions mess with
# malloc and friends and need some more glue code for side modules that I 
# haven't quite worked out yet. If you have any idea how to build a SIDE_MODULE
# (or STANDALONE_WASM - as seems to be the new deal) with support for malloc,
# please let me know or file a PR.

# To install the correct version, issue the following in your emsdk directory:
# ./emsdk install 1.38.47
# ./emsdk activate 1.38.47
# source ./emsdk_env.sh

# The $EMSCRIPTEN_LIB var needs to point to the correct directory within the sdk
# that has emmalloc.cpp. This is usually $EMSDK/fastcomp/emscripten/system/lib
# but it might differ per system. I don't know.
# There used to be an $EMSCRIPTEN var set by the emsdk_env script that pointed
# to the correct directory, but this seems to have gone now.

# In conclusion, emscripten encapsulates everything that I hate about native 
# development :/

EMSCRIPTEN_LIB=$EMSDK/fastcomp/emscripten/system/lib

emcc \
	src/wasm/mpeg1.c \
	src/wasm/mp2.c \
	src/wasm/buffer.c \
	$EMSCRIPTEN_LIB/emmalloc.cpp \
	$EMSCRIPTEN_LIB/libc/musl/src/string/memcpy.c \
	$EMSCRIPTEN_LIB/libc/musl/src/string/memmove.c \
	$EMSCRIPTEN_LIB/libc/musl/src/string/memset.c \
	-s WASM=1 \
	-s SIDE_MODULE=2 \
	-s TOTAL_STACK=5242880\
	-s USE_PTHREADS=0 \
	-s LEGALIZE_JS_FFI=0\
	-s NO_FILESYSTEM=1 \
	-s DEFAULT_LIBRARY_FUNCS_TO_INCLUDE="[]" \
	-s "EXPORTED_FUNCTIONS=[
		'_memcpy',
		'_memmove',
		'_memset',
		'_mpeg1_decoder_create',
		'_mpeg1_decoder_destroy',
		'_mpeg1_decoder_get_write_ptr',
		'_mpeg1_decoder_get_index',
		'_mpeg1_decoder_set_index',
		'_mpeg1_decoder_did_write',
		'_mpeg1_decoder_has_sequence_header',
		'_mpeg1_decoder_get_frame_rate',
		'_mpeg1_decoder_get_coded_size',
		'_mpeg1_decoder_get_width',
		'_mpeg1_decoder_get_height',
		'_mpeg1_decoder_get_y_ptr',
		'_mpeg1_decoder_get_cr_ptr',
		'_mpeg1_decoder_get_cb_ptr',
		'_mpeg1_decoder_decode',
		'_mp2_decoder_create',
		'_mp2_decoder_destroy',
		'_mp2_decoder_get_write_ptr',
		'_mp2_decoder_get_index',
		'_mp2_decoder_set_index',
		'_mp2_decoder_did_write',
		'_mp2_decoder_get_left_channel_ptr',
		'_mp2_decoder_get_right_channel_ptr',
		'_mp2_decoder_get_sample_rate',
		'_mp2_decoder_decode']" \
	-O3 \
	-o jsmpeg.wasm


# Concat all .js sources
cat \
	src/jsmpeg.js \
	src/video-element.js \
	src/player.js \
	src/buffer.js \
	src/ajax.js \
	src/fetch.js \
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

# Append the .wasm module to the .js source as base64 string
echo "JSMpeg.WASM_BINARY_INLINED='$(base64 -w 0 jsmpeg.wasm)';" \
	>> jsmpeg.js


# Minify
uglifyjs jsmpeg.js -o jsmpeg.min.js

# Cleanup
rm jsmpeg.js
rm jsmpeg.wasm

