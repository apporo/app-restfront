'use strict';

var mappings = [
  {
    path: '/fibonacci/calc/:number',
    method: 'GET',
    transformRequest: function(req) {
      return { number: req.params.number }
    },
    serviceName: 'application/example',
    methodName: 'fibonacci'
  }
]

module.exports = mappings;
