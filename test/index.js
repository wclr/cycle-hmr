import {Observable as O, Subject} from 'rx'
import {hmrProxy as proxy} from '../lib'
import {hmrProxy as rxProxy} from '../rx'
import {hmrProxy as rxjsProxy} from '../rxjs'
import {hmrProxy as xsProxy} from '../xstream'

import RxCycle from '@cycle/rx-run'
import RxjsCycle from '@cycle/rxjs-run'
import XsCycle from '@cycle/xstream-run'
//import {run as motorRun} from '@motorcycle/core'
//import mostAdapter from '@cycle/most-adapter'
//import MostCycle from '@cycle/most-run'
import xs from 'xstream'
import most from 'most'
import Rxjs from 'rxjs'

import test from 'tape'

const getRandomId = () =>  Math.random(1).toString().slice(4, 8)
const debug = false

test('Proxying cycle function with single steam sink (not object)', t => {
  const func = ({input$}) => {
    return input$.map(x => x * 2)
  }

  let funcProxy = proxy(func, getRandomId())
  let input$ = O.of(1)
  let sink = funcProxy({input$})

  sink.subscribe((y) => {
    t.is(y, 2, 'output of stream should not change')
    t.end()
  }, t.error)
})

test('Proxing cycle functjion of simple sink object', t => {
  const func = ({input$}, rest, rest2) => {
    t.is(rest, 'rest', 'first rest source param should be passed transparently')
    t.is(rest2, 'rest2', 'second rest param should passed transparently')
    return {
      output$: input$.map(x => x * 2)
    }
  }

  let funcProxy = proxy(func, getRandomId())
  let input$ = O.of(1)
  let sink = funcProxy({input$}, 'rest', 'rest2')
  sink.output$.subscribe((y) => {
    t.is(y, 2, 'proxied function output should be correct')
    t.end()
  }, t.error)
})

test('Dataflow with sink contains factory function', t => {
  const dataflow = ({input$}, rest, rest2) => {
    return {
      x: 1,
      empty: null,
      output: () => input$.map(x => x * 2)
    }
  }
  const dataflowReloaded = ({input$}, rest, rest2) => {
    return {
      x: 2,
      output: () => input$.map(x => x * 20)
    }
  }
  const proxyId = getRandomId()
  let dataflowProxy = proxy(dataflow, proxyId)
  let input$ = O.of(1)
  let sinks = dataflowProxy({input$})
  t.is(sinks.x, 1, 'number is proxied transparent with no changes')
  t.is(sinks.empty, null, 'nil is proxied transparent with no changes')
  let sink = sinks.output()
  proxy(dataflowReloaded, proxyId)
  sink.subscribe((y) => {
    t.is(y, 20, 'proxied function output should be correct')
    t.end()
  }, t.error)
})

test('Dataflow with sink contains (deep) nested object', t => {
  const dataflow = ({input$}, rest, rest2) => {
    return {
      deep: {
        nested: {
          output$: input$.map(x => x * 2)
        }
      }
    }
  }
  const dataflowReloaded = ({input$}, rest, rest2) => {
    return {
      deep: {
        nested: {
          output$: input$.map(x => x * 20)
        }
      }
    }
  }
  const proxyId = getRandomId()
  let dataflowProxy = proxy(dataflow, proxyId)
  let input$ = O.of(1)
  let sinks = dataflowProxy({input$})
  let sink = sinks.deep.nested.output$
  proxy(dataflowReloaded, proxyId)
  sink.subscribe((y) => {
    t.is(y, 20, 'proxied function output should be correct')
    t.end()
  }, t.error)
})

