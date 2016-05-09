const proxiesStore = {}

let cycleHmrEnabled = true

if (typeof global !== 'undefined'){
  global.cycleHmrProxiesStore = proxiesStore
  if (global.noCycleHmr){
    console.warn('[Cycle HMR] disabled')
    cycleHmrEnabled = false
  }
}

const findValidAdapter = (adapters, stream) =>
  stream && adapters
    .filter(adapter => adapter.isValidStream(stream))[0]

const getDebugMethod = (value) =>
  typeof console === 'object'
    ? typeof console[value] === 'function' ? value
    : console['log'] ? 'log' : ''
    : ''

const makeDebugOutput = (method, proxyId) =>
  (message) => console[method](`[Cycle HMR] proxy ${proxyId}: ${message}`)

export const hmrProxy = (adapters, dataflow, proxyId, options = {}) => {

  if (!cycleHmrEnabled || typeof dataflow !== 'function'){
    return dataflow
  }

  if (typeof proxyId !== 'string'){
    throw Error('You should provide string value of proxy id')
  }
  const getAdapter = stream => findValidAdapter(adapters, stream)

  let debug = () => {}
  if (options.debug){
    const debugMethod = getDebugMethod(options.debug)
    debug = debugMethod
      ? makeDebugOutput(debugMethod, proxyId)
      : debug
  }
  debug.error = makeDebugOutput('error', proxyId)

  const subscribeObserver = (proxy, observer) => {
    const dispose = proxy.adapter.streamSubscribe(proxy.sink, {
      next: ::observer.next,
      error: (err) => {
        debug.error(`sink ${proxy.key} error: ${err.message}`)
      },
      complete: () => {
        debug(`sink ${proxy.key} completed`)
      }
    })
    observer.dispose = () => {
      if (typeof dispose === 'function'){
        dispose()
      }
    }
  }

  const makeSinkProxies = (sinks, keyPrefix = '') => {
    let proxies = {}
    let validSinks = false
    let keys = Object.keys(sinks)
    keys.forEach((key) => {
      let sink = sinks[key]
      let adapter = sink && getAdapter(sink)
      if (adapter){
        validSinks = true
        var proxy = {key: keyPrefix + key, subs: [], observers: []}
        proxy.sink = sink
        proxy.adapter = adapter
        proxy.stream = adapter.adapt({}, (_, observer) => {
          proxy.observers.push(observer)
          let sub = subscribeObserver(proxy, observer)
          proxy.subs.push(sub)
          debug(`stream for sink ${proxy.key} created, observers: ${proxy.observers.length}`)
          return () => {
            observer.dispose()
            let index = proxy.observers.indexOf(observer)
            proxy.observers.splice(index, 1)
            debug(`stream for sink ${proxy.key} disposed, observers: ${proxy.observers.length}`)
          }
        })
        proxies[key] = proxy
      } else {
        if (typeof sink === 'function'){
          validSinks = true
          const fnProxyId = proxyId + '_' + key
          proxies[key] = {
            fnProxyId,
            fn: hmrProxy(adapters, sink, fnProxyId, options)
          }
        } else if (sink && sink.constructor === Object){
          validSinks = true
          proxies[key] = {obj: makeSinkProxies(sink, keyPrefix + key + '.')}
        } else {
          proxies[key] = sink
        }
      }
    })
    return validSinks && proxies
  }

  const getProxySinks = (proxies) => {
    return Object.keys(proxies).reduce((obj, key) => {
      let proxy = proxies[key]
      obj[key] =
        proxy && (
          proxy.stream || proxy.fn
          || (proxy.obj && getProxySinks(proxy.obj))
        ) || proxy
      return obj
    }, {})
  }

  const SubscribeProxies = (proxies, sinks) => {
    if (getAdapter(sinks)){
      sinks = {default: sinks}
    }
    return Object.keys(proxies).forEach((key) => {
      const proxy = proxies[key]
      if (!proxy || !sinks[key]){
        return
      }
      if (proxy.fn) {
        hmrProxy(adapters, sinks[key], proxy.fnProxyId, options)
      } else if (proxy.obj) {
        SubscribeProxies(proxy.obj, sinks[key])
      } if (proxy.observers) {
        proxy.sink = sinks[key]
        proxy.observers.map(
          observer => {
            observer.dispose()
            subscribeObserver(proxy, observer)
          }
        )
      }
    })
  }

  let proxiedInstances = proxiesStore[proxyId]

  if (proxiedInstances){
    proxiedInstances.forEach(({proxies, sources, rest}) => {
      debug('reload')
      //UnsubscribeProxies(proxies)
      let sinks = dataflow(sources, ...rest)
      sinks && SubscribeProxies(proxies, sinks)
    })
  } else {
    proxiedInstances = proxiesStore[proxyId] = []
  }

  return (sources, ...rest) => {
    debug('execute')
    let sinks = dataflow(sources, ...rest)
    if (!sinks){
      return sinks
    }
    const simple = getAdapter(sinks)
    if (simple){
      sinks = {default: sinks}
    }
    if (typeof sinks  === 'object') {
      let proxies = makeSinkProxies(sinks)
      if (!proxies){
        debug('sink not a stream result')
        return sinks
      }
      proxiedInstances.push({sources, proxies, rest})
      debug('created')
      const proxiedSinks = getProxySinks(proxies)
      return simple ? proxiedSinks.default : proxiedSinks
    } else {
      debug('sink not a stream result')
      return sinks
    }
  }
}
