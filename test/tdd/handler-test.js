'use strict';

var devebot = require('devebot');
var lodash = devebot.require('lodash');
var assert = require('liberica').assert;
var dtk = require('liberica').mockit;

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
  });
});
