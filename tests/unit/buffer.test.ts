import { describe, expect, it } from 'vitest'
import { bestCombo, emptyMotion, holdsJump, pushMotion } from '@src/sim/buffer'
import type { ComboSpec, InputToken, Intent, MotionMemory } from '@src/sim/types'
import { EMPTY_INTENT } from '@src/sim/types'

function press(memory: MotionMemory, intent: Partial<Intent>, facing: 1 | -1 = 1, dt = 1 / 60) {
  return pushMotion(memory, { ...EMPTY_INTENT, ...intent }, facing, dt)
}

function sequence(steps: Array<{ intent: Partial<Intent>; dt?: number; facing?: 1 | -1 }>) {
  let memory = emptyMotion()
  let fresh: InputToken[] = []
  for (const step of steps) {
    const next = press(memory, step.intent, step.facing ?? 1, step.dt ?? 0.05)
    memory = next.memory
    fresh = next.fresh
  }
  return { memory, fresh }
}

const jab: ComboSpec = {
  id: 'jab',
  name: 'Jab special',
  sequence: ['back', 'punch'],
  window: 0.4,
  damage: 8,
  effect: 'dash',
  startup: 0.1,
  active: 0.1,
  recovery: 0.2,
  reach: 1,
  hitY: 1,
  hitW: 0.5,
  hitH: 0.5,
  knockback: 3,
  hop: 0,
}

const fireball: ComboSpec = {
  id: 'fireball',
  name: 'Fireball',
  sequence: ['back', 'forward', 'punch'],
  window: 0.5,
  damage: 16,
  effect: 'projectile',
  startup: 0.1,
  active: 0.1,
  recovery: 0.2,
  reach: 1,
  hitY: 1,
  hitW: 0.4,
  hitH: 0.4,
  knockback: 4,
  hop: 0,
}

describe('input buffer', () => {
  it('reads directions relative to facing and ignores a held input', () => {
    const back = press(emptyMotion(), { move: -1 }, 1)
    expect(back.fresh).toEqual(['back'])
    const held = press(back.memory, { move: -1 }, 1, 0.1)
    expect(held.fresh).toEqual([])

    const mirrored = press(emptyMotion(), { move: -1 }, -1)
    expect(mirrored.fresh).toEqual(['forward'])
    const buttons = press(emptyMotion(), { jump: true, attackUp: true, attackDown: true })
    expect(buttons.fresh).toEqual(['up', 'punch', 'kick'])
  })

  it('matches a sequence only inside its window and only on the completing press', () => {
    const done = sequence([
      { intent: { move: -1 } },
      { intent: { move: 0 }, dt: 0.1 },
      { intent: { move: 1 } },
      { intent: { move: 0 }, dt: 0.1 },
      { intent: { attackUp: true } },
    ])
    expect(bestCombo(done.memory.tokens, [fireball, jab], done.fresh)?.id).toBe('fireball')

    const late = sequence([
      { intent: { move: -1 } },
      { intent: { move: 0 }, dt: 0.4 },
      { intent: { move: 1 } },
      { intent: { move: 0 }, dt: 0.2 },
      { intent: { attackUp: true } },
    ])
    expect(bestCombo(late.memory.tokens, [fireball], late.fresh)).toBeNull()

    const idle = press(done.memory, {}, 1, 0.05)
    expect(bestCombo(idle.memory.tokens, [fireball], idle.fresh)).toBeNull()
  })

  it('prefers the longer sequence and rejects a token in the middle', () => {
    const broken = sequence([
      { intent: { move: -1 } },
      { intent: { jump: true } },
      { intent: { move: 1 } },
      { intent: { attackUp: true } },
    ])
    expect(bestCombo(broken.memory.tokens, [fireball], broken.fresh)).toBeNull()

    const short = sequence([
      { intent: { move: -1 } },
      { intent: { attackUp: true } },
    ])
    expect(bestCombo(short.memory.tokens, [fireball, jab], short.fresh)?.id).toBe('jab')
  })

  it('holds a jump that is the middle of a special so the button can still land', () => {
    const primed = sequence([
      { intent: { move: 1 } },
      { intent: { jump: true } },
    ])
    const upper: ComboSpec = { ...fireball, id: 'upper', sequence: ['forward', 'up', 'punch'], effect: 'uppercut' }
    expect(holdsJump(primed.memory.tokens, [upper])).toBe(true)
    expect(holdsJump(primed.memory.tokens, [fireball])).toBe(false)
    const finished = press(primed.memory, { attackUp: true })
    expect(bestCombo(finished.memory.tokens, [upper], finished.fresh)?.id).toBe('upper')
  })

  it('drops stale tokens and does not treat neutral as an input', () => {
    let memory = emptyMotion()
    memory = press(memory, { move: -1 }).memory
    memory = press(memory, { move: 0 }, 1, 2).memory
    expect(memory.tokens).toEqual([])
    const neutral = press(memory, { move: 0 })
    expect(neutral.fresh).toEqual([])
  })
})