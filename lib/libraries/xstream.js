'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hmrProxy = undefined;

var _proxy = require('../proxy');

var _xstreamAdapter = require('@cycle/xstream-adapter');

var _xstreamAdapter2 = _interopRequireDefault(_xstreamAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var hmrProxy = exports.hmrProxy = function hmrProxy() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  args.unshift([_xstreamAdapter2.default]);
  return _proxy.hmrProxy.apply(null, args);
};
exports.default = hmrProxy;