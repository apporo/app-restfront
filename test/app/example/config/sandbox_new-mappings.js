'use strict';

const path = require('path');

module.exports = {
  plugins: {
    appRestfront: {
      mappingStore: {
        "example-mappings": path.join(__dirname, '../lib/mappings/req-to-rpc')
      }
    }
  }
};
