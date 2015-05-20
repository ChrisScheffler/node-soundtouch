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

STDevice.prototype.connect = function connect(address) {
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
		debug('connecting to host [%s]', address);
		_instance.ws = new WebSocket('ws://' + _instance.address + ':8080', 'gabbo');

		_instance.ws.on('error', function wsError(error) {
			debug('websocket error [%s]', error);
			_instance.maybeEmit('error', error);
			reject();
		});

		_instance.ws.on('open', function wsOpen() {
			_instance.heartBeatInterval = setInterval(heartBeatFunc, INTERVAL_HEARTBEAT);
			_instance.maybeEmit('connected');
			resolve();
		});

		_instance.ws.on('close', function wsClose() {
			clearInterval(_instance.heartBeatInterval);
			_instance.maybeEmit('closed');
		});

		_instance.ws.on('message', function wsMessage(data, flags) {
			xml2js.parseString(data, {explicitArray: false, mergeAttrs: true}, function(err, jsData) {
				if (err) {
					// TODO: ERROR HANDLING
				} else {
					recvDebug('received data %o', jsData);
					
					if (jsData.hasOwnProperty('info')) {
						_instance._handleDeviceInfo(jsData);
					}

					if (jsData.hasOwnProperty('nowPlaying')) {
						_instance._handlePlayInfo(jsData);
					}

					if (jsData.hasOwnProperty('bass')) {
						_instance._handleBassInfo(jsData);
					}

					if (jsData.hasOwnProperty('bassCapabilities')) {
						_instance._handleBassCaps(jsData);
					}

					if (jsData.hasOwnProperty('volume')) {
						_instance._handleVolume(jsData);
					}

					if (jsData.hasOwnProperty('presets')) {
						_instance._handlePresets(jsData);
					}

					if (jsData.hasOwnProperty('sources')) {
						_instance._handleSources(jsData);
					}

					if (jsData.hasOwnProperty('zone')) {
						_instance._handleZone(jsData);
					}

					if (jsData.hasOwnProperty('trackInfo')) {
						_instance._handleTrackInfo(jsData);
					}

					_lastMessage = Date.now();
					clearInterval(_instance.heartBeatInterval);
					_instance.heartBeatInterval = setInterval(heartBeatFunc, INTERVAL_HEARTBEAT);
				}
			});
});
});
};

STDevice.prototype.maybeEmit = function maybeEmit(event, arg) {
	if (events.listenerCount(this, event) > 0) {
		this.emit(event, arg);
	}
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


STDevice.prototype._handleDeviceInfo = function _handleDeviceInfo(data) {
	debug('received [info]');
	this.deviceInfo = data;
	this.maybeEmit('deviceInfo', data);
	this.messageEvents.emit('info', data);
}

STDevice.prototype._handlePlayInfo = function _handlePlayInfo(data) {
	debug('received [now_playing]');
	this.playInfo = data;
	this.maybeEmit('playInfo', data);
	this.messageEvents.emit('now_playing', data);
}

STDevice.prototype._handleBassInfo = function _handleBassInfo(data) {
	debug('received [bass]');
	this.bassInfo = data;
	this.maybeEmit('bass', data);
	this.messageEvents.emit('bass', data);
}

STDevice.prototype._handleBassCaps = function _handleBassCaps(data) {
	debug('received [bassCapabilities]');
	this.bassCapabilities = data;
	this.maybeEmit('bassCaps', data);
	this.messageEvents.emit('bassCapabilities', data);
}

STDevice.prototype._handleVolume = function _handleVolume(data) {
	debug('received [volume]');
	this.volume = data;
	this.maybeEmit('volume', data);
	this.messageEvents.emit('volume', data);
}

STDevice.prototype._handlePresets = function _handlePresets(data) {
	debug('received [presets]');
	this.presets = data;
	this.maybeEmit('presets', data);
	this.messageEvents.emit('presets', data);
}

STDevice.prototype._handleSources = function _handleSources(data) {
	debug('received [sources]');
	this.sources = data;
	this.maybeEmit('sources', data);
	this.messageEvents.emit('sources', data);
}

STDevice.prototype._handleZone = function _handleZone(data) {
	debug('received [zone]');
	this.zoneInfo = data;
	this.maybeEmit('zone', data);
	this.messageEvents.emit('getZone', data);
}

STDevice.prototype._handleTrackInfo = function _handleTrackInfo(data) {
	debug('received [trackInfo]');
	this.trackInfo = data;
	this.maybeEmit('trackInfo', data);
	this.messageEvents.emit('trackInfo', data);
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

/* -------------------- INFO GETTER -------------------- */

STDevice.prototype.getInfo = function getInfo() {
	return this._requestGeneric('info');
}

STDevice.prototype.getPlayInfo = function getPlayInfo() {
	return this._requestGeneric('now_playing');
}

STDevice.prototype.getBassInfo = function getBassInfo() {
	return this._requestGeneric('bass');
}

STDevice.prototype.getBassCapabilities = function getBassCapabilities() {
	return this._requestGeneric('bassCapabilities');
}

STDevice.prototype.getVolume = function getVolume() {
	return this._requestGeneric('volume');
}

STDevice.prototype.getSources = function getSources() {
	return this._requestGeneric('sources');
}

STDevice.prototype.getZone = function getZone() {
	return this._requestGeneric('getZone');
}

STDevice.prototype.getTrackInfo = function getTrackInfo() {
	return this._requestGeneric('trackInfo');
}

STDevice.prototype.updateAll = function updateAll() {
	_instance = this;
	return Promise.all([
		_instance.getInfo(),
		_instance.getPlayInfo(),
		_instance.getBassCapabilities(),
		_instance.getBassInfo(),
		_instance.getVolume(),
		_instance.getSources(),
		_instance.getZone(),
		_instance.getTrackInfo()]);
}

module.exports = {
	'STDevice': STDevice
}
