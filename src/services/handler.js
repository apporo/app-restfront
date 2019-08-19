'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const nodash = Devebot.require('nodash');
const lodash = Devebot.require('lodash');
const Validator = require('schema-validator');
const uaParser = require('ua-parser-js');
const path = require('path');

const BUILTIN_MAPPING_LOADER = chores.isVersionLTE && chores.getVersionOf &&
    chores.isVersionLTE("0.3.1", chores.getVersionOf("devebot"));

function Handler(params = {}) {
  const { loggingFactory, sandboxRegistry, errorManager, tracelogService, mappingLoader } = params;
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const packageName = params.packageName || 'app-restfront';
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});

  let mappingHash;
  if (BUILTIN_MAPPING_LOADER) {
    mappingHash = mappingLoader.loadMappings(pluginCfg.mappingStore);
  } else {
    mappingHash = loadMappings(pluginCfg.mappingStore);
  }

  mappingHash = sanitizeMappings(mappingHash);

  const mappings = joinMappings(mappingHash);

  const swaggerBuilder = sandboxRegistry.lookupService('app-apispec/swaggerBuilder') ||
      sandboxRegistry.lookupService('app-restguide/swaggerBuilder');

  if (swaggerBuilder) {
    lodash.forOwn(mappingHash, function(mappingBundle, name) {
      if (mappingBundle.apiDocs) {
        swaggerBuilder.addApiEntries(mappingBundle.apiDocs);
      }
    });
  }

  const serviceResolver = pluginCfg.serviceResolver || 'app-opmaster/commander';
  const serviceSelector = chores.newServiceSelector({ serviceResolver, sandboxRegistry });

  const errorBuilder = errorManager.register(packageName, {
    errorCodes: pluginCfg.errorCodes
  });

  const CTX = { L, T, errorBuilder, serviceSelector, tracelogService, pluginCfg };

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
    const router = express.Router();
    lodash.forEach(mappings, function (mapping) {
      router.all(mapping.path, buildMiddlewareFromMapping(CTX, mapping));
    });
    return router;
  };
};

Handler.referenceHash = {
  "errorManager": 'app-errorlist/manager',
  "sandboxRegistry": "devebot/sandboxRegistry",
  "tracelogService": "app-tracelog/tracelogService"
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
  lodash.forOwn(mappingHash, function(mappingBundle, name) {
    const list = mappingBundle.apiMaps;
    if (lodash.isArray(list)) {
      mappings.push.apply(mappings, list);
    }
  });
  return mappings;
}

function sanitizeMappings (mappingHash, newMappings = {}) {
  lodash.forOwn(mappingHash, function(mappingList, name) {
    const apiPath = mappingList['apiPath'];
    newMappings[name] = newMappings[name] || {};
    // prefix the paths of middlewares by apiPath
    let list = mappingList.apiMaps || mappingList.apimaps || mappingList;
    if (lodash.isArray(list)) {
      if (lodash.isString(apiPath) && !lodash.isEmpty(apiPath)) {
        list = lodash.map(list, function(item) {
          if (lodash.isString(item.path)) {
            item.path = path.join(apiPath, item.path);
          }
          if (lodash.isArray(item.path)) {
            item.path = lodash.map(item.path, function(subpath) {
              return path.join(apiPath, subpath);
            });
          }
          return item;
        });
      }
      newMappings[name].apiMaps = upgradeMappings(list);
    }
    // prefix the paths of swagger entries by apiPath
    let swagger = mappingList.apiDocs || mappingList.swagger;
    if (swagger && swagger.paths && lodash.isObject(swagger.paths)) {
      if (lodash.isString(apiPath) && !lodash.isEmpty(apiPath)) {
        swagger.paths = lodash.mapKeys(swagger.paths, function(obj, key) {
          return path.join(apiPath, key);
        })
      }
    }
    newMappings[name].apiDocs = swagger;
  });
  return newMappings;
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
  // return the mapping
  return mapping;
}

