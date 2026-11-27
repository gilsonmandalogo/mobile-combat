import { AIR_HURT_HALF_W, AIR_HURT_HEIGHT, CROUCH_HURT_HEIGHT, HURT_HALF_W, HURT_HEIGHT } from '@src/sim/constants'
import type { AttackSpec } from '@src/sim/constants'
import type { Aabb, FighterState, HitLevel } from '@src/sim/types'

export type AttackPhase = 'startup' | 'active' | 'recovery'

const STRIKES = new Set<FighterState['action']>(['attackUp', 'attackDown', 'crouchPunch', 'crouchKick', 'jumpPunch', 'jumpKick', 'special'])

export function isAttack(action: FighterState['action']): boolean {
  return STRIKES.has(action)
}

export function attackSpec(fighter: FighterState): AttackSpec | null {
  if (fighter.action === 'attackUp' || fighter.action === 'attackDown' || fighter.action === 'crouchPunch' || fighter.action === 'crouchKick' || fighter.action === 'jumpPunch' || fighter.action === 'jumpKick') {
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
  if (!defender.blocking || !faces || defender.y > 0.05) {
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
  const airborne = fighter.y > 0.05
    || fighter.action === 'jump'
    || fighter.action === 'jumpPunch'
    || fighter.action === 'jumpKick'
    || fighter.action === 'juggle'
  if (airborne) {
    const half = fighter.airHurtHalfW || AIR_HURT_HALF_W
    const height = fighter.airHurtHeight || AIR_HURT_HEIGHT
    return {
      minX: fighter.x - half,
      maxX: fighter.x + half,
      minY: fighter.y,
      maxY: fighter.y + height,
    }
  }
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
  let minY = fighter.y + spec.hitY - spec.hitH / 2
  const maxY = fighter.y + spec.hitY + spec.hitH / 2
  if (fighter.action === 'jumpPunch' || fighter.action === 'jumpKick') {
    // The fist stays in front of the body. The collision also reaches down
    // through the jump, including the apex, onto a crouching opponent.
    minY = Math.min(minY, CROUCH_HURT_HEIGHT * 0.5)
  }
  return {
    minX: centerX - spec.hitW / 2,
    maxX: centerX + spec.hitW / 2,
    minY,
    maxY,
  }
}
