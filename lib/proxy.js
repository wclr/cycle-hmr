'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var proxiesStore = {};

var cycleHmrEnabled = true;

if (typeof global !== 'undefined') {
  global.cycleHmrProxiesStore = proxiesStore;
  if (global.noCycleHmr) {
    console.warn('[Cycle HMR] disabled');
    cycleHmrEnabled = false;
  }
}

var findValidAdapter = function findValidAdapter(adapters, stream) {
  return stream && adapters.filter(function (adapter) {
    return adapter.isValidStream(stream);
  })[0];
};

var subscribeObserver = function subscribeObserver(proxy, observer, debug) {
  observer.dispose = proxy.adapter.streamSubscribe(proxy.sink, {
    next: observer.next.bind(observer),
    error: function error(err) {
      debug('sink ' + proxy.key + ' error: ' + err.message);
    },
    complete: function complete() {
      debug('sink ' + proxy.key + ' completed');
    }
  });
};

var makeSinkProxies = function makeSinkProxies(sinks, getAdapter, debug) {
  var proxies = {};
  var validSinks = false;
  var keys = Object.keys(sinks);
  keys.forEach(function (key) {
    var sink = sinks[key];
    var adapter = sink && getAdapter(sink);
    if (adapter) {
      validSinks = true;
      var proxy = { key: key, subs: [], observers: [] };
      proxy.sink = sink;
      proxy.adapter = adapter;
      proxy.stream = adapter.adapt({}, function (_, observer) {
        proxy.observers.push(observer);
        var sub = subscribeObserver(proxy, observer, debug);
        proxy.subs.push(sub);
        debug('stream for sink ' + key + ' created, observers: ' + proxy.observers.length);
        return function () {
          observer.dispose();
          var index = proxy.observers.indexOf(observer);
          proxy.observers.splice(index, 1);
          debug('stream for sink ' + key + ' disposed, observers: ' + proxy.observers.length);
        };
      });
      proxies[key] = proxy;
    } else {
      proxies[key] = sink;
    }
  });
  return validSinks && proxies;
};

var getProxyStreams = function getProxyStreams(proxies, debug) {
  return Object.keys(proxies).reduce(function (obj, key) {
    var proxy = proxies[key];
    obj[key] = proxy.stream;
    return obj;
  }, {});
};

var SubscribeProxies = function SubscribeProxies(proxies, sinks, debug, getAdapter) {
  if (getAdapter(sinks)) {
    sinks = { sinks: sinks };
  }
  return Object.keys(proxies).forEach(function (key) {
    var proxy = proxies[key];
    proxy.sink = sinks[key];
    proxy.observers.map(function (observer) {
      observer.dispose();
      subscribeObserver(proxy, observer, debug);
    });
  });
};
var getDebugMethod = function getDebugMethod(value) {
  return (typeof console === 'undefined' ? 'undefined' : _typeof(console)) === 'object' ? typeof console[value] === 'function' ? value : console['log'] ? 'log' : '' : '';
};

var hmrProxy = exports.hmrProxy = function hmrProxy(adapters, dataflow, proxyId) {
  var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];


  if (!cycleHmrEnabled || typeof dataflow !== 'function') {
    return dataflow;
  }

  if (typeof proxyId !== 'string') {
    throw Error('You should provide string value of proxy id');
  }
  var getAdapter = function getAdapter(stream) {
    return findValidAdapter(adapters, stream);
  };

  var debug = function debug() {};
  if (options.debug) {
    (function () {
      var debugMethod = getDebugMethod(options.debug);
      debug = debugMethod ? function (message) {
        return console[debugMethod]('[Cycle HMR] proxy ' + proxyId + ': ' + message);
      } : debug;
    })();
  }

  var proxiedInstances = proxiesStore[proxyId];

  if (proxiedInstances) {
    proxiedInstances.forEach(function (_ref) {
      var proxies = _ref.proxies;
      var sources = _ref.sources;
      var rest = _ref.rest;

      debug('reload');
      //UnsubscribeProxies(proxies, debug, getAdapter)
      var sinks = dataflow.apply(undefined, [sources].concat(_toConsumableArray(rest)));
      SubscribeProxies(proxies, sinks, debug, getAdapter);
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
    var simple = getAdapter(sinks);
    if (simple) {
      sinks = { sinks: sinks };
    }
    if ((typeof sinks === 'undefined' ? 'undefined' : _typeof(sinks)) === 'object') {
      var proxies = makeSinkProxies(sinks, getAdapter, debug);
      if (!proxies) {
        debug('sink not a stream result');
        return sinks;
      }
      proxiedInstances.push({ sources: sources, proxies: proxies, rest: rest });
      debug('created');
      var proxiedSinks = getProxyStreams(proxies, debug);
      return simple ? proxiedSinks.sinks : proxiedSinks;
    } else {
      debug('sink not a stream result');
      return sinks;
    }
  };
};