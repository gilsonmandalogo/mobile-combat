import { ATTACKS, BLOCK_CHIP, GRAVITY, INTRO_TIME, JUMP_SPEED, KNOCKBACK_DECAY, MAX_LIFE, MAX_ROUNDS, MOVE_SPEED, PUSH_DISTANCE, ROUND_END_DELAY, ROUNDS_TO_WIN, SPAWN_X, STAGE_MAX_X, STAGE_MIN_X, attackDuration } from '@src/sim/constants'
import { attackPhase, hitbox, hurtbox, isAttack, overlaps } from '@src/sim/hitboxes'
import { EMPTY_INTENT } from '@src/sim/types'
import type { FighterId, FighterState, GameEvent, Intent, MatchOptions, MatchState } from '@src/sim/types'

export interface StepResult {
  state: MatchState
  events: GameEvent[]
}

interface HitPreview {
  damage: number
  blocked: boolean
  knockback: number
  hitstun: number
  hop: number
  event: Extract<GameEvent, { type: 'hit' }>
}

export function createFighter(
  id: FighterId,
  name: string,
  x: number,
  facing: 1 | -1,
  device: FighterState['device'],
): FighterState {
  return {
    id,
    name,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    life: MAX_LIFE,
    maxLife: MAX_LIFE,
    score: 0,
    action: 'idle',
    actionTime: 0,
    blocking: false,
    hitstun: 0,
    invuln: 0,
    attackResolved: false,
    ko: false,
    device,
  }
}

export function createMatch(options: MatchOptions): MatchState {
  return {
    status: 'menu',
    resumeStatus: null,
    mode: options.mode,
    difficulty: options.difficulty,
    round: 1,
    roundTime: options.roundTime,
    timeLeft: options.roundTime,
    introTime: 0,
    fighters: [
      createFighter('player1', options.names[0], -SPAWN_X, 1, options.devices[0]),
      createFighter('player2', options.names[1], SPAWN_X, -1, options.devices[1]),
    ],
    matchPending: false,
    winner: null,
    roundWinner: null,
    banner: null,
    bannerTime: 0,
    seed: options.seed,
  }
}

export function restartMatch(state: MatchState): MatchState {
  return startMatch(createMatch({
    mode: state.mode,
    difficulty: state.difficulty,
    roundTime: state.roundTime,
    names: [state.fighters[0].name, state.fighters[1].name],
    devices: [state.fighters[0].device, state.fighters[1].device],
    seed: state.seed,
  })).state
}

export function quitToMenu(state: MatchState): MatchState {
  return createMatch({
    mode: state.mode,
    difficulty: state.difficulty,
    roundTime: state.roundTime,
    names: [state.fighters[0].name, state.fighters[1].name],
    devices: [state.fighters[0].device, state.fighters[1].device],
    seed: state.seed,
  })
}

export function startMatch(state: MatchState): StepResult {
  const reset = startRound({
    ...state,
    winner: null,
    matchPending: false,
    fighters: state.fighters.map((fighter) => ({ ...fighter, score: 0 })) as MatchState['fighters'],
  }, 1)
  return { state: reset, events: [{ type: 'roundStart', round: 1 }] }
}

export function pauseMatch(state: MatchState): MatchState {
  if (state.status !== 'running' && state.status !== 'roundEnd') {
    return state
  }

  return { ...state, status: 'paused', resumeStatus: state.status }
}

export function resumeMatch(state: MatchState): MatchState {
  if (state.status !== 'paused') {
    return state
  }

  return { ...state, status: state.resumeStatus ?? 'running', resumeStatus: null }
}

export function stepMatch(state: MatchState, intents: Record<FighterId, Intent>, dt: number): StepResult {
  if (dt <= 0 || state.status === 'menu' || state.status === 'paused' || state.status === 'matchEnd') {
    return { state, events: [] }
  }

  if (state.status === 'roundEnd') {
    return stepRoundEnd(state, dt)
  }

  if (state.introTime > 0) {
    const introTime = Math.max(0, state.introTime - dt)
    const stepped = integrate(state, EMPTY_INTENT, EMPTY_INTENT, dt, false)
    return {
      state: {
        ...stepped.state,
        introTime,
        banner: introTime > 0 ? state.banner : null,
      },
      events: [],
    }
  }

  const stepped = integrate(state, intents.player1, intents.player2, dt, true)
  let next = stepped.state
  const events = stepped.events
  next = { ...next, timeLeft: next.timeLeft - dt }

  if (events.some((event) => event.type === 'ko')) {
    const concluded = concludeRound(next, 'ko')
    return { state: concluded.state, events: [...events, ...concluded.events] }
  }

  if (next.timeLeft <= 0) {
    const concluded = concludeRound({ ...next, timeLeft: 0 }, 'time')
    return { state: concluded.state, events: [...events, ...concluded.events] }
  }

  return { state: next, events }
}

