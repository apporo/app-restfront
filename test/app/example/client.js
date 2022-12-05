'use strict';

const main = require('./index.js');
const exampleService = main.runner.getSandboxService('example');

console.log(exampleService.fibonacci({ number: 10 }, {}));
