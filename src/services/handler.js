'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');

function Handler(params) {
  params = params || {};
  let self = this;

  let LX = params.loggingFactory.getLogger();
  let LT = params.loggingFactory.getTracer();
  let packageName = params.packageName || 'app-restfront';
  let blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

  let pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  let contextPath = pluginCfg.contextPath || '/restfront';
  let mappings = require(pluginCfg.mappingStore);
  let sandboxRegistry = params['devebot/sandboxRegistry'];
  let tracelogService = params['app-tracelog/tracelogService'];
  let anchorIdName = pluginCfg.anchorIdName || 'anchorId'; 

  let getAnchorId = function(req) {
    req[anchorIdName] = req[anchorIdName] ||
        req.get(pluginCfg.anchorIdHeader) || req.query[anchorIdName];
    return req[anchorIdName];
  }

  let lookupMethod = function(serviceName, methodName) {
    let ref = {};
    let commander = sandboxRegistry.lookupService("app-opmaster/commander");
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
    let router = express.Router();
    lodash.forEach(mappings, function(mapping) {
      router.all(mapping.path, function(req, res, next) {
        let requestId = tracelogService.getRequestId(req);
        let reqTR = LT.branch({ key: 'requestId', value: requestId });
        LX.has('info') && LX.log('info', reqTR.add({
          mapAuthen: mapping.authenticate,
          mapPath: mapping.path,
          mapMethod: mapping.method,
          url: req.url,
          method: req.method
        }).toMessage({
          text: 'Request[${requestId}] from [${method}]${url}'
        }));
        if (req.method !== mapping.method) return next();

        let rpcData = mapping.transformRequest ? mapping.transformRequest(req) : req.body;

        let ref = lookupMethod(mapping.serviceName, mapping.methodName);
        let refMethod = ref && ref.method;
        if (lodash.isFunction(refMethod)) {
          let promize;
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
            let output = result;
            if (lodash.isFunction(mapping.transformResponse)) {
              output = mapping.transformResponse(result, req);
            }
            LX.has('trace') && LX.log('trace', reqTR.add({
              result: result,
              output: output
            }).toMessage({
              text: 'Request[${requestId}] is completed'
            }));
            res.json(output);
            return result;
          }).catch(function(failed) {
            var output = failed;
            if (lodash.isFunction(mapping.transformError)) {
              output = mapping.transformError(failed, req);
            }
            output.code = output.code || 500,
            output.text = output.text || 'Service request returns unknown status';
            LX.has('error') && LX.log('error', reqTR.add(output).toMessage({
              text: 'Request[${requestId}] has failed'
            }));
            res.status(output.code).json({
              code: output.code,
              message: output.text
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

Handler.referenceList = [
  "devebot/sandboxRegistry",
  "app-tracelog/tracelogService"
];

module.exports = Handler;