function buildMiddlewareFromMapping(context, mapping) {
  const { L, T, errorBuilder, serviceSelector, tracelogService, pluginCfg } = context;

  const timeout = mapping.timeout || pluginCfg.defaultTimeout;

  const ref = serviceSelector.lookupMethod(mapping.serviceName, mapping.methodName);
  const refMethod = ref && ref.method;

  const requestOptions = lodash.merge({}, pluginCfg.requestOptions, mapping.requestOptions);

  return function (req, res, next) {
    if (req.method !== mapping.method) return next();
    const requestId = tracelogService.getRequestId(req);
    const reqTR = T.branch({ key: 'requestId', value: requestId });
    L.has('info') && L.log('info', reqTR.add({
      mapPath: mapping.path,
      mapMethod: mapping.method,
      url: req.url,
      method: req.method
    }).toMessage({
      text: 'Req[${requestId}] from [${method}]${url}'
    }, 'direct'));

    if (!lodash.isFunction(refMethod)) return next();

    let promize = Promise.resolve();

    if (timeout && timeout > 0) {
      promize = promize.timeout(timeout);
    }

    const failedReqOpts = [];
    const reqOpts = extractReqOpts(req, requestOptions, {
      userAgentEnabled: pluginCfg.userAgentEnabled,
      extensions: { requestId, timeout }
    }, failedReqOpts);

    if (failedReqOpts.length > 0) {
      promize = Promise.reject(errorBuilder.newError('RequestOptionNotFound', {
        payload: {
          requestOptions: failedReqOpts
        },
        language: reqOpts.languageCode
      }));
    }

    promize = promize.then(function () {
      if (mapping.input && mapping.input.transform) {
        return mapping.input.transform(req, reqOpts);
      }
      return req.body;
    });

    if (mapping.input.mutate.rename) {
      promize = promize.then(function (reqData) {
        return mutateRenameFields(reqData, mapping.input.mutate.rename);
      })
    }

    promize = promize.then(function (reqData) {
      return refMethod(reqData, reqOpts);
    });

    promize = promize.then(function (result) {
      let packet;
      if (mapping.output && lodash.isFunction(mapping.output.transform)) {
        packet = mapping.output.transform(result, req, reqOpts);
        if (lodash.isEmpty(packet) || !("body" in packet)) {
          packet = { body: packet };
        }
      } else {
        packet = { body: result };
      }
      packet = addDefaultHeaders(packet, pluginCfg.responseOptions);
      // rename the fields
      if (mapping.output.mutate.rename) {
        packet = mutateRenameFields(packet, mapping.output.mutate.rename);
      }
      // Render the packet
      renderPacketToResponse(packet, res);
      L.has('trace') && L.log('trace', reqTR.add(packet).toMessage({
        text: 'Req[${requestId}] is completed'
      }));
    });

    promize = promize.catch(Promise.TimeoutError, function(err) {
      L.has('error') && L.log('error', reqTR.add({
        timeout: reqOpts.timeout
      }).toMessage({
        text: 'Req[${requestId}] has timeout after ${timeout} seconds'
      }));
      return Promise.reject(errorBuilder.newError('RequestTimeoutError', {
        payload: {
          timeout: reqOpts.timeout
        },
        language: reqOpts.languageCode
      }));
    });

    promize = promize.catch(function (failed) {
      let packet = {};
      // transform error object to packet
      if (mapping.error && lodash.isFunction(mapping.error.transform)) {
        packet = mapping.error.transform(failed, req, reqOpts);
        packet = packet || {};
        packet.body = packet.body || {
          message: "mapping.error.transform() output don't have body field"
        }
      } else {
        if (failed instanceof Error) {
          packet = transformErrorDefault(failed, pluginCfg.responseOptions);
          if (chores.isDevelopmentMode()) {
            packet.body.stack = lodash.split(failed.stack, "\n");
          }
        } else {
          if (failed == null) {
            packet.body = {
              type: 'null',
              message: 'Error is null'
            }
          } else if (lodash.isString(failed)) {
            packet.body = {
              type: 'string',
              message: failed
            }
          } else if (lodash.isObject(failed)) {
            packet.body = {
              type: 'object',
              message: 'Error: ' + JSON.stringify(failed),
              data: failed
            }
          } else {
            packet.body = {
              type: (typeof failed),
              message: 'Error: ' + failed,
              data: failed
            }
          }
        }
      }
      // rename the fields
      if (mapping.error.mutate.rename) {
        packet = mutateRenameFields(packet, mapping.error.mutate.rename);
      }
      // Render the packet
      renderPacketToResponse(packet, res.status(packet.statusCode || 500));
      L.has('error') && L.log('error', reqTR.add(packet).toMessage({
        text: 'Req[${requestId}] has failed, status[${statusCode}], headers: ${headers}, body: ${body}'
      }));
    });

    promize.finally(function () {
      L.has('silly') && L.log('silly', reqTR.toMessage({
        text: 'Req[${requestId}] end'
      }));
    });
  }
}