test('Double reload scenario', t => {
  var proxyId = getRandomId()

  const func = ({input$}, rest, rest2) => {
    return {
      // completed stream
      output$: input$.map(x => x * 2).take(1)
    }
  }

  const funcReloaded = ({input$}, rest, rest2) => {
    t.is(rest, 'rest', 'first rest source param stays the same')
    t.is(rest2, 'rest2', 'second rest source param stays the same')
    return {
      output$: input$.map(x => x * 20).take(1)
    }
  }

  const funcReloaded2 = ({input$}, rest, rest2) => {
    t.is(rest, 'rest', 'first rest source param stays the same')
    t.is(rest2, 'rest2', 'second rest source param stays the same')
    return {
      output$: input$.map(x => x * 200)
    }
  }

  let funcProxy = proxy(func, proxyId, {debug})
  let input$ = new Subject()
  let sink = funcProxy({input$}, 'rest', 'rest2')
  
  let reloaded = 0
  sink.output$.subscribe((y) => {
    if (reloaded === 0){
      t.is(y, 2, 'initial output should be correct')
    }
    if (reloaded === 1) {
      t.is(y, 40, 'reloaded output should be correct')
    }
    if (reloaded === 2) {
      t.is(y, 400, 'next reloaded output should be correct')
      t.end()
    }
  }, t.error)
  input$.onNext(1)
  setTimeout(() => {
    proxy(funcReloaded, proxyId, {debug})
    reloaded++
    input$.onNext(2)
    setTimeout(() => {
      proxy(funcReloaded2, proxyId, {debug})
      reloaded++
      input$.onNext(2)
    }, 100)
  }, 100)
})

test('Proxing of non cycle functions', t => {
  const str = 'str'
  const obj = {a: 1}
  const fn = x => x*2
  const fnNil = x => null
  const fnObj = x => ({value: x*2})
  t.is(proxy(str, getRandomId()), 'str', 'proxied constant value is ok')
  t.is(proxy(obj, getRandomId()), obj, 'proxied object ref is ok')
  t.is(proxy(obj, getRandomId()).a, 1, 'proxied object prop is ok')
  t.is(proxy(obj, getRandomId()).a, 1, 'proxied object prop is ok')
  t.is(proxy(fn, getRandomId())(2), 4, 'proxied function returned result is ok')
  t.is(proxy(fnNil, getRandomId())(), null, 'proxied nil function returned result is ok')
  t.is(proxy(fnObj, getRandomId())(2).value, 4, 'proxied function returned object is ok')
  t.end()
})

const makeRunText = (Cycle, proxy, interval, subscribe = 'subscribe') => (t) => {
  let count = 0
  let sinkCount = 0
  let value
  const testTimeout = 500
  const func = (input$) => {
    return {
      output$: input$.map(x => x * 2)
    }
  }
  const funcReloaded = (input$) => {
    return {
      output$: input$.map(x => x * 2000)
    }
  }
  const proxyId = 'func_' + getRandomId()
  const mainProxyId = 'main_' + getRandomId()

  let funcProxy = proxy(func, proxyId)

  const main = ({}) => {
    const output$ = funcProxy(interval(80)).output$
    return {
      other: output$.take(1),
      log: output$
        .map((x) => {
          count++
          return x
        })
    }
  }

  const {sinks, sources, run} = Cycle(
    proxy(main, mainProxyId), {
    other: (messages$, runSA) => {
      return runSA.streamSubscribe(messages$, {
        next: x => {
          t.is(x, 0, 'completed stream value ok')
        },
        error: () => {},
        complete: () => {}
      })
    },
    log: (messages$, runSA) => {
      return runSA.streamSubscribe(messages$, {
        next: x => {
          value = x
          sinkCount++
        },
        error: () => {},
        complete: () => {}
      })
    }
  })
  var dispose = run()

  proxy(funcReloaded, proxyId)

  setTimeout(() => {
    dispose()
    setTimeout(() => {
      t.ok(value > 1000, 'last value:' + value + ' was proxied')
      t.is(count, sinkCount, 'no leaking')
      t.end()
    }, 1000)
  }, testTimeout)

}

test('Cycle function with disposal (rx)',
  makeRunText(RxCycle, rxProxy, O.interval)
)

test('Cycle function with disposal (rxjs)',
  makeRunText(RxjsCycle, rxjsProxy, Rxjs.Observable.interval)
)

test('Cycle function with disposal (xstream)',
  makeRunText(XsCycle, xsProxy, xs.periodic, 'addListener')
)

//const MotorCycle = (main, drivers) => {
//  const {sinks, sources} = motorRun(main, drivers)
//  const run = () => () => {
//    sinks.dispose()
//    sources.dispose()
//  }
//  return {sinks, sources, run}
//}
//
//test.only('Cycle function with disposal (motorcycle)',
//  makeRunText(MotorCycle, most.interval, 'addListener')
//)
