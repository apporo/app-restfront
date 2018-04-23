'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');

var Service = function(params) {
  params = params || {};
  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();
  var packageName = params.packageName || 'application';
  var blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});

  this.fibonacci = function(data, opts) {
    opts = opts || {};
    var reqTr = LT.branch({ key: 'requestId', value: opts.requestId || LT.getLogID()});
    LX.has('debug') && LX.log('debug', reqTr.add({
      data: data
    }).toMessage({
      tags: [ blockRef, 'fibonacci' ],
      text: ' - fibonacci[${requestId}] is invoked with parameters: ${data}'
    }));
    return data;
  }

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

module.exports = Service;
