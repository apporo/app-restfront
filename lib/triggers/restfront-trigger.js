'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('appRestfront:trigger');
var opflow = require('opflow');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});

  var rpcHandler = {};
  lodash.forOwn(pluginCfg.rpcMasters, function(rpcInfo, rpcName) {
    if (lodash.isObject(rpcInfo) && !lodash.isEmpty(rpcInfo) && rpcInfo.enabled != false) {
      rpcHandler[rpcName] = new opflow.RpcMaster(rpcInfo);
    }
  });

  Object.defineProperty(self, 'rpcHandler', {
    get: function() { return rpcHandler },
    set: function(val) {}
  });

  self.start = function() {
    return Promise.mapSeries(lodash.values(rpcHandler), function(rpc) {
      return rpc.ready();
    });
  };

  self.stop = function() {
    return Promise.mapSeries(lodash.values(rpcHandler), function(rpc) {
      return rpc.close();
    });
  };

  debugx.enabled && debugx(' - constructor end!');
};

module.exports = Service;
