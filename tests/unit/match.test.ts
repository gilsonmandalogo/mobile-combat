import { describe, expect, it } from 'vitest'
import { attackChips, characterById } from '@src/content/catalog'
import { ATTACKS, ROUND_END_DELAY } from '@src/sim/constants'
import { createMatch, pauseMatch, quitToMenu, restartMatch, resumeMatch, startMatch, stepMatch, stepSeconds } from '@src/sim/match'
import { EMPTY_INTENT } from '@src/sim/types'
import type { FighterId, Intent, MatchState } from '@src/sim/types'

const both = (override: Partial<Intent> = {}): Record<FighterId, Intent> => ({
  player1: { ...EMPTY_INTENT, ...override },
  player2: { ...EMPTY_INTENT },
})

function fight(): MatchState {
  const started = startMatch(createMatch({
    mode: 'local',
    difficulty: 'normal',
    roundTime: 20,
    names: ['Red', 'Blue'],
    devices: ['keyboard', 'keyboard'],
    seed: 1,
  }))
  return { ...started.state, introTime: 0, banner: null }
}

function place(state: MatchState, x1: number, x2: number): MatchState {
  const fighters = [
    { ...state.fighters[0], x: x1 },
    { ...state.fighters[1], x: x2 },
  ] as MatchState['fighters']
  return { ...state, fighters }
}

