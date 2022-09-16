'use strict';

const Devebot = require('devebot');
const lodash = Devebot.require('lodash');
const path = require('path');

function Service(params = {}) {
  const { restfrontHandler, webweaverService } = params;
  const pluginCfg = lodash.get(params, ['sandboxConfig'], {});
  const contextPath = pluginCfg.contextPath || '/restfront';
  const apiPath = pluginCfg.apiPath || '';
  const apiFullPath = path.join(contextPath, apiPath);
  const staticpages = pluginCfg.static;
  const express = webweaverService.express;

  this.getAssetsLayer = function(webpath, filepath, index) {
    return {
      name: 'app-restfront-service-assets~' + index,
      path: path.join(contextPath, webpath),
      middleware: express.static(filepath)
    }
  }

  this.getValidator = function() {
    return {
      name: 'app-restfront-handler-validator',
      path: apiFullPath,
      middleware: restfrontHandler.validator(express)
    }
  }

  this.getRestLayer = function() {
    return {
      name: 'app-restfront-handler-restapi',
      path: apiFullPath,
      middleware: restfrontHandler.buildRestRouter(express)
    }
  }

  if (pluginCfg.autowired !== false) {
    const self = this;
    const layerware = [];
    lodash.keys(staticpages).forEach(function(webpath, index) {
      if (lodash.isString(webpath)) {
        const filepath = staticpages[webpath];
        if (lodash.isString(filepath)) {
          layerware.push(self.getAssetsLayer(webpath, filepath, index));
        }
      }
    })
    layerware.push(webweaverService.getSessionLayer([
      webweaverService.getJsonBodyParserLayer(),
      webweaverService.getUrlencodedBodyParserLayer(),
      this.getValidator(),
      this.getRestLayer()
    ], apiFullPath));
    layerware.push(webweaverService.getDefaultRedirectLayer(['/$', contextPath + '$']));
    webweaverService.push(layerware, pluginCfg.priority);
  }
};

Service.referenceHash = {
  restfrontHandler: 'handler',
  webweaverService: 'app-webweaver/webweaverService'
};

module.exports = Service;
