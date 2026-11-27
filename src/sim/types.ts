import type { ArenaBounds } from '@src/sim/constants'

export type FighterId = 'player1' | 'player2'
export type Action = 'idle' | 'walk' | 'jump' | 'attackUp' | 'attackDown' | 'special' | 'block' | 'hitstun' | 'ko'
export type InputToken = 'back' | 'forward' | 'up' | 'punch' | 'kick'
export type SpecialEffect = 'projectile' | 'dash' | 'uppercut' | 'teleport'
export type DeviceKind = 'keyboard' | 'gamepad' | 'ai'
export type MatchStatus = 'menu' | 'running' | 'paused' | 'roundEnd' | 'matchEnd'
export type Difficulty = 'easy' | 'normal' | 'hard'
export type MatchMode = 'local' | 'ai'
export type AttackName = 'attackUp' | 'attackDown'

export interface Intent {
  move: -1 | 0 | 1
  jump: boolean
  attackUp: boolean
  attackDown: boolean
  block: boolean
}

export const EMPTY_INTENT: Intent = {
  move: 0,
  jump: false,
  attackUp: false,
  attackDown: false,
  block: false,
}

export interface FighterState {
  id: FighterId
  name: string
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1
  life: number
  maxLife: number
  score: number
  action: Action
  actionTime: number
  blocking: boolean
  hitstun: number
  invuln: number
  attackResolved: boolean
  ko: boolean
  device: DeviceKind
  characterId: string
  speed: number
  damageScale: number
  combos: ComboSpec[]
  special: ActiveSpecial | null
}

export interface MatchState {
  status: MatchStatus
  /** Status to restore when a pause ends. */
  resumeStatus: 'running' | 'roundEnd' | null
  mode: MatchMode
  difficulty: Difficulty
  round: number
  roundTime: number
  timeLeft: number
  introTime: number
  fighters: [FighterState, FighterState]
  /** Set when the match result is already known and the end-of-round pause is still playing. */
  matchPending: boolean
  winner: FighterId | null
  roundWinner: FighterId | 'draw' | null
  banner: string | null
  bannerTime: number
  seed: number
  projectiles: ProjectileState[]
  motions: Record<FighterId, MotionMemory>
  arenaId: string
  arena: ArenaBounds
}

export interface Aabb {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type GameEvent =
  | { type: 'attack'; fighter: FighterId; attack: AttackName | 'special' }
  | { type: 'hit'; attacker: FighterId; defender: FighterId; damage: number; blocked: boolean }
  | { type: 'ko'; fighter: FighterId }
  | { type: 'roundEnd'; winner: FighterId | 'draw'; round: number }
  | { type: 'roundStart'; round: number }
  | { type: 'matchEnd'; winner: FighterId }

export interface MatchOptions {
  mode: MatchMode
  difficulty: Difficulty
  roundTime: number
  names: [string, string]
  devices: [DeviceKind, DeviceKind]
  seed: number
  profiles?: [FighterProfile, FighterProfile]
  arenaId?: string
  arena?: ArenaBounds
}

export interface FighterProfile {
  characterId?: string
  maxLife?: number
  speed?: number
  damageScale?: number
  combos?: ComboSpec[]
}

export interface ComboSpec {
  id: string
  name: string
  sequence: InputToken[]
  window: number
  damage: number
  effect: SpecialEffect
  startup: number
  active: number
  recovery: number
  reach: number
  hitY: number
  hitW: number
  hitH: number
  knockback: number
  hop: number
}

export interface ActiveSpecial extends ComboSpec {
  hitstun: number
  applied: boolean
}

export interface StampedToken {
  token: InputToken
  age: number
}

export interface MotionMemory {
  tokens: StampedToken[]
  move: -1 | 0 | 1
  jump: boolean
  attackUp: boolean
  attackDown: boolean
}

export interface ProjectileState {
  owner: FighterId
  x: number
  y: number
  vx: number
  ttl: number
  damage: number
  knockback: number
  hitstun: number
  hop: number
  w: number
  h: number
}
