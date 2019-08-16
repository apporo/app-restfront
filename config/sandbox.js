module.exports = {
  plugins: {
    appRestfront: {
      requestIdHeaderName: 'X-Request-Id',
      segmentIdHeaderName: 'X-Segment-Id',
      platformAppHeaderName: 'X-Platform-App',
      schemaVersionHeaderName: 'X-Schema-Version',
      clientTypeHeaderName: 'X-App-Type',
      clientVersionHeaderName: 'X-App-Version',
      languageCodeHeaderName: 'X-Lang-Code',
      appTierTypeHeaderName: 'X-Tier-Type',
      appUserTypeHeaderName: 'X-User-Type',
      mockSuiteHeaderName: 'X-Mock-Suite',
      mockStateHeaderName: 'X-Mock-State',
      mappingStore: require('path').join(__dirname, '../lib/mappings')
    }
  }
};
