'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.proxy = exports.hmrProxy = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _rx = require('rx');

var proxiesStore = {};

var logToConsoleError = typeof console !== 'undefined' && console.error ? function (error) {
  console.error(error.stack || error);
} : Function.prototype;

// let logToConsoleError = (err) =>{
//   console.warn('cycle-hmr logToConsoleError', err)
// }
//

var makeSinkProxiesSubjects = function makeSinkProxiesSubjects(sinks) {
  var proxies = {};
  var keys = Object.keys(sinks);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var subject = new _rx.ReplaySubject(0);
    proxies[key] = { stream: subject, observer: subject };
    proxies[key].subscription = sinks[key].subscribe(subject);
  }
  return proxies;
};

var makeSinkProxiesObservables = function makeSinkProxiesObservables(sinks) {
  var proxies = {};
  var keys = Object.keys(sinks);
  keys.forEach(function (key) {
    var proxy = proxies[key] = {};
    var sink = sinks[key];
    proxy.stream = _rx.Observable.create(function (observer) {
      console.warn('makeSinkProxiesObservables', key);
      proxy.observer = observer;
      proxy.subscription = sink.subscribe(observer);
      console.warn('subscribed to', key);
    });
  });
  return proxies;
};

//const makeSinkProxies = makeSinkProxiesSubjects
var makeSinkProxies = makeSinkProxiesObservables;

var getProxyStreams = function getProxyStreams(proxies) {
  return Object.keys(proxies).reduce(function (obj, key) {
    obj[key] = proxies[key].stream.finally(function () {
      //if (proxies[key].subscribtion){
      proxies[key].subscription.dispose();
      //}
    });
    return obj;
  }, {});
};

var SubscribeProxies = function SubscribeProxies(proxies, sinks) {
  return Object.keys(sinks).forEach(function (key) {
    var proxy = proxies[key];
    console.warn('subscribe to', key);
    proxy.subscription = sinks[key].subscribe(proxy.observer);
  }, {});
};

var UnsubscribeProxies = function UnsubscribeProxies(proxies) {
  return Object.keys(proxies).forEach(function (key) {
    if (proxies[key].subscription) {
      proxies[key].subscription.dispose();
    } else {
      console.warn('UnsubscribeProxies: no subscription for sink', key);
    }
  }, {});
};

var isObservable = function isObservable(obj) {
  return obj && typeof obj.subscribe === 'function';
};

var hmrProxy = exports.hmrProxy = function hmrProxy(dataflow, proxyId) {

  if (typeof dataflow !== 'function') {
    return dataflow;
  }

  console.warn('HRM proxy', proxyId);
  var proxiedInstances = proxiesStore[proxyId];

  if (proxiedInstances) {
    proxiedInstances.forEach(function (proxied) {
      console.warn('HRM proxy', proxyId, 'reload');
      UnsubscribeProxies(proxied.proxies);
      var sinks = dataflow(proxied.sources);
      SubscribeProxies(proxied.proxies, sinks);
    });
  } else {
    proxiedInstances = proxiesStore[proxyId] = [];
  }

  return function (sources) {
    for (var _len = arguments.length, rest = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      rest[_key - 1] = arguments[_key];
    }

    console.warn('HRM proxy', proxyId, 'execute');
    var sinks = dataflow.apply(undefined, [sources].concat(rest));
    if (isObservable(sinks)) {} else if ((typeof sinks === 'undefined' ? 'undefined' : _typeof(sinks)) === 'object') {
      var proxies = makeSinkProxies(sinks);
      proxiedInstances.push({ sources: sources, proxies: proxies });
      return getProxyStreams(proxies);
    } else {
      return sinks;
    }
  };
};

exports.proxy = hmrProxy;