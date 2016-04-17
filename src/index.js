import {Observable, ReplaySubject, Subject} from 'rx'

const proxiesStore = {}

let logToConsoleError = typeof console !== `undefined` && console.error
  ? error => { console.error(error.stack || error) }
: Function.prototype


// let logToConsoleError = (err) =>{
//   console.warn('cycle-hmr logToConsoleError', err)
// }
//

const isObservable = (obj) => {
  return obj && typeof obj.subscribe === 'function'
}

const _makeSinkProxies = (sinks, makeProxy) => {
  let proxies = {}
  let validSinks = false
  let keys = Object.keys(sinks)
  keys.forEach((key) => {
    let sink = sinks[key]
    if (isObservable(sink)){
      validSinks = true
      proxies[key] = makeProxy(sink)
    } else {
      proxies[key] = sink
    }
  })
  return validSinks && proxies
}

const makeSinkProxyObservable = (sink) => {
  let proxy = {}
  proxy.stream = Observable.create((observer) => {
    proxy.observer = observer
    proxy.subscription = sink.subscribe(observer)
  })
  return proxy
}

const makeSinkProxySubject = (sink) => {
  let subject = new ReplaySubject(0)
  return {
    stream: subject,
    observer: subject,
    subscription: sink.subscribe(subject)
  }
}

const makeSinkProxiesSubjects = (sinks) =>
  _makeSinkProxies(sinks, makeSinkProxySubject)


const makeSinkProxiesObservables = (sinks) =>
  _makeSinkProxies(sinks, makeSinkProxyObservable)

//const makeSinkProxies = makeSinkProxiesSubjects
const makeSinkProxies = makeSinkProxiesObservables

const getProxyStreams = (proxies) => {
  return Object.keys(proxies).reduce((obj, key) => {
    obj[key] = proxies[key].stream.finally(() => {
      //if (proxies[key].subscribtion){
        proxies[key].subscription.dispose()
      //}
    })
    return obj
  }, {})
}

const SubscribeProxies = (proxies, sinks) => {
  if (isObservable(sinks)){
    sinks = {sinks}
  }
  return Object.keys(sinks).forEach((key) => {
    const proxy = proxies[key]
    console.warn('subscribe to', key)
    proxy.subscription = sinks[key].subscribe(proxy.observer)
  }, {})
}

const UnsubscribeProxies = (proxies) => {
  return Object.keys(proxies).forEach((key) => {
    if (proxies[key].subscription){
      proxies[key].subscription.dispose()
    } else {
      console.warn('[Cycle HRM] UnsubscribeProxies: no subscription for sink', key)
    }
  }, {})
}

export const hmrProxy = (dataflow, proxyId) => {
  
  if (typeof dataflow !== 'function'){
    return dataflow
  }
  
  console.warn('[Cycle HRM] proxy created', proxyId)
  let proxiedInstances = proxiesStore[proxyId]
  
  if (proxiedInstances){
    proxiedInstances.forEach(proxied => {
      console.warn('[Cycle HRM] proxy', proxyId, 'reload')
      UnsubscribeProxies(proxied.proxies)
      let sinks = dataflow(proxied.sources)
      SubscribeProxies(proxied.proxies, sinks)
    })
  } else {
    proxiedInstances = proxiesStore[proxyId] = []
  }
  
  return (sources, ...rest) => {
    console.warn('[Cycle HRM] proxy', proxyId, 'execute')
    const sinks = dataflow(sources, ...rest)
    if (isObservable(sinks)){
      let proxies = makeSinkProxies({sinks})
      proxiedInstances.push({sources, proxies})
      return getProxyStreams(proxies).sinks
    } else if (typeof sinks  === 'object') {
      let proxies = makeSinkProxies(sinks)
      if (!proxies){
        return
      }
      proxiedInstances.push({sources, proxies})
      return getProxyStreams(proxies)
    } else {
      return sinks
    }
  }
}

export {hmrProxy as proxy}