'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const lodash = Devebot.require('lodash');
const Validator = require('schema-validator');

function Handler(params = {}) {
  const L = params.loggingFactory.getLogger();
  const T = params.loggingFactory.getTracer();
  const { sandboxRegistry, tracelogService } = params;
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  let serviceResolver = pluginCfg.serviceResolver || 'app-opmaster/commander';
  let serviceResolverAvailable = true;
  let mappings = require(pluginCfg.mappingStore);

  this.lookupMethod = function (serviceName, methodName) {
    let ref = {};
    if (serviceResolverAvailable) {
      let commander = sandboxRegistry.lookupService(serviceResolver);
      if (commander) {
        ref.isRemote = true;
        ref.service = commander.lookupService(serviceName);
        if (ref.service) {
          ref.method = ref.service[methodName];
        }
      } else {
        serviceResolverAvailable = false;
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
    const router = express.Router();
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
    const self = this;
    const router = express.Router();
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
        let reqData = mapping.transformRequest ? mapping.transformRequest(req) : req.body;

        let ref = self.lookupMethod(mapping.serviceName, mapping.methodName, reqOpts);
        let refMethod = ref && ref.method;
        if (lodash.isFunction(refMethod)) {
          let promize;
          if (ref.isRemote) {
            promize = refMethod(reqData, {
              requestId: requestId,
              timeout: pluginCfg.timeout,
              opflowSeal: "on"
            });
          } else {
            promize = Promise.resolve().then(function () {
              return refMethod(reqData, {
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
            L.has('trace') && L.log('trace', reqTR.add({ result, output }).toMessage({
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

Handler.referenceHash = {
  "sandboxRegistry": "devebot/sandboxRegistry",
  "tracelogService": "app-tracelog/tracelogService",
};

module.exports = Handler;
