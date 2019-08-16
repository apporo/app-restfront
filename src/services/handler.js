'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const lodash = Devebot.require('lodash');
const Validator = require('schema-validator');
const uaParser = require('ua-parser-js');
const path = require('path');

const BUILTIN_MAPPING_LOADER = chores.isVersionLTE && chores.getVersionOf &&
    chores.isVersionLTE("0.3.1", chores.getVersionOf("devebot"));

const HTTP_HEADER_RETURN_CODE = 'X-Return-Code';

function Handler(params = {}) {
  const { loggingFactory, sandboxRegistry, tracelogService, mappingLoader } = params;
  const L = loggingFactory.getLogger();
  const T = loggingFactory.getTracer();
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  const serviceResolver = pluginCfg.serviceResolver || 'app-opmaster/commander';

  const swaggerBuilder = sandboxRegistry.lookupService('app-apispec/swaggerBuilder') ||
      sandboxRegistry.lookupService('app-restguide/swaggerBuilder');

  let mappingHash;
  if (BUILTIN_MAPPING_LOADER) {
    mappingHash = mappingLoader.loadMappings(pluginCfg.mappingStore);
  } else {
    mappingHash = loadMappings(pluginCfg.mappingStore);
  }

  mappingHash = sanitizeMappings(mappingHash);

  const mappings = joinMappings(mappingHash);

  if (swaggerBuilder) {
    lodash.forOwn(mappingHash, function(mappingBundle, name) {
      if (mappingBundle.apiDocs) {
        swaggerBuilder.addApiEntries(mappingBundle.apiDocs);
      }
    });
  }

  const serviceSelector = chores.newServiceSelector({ serviceResolver, sandboxRegistry });

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
        const reqTR = T.branch({ key: 'requestId', value: requestId });
        L.has('info') && L.log('info', reqTR.add({
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

        const reqOpts = extractReqOpts(req, pluginCfg, {
          requestId,
          timeout: mapping.timeout || pluginCfg.requestTimeout
        });

        let promize = Promise.resolve();

        if (reqOpts.timeout && reqOpts.timeout > 0) {
          promize = promize.timeout(reqOpts.timeout);
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
          packet.headers = packet.headers || {};
          packet.headers[HTTP_HEADER_RETURN_CODE] = packet.headers[HTTP_HEADER_RETURN_CODE] || 0;
          // rename the fields
          if (mapping.output.mutate.rename) {
            packet = mutateRenameFields(packet, mapping.output.mutate.rename);
          }
          L.has('trace') && L.log('trace', reqTR.add({ result, packet }).toMessage({
            text: 'Req[${requestId}] is completed'
          }));
          // Render the packet
          if (lodash.isObject(packet.headers)) {
            lodash.forOwn(packet.headers, function (value, key) {
              res.set(key, value);
            });
          }
          if (lodash.isString(packet.body)) {
            res.text(packet.body);
          } else {
            res.json(packet.body);
          }
        });

        promize = promize.catch(Promise.TimeoutError, function(err) {
          let packet = {};
          if (mapping.error && lodash.isFunction(mapping.error.transform)) {
            packet = mapping.error.transform(err, req, reqOpts);
            packet = packet || {};
          }
          if (mapping.error.mutate.rename) {
            packet = mutateRenameFields(packet, mapping.error.mutate.rename);
          }
          packet.statusCode = packet.statusCode || 408;
          // render the packet to the response
          if (lodash.isObject(packet.headers)) {
            lodash.forOwn(packet.headers, function (value, key) {
              res.set(key, value);
            });
          }
          L.has('error') && L.log('error', reqTR.add({
            timeout: reqOpts.timeout
          }).toMessage({
            text: 'Req[${requestId}] has timeout after ${timeout} seconds'
          }));
          res.status(packet.statusCode).end();
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
              packet = transformErrorDefault(failed);
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
          packet.statusCode = packet.statusCode || 500;
          if (lodash.isObject(packet.headers)) {
            lodash.forOwn(packet.headers, function (value, key) {
              res.set(key, value);
            });
          }
          L.has('error') && L.log('error', reqTR.add(packet).toMessage({
            text: 'Req[${requestId}] has failed, status[${statusCode}], headers: ${headers}, body: ${body}'
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

function transformOutputDefault (data, req) {
  const output = {
    headers: {},
    body: data
  };
  output.headers[HTTP_HEADER_RETURN_CODE] = 0;
  return output;
}

function transformErrorDefault (err, req) {
  const output = {
    statusCode: err.statusCode || 500,
    headers: {},
    body: {
      name: err.name,
      message: err.message
    }
  };
  if (err.returnCode) {
    output.headers[HTTP_HEADER_RETURN_CODE] = err.returnCode;
  }
  if (lodash.isObject(err.payload)) {
    output.body.payload = err.payload;
  }
  return output;
}

const STANDARD_REQ_OPTIONS = [
  "requestId",
  "segmentId",
  "platformApp",
  "schemaVersion",
  "clientType",
  "clientVersion",
  "languageCode",
  "appTierType",
  "appUserType",
  "mockSuite",
  "mockState",
];

function extractReqOpts (req, pluginCfg, exts = {}) {
  const opts = {};

  for (const i in STANDARD_REQ_OPTIONS) {
    const optionName = STANDARD_REQ_OPTIONS[i];
    const headerName = optionName + 'HeaderName';
    let reqOption = pluginCfg[headerName];
    if (lodash.isString(reqOption)) {
      reqOption = { headerName: reqOption };
    }
    opts[optionName] = req.get(reqOption.headerName);
  }

  if (pluginCfg.userAgentEnabled) {
    opts.userAgent = uaParser(req.get('User-Agent'));
  }

  for (const key in exts) {
    opts[key] = exts[key];
  }

  return opts;
}
