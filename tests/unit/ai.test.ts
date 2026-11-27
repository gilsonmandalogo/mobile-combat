import { describe, expect, it } from 'vitest'
import { createAiMemory, nextRng, stepAi, wantsAttack } from '@src/ai/opponent'
import { loadProfiles } from '@src/ai/profiles'
import { ATTACKS } from '@src/sim/constants'
import { createFighter } from '@src/sim/match'
import type { Difficulty, FighterState } from '@src/sim/types'

function pair(x1: number, x2: number): [FighterState, FighterState] {
  const self = createFighter('player2', 'CPU', x2, -1, 'ai')
  const enemy = createFighter('player1', 'Rio', x1, 1, 'keyboard')
  return [self, enemy]
}

describe('ai opponent', () => {
  it('is deterministic for a seed', () => {
    expect(nextRng(1)).toEqual(nextRng(1))
    const [self, enemy] = pair(-2, 2)
    const once = stepAi(createAiMemory(4), self, enemy, 'normal', 0.1)
    const twice = stepAi(createAiMemory(4), self, enemy, 'normal', 0.1)
    expect(twice).toEqual(once)
  })

  it('approaches a distant opponent and retreats when hurt and crowded', () => {
    const far = stepAi(createAiMemory(1), ...pair(-3, 2), 'normal', 0.16)
    expect(far.memory.state).toBe('approach')
    expect(far.intent.move).toBe(-1)

    const [self, enemy] = pair(0, 1)
    self.life = 10
    const hurt = stepAi(createAiMemory(1), self, enemy, 'easy', 0.16)
    expect(hurt.memory.state).toBe('retreat')
    expect(hurt.intent.move).toBe(1)
  })

  it('blocks a telegraphed attack on hard once it has reacted', () => {
    const [self, enemy] = pair(0, 1)
    enemy.action = 'attackUp'
    enemy.actionTime = 0
    expect(enemy.actionTime).toBeLessThan(ATTACKS.attackUp.startup)
    const windup = stepAi(createAiMemory(2), self, enemy, 'hard', 0.016)
    expect(windup.memory.state).not.toBe('block')
    const answer = stepAi(windup.memory, self, enemy, 'hard', 0.1)
    expect(answer.memory.state).toBe('block')
    expect(answer.intent.block).toBe(true)
  })

  it('attacks from in-range when the aggression roll says so', () => {
    expect(wantsAttack(0.2, 0.7)).toBe(true)
    expect(wantsAttack(0.9, 0.7)).toBe(false)
    const [self, enemy] = pair(0, 1)
    const memory = { ...createAiMemory(1), cooldown: 0 }
    let attacked = false
    for (let seed = 1; seed < 12; seed += 1) {
      const result = stepAi({ ...memory, seed }, self, enemy, 'hard', 0.05)
      attacked = attacked || result.intent.attackUp || result.intent.attackDown
    }
    expect(attacked).toBe(true)
  })

  it('makes nightmare attack and block more than easy under the same seed', () => {
    const profiles = loadProfiles()
    expect(profiles.nightmare.aggression).toBeGreaterThan(profiles.easy.aggression)
    expect(profiles.nightmare.special).toBeGreaterThan(profiles.hard.special)
    expect(profiles.nightmare.block).toBeGreaterThan(profiles.easy.block)
    expect(profiles.nightmare.reaction).toBeLessThan(profiles.easy.reaction)
    expect(() => loadProfiles({ ...profiles, nightmare: { ...profiles.nightmare, accuracy: 2 } })).toThrow(/accuracy/)

    const [self, enemy] = pair(0, 0.95)
    const attacks = (difficulty: Difficulty) => {
      let total = 0
      for (let seed = 1; seed <= 12; seed += 1) {
        let memory = { ...createAiMemory(seed), cooldown: 0 }
        for (let frame = 0; frame < 180; frame += 1) {
          const step = stepAi(memory, self, enemy, difficulty, 1 / 60)
          memory = step.memory
          if (step.intent.attackUp || step.intent.attackDown) {
            total += 1
          }
        }
      }
      return total
    }
    expect(attacks('nightmare')).toBeGreaterThan(attacks('easy') * 2)

    const threatened = pair(0, 1)
    threatened[1].action = 'attackUp'
    threatened[1].actionTime = 0
    const blocks = (difficulty: Difficulty) => {
      let total = 0
      const step = stepAi(createAiMemory(3), threatened[0], threatened[1], difficulty, 0.7)
      if (step.intent.block) {
        total += 1
      }
      for (let seed = 1; seed <= 10; seed += 1) {
        let memory = createAiMemory(seed)
        for (let frame = 0; frame < 40; frame += 1) {
          const next = stepAi(memory, threatened[0], threatened[1], difficulty, 1 / 60)
          memory = next.memory
          if (next.intent.block) {
            total += 1
          }
        }
      }
      return total
    }
    const early = stepAi(createAiMemory(1), threatened[0], threatened[1], 'easy', 0.2)
    expect(early.intent.block).toBe(false)
    const seen = stepAi(createAiMemory(1), threatened[0], threatened[1], 'nightmare', 0.016)
    const fast = stepAi(seen.memory, threatened[0], threatened[1], 'nightmare', 0.02)
    expect(fast.intent.block).toBe(true)
    expect(blocks('nightmare')).toBeGreaterThan(blocks('easy') * 2)
  })
})
