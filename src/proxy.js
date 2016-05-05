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


const subscribeObserver = (proxy, observer, debug) => {
  observer.dispose = proxy.adapter.streamSubscribe(proxy.sink, {
      next: ::observer.next,
      error: (err) => {
        debug(`sink ${proxy.key} error: ${err.message}`)
      },
      complete: () => {
        debug(`sink ${proxy.key} completed`)
      }
    })
}

const makeSinkProxies = (sinks, getAdapter, debug) => {
  let proxies = {}
  let validSinks = false
  let keys = Object.keys(sinks)
  keys.forEach((key) => {
    let sink = sinks[key]
    let adapter = sink && getAdapter(sink)
    if (adapter){
      validSinks = true
      var proxy = {key, subs: [], observers: []}
      proxy.sink = sink
      proxy.adapter = adapter
      proxy.stream = adapter.adapt({}, (_, observer) => {
        proxy.observers.push(observer)
        let sub = subscribeObserver(proxy, observer, debug)
        proxy.subs.push(sub)
        debug(`stream for sink ${key} created, observers: ${proxy.observers.length}`)
        return () => {
          observer.dispose()
          let index = proxy.observers.indexOf(observer)
          proxy.observers.splice(index, 1)
          debug(`stream for sink ${key} disposed, observers: ${proxy.observers.length}`)
        }
      })
      proxies[key] = proxy
    } else {
      proxies[key] = sink
    }
  })
  return validSinks && proxies
}

const getProxyStreams = (proxies, debug) => {
  return Object.keys(proxies).reduce((obj, key) => {
    let proxy = proxies[key]
    obj[key] = proxy.stream
    return obj
  }, {})
}

const SubscribeProxies = (proxies, sinks, debug, getAdapter) => {
  if (getAdapter(sinks)){
    sinks = {sinks}
  }
  return Object.keys(proxies).forEach((key) => {
    const proxy = proxies[key]
    proxy.sink = sinks[key]
    proxy.observers.map(
      observer => {
        observer.dispose()
        subscribeObserver(proxy, observer, debug)
      }
    )
  })
}
const getDebugMethod = (value) =>
  typeof console === 'object'
    ? typeof console[value] === 'function' ? value
    : console['log'] ? 'log' : ''
    : ''

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
      ? (message) => console[debugMethod](`[Cycle HMR] proxy ${proxyId}: ${message}`)
      : debug
  }

  let proxiedInstances = proxiesStore[proxyId]

  if (proxiedInstances){
    proxiedInstances.forEach(({proxies, sources, rest}) => {
      debug('reload')
      //UnsubscribeProxies(proxies, debug, getAdapter)
      let sinks = dataflow(sources, ...rest)
      SubscribeProxies(proxies, sinks, debug, getAdapter)
    })
  } else {
    proxiedInstances = proxiesStore[proxyId] = []
  }

  return (sources, ...rest) => {
    debug('execute')
    let sinks = dataflow(sources, ...rest)
    const simple = getAdapter(sinks)
    if (simple){
      sinks = {sinks}
    }
    if (typeof sinks  === 'object') {
      let proxies = makeSinkProxies(sinks, getAdapter, debug)
      if (!proxies){
        debug('sink not a stream result')
        return sinks
      }
      proxiedInstances.push({sources, proxies, rest})
      debug('created')
      const proxiedSinks = getProxyStreams(proxies, debug)
      return simple ? proxiedSinks.sinks : proxiedSinks
    } else {
      debug('sink not a stream result')
      return sinks
    }
  }
}
