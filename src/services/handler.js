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
  var packageName = params.packageName || 'app-restfront';
  var blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  var contextPath = pluginCfg.contextPath || '/restfront';
  var mappings = require(pluginCfg.mappingStore);
  var sandboxRegistry = params['devebot/sandboxRegistry'];
  var tracelogService = params['tracelogService'];

  var lookupMethod = function(serviceName, methodName) {
    var ref = {};
    var commander = sandboxRegistry.lookupService("app-opmaster/commander");
    if (commander) {
      ref.isRemote = true;
      ref.service = commander.lookupService(serviceName);
      if (ref.service) {
        ref.method = ref.service[methodName];
      }
    }
    if (!ref.method) {
      ref.isRemote = false;
      ref.service = sandboxRegistry.lookupService(serviceName);
      if (ref.service) {
        ref.method = ref.service[methodName];
      }
    }
    return ref;
  }

  self.buildRestRouter = function(express) {
    var router = express.Router();
    lodash.forEach(mappings, function(mapping) {
      router.all(mapping.path, function(req, res, next) {
        var requestId = tracelogService.getRequestId(req);
        var reqTR = LT.branch({ key: 'requestId', value: requestId });
        LX.isEnabledFor('info') && LX.log('info', reqTR.add({
          mapAuthen: mapping.authenticate,
          mapPath: mapping.path,
          mapMethod: mapping.method,
          url: req.url,
          method: req.method
        }).toMessage({
          text: 'received API request [${method}]${url}'
        }));
        if (req.method !== mapping.method) return next();

        var rpcData = mapping.transformRequest ? mapping.transformRequest(req) : req.body;

        var ref = lookupMethod(mapping.serviceName, mapping.methodName);
        var refMethod = ref && ref.method;
        if (lodash.isFunction(refMethod)) {
          var promize;
          if (ref.isRemote) {
            promize = refMethod(rpcData, {
              requestId: requestId,
              timeout: pluginCfg.opflowTimeout,
              opflowSeal: "on"
            });
          } else {
            promize = Promise.resolve().then(function() {
              return refMethod(rpcData, {
                requestId: requestId
              });
            });
          }
          return promize.then(function(result) {
            LX.isEnabledFor('trace') && LX.log('trace', reqTR.add({
              resultStatus: result.status
            }).toMessage({
              text: 'RPC result'
            }));
            res.json(result);
            return result;
          }).catch(function(failed) {
            LX.isEnabledFor('error') && LX.log('error', reqTR.add({
              errorCode: failed.code || '500',
              errorMessage: failed.text || 'Service request returns unknown status'
            }).toMessage({
              text: 'Request is failed'
            }));
            res.status(400).json({
              code: failed.code || '500',
              message: failed.text || 'Service request returns unknown status'
            });
          });
        } else {
          next();
        }
      });
    });
    return router;
  };

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

Service.referenceList = ["devebot/sandboxRegistry", "tracelogService"];

module.exports = Service;
