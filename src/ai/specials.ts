import { EMPTY_INTENT } from '@src/sim/types'
import type { ComboSpec, FighterState, InputToken, Intent } from '@src/sim/types'

export type ScriptToken = InputToken | 'release'

export interface ScriptBeat {
  hold: number
  token: ScriptToken
}

const WRONG: Record<InputToken, InputToken> = {
  back: 'forward',
  forward: 'back',
  up: 'punch',
  punch: 'kick',
  kick: 'punch',
}

export function scoreSpecial(combo: ComboSpec, distance: number, enemy: FighterState): number {
  if (combo.effect === 'projectile') {
    if (distance >= 2.4) {
      return 4
    }
    if (distance >= 1.8) {
      return 1
    }
    return -2
  }
  if (combo.effect === 'uppercut') {
    if (enemy.y > 0.35 || enemy.action === 'jump') {
      return 5
    }
    if (distance <= 1.55) {
      return 1.2
    }
    return -1
  }
  if (combo.effect === 'dash') {
    return distance >= 1.4 && distance <= 3.4 ? 3 : -1
  }
  return distance <= 2.2 ? 2.4 : 0.4
}

export function pickSpecial(combos: ComboSpec[], distance: number, enemy: FighterState): ComboSpec | null {
  let best: ComboSpec | null = null
  let bestScore = 0
  for (const combo of combos) {
    const score = scoreSpecial(combo, distance, enemy)
    if (score >= 1 && score > bestScore) {
      best = combo
      bestScore = score
    }
  }
  return best
}

export function intentForToken(token: ScriptToken, facing: 1 | -1): Intent {
  if (token === 'release') {
    return { ...EMPTY_INTENT }
  }
  if (token === 'back') {
    return { ...EMPTY_INTENT, move: facing === 1 ? -1 : 1 }
  }
  if (token === 'forward') {
    return { ...EMPTY_INTENT, move: facing === 1 ? 1 : -1 }
  }
  if (token === 'up') {
    return { ...EMPTY_INTENT, jump: true }
  }
  if (token === 'punch') {
    return { ...EMPTY_INTENT, attackUp: true }
  }
  return { ...EMPTY_INTENT, attackDown: true }
}

export function specialScript(
  combo: ComboSpec,
  accuracy: number,
  timingError: number,
  followUp: number,
  roll: () => number,
): ScriptBeat[] {
  const beats: ScriptBeat[] = combo.sequence.map((token) => ({
    token: roll() < accuracy ? token : WRONG[token],
    hold: Math.min(0.42, 0.08 + timingError * roll()),
  }))
  if (roll() < followUp) {
    beats.push({ hold: 0.52, token: 'release' })
    beats.push({ hold: 0.08, token: 'punch' })
  }
  return beats
}