export function stepSeconds(
  state: MatchState,
  intents: Record<FighterId, Intent> | ((state: MatchState) => Record<FighterId, Intent>),
  seconds: number,
  dt = 1 / 60,
): StepResult {
  let current = state
  const events: GameEvent[] = []
  let elapsed = 0
  while (elapsed < seconds - 1e-8) {
    const step = Math.min(dt, seconds - elapsed)
    const frame = typeof intents === 'function' ? intents(current) : intents
    const result = stepMatch(current, frame, step)
    current = result.state
    events.push(...result.events)
    elapsed += step
  }
  return { state: current, events }
}

function stepRoundEnd(state: MatchState, dt: number): StepResult {
  const stepped = integrate(state, EMPTY_INTENT, EMPTY_INTENT, dt, false)
  const bannerTime = state.bannerTime + dt
  if (bannerTime < ROUND_END_DELAY) {
    return { state: { ...stepped.state, status: 'roundEnd', bannerTime }, events: [] }
  }

  if (state.matchPending) {
    const winner = state.winner
    const name = winner ? nameOf(stepped.state, winner) : null
    return {
      state: {
        ...stepped.state,
        status: 'matchEnd',
        banner: name ? `${name} wins` : 'Draw',
        bannerTime,
        winner,
      },
      events: winner ? [{ type: 'matchEnd', winner }] : [],
    }
  }

  const next = startRound(stepped.state, state.round + 1)
  return { state: next, events: [{ type: 'roundStart', round: next.round }] }
}

function startRound(state: MatchState, round: number): MatchState {
  return {
    ...state,
    status: 'running',
    resumeStatus: null,
    round,
    timeLeft: state.roundTime,
    introTime: INTRO_TIME,
    banner: `Round ${round}`,
    bannerTime: 0,
    roundWinner: null,
    matchPending: false,
    winner: null,
    fighters: [
      resetFighter(state.fighters[0], -SPAWN_X, 1),
      resetFighter(state.fighters[1], SPAWN_X, -1),
    ],
  }
}

function resetFighter(fighter: FighterState, x: number, facing: 1 | -1): FighterState {
  return {
    ...fighter,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    life: fighter.maxLife,
    action: 'idle',
    actionTime: 0,
    blocking: false,
    hitstun: 0,
    invuln: 0,
    attackResolved: false,
    ko: false,
  }
}

function concludeRound(state: MatchState, reason: 'ko' | 'time'): StepResult {
  const [first, second] = state.fighters
  let roundWinner: FighterId | 'draw'
  if (reason === 'ko') {
    if (first.ko && second.ko) {
      roundWinner = 'draw'
    } else if (first.ko) {
      roundWinner = 'player2'
    } else {
      roundWinner = 'player1'
    }
  } else if (first.life > second.life) {
    roundWinner = 'player1'
  } else if (second.life > first.life) {
    roundWinner = 'player2'
  } else {
    roundWinner = 'draw'
  }

  const fighters = state.fighters.map((fighter) => {
    if (roundWinner !== 'draw' && fighter.id === roundWinner) {
      return { ...fighter, score: fighter.score + 1 }
    }
    return fighter
  }) as MatchState['fighters']

  const score1 = fighters[0].score
  const score2 = fighters[1].score
  const matchPending = score1 >= ROUNDS_TO_WIN
    || score2 >= ROUNDS_TO_WIN
    || (state.round >= 3 && score1 !== score2)
    || state.round >= MAX_ROUNDS

  let winner: FighterId | null = null
  if (matchPending) {
    if (score1 > score2) {
      winner = 'player1'
    } else if (score2 > score1) {
      winner = 'player2'
    }
  }

  const winnerName = roundWinner === 'draw' ? null : nameOf({ ...state, fighters }, roundWinner)
  const banner = reason === 'ko'
    ? 'K.O.'
    : roundWinner === 'draw' || !winnerName
      ? 'Draw'
      : `${winnerName} takes the round`

  return {
    state: {
      ...state,
      fighters,
      status: 'roundEnd',
      roundWinner,
      winner,
      matchPending,
      banner,
      bannerTime: 0,
    },
    events: [{ type: 'roundEnd', winner: roundWinner, round: state.round }],
  }
}

