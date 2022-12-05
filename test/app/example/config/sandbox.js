'use strict';

const path = require('path');
const contextPath = '/restfront';
const apiPath = 'rest';

module.exports = {
  application: {
    errorCodes: {
      FibonacciError: {
        message: 'Fibonacci calculation is error',
        returnCode: 1001,
        statusCode: 400
      },
      InvalidInputNumber: {
        message: 'Invalid input number',
        returnCode: 1009,
        statusCode: 400
      },
      MaximumExceeding: {
        message: 'Maximum input number exceeded',
        returnCode: 1002,
        statusCode: 400
      },
    },
    otherErrorSource: {
      MaximumExceeding: {
        message: 'Maximum input number exceeded',
        returnCode: 2002,
        statusCode: 500
      },
    }
  },
  plugins: {
    appRestfront: {
      contextPath: contextPath,
      apiPath: apiPath,
      mappingStore: {
        "devebot-application": path.join(__dirname, '../lib/mappings/req-to-rpc')
      },
      static: {
        'apidoc': path.join(__dirname, '../public/apidoc'),
        'assets': path.join(__dirname, '../public/assets')
      }
    },
    appApispec: {
      contextPath: contextPath,
      defaultApiDocs: path.join(__dirname, '../data/api-docs/swagger.json'),
      specificationFile: path.join(__dirname, '../data/api-docs/swagger.json'),
      uiType: 'swagger-ui-express', // 'swagger-tools'
    },
    appTracelog: {
      tracingPaths: [ path.join(contextPath, apiPath) ],
      tracingBoundaryEnabled: true
    }
  }
};
