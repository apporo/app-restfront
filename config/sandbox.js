module.exports = {
  plugins: {
    appRestfront: {
      requestIdHeaderName: 'X-Request-Id',
      segmentIdHeaderName: 'X-Segment-Id',
      clientTypeHeaderName: 'X-App-Type',
      clientVersionHeaderName: 'X-App-Version',
      languageCodeHeaderName: 'X-Lang-Code',
      systemPhaseHeaderName: 'X-System-Phase',
      mockSuiteHeaderName: 'X-Mock-Suite',
      mockStateHeaderName: 'X-Mock-State',
      mappingStore: require('path').join(__dirname, '../lib/mappings')
    }
  }
};
