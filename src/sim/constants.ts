import type { AttackName } from '@src/sim/types'

export const MAX_LIFE = 100
export const ROUNDS_TO_WIN = 2
export const MAX_ROUNDS = 5
export const ROUND_END_DELAY = 2.2
export const INTRO_TIME = 1
export const MOVE_SPEED = 3.4
export const JUMP_SPEED = 7.6
export const GRAVITY = 20
export const STAGE_MIN_X = -6
export const STAGE_MAX_X = 6
export const PUSH_DISTANCE = 0.9
export const KNOCKBACK_DECAY = 3.2
export const BLOCK_CHIP = 0.2
export const HURT_HALF_W = 0.36
export const HURT_HEIGHT = 1.72
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
}

export const ATTACKS: Record<AttackName, AttackSpec> = {
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
  },
}

export function attackDuration(spec: AttackSpec): number {
  return spec.startup + spec.active + spec.recovery
}
