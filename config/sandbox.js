module.exports = {
  plugins: {
    appRestfront: {
      requestOptions: {
        requestId: {
          headerName: 'X-Request-Id',
          optionName: 'requestId',
          required: false,
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
      responseOptions: {
        packageRef: {
          headerName: 'X-Package-Ref',
        },
        returnCode: {
          headerName: 'X-Return-Code',
        }
      },
      errorCodes: {
        RequestOptionNotFound: {
          message: 'Required request options not found',
          returnCode: 100,
          statusCode: 400
        },
        RequestTimeoutOnServer: {
          message: 'Request timeout',
          returnCode: 101,
          statusCode: 408
        },
        RequestPreValidationError: {
          message: 'The http request is invalid',
          returnCode: 102,
          statusCode: 400
        },
        RequestPostValidationError: {
          message: 'The sanitized body is invalid',
          returnCode: 103,
          statusCode: 400
        },
      },
      mappingStore: {}
    }
  }
};
