'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const lodash = Devebot.require('lodash');
const Validator = require('schema-validator');

function Handler(params) {
  params = params || {};

  let L = params.loggingFactory.getLogger();
  let T = params.loggingFactory.getTracer();

  let pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  let contextPath = pluginCfg.contextPath || '/restfront';
  let anchorIdName = pluginCfg.anchorIdName || 'anchorId';
  let mappings = require(pluginCfg.mappingStore);
  let sandboxRegistry = params['devebot/sandboxRegistry'];
  let tracelogService = params['app-tracelog/tracelogService'];

  let getAnchorId = function (req) {
    req[anchorIdName] = req[anchorIdName] ||
      req.get(pluginCfg.anchorIdHeader) || req.query[anchorIdName];
    return req[anchorIdName];
  }

  this.lookupMethod = function (serviceName, methodName) {
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

  this.validator = function (express) {
    let router = express.Router();
    lodash.forEach(mappings, function (mapping) {
      if (mapping.validatorSchema) {
        router.all(mapping.path, function (req, res, next) {
          let requestId = tracelogService.getRequestId(req);
          let reqTR = T.branch({ key: 'requestId', value: requestId });
          L.has('info') && L.log('info', reqTR.add({
            mapAuthen: mapping.authenticate,
            mapPath: mapping.path,
            mapMethod: mapping.method,
            url: req.url,
            method: req.method,
            validatorSchema: mapping.validatorSchema
          }).toMessage({
            text: 'Validate for Request[${requestId}] from [${method}]${url} with schema is [${validatorSchema}]'
          }, 'direct'));

          if (req.method !== mapping.method) return next();

          let validator = new Validator(mapping.validatorSchema);
          let check = validator.check(req.body);
          if (check._error) {
            check.isError = check._error;
            delete check._error;
            if (lodash.isFunction(mapping.transformError)) {
              output = mapping.transformError(check, req);
            }
            res.send(mapping.validatorSchema.statusCode || 400, check);
          } else {
            next();
          }
        });
      }
    });
    return router;
  }

  this.buildRestRouter = function (express) {
    let self = this;
    let router = express.Router();
    lodash.forEach(mappings, function (mapping) {
      router.all(mapping.path, function (req, res, next) {
        let requestId = tracelogService.getRequestId(req);
        let reqTR = T.branch({ key: 'requestId', value: requestId });
        L.has('info') && L.log('info', reqTR.add({
          mapAuthen: mapping.authenticate,
          mapPath: mapping.path,
          mapMethod: mapping.method,
          url: req.url,
          method: req.method
        }).toMessage({
          text: 'Request[${requestId}] from [${method}]${url}'
        }, 'direct'));
        if (req.method !== mapping.method) return next();

        let reqOpts = { requestId: requestId };
        let rpcData = mapping.transformRequest ? mapping.transformRequest(req) : req.body;

        let ref = self.lookupMethod(mapping.serviceName, mapping.methodName, reqOpts);
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
            promize = Promise.resolve().then(function () {
              return refMethod(rpcData, {
                requestId: requestId
              });
            });
          }
          return promize.then(function (result) {
            let output = { body: result };
            if (lodash.isFunction(mapping.transformResponse)) {
              output = mapping.transformResponse(result, req);
              if (lodash.isEmpty(output) || !("body" in output)) {
                output = { body: output };
              }
            }
            L.has('trace') && L.log('trace', reqTR.add({
              result: result,
              output: output
            }).toMessage({
              text: 'Request[${requestId}] is completed'
            }));
            if (lodash.isObject(output.headers)) {
              lodash.forOwn(output.headers, function (value, key) {
                res.set(key, value);
              });
            }
            res.json(output.body);
            return result;
          }).catch(function (failed) {
            var output = failed;
            if (lodash.isFunction(mapping.transformError)) {
              output = mapping.transformError(failed, req);
            }
            output.code = output.code || 500,
              output.text = output.text || 'Service request returns unknown status';
            L.has('error') && L.log('error', reqTR.add(output).toMessage({
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
};

Handler.referenceList = [
  "devebot/sandboxRegistry",
  "app-tracelog/tracelogService"
];

module.exports = Handler;
