'use strict';

var mappings = {
  apiPath: '/sub',
  apimaps: [
    {
      path: '/:apiVersion/fibonacci/calc/:number',
      method: 'GET',
      requestOptions: {
        requestId: {
          required: true
        }
      },
      errorSource: 'otherErrorSource',
      input: {
        preValidator: function (req, reqOpts, services) {
          var demoAction = req.get('X-Demo-Action');
          var L = services.logger;
          var T = services.tracer;
          L.has('debug') && L.log('debug', T.add({
            demoAction, requestId: reqOpts.requestId
          }).toMessage({
            tmpl: 'preValidator[${requestId}] the demoAction: [${demoAction}] has been captured'
          }));
          if (demoAction === 'pre-validation-failed') {
            return {
              valid: false,
              errors: { demoAction }
            }
          }
          return true;
        },
        transform: function (req, reqOpts, services) {
          var L = services.logger;
          var T = services.tracer;
          L.has('debug') && L.log('debug', T.add({
            requestId: reqOpts.requestId
          }).toMessage({
            tmpl: 'transform[${requestId}] the request is transforming'
          }));
          return { number: req.params.number }
        },
        postValidator: function (data, reqOpts, services) {
          var L = services.logger;
          var T = services.tracer;
          L.has('debug') && L.log('debug', T.add(reqOpts).toMessage({
            tmpl: 'postValidator[${requestId}] is invoked'
          }));
          if (data && data.number >= 49) {
            return {
              valid: false,
              errorName: 'MaximumExceeding',
              errors: [
                'Maximum input number exceeded'
              ]
            }
          }
          return true;
        },
        jsonschema: {}
      },
      serviceName: 'application/example',
      methodName: 'fibonacci',
      output: {
        transform: function(result, req) {
          return result;
        },
      }
    }
  ],
  apiDocs: {
    "swagger": "2.0",
    "info": {
        "title": "Example API",
        "description": "Move your app forward with the Example API",
        "version": "1.0.0"
    },
    "host": "api.example.com",
    "schemes": [
        "https"
    ],
    "basePath": "/v1",
    "produces": [
        "application/json"
    ],
    "paths": {
        "/me": {
            "get": {
                "summary": "User Profile",
                "description": "The User Profile endpoint returns information about the Uber user that has authorized with the application.",
                "tags": [
                    "Accounts"
                ],
                "responses": {
                    "200": {
                        "description": "Profile information for a user",
                        "schema": {
                            "$ref": "#/definitions/Profile"
                        }
                    },
                    "default": {
                        "description": "Unexpected error",
                        "schema": {
                            "$ref": "#/definitions/Error"
                        }
                    }
                }
            }
        },
        "/history": {
            "get": {
                "summary": "User Activity",
                "description": "The User Activity endpoint returns data about a user's lifetime activity with Uber. The response will include pickup locations and times, dropoff locations and times, the distance of past requests, and information about which products were requested.<br><br>The history array in the response will have a maximum length based on the limit parameter. The response value count may exceed limit, therefore subsequent API requests may be necessary.",
                "parameters": [
                    {
                        "name": "offset",
                        "in": "query",
                        "type": "integer",
                        "format": "int32",
                        "description": "Offset the list of returned results by this amount. Default is zero."
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "type": "integer",
                        "format": "int32",
                        "description": "Number of items to retrieve. Default is 5, maximum is 100."
                    }
                ],
                "tags": [
                    "Accounts"
                ],
                "responses": {
                    "200": {
                        "description": "History information for the given user",
                        "schema": {
                            "$ref": "#/definitions/Activities"
                        }
                    },
                    "default": {
                        "description": "Unexpected error",
                        "schema": {
                            "$ref": "#/definitions/Error"
                        }
                    }
                }
            }
        },
        "/products": {
            "get": {
                "summary": "Product Types",
                "description": "The Products endpoint returns information about the *Uber* products\noffered at a given location. The response includes the display name\nand other details about each product, and lists the products in the\nproper display order.\n",
                "parameters": [
                    {
                        "name": "latitude",
                        "in": "query",
                        "description": "Latitude component of location.",
                        "required": true,
                        "type": "number",
                        "format": "double"
                    },
                    {
                        "name": "longitude",
                        "in": "query",
                        "description": "Longitude component of location.",
                        "required": true,
                        "type": "number",
                        "format": "double"
                    }
                ],
                "tags": [
                    "Products"
                ],
                "responses": {
                    "200": {
                        "description": "An array of products",
                        "schema": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/Product"
                            }
                        }
                    },
                    "default": {
                        "description": "Unexpected error",
                        "schema": {
                            "$ref": "#/definitions/Error"
                        }
                    }
                }
            }
        },
        "/estimates/price": {
            "get": {
                "summary": "Price Estimates",
                "description": "The Price Estimates endpoint returns an estimated price range\nfor each product offered at a given location. The price estimate is\nprovided as a formatted string with the full price range and the localized\ncurrency symbol.<br><br>The response also includes low and high estimates,\nand the [ISO 4217](http://en.wikipedia.org/wiki/ISO_4217) currency code for\nsituations requiring currency conversion. When surge is active for a particular\nproduct, its surge_multiplier will be greater than 1, but the price estimate\nalready factors in this multiplier.\n",
                "parameters": [
                    {
                        "name": "start_latitude",
                        "in": "query",
                        "description": "Latitude component of start location.",
                        "required": true,
                        "type": "number",
                        "format": "double"
                    },
                    {
                        "name": "start_longitude",
                        "in": "query",
                        "description": "Longitude component of start location.",
                        "required": true,
                        "type": "number",
                        "format": "double"
                    },
                    {
                        "name": "end_latitude",
                        "in": "query",
                        "description": "Latitude component of end location.",
                        "required": true,
                        "type": "number",
                        "format": "double"
                    },
                    {
                        "name": "end_longitude",
                        "in": "query",
                        "description": "Longitude component of end location.",
                        "required": true,
                        "type": "number",
                        "format": "double"
                    }
                ],
                "tags": [
                    "Estimates"
                ],
                "responses": {
                    "200": {
                        "description": "An array of price estimates by product",
                        "schema": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/PriceEstimate"
                            }
                        }
                    },
                    "default": {
                        "description": "Unexpected error",
                        "schema": {
                            "$ref": "#/definitions/Error"
                        }
                    }
                }
            }
        },
        "/estimates/time": {
            "get": {
                "summary": "Time Estimates",
                "description": "The Time Estimates endpoint returns ETAs for all products offered at a given location, with the responses expressed as integers in seconds. We recommend that this endpoint be called every minute to provide the most accurate, up-to-date ETAs.",
                "parameters": [
                    {
                        "name": "start_latitude",
                        "in": "query",
                        "description": "Latitude component of start location.",
                        "required": true,
                        "type": "number",
                        "format": "double"
                    },
                    {
                        "name": "start_longitude",
                        "in": "query",
                        "description": "Longitude component of start location.",
                        "required": true,
                        "type": "number",
                        "format": "double"
                    },
                    {
                        "name": "customer_uuid",
                        "in": "query",
                        "type": "string",
                        "format": "uuid",
                        "description": "Unique customer identifier to be used for experience customization."
                    },
                    {
                        "name": "product_id",
                        "in": "query",
                        "type": "string",
                        "description": "Unique identifier representing a specific product for a given latitude & longitude."
                    }
                ],
                "tags": [
                    "Estimates"
                ],
                "responses": {
                    "200": {
                        "description": "An array of products",
                        "schema": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/Product"
                            }
                        }
                    },
                    "default": {
                        "description": "Unexpected error",
                        "schema": {
                            "$ref": "#/definitions/Error"
                        }
                    }
                }
            }
        }
    },
    "definitions": {
        "Product": {
            "type": "object",
            "properties": {
                "product_id": {
                    "type": "string",
                    "description": "Unique identifier representing a specific product for a given latitude & longitude. For example, uberX in San Francisco will have a different product_id than uberX in Los Angeles."
                },
                "description": {
                    "type": "string",
                    "description": "Description of product."
                },
                "display_name": {
                    "type": "string",
                    "description": "Display name of product."
                },
                "capacity": {
                    "type": "string",
                    "description": "Capacity of product. For example, 4 people."
                },
                "image": {
                    "type": "string",
                    "description": "Image URL representing the product."
                }
            }
        },
        "PriceEstimate": {
            "type": "object",
            "properties": {
                "product_id": {
                    "type": "string",
                    "description": "Unique identifier representing a specific product for a given latitude & longitude. For example, uberX in San Francisco will have a different product_id than uberX in Los Angeles"
                },
                "currency_code": {
                    "type": "string",
                    "description": "[ISO 4217](http://en.wikipedia.org/wiki/ISO_4217) currency code."
                },
                "display_name": {
                    "type": "string",
                    "description": "Display name of product."
                },
                "estimate": {
                    "type": "string",
                    "description": "Formatted string of estimate in local currency of the start location. Estimate could be a range, a single number (flat rate) or \"Metered\" for TAXI."
                },
                "low_estimate": {
                    "type": "number",
                    "description": "Lower bound of the estimated price."
                },
                "high_estimate": {
                    "type": "number",
                    "description": "Upper bound of the estimated price."
                },
                "surge_multiplier": {
                    "type": "number",
                    "description": "Expected surge multiplier. Surge is active if surge_multiplier is greater than 1. Price estimate already factors in the surge multiplier."
                }
            }
        },
        "Profile": {
            "type": "object",
            "properties": {
                "first_name": {
                    "type": "string",
                    "description": "First name of the Uber user."
                },
                "last_name": {
                    "type": "string",
                    "description": "Last name of the Uber user."
                },
                "email": {
                    "type": "string",
                    "description": "Email address of the Uber user"
                },
                "picture": {
                    "type": "string",
                    "description": "Image URL of the Uber user."
                },
                "promo_code": {
                    "type": "string",
                    "description": "Promo code of the Uber user."
                }
            }
        },
        "Activity": {
            "type": "object",
            "properties": {
                "uuid": {
                    "type": "string",
                    "description": "Unique identifier for the activity"
                }
            }
        },
        "Activities": {
            "type": "object",
            "properties": {
                "offset": {
                    "type": "integer",
                    "format": "int32",
                    "description": "Position in pagination."
                },
                "limit": {
                    "type": "integer",
                    "format": "int32",
                    "description": "Number of items to retrieve (100 max)."
                },
                "count": {
                    "type": "integer",
                    "format": "int32",
                    "description": "Total number of items available."
                },
                "history": {
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/Activity"
                    }
                }
            }
        },
        "Error": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "integer",
                    "format": "int32"
                },
                "message": {
                    "type": "string"
                },
                "fields": {
                    "type": "string"
                }
            }
        }
    }
  }
}

module.exports = mappings;