function integrate(
  state: MatchState,
  intent1: Intent,
  intent2: Intent,
  dt: number,
  resolveHits: boolean,
): StepResult {
  const events: GameEvent[] = []
  const [rawA, rawB] = state.fighters
  const facedA = faceOpponent(rawA, rawB)
  const facedB = faceOpponent(rawB, rawA)
  const steppedA = stepFighter(facedA, intent1, dt)
  const steppedB = stepFighter(facedB, intent2, dt)
  pushAttack(events, facedA, steppedA)
  pushAttack(events, facedB, steppedB)

  let first = steppedA
  let second = steppedB
  const separated = separate(first, second)
  first = separated[0]
  second = separated[1]

  if (resolveHits) {
    const resolved = resolveBoth(first, second)
    first = resolved.first
    second = resolved.second
    events.push(...resolved.events)
  }

  return {
    state: { ...state, fighters: [first, second] },
    events,
  }
}

function pushAttack(events: GameEvent[], before: FighterState, after: FighterState) {
  if (!isAttack(before.action) && isAttack(after.action)) {
    events.push({ type: 'attack', fighter: after.id, attack: after.action })
  }
}

function resolveBoth(first: FighterState, second: FighterState): { first: FighterState; second: FighterState; events: GameEvent[] } {
  const events: GameEvent[] = []
  const toSecond = previewHit(first, second)
  const toFirst = previewHit(second, first)
  let nextFirst = first
  let nextSecond = second

  if (toSecond) {
    nextFirst = { ...nextFirst, attackResolved: true }
    nextSecond = receiveHit(nextSecond, toSecond)
    events.push(toSecond.event)
    if (nextSecond.ko) {
      events.push({ type: 'ko', fighter: nextSecond.id })
    }
  }

  if (toFirst) {
    nextSecond = { ...nextSecond, attackResolved: true }
    nextFirst = receiveHit(nextFirst, toFirst)
    events.push(toFirst.event)
    if (nextFirst.ko) {
      events.push({ type: 'ko', fighter: nextFirst.id })
    }
  }

  return { first: nextFirst, second: nextSecond, events }
}

function previewHit(attacker: FighterState, defender: FighterState): HitPreview | null {
  if (attacker.ko || defender.ko || attacker.attackResolved || defender.invuln > 0) {
    return null
  }

  if (!isAttack(attacker.action) || attackPhase(attacker) !== 'active') {
    return null
  }

  const box = hitbox(attacker)
  if (!box || !overlaps(box, hurtbox(defender))) {
    return null
  }

  const spec = ATTACKS[attacker.action]
  const facesAttacker = (defender.facing === 1 && attacker.x >= defender.x)
    || (defender.facing === -1 && attacker.x <= defender.x)
  const blocked = defender.blocking && facesAttacker && defender.y < 0.35
  const damage = blocked ? Math.max(1, Math.round(spec.damage * BLOCK_CHIP)) : spec.damage
  const dir = Math.sign(defender.x - attacker.x) || attacker.facing

  return {
    damage,
    blocked,
    knockback: dir * (blocked ? spec.knockback * 0.25 : spec.knockback),
    hitstun: blocked ? spec.hitstun * 0.45 : spec.hitstun,
    hop: blocked ? 0 : spec.hop,
    event: {
      type: 'hit',
      attacker: attacker.id,
      defender: defender.id,
      damage,
      blocked,
    },
  }
}

function receiveHit(defender: FighterState, hit: HitPreview): FighterState {
  const life = Math.max(0, defender.life - hit.damage)
  const ko = life <= 0
  return {
    ...defender,
    life,
    ko,
    action: ko ? 'ko' : 'hitstun',
    actionTime: 0,
    hitstun: ko ? 0 : hit.hitstun,
    invuln: hit.hitstun,
    vx: hit.knockback,
    vy: Math.max(defender.vy, hit.hop),
    blocking: false,
  }
}