describe('match simulation', () => {
  it('walks, stops at the wall, and jumps back to the ground', () => {
    const walked = stepSeconds(fight(), both({ move: 1 }), 0.5)
    expect(walked.state.fighters[0].x).toBeGreaterThan(fight().fighters[0].x)
    expect(walked.state.fighters[0].action).toBe('walk')

    const walled = stepSeconds(place(fight(), 5.9, 3), both({ move: 1 }), 0.5)
    expect(walled.state.fighters[0].x).toBeLessThanOrEqual(6)

    let jumping = stepMatch(fight(), both({ jump: true }), 1 / 60)
    expect(jumping.state.fighters[0].action).toBe('prejump')
    expect(jumping.state.fighters[0].y).toBe(0)
    jumping = stepSeconds(jumping.state, both(), 0.2)
    expect(jumping.state.fighters[0].y).toBeGreaterThan(0.4)
    const landed = stepSeconds(jumping.state, both(), 2)
    expect(landed.state.fighters[0].y).toBe(0)
  })

  it('deals damage and knocks the defender away once per punch', () => {
    let state = place(fight(), 0, 0.95)
    const before = state.fighters[1].x
    const active = stepSeconds(state, both({ attackUp: true }), ATTACKS.attackUp.startup + ATTACKS.attackUp.active)
    const hit = active.events.find((event) => event.type === 'hit')
    expect(hit).toMatchObject({ type: 'hit', attacker: 'player1', defender: 'player2', blocked: false })
    state = active.state
    expect(state.fighters[1].life).toBe(100 - ATTACKS.attackUp.damage)
    expect(state.fighters[1].x).toBeGreaterThan(before)
    expect(['hitstun', 'juggle']).toContain(state.fighters[1].action)

    const again = stepMatch(state, both({ attackUp: true }), 1 / 60)
    expect(again.state.fighters[1].life).toBe(state.fighters[1].life)
  })

  it('reduces damage when the defender is blocking from the front', () => {
    const open = stepSeconds(
      place(fight(), 0, 0.95),
      both({ attackDown: true }),
      ATTACKS.attackDown.startup + ATTACKS.attackDown.active,
    )
    const guarded = stepSeconds(
      place(fight(), 0, 0.95),
      {
        player1: { ...EMPTY_INTENT, attackDown: true },
        player2: { ...EMPTY_INTENT, block: true },
      },
      ATTACKS.attackDown.startup + ATTACKS.attackDown.active,
    )
    const blocked = guarded.events.find((event) => event.type === 'hit')
    expect(blocked).toMatchObject({ blocked: true, damage: 3 })
    expect(guarded.state.fighters[1].life).toBe(97)
    expect(guarded.state.fighters[1].life).toBeGreaterThan(open.state.fighters[1].life)
    expect(guarded.state.fighters[1].action).toBe('block')
    expect(guarded.state.fighters[1].blockstun).toBeGreaterThan(0)
    expect(guarded.state.fighters[1].x).toBeGreaterThan(0.95)
    expect(guarded.state.callout).toBe('BLOCK')

    const stuck = stepMatch(guarded.state, {
      player1: { ...EMPTY_INTENT },
      player2: { ...EMPTY_INTENT, attackUp: true },
    }, 1 / 60)
    expect(stuck.state.fighters[1].action).toBe('block')
  })

  it('refuses a block from behind or in the air, and uses each move chip', () => {
    let behind = place(fight(), 0, 1)
    behind = {
      ...behind,
      fighters: [
        {
          ...behind.fighters[0],
          action: 'attackUp',
          actionTime: ATTACKS.attackUp.startup,
          attackResolved: false,
        },
        { ...behind.fighters[1], facing: 1, blocking: true, action: 'block' },
      ],
    }
    const crossed = stepMatch(behind, {
      player1: { ...EMPTY_INTENT },
      player2: { ...EMPTY_INTENT, block: true },
    }, 1 / 60)
    const openHit = crossed.events.find((event) => event.type === 'hit')
    expect(openHit).toMatchObject({ blocked: false, damage: ATTACKS.attackUp.damage })
    expect(crossed.state.fighters[1].action).toBe('hitstun')

    let air = place(fight(), 0, 0.95)
    air = {
      ...air,
      fighters: [
        {
          ...air.fighters[0],
          action: 'attackUp',
          actionTime: ATTACKS.attackUp.startup,
          attackResolved: false,
        },
        { ...air.fighters[1], y: 0.8, vy: 0, facing: -1, blocking: true, action: 'block' },
      ],
    }
    const hopped = stepMatch(air, both(), 1 / 60)
    expect(hopped.events.find((event) => event.type === 'hit')).toMatchObject({ blocked: false })

    const custom = startMatch(createMatch({
      mode: 'local',
      difficulty: 'normal',
      roundTime: 20,
      names: ['Red', 'Blue'],
      devices: ['keyboard', 'keyboard'],
      seed: 1,
      profiles: [
        { chips: { attackUp: 0.5, attackDown: 0 } },
        {},
      ],
    }))
    const light = stepSeconds(place({ ...custom.state, introTime: 0, banner: null }, 0, 0.95), {
      player1: { ...EMPTY_INTENT, attackUp: true },
      player2: { ...EMPTY_INTENT, block: true },
    }, ATTACKS.attackUp.startup + ATTACKS.attackUp.active)
    expect(light.state.fighters[1].life).toBe(100 - 5)
    const none = stepSeconds(place({ ...custom.state, introTime: 0, banner: null }, 0, 0.95), {
      player1: { ...EMPTY_INTENT, attackDown: true },
      player2: { ...EMPTY_INTENT, block: true },
    }, ATTACKS.attackDown.startup + ATTACKS.attackDown.active)
    expect(none.events.find((event) => event.type === 'hit')).toMatchObject({ blocked: true, damage: 0 })
    expect(none.state.fighters[1].life).toBe(100)
  })

  it('lets a jump evade a low punch', () => {
    let state = place(fight(), 0, 0.95)
    state = {
      ...state,
      fighters: [
        {
          ...state.fighters[0],
          action: 'attackDown',
          actionTime: ATTACKS.attackDown.startup,
          attackResolved: false,
        },
        { ...state.fighters[1], y: 2.5, vy: 2 },
      ],
    }
    const result = stepMatch(state, both(), 1 / 120)
    expect(result.events.some((event) => event.type === 'hit')).toBe(false)
    expect(result.state.fighters[1].life).toBe(100)
  })

  it('awards a round on KO and the match on the second knockout', () => {
    let state = place(fight(), 0, 0.95)
    state = {
      ...state,
      fighters: [
        state.fighters[0],
        { ...state.fighters[1], life: ATTACKS.attackDown.damage },
      ],
    }
    const ko = stepSeconds(state, both({ attackDown: true }), 0.4)
    expect(ko.events.some((event) => event.type === 'ko' && event.fighter === 'player2')).toBe(true)
    expect(ko.state.status).toBe('roundEnd')
    expect(ko.state.banner).toBe('K.O.')
    expect(ko.state.fighters[0].score).toBe(1)
    expect(ko.state.fighters[1].ko).toBe(true)

    const next = stepSeconds(ko.state, both(), ROUND_END_DELAY + 0.05)
    expect(next.state.status).toBe('running')
    expect(next.state.round).toBe(2)
    expect(next.state.fighters[1].life).toBe(100)

    let deciding: MatchState = { ...next.state, introTime: 0, banner: null }
    deciding = place(deciding, 0, 0.95)
    deciding = {
      ...deciding,
      fighters: [
        deciding.fighters[0],
        { ...deciding.fighters[1], life: ATTACKS.attackDown.damage },
      ],
    }
    const second = stepSeconds(deciding, both({ attackDown: true }), 0.4)
    expect(second.state.matchPending).toBe(true)
    expect(second.state.fighters[0].score).toBe(2)
    const ended = stepSeconds(second.state, both(), ROUND_END_DELAY + 0.05)
    expect(ended.state.status).toBe('matchEnd')
    expect(ended.state.winner).toBe('player1')
    expect(ended.state.banner).toBe('Red wins')
  })

  it('gives a timed-out round to the fighter with more life', () => {
    let state = fight()
    state = {
      ...state,
      timeLeft: 0.05,
      fighters: [
        { ...state.fighters[0], life: 40 },
        { ...state.fighters[1], life: 70 },
      ],
    }
    const result = stepSeconds(state, both(), 0.2)
    expect(result.state.roundWinner).toBe('player2')
    expect(result.state.fighters[1].score).toBe(1)
    expect(result.state.banner).toBe('Blue takes the round')
  })

  it('restarts the score and returns to the menu without dropping the roster', () => {
    let state = fight()
    state = {
      ...state,
      fighters: [
        { ...state.fighters[0], score: 1, life: 10 },
        state.fighters[1],
      ],
    }
    const restarted = restartMatch(state)
    expect(restarted.status).toBe('running')
    expect(restarted.round).toBe(1)
    expect(restarted.fighters[0].score).toBe(0)
    expect(restarted.fighters[0].life).toBe(100)
    expect(restarted.fighters[0].name).toBe('Red')

    const menu = quitToMenu(restarted)
    expect(menu.status).toBe('menu')
    expect(menu.fighters[1].name).toBe('Blue')
    expect(menu.mode).toBe('local')
  })

  it('does not advance the clock while paused', () => {
    const paused = pauseMatch(fight())
    const stepped = stepSeconds(paused, both({ move: 1 }), 1)
    expect(stepped.state.timeLeft).toBe(paused.timeLeft)
    expect(stepped.state.fighters[0].x).toBe(paused.fighters[0].x)
    const resumed = stepSeconds(resumeMatch(stepped.state), both({ move: 1 }), 0.3)
    expect(resumed.state.fighters[0].x).toBeGreaterThan(paused.fighters[0].x)
  })

  it('keeps a character\'s health and speed through the round and a restart', () => {
    const started = startMatch(createMatch({
      mode: 'local',
      difficulty: 'normal',
      roundTime: 20,
      names: ['Red', 'Blue'],
      devices: ['keyboard', 'keyboard'],
      seed: 1,
      profiles: [
        { characterId: 'maria', maxLife: 86, speed: 6, damageScale: 0.85 },
        { characterId: 'brute', maxLife: 130, speed: 2.5, damageScale: 1.35 },
      ],
    }))
    const open = { ...started.state, introTime: 0, banner: null }
    expect(open.fighters[0].life).toBe(86)
    expect(open.fighters[1].characterId).toBe('brute')
    const origin = open.fighters[0].x
    const moved = stepSeconds(open, both({ move: 1 }), 0.4)
    expect(moved.state.fighters[0].x - origin).toBeGreaterThan(2)
    const restarted = restartMatch(moved.state)
    expect(restarted.fighters[0].life).toBe(86)
    expect(restarted.fighters[0].speed).toBe(6)
    expect(restarted.fighters[1].maxLife).toBe(130)
  })

  it('keeps fighters inside the selected arena', () => {
    const started = startMatch(createMatch({
      mode: 'local',
      difficulty: 'normal',
      roundTime: 20,
      names: ['Red', 'Blue'],
      devices: ['keyboard', 'keyboard'],
      seed: 1,
      arenaId: 'moon-court',
      arena: { minX: -8, maxX: 8, spawns: [-4.2, 4.2] },
    }))
    expect(started.state.fighters[0].x).toBeCloseTo(-4.2)
    const open = place({ ...started.state, introTime: 0, banner: null }, -4.2, 7.6)
    const walked = stepSeconds(open, both({ move: 1 }), 3.2)
    expect(walked.state.fighters[0].x).toBeGreaterThan(6)
    expect(walked.state.fighters[0].x).toBeLessThanOrEqual(8)
    const restarted = restartMatch(walked.state)
    expect(restarted.arenaId).toBe('moon-court')
    expect(restarted.fighters[0].x).toBeCloseTo(-4.2)

    const tight = startMatch(createMatch({
      mode: 'local',
      difficulty: 'normal',
      roundTime: 20,
      names: ['Red', 'Blue'],
      devices: ['keyboard', 'keyboard'],
      seed: 1,
      arenaId: 'ember-pit',
      arena: { minX: -3, maxX: 3, spawns: [-1, 1] },
    }))
    const walled = stepSeconds(place({ ...tight.state, introTime: 0, banner: null }, 2.8, 1), both({ move: 1 }), 0.4)
    expect(walled.state.fighters[0].x).toBeLessThanOrEqual(3)
  })
})

