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