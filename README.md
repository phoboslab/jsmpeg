jsmpeg
==========

#### An MPEG1 Video Decoder in JavaScript ####

jsmpeg is a MPEG1 Decoder, written in JavaScript. It's "hand ported", i.e. not compiled with
emscripten or similar. This will probably make it obsolete with the advent of asmjs.

Some demos and more info: [phoboslab.org/log/2013/05/mpeg1-video-decoder-in-javascript](http://www.phoboslab.org/log/2013/05/mpeg1-video-decoder-in-javascript)


### Usage ###

```javascript
// Synopsis: var player = new jsmpeg(urlToFile, options);
// The 'options' argument and all of its properties is optional. If no canvas element 
// is given, jsmpeg will create its own, to be accessed at .canvas

// Example:
var canvas = document.getElementById('videoCanvas');
var player = new jsmpeg('file.mpeg', {canvas: canvas, autoplay: true, loop: true});

player.pause();
player.play();
player.stop();


// An 'onload' callback can be specified in the 'options' argument
var mpegLoaded = function( player ) {
	console.log('Loaded', player);
}
var player = new jsmpeg('file.mpeg', {onload:mpegLoaded});

// If you don't use 'autoplay' and don't explicitly call .play(), you can get individual
// video frames (a canvas element) like so:
var frame = null;
while( (frame = player.nextFrame()) ) {
	someOtherCanvasContext.drawImage(frame, 0, 0);
}
```

### Limitations ###

- Playback can only start when the file is fully loaded. I'm waiting for chunked XHR with ArrayBuffers to arrive in browsers.
- MPEG files with B-Frames look weird - frames are not reordered. This should be relatively easy
to fix, but most encoders seem to not use B-Frames at all by default.
- The width of the MPEG video has to be a multiple of 2.
- Only raw MPEG video streams are supported. The decoder hates Stream Packet Headers in between
macroblocks.

You can use [FFmpeg](http://www.ffmpeg.org/) to encode videos in a suited format. This will crop
the size to a multiple of 2, omit B-Frames and force a raw video stream:

```
ffmpeg -i in.mp4 -f mpeg1video -vf "crop=iw-mod(iw\,2):ih-mod(ih\,2)" -b 0 out.mpg
```
