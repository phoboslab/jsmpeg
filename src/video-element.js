JSMpeg.VideoElement = (function(){ "use strict";

var VideoElement = function(element) {	
	var url = element.dataset.url;

	if (!url) {
		throw ("VideoElement has no `data-url` attribute");
	}

	// Setup the div container, canvas and play button
	var addStyles = function(element, styles) {
		for (var name in styles) {
			element.style[name] = styles[name];
		}
	};

	this.container = element;
	addStyles(this.container, {
		display: 'inline-block',
		position: 'relative',
		minWidth: '80px', minHeight: '80px'
	});

	this.canvas = document.createElement('canvas');
	this.canvas.width = 960;
	this.canvas.height = 540;
	addStyles(this.canvas, {
		display: 'block',
		width: '100%'
	});
	this.container.appendChild(this.canvas);

	this.playButton = document.createElement('div');
	this.playButton.innerHTML = VideoElement.PLAY_BUTTON;
	addStyles(this.playButton, {
		zIndex: 2, position: 'absolute',
		top: '0', bottom: '0', left: '0', right: '0',
		maxWidth: '75px', maxHeight: '75px',
		margin: 'auto',
		opacity: '0.7',
		cursor: 'pointer'
	});
	this.container.appendChild(this.playButton);	

	// Parse the data-options - we try to decode the values as json. This way
	// we can get proper boolean and number values. If JSON.parse() fails,
	// treat it as a string.
	var options = {canvas: this.canvas};
	for (var option in element.dataset) {
		try {
			options[option] = JSON.parse(element.dataset[option]);
		}
		catch(err) {
			options[option] = element.dataset[option];
		}
	}

	// Create the player instance
	this.player = new JSMpeg.Player(url, options);
	element.playerInstance = this.player;

	// Setup the poster element, if any
	if (options.poster && !options.autoplay && !this.player.options.streaming) {
		options.decodeFirstFrame = false;
		this.poster = new Image();
		this.poster.src = options.poster;
		this.poster.addEventListener('load', this.posterLoaded)
		addStyles(this.poster, {
			display: 'block', zIndex: 1, position: 'absolute',
			top: 0, left: 0, bottom: 0, right: 0
		});
		this.container.appendChild(this.poster);
	}

	// Add the click handler if this video is pausable
	if (!this.player.options.streaming) {
		this.container.addEventListener('click', this.onClick.bind(this));
	}

	// Hide the play button if this video immediately begins playing
	if (options.autoplay || this.player.options.streaming) {
		this.playButton.style.display = 'none';
	}

	// Set up the unlock audio buton for iOS devices. iOS only allows us to 
	// play audio after a user action has initiated playing. For autoplay or 
	// streaming players we set up a muted speaker icon as the button. For all
	// others, we can simply use the play button.
	if (this.player.audioOut && !this.player.audioOut.unlocked) {
		var unlockAudioElement = this.container;

		if (options.autoplay || this.player.options.streaming) {
			this.unmuteButton = document.createElement('div');
			this.unmuteButton.innerHTML = VideoElement.UNMUTE_BUTTON;
			addStyles(this.unmuteButton, {
				zIndex: 2, position: 'absolute',
				bottom: '10px', right: '20px',
				width: '75px', height: '75px',
				margin: 'auto',
				opacity: '0.7',
				cursor: 'pointer'				
			});
			this.container.appendChild(this.unmuteButton);
			unlockAudioElement = this.unmuteButton;
		}

		this.unlockAudioBound = this.onUnlockAudio.bind(this, unlockAudioElement);
		unlockAudioElement.addEventListener('touchstart', this.unlockAudioBound, false);
		unlockAudioElement.addEventListener('click', this.unlockAudioBound, true);
	}
};

VideoElement.prototype.onUnlockAudio = function(element, ev) {
	if (this.unmuteButton) {
		ev.preventDefault();
		ev.stopPropagation();
	}
	this.player.audioOut.unlock(function(){
		if (this.unmuteButton) {
			this.unmuteButton.style.display = 'none';
		}
		element.removeEventListener('touchstart', this.unlockAudioBound);
		element.removeEventListener('click', this.unlockAudioBound);
	}.bind(this));
};

VideoElement.prototype.onClick = function(ev) {
	if (this.player.isPlaying) {
		this.player.pause();
		this.playButton.style.display = 'block';
	}
	else {
		this.player.play();
		this.playButton.style.display = 'none';
		if (this.poster) {
			this.poster.style.display = 'none';
		}
	}
};

VideoElement.PLAY_BUTTON = 
	'<svg style="max-width: 75px; max-height: 75px;" ' +
		'viewBox="0 0 200 200" alt="Play video">' +
		'<circle cx="100" cy="100" r="90" fill="none" '+
			'stroke-width="15" stroke="#fff"/>' +
		'<polygon points="70, 55 70, 145 145, 100" fill="#fff"/>' +
	'</svg>';

VideoElement.UNMUTE_BUTTON = 
	'<svg style="max-width: 75px; max-height: 75px;" viewBox="0 0 75 75">' +
		'<polygon class="audio-speaker" stroke="none" fill="#fff" '+
			'points="39,13 22,28 6,28 6,47 21,47 39,62 39,13"/>' +
		'<g stroke="#fff" stroke-width="5">' +
			'<path d="M 49,50 69,26"/>' +
			'<path d="M 69,50 49,26"/>' +
		'</g>' +
	'</svg>';

return VideoElement;

})();