function stepFighter(fighter: FighterState, intent: Intent, dt: number): FighterState {
  const hitstun = Math.max(0, fighter.hitstun - dt)
  const invuln = Math.max(0, fighter.invuln - dt)
  const base = { ...fighter, hitstun, invuln }

  if (fighter.ko) {
    const vertical = integrateVertical(fighter.y, fighter.vy, dt)
    return {
      ...base,
      action: 'ko',
      actionTime: fighter.actionTime + dt,
      x: clampX(fighter.x + fighter.vx * dt),
      vx: decay(fighter.vx, dt),
      y: vertical.y,
      vy: vertical.vy,
      blocking: false,
    }
  }

  if (fighter.hitstun > 0) {
    const vertical = integrateVertical(fighter.y, fighter.vy, dt)
    const stillStunned = hitstun > 0
    return {
      ...base,
      action: stillStunned ? 'hitstun' : 'idle',
      actionTime: stillStunned ? fighter.actionTime + dt : 0,
      x: clampX(fighter.x + fighter.vx * dt),
      vx: decay(fighter.vx, dt),
      y: vertical.y,
      vy: vertical.vy,
      blocking: false,
    }
  }

  if (isAttack(fighter.action)) {
    const spec = ATTACKS[fighter.action]
    const actionTime = fighter.actionTime + dt
    const vertical = integrateVertical(fighter.y, fighter.vy, dt)
    if (actionTime < attackDuration(spec)) {
      return {
        ...base,
        action: fighter.action,
        actionTime,
        x: clampX(fighter.x + fighter.vx * dt),
        vx: decay(fighter.vx, dt),
        y: vertical.y,
        vy: vertical.vy,
        blocking: false,
      }
    }
  }

  const vertical = integrateVertical(fighter.y, fighter.vy, dt)
  const grounded = vertical.y <= 0
  let action: FighterState['action'] = grounded ? 'idle' : 'jump'
  let vx = 0

  if (intent.block && grounded) {
    action = 'block'
    vx = intent.move * MOVE_SPEED * 0.28
  } else if (!grounded) {
    action = 'jump'
    vx = intent.move * MOVE_SPEED * 0.8
  } else if (intent.move !== 0) {
    action = 'walk'
    vx = intent.move * MOVE_SPEED
  }

  if (grounded && (intent.attackUp || intent.attackDown)) {
    const attack = intent.attackUp ? 'attackUp' : 'attackDown'
    return {
      ...base,
      action: attack,
      actionTime: 0,
      attackResolved: false,
      x: clampX(fighter.x),
      y: 0,
      vy: 0,
      vx: 0,
      blocking: false,
    }
  }

  if (intent.jump && grounded && !intent.block) {
    return {
      ...base,
      action: 'jump',
      actionTime: 0,
      x: clampX(fighter.x),
      y: 0,
      vy: JUMP_SPEED,
      vx,
      blocking: false,
    }
  }

  const sameLocomotion = action === fighter.action && (action === 'idle' || action === 'walk' || action === 'block' || action === 'jump')
  return {
    ...base,
    action,
    actionTime: sameLocomotion ? fighter.actionTime + dt : 0,
    x: clampX(fighter.x + vx * dt),
    y: vertical.y,
    vy: vertical.vy,
    vx,
    blocking: action === 'block',
  }
}

function faceOpponent(self: FighterState, other: FighterState): FighterState {
  if (self.ko || self.hitstun > 0 || isAttack(self.action)) {
    return self
  }

  const facing: 1 | -1 = other.x >= self.x ? 1 : -1
  return { ...self, facing }
}

function separate(first: FighterState, second: FighterState): [FighterState, FighterState] {
  const delta = second.x - first.x
  const distance = Math.abs(delta)
  if (distance >= PUSH_DISTANCE) {
    return [first, second]
  }

  if (distance === 0) {
    return [
      { ...first, x: clampX(first.x - PUSH_DISTANCE / 2) },
      { ...second, x: clampX(second.x + PUSH_DISTANCE / 2) },
    ]
  }

  const push = (PUSH_DISTANCE - distance) / 2
  const dir = delta > 0 ? 1 : -1
  return [
    { ...first, x: clampX(first.x - dir * push) },
    { ...second, x: clampX(second.x + dir * push) },
  ]
}

function integrateVertical(y: number, vy: number, dt: number): { y: number; vy: number } {
  if (y <= 0 && vy <= 0) {
    return { y: 0, vy: 0 }
  }

  const nextVy = vy - GRAVITY * dt
  const nextY = y + nextVy * dt
  if (nextY <= 0) {
    return { y: 0, vy: 0 }
  }

  return { y: nextY, vy: nextVy }
}

function decay(vx: number, dt: number): number {
  const next = vx * Math.exp(-KNOCKBACK_DECAY * dt)
  return Math.abs(next) < 0.04 ? 0 : next
}

function clampX(x: number): number {
  return Math.min(STAGE_MAX_X, Math.max(STAGE_MIN_X, x))
}

function nameOf(state: MatchState, id: FighterId): string {
  return state.fighters.find((fighter) => fighter.id === id)?.name ?? id
}
