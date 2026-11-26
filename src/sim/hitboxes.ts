import { ATTACKS, HURT_HALF_W, HURT_HEIGHT } from '@src/sim/constants'
import type { Aabb, AttackName, FighterState } from '@src/sim/types'

export type AttackPhase = 'startup' | 'active' | 'recovery'

export function isAttack(action: FighterState['action']): action is AttackName {
  return action === 'attackUp' || action === 'attackDown'
}

export function attackPhase(fighter: FighterState): AttackPhase | null {
  if (!isAttack(fighter.action)) {
    return null
  }

  const spec = ATTACKS[fighter.action]
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
  return {
    minX: fighter.x - HURT_HALF_W,
    maxX: fighter.x + HURT_HALF_W,
    minY: fighter.y,
    maxY: fighter.y + HURT_HEIGHT,
  }
}

export function hitbox(fighter: FighterState): Aabb | null {
  if (attackPhase(fighter) !== 'active' || !isAttack(fighter.action)) {
    return null
  }

  const spec = ATTACKS[fighter.action]
  const centerX = fighter.x + fighter.facing * spec.reach
  return {
    minX: centerX - spec.hitW / 2,
    maxX: centerX + spec.hitW / 2,
    minY: fighter.y + spec.hitY - spec.hitH / 2,
    maxY: fighter.y + spec.hitY + spec.hitH / 2,
  }
}
