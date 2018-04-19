'use strict';

var Devebot = require('devebot');
var chores = Devebot.require('chores');
var lodash = Devebot.require('lodash');
var debugx = Devebot.require('pinbug')('app-restfront:service');
var path = require('path');

var Service = function(params) {
  params = params || {};
  var self = this;

  var LX = params.loggingFactory.getLogger();
  var LT = params.loggingFactory.getTracer();
  var packageName = params.packageName || 'app-restfront';
  var blockRef = chores.getBlockRef(__filename, packageName);

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-begin' ],
    text: ' + constructor begin ...'
  }));

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

  LX.has('silly') && LX.log('silly', LT.toMessage({
    tags: [ blockRef, 'constructor-end' ],
    text: ' - constructor end!'
  }));
};

Service.referenceList = [ 'restfrontHandler', 'webweaverService' ];

module.exports = Service;
