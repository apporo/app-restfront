'use strict';

const Devebot = require('devebot');
const lodash = Devebot.require('lodash');
const path = require('path');

function Service(params) {
  params = params || {};
  let self = this;

  let L = params.loggingFactory.getLogger();
  let T = params.loggingFactory.getTracer();

  let pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  let contextPath = pluginCfg.contextPath || '/restfront';
  let restfrontHandler = params['handler'];
  let webweaverService = params['app-webweaver/webweaverService'];
  let express = webweaverService.express;

  self.getApiDocLayer = function() {
    return {
      name: 'app-restfront-service-apidoc',
      path: contextPath + '/apidoc',
      middleware: express.static(path.join(__dirname, '../../apidoc'))
    }
  }

  self.getAssetsLayer = function() {
    return {
      name: 'app-restfront-service-assets',
      path: contextPath + '/assets',
      middleware: express.static(path.join(__dirname, '../../public/assets'))
    }
  }

  self.getValidator = function() {
    return {
      name: 'app-restfront-handler-validator',
      path: contextPath + '/api/v1',
      middleware: restfrontHandler.validator(express)
    }
  }

  self.getApiV1Layer = function() {
    return {
      name: 'app-restfront-handler-apiv1',
      path: contextPath + '/api/v1',
      middleware: restfrontHandler.buildRestRouter(express)
    }
  }

  if (pluginCfg.autowired !== false) {
    webweaverService.push([
      self.getApiDocLayer(),
      self.getAssetsLayer(),
      webweaverService.getSessionLayer([
        webweaverService.getJsonBodyParserLayer(),
        self.getValidator(),
        self.getApiV1Layer()
      ], contextPath),
      webweaverService.getDefaultRedirectLayer(['/$', contextPath + '$'])
    ], pluginCfg.priority);
  }
};

Service.referenceList = [
  'handler',
  'app-webweaver/webweaverService'
];

module.exports = Service;
