import { describe, expect, it } from 'vitest'
import { advanceAfterRound, applyLifeDamage, shouldRegisterHit, winnerByLife } from '@src/sim/legacyRules'
import { debugQueryEnabled } from '@src/debug/bridge'

describe('existing round rules', () => {
  it('gives a timed-out round to the healthier fighter', () => {
    expect(winnerByLife(40, 39)).toBe('player1')
    expect(winnerByLife(10, 11)).toBe('player2')
    expect(winnerByLife(20, 20)).toBe('player1')
  })

  it('subtracts damage from life', () => {
    expect(applyLifeDamage(100, 8)).toBe(92)
  })

  it('registers a hit only once per active punch that overlaps', () => {
    expect(shouldRegisterHit(true, false, true)).toBe(true)
    expect(shouldRegisterHit(true, true, true)).toBe(false)
    expect(shouldRegisterHit(false, false, true)).toBe(false)
    expect(shouldRegisterHit(true, false, false)).toBe(false)
  })

  it('plays up to three rounds and ends early on a 2-0 sweep', () => {
    const afterFirst = advanceAfterRound({ round: 1, score1: 0, score2: 0 }, 'player1')
    expect(afterFirst).toEqual({ kind: 'next', round: 2, score1: 1, score2: 0 })

    const sweep = advanceAfterRound(
      { round: afterFirst.round, score1: afterFirst.score1, score2: afterFirst.score2 },
      'player1',
    )
    expect(sweep).toEqual({ kind: 'match', round: 2, score1: 2, score2: 0 })
  })

  it('goes to a third round when the first two are split', () => {
    const second = advanceAfterRound({ round: 2, score1: 1, score2: 0 }, 'player2')
    expect(second).toEqual({ kind: 'next', round: 3, score1: 1, score2: 1 })

    const third = advanceAfterRound(
      { round: second.round, score1: second.score1, score2: second.score2 },
      'player2',
    )
    expect(third.kind).toBe('match')
    expect(third.score2).toBe(2)
  })
})

describe('debug hook', () => {
  it('turns on only for the debug query param', () => {
    expect(debugQueryEnabled('?debug=1')).toBe(true)
    expect(debugQueryEnabled('?debug=0')).toBe(false)
    expect(debugQueryEnabled('')).toBe(false)
  })
})
