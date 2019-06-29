'use strict';

var path = require('path');
var contextPath = '/restfront';
var apiPath = 'rest';
var apiVersion = 'v2';

module.exports = {
  plugins: {
    appRestfront: {
      contextPath: contextPath,
      apiPath: apiPath,
      apiVersion: apiVersion,
      mappingStore: require('path').join(__dirname, '../lib/mappings/req-to-rpc'),
      static: {
        'apidoc': path.join(__dirname, '../public/apidoc'),
        'assets': path.join(__dirname, '../public/assets')
      }
    },
    appTracelog: {
      tracingPaths: [ path.join(contextPath, apiPath, apiVersion) ],
      tracingBoundaryEnabled: true
    }
  }
};
