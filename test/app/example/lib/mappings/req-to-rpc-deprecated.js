'use strict';

var mappings = [
  {
    path: '/:apiVersion/fibonacci/calc/:number',
    method: 'GET',
    transformRequest: function(req) {
      return { number: req.params.number }
    },
    serviceName: 'application/example',
    methodName: 'fibonacci',
    transformError: function(err, req) {
      return err;
    },
    transformResponse: function(result, req) {
      return result;
    }
  }
]

module.exports = mappings;
