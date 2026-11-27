import type { AttackName, HitLevel } from '@src/sim/types'

export const MAX_LIFE = 100
export const ROUND_END_DELAY = 2.2
export const INTRO_TIME = 1
export const MOVE_SPEED = 3.4
export const JUMP_SPEED = 7.6
export const JUMP_CARRY = 3.1
export const PREJUMP_TIME = 4 / 60
export const LAND_TIME = 5 / 60
export const KNOCKDOWN_TIME = 0.42
export const GRAVITY = 20
export const AIR_HURT_HEIGHT = 1.2
export const AIR_HURT_HALF_W = 0.32
export const STAGE_MIN_X = -6
export const STAGE_MAX_X = 6
export const PUSH_DISTANCE = 0.9
export const KNOCKBACK_DECAY = 3.2
export const BLOCK_CHIP = 0.2
export const BLOCK_PUSH = 0.35
export const BLOCK_STUN_SCALE = 0.6
export const BLOCK_STUN_MIN = 0.16
export const HURT_HALF_W = 0.36
export const HURT_HEIGHT = 1.72
export const CROUCH_HURT_HEIGHT = 0.98
export const SPAWN_X = 3.6

export interface ArenaBounds {
  minX: number
  maxX: number
  spawns: [number, number]
}

export const DEFAULT_ARENA: ArenaBounds = {
  minX: STAGE_MIN_X,
  maxX: STAGE_MAX_X,
  spawns: [-SPAWN_X, SPAWN_X],
}

export interface AttackSpec {
  damage: number
  knockback: number
  hitstun: number
  startup: number
  active: number
  recovery: number
  /** Distance from the fighter's center to the hitbox center, along facing. */
  reach: number
  hitY: number
  hitW: number
  hitH: number
  hop: number
  hitLevel?: HitLevel
}

export const ATTACKS: Record<'attackUp' | 'attackDown', AttackSpec> = {
  attackUp: {
    damage: 9,
    knockback: 4.2,
    hitstun: 0.34,
    startup: 0.1,
    active: 0.13,
    recovery: 0.24,
    reach: 1.02,
    hitY: 1.28,
    hitW: 0.78,
    hitH: 0.52,
    hop: 3.2,
    hitLevel: 'high',
  },
  attackDown: {
    damage: 14,
    knockback: 6.4,
    hitstun: 0.46,
    startup: 0.14,
    active: 0.12,
    recovery: 0.32,
    reach: 0.92,
    hitY: 0.62,
    hitW: 0.86,
    hitH: 0.5,
    hop: 4.4,
    hitLevel: 'mid',
  },
}

export const CROUCH_ATTACKS: Record<'crouchPunch' | 'crouchKick', AttackSpec> = {
  crouchPunch: {
    damage: 7,
    knockback: 3.4,
    hitstun: 0.28,
    startup: 0.08,
    active: 0.12,
    recovery: 0.2,
    reach: 0.86,
    hitY: 0.55,
    hitW: 0.7,
    hitH: 0.4,
    hop: 1.4,
    hitLevel: 'mid',
  },
  crouchKick: {
    damage: 12,
    knockback: 5.6,
    hitstun: 0.42,
    startup: 0.16,
    active: 0.14,
    recovery: 0.34,
    reach: 1.08,
    hitY: 0.28,
    hitW: 1.05,
    hitH: 0.32,
    hop: 2.4,
    hitLevel: 'low',
  },
}

export const JUMP_ATTACKS: Record<'jumpPunch' | 'jumpKick', AttackSpec> = {
  jumpPunch: {
    damage: 8,
    knockback: 3.6,
    hitstun: 0.32,
    startup: 0.06,
    active: 0.1,
    recovery: 0.16,
    reach: 0.82,
    hitY: 0.42,
    hitW: 0.7,
    hitH: 0.55,
    hop: 3.4,
    hitLevel: 'overhead',
  },
  jumpKick: {
    damage: 11,
    knockback: 4.4,
    hitstun: 0.36,
    startup: 0.08,
    active: 0.12,
    recovery: 0.18,
    reach: 0.96,
    hitY: 0.34,
    hitW: 0.78,
    hitH: 0.5,
    hop: 3.8,
    hitLevel: 'overhead',
  },
}

export function defaultAttackBook(): Record<AttackName, AttackSpec> {
  return {
    attackUp: { ...ATTACKS.attackUp },
    attackDown: { ...ATTACKS.attackDown },
    crouchPunch: { ...CROUCH_ATTACKS.crouchPunch },
    crouchKick: { ...CROUCH_ATTACKS.crouchKick },
    jumpPunch: { ...JUMP_ATTACKS.jumpPunch },
    jumpKick: { ...JUMP_ATTACKS.jumpKick },
  }
}

export function attackDuration(spec: AttackSpec): number {
  return spec.startup + spec.active + spec.recovery
}
