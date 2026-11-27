import { describe, expect, it } from 'vitest'
import { createAiMemory, stepAi } from '@src/ai/opponent'
import { attackBook, characterById } from '@src/content/catalog'
import { CROUCH_ATTACKS, CROUCH_HURT_HEIGHT, HURT_HEIGHT } from '@src/sim/constants'
import { DEFAULT_PAD, gamepadIntent } from '@src/input/gamepad'
import type { PadSnapshot } from '@src/input/gamepad'
import { blocksStrike, hurtbox } from '@src/sim/hitboxes'
import { createFighter, createMatch, startMatch, stepMatch, stepSeconds } from '@src/sim/match'
import { EMPTY_INTENT } from '@src/sim/types'
import type { Difficulty, FighterId, Intent, MatchState } from '@src/sim/types'

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
  return {
    ...state,
    fighters: [
      { ...state.fighters[0], x: x1 },
      { ...state.fighters[1], x: x2 },
    ],
  }
}

describe('crouch and hit levels', () => {
  it('shrinks the hurtbox and holds a crouch', () => {
    const held = stepSeconds(place(fight(), -1, 1), {
      player1: { ...EMPTY_INTENT, crouch: true },
      player2: { ...EMPTY_INTENT },
    }, 0.2)
    const fighter = held.state.fighters[0]
    expect(fighter.action).toBe('crouch')
    expect(fighter.crouching).toBe(true)
    expect(fighter.x).toBe(-1)
    const box = hurtbox(fighter)
    expect(box.maxY - box.minY).toBe(CROUCH_HURT_HEIGHT)
    expect(CROUCH_HURT_HEIGHT).toBeLessThan(HURT_HEIGHT)
  })

  it('lets a standing block stop a mid and a crouch block stop a low', () => {
    const low = CROUCH_ATTACKS.crouchKick
    const open = stepSeconds(place(fight(), 0, 0.9), {
      player1: { ...EMPTY_INTENT, crouch: true, attackDown: true },
      player2: { ...EMPTY_INTENT, block: true },
    }, low.startup + low.active)
    const standing = open.events.find((event) => event.type === 'hit')
    expect(standing).toMatchObject({ blocked: false })
    expect(open.state.fighters[1].life).toBeLessThan(100)

    const guarded = stepSeconds(place(fight(), 0, 0.9), {
      player1: { ...EMPTY_INTENT, crouch: true, attackDown: true },
      player2: { ...EMPTY_INTENT, crouch: true, block: true },
    }, low.startup + low.active)
    expect(guarded.events.find((event) => event.type === 'hit')).toMatchObject({ blocked: true })
    expect(guarded.state.fighters[1].life).toBeGreaterThan(open.state.fighters[1].life)
    expect(guarded.state.fighters[1].crouching).toBe(true)
    expect(guarded.state.callout).toBe('BLOCK')
  })

  it('makes a high whiff on a crouch and an overhead require a standing block', () => {
    const high = stepSeconds(place(fight(), 0, 0.95), {
      player1: { ...EMPTY_INTENT, attackUp: true },
      player2: { ...EMPTY_INTENT, crouch: true, block: true },
    }, 0.3)
    expect(high.events.some((event) => event.type === 'hit')).toBe(false)
    expect(high.state.fighters[1].life).toBe(100)

    let jumpIn = place(fight(), 0, 0.95)
    jumpIn = {
      ...jumpIn,
      fighters: [
        {
          ...jumpIn.fighters[0],
          action: 'attackDown',
          actionTime: jumpIn.fighters[0].attacks.attackDown.startup,
          attackResolved: false,
          y: 0.4,
        },
        { ...jumpIn.fighters[1], crouching: true, blocking: true, action: 'crouch' },
      ],
    }
    const ducked = stepMatch(jumpIn, {
      player1: { ...EMPTY_INTENT },
      player2: { ...EMPTY_INTENT, crouch: true, block: true },
    }, 1 / 60)
    expect(ducked.events.find((event) => event.type === 'hit')).toMatchObject({ blocked: false })

    const stood = stepMatch({
      ...jumpIn,
      fighters: [
        jumpIn.fighters[0],
        { ...jumpIn.fighters[1], crouching: false, blocking: true, action: 'block' },
      ],
    }, {
      player1: { ...EMPTY_INTENT },
      player2: { ...EMPTY_INTENT, block: true },
    }, 1 / 60)
    expect(stood.events.find((event) => event.type === 'hit')).toMatchObject({ blocked: true })
    expect(blocksStrike(jumpIn.fighters[1], 'overhead', jumpIn.fighters[0].x)).toBe(false)
  })

  it('reads crouch attacks and low sweeps from the character manifest', () => {
    const colin = characterById('colin')
    const book = attackBook(colin.moves)
    expect(book.attackUp.hitLevel).toBe('high')
    expect(book.attackDown.hitLevel).toBe('low')
    expect(book.crouchKick.hitLevel).toBe('low')
    expect(book.crouchKick.damage).toBe(12)
    expect(book.crouchKick.hitY).toBe(0.28)
    expect(characterById('brute').combos[0].hitLevel).toBe('overhead')

    const started = startMatch(createMatch({
      mode: 'local',
      difficulty: 'normal',
      roundTime: 20,
      names: ['Red', 'Blue'],
      devices: ['keyboard', 'keyboard'],
      seed: 1,
      profiles: [{ attacks: book }, { attacks: book }],
    }))
    const swept = stepSeconds(
      place({ ...started.state, introTime: 0, banner: null }, 0, 0.9),
      {
        player1: { ...EMPTY_INTENT, attackDown: true },
        player2: { ...EMPTY_INTENT, block: true },
      },
      book.attackDown.startup + book.attackDown.active,
    )
    expect(swept.events.find((event) => event.type === 'hit')).toMatchObject({ blocked: false })
  })

  it('crouch-blocks and throws lows more often as the difficulty rises', () => {
    const self = createFighter('player2', 'CPU', 0.95, -1, 'ai')
    const enemy = createFighter('player1', 'Rio', 0, 1, 'keyboard')
    enemy.action = 'crouchKick'
    enemy.actionTime = 0
    const blocks = (difficulty: Difficulty) => {
      let total = 0
      for (let seed = 1; seed <= 16; seed += 1) {
        const armed = stepAi(createAiMemory(seed), self, enemy, difficulty, 0.016)
        const answer = stepAi(armed.memory, self, enemy, difficulty, 1)
        if (answer.intent.block && answer.intent.crouch) {
          total += 1
        }
      }
      return total
    }
    const lows = (difficulty: Difficulty) => {
      let total = 0
      const idleEnemy = createFighter('player1', 'Rio', 0, 1, 'keyboard')
      for (let seed = 1; seed <= 12; seed += 1) {
        let memory = { ...createAiMemory(seed), cooldown: 0 }
        for (let frame = 0; frame < 180; frame += 1) {
          const step = stepAi(memory, self, idleEnemy, difficulty, 1 / 60)
          memory = step.memory
          if (step.intent.crouch && step.intent.attackDown) {
            total += 1
          }
        }
      }
      return total
    }
    expect(blocks('nightmare')).toBeGreaterThan(blocks('easy'))
    expect(lows('nightmare')).toBeGreaterThan(lows('easy'))
  })

  it('reads down on a stick or d-pad as crouch', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
    const stick: PadSnapshot = {
      index: 0,
      connected: true,
      axes: [0, 0.8, 0, 0],
      buttons,
      mapping: 'standard',
      id: 'test',
    }
    expect(gamepadIntent(stick, DEFAULT_PAD, []).intent.crouch).toBe(true)
    const dpad: PadSnapshot = { ...stick, axes: [0, 0, 0, 0], buttons: buttons.map((button, index) => (
      index === 13 ? { pressed: true, value: 1 } : button
    )) }
    expect(gamepadIntent(dpad, DEFAULT_PAD, []).intent.crouch).toBe(true)
  })
})
