module.exports = {
  devebot: {
    coupling: 'loose',
  },
  logger: {
    transports: {
      console: {
        type: 'console',
        level: 'debug',
        json: false,
        timestamp: true,
        colorize: true
      }
    }
  }
};
