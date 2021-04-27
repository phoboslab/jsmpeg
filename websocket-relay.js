"use strict";
// Use the websocket-relay to serve a raw MPEG-TS over WebSockets. You can use
// ffmpeg to feed the relay. ffmpeg -> websocket-relay -> browser
// Example:
// node websocket-relay
// ffmpeg -i <some input> -f mpegts http://localhost:8081/yoursecret

//Configs
var cfg = {
	ssl: true,
	host: 'localhost',
	input_port: 8081,
	output_port: 8082,
	ssl_key: 'privkey.key',
	ssl_cert: 'pubcert.crt',
	stream_secret: 'yoursecret',
	record_stream: false,
	stream_path: 'recordings/'
};
process.title = 'Stream Server';

// Node Configs (Don't touch)
var fs = require('fs');
var http = require('http');
var https = require('https');
var websocket = require('ws');
var ws_input = false;
var ws_output = false;

// Input
var handleInputConnection = function(){
	var app = http.createServer(onRequestInput);
	app.headersTimeout = 0;
	app.listen(cfg.input_port, cfg.host);
	
	ws_input = new websocket.Server({server:app, perMessageDeflate:false});
	ws_input.on('connection', function(client){
		client.ip = client._socket.remoteAddress;
		
		client.on('close', function(reasonCode, description){
			console.log('['+client.ip+'] closed');
		});
		
		console.log('Stream ['+client.ip+'] connected');
	});
};
var onRequestInput = function(request, response){
	var params = request.url.substr(1).split('/');

	if (params[0] !== cfg.stream_secret) {
		console.log('Failed stream connection: '+request.socket.remoteAddress+':'+request.socket.remotePort+' - wrong secret');
		return response.end();
	}

	response.connection.setTimeout(0);

	request.on('data', function(data){
		ws_output.broadcast(data);
		if(request.socket.recording){
			request.socket.recording.write(data);
		}
	});
	request.on('end',function(){
		console.log('Stream end');
		if (request.socket.recording) {
			request.socket.recording.close();
		}
	});

	// Record the stream to a local file
	if (cfg.record_stream) {
		var path = stream_path + Date.now() + '.ts';
		request.socket.recording = fs.createWriteStream(path);
	}
	
    console.log('Stream connected');
};
handleInputConnection();

// Output
var handleOutputConnection = function(){
	var app = false;
	if(cfg.ssl){
		app = https.createServer({
			key: fs.readFileSync(cfg.ssl_key),
			cert: fs.readFileSync(cfg.ssl_cert)
		}, onRequestOutput);
	}else{
		app = http.createServer(onRequestOutput);
	}
	app.headersTimeout = 0;
	app.listen(cfg.output_port, cfg.host);
		
	ws_output = new websocket.Server({server:app, perMessageDeflate:false});
	ws_output.on('connection', function(client){
		client.ip = client._socket.remoteAddress;
		client.isAlive = true; //ping check
		
		client.on('close', function(reasonCode, description){
			console.log('['+client.ip+'] closed.');
			process.title = "("+ws_output.clients.size+") Stream Server";
		});
		
		client.on('error', function(e){
			console.log('Erro, cliente desconectado: '+e);
			process.title = "("+ws_output.clients.size+") Stream Server";
		});
		
		client.on('pong', function(e){
			client.isAlive = true;
		});
		
		console.log('Client ['+client.ip+'] connected');
		process.title = "("+ws_output.clients.size+") Stream Server";
	});
	
	ws_output.broadcast = function(data) {
		ws_output.clients.forEach(function each(client){
			if(client.readyState === websocket.OPEN){
				client.send(data);
			}
		});
	};
};
handleOutputConnection();
var onRequestOutput = function(request,response){
    console.log('Client requesting connection');
	response.end();
};

var nop = function(){};
var pingInterval = setInterval(function ping(){
  ws_output.clients.forEach(function each(client){
    if(client.isAlive){
		client.isAlive = false;
		client.ping(nop);
	}else{
		console.log('Client ['+client.ip+'] close, no ping response');
		client.terminate();
	}
  });
}, 15000);

console.log('Listening for incomming MPEG-TS Stream');
console.log('Awaiting WebSocket connections');
