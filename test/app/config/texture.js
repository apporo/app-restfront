var lodash = require('lodash');

module.exports = {
  application: {
    services: {
      example: {
        methods: {
          fibonacci: {
          }
        }
      }
    }
  },
  plugins: {
    appRestfront: {
      services: {
        handler: {
          methods: {
            lookupMethod: {
              recursive: true,
              logging: {
                onRequest: {
                  extractInfo: function(argumentsList) {
                    return {serviceName: argumentsList[0], methodName: argumentsList[1]};
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