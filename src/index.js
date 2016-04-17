import {Observable, ReplaySubject, Subject} from 'rx'

const proxiesStore = {}

let logToConsoleError = typeof console !== `undefined` && console.error
  ? error => { console.error(error.stack || error) }
: Function.prototype


// let logToConsoleError = (err) =>{
//   console.warn('cycle-hmr logToConsoleError', err)
// }
//

const makeSinkProxiesSubjects = (sinks) => {
  let proxies = {}
  let keys = Object.keys(sinks)
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i]
    let subject = new ReplaySubject(0)
    proxies[key] = {stream: subject, observer: subject}
    proxies[key].subscription = sinks[key].subscribe(subject)
  }
  return proxies
}

const makeSinkProxiesObservables = (sinks) => {
  let proxies = {}
  let keys = Object.keys(sinks)
  keys.forEach((key) => {
    let proxy = proxies[key] = {}
    let sink = sinks[key]
    proxy.stream = Observable.create((observer) => {
      console.warn('makeSinkProxiesObservables', key)
      proxy.observer = observer
      proxy.subscription = sink.subscribe(observer)
      console.warn('subscribed to', key)
    })
  })
  return proxies
}

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
      console.warn('UnsubscribeProxies: no subscription for sink', key)
    }
  }, {})
}

const isObservable = (obj) => {
  return obj && typeof obj.subscribe === 'function'
}

export const hmrProxy = (dataflow, proxyId) => {
  
  if (typeof dataflow !== 'function'){
    return dataflow
  }
  
  console.warn('HRM proxy', proxyId)
  let proxiedInstances = proxiesStore[proxyId]
  
  if (proxiedInstances){
    proxiedInstances.forEach(proxied => {
      console.warn('HRM proxy', proxyId, 'reload')
      UnsubscribeProxies(proxied.proxies)
      let sinks = dataflow(proxied.sources)
      SubscribeProxies(proxied.proxies, sinks)
    })
  } else {
    proxiedInstances = proxiesStore[proxyId] = []
  }
  
  return (sources, ...rest) => {
    console.warn('HRM proxy', proxyId, 'execute')
    const sinks = dataflow(sources, ...rest)
    if (isObservable(sinks)){
      
    } else if (typeof sinks  === 'object') {
      const proxies = makeSinkProxies(sinks)
      proxiedInstances.push({sources, proxies})
      return getProxyStreams(proxies)
    } else {
      return sinks
    }
  }
}

export {hmrProxy as proxy}