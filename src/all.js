import {hmrProxy as _hmrProxy} from './proxy'

var adapters = []

try {
  adapters.push(require('@cycle/rx-adapter').default)
} catch(e){}

try {
  adapters.push(require('@cycle/xstream-adapter').default)
} catch(e){}

try {
  adapters.push(require('@cycle/rxjs-adapter').default)
} catch(e){}

try {
  adapters.push(require('@cycle/most-adapter').default)
} catch(e){
}
export const hmrProxy = (...args) => {
  if (!adapters){
    console.warn('[Cycle HMR] no adapter modules found')
  }
  args.unshift(adapters)
  return _hmrProxy.apply(null, args)
}
