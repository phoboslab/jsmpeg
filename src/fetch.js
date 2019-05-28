JSMpeg.Source.Fetch = (function(){ "use strict";

var FetchSource = function(url, options) {
	this.url = url;
	this.destination = null;
	this.request = null;
	this.streaming = true;

	this.completed = false;
	this.established = false;
	this.progress = 0;
	this.aborted = false;

	this.onEstablishedCallback = options.onSourceEstablished;
	this.onCompletedCallback = options.onSourceCompleted;
};

FetchSource.prototype.connect = function(destination) {
	this.destination = destination;
};

FetchSource.prototype.start = function() {
	var params = {
		method: 'GET',
		headers: new Headers(),
		cache: 'default'
	};
	
	self.fetch(this.url, params).then(function(res) {
		if (res.ok && (res.status >= 200 && res.status <= 299)) {
			this.progress = 1;
			this.established = true;
			return this.pump(res.body.getReader());
		}
		else {
			//error
		}
	}.bind(this)).catch(function(err) {
		throw(err);
	});
};

FetchSource.prototype.pump = function(reader) {
	return reader.read().then(function(result) {
		if (result.done) {
			this.completed = true;
		}
		else {
			if (this.aborted) {
				return reader.cancel();
			}
			
			if (this.destination) {
				this.destination.write(result.value.buffer);
			}

			return this.pump(reader);
		}
	}.bind(this)).catch(function(err) {
		throw(err);
	});
};

FetchSource.prototype.resume = function(secondsHeadroom) {
	// Nothing to do here
};

FetchSource.prototype.abort = function() {
	this.aborted = true;
};

return FetchSource;

})();