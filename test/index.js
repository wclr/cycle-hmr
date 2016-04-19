import {Observable as O, Subject} from 'rx'
import {proxy} from '../lib/index'
import test from 'tape'

const getRandomId = () =>  Math.random(1).toString().slice(4, 8)

test('basic', t => {

  const func = ({input$}, rest, rest2) => {
    t.is(rest, 'rest', 'rest param is ok')
    t.is(rest2, 'rest2', 'rest2 param is ok')

    return {
      output$: input$.map(x => x * 2)
    }
  }

  let funcProxy = proxy(func, getRandomId())
  let input$ = O.of(1)
  let sink = funcProxy({input$}, 'rest', 'rest2')
  //console.log('sink.output$', sink.output$.subscribe)
  sink.output$.subscribe((y) => {
    t.is(y, 2, 'output is ok')
    t.end()
  }, t.error)

})

test('simple sink steam', t => {

  const func = ({input$}) => {
    return input$.map(x => x * 2)
  }

  let funcProxy = proxy(func, getRandomId())
  let input$ = O.of(1)
  let sink = funcProxy({input$}, 'rest', 'rest2')
  //console.log('sink.output$', sink.output$.subscribe)
  sink.subscribe((y) => {
    t.is(y, 2, 'output is ok')
    t.end()
  }, t.error)

})

test('basic reload', t => {
  var proxyId = getRandomId()

  const func = ({input$}, rest, rest2) => {
    return {
      output$: input$.map(x => x * 2)
    }
  }

  const funcReloaded = ({input$}, rest, rest2) => {
    t.is(rest, 'rest', 'rest param is ok')
    t.is(rest2, 'rest2', 'rest2 param is ok')
    return {
      output$: input$.map(x => x * 20)
    }
  }

  let funcProxy = proxy(func, proxyId)
  let input$ = new Subject()
  let sink = funcProxy({input$}, 'rest', 'rest2')
  //console.log('sink.output$', sink.output$.subscribe)
  let reloaded = false
  sink.output$.subscribe((y) => {
    if (!reloaded){
      t.is(y, 2, 'output is ok')
    } else {
      t.is(y, 40, 'reloaded output is ok')
      t.end()
    }
  }, t.error)
  input$.onNext(1)
  setTimeout(() => {
    proxy(funcReloaded, proxyId)
    reloaded = true
    input$.onNext(2)
  }, 100)
})

test('transparently proxy not cycle functions', t => {
  const str = 'str'
  const obj = {a: 1}
  const fn = x => x*2
  const fnObj = x => ({value: x*2})
  t.is(proxy(str, getRandomId()), 'str', 'proxied constant value is ok')
  t.is(proxy(obj, getRandomId()), obj, 'proxied object ref is ok')
  t.is(proxy(obj, getRandomId()).a, 1, 'proxied object prop is ok')
  t.is(proxy(obj, getRandomId()).a, 1, 'proxied object prop is ok')
  t.is(proxy(fn, getRandomId())(2), 4, 'proxied function returned result is ok')
  t.is(proxy(fnObj, getRandomId())(2).value, 4, 'proxied function returned object is ok')
  t.end()
})