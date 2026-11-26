import { attackPhase } from '@src/sim/hitboxes'
import { EMPTY_INTENT } from '@src/sim/types'
import type { Difficulty, FighterState, Intent } from '@src/sim/types'

export type AiStateName = 'approach' | 'attack' | 'block' | 'evade' | 'retreat'

export interface AiMemory {
  state: AiStateName
  cooldown: number
  react: number
  seed: number
}

interface Profile {
  prefer: number
  attack: number
  threat: number
  reaction: number
  aggression: number
  block: number
  evade: number
  retreatLife: number
  heavy: number
  attackCd: number
  retry: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { prefer: 2.5, attack: 1.25, threat: 1.7, reaction: 0.5, aggression: 0.35, block: 0.2, evade: 0.25, retreatLife: 40, heavy: 0.15, attackCd: 1.35, retry: 0.65 },
  normal: { prefer: 1.55, attack: 1.2, threat: 1.85, reaction: 0.18, aggression: 0.7, block: 0.7, evade: 0.35, retreatLife: 24, heavy: 0.4, attackCd: 0.85, retry: 0.35 },
  hard: { prefer: 1.15, attack: 1.25, threat: 2.1, reaction: 0.05, aggression: 0.92, block: 1, evade: 0.4, retreatLife: 12, heavy: 0.55, attackCd: 0.55, retry: 0.2 },
}

export function createAiMemory(seed: number): AiMemory {
  return { state: 'approach', cooldown: 0.3, react: 0, seed: seed >>> 0 }
}

export function nextRng(seed: number): { seed: number; value: number } {
  let value = (seed + 0x6D2B79F5) >>> 0
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value = (value ^ (value + Math.imul(value ^ (value >>> 7), value | 61))) >>> 0
  return { seed: value, value: value / 4294967296 }
}

export function wantsAttack(roll: number, aggression: number): boolean {
  return roll < aggression
}

export function stepAi(
  memory: AiMemory,
  self: FighterState,
  enemy: FighterState,
  difficulty: Difficulty,
  dt: number,
): { memory: AiMemory; intent: Intent } {
  const profile = PROFILES[difficulty]
  let seed = memory.seed >>> 0
  const roll = () => {
    const next = nextRng(seed)
    seed = next.seed
    return next.value
  }

  const delta = enemy.x - self.x
  const distance = Math.abs(delta)
  const toward: Intent['move'] = delta === 0 ? 0 : delta > 0 ? 1 : -1
  const away: Intent['move'] = toward === 0 ? 0 : toward === 1 ? -1 : 1
  const phase = attackPhase(enemy)
  const threat = (phase === 'startup' || phase === 'active') && distance < profile.threat
  let cooldown = Math.max(0, memory.cooldown - dt)
  let react = memory.react
  let state: AiStateName = 'approach'

  if (threat) {
    if (memory.react <= 0 && memory.state !== 'block' && memory.state !== 'evade') {
      react = profile.reaction
    } else {
      react = Math.max(0, memory.react - dt)
    }
    if (react <= 0) {
      if (profile.block >= 1 || roll() < profile.block) {
        state = 'block'
      } else if (roll() < profile.evade) {
        state = 'evade'
      } else {
        state = 'retreat'
      }
    }
  } else if (self.life <= profile.retreatLife && distance < profile.prefer) {
    state = 'retreat'
    react = 0
  } else if (distance > profile.prefer) {
    state = 'approach'
    react = 0
  } else if (distance <= profile.attack && cooldown <= 0) {
    state = wantsAttack(roll(), profile.aggression) ? 'attack' : 'approach'
    cooldown = state === 'attack' ? profile.attackCd : profile.retry
    react = 0
  } else if (distance < profile.prefer - 0.45) {
    state = 'retreat'
    react = 0
  } else {
    react = 0
  }

  const intent: Intent = { ...EMPTY_INTENT }
  if (state === 'approach') {
    intent.move = toward
  } else if (state === 'retreat' || state === 'evade') {
    intent.move = away
  }
  if (state === 'block') {
    intent.block = true
  }
  if (state === 'evade' && self.y <= 0 && memory.state !== 'evade') {
    intent.jump = true
  }
  if (state === 'attack') {
    if (roll() < profile.heavy) {
      intent.attackDown = true
    } else {
      intent.attackUp = true
    }
  }

  return {
    memory: { state, cooldown, react, seed },
    intent,
  }
}
