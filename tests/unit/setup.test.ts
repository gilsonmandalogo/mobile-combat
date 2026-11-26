import { describe, expect, it } from 'vitest'
import { deviceValue, parseDevice, readMatchSetup } from '@src/ui/setup'

describe('match setup', () => {
  it('reads mode, difficulty, names, and devices', () => {
    const setup = readMatchSetup({
      mode: 'ai',
      difficulty: 'hard',
      name1: '  Rio  ',
      name2: '',
      device1: 'keyboard',
      device2: 'pad-0',
    })
    expect(setup.mode).toBe('ai')
    expect(setup.difficulty).toBe('hard')
    expect(setup.name1).toBe('Rio')
    expect(setup.name2).toBe('Player 2')
    expect(setup.device1).toEqual({ device: 'keyboard', gamepadIndex: 0 })
    expect(setup.device2).toEqual({ device: 'gamepad', gamepadIndex: 0 })
  })

  it('falls back when the form values are unknown', () => {
    const setup = readMatchSetup({
      mode: 'online',
      difficulty: 'nightmare',
      name1: '   ',
      name2: 'A very long fighter name that will be cut',
      device1: 'dance-pad',
      device2: 'pad-1',
    })
    expect(setup.mode).toBe('local')
    expect(setup.difficulty).toBe('normal')
    expect(setup.name1).toBe('Player 1')
    expect(setup.name2).toBe('A very long fighte')
    expect(parseDevice('nope', 1)).toEqual({ device: 'keyboard', gamepadIndex: 1 })
    expect(deviceValue({ device: 'gamepad', gamepadIndex: 1 })).toBe('pad-1')
  })
})
