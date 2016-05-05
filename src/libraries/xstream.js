import {hmrProxy as _hmrProxy} from '../proxy'
import adapter from '@cycle/xstream-adapter'

export const hmrProxy = (...args) => {
  args.unshift([adapter])
  return _hmrProxy.apply(null, args)
}
export default hmrProxy