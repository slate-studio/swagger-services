'use strict'

global.S = {}

const modules = {
  health:   require('./lib/health.js'),
  services: require('./lib/services.js')
}

if (process.env.NODE_ENV == 'test' || process.env.NODE_ENV == 'gitlab') {
  global.M = {}
  modules.mocks = require('./lib/mocks.js')
}

module.exports = modules
