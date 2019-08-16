module.exports = {
  plugins: {
    appRestfront: {
      requestIdHeaderName: {
        headerName: 'X-Request-Id',
        required: true,
      },
      segmentIdHeaderName: {
        headerName: 'X-Segment-Id',
      },
      platformAppHeaderName: {
        headerName: 'X-Platform-App',
      },
      schemaVersionHeaderName: {
        headerName: 'X-Schema-Version',
        required: true,
      },
      clientTypeHeaderName: {
        headerName: 'X-App-Type',
      },
      clientVersionHeaderName: {
        headerName: 'X-App-Version',
      },
      languageCodeHeaderName: {
        headerName: 'X-Lang-Code',
      },
      appTierTypeHeaderName: {
        headerName: 'X-Tier-Type',
      },
      appUserTypeHeaderName: {
        headerName: 'X-User-Type',
      },
      mockSuiteHeaderName: {
        headerName: 'X-Mock-Suite',
      },
      mockStateHeaderName: {
        headerName: 'X-Mock-State',
      },
      mappingStore: require('path').join(__dirname, '../lib/mappings')
    }
  }
};
