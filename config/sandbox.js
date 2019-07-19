module.exports = {
  plugins: {
    appRestfront: {
      requestIdHeaderName: 'X-Request-Id',
      clientTypeHeaderName: 'X-App-Type',
      clientVersionHeaderName: 'X-App-Version',
      systemPhaseHeaderName: 'X-System-Phase',
      mockSuiteHeaderName: 'X-Mock-Suite',
      mockStateHeaderName: 'X-Mock-State',
      mappingStore: require('path').join(__dirname, '../lib/mappings')
    }
  }
};
