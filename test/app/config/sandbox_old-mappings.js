'use strict';

module.exports = {
  plugins: {
    appRestfront: {
      mappingStore: require('path').join(__dirname, '../lib/mappings/req-to-rpc.js')
    }
  }
};
