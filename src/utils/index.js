'use strict';

const uaParser = require('ua-parser-js');

function parseUserAgent(userAgentString) {
  if (!userAgentString) {
    return {};
  }
  return uaParser(userAgentString);
}

module.exports = { parseUserAgent }
