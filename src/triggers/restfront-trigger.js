'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('app-restfront:trigger');
var opflow = require('opflow');

var Service = function(params) {
  params = params || {};
  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();
  var packageName = params.packageName || 'app-restfront';
  var blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

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

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

module.exports = Service;
