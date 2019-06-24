'use strict';

const Devebot = require('devebot');
const lodash = Devebot.require('lodash');
const path = require('path');

function Service(params = {}) {
  const L = params.loggingFactory.getLogger();
  const T = params.loggingFactory.getTracer();
  const { restfrontHandler, webweaverService } = params;
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  const contextPath = pluginCfg.contextPath || '/restfront';
  const express = webweaverService.express;

  this.getApiDocLayer = function() {
    return {
      name: 'app-restfront-service-apidoc',
      path: contextPath + '/apidoc',
      middleware: express.static(path.join(__dirname, '../../apidoc'))
    }
  }

  this.getAssetsLayer = function() {
    return {
      name: 'app-restfront-service-assets',
      path: contextPath + '/assets',
      middleware: express.static(path.join(__dirname, '../../public/assets'))
    }
  }

  this.getValidator = function() {
    return {
      name: 'app-restfront-handler-validator',
      path: contextPath + '/api/v1',
      middleware: restfrontHandler.validator(express)
    }
  }

  this.getApiV1Layer = function() {
    return {
      name: 'app-restfront-handler-apiv1',
      path: contextPath + '/api/v1',
      middleware: restfrontHandler.buildRestRouter(express)
    }
  }

  if (pluginCfg.autowired !== false) {
    webweaverService.push([
      this.getApiDocLayer(),
      this.getAssetsLayer(),
      webweaverService.getSessionLayer([
        webweaverService.getJsonBodyParserLayer(),
        this.getValidator(),
        this.getApiV1Layer()
      ], contextPath),
      webweaverService.getDefaultRedirectLayer(['/$', contextPath + '$'])
    ], pluginCfg.priority);
  }
};

Service.referenceHash = {
  restfrontHandler: 'handler',
  webweaverService: 'app-webweaver/webweaverService'
};

module.exports = Service;
