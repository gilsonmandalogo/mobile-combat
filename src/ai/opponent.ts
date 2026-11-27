import { profileFor } from '@src/ai/profiles'
import { intentForToken, pickSpecial, specialScript } from '@src/ai/specials'
import type { ScriptBeat } from '@src/ai/specials'
import { attackPhase, isAttack } from '@src/sim/hitboxes'
import { EMPTY_INTENT } from '@src/sim/types'
import type { Difficulty, FighterState, Intent } from '@src/sim/types'

export type AiStateName = 'approach' | 'attack' | 'block' | 'evade' | 'retreat' | 'special'

export interface AiMemory {
  state: AiStateName
  cooldown: number
  react: number
  seed: number
  script: ScriptBeat[]
  hold: number
  specialCd: number
}

export function createAiMemory(seed: number): AiMemory {
  return { state: 'approach', cooldown: 0.3, react: 0, seed: seed >>> 0, script: [], hold: 0, specialCd: 0 }
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
  const profile = profileFor(difficulty)
  let seed = memory.seed >>> 0
  const roll = () => {
    const next = nextRng(seed)
    seed = next.seed
    return next.value
  }

  const specialCd = Math.max(0, memory.specialCd - dt)
  if (memory.script.length) {
    return playScript(memory, self.facing, dt)
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
  const ready = self.hitstun <= 0 && self.blockstun <= 0 && self.y <= 0.05 && !self.ko && !isAttack(self.action)

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
  } else if (ready && specialCd <= 0 && cooldown <= 0 && beginSpecial()) {
    return playScript(armedSpecial(), self.facing, dt)
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
    memory: { state, cooldown, react, seed, script: [], hold: 0, specialCd },
    intent,
  }

  function beginSpecial(): boolean {
    const choice = pickSpecial(self.combos, distance, enemy)
    if (!choice) {
      return false
    }
    if (roll() >= profile.special) {
      cooldown = profile.retry
      return false
    }
    return true
  }

  function armedSpecial(): AiMemory {
    const choice = pickSpecial(self.combos, distance, enemy)
    const script = choice
      ? specialScript(choice, profile.accuracy, profile.timingError, profile.followUp, roll)
      : []
    return {
      state: 'special',
      cooldown: profile.attackCd,
      react: 0,
      seed,
      script,
      hold: script[0]?.hold ?? 0,
      specialCd: profile.specialCd,
    }
  }
}

function playScript(memory: AiMemory, facing: 1 | -1, dt: number): { memory: AiMemory; intent: Intent } {
  let hold = memory.hold - dt
  let script = memory.script
  if (hold <= 0) {
    script = script.slice(1)
    hold = script[0]?.hold ?? 0
  }
  const beat = script[0]
  return {
    memory: {
      ...memory,
      script,
      hold,
      state: beat ? 'special' : 'approach',
      cooldown: Math.max(0, memory.cooldown - dt),
      specialCd: Math.max(0, memory.specialCd - dt),
    },
    intent: beat ? intentForToken(beat.token, facing) : { ...EMPTY_INTENT },
  }
}
