  'use strict';

var Devebot = require('devebot');
var Promise = Devebot.require('bluebird');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('app-restfront:handler');
var fs = require('fs');
var path = require('path');

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
  var contextPath = pluginCfg.contextPath || '/restfront';
  var mappings = require(pluginCfg.mappingStore);
  var rpcHandler = params.restfrontTrigger.rpcHandler;

  self.buildRestRouter = function(express) {
    var router = express.Router();

    lodash.forEach(mappings, function(mapping) {
      router.all(mapping.path, function(req, res, next) {
        var requestId = params.tracelogService.getRequestId(req);
        var reqTR = LT.branch({ key: 'requestId', value: requestId });
        LX.isEnabledFor('info') && LX.log('info', reqTR.add({
          message: 'received API request',
          mapAuthen: mapping.authenticate,
          mapPath: mapping.path,
          mapMethod: mapping.method,
          url: req.url,
          method: req.method
        }).toMessage());
        debugx.enabled && debugx(' - received request: url: %s, method: %s, body: %s',
          req.url, req.method, JSON.stringify(req.body));
        if (req.method !== mapping.method) return next();
        var flow = Promise.resolve(true);
        flow.then(function(continued) {
          if (!continued) return false;
          var rpcPayload = mapping.transformRequest ? mapping.transformRequest(req) : req.body;
          debugx.enabled && debugx(' - RPC payload: %s', JSON.stringify(rpcPayload));
          return rpcHandler[mapping.rpcName].request(mapping.routineId, rpcPayload, {
            timeout: pluginCfg.opflowTimeout,
            requestId: requestId
          }).then(function(task) {
            return task.extractResult();
          }).then(function(result) {
            LX.isEnabledFor('info') && LX.log('info', reqTR.add({
              message: 'RPC result',
              resultStatus: result.status
            }).toMessage({reset: true}));
            switch(result.status) {
              case 'timeout':
                res.status(408).json({
                  code: '5000',
                  message: 'Service request has been timeout'
                });
                return true;
              case 'failed':
                res.status(412).json({
                  code: '4120',
                  message: 'Service request has been failed'
                });
                return true;
              case 'completed':
                res.json(result.value);
                return true;
            }
            LX.isEnabledFor('error') && LX.log('error', reqTR.add({
              message: 'RPC status not found'
            }).toMessage());
            res.status(404).json({
              code: '5001',
              message: 'Service request returns unknown status'
            });
            return false;
          });
        }).catch(function(error) {
          LX.isEnabledFor('error') && LX.log('error', reqTR.add({
            message: 'Request is failed',
            errorCode: error.code || '5001',
            errorMessage: error.message || 'Service request returns unknown status'
          }).toMessage());
          res.status(400).json({
            code: error.code || '5001',
            message: error.message || 'Service request returns unknown status'
          });
        });
      });
    });

    return router;
  };

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

Service.referenceList = [ "restfrontTrigger", "tracelogService" ];

module.exports = Service;
