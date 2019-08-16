module.exports = {
  "config": {
    "validation": {
      "schema": {
        "type": "object",
        "properties": {
          "contextPath": {
            "type": "string"
          },
          "apiPath": {
            "type": "string"
          },
          "serviceResolver": {
            "type": "string"
          },
          "mappingStore": {
            "oneOf": [
              {
                "type": "string"
              },
              {
                "type": "object",
                "patternProperties": {
                  "^.+$": {
                    "type": "string"
                  }
                }
              }
            ]
          },
          "static": {
            "type": "object",
            "patternProperties": {
              "^.+$": {
                "type": "string"
              }
            },
            "additionalProperties": false
          },
          "errorCodes": {
            "type": "object",
            "patternProperties": {
              "^[a-zA-Z]\w*$": {
                "type": "object",
                "properties": {
                  "message": {
                    "type": "string"
                  },
                  "returnCode": {
                    "oneOf": [
                      {
                        "type": "number"
                      },
                      {
                        "type": "string"
                      }
                    ]
                  },
                  "statusCode": {
                    "type": "number"
                  },
                  "description": {
                    "type": "string"
                  }
                },
                "additionalProperties": false
              }
            }
          },
          "requestOptions": {
            "type": "object",
            "properties": {
              "requestId": {
                "$ref": "#/definitions/requestOption"
              },
              "segmentId": {
                "$ref": "#/definitions/requestOption"
              },
              "platformApp": {
                "$ref": "#/definitions/requestOption"
              },
              "schemaVersion": {
                "$ref": "#/definitions/requestOption"
              },
              "clientType": {
                "$ref": "#/definitions/requestOption"
              },
              "clientVersion": {
                "$ref": "#/definitions/requestOption"
              },
              "languageCode": {
                "$ref": "#/definitions/requestOption"
              },
              "appTierType": {
                "$ref": "#/definitions/requestOption"
              },
              "appUserType": {
                "$ref": "#/definitions/requestOption"
              },
              "mockSuite": {
                "$ref": "#/definitions/requestOption"
              },
              "mockState": {
                "$ref": "#/definitions/requestOption"
              }
            },
            "additionalProperties": false
          },
          "requestTimeout": {
            "type": "number"
          },
          "autowired": {
            "type": "boolean"
          },
          "priority": {
            "type": "number"
          }
        },
        "required": [ "mappingStore" ],
        "additionalProperties": false,
        "definitions": {
          "requestOption": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "optionName": {
                    "type": "string"
                  },
                  "headerName": {
                    "type": "string"
                  },
                  "required": {
                    "type": "boolean"
                  }
                },
                "required": [ "headerName" ]
              },
              {
                "type": "string"
              }
            ]
          }
        }
      }
    }
  }
};
