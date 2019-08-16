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
            "type": "string"
          },
          "segmentIdHeaderName": {
            "type": "string"
          },
          "platformAppHeaderName": {
            "type": "string"
          },
          "schemaVersionHeaderName": {
            "type": "string"
          },
          "clientTypeHeaderName": {
            "type": "string"
          },
          "clientVersionHeaderName": {
            "type": "string"
          },
          "languageCodeHeaderName": {
            "type": "string"
          },
          "appTierTypeHeaderName": {
            "type": "string"
          },
          "appUserTypeHeaderName": {
            "type": "string"
          },
          "mockSuiteHeaderName": {
            "type": "string"
          },
          "mockStateHeaderName": {
            "type": "string"
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
        "additionalProperties": false
      }
    }
  }
};
