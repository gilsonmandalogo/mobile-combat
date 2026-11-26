export type FighterSlot = 'player1' | 'player2'

export interface ScoreState {
  round: number
  score1: number
  score2: number
}

export type AdvanceResult = ScoreState & {
  kind: 'next' | 'match'
}

/** Higher life wins a timed-out round. Equal life awards the round to player 1, matching the original comparison. */
export function winnerByLife(life1: number, life2: number): FighterSlot {
  return life1 >= life2 ? 'player1' : 'player2'
}

export function applyLifeDamage(life: number, damage: number): number {
  return life - damage
}

/**
 * A punch connects once per swing, and only while the attack is still active
 * and the hitbox overlaps a hurtbox.
 */
export function shouldRegisterHit(isPunching: boolean, alreadyHit: boolean, overlaps: boolean): boolean {
  return isPunching && overlaps && !alreadyHit
}

/**
 * Best-of-three round advance used by the original loop:
 * round 1 always continues, round 2 ends early on a sweep, round 3 ends the match.
 */
export function advanceAfterRound(state: ScoreState, winner: FighterSlot): AdvanceResult {
  const score1 = state.score1 + (winner === 'player1' ? 1 : 0)
  const score2 = state.score2 + (winner === 'player2' ? 1 : 0)
  const scores = { score1, score2 }

  if (state.round === 1) {
    return { kind: 'next', round: 2, ...scores }
  }

  if (state.round === 2 && score1 < 2 && score2 < 2) {
    return { kind: 'next', round: 3, ...scores }
  }

  return { kind: 'match', round: state.round, ...scores }
}
