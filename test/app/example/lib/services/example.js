'use strict';

const Devebot = require('devebot');
const Promise = Devebot.require('bluebird');
const chores = Devebot.require('chores');
const Fibonacci = require('../utils/fibonacci');

const Service = function(params) {
  params = params || {};

  const L = params.loggingFactory.getLogger();
  const T = params.loggingFactory.getTracer();
  const blockRef = chores.getBlockRef(__filename, params.packageName);

  params.errorManager.register(params.packageName, {
    errorCodes: params.sandboxConfig.errorCodes
  });

  params.errorManager.register('otherErrorSource', {
    errorCodes: params.sandboxConfig.otherErrorSource
  });

  this.fibonacci = function(data, opts) {
    opts = opts || {};
    const reqTr = T.branch({ key: 'requestId', value: opts.requestId || T.getLogID() });
    L.has('debug') && L.log('debug', reqTr.add({ data: data }).toMessage({
      tags: [ blockRef, 'fibonacci' ],
      text: ' - fibonacci[${requestId}] is invoked with parameters: ${data}'
    }));
    if (!data.number || data.number < 0 || data.number > 50) {
      return Promise.reject({
        input: data,
        message: 'invalid input number'
      });
    }
    const fibonacci = new Fibonacci(data);
    const result = fibonacci.finish();
    result.actionId = data.actionId;
    L.has('debug') && L.log('debug', reqTr.add({ result: result }).toMessage({
      tags: [ blockRef, 'fibonacci' ],
      text: ' - fibonacci[${requestId}] result: ${result}'
    }));
    if (data.delay && data.delay > 0) {
      return Promise.resolve(result).delay(data.delay);
    }
    return result;
  };
};

Service.referenceHash = {
  errorManager: 'app-errorlist/manager'
};

module.exports = Service;
