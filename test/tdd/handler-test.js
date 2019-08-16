'use strict';

var devebot = require('devebot');
var lodash = devebot.require('lodash');
var assert = require('liberica').assert;
var dtk = require('liberica').mockit;
var path = require('path');

describe('handler', function() {
  describe('sanitizeMappings()', function() {
    var loggingFactory = dtk.createLoggingFactoryMock({ captureMethodCall: false });
    var ctx = {
      L: loggingFactory.getLogger(),
      T: loggingFactory.getTracer(),
      blockRef: 'app-restfront',
    }

    var Handler, sanitizeMappings;

    beforeEach(function() {
      Handler = dtk.acquire('handler');
      sanitizeMappings = dtk.get(Handler, 'sanitizeMappings');
    });

    it('push the sanitized mappings into the provided collections', function() {
      var predefinedMappings = {};
      var output = sanitizeMappings({}, predefinedMappings);
      assert.isTrue(output === predefinedMappings);
    });

    it('transform the apimaps to apiMaps and append the apiPath', function() {
      assert.isFunction(sanitizeMappings);
      var mappingHash = {
        example1: [
          {
            path: '/:apiVersion/action1'
          },
          {
            path: [ '/:apiVersion/action2', '/:apiVersion/action2/alias' ]
          }
        ],
        example2: {
          apiPath: '/example2',
          apimaps: [
            {
              path: '/:apiVersion/action1'
            },
            {
              path: [ '/:apiVersion/action2', '/:apiVersion/action2/alias' ]
            }
          ]
        }
      }
      var mappingRefs = sanitizeMappings(mappingHash);
      assert.deepEqual(mappingRefs, {
        "example1": {
          "apiDocs": undefined,
          "apiMaps": [
            {
              "path": "/:apiVersion/action1",
              "input": {
                "mutate": {}
              },
              "output": {
                "mutate": {}
              },
              "error": {
                "mutate": {}
              }
            },
            {
              "path": [
                "/:apiVersion/action2",
                "/:apiVersion/action2/alias"
              ],
              "input": {
                "mutate": {}
              },
              "output": {
                "mutate": {}
              },
              "error": {
                "mutate": {}
              }
            }
          ]
        },
        "example2": {
          "apiDocs": undefined,
          "apiMaps": [
            {
              "path": "/example2/:apiVersion/action1",
              "input": {
                "mutate": {}
              },
              "output": {
                "mutate": {}
              },
              "error": {
                "mutate": {}
              }
            },
            {
              "path": [
                "/example2/:apiVersion/action2",
                "/example2/:apiVersion/action2/alias"
              ],
              "input": {
                "mutate": {}
              },
              "output": {
                "mutate": {}
              },
              "error": {
                "mutate": {}
              }
            }
          ]
        }
      });
    });

    it('append the apiPath to the keys of [paths] in apiDocs', function() {
      assert.isFunction(sanitizeMappings);
      var mappingHash = {
        example3: {
          apiPath: '/example3',
          apiDocs: {
            "swagger": "2.0",
            "host": "api.example.com",
            "basePath": "/v1",
            "produces": [
              "application/json"
            ],
            "paths": {
              "/me": {
                "get": {
                  "summary": "User Profile",
                }
              }
            }
          }
        }
      }
      var mappingRefs = sanitizeMappings(mappingHash);
      assert.deepEqual(mappingRefs, {
        "example3": {
          "apiDocs": {
            "swagger": "2.0",
            "host": "api.example.com",
            "basePath": "/v1",
            "produces": [
              "application/json"
            ],
            "paths": {
              "/example3/me": {
                "get": {
                  "summary": "User Profile",
                }
              }
            }
          }
        }
      });
    });
  });

  describe('mutateRenameFields()', function() {
    var Handler, mutateRenameFields;

    beforeEach(function() {
      Handler = dtk.acquire('handler');
      mutateRenameFields = dtk.get(Handler, 'mutateRenameFields');
    });

    it('do nothing if nameMappings is undefined', function() {
      var original = { abc: 1024, xyz: 'Hello world' };
      var output = mutateRenameFields(original, null);
      assert.deepEqual(output, original);
    });

    it('change the field names based on the namingMappings properly');
  });

  describe('extractReqOpts()', function() {
    var Handler, STANDARD_REQ_OPTIONS, extractReqOpts;

    var app = require(path.join(__dirname, '../app'));
    var sandboxConfig = lodash.get(app.config, ['sandbox', 'default', 'plugins', 'appRestfront']);

    var req = new RequestMock({
      headers: {
        'X-Request-Id': '52160bbb-cac5-405f-a1e9-a55323b17938',
        'X-App-Type': 'agent',
        'X-App-Version': '0.1.0'
      }
    });

    beforeEach(function() {
      Handler = dtk.acquire('handler');
      STANDARD_REQ_OPTIONS = dtk.get(Handler, 'STANDARD_REQ_OPTIONS');
      extractReqOpts = dtk.get(Handler, 'extractReqOpts');
    });

    it('extract the predefined headers properly', function() {
      var output = extractReqOpts(req, sandboxConfig);
      var expected = {
        "requestId": "52160bbb-cac5-405f-a1e9-a55323b17938",
        "clientType": "agent",
        "clientVersion": "0.1.0"
      };
      assert.deepInclude(output, expected);
      assert.sameMembers(lodash.keys(output), STANDARD_REQ_OPTIONS);
    });

    it('the headers will be overridden by extensions', function() {
      var output = extractReqOpts(req, sandboxConfig, {
        requestId: "7f36af79-077b-448e-9c66-fc177996fd10",
        timeout: 1000
      });
      var expected = {
        "requestId": "7f36af79-077b-448e-9c66-fc177996fd10",
        "clientType": "agent",
        "clientVersion": "0.1.0",
        "timeout": 1000
      };
      assert.deepInclude(output, expected);
      assert.sameMembers(lodash.keys(output), STANDARD_REQ_OPTIONS.concat([ "timeout" ]));
    });

    var config = lodash.assign({ userAgentEnabled: true }, sandboxConfig);

    it('uaParser is safety: should not crack the requests in any case', function() {
      var req = new RequestMock({
        headers: {
          'User-Agent': null
        }
      });
      var output = extractReqOpts(req, config);
      assert.deepInclude(output.userAgent, {
        "os": {
          "name": undefined,
          "version": undefined
        },
        "ua": ""
      });
    });

    it('uaParser is safety: should not crack the requests with wrong user-agent format', function() {
      var req = new RequestMock({
        headers: {
          'User-Agent': 'Any string, wrong format'
        }
      });
      var output = extractReqOpts(req, config);
      assert.deepInclude(output.userAgent, {
        "os": {
          "name": undefined,
          "version": undefined
        },
        "ua": "Any string, wrong format"
      });
    });

    it('uaParser parse the user-agent string into JSON object properly', function() {
      var req = new RequestMock({
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.2 (KHTML, like Gecko) Ubuntu/11.10 Chromium/15.0.874.106 Chrome/15.0.874.106 Safari/535.2',
        }
      });
      var output = extractReqOpts(req, config);
      assert.deepInclude(output.userAgent, {
        "browser": {
          "name": "Chromium",
          "version": "15.0.874.106",
          "major": "15"
        },
        "engine": {
          "name": "WebKit",
          "version": "535.2"
        },
        "os": {
          "name": "Ubuntu",
          "version": "11.10"
        },
        "cpu": {
          "architecture": "amd64"
        }
      });
    });
  });
});

function RequestMock (defs = {}) {
  var store = { };

  store.headers = lodash.mapKeys(defs.headers, function(value, key) {
    return lodash.lowerCase(key);
  });

  this.get = function(name) {
    return store.headers[lodash.lowerCase(name)];
  }
}
