var lodash = require('lodash');

module.exports = {
  application: {
    services: {
      example: {
        methods: {
          fibonacci: {
            mocking: {
              mappings: {
                "default": {
                  selector: function(parameters) {
                    return true;
                  },
                  generate: function(parameters) {
                    var data = parameters;
                    return {
                      value: 40 + 100,
                      step: 10,
                      number: 30,
                      actionId: data.actionId
                    };
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}