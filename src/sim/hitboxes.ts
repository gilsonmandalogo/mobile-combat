import { CROUCH_HURT_HEIGHT, HURT_HALF_W, HURT_HEIGHT } from '@src/sim/constants'
import type { AttackSpec } from '@src/sim/constants'
import type { Aabb, FighterState, HitLevel } from '@src/sim/types'

export type AttackPhase = 'startup' | 'active' | 'recovery'

const STRIKES = new Set<FighterState['action']>(['attackUp', 'attackDown', 'crouchPunch', 'crouchKick', 'special'])

export function isAttack(action: FighterState['action']): boolean {
  return STRIKES.has(action)
}

export function attackSpec(fighter: FighterState): AttackSpec | null {
  if (fighter.action === 'attackUp' || fighter.action === 'attackDown' || fighter.action === 'crouchPunch' || fighter.action === 'crouchKick') {
    return fighter.attacks[fighter.action]
  }
  if (fighter.action === 'special' && fighter.special && fighter.special.effect !== 'projectile') {
    return fighter.special
  }
  return null
}

export function hitLevelOf(fighter: FighterState): HitLevel {
  if (fighter.y > 0.25) {
    return 'overhead'
  }
  return attackSpec(fighter)?.hitLevel ?? 'mid'
}

export function blocksStrike(defender: FighterState, level: HitLevel, sourceX: number): boolean {
  const faces = (defender.facing === 1 && sourceX >= defender.x)
    || (defender.facing === -1 && sourceX <= defender.x)
  if (!defender.blocking || !faces || defender.y >= 0.35) {
    return false
  }
  if (level === 'low') {
    return defender.crouching
  }
  if (level === 'high' || level === 'overhead') {
    return !defender.crouching
  }
  return true
}

export function attackPhase(fighter: FighterState): AttackPhase | null {
  const spec = attackSpec(fighter)
  if (!spec) {
    return null
  }

  if (fighter.actionTime < spec.startup) {
    return 'startup'
  }

  if (fighter.actionTime < spec.startup + spec.active) {
    return 'active'
  }

  return 'recovery'
}

export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

export function hurtbox(fighter: FighterState): Aabb {
  const height = fighter.crouching ? CROUCH_HURT_HEIGHT : HURT_HEIGHT
  return {
    minX: fighter.x - HURT_HALF_W,
    maxX: fighter.x + HURT_HALF_W,
    minY: fighter.y,
    maxY: fighter.y + height,
  }
}

export function hitbox(fighter: FighterState): Aabb | null {
  const spec = attackSpec(fighter)
  if (attackPhase(fighter) !== 'active' || !spec) {
    return null
  }

  const centerX = fighter.x + fighter.facing * spec.reach
  return {
    minX: centerX - spec.hitW / 2,
    maxX: centerX + spec.hitW / 2,
    minY: fighter.y + spec.hitY - spec.hitH / 2,
    maxY: fighter.y + spec.hitY + spec.hitH / 2,
  }
}
