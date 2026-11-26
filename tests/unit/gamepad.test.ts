import { describe, expect, it } from 'vitest'
import { DEFAULT_PAD, gamepadIntent, mergeGamepads, vibrateGamepad } from '@src/input/gamepad'
import type { PadSnapshot } from '@src/input/gamepad'

function pad(partial: Partial<PadSnapshot> = {}): PadSnapshot {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
  return {
    index: 0,
    connected: true,
    axes: [0, 0, 0, 0],
    buttons,
    mapping: 'standard',
    id: 'test',
    ...partial,
  }
}

describe('gamepad intents', () => {
  it('reads the stick, d-pad, and rising button edges', () => {
    const held = pad({ axes: [0.8, 0] })
    held.buttons[DEFAULT_PAD.block] = { pressed: true, value: 1 }
    held.buttons[DEFAULT_PAD.attackUp] = { pressed: true, value: 1 }
    const first = gamepadIntent(held, DEFAULT_PAD, [])
    expect(first.intent).toMatchObject({ move: 1, attackUp: true, block: true, jump: false })

    const second = gamepadIntent(held, DEFAULT_PAD, first.pressed)
    expect(second.intent.attackUp).toBe(false)
    expect(second.intent.block).toBe(true)

    const dpad = pad()
    dpad.buttons[14] = { pressed: true, value: 1 }
    expect(gamepadIntent(dpad, DEFAULT_PAD, []).intent.move).toBe(-1)
  })

  it('ignores a disconnected pad and a stick inside the deadzone', () => {
    expect(gamepadIntent(null, DEFAULT_PAD, []).intent.move).toBe(0)
    expect(gamepadIntent(pad({ axes: [0.2, 0] }), DEFAULT_PAD, []).intent.move).toBe(0)
  })

  it('lets a virtual pad replace a native pad with the same index', () => {
    const native = {
      index: 0,
      connected: true,
      axes: [1, 0],
      buttons: [],
      mapping: 'standard',
      id: 'native',
    }
    const virtual = pad({ id: 'virtual', axes: [-1, 0] })
    const merged = mergeGamepads([native], [virtual])
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('virtual')
    expect(gamepadIntent(merged[0], DEFAULT_PAD, []).intent.move).toBe(-1)
  })
})

describe('gamepad haptics', () => {
  it('uses vibrationActuator when the browser provides it', () => {
    const calls: unknown[] = []
    const ok = vibrateGamepad({
      index: 0,
      connected: true,
      axes: [],
      buttons: [],
      mapping: 'standard',
      id: 'pad',
      vibrationActuator: {
        playEffect: (type, params) => {
          calls.push({ type, params })
          return Promise.resolve()
        },
      },
    }, 0.8, 0.2, 120)
    expect(ok).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('falls back to hapticActuators and then reports that rumble is unavailable', () => {
    const pulses: number[] = []
    const legacy = vibrateGamepad({
      index: 0,
      connected: true,
      axes: [],
      buttons: [],
      mapping: '',
      id: 'old',
      hapticActuators: [{
        pulse: (value) => {
          pulses.push(value)
        },
      }],
    }, 0.5, 0.1, 40)
    expect(legacy).toBe(true)
    expect(pulses[0]).toBe(0.5)

    expect(vibrateGamepad({
      index: 0,
      connected: true,
      axes: [],
      buttons: [],
      mapping: '',
      id: 'none',
    }, 1, 1, 10)).toBe(false)
  })
})
