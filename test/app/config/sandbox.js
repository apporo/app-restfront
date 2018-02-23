module.exports = {
  plugins: {
    appRestfront: {
      rpcMasters: {
        nodeService: {
          uri: process.env.DEVEBOT_OPFLOW_URI || 'amqp://localhost',
          exchangeName: 'app-restfront-fibonacci',
          routingKey: 'app-restfront-node-major',
          applicationId: 'DevebotRestfront'
        },
        javaService: {
          uri: process.env.DEVEBOT_OPFLOW_URI || 'amqp://localhost',
          exchangeName: 'app-restfront-fibonacci',
          routingKey: 'app-restfront-java-major',
          applicationId: 'DevebotRestfront'
        }
      },
      mappingStore: require('path').join(__dirname, '../lib/mappings/req-to-rpc'),
      opflowTimeout: 10000
    }
  }
};
