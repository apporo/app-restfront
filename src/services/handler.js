'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const Validator = require('schema-validator');
const uaParser = require('ua-parser-js');
const path = require('path');

function Handler(params = {}) {
  const { loggingFactory, packageName, sandboxConfig } = params;
  const { sandboxRegistry, errorManager, tracelogService, mappingLoader, schemaValidator } = params;
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();

  const mappingHash = sanitizeMappings(mappingLoader.loadMappings(sandboxConfig.mappingStore));

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

  const serviceResolver = sandboxConfig.serviceResolver || 'app-opmaster/commander';
  const serviceSelector = chores.newServiceSelector({ serviceResolver, sandboxRegistry });

  const errorBuilder = errorManager.register(packageName, {
    errorCodes: sandboxConfig.errorCodes
  });

  const CTX = { L, T, errorManager, errorBuilder, serviceSelector, tracelogService, sandboxConfig, schemaValidator };

  this.validator = function (express) {
    const router = express.Router();
    lodash.forEach(mappings, function (mapping) {
      if (mapping.validatorSchema) {
        router.all(mapping.path, function (req, res, next) {
          if (!isMethodIncluded(mapping.method, req.method)) {
            return next();
          }
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
  errorManager: "app-errorlist/manager",
  mappingLoader: "devebot/mappingLoader",
  sandboxRegistry: "devebot/sandboxRegistry",
  schemaValidator: "devebot/schemaValidator",
  tracelogService: "app-tracelog/tracelogService"
};

module.exports = Handler;

function joinMappings (mappingHash, mappings = []) {
  lodash.forOwn(mappingHash, function(mappingBundle, mappingName) {
    const list = mappingBundle.apiMaps;
    if (lodash.isArray(list)) {
      mappings.push.apply(mappings, lodash.map(list, function(item) {
        item.errorSource = item.errorSource || mappingName;
        return item;
      }));
    }
  });
  return mappings;
}

function sanitizeMappings (mappingHash, newMappings = {}) {
  lodash.forOwn(mappingHash, function(mappingList, name) {
    mappingList = mappingList || {};
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
  if (!lodash.isFunction(mapping.input.preValidator)) {
    delete mapping.input.preValidator;
  }
  if (!lodash.isFunction(mapping.input.transform)) {
    delete mapping.input.transform;
    if (lodash.isFunction(mapping.transformRequest)) {
      mapping.input.transform = mapping.transformRequest;
      delete mapping.transformRequest;
    }
  }
  if (!lodash.isFunction(mapping.input.postValidator)) {
    delete mapping.input.postValidator;
  }
  mapping.input.mutate = mapping.input.mutate || {};
  // inlet - manual processing
  mapping.inlet = mapping.inlet || {};
  if (!lodash.isFunction(mapping.inlet.process)) {
    delete mapping.inlet.process;
  }
  // output ~ transformResponse
  mapping.output = mapping.output || {};
  if (!lodash.isFunction(mapping.output.transform)) {
    delete mapping.output.transform;
    if (lodash.isFunction(mapping.transformResponse)) {
      mapping.output.transform = mapping.transformResponse;
      delete mapping.transformResponse;
    }
  }
  mapping.output.mutate = mapping.output.mutate || {};
  // error ~ transformError
  mapping.error = mapping.error || {};
  if (!lodash.isFunction(mapping.error.transform)) {
    delete mapping.error.transform;
    if (lodash.isFunction(mapping.transformError)) {
      mapping.error.transform = mapping.transformError;
      delete mapping.transformError;
    }
  }
  mapping.error.mutate = mapping.error.mutate || {};
  // return the mapping
  return mapping;
}

function isMethodIncluded(methods, reqMethod) {
  if (reqMethod && lodash.isString(reqMethod)) {
    reqMethod = reqMethod.toUpperCase();
    if (methods) {
      if (lodash.isString(methods)) {
        return reqMethod === methods.toUpperCase();
      }
      if (lodash.isArray(methods)) {
        return lodash.some(methods, function(item) {
          return item && (reqMethod === item.toUpperCase());
        });
      }
    }
  }
  return false;
}

function buildMiddlewareFromMapping(context, mapping) {
  const { L, T, errorManager, errorBuilder, serviceSelector, tracelogService, sandboxConfig, schemaValidator } = context;

  const timeout = mapping.timeout || sandboxConfig.defaultTimeout;

  const ref = serviceSelector.lookupMethod(mapping.serviceName, mapping.methodName);
  const refMethod = ref && ref.method;

  const requestOptions = lodash.merge({}, sandboxConfig.requestOptions, mapping.requestOptions);
  const responseOptions = Object.assign({}, sandboxConfig.responseOptions, mapping.responseOptions);

  const mappingErrorBuilder = errorManager.getErrorBuilder(mapping.errorSource) || errorBuilder;

  const BusinessError = errorManager.BusinessError;

  const services = { logger: L, tracer: T, BusinessError, errorBuilder: mappingErrorBuilder, schemaValidator };

  return function (req, res, next) {
    if (!isMethodIncluded(mapping.method, req.method)) {
      return next();
    }
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
    const reqOpts = extractRequestOptions(req, requestOptions, {
      userAgentEnabled: sandboxConfig.userAgentEnabled,
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

    if (mapping.input.enabled !== false && mapping.input.preValidator) {
      promize = promize.then(function () {
        return applyValidator(mapping.input.preValidator, {
          errorBuilder: errorBuilder,
          errorName: 'RequestPreValidationError'
        }, req, reqOpts, services);
      });
    }

    promize = promize.then(function () {
      if (mapping.input.enabled !== false && mapping.input.transform) {
        return mapping.input.transform(req, reqOpts, services);
      }
      return req.body;
    });

    if (mapping.input.enabled !== false && mapping.input.mutate.rename) {
      promize = promize.then(function (reqData) {
        return mutateRenameFields(reqData, mapping.input.mutate.rename);
      })
    }

    if (mapping.input.enabled !== false && mapping.input.postValidator) {
      promize = promize.then(function (reqData) {
        return applyValidator(mapping.input.postValidator, {
          errorBuilder: errorBuilder,
          errorName: 'RequestPostValidationError'
        }, reqData, reqOpts, services);
      });
    }

    if (mapping.inlet.process) {
      promize = promize.then(function (reqData) {
        return mapping.inlet.process(refMethod, res, reqData, reqOpts, services);
      });
    } else {
      promize = promize.then(function (reqData) {
        return refMethod(reqData, reqOpts);
      });

      promize = promize.then(function (result) {
        let packet;
        if (mapping.output.enabled !== false && mapping.output.transform) {
          packet = mapping.output.transform(result, req, reqOpts, services);
          if (lodash.isEmpty(packet) || !("body" in packet)) {
            packet = { body: packet };
          }
        } else {
          packet = { body: result };
        }
        packet = addDefaultHeaders(packet, responseOptions);
        // rename the fields
        if (mapping.output.enabled !== false && mapping.output.mutate.rename) {
          packet = mutateRenameFields(packet, mapping.output.mutate.rename);
        }
        // Render the packet
        renderPacketToResponse(packet, res);
        L.has('trace') && L.log('trace', reqTR.add(packet).toMessage({
          text: 'Req[${requestId}] is completed'
        }));
      });
    }

    promize = promize.catch(Promise.TimeoutError, function() {
      L.has('error') && L.log('error', reqTR.add({
        timeout: reqOpts.timeout
      }).toMessage({
        text: 'Req[${requestId}] has timeout after ${timeout} seconds'
      }));
      return Promise.reject(errorBuilder.newError('RequestTimeoutOnServer', {
        payload: {
          timeout: reqOpts.timeout
        },
        language: reqOpts.languageCode
      }));
    });

    if (chores.isUpgradeSupported('app-restfront-legacy-error-to-response')) {
      promize = promize.catch(function (failed) {
        let packet = {};
        // transform error object to packet
        if (mapping.error.enabled !== false && mapping.error.transform) {
          packet = mapping.error.transform(failed, req, reqOpts, services);
          packet = packet || {};
          packet.body = packet.body || {
            message: "mapping.error.transform() output don't have body field"
          }
        } else {
          if (failed instanceof Error) {
            packet = transformErrorObject(failed, responseOptions);
            if (chores.isDevelopmentMode()) {
              packet.body.stack = lodash.split(failed.stack, "\n");
            }
          } else {
            packet = transformScalarError(failed, responseOptions, packet);
          }
        }
        // rename the fields
        if (mapping.error.enabled !== false && mapping.error.mutate.rename) {
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

      return;
    }

    promize = promize.catch(function (failed) {
      let packet = {};
      // apply the explicit transform function
      if (mapping.error.enabled !== false && mapping.error.transform) {
        failed = mapping.error.transform(failed, req, reqOpts, services);
      }
      // transform error object to packet
      if (failed instanceof Error) {
        packet = transformErrorObject(failed, responseOptions);
        if (chores.isDevelopmentMode()) {
          packet.body.stack = lodash.split(failed.stack, "\n");
        }
      } else {
        packet = transformScalarError(failed, responseOptions, packet);
      }
      // rename the fields
      if (mapping.error.enabled !== false && mapping.error.mutate.rename) {
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

function applyValidator (validator, defaultRef, reqData, reqOpts, services) {
  return Promise.resolve(validator(reqData, reqOpts, services))
  .then(function (result) {
    if (!isPureObject(result)) {
      result = { valid: result }
    }
    if (result.valid === false) {
      if (result.errorName && services.errorBuilder) {
        return Promise.reject(services.errorBuilder.newError(result.errorName, {
          payload: {
            errors: result.errors
          }
        }));
      }
      return Promise.reject(defaultRef.errorBuilder.newError(defaultRef.errorName, {
        payload: {
          errors: result.errors
        }
      }));
    }
    return reqData;
  });
}

function addDefaultHeaders (packet, responseOptions) {
  packet.headers = packet.headers || {};
  const headerName = responseOptions['returnCode']['headerName'];
  if ((typeof headerName === 'string') && !(headerName in packet.headers)) {
    packet.headers[headerName] = 0;
  }
  return packet;
}

function transformResponseOptions (error, responseOptions = {}, packet = {}) {
  packet.headers = packet.headers || {};
  lodash.forOwn(responseOptions, function(resOpt = {}, optionName) {
    if (optionName in error && lodash.isString(resOpt.headerName)) {
      packet.headers[resOpt.headerName] = error[optionName];
    }
  });
  return packet;
}

function transformErrorObject (error, responseOptions) {
  // statusCode, headers, body
  let packet = {
    statusCode: error.statusCode || 500,
    headers: {},
    body: {
      name: error.name,
      message: error.message
    }
  };
  // responseOptions keys: X-Package-Ref & X-Return-Code
  packet = transformResponseOptions(error, responseOptions, packet);
  // payload
  if (lodash.isObject(error.payload)) {
    packet.body.payload = error.payload;
  }
  return packet;
}

const ERROR_FIELDS = [ 'statusCode', 'headers', 'body' ];

function transformScalarError (error, responseOptions = {}, packet = {}) {
  if (error === null) {
    packet.body = {
      type: 'null',
      message: 'Error is null'
    }
  } else if (lodash.isString(error)) {
    packet.body = {
      type: 'string',
      message: error
    }
  } else if (lodash.isArray(error)) {
    packet.body = {
      type: 'array',
      payload: error
    }
  } else if (lodash.isObject(error)) {
    lodash.assign(packet, lodash.pick(error, ERROR_FIELDS));
    if (lodash.isNil(packet.body)) {
      packet.body = lodash.omit(error, ERROR_FIELDS.concat(lodash.keys(responseOptions)));
    }
    packet = transformResponseOptions(error, responseOptions, packet);
  } else {
    packet.body = {
      type: (typeof error),
      message: 'Error: ' + error,
      payload: error
    }
  }
  packet.statusCode = packet.statusCode || 500;
  packet.headers = packet.headers || {};
  const returnCodeName = lodash.get(responseOptions, 'returnCode.headerName', 'X-Return-Code');
  if (!(returnCodeName in packet.headers)) {
    packet.headers[returnCodeName] = -1;
  }
  return packet;
}

function extractRequestOptions (req, requestOptions, opts = {}, errors) {
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
    if (opts.extensions[key] !== undefined) {
      result[key] = opts.extensions[key];
    }
  }

  return result;
}

function isPureObject (o) {
  return o && (typeof o === 'object') && !Array.isArray(o);
}

function renderPacketToResponse_Standard (packet = {}, res) {
  if (lodash.isObject(packet.headers)) {
    lodash.forOwn(packet.headers, function (value, key) {
      res.set(key, value);
    });
  }
  res.status(packet.statusCode || 200);
  if (lodash.isNil(packet.body)) {
    res.end();
  } else {
    if (lodash.isString(packet.body)) {
      res.send(packet.body);
    } else {
      res.json(packet.body);
    }
  }
}

function renderPacketToResponse_Optimized (packet = {}, res) {
  // affected with a Pure JSON object
  if (isPureObject(packet.headers)) {
    for (const key in packet.headers) {
      res.set(key, packet.headers[key]);
    }
  }
  res.status(packet.statusCode || 200);
  if (packet.body === undefined || packet.body === null) {
    res.end();
  } else {
    if (typeof packet.body === 'string') {
      res.send(packet.body);
    } else {
      res.json(packet.body);
    }
  }
}

let renderPacketToResponse = renderPacketToResponse_Standard;

if (chores.isUpgradeSupported('optimization-mode')) {
  renderPacketToResponse = renderPacketToResponse_Optimized;
}
