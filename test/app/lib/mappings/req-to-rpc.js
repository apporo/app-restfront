'use strict';

var mappings = [
  {
    path: '/fibonacci/calc/:number',
    method: 'GET',
    rpcName: 'nodeService',
    routineId: 'fibonacci',
    transformRequest: function(req) {
      return { number: req.params.number }
    }
  }
]

module.exports = mappings;