function rosterFight(leftId: string, rightId: string): MatchState {
  const left = characterById(leftId)
  const right = characterById(rightId)
  const started = startMatch(createMatch({
    mode: 'local',
    difficulty: 'normal',
    roundTime: 20,
    names: [left.name, right.name],
    devices: ['keyboard', 'keyboard'],
    seed: 1,
    profiles: [
      { characterId: left.id, maxLife: left.stats.health, speed: left.stats.speed, damageScale: left.stats.damage, chips: attackChips(left.moves), combos: left.combos },
      { characterId: right.id, maxLife: right.stats.health, speed: right.stats.speed, damageScale: right.stats.damage, chips: attackChips(right.moves), combos: right.combos },
    ],
  }))
  return { ...started.state, introTime: 0, banner: null }
}

function tap(state: MatchState, intent: Partial<Intent>, seconds: number): MatchState {
  return stepSeconds(state, both(intent), seconds).state
}

describe('character specials', () => {
  it('throws a projectile that damages a fighter outside jab range', () => {
    let state = place(rosterFight('colin', 'maria'), -1.5, 2.4)
    state = tap(state, { move: -1 }, 0.08)
    state = tap(state, {}, 0.04)
    state = tap(state, { move: 1 }, 0.08)
    state = tap(state, {}, 0.04)
    state = tap(state, { attackUp: true }, 0.05)
    expect(state.fighters[0].action).toBe('special')
    const landed = tap(state, {}, 1)
    expect(landed.fighters[1].life).toBeLessThan(characterById('maria').stats.health)
    expect(landed.projectiles.length).toBe(0)

    let guarded = place(rosterFight('colin', 'maria'), -1.5, 2.4)
    const hold = {
      player1: { ...EMPTY_INTENT },
      player2: { ...EMPTY_INTENT, block: true },
    }
    guarded = stepSeconds(guarded, {
      player1: { ...EMPTY_INTENT, move: -1 },
      player2: hold.player2,
    }, 0.08).state
    guarded = stepSeconds(guarded, hold, 0.04).state
    guarded = stepSeconds(guarded, {
      player1: { ...EMPTY_INTENT, move: 1 },
      player2: hold.player2,
    }, 0.08).state
    guarded = stepSeconds(guarded, hold, 0.04).state
    guarded = stepSeconds(guarded, {
      player1: { ...EMPTY_INTENT, attackUp: true },
      player2: hold.player2,
    }, 0.05).state
    const chipped = stepSeconds(guarded, hold, 1)
    const health = characterById('maria').stats.health
    const blockedShot = chipped.events.find((event) => event.type === 'hit')
    expect(blockedShot).toMatchObject({ blocked: true, damage: 6 })
    expect(chipped.state.fighters[1].life).toBe(health - 6)
    expect(chipped.state.fighters[1].action).not.toBe('hitstun')
  })

  it('dashes, uppercuts, and teleports from each character manifest', () => {
    let dash = place(rosterFight('maria', 'colin'), -3, 3)
    dash = tap(dash, { move: -1 }, 0.06)
    dash = tap(dash, {}, 0.04)
    dash = tap(dash, { move: 1 }, 0.06)
    dash = tap(dash, {}, 0.04)
    const beforeDash = dash.fighters[0].x
    dash = tap(dash, { attackDown: true }, 0.05)
    expect(dash.fighters[0].special?.effect).toBe('dash')
    const dashed = tap(dash, {}, 0.2)
    expect(dashed.fighters[0].x - beforeDash).toBeGreaterThan(1.6)

    let upper = place(rosterFight('brute', 'colin'), -2, 2.5)
    upper = tap(upper, { move: 1 }, 0.06)
    upper = tap(upper, {}, 0.04)
    upper = tap(upper, { jump: true }, 0.05)
    expect(upper.fighters[0].y).toBe(0)
    upper = tap(upper, { attackUp: true }, 0.05)
    expect(upper.fighters[0].special?.effect).toBe('uppercut')
    const risen = tap(upper, {}, 0.18)
    expect(risen.fighters[0].y).toBeGreaterThan(0.4)

    let slip = place(rosterFight('maria', 'colin'), -2, 1.5)
    slip = tap(slip, { move: -1 }, 0.06)
    slip = tap(slip, {}, 0.04)
    slip = tap(slip, { jump: true }, 0.05)
    expect(slip.fighters[0].y).toBe(0)
    slip = tap(slip, { attackDown: true }, 0.05)
    expect(slip.fighters[0].special?.effect).toBe('teleport')
    expect(slip.fighters[0].x).toBeGreaterThan(slip.fighters[1].x)
  })
})
