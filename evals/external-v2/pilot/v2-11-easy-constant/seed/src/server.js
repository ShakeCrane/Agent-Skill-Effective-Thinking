'use strict';
const { DEFAULT_PORT, DEFAULT_HOST } = require('./defaults.js');

function createServer(options = {}) {
  return {
    host: options.host === undefined ? DEFAULT_HOST : options.host,
    port: options.port === undefined ? DEFAULT_PORT : options.port,
  };
}

module.exports = { createServer };
