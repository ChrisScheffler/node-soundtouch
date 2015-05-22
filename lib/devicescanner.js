var Debug = require('debug'),
mdns = require('mdns'),
events = require('events'),
util = require('util'),
STDevice = require('./device');

var debug = Debug('deviceScanner');

if (!Array.prototype.removeAll) {
	Array.prototype.removeAll = function(key){
		var index = this.indexOf(key);
		if(index === -1) return;
		this.splice(index, 1);
		this.removeAll(key);
	}
}

function STDeviceScanner() {
	events.EventEmitter.call(this);
}
util.inherits(STDeviceScanner, events.EventEmitter);

STDeviceScanner.prototype.start = function start() {
	var _instance = this;
	var browser = mdns.createBrowser(mdns.tcp('soundtouch'));
	
	browser.on('serviceUp', function(service) {
		debug('found new device %s (%s)', service.name, service.addresses[0]);
		var newDevice = new STDevice(service.addresses[0]);
		_instance.emit('deviceFound', newDevice);
	});
	browser.on('serviceDown', function(service) {
		_instance.emit('deviceLost', service.addresses[0]);
	});
	debug('starting scanning');
	browser.start();
}

STDeviceScanner.prototype.stop = function stop() {
	debug('stopping scanning');
	browser.stop();
}
module.exports = STDeviceScanner;