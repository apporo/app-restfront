'use strict';

var mappings = {
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
      error: {
        transform: function(err, req) {
          return err;
        },
      },
      output: {
        transform: function(result, req) {
          return result;
        },
      }
    }
  ]
}

module.exports = mappings;
