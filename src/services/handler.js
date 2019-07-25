'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const Validator = require('schema-validator');
const uaParser = require('ua-parser-js');

const BUILTIN_MAPPING_LOADER = chores.isVersionLTE && chores.getVersionOf &&
    chores.isVersionLTE("0.3.1", chores.getVersionOf("devebot"));

function Handler(params = {}) {
  const L = params.loggingFactory.getLogger();
  const T = params.loggingFactory.getTracer();
  const { sandboxRegistry, tracelogService } = params;
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  const serviceResolver = pluginCfg.serviceResolver || 'app-opmaster/commander';

  let mappingHash;
  if (BUILTIN_MAPPING_LOADER) {
    mappingHash = params.mappingLoader.loadMappings(pluginCfg.mappingStore);
  } else {
    mappingHash = loadMappings(pluginCfg.mappingStore);
  }

  const mappings = joinMappings(mappingHash);

  let serviceSelector;
  if (lodash.isFunction(chores.newServiceSelector)) {
    serviceSelector = chores.newServiceSelector({ serviceResolver, sandboxRegistry });
  } else {
    serviceSelector = new function ServiceSelector(kwargs = {}) {
      const { serviceResolver, sandboxRegistry } = kwargs;
      let serviceResolverAvailable = true;
      this.lookupMethod = function (serviceName, methodName) {
        let ref = {};
        if (serviceResolverAvailable) {
          let resolver = sandboxRegistry.lookupService(serviceResolver);
          if (resolver) {
            ref.proxied = true;
            ref.service = resolver.lookupService(serviceName);
            if (ref.service) {
              ref.method = ref.service[methodName];
            }
          } else {
            serviceResolverAvailable = false;
          }
        }
        if (!ref.method) {
          ref.proxied = false;
          ref.service = sandboxRegistry.lookupService(serviceName);
          if (ref.service) {
            ref.method = ref.service[methodName];
          }
        }
        return ref;
      }
    } ({ serviceResolver, sandboxRegistry });
  }

  this.lookupMethod = function(serviceName, methodName) {
    return serviceSelector.lookupMethod(serviceName, methodName);
  }

  this.validator = function (express) {
    const router = express.Router();
    lodash.forEach(mappings, function (mapping) {
      if (mapping.validatorSchema) {
        router.all(mapping.path, function (req, res, next) {
          if (req.method !== mapping.method) return next();
          const requestId = tracelogService.getRequestId(req);
          const reqTR = T.branch({ key: 'requestId', value: requestId });
          L.has('info') && L.log('info', reqTR.add({
            mapPath: mapping.path,
            mapMethod: mapping.method,
            url: req.url,
            method: req.method,
            validatorSchema: mapping.validatorSchema
          }).toMessage({
            text: 'Validate for Req[${requestId}] from [${method}]${url} with schema [${validatorSchema}]'
          }, 'direct'));
          let validator = new Validator(mapping.validatorSchema);
          let check = validator.check(req.body);
          if (check._error) {
            check.isError = check._error;
            delete check._error;
            if (mapping.error && lodash.isFunction(mapping.error.transform)) {
              output = mapping.error.transform.call(mapping.error, check, req);
            }
            res.status(mapping.validatorSchema.statusCode || 400).send(check);
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
        if (req.method !== mapping.method) return next();
        const requestId = tracelogService.getRequestId(req);
        const segmentId = req.header(pluginCfg.segmentIdHeaderName);
        const reqTR = T.branch({ key: 'requestId', value: requestId });
        L.has('info') && L.log('info', reqTR.add({
          segmentId: segmentId,
          mapPath: mapping.path,
          mapMethod: mapping.method,
          url: req.url,
          method: req.method
        }).toMessage({
          text: 'Req[${requestId}] from [${method}]${url}'
        }, 'direct'));

        const ref = self.lookupMethod(mapping.serviceName, mapping.methodName);
        const refMethod = ref && ref.method;
        if (!lodash.isFunction(refMethod)) return next();

        let userAgent;
        if (pluginCfg.userAgentEnabled) {
          userAgent = uaParser(req.header('user-agent'));
        }

        const clientType = req.header(pluginCfg.clientTypeHeaderName);
        const clientVersion = req.header(pluginCfg.clientVersionHeaderName);
        const systemPhase = req.header(pluginCfg.systemPhaseHeaderName);

        const mockSuite = req.header(pluginCfg.mockSuiteHeaderName);
        const mockState = req.header(pluginCfg.mockStateHeaderName);

        const timeout = mapping.timeout || pluginCfg.requestTimeout;

        const reqOpts = {
          segmentId, requestId, timeout,
          clientType, clientVersion, systemPhase, mockSuite, mockState, userAgent
        };

        let promize = Promise.resolve();

        if (timeout && timeout > 0) {
          promize = promize.timeout(timeout);
        }

        promize = promize.then(function () {
          if (mapping.input && mapping.input.transform) {
            return mapping.input.transform.call(mapping.input, req, reqOpts);
          }
          return req.body;
        });

        if (mapping.input.mutate.rename) {
          prommize = promize.then(function (reqData) {
            return mutateRenameFields(reqData, mapping.input.mutate.rename);
          })
        }

        promize = promize.then(function (reqData) {
          return refMethod(reqData, reqOpts);
        });

        promize = promize.then(function (result) {
          let packet = { body: result };
          if (mapping.output && lodash.isFunction(mapping.output.transform)) {
            packet = mapping.output.transform.call(mapping.output, result, req, reqOpts);
            if (lodash.isEmpty(packet) || !("body" in packet)) {
              packet = { body: packet };
            }
          }
          if (mapping.output.mutate.rename) {
            packet = mutateRenameFields(packet, mapping.output.mutate.rename);
          }
          L.has('trace') && L.log('trace', reqTR.add({ result, packet }).toMessage({
            text: 'Req[${requestId}] is completed'
          }));
          if (lodash.isObject(packet.headers)) {
            lodash.forOwn(packet.headers, function (value, key) {
              res.set(key, value);
            });
          }
          res.json(packet.body);
        });

        promize = promize.catch(Promise.TimeoutError, function(err) {
          let packet = {};
          if (mapping.error && lodash.isFunction(mapping.error.transform)) {
            packet = mapping.error.transform.call(mapping.error, failed, req, reqOpts);
            packet = packet || {};
          }
          if (mapping.error.mutate.rename) {
            packet = mutateRenameFields(packet, mapping.error.mutate.rename);
          }
          packet.statusCode = packet.statusCode || 408;
          if (lodash.isObject(packet.headers)) {
            lodash.forOwn(packet.headers, function (value, key) {
              res.set(key, value);
            });
          }
          L.has('error') && L.log('error', reqTR.add(packet).toMessage({
            text: 'Req[${requestId}] has timeout'
          }));
          res.status(packet.statusCode).end();
        });

        promize = promize.catch(function (failed) {
          let packet = {};
          if (mapping.error && lodash.isFunction(mapping.error.transform)) {
            packet = mapping.error.transform.call(mapping.error, failed, req, reqOpts);
            packet = packet || {};
            packet.body = packet.body || {
              message: "mapping.error.transform() output don't have body field"
            }
          } else {
            if (failed == null) {
              packet.body = {
                message: 'Error is null'
              }
            } else if (failed instanceof Error) {
              packet.body = {
                code: failed.code,
                message: failed.message,
              }
              if (chores.isDevelopmentMode()) {
                packet.body = failed.stack;
              }
            } else if (lodash.isString(failed)) {
              packet.body = {
                message: failed
              }
            } else if (lodash.isObject(failed)) {
              packet.body = {
                message: 'Error: ' + JSON.stringify(failed),
                data: failed
              }
            } else {
              packet.body = {
                message: 'Error: ' + failed,
                data: failed
              }
            }
            packet.body.type = (typeof failed);
          }
          if (mapping.error.mutate.rename) {
            packet = mutateRenameFields(packet, mapping.error.mutate.rename);
          }
          packet.statusCode = packet.statusCode || 500;
          if (lodash.isObject(packet.headers)) {
            lodash.forOwn(packet.headers, function (value, key) {
              res.set(key, value);
            });
          }
          L.has('error') && L.log('error', reqTR.add(packet).toMessage({
            text: 'Req[${requestId}] has failed, status[${statusCode}], body: ${body}'
          }));
          if (lodash.isString(packet.body)) {
            res.status(packet.statusCode).text(packet.body);
          } else {
            res.status(packet.statusCode).json(packet.body);
          }
        });

        promize.finally(function () {
          L.has('silly') && L.log('silly', reqTR.toMessage({
            text: 'Req[${requestId}] end'
          }));
        });
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
  Handler.referenceHash["mappingLoader"] = "devebot/mappingLoader";
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
    const list = lodash.get(mappingList, 'apimaps', mappingList);
    if (lodash.isArray(list)) {
      mappings.push.apply(mappings, list);
    }
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
  mapping.input.mutate = mapping.input.mutate || {};
  // output ~ transformResponse
  mapping.output = mapping.output || {};
  if (!lodash.isFunction(mapping.output.transform)) {
    if (lodash.isFunction(mapping.transformResponse)) {
      mapping.output.transform = mapping.transformResponse;
      delete mapping.transformResponse;
    }
  }
  mapping.output.mutate = mapping.output.mutate || {};
  // error ~ transformError
  mapping.error = mapping.error || {};
  if (!lodash.isFunction(mapping.error.transform)) {
    if (lodash.isFunction(mapping.transformError)) {
      mapping.error.transform = mapping.transformError;
      delete mapping.transformError;
    }
  }
  mapping.error.mutate = mapping.error.mutate || {};
  return mapping;
}

function mutateRenameFields (payload, nameMappings) {
  if (nameMappings && lodash.isObject(nameMappings)) {
    for(const oldName in nameMappings) {
      const val = lodash.get(payload, oldName);
      if (!lodash.isUndefined(val)) {
        const newName = nameMappings[oldName];
        lodash.unset(payload, oldName);
        lodash.set(payload, newName, val);
      }
    }
  }
  return payload;
}