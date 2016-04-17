import {Observable as O, Subject, ReplaySubject} from 'rx'
import {proxy} from '../lib/index'
import test from 'tape'

test('just', t => {

  const func = ({input$}, rest, rest2) => {
    t.is(rest, 'rest', 'rest param is ok')
    t.is(rest2, 'rest2', 'rest2 param is ok')
    
    return {
      output$: input$.map(x => x * 2)
    }
  }

  let funcProxy = proxy(func, 'X')
  let input$ = O.of(1)
  let sink = funcProxy({input$}, 'rest', 'rest2')
  //console.log('sink.output$', sink.output$.subscribe)
  sink.output$.subscribe((y) => {
    console.log('input$', y)
    t.is(y, 2, 'output is ok')
    t.end()
  }, t.error)

})

