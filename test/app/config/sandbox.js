var contextPath = '/restfront/api/v1';
module.exports = {
  plugins: {
    appRestfront: {
      apiPath: 'rest',
      apiVersion: 'v2',
      mappingStore: require('path').join(__dirname, '../lib/mappings/req-to-rpc')
    },
    appTracelog: {
      tracingPaths: [ contextPath ],
      tracingBoundaryEnabled: true
    }
  }
};