function mutateRenameFields (obj, nameMappings) {
  if (nameMappings && lodash.isObject(nameMappings)) {
    for (const oldName in nameMappings) {
      const val = lodash.get(obj, oldName);
      if (!lodash.isUndefined(val)) {
        const newName = nameMappings[oldName];
        lodash.unset(obj, oldName);
        lodash.set(obj, newName, val);
      }
    }
  }
  return obj;
}

function addDefaultHeaders (packet, responseOptions) {
  packet.headers = packet.headers || {};
  const headerName = responseOptions['returnCode']['headerName'];
  if ((typeof headerName === 'string') && !(headerName in packet.headers)) {
    packet.headers[headerName] = 0;
  }
  return packet;
}

function transformErrorDefault (err, responseOptions) {
  const output = {
    statusCode: err.statusCode || 500,
    headers: {},
    body: {
      name: err.name,
      message: err.message
    }
  };
  lodash.forOwn(responseOptions, function(resOpt = {}, optionName) {
    if (optionName in err && lodash.isString(resOpt.headerName)) {
      output.headers[resOpt.headerName] = err[optionName];
    }
  });
  if (lodash.isObject(err.payload)) {
    output.body.payload = err.payload;
  }
  return output;
}

function extractReqOpts (req, requestOptions, opts = {}, errors) {
  const result = {};

  for (const optionKey in requestOptions) {
    let requestOption = requestOptions[optionKey];
    if (lodash.isString(requestOption)) {
      requestOption = { headerName: requestOption };
    }
    const optionName = requestOption.optionName || optionKey;
    const optionValue = req.get(requestOption.headerName);
    if (requestOption.required && lodash.isNil(optionValue)) {
      if (lodash.isArray(errors)) {
        errors.push(optionKey);
      }
    }
    result[optionName] = optionValue;
  }

  if (opts.userAgentEnabled) {
    result.userAgent = uaParser(req.get('User-Agent'));
  }

  for (const key in opts.extensions) {
    result[key] = opts.extensions[key];
  }

  return result;
}

function renderPacketToResponse_Standard (packet = {}, res) {
  if (lodash.isObject(packet.headers)) {
    lodash.forOwn(packet.headers, function (value, key) {
      res.set(key, value);
    });
  }
  if (lodash.isNil(packet.body)) {
    res.end();
  } else {
    if (lodash.isString(packet.body)) {
      res.text(packet.body);
    } else {
      res.json(packet.body);
    }
  }
}

function renderPacketToResponse_Optimized (packet = {}, res) {
  // affected with JSON, array, string
  if (nodash.isObject(packet.headers)) {
    for (const key in packet.headers) {
      res.set(key, packet.headers[key]);
    }
  }
  if (packet.body === undefined || packet.body === null) {
    res.end();
  } else {
    if (typeof packet.body === 'string') {
      res.text(packet.body);
    } else {
      res.json(packet.body);
    }
  }
}

let renderPacketToResponse = renderPacketToResponse_Standard;

if (chores.isUpgradeSupported('optimization-mode')) {
  renderPacketToResponse = renderPacketToResponse_Optimized;
}
