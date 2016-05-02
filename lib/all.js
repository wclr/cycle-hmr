'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hmrProxy = undefined;

var _proxy = require('./proxy');

var adapters = [];

try {
  adapters.push(require('@cycle/rx-adapter').default);
} catch (e) {}

try {
  adapters.push(require('@cycle/xstream-adapter').default);
} catch (e) {}

try {
  adapters.push(require('@cycle/rxjs-adapter').default);
} catch (e) {}

try {
  adapters.push(require('@cycle/most-adapter').default);
} catch (e) {}
var hmrProxy = exports.hmrProxy = function hmrProxy() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  if (!adapters) {
    console.warn('[Cycle HMR] no adapter modules found');
  }
  args.unshift(adapters);
  return _proxy.hmrProxy.apply(null, args);
};