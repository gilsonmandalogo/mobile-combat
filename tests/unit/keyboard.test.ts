import { describe, expect, it } from 'vitest'
import { KeyboardTracker, keyboardIntent } from '@src/input/keyboard'
import type { KeyTarget } from '@src/input/keyboard'

const bindings = {
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  attackUp: 'KeyG',
  attackDown: 'KeyV',
  block: 'KeyY',
  crouch: 'KeyS',
  superA: 'KeyU',
  superB: 'KeyI',
}

class FakeKeys implements KeyTarget {
  private listeners: Record<string, Array<(event: KeyboardEvent) => void>> = {}

  addEventListener(type: 'keydown' | 'keyup' | 'blur', listener: (event: KeyboardEvent) => void) {
    this.listeners[type] = this.listeners[type] || []
    this.listeners[type].push(listener)
  }

  dispatch(type: 'keydown' | 'keyup' | 'blur', code = '') {
    const event = { code, repeat: false, preventDefault() { /* ignore */ } } as KeyboardEvent
    for (const listener of this.listeners[type] || []) {
      listener(event)
    }
  }
}

describe('keyboard intents', () => {
  it('maps held directions and edges for attacks', () => {
    const held = new Set(['KeyD', 'KeyY'])
    const edges = new Set(['KeyG'])
    expect(keyboardIntent(held, bindings, edges)).toEqual({
      move: 1,
      jump: false,
      attackUp: true,
      attackDown: false,
      block: true,
      crouch: false,
      super: false,
    })
  })

  it('fires super only when both chord keys land together', () => {
    const held = new Set(['KeyU', 'KeyI'])
    expect(keyboardIntent(held, bindings, new Set(['KeyI'])).super).toBe(true)
    expect(keyboardIntent(held, bindings, new Set()).super).toBe(false)
    expect(keyboardIntent(new Set(['KeyU']), bindings, new Set(['KeyU'])).super).toBe(false)
  })

  it('cancels opposite directions', () => {
    const intent = keyboardIntent(new Set(['KeyA', 'KeyD']), bindings, new Set())
    expect(intent.move).toBe(0)
  })

  it('remembers a tap until the frame consumes it', () => {
    const keys = new FakeKeys()
    const tracker = new KeyboardTracker(keys)
    keys.dispatch('keydown', 'Space')
    keys.dispatch('keyup', 'Space')
    const edges = tracker.consumeEdges()
    expect(edges.has('Space')).toBe(true)
    expect(tracker.held.has('Space')).toBe(false)
    expect(tracker.consumeEdges().size).toBe(0)
  })
})
