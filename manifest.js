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
          "apiVersion": {
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
