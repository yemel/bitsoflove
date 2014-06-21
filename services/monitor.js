var request = require('request');
var config = require('../config.js');


var REGISTER_URL = 'http://www.bitcoinmonitor.net/api/v1/agent/<agent>/address/';

function register(address, callback) {
  var options = {
    url: REGISTER_URL.replace('<agent>', config.MONITOR_USER_PAYMENTS),
    headers: {Authorization: config.MONITOR_KEY},
    form: {address: address}
  };

  request.post(options, callback);
}

exports.register = register;