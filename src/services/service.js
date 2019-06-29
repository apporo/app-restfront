'use strict';

const Devebot = require('devebot');
const lodash = Devebot.require('lodash');
const path = require('path');

function Service(params = {}) {
  const { restfrontHandler, webweaverService } = params;
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  const contextPath = pluginCfg.contextPath || '/restfront';
  const apiPath = pluginCfg.apiPath || '/api';
  const apiVersion = pluginCfg.apiVersion || '/v1';
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
      path: path.join(contextPath, apiPath, apiVersion),
      middleware: restfrontHandler.validator(express)
    }
  }

  this.getRestLayer = function() {
    return {
      name: 'app-restfront-handler-restapi',
      path: path.join(contextPath, apiPath, apiVersion),
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
        this.getRestLayer()
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
