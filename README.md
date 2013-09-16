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

### Live Streaming ###

jsmpeg supports streaming live video through WebSockets. You can use ffmpeg and a nodejs server to serve the MPEG video. See this [blog post](http://phoboslab.org/log/2013/09/html5-live-video-streaming-via-websockets) for the details of setting up a server. Also have a look at the `stream-server.js` and `stream-example.html`.

To configure jsmpeg to connect to the stream server, simply pass a WebSocket connection instead of a filename to the constructor:

```javascript
// Setup the WebSocket connection and start the player
var client = new WebSocket( 'ws://example.com:8084/' );
var player = new jsmpeg(client, {canvas:canvas});
```

###Stream Recording###

To record an MPEG stream clientside in the browser jsmpeg provides the `.startRecording(cb)` and `.stopRecording()` methods. `.stopRecording()` returns a `Blob` object that can be used to create a download link.

```javascript
player.startRecording(function(player){
	// Called when recording really starts; usually 
	// when the next intra frame is received
});

// ...

// Stop recording and create a download link
var blob = player.stopRecording();

var filename = 'jsmpeg-recording.mpg';
var a = document.getElementById('downloadLink');
a.innerHTML = filename;
a.download = fileName;
a.href = window.URL.createObjectURL(blob);
```



### Limitations ###

- Playback can only start when the file is fully loaded (when not streaming through WebSockets). I'm waiting for chunked XHR with ArrayBuffers to arrive in browsers.
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
