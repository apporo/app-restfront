'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const Validator = require('schema-validator');

const BUILTIN_MAPPING_LOADER = chores.isVersionLTE && chores.getVersionOf &&
    chores.isVersionLTE("0.3.1", chores.getVersionOf("devebot"));

function Handler(params = {}) {
  const L = params.loggingFactory.getLogger();
  const T = params.loggingFactory.getTracer();
  const { sandboxRegistry, tracelogService } = params;
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  let serviceResolver = pluginCfg.serviceResolver || 'app-opmaster/commander';
  let serviceResolverAvailable = true;

  let mappingHash;
  if (BUILTIN_MAPPING_LOADER) {
    mappingHash = params.mappingLoader.loadMappings(pluginCfg.mappingStore);
  } else {
    mappingHash = loadMappings(pluginCfg.mappingStore);
  }

  const mappings = joinMappings(mappingHash);

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
          const requestId = tracelogService.getRequestId(req);
          const reqTR = T.branch({ key: 'requestId', value: requestId });
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
            if (mapping.error && lodash.isFunction(mapping.error.transform)) {
              output = mapping.error.transform(check, req);
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
        const requestId = tracelogService.getRequestId(req);
        const reqTR = T.branch({ key: 'requestId', value: requestId });
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

        const mockSuite = req.header('X-Mock-Suite');
        const mockState = req.header('X-Mock-State');

        const reqOpts = { requestId, mockSuite, mockState, timeout: pluginCfg.timeout };
        let reqData = req.body;
        if (mapping.input && mapping.input.transform) {
          reqData = mapping.input.transform(req);
        }

        let ref = self.lookupMethod(mapping.serviceName, mapping.methodName, reqOpts);
        let refMethod = ref && ref.method;
        if (lodash.isFunction(refMethod)) {
          let promize;
          if (ref.isRemote) {
            promize = refMethod(reqData, reqOpts);
          } else {
            promize = Promise.resolve().then(function () {
              return refMethod(reqData, reqOpts);
            });
          }
          return promize.then(function (result) {
            let output = { body: result };
            if (mapping.output && lodash.isFunction(mapping.output.transform)) {
              output = mapping.output.transform(result, req);
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
            if (mapping.error && lodash.isFunction(mapping.error.transform)) {
              output = mapping.error.transform(failed, req);
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

if (BUILTIN_MAPPING_LOADER) {
  Handler.referenceHash = {
    "mappingLoader": "devebot/mappingLoader",
    "sandboxRegistry": "devebot/sandboxRegistry",
    "tracelogService": "app-tracelog/tracelogService",
  };
}

module.exports = Handler;

function loadMappings (mappingStore) {
  const mappingHash = {};
  if (lodash.isString(mappingStore)) {
    let store = {};
    store[chores.getUUID()] = mappingStore;
    mappingStore = store;
  }
  if (lodash.isObject(mappingStore)) {
    lodash.forOwn(mappingStore, function(path, name) {
      mappingHash[name] = require(path);
    });
  }
  return mappingHash;
}

function joinMappings (mappingHash, mappings = []) {
  lodash.forOwn(mappingHash, function(mappingList, name) {
    mappings.push.apply(mappings, mappingList);
  });
  return upgradeMappings(mappings);
}

function upgradeMappings(mappings = []) {
  return lodash.map(mappings, upgradeMapping);
}

function upgradeMapping(mapping = {}) {
  // input ~ transformRequest
  mapping.input = mapping.input || {};
  if (!lodash.isFunction(mapping.input.transform)) {
    if (lodash.isFunction(mapping.transformRequest)) {
      mapping.input.transform = mapping.transformRequest;
      delete mapping.transformRequest;
    }
  }
  // output ~ transformResponse
  mapping.output = mapping.output || {};
  if (!lodash.isFunction(mapping.output.transform)) {
    if (lodash.isFunction(mapping.transformResponse)) {
      mapping.output.transform = mapping.transformResponse;
      delete mapping.transformResponse;
    }
  }
  // error ~ transformError
  mapping.error = mapping.error || {};
  if (!lodash.isFunction(mapping.error.transform)) {
    if (lodash.isFunction(mapping.transformError)) {
      mapping.error.transform = mapping.transformError;
      delete mapping.transformError;
    }
  }
  return mapping;
}
