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
          "requestIdHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "segmentIdHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "platformAppHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "schemaVersionHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "clientTypeHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "clientVersionHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "languageCodeHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "appTierTypeHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "appUserTypeHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "mockSuiteHeaderName": {
            "$ref": "#/definitions/headerConfig"
          },
          "mockStateHeaderName": {
            "$ref": "#/definitions/headerConfig"
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
        "additionalProperties": false,
        "definitions": {
          "headerConfig": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "required": {
                    "type": "boolean"
                  }
                }
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
