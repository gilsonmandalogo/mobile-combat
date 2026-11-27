import { describe, expect, it } from 'vitest'
import { fighterPose } from '@src/sim/pose'
import { JUMP_CARRY, LAND_TIME, PREJUMP_TIME, PUSH_DISTANCE } from '@src/sim/constants'
import { createMatch, startMatch, stepMatch, stepSeconds } from '@src/sim/match'
import { EMPTY_INTENT } from '@src/sim/types'
import type { Intent, MatchState } from '@src/sim/types'

const DT = 1 / 60

function fight(): MatchState {
  const match = startMatch(createMatch({
    mode: 'local',
    difficulty: 'normal',
    roundTime: 60,
    names: ['Red', 'Blue'],
    devices: ['keyboard', 'keyboard'],
    seed: 3,
  })).state
  return { ...match, introTime: 0, banner: null, critChance: 0 }
}

function at(state: MatchState, x1: number, x2: number): MatchState {
  return {
    ...state,
    fighters: [
      { ...state.fighters[0], x: x1 },
      { ...state.fighters[1], x: x2 },
    ],
  }
}

function idle(extra: Partial<Intent> = {}): Intent {
  return { ...EMPTY_INTENT, ...extra }
}

describe('jump', () => {
  it('locks a neutral, forward, and back arc and lands once', () => {
    const neutral = stepMatch(at(fight(), -2, 2), { player1: idle({ jump: true }), player2: idle() }, DT)
    expect(neutral.state.fighters[0].action).toBe('prejump')
    expect(neutral.state.fighters[0].jumpDir).toBe(0)
    expect(fighterPose(neutral.state.fighters[0])).toBe('jumpStart')
    const up = stepSeconds(neutral.state, { player1: idle(), player2: idle() }, PREJUMP_TIME + 0.16)
    expect(up.state.fighters[0].y).toBeGreaterThan(0.5)
    expect(up.state.fighters[0].vx).toBe(0)
    expect(fighterPose(up.state.fighters[0])).toBe('jumpAscend')
    const again = stepMatch(up.state, { player1: idle({ jump: true, move: 1 }), player2: idle() }, DT)
    expect(again.state.fighters[0].vx).toBe(0)
    expect(again.state.fighters[0].y).toBeGreaterThan(0.3)
    const down = stepSeconds(again.state, { player1: idle(), player2: idle() }, 1.4)
    expect(down.state.fighters[0].y).toBe(0)
    expect(down.state.fighters[0].x).toBeCloseTo(-2, 1)

    let forward = stepMatch(at(fight(), -2, 2), { player1: idle({ jump: true, move: 1 }), player2: idle() }, DT)
    expect(forward.state.fighters[0].jumpDir).toBe(1)
    forward = stepSeconds(forward.state, { player1: idle({ move: -1, block: true }), player2: idle() }, PREJUMP_TIME + 0.08)
    expect(forward.state.fighters[0].vx).toBe(JUMP_CARRY)
    expect(forward.state.fighters[0].blocking).toBe(false)
    expect(forward.state.fighters[0].y).toBeGreaterThan(0)
    const steered = stepMatch(forward.state, { player1: idle({ move: -1, block: true }), player2: idle() }, DT)
    expect(steered.state.fighters[0].vx).toBe(JUMP_CARRY)
    expect(steered.state.fighters[0].blocking).toBe(false)

    const back = stepMatch(at(fight(), 0, 2), { player1: idle({ jump: true, move: -1 }), player2: idle() }, DT)
    expect(back.state.fighters[0].jumpDir).toBe(-1)
    const away = stepSeconds(back.state, { player1: idle(), player2: idle() }, PREJUMP_TIME + 0.12)
    expect(away.state.fighters[0].vx).toBe(-JUMP_CARRY)
  })

  it('allows one overhead air attack, then a juggle and a cross-up', () => {
    let jumping = stepMatch(at(fight(), 0, 0.95), { player1: idle({ jump: true }), player2: idle() }, DT)
    jumping = stepSeconds(jumping.state, { player1: idle(), player2: idle() }, PREJUMP_TIME + 0.02)
    const attack = stepMatch(jumping.state, { player1: idle({ attackUp: true }), player2: idle({ crouch: true, block: true }) }, DT)
    expect(attack.state.fighters[0].action).toBe('jumpPunch')
    expect(attack.state.fighters[0].airAttack).toBe(true)
    expect(fighterPose(attack.state.fighters[0])).toBe('jumpAttack')
    const active = attack.state.fighters[0].attacks.jumpPunch
    const struck = stepSeconds(attack.state, {
      player1: idle({ attackDown: true }),
      player2: idle({ crouch: true, block: true }),
    }, active.startup + active.active)
    const hit = struck.events.find((event) => event.type === 'hit')
    expect(hit).toMatchObject({ blocked: false, attacker: 'player1' })
    expect(struck.state.fighters[1].action).toBe('juggle')
    const stood = stepSeconds(attack.state, {
      player1: idle(),
      player2: idle({ block: true }),
    }, active.startup + active.active)
    expect(stood.events.find((event) => event.type === 'hit')).toMatchObject({ blocked: true })

    const recovered = stepSeconds(struck.state, { player1: idle({ attackUp: true }), player2: idle() }, active.recovery + 0.2)
    expect(recovered.state.fighters[0].action).not.toBe('jumpPunch')
    expect(recovered.state.fighters[0].airAttack).toBe(true)
    const fallen = stepSeconds(struck.state, { player1: idle(), player2: idle() }, 1.2)
    expect(fallen.state.fighters[1].y).toBe(0)
    expect(['knockdown', 'land', 'idle', 'hitstun']).toContain(fallen.state.fighters[1].action)

    let cross = stepMatch(at(fight(), -0.15, 0.45), { player1: idle({ jump: true, move: 1 }), player2: idle() }, DT)
    expect(cross.state.fighters[0].facing).toBe(1)
    cross = stepSeconds(cross.state, { player1: idle(), player2: idle() }, PREJUMP_TIME + LAND_TIME + 1.1)
    expect(cross.state.fighters[0].y).toBe(0)
    expect(cross.state.fighters[0].x).toBeGreaterThan(cross.state.fighters[1].x)
    expect(cross.state.fighters[0].facing).toBe(-1)
    expect(fighterPose(cross.state.fighters[0]) === 'jumpLand' || cross.state.fighters[0].action === 'idle' || cross.state.fighters[0].action === 'land').toBe(true)
  })

  it('keeps grounded bodies apart and lets a jump pass over', () => {
    const piled = stepMatch(at(fight(), 0, 0), { player1: idle(), player2: idle() }, DT)
    expect(Math.abs(piled.state.fighters[1].x - piled.state.fighters[0].x)).toBeGreaterThanOrEqual(PUSH_DISTANCE - 0.001)

    const hopped = at(fight(), 0, 0.2)
    hopped.fighters[0] = { ...hopped.fighters[0], y: 1.1, vy: 1, vx: 4, action: 'jump' }
    const passed = stepSeconds(hopped, { player1: idle(), player2: idle() }, 0.15)
    expect(passed.state.fighters[0].x).toBeGreaterThan(passed.state.fighters[1].x)
    expect(Math.abs(passed.state.fighters[0].x - passed.state.fighters[1].x)).toBeLessThan(PUSH_DISTANCE)
  })
})
