'use strict';

var mappings = {
  apiPath: '/sub',
  apimaps: [
    {
      path: '/:apiVersion/fibonacci/calc/:number',
      method: 'GET',
      input: {
        transform: function (req) {
          return { number: req.params.number }
        },
        validate: function () {
          return true;
        },
        jsonschema: {}
      },
      serviceName: 'application/example',
      methodName: 'fibonacci',
      output: {
        transform: function(result, req) {
          return result;
        },
      }
    }
  ]
}

module.exports = mappings;
