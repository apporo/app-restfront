module.exports = {
  plugins: {
    appRestfront: {
      requestOptions: {
        requestId: {
          headerName: 'X-Request-Id',
          optionName: 'requestId',
          required: true,
        },
        segmentId: {
          headerName: 'X-Segment-Id',
        },
        platformApp: {
          headerName: 'X-Platform-App',
        },
        schemaVersion: {
          headerName: 'X-Schema-Version',
        },
        clientType: {
          headerName: 'X-App-Type',
        },
        clientVersion: {
          headerName: 'X-App-Version',
        },
        languageCode: {
          headerName: 'X-Lang-Code',
        },
        appTierType: {
          headerName: 'X-Tier-Type',
        },
        appUserType: {
          headerName: 'X-User-Type',
        },
        mockSuite: {
          headerName: 'X-Mock-Suite',
        },
        mockState: {
          headerName: 'X-Mock-State',
        }
      },
      mappingStore: require('path').join(__dirname, '../lib/mappings')
    }
  }
};
