module.exports = {
  plugins: {
    appRestfront: {
      requestIdHeaderName: {
        name: 'X-Request-Id',
      },
      segmentIdHeaderName: {
        name: 'X-Segment-Id',
      },
      platformAppHeaderName: {
        name: 'X-Platform-App',
      },
      schemaVersionHeaderName: {
        name: 'X-Schema-Version',
      },
      clientTypeHeaderName: {
        name: 'X-App-Type',
      },
      clientVersionHeaderName: {
        name: 'X-App-Version',
      },
      languageCodeHeaderName: {
        name: 'X-Lang-Code',
      },
      appTierTypeHeaderName: {
        name: 'X-Tier-Type',
      },
      appUserTypeHeaderName: {
        name: 'X-User-Type',
      },
      mockSuiteHeaderName: {
        name: 'X-Mock-Suite',
      },
      mockStateHeaderName: {
        name: 'X-Mock-State',
      },
      mappingStore: require('path').join(__dirname, '../lib/mappings')
    }
  }
};
