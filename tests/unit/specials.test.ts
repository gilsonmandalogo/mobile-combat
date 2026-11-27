import { describe, expect, it } from 'vitest'
import { createAiMemory, nextRng, stepAi } from '@src/ai/opponent'
import { profileFor } from '@src/ai/profiles'
import { intentForToken, pickSpecial, specialScript } from '@src/ai/specials'
import type { ScriptBeat } from '@src/ai/specials'
import { characterById } from '@src/content/catalog'
import { bestCombo, emptyMotion, pushMotion } from '@src/sim/buffer'
import { createMatch, startMatch, stepSeconds } from '@src/sim/match'
import { EMPTY_INTENT } from '@src/sim/types'
import type { Difficulty, FighterId, InputToken, Intent, MatchState } from '@src/sim/types'

function replay(beats: ScriptBeat[], facing: 1 | -1 = 1) {
  let memory = emptyMotion()
  let fresh: InputToken[] = []
  beats.forEach((beat, index) => {
    const dt = index === 0 ? 1 / 60 : beats[index - 1].hold
    const next = pushMotion(memory, intentForToken(beat.token, facing), facing, dt)
    memory = next.memory
    fresh = next.fresh
  })
  return { memory, fresh }
}

function colinMatch(): MatchState {
  const colin = characterById('colin')
  const started = startMatch(createMatch({
    mode: 'ai',
    difficulty: 'nightmare',
    roundTime: 20,
    names: ['Red', 'CPU'],
    devices: ['keyboard', 'ai'],
    seed: 1,
    profiles: [
      {},
      {
        characterId: colin.id,
        maxLife: colin.stats.health,
        speed: colin.stats.speed,
        damageScale: colin.stats.damage,
        combos: colin.combos,
      },
    ],
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

describe('special scripts', () => {
  const ember = characterById('colin').combos[0]
  const riser = characterById('brute').combos[0]

  it('picks a projectile at range and an uppercut against a jump-in', () => {
    const grounded = place(colinMatch(), 0, 3).fighters[0]
    expect(pickSpecial(characterById('colin').combos, 3.2, grounded)?.id).toBe('ember')
    expect(pickSpecial(characterById('colin').combos, 1, grounded)).toBeNull()
    const airborne = { ...grounded, y: 1.2, action: 'jump' as const }
    expect(pickSpecial([riser, ember], 1.3, airborne)?.effect).toBe('uppercut')
    expect(pickSpecial(characterById('maria').combos, 2, grounded)?.effect).toBe('dash')
  })

  it('feeds the manifest sequence through the same buffer a human uses', () => {
    const clean = specialScript(ember, 1, 0, 0, () => 0)
    expect(clean.map((beat) => beat.token)).toEqual(['back', 'forward', 'punch'])
    const matched = replay(clean, -1)
    expect(bestCombo(matched.memory.tokens, [ember], matched.fresh)?.id).toBe('ember')

    const missed = specialScript(ember, 0, 0, 0, () => 0.4)
    expect(bestCombo(replay(missed).memory.tokens, [ember], replay(missed).fresh)).toBeNull()

    const late = specialScript(ember, 1, 0.4, 0, () => 0.99)
    const slow = replay(late)
    expect(bestCombo(slow.memory.tokens, [ember], slow.fresh)).toBeNull()
  })

  it('adds a follow-up more often as the profile gets harsher', () => {
    const follows = (difficulty: Difficulty) => {
      const profile = profileFor(difficulty)
      let count = 0
      for (let seed = 1; seed <= 24; seed += 1) {
        let value = seed
        const roll = () => {
          const next = nextRng(value)
          value = next.seed
          return next.value
        }
        const beats = specialScript(ember, profile.accuracy, profile.timingError, profile.followUp, roll)
        if (beats.some((beat) => beat.token === 'release')) {
          count += 1
        }
      }
      return count
    }
    expect(follows('nightmare')).toBeGreaterThan(follows('easy'))
    const forced = specialScript(ember, 1, 0, 1, () => 0)
    expect(forced.map((beat) => beat.token)).toEqual(['back', 'forward', 'punch', 'release', 'punch'])
  })

  it('lands more real specials on nightmare than on easy', () => {
    const landed = (difficulty: Difficulty) => {
      let count = 0
      let proof: InputToken[] | null = null
      for (let seed = 1; seed <= 12; seed += 1) {
        let memory = { ...createAiMemory(seed), cooldown: 0 }
        let state = place(colinMatch(), -3, 3)
        const result = stepSeconds(state, (current) => {
          const step = stepAi(memory, current.fighters[1], current.fighters[0], difficulty, 1 / 60)
          memory = step.memory
          if (!proof && current.fighters[1].action === 'special') {
            proof = current.motions.player2.tokens.map((token) => token.token).slice(-3) as InputToken[]
          }
          const intents: Record<FighterId, Intent> = {
            player1: { ...EMPTY_INTENT },
            player2: step.intent,
          }
          return intents
        }, 2.2)
        if (result.events.some((event) => event.type === 'attack' && event.attack === 'special')) {
          count += 1
        }
      }
      return { count, proof }
    }

    const easy = landed('easy')
    const nightmare = landed('nightmare')
    expect(nightmare.count).toBeGreaterThan(easy.count)
    expect(nightmare.count).toBeGreaterThanOrEqual(6)
    expect(easy.count).toBeLessThanOrEqual(4)
    expect(nightmare.proof).toEqual(['back', 'forward', 'punch'])
  })

  it('uppercuts a jumping opponent from the manifest', () => {
    const brute = characterById('brute')
    const started = startMatch(createMatch({
      mode: 'ai',
      difficulty: 'nightmare',
      roundTime: 20,
      names: ['Red', 'CPU'],
      devices: ['keyboard', 'ai'],
      seed: 1,
      profiles: [{}, {
        characterId: brute.id,
        combos: brute.combos,
        speed: brute.stats.speed,
      }],
    }))
    let state = { ...started.state, introTime: 0, banner: null }
    state = {
      ...state,
      fighters: [
        { ...state.fighters[0], x: 0, y: 1.3, vy: 1 },
        { ...state.fighters[1], x: 1.2, combos: brute.combos },
      ],
    }
    let memory = { ...createAiMemory(2), cooldown: 0 }
    let effect: string | null = null
    stepSeconds(state, (current) => {
      const step = stepAi(memory, current.fighters[1], current.fighters[0], 'nightmare', 1 / 60)
      memory = step.memory
      if (current.fighters[1].special) {
        effect = current.fighters[1].special.effect
      }
      return { player1: { ...EMPTY_INTENT }, player2: step.intent }
    }, 1.4)
    expect(effect).toBe('uppercut')
  })
})
