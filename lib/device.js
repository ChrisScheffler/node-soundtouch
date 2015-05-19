/* imports */
var Promise = require('es6-promise').Promise,
	WebSocket = require('ws'),
	xml2js = require('xml2js'),
	Debug = require('debug'),
	events = require('events'),
	util = require('util');

const TIMEOUT_CONNECT = 5000;
const TIMEOUT_SEND = 5000;
const TIMEOUT_HEARTBEAT = 30000;
const INTERVAL_HEARTBEAT = 10000;

/* define loggers */
var debug = Debug('device');
var sendDebug = Debug('device:send');
var recvDebug = Debug('device:recv');

/* constructor */
function STDevice() {
	events.EventEmitter.call(this);
	this.messageEvents = new events.EventEmitter();
}

util.inherits(STDevice, events.EventEmitter);

/* -------------------- INFO GETTER -------------------- */

STDevice.prototype.connect = function connect(address) {
	debug('connecting to host [%s]', address);
	var _instance = this;
	var _lastMessage = Date.now();
	_instance.address =  address;

	var heartBeatFunc = function heartBeatFunc() {
		if (Date.now() - _lastMessage > TIMEOUT_HEARTBEAT) {
			debug('heartbeat timeout');
			_instance.ws.close();
			clearInterval(this);
			return;
		}
		debug('sending heartbeat');
		_instance.send('webserver/pingRequest');
	};


	return new Promise(function(resolve, reject) {
		_instance.ws = new WebSocket('ws://' + _instance.address + ':8080', 'gabbo');

		_instance.ws.on('error', function wsError(error) {
			debug('websocket error [%s]', error);
			if (events.listenerCount(_instance, 'error') > 0) {
				_instance.emit('error', error);
			}
			reject();
		});

		_instance.ws.on('open', function wsOpen() {
			_instance.heartBeatInterval = setInterval(heartBeatFunc, INTERVAL_HEARTBEAT);
			if (events.listenerCount(_instance, 'connected') > 0) {
				_instance.emit('connected');
			}
			resolve();
		});

		_instance.ws.on('close', function wsClose() {
			clearInterval(_instance.heartBeatInterval);
			if (events.listenerCount(_instance, 'closed') > 0) {
				_instance.emit('closed');
			}
		});
		
		_instance.ws.on('message', function wsMessage(data, flags) {
			xml2js.parseString(data, {explicitArray: false, mergeAttrs: true}, function(err, jsData) {
				if (err) {
					// TODO: ERROR HANDLING
				} else {
					recvDebug('received data %o', jsData);
					
					if (jsData.hasOwnProperty('info')) {
						_instance._handleInfo(jsData);
					}

					if (jsData.hasOwnProperty('nowPlaying')) {
						_instance._handlePlayInfo(jsData);
					}

					if (jsData.hasOwnProperty('volume')) {
						_instance._handleVolume(jsData);
					}

					_lastMessage = Date.now();
					clearInterval(_instance.heartBeatInterval);
					_instance.heartBeatInterval = setInterval(heartBeatFunc, INTERVAL_HEARTBEAT);
				}
			});
		});
	});
};

STDevice.prototype._handleInfo = function _handleInfo(data) {
	debug('received [info]');
	this.deviceInfo = data;
	if (events.listenerCount(this, 'deviceInfo')) {
		this.emit('deviceInfo', data);
	}
	this.messageEvents.emit('info', data);
}

STDevice.prototype._handlePlayInfo = function _handlePlayInfo(data) {
	debug('received [now_playing]');
	this.playInfo = data;
	if (events.listenerCount(this, 'playInfo')) {
		this.emit('playInfo', data);
	}
	this.messageEvents.emit('now_playing', data);
}

STDevice.prototype._handleVolume = function _handleVolume(data) {
	debug('received [volume]');
	this.volume = data;
	if (events.listenerCount(this, 'volume')) {
		this.emit('volume', data);
	}
	this.messageEvents.emit('volume', data);
}

STDevice.prototype._requestGeneric = function _requestGeneric(request) {
	var _instance = this;
	return new Promise(function(resolve, reject) {
		sendDebug('requesting [%s]', request);
		_instance.send(request).then(function() {
			_instance.messageEvents.once(request, function(data) {
				resolve(data);
			});
		}).catch(function(err) {
			reject(err);
		});
	});
};

STDevice.prototype.getInfo = function getInfo() {
	return this._requestGeneric('info');
}

STDevice.prototype.getPlayInfo = function getPlayInfo() {
	return this._requestGeneric('now_playing');
}

STDevice.prototype.getVolume = function getVolume() {
	return this._requestGeneric('volume');
}

STDevice.prototype.send = function send(data) {
	var _instance = this;
	return new Promise(function(resolve, reject) {
		_instance.ws.send(data, function ackSend(err) {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
};

module.exports = STDevice;
