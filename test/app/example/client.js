'use strict';

var main = require('./index.js');
var exampleService = main.runner.getSandboxService('example');

console.log(exampleService.fibonacci({ number: 10 }, {}));
