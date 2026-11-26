import { describe, expect, it } from 'vitest'
import { createAiMemory, nextRng, stepAi, wantsAttack } from '@src/ai/opponent'
import { ATTACKS } from '@src/sim/constants'
import { createFighter } from '@src/sim/match'
import type { FighterState } from '@src/sim/types'

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
})
