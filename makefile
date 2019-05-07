# General settings
PROJECT_NAME = jsmpeg
SRC_DIR = src
WASM_SRC_DIR = $(SRC_DIR)/wasm
BUILD_DIR = build

# Javascript source files setup
JS_SRC_FILES = 	src/jsmpeg.js src/video-element.js src/player.js src/buffer.js \
				src/ajax.js src/ajax-progressive.js src/websocket.js src/ts.js \
				src/decoder.js src/mpeg1.js src/mpeg1-wasm.js src/mp2.js \
				src/mp2-wasm.js src/webgl.js src/canvas2d.js src/webaudio.js \
				src/wasm-module.js

# WASM source files setup
WASM_SRC_FILES = $(shell find $(WASM_SRC_DIR) -type f \( -name "*.c" \) )

# Tools setup
MINJS = uglifyjs
B64 = base64
B64FLAGS = -w 0

# Emscripten Compiler setup
WASMCC = emcc
EMCCROOT = ${EMSCRIPTEN}
WASMCCFLAGS = -s WASM=1 -s SIDE_MODULE=2 -s TOTAL_STACK=5242880 \
			  -s USE_PTHREADS=0 -s LEGALIZE_JS_FFI=0 -s NO_FILESYSTEM=1 \
			  -s DEFAULT_LIBRARY_FUNCS_TO_INCLUDE="[]"
WASMCCEXTRAFLAGS = -O3

#EMCC core library files will be used
WASM_EMCC_FILES =	system/lib/emmalloc.cpp \
			 		system/lib/libc/musl/src/string/memcpy.c \
			 		system/lib/libc/musl/src/string/memmove.c \
			 		system/lib/libc/musl/src/string/memset.c
WASM_EMCC_FILES := $(addprefix $(EMCCROOT)/, $(WASM_EMCC_FILES))

# Functions that will be used
WASM_FUNCTIONS = memcpy memmove memset mpeg1_decoder_create mpeg1_decoder_destroy \
				 mpeg1_decoder_get_write_ptr mpeg1_decoder_get_index \
				 mpeg1_decoder_set_index mpeg1_decoder_did_write \
				 mpeg1_decoder_has_sequence_header mpeg1_decoder_get_frame_rate \
				 mpeg1_decoder_get_coded_size mpeg1_decoder_get_width \
				 mpeg1_decoder_get_height mpeg1_decoder_get_y_ptr \
				 mpeg1_decoder_get_cr_ptr mpeg1_decoder_get_cb_ptr \
				 mpeg1_decoder_decode mp2_decoder_create mp2_decoder_destroy \
				 mp2_decoder_get_write_ptr mp2_decoder_get_index \
				 mp2_decoder_set_index mp2_decoder_did_write \
				 mp2_decoder_get_left_channel_ptr mp2_decoder_get_right_channel_ptr \
				 mp2_decoder_get_sample_rate mp2_decoder_decode

WASM_FUNCTIONS := "EXPORTED_FUNCTIONS=[$(foreach i,$(WASM_FUNCTIONS),'_$(i)',)]"
STR_NEEDLE := ,]
WASMCCFLAGS += -s $(subst $(STR_NEEDLE),],$(WASM_FUNCTIONS))

VPATH = src: $(SRC_DIR)
vpath %.js $(SRC_DIR)
vpath %.c $(WASM_SRC_DIR)

.PHONY: all clean $(PROJECT_NAME).js $(PROJECT_NAME).min.js $(PROJECT_NAME).wasm.js $(PROJECT_NAME).wasm

# *********************************** RULES ************************************

all: $(PROJECT_NAME).min.js
clean:
	rm -rf $(BUILD_DIR)

# Build minified JS file
$(PROJECT_NAME).min.js: $(BUILD_DIR)/$(PROJECT_NAME).min.js
$(BUILD_DIR)/$(PROJECT_NAME).min.js: $(BUILD_DIR)/$(PROJECT_NAME).js
	@mkdir -p $(@D)
	$(MINJS) $? -o $@

# Build concatenated JS file
$(PROJECT_NAME).js: $(BUILD_DIR)/$(PROJECT_NAME).js
$(BUILD_DIR)/$(PROJECT_NAME).js: $(JS_SRC_FILES) $(BUILD_DIR)/$(PROJECT_NAME).wasm.js
	@mkdir -p $(@D)
	cat $? >> $@

# Build the WASM code embedded in JS file
$(PROJECT_NAME).wasm.js: $(BUILD_DIR)/$(PROJECT_NAME).wasm.js
$(BUILD_DIR)/$(PROJECT_NAME).wasm.js: $(BUILD_DIR)/$(PROJECT_NAME).wasm.b64
	@mkdir -p $(@D)
	echo -n "JSMpeg.WASM_BINARY_INLINED='" >> $@
	cat $? >> $@
	echo "';" >> $@

# Genereate base64 file with WASM code
$(BUILD_DIR)/$(PROJECT_NAME).wasm.b64: $(BUILD_DIR)/$(PROJECT_NAME).wasm
	@mkdir -p $(@D)
	$(B64) $(B64FLAGS) $? >> $@

# Build the WASM code
$(PROJECT_NAME).wasm: $(BUILD_DIR)/$(PROJECT_NAME).wasm
$(BUILD_DIR)/$(PROJECT_NAME).wasm: $(WASM_SRC_FILES)
	@mkdir -p $(@D)
	$(WASMCC) $(WASM_SRC_FILES) $(WASM_EMCC_FILES) $(WASMCCFLAGS) $(WASMCCEXTRAFLAGS) -o $@
