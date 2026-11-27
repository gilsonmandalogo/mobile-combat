import type { ArenaBounds, AttackSpec } from '@src/sim/constants'

export type FighterId = 'player1' | 'player2'
export type Action = 'idle' | 'walk' | 'jump' | 'prejump' | 'land' | 'crouch' | 'attackUp' | 'attackDown' | 'crouchPunch' | 'crouchKick' | 'jumpPunch' | 'jumpKick' | 'special' | 'super' | 'block' | 'hitstun' | 'juggle' | 'knockdown' | 'ko'
export type InputToken = 'back' | 'forward' | 'up' | 'punch' | 'kick'
export type SpecialEffect = 'projectile' | 'dash' | 'uppercut' | 'teleport'
export type DeviceKind = 'keyboard' | 'gamepad' | 'ai'
export type MatchStatus = 'menu' | 'running' | 'paused' | 'roundEnd' | 'matchEnd'
export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare'
export type MatchMode = 'local' | 'ai' | 'online'
export type AttackName = 'attackUp' | 'attackDown' | 'crouchPunch' | 'crouchKick' | 'jumpPunch' | 'jumpKick'
export type HitLevel = 'high' | 'mid' | 'low' | 'overhead'

export interface Intent {
  move: -1 | 0 | 1
  jump: boolean
  attackUp: boolean
  attackDown: boolean
  block: boolean
  crouch: boolean
  super: boolean
}

export const EMPTY_INTENT: Intent = {
  move: 0,
  jump: false,
  attackUp: false,
  attackDown: false,
  block: false,
  crouch: false,
  super: false,
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
  /** Super meter. It carries across rounds and clears when a new match starts. */
  energy: number
  score: number
  action: Action
  actionTime: number
  blocking: boolean
  crouching: boolean
  /** World direction locked at the start of a jump. Zero is a neutral hop. */
  jumpDir: -1 | 0 | 1
  /** True after the one air attack allowed in this jump. */
  airAttack: boolean
  airHurtHeight: number
  airHurtHalfW: number
  blockstun: number
  hitstun: number
  invuln: number
  attackResolved: boolean
  ko: boolean
  device: DeviceKind
  characterId: string
  speed: number
  damageScale: number
  chips: AttackChips
  combos: ComboSpec[]
  attacks: Record<AttackName, AttackSpec>
  special: ActiveSpecial | null
}

export interface MatchState {
  status: MatchStatus
  /** Status to restore when a pause ends. */
  resumeStatus: 'running' | 'roundEnd' | null
  mode: MatchMode
  difficulty: Difficulty
  round: number
  roundsToWin: number
  maxRounds: number
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
  /** Deterministic RNG cursor. Critical hits advance it. */
  rng: number
  hitStop: number
  critChance: number
  projectiles: ProjectileState[]
  motions: Record<FighterId, MotionMemory>
  arenaId: string
  arena: ArenaBounds
  callout: string | null
  calloutTime: number
}

export interface Aabb {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type GameEvent =
  | { type: 'attack'; fighter: FighterId; attack: AttackName | 'special' | 'super' }
  | { type: 'hit'; attacker: FighterId; defender: FighterId; damage: number; blocked: boolean; critical?: boolean }
  | { type: 'ko'; fighter: FighterId }
  | { type: 'roundEnd'; winner: FighterId | 'draw'; round: number }
  | { type: 'roundStart'; round: number }
  | { type: 'matchEnd'; winner: FighterId }
  | { type: 'retract'; of: 'hit' | 'attack' | 'ko' | 'roundStart' | 'roundEnd' | 'matchEnd'; attacker?: FighterId; defender?: FighterId }

export interface MatchOptions {
  mode: MatchMode
  difficulty: Difficulty
  roundTime: number
  roundsToWin?: number
  maxRounds?: number
  names: [string, string]
  devices: [DeviceKind, DeviceKind]
  seed: number
  critChance?: number
  profiles?: [FighterProfile, FighterProfile]
  arenaId?: string
  arena?: ArenaBounds
}

export interface FighterProfile {
  characterId?: string
  maxLife?: number
  speed?: number
  damageScale?: number
  chips?: AttackChips
  combos?: ComboSpec[]
  attacks?: Record<AttackName, AttackSpec>
  airHurtHeight?: number
  airHurtHalfW?: number
}

export interface AttackChips {
  attackUp: number
  attackDown: number
  crouchPunch?: number
  crouchKick?: number
  jumpPunch?: number
  jumpKick?: number
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
  /** Fraction of damage that lands while blocking. Omitted means the default chip. */
  chip?: number
  hitLevel?: HitLevel
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
  chip: number
  level: HitLevel
}
