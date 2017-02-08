#!/bin/sh
./node_modules/.bin/webpack && ./node_modules/.bin/uglifyjs build/jsmpeg.js -o jsmpeg.min.js
