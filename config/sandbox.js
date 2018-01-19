module.exports = {
  plugins: {
    appRestfront: {
      mappingStore: require('path').join(__dirname, '../lib/mappings')
    }
  }
};
