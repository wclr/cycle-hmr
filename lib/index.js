'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.proxy = exports.hmrProxy = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _rx = require('rx');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var proxiesStore = {};

var isObservable = function isObservable(obj) {
  return obj && typeof obj.subscribe === 'function';
};

var _makeSinkProxies = function _makeSinkProxies(sinks, makeProxy) {
  var proxies = {};
  var validSinks = false;
  var keys = Object.keys(sinks);
  keys.forEach(function (key) {
    var sink = sinks[key];
    if (isObservable(sink)) {
      validSinks = true;
      proxies[key] = makeProxy(sink);
    } else {
      proxies[key] = sink;
    }
  });
  return validSinks && proxies;
};

var makeSinkProxyObservable = function makeSinkProxyObservable(sink) {
  var proxy = {};
  proxy.stream = _rx.Observable.create(function (observer) {
    proxy.observer = observer;
    proxy.subscription = sink.subscribe(observer);
  });
  return proxy;
};

var makeSinkProxySubject = function makeSinkProxySubject(sink) {
  var replayCount = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

  var subject = new _rx.ReplaySubject(replayCount);
  return {
    stream: subject,
    observer: subject,
    subscription: sink.subscribe(subject)
  };
};

var makeSinkProxiesSubjects = function makeSinkProxiesSubjects(sinks, replayCount) {
  return _makeSinkProxies(sinks, function (sink) {
    return makeSinkProxySubject(sink, replayCount);
  });
};

var makeSinkProxiesObservables = function makeSinkProxiesObservables(sinks) {
  return _makeSinkProxies(sinks, makeSinkProxyObservable);
};

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

var SubscribeProxies = function SubscribeProxies(proxies, sinks, debug) {
  if (isObservable(sinks)) {
    sinks = { sinks: sinks };
  }
  return Object.keys(sinks).forEach(function (key) {
    var proxy = proxies[key];
    proxy.subscription = sinks[key].subscribe(proxy.observer);
  }, {});
};

var UnsubscribeProxies = function UnsubscribeProxies(proxies, debug) {
  return Object.keys(proxies).forEach(function (key) {
    if (proxies[key].subscription) {
      proxies[key].subscription.dispose();
    } else {
      debug('no subscription for sink ' + key);
    }
  }, {});
};

var hmrProxy = exports.hmrProxy = function hmrProxy(dataflow, proxyId) {
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];


  if (typeof dataflow !== 'function') {
    return dataflow;
  }

  if (typeof proxyId !== 'string') {
    throw new Error('You should provide string value of proxy id');
  }
  var debug = options.debug ? function (message) {
    console.warn('[Cycle HRM] proxy ' + proxyId + ': {message}');
  } : function () {};
  var makeSinkProxies = options.useSubject ? function (sinks) {
    return makeSinkProxiesSubjects(parseInt(options.useSubject) || 0);
  } : makeSinkProxiesObservables;

  debug('created');
  var proxiedInstances = proxiesStore[proxyId];

  if (proxiedInstances) {
    proxiedInstances.forEach(function (_ref) {
      var proxies = _ref.proxies;
      var sources = _ref.sources;
      var rest = _ref.rest;

      debug('reload');
      UnsubscribeProxies(proxies, debug);
      var sinks = dataflow.apply(undefined, [sources].concat(_toConsumableArray(rest)));
      SubscribeProxies(proxies, sinks, debug);
    });
  } else {
    proxiedInstances = proxiesStore[proxyId] = [];
  }

  return function (sources) {
    for (var _len = arguments.length, rest = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      rest[_key - 1] = arguments[_key];
    }

    debug('execute');
    var sinks = dataflow.apply(undefined, [sources].concat(rest));
    if (isObservable(sinks)) {
      var proxies = makeSinkProxies({ sinks: sinks });
      proxiedInstances.push({ sources: sources, proxies: proxies, rest: rest });
      return getProxyStreams(proxies).sinks;
    } else if ((typeof sinks === 'undefined' ? 'undefined' : _typeof(sinks)) === 'object') {
      var _proxies = makeSinkProxies(sinks);
      if (!_proxies) {
        debug('sink not a stream result');
        return sinks;
      }
      proxiedInstances.push({ sources: sources, proxies: _proxies, rest: rest });
      return getProxyStreams(_proxies);
    } else {
      debug('sink not a stream result');
      return sinks;
    }
  };
};

exports.proxy = hmrProxy;