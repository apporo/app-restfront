'use strict';

var Devebot = require('devebot');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('debug')('appRestfront:service');
var path = require('path');

var Service = function(params) {
  debugx.enabled && debugx(' + constructor begin ...');

  params = params || {};

  var self = this;
  var logger = params.loggingFactory.getLogger();

  debugx.enabled && debugx(' - attach service into app-webweaver');

  var pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  var contextPath = pluginCfg.contextPath || '/restfront';
  var express = params.webweaverService.express;

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

  self.getApiV1Layer = function() {
    return {
      name: 'app-restfront-handler-apiv1',
      path: contextPath + '/api/v1',
      middleware: params.restfrontHandler.buildRestRouter(express)
    }
  }

  if (pluginCfg.autowired !== false) {
    params.webweaverService.push([
      self.getApiDocLayer(),
      self.getAssetsLayer(),
      params.webweaverService.getSessionLayer([
        params.webweaverService.getJsonBodyParserLayer(),
        self.getApiV1Layer()
      ], contextPath),
      params.webweaverService.getDefaultRedirectLayer(['/$', contextPath + '$'])
    ], pluginCfg.priority);
  }

  debugx.enabled && debugx(' - constructor end!');
};

Service.referenceList = [ 'restfrontHandler', 'webweaverService' ];

module.exports = Service;
