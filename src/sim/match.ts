import { AIR_HURT_HALF_W, AIR_HURT_HEIGHT, BLOCK_CHIP, BLOCK_PUSH, BLOCK_STUN_MIN, BLOCK_STUN_SCALE, DEFAULT_ARENA, GRAVITY, INTRO_TIME, JUMP_CARRY, JUMP_SPEED, KNOCKBACK_DECAY, KNOCKDOWN_TIME, LAND_TIME, MAX_LIFE, MOVE_SPEED, PREJUMP_TIME, PUSH_DISTANCE, ROUND_END_DELAY, attackDuration, defaultAttackBook } from '@src/sim/constants'
import { nextRng } from '@src/ai/opponent'
import { COMBAT } from '@src/sim/rules'
import type { ArenaBounds } from '@src/sim/constants'
import { bestCombo, emptyMotion, holdsJump, pushMotion } from '@src/sim/buffer'
import { attackPhase, attackSpec, blocksStrike, hitbox, hitLevelOf, hurtbox, isAttack, overlaps } from '@src/sim/hitboxes'
import { EMPTY_INTENT } from '@src/sim/types'
import type { ActiveSpecial, AttackName, ComboSpec, FighterId, FighterProfile, FighterState, GameEvent, Intent, MatchOptions, MatchState, ProjectileState } from '@src/sim/types'

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
  profile: FighterProfile = {},
): FighterState {
  const maxLife = profile.maxLife ?? MAX_LIFE
  return {
    id,
    name,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    life: maxLife,
    maxLife,
    energy: 0,
    score: 0,
    action: 'idle',
    actionTime: 0,
    blocking: false,
    crouching: false,
    jumpDir: 0,
    airAttack: false,
    airHurtHeight: profile.airHurtHeight ?? AIR_HURT_HEIGHT,
    airHurtHalfW: profile.airHurtHalfW ?? AIR_HURT_HALF_W,
    blockstun: 0,
    hitstun: 0,
    invuln: 0,
    attackResolved: false,
    ko: false,
    device,
    characterId: profile.characterId ?? 'colin',
    speed: profile.speed ?? MOVE_SPEED,
    damageScale: profile.damageScale ?? 1,
    chips: profile.chips ?? { attackUp: BLOCK_CHIP, attackDown: BLOCK_CHIP },
    combos: profile.combos ?? [],
    attacks: profile.attacks ?? defaultAttackBook(),
    special: null,
  }
}

export function createMatch(options: MatchOptions): MatchState {
  return {
    status: 'menu',
    resumeStatus: null,
    mode: options.mode,
    difficulty: options.difficulty,
    round: 1,
    roundsToWin: options.roundsToWin ?? COMBAT.roundsToWin,
    maxRounds: options.maxRounds ?? COMBAT.maxRounds,
    roundTime: options.roundTime,
    timeLeft: options.roundTime,
    introTime: 0,
    fighters: [
      createFighter('player1', options.names[0], (options.arena ?? DEFAULT_ARENA).spawns[0], 1, options.devices[0], options.profiles?.[0]),
      createFighter('player2', options.names[1], (options.arena ?? DEFAULT_ARENA).spawns[1], -1, options.devices[1], options.profiles?.[1]),
    ],
    matchPending: false,
    winner: null,
    roundWinner: null,
    banner: null,
    bannerTime: 0,
    seed: options.seed,
    rng: options.seed >>> 0,
    hitStop: 0,
    critChance: options.critChance ?? COMBAT.critChance,
    projectiles: [],
    motions: { player1: emptyMotion(), player2: emptyMotion() },
    arenaId: options.arenaId ?? 'mayan-temple',
    arena: options.arena ?? DEFAULT_ARENA,
    callout: null,
    calloutTime: 0,
  }
}

export function restartMatch(state: MatchState): MatchState {
  return startMatch(createMatch({
    mode: state.mode,
    difficulty: state.difficulty,
    roundTime: state.roundTime,
    roundsToWin: state.roundsToWin,
    maxRounds: state.maxRounds,
    names: [state.fighters[0].name, state.fighters[1].name],
    devices: [state.fighters[0].device, state.fighters[1].device],
    seed: state.seed,
    critChance: state.critChance,
    profiles: [profileOf(state.fighters[0]), profileOf(state.fighters[1])],
    arenaId: state.arenaId,
    arena: state.arena,
  })).state
}

export function quitToMenu(state: MatchState): MatchState {
  return createMatch({
    mode: state.mode,
    difficulty: state.difficulty,
    roundTime: state.roundTime,
    roundsToWin: state.roundsToWin,
    maxRounds: state.maxRounds,
    names: [state.fighters[0].name, state.fighters[1].name],
    devices: [state.fighters[0].device, state.fighters[1].device],
    seed: state.seed,
    critChance: state.critChance,
    profiles: [profileOf(state.fighters[0]), profileOf(state.fighters[1])],
    arenaId: state.arenaId,
    arena: state.arena,
  })
}

function profileOf(fighter: FighterState): FighterProfile {
  return {
    characterId: fighter.characterId,
    maxLife: fighter.maxLife,
    speed: fighter.speed,
    damageScale: fighter.damageScale,
    chips: fighter.chips,
    combos: fighter.combos,
    attacks: fighter.attacks,
    airHurtHeight: fighter.airHurtHeight,
    airHurtHalfW: fighter.airHurtHalfW,
  }
}

export function startMatch(state: MatchState): StepResult {
  const reset = startRound({
    ...state,
    winner: null,
    matchPending: false,
    fighters: state.fighters.map((fighter) => ({ ...fighter, score: 0, energy: 0 })) as MatchState['fighters'],
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

function chipRatio(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return BLOCK_CHIP
  }
  return Math.min(1, Math.max(0, value))
}

function chipDamage(raw: number, ratio: number): number {
  if (ratio <= 0) {
    return 0
  }
  return Math.max(1, Math.round(raw * ratio))
}

function blockStunFor(hitstun: number): number {
  return Math.max(BLOCK_STUN_MIN, hitstun * BLOCK_STUN_SCALE)
}

function strikeChip(attacker: FighterState): number {
  if (attacker.action === 'special') {
    return chipRatio(attacker.special?.chip)
  }
  if (attacker.action === 'attackUp' || attacker.action === 'attackDown' || attacker.action === 'crouchPunch' || attacker.action === 'crouchKick' || attacker.action === 'jumpPunch' || attacker.action === 'jumpKick') {
    return chipRatio(attacker.chips[attacker.action])
  }
  return BLOCK_CHIP
}

function fadeCallout(state: MatchState, dt: number): MatchState {
  if (state.calloutTime <= 0) {
    return state.callout ? { ...state, callout: null } : state
  }
  const calloutTime = Math.max(0, state.calloutTime - dt)
  return { ...state, calloutTime, callout: calloutTime > 0 ? state.callout : null }
}

function noteBlock(state: MatchState, events: GameEvent[], dt: number): MatchState {
  if (events.some((event) => event.type === 'hit' && event.critical)) {
    return { ...state, callout: 'CRITICAL!', calloutTime: 0.95 }
  }
  if (events.some((event) => event.type === 'hit' && event.blocked)) {
    return { ...state, callout: 'BLOCK', calloutTime: 0.75 }
  }
  return fadeCallout(state, dt)
}

export function stepMatch(state: MatchState, intents: Record<FighterId, Intent>, dt: number): StepResult {
  if (dt <= 0 || state.status === 'menu' || state.status === 'paused' || state.status === 'matchEnd') {
    return { state, events: [] }
  }

  if (state.status === 'roundEnd') {
    return stepRoundEnd(state, dt)
  }

  if (state.hitStop > 0 && state.introTime <= 0) {
    return {
      state: fadeCallout({ ...state, hitStop: Math.max(0, state.hitStop - dt) }, dt),
      events: [],
    }
  }

  if (state.introTime > 0) {
    const introTime = Math.max(0, state.introTime - dt)
    const stepped = integrate(state, EMPTY_INTENT, EMPTY_INTENT, dt, false)
    const banner = introTime <= 0
      ? null
      : introTime > INTRO_TIME * 0.5
        ? `Round ${state.round}`
        : 'Fight!'
    return {
      state: fadeCallout({
        ...stepped.state,
        introTime,
        banner,
      }, dt),
      events: [],
    }
  }

  const stepped = integrate(state, intents.player1, intents.player2, dt, true)
  let next = noteBlock(stepped.state, stepped.events, dt)
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
    return { state: fadeCallout({ ...stepped.state, status: 'roundEnd', bannerTime }, dt), events: [] }
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
    projectiles: [],
    motions: { player1: emptyMotion(), player2: emptyMotion() },
    callout: null,
    calloutTime: 0,
    hitStop: 0,
    fighters: [
      resetFighter(state.fighters[0], state.arena.spawns[0], 1),
      resetFighter(state.fighters[1], state.arena.spawns[1], -1),
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
    energy: COMBAT.energyCarry ? fighter.energy : 0,
    action: 'idle',
    actionTime: 0,
    blocking: false,
    blockstun: 0,
    hitstun: 0,
    invuln: 0,
    attackResolved: false,
    ko: false,
    crouching: false,
    jumpDir: 0,
    airAttack: false,
    special: null,
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
  const matchPending = score1 >= state.roundsToWin
    || score2 >= state.roundsToWin
    || state.round >= state.maxRounds

  let winner: FighterId | null = null
  if (matchPending) {
    if (score1 > score2) {
      winner = 'player1'
    } else if (score2 > score1) {
      winner = 'player2'
    }
  }

  const winnerName = roundWinner === 'draw' ? null : nameOf({ ...state, fighters }, roundWinner)
  const winnerFighter = roundWinner === 'draw' ? null : fighters.find((fighter) => fighter.id === roundWinner)
  const flawless = Boolean(winnerFighter && winnerFighter.life >= winnerFighter.maxLife)
  const banner = flawless
    ? 'Flawless victory'
    : reason === 'ko'
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

const DASH_SPEED = 10.5
const TELEPORT_GAP = 1.45
const SHOT_SPEED = 9

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
  let motions = state.motions
  let comboA: ComboSpec | null = null
  let comboB: ComboSpec | null = null
  let trapA = false
  let trapB = false
  if (resolveHits) {
    const recA = pushMotion(motions.player1, intent1, facedA.facing, dt)
    const recB = pushMotion(motions.player2, intent2, facedB.facing, dt)
    motions = { player1: recA.memory, player2: recB.memory }
    comboA = canStart(facedA) ? bestCombo(recA.memory.tokens, facedA.combos, recA.fresh) : null
    comboB = canStart(facedB) ? bestCombo(recB.memory.tokens, facedB.combos, recB.fresh) : null
    trapA = holdsJump(recA.memory.tokens, facedA.combos)
    trapB = holdsJump(recB.memory.tokens, facedB.combos)
  }
  const steppedA = stepFighter(facedA, intent1, dt, comboA, facedB, trapA, state.arena)
  const steppedB = stepFighter(facedB, intent2, dt, comboB, facedA, trapB, state.arena)
  pushAttack(events, facedA, steppedA)
  pushAttack(events, facedB, steppedB)

  let first = steppedA
  let second = steppedB
  const shotA = shotFrom(facedA, first)
  const shotB = shotFrom(facedB, second)
  if (shotA && first.special) {
    first = { ...first, special: { ...first.special, applied: true } }
  }
  if (shotB && second.special) {
    second = { ...second, special: { ...second.special, applied: true } }
  }
  const spawned = [shotA, shotB].filter((shot): shot is ProjectileState => shot !== null)
  let projectiles = spawned.length ? state.projectiles.concat(spawned) : state.projectiles
  const separated = separate(first, second, state.arena)
  first = separated[0]
  second = separated[1]

  let rng = state.rng
  let hitStop = 0
  if (resolveHits) {
    const resolved = resolveBoth(first, second, rng, state.critChance)
    first = resolved.first
    second = resolved.second
    rng = resolved.rng
    hitStop = resolved.hitStop
    events.push(...resolved.events)
    const shots = stepProjectiles(projectiles, first, second, dt, state.arena, rng, state.critChance)
    first = shots.first
    second = shots.second
    projectiles = shots.projectiles
    rng = shots.rng
    hitStop = Math.max(hitStop, shots.hitStop)
    events.push(...shots.events)
  }

  return {
    state: { ...state, fighters: [first, second], motions, projectiles, rng, hitStop: Math.max(state.hitStop, hitStop) },
    events,
  }
}

function pushAttack(events: GameEvent[], before: FighterState, after: FighterState) {
  if (isAttack(before.action) || !isAttack(after.action)) {
    return
  }
  if (after.action === 'attackUp' || after.action === 'attackDown' || after.action === 'crouchPunch' || after.action === 'crouchKick' || after.action === 'jumpPunch' || after.action === 'jumpKick' || after.action === 'special') {
    events.push({ type: 'attack', fighter: after.id, attack: after.action })
  }
}

function canStart(fighter: FighterState): boolean {
  return !fighter.ko
    && fighter.hitstun <= 0
    && fighter.y <= 0.02
    && !isAttack(fighter.action)
    && fighter.action !== 'prejump'
    && fighter.action !== 'land'
    && fighter.action !== 'juggle'
    && fighter.action !== 'knockdown'
}

function shotFrom(before: FighterState, after: FighterState): ProjectileState | null {
  const special = after.special
  if (after.action !== 'special' || !special || special.effect !== 'projectile' || special.applied) {
    return null
  }
  if (before.action !== 'special' || after.actionTime < special.startup) {
    return null
  }
  return {
    owner: after.id,
    x: after.x + after.facing * 0.8,
    y: special.hitY,
    vx: after.facing * SHOT_SPEED,
    ttl: 1.4,
    damage: Math.max(1, Math.round(special.damage * after.damageScale)),
    knockback: special.knockback,
    hitstun: special.hitstun,
    hop: special.hop,
    w: special.hitW,
    h: special.hitH,
    chip: chipRatio(special.chip),
    level: special.hitLevel ?? 'mid',
  }
}

function amplifyHit(hit: HitPreview, rng: number, chance: number): { hit: HitPreview; rng: number } {
  if (hit.blocked || chance <= 0) {
    return { hit, rng }
  }
  const rolled = nextRng(rng)
  if (rolled.value >= chance) {
    return { hit, rng: rolled.seed }
  }
  const damage = Math.max(1, Math.round(hit.damage * COMBAT.critDamage))
  return {
    rng: rolled.seed,
    hit: {
      ...hit,
      damage,
      event: { ...hit.event, damage, critical: true },
    },
  }
}

function grantEnergy(fighter: FighterState, amount: number): FighterState {
  if (amount <= 0) {
    return fighter
  }
  return { ...fighter, energy: Math.min(COMBAT.energyMax, fighter.energy + amount) }
}

function payMeter(attacker: FighterState, defender: FighterState, damage: number, blocked: boolean, critical = false): { attacker: FighterState; defender: FighterState } {
  const dealt = damage * (blocked ? COMBAT.energyOnBlock : COMBAT.energyOnDeal * (critical ? COMBAT.critEnergyScale : 1))
  const taken = damage * (blocked ? COMBAT.energyOnBlock : COMBAT.energyOnTake)
  return {
    attacker: grantEnergy(attacker, dealt),
    defender: grantEnergy(defender, taken),
  }
}

function resolveBoth(
  first: FighterState,
  second: FighterState,
  rng: number,
  critChance: number,
): { first: FighterState; second: FighterState; events: GameEvent[]; rng: number; hitStop: number } {
  const events: GameEvent[] = []
  const toSecond = previewHit(first, second)
  const toFirst = previewHit(second, first)
  let nextFirst = first
  let nextSecond = second
  let hitStop = 0
  const stopFor = (hit: HitPreview) => {
    if (hit.blocked) {
      return 0
    }
    return hit.event.critical ? COMBAT.critHitStop : COMBAT.hitStop
  }

  if (toSecond) {
    const amplified = amplifyHit(toSecond, rng, critChance)
    rng = amplified.rng
    nextFirst = { ...nextFirst, attackResolved: true }
    nextSecond = receiveHit(nextSecond, amplified.hit)
    const paid = payMeter(nextFirst, nextSecond, amplified.hit.damage, amplified.hit.blocked, amplified.hit.event.critical)
    nextFirst = paid.attacker
    nextSecond = paid.defender
    events.push(amplified.hit.event)
    hitStop = Math.max(hitStop, stopFor(amplified.hit))
    if (nextSecond.ko) {
      events.push({ type: 'ko', fighter: nextSecond.id })
    }
  }

  if (toFirst) {
    const amplified = amplifyHit(toFirst, rng, critChance)
    rng = amplified.rng
    nextSecond = { ...nextSecond, attackResolved: true }
    nextFirst = receiveHit(nextFirst, amplified.hit)
    const paid = payMeter(nextSecond, nextFirst, amplified.hit.damage, amplified.hit.blocked, amplified.hit.event.critical)
    nextSecond = paid.attacker
    nextFirst = paid.defender
    events.push(amplified.hit.event)
    hitStop = Math.max(hitStop, stopFor(amplified.hit))
    if (nextFirst.ko) {
      events.push({ type: 'ko', fighter: nextFirst.id })
    }
  }

  return { first: nextFirst, second: nextSecond, events, rng, hitStop }
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

  const spec = attackSpec(attacker)
  if (!spec) {
    return null
  }
  const level = hitLevelOf(attacker)
  if (level === 'high' && defender.crouching) {
    return null
  }
  const rawDamage = Math.max(1, Math.round(spec.damage * attacker.damageScale))
  const blocked = blocksStrike(defender, level, attacker.x)
  const damage = blocked ? chipDamage(rawDamage, strikeChip(attacker)) : rawDamage
  const dir = Math.sign(defender.x - attacker.x) || attacker.facing

  return {
    damage,
    blocked,
    knockback: dir * spec.knockback * (blocked ? BLOCK_PUSH : 1),
    hitstun: blocked ? blockStunFor(spec.hitstun) : spec.hitstun,
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
  if (hit.blocked && !ko) {
    return {
      ...defender,
      life,
      ko: false,
      action: 'block',
      actionTime: 0,
      blockstun: hit.hitstun,
      hitstun: 0,
      invuln: 0,
      vx: hit.knockback,
      vy: 0,
      blocking: true,
      crouching: defender.crouching,
    }
  }
  const airborne = defender.y > 0.08
  return {
    ...defender,
    life,
    ko,
    action: ko ? 'ko' : airborne ? 'juggle' : 'hitstun',
    actionTime: 0,
    blockstun: 0,
    hitstun: ko ? 0 : hit.hitstun,
    invuln: hit.hitstun,
    vx: hit.knockback,
    vy: airborne ? Math.max(2.2, defender.vy, hit.hop) : Math.max(defender.vy, hit.hop),
    blocking: false,
    crouching: false,
  }
}

function continueAttack(
  base: FighterState,
  fighter: FighterState,
  dt: number,
  opponent: FighterState,
  arena: ArenaBounds,
): FighterState | null {
  const aerial = fighter.action === 'jumpPunch' || fighter.action === 'jumpKick'
  if (!aerial && fighter.action !== 'attackUp' && fighter.action !== 'attackDown' && fighter.action !== 'crouchPunch' && fighter.action !== 'crouchKick' && fighter.action !== 'special') {
    return null
  }
  const spec = fighter.action === 'special' ? fighter.special : attackSpec(fighter)
  if (!spec) {
    return null
  }
  const actionTime = fighter.actionTime + dt
  if (actionTime >= attackDuration(spec)) {
    if (!aerial) {
      return null
    }
    const vertical = integrateVertical(fighter.y, fighter.vy, dt)
    const x = clampX(fighter.x + fighter.vx * dt, arena)
    if (vertical.y <= 0) {
      return touchDown(base, opponent, x, 'land')
    }
    return {
      ...base,
      action: 'jump',
      actionTime: fighter.actionTime + dt,
      x,
      vx: fighter.vx,
      y: vertical.y,
      vy: vertical.vy,
      airAttack: true,
      blocking: false,
      crouching: false,
    }
  }
  const vertical = integrateVertical(fighter.y, fighter.vy, dt)
  if (aerial && vertical.y <= 0) {
    return touchDown(base, opponent, clampX(fighter.x + fighter.vx * dt, arena), 'land')
  }
  const dashing = fighter.action === 'special' && fighter.special?.effect === 'dash' && actionTime < spec.startup + spec.active
  const vx = aerial ? fighter.vx : dashing ? fighter.facing * DASH_SPEED : decay(fighter.vx, dt)
  return {
    ...base,
    action: fighter.action,
    actionTime,
    x: clampX(fighter.x + vx * dt, arena),
    vx,
    y: vertical.y,
    vy: vertical.vy,
    blocking: false,
  }
}

function beginSpecial(
  base: FighterState,
  fighter: FighterState,
  combo: ComboSpec,
  opponent: FighterState,
  arena: ArenaBounds,
): FighterState {
  const special: ActiveSpecial = {
    ...combo,
    hitstun: 0.42,
    applied: combo.effect === 'teleport',
  }
  let x = fighter.x
  let vy = 0
  let vx = 0
  if (combo.effect === 'teleport') {
    x = opponent.x + fighter.facing * TELEPORT_GAP
  } else if (combo.effect === 'uppercut') {
    vy = combo.hop > 0 ? combo.hop : 8
  } else if (combo.effect === 'dash') {
    vx = fighter.facing * DASH_SPEED
  }
  return {
    ...base,
    action: 'special',
    actionTime: 0,
    attackResolved: false,
    special,
    x: clampX(x, arena),
    y: 0,
    vy,
    vx,
    blocking: false,
    crouching: false,
  }
}

function stepProjectiles(
  projectiles: ProjectileState[],
  first: FighterState,
  second: FighterState,
  dt: number,
  arena: ArenaBounds,
  rng: number,
  critChance: number,
): { projectiles: ProjectileState[]; first: FighterState; second: FighterState; events: GameEvent[]; rng: number; hitStop: number } {
  const events: GameEvent[] = []
  let left = first
  let right = second
  let hitStop = 0
  const next = projectiles.flatMap((shot) => {
    const moved: ProjectileState = { ...shot, x: shot.x + shot.vx * dt, ttl: shot.ttl - dt }
    if (moved.ttl <= 0 || Math.abs(moved.x) > arena.maxX + 2) {
      return []
    }
    const defender = moved.owner === 'player1' ? right : left
    const attacker = moved.owner === 'player1' ? left : right
    const box = {
      minX: moved.x - moved.w / 2,
      maxX: moved.x + moved.w / 2,
      minY: moved.y - moved.h / 2,
      maxY: moved.y + moved.h / 2,
    }
    if (defender.ko || defender.invuln > 0 || !overlaps(box, hurtbox(defender))) {
      return [moved]
    }
    const blocked = blocksStrike(defender, moved.level, moved.x)
    const damage = blocked ? chipDamage(moved.damage, moved.chip) : moved.damage
    const dir = Math.sign(defender.x - moved.x) || attacker.facing
    const hit: HitPreview = {
      damage,
      blocked,
      knockback: dir * moved.knockback * (blocked ? BLOCK_PUSH : 1),
      hitstun: blocked ? blockStunFor(moved.hitstun) : moved.hitstun,
      hop: blocked ? 0 : moved.hop,
      event: { type: 'hit', attacker: moved.owner, defender: defender.id, damage, blocked },
    }
    const amplified = amplifyHit(hit, rng, critChance)
    rng = amplified.rng
    const hurt = receiveHit(defender, amplified.hit)
    const paid = payMeter(attacker, hurt, amplified.hit.damage, blocked, amplified.hit.event.critical)
    if (!blocked) {
      hitStop = Math.max(hitStop, amplified.hit.event.critical ? COMBAT.critHitStop : COMBAT.hitStop)
    }
    if (moved.owner === 'player1') {
      left = paid.attacker
      right = paid.defender
    } else {
      right = paid.attacker
      left = paid.defender
    }
    events.push(amplified.hit.event)
    if (hurt.ko) {
      events.push({ type: 'ko', fighter: hurt.id })
    }
    return []
  })
  return { projectiles: next, first: left, second: right, events, rng, hitStop }
}

function stepFighter(
  fighter: FighterState,
  intent: Intent,
  dt: number,
  combo: ComboSpec | null,
  opponent: FighterState,
  trapJump = false,
  arena: ArenaBounds = DEFAULT_ARENA,
): FighterState {
  const hitstun = Math.max(0, fighter.hitstun - dt)
  const invuln = Math.max(0, fighter.invuln - dt)
  const blockstun = Math.max(0, fighter.blockstun - dt)
  const base = { ...fighter, hitstun, invuln, blockstun }

  if (fighter.ko) {
    const vertical = integrateVertical(fighter.y, fighter.vy, dt)
    return {
      ...base,
      action: 'ko',
      actionTime: fighter.actionTime + dt,
      x: clampX(fighter.x + fighter.vx * dt, arena),
      vx: decay(fighter.vx, dt),
      y: vertical.y,
      vy: vertical.vy,
      blocking: false,
    }
  }

  if (fighter.action === 'knockdown') {
    const actionTime = fighter.actionTime + dt
    if (actionTime <= KNOCKDOWN_TIME) {
      return {
        ...base,
        action: 'knockdown',
        actionTime,
        x: clampX(fighter.x, arena),
        y: 0,
        vx: 0,
        vy: 0,
        hitstun: 0,
        blocking: false,
        crouching: false,
      }
    }
  }

  if (fighter.action === 'juggle' || (fighter.y > 0.02 && fighter.hitstun > 0)) {
    const vertical = integrateVertical(fighter.y, fighter.vy, dt)
    const x = clampX(fighter.x + fighter.vx * dt, arena)
    if (vertical.y <= 0) {
      return touchDown(base, opponent, x, 'knockdown')
    }
    return {
      ...base,
      action: 'juggle',
      actionTime: fighter.actionTime + dt,
      x,
      vx: decay(fighter.vx, dt),
      y: vertical.y,
      vy: vertical.vy,
      blocking: false,
      crouching: false,
    }
  }

  if (fighter.hitstun > 0) {
    const vertical = integrateVertical(fighter.y, fighter.vy, dt)
    const x = clampX(fighter.x + fighter.vx * dt, arena)
    const vx = decay(fighter.vx, dt)
    if (vertical.y > 0) {
      return {
        ...base,
        action: 'juggle',
        actionTime: 0,
        x,
        vx,
        y: vertical.y,
        vy: vertical.vy,
        blocking: false,
        crouching: false,
      }
    }
    const stillStunned = hitstun > 0
    return {
      ...base,
      action: stillStunned ? 'hitstun' : 'idle',
      actionTime: stillStunned ? fighter.actionTime + dt : 0,
      x,
      vx,
      y: 0,
      vy: 0,
      blocking: false,
      crouching: false,
    }
  }

  if (fighter.blockstun > 0 && blockstun > 0) {
    const vertical = integrateVertical(fighter.y, fighter.vy, dt)
    return {
      ...base,
      action: 'block',
      actionTime: fighter.actionTime + dt,
      x: clampX(fighter.x + fighter.vx * dt, arena),
      vx: decay(fighter.vx, dt),
      y: vertical.y,
      vy: vertical.vy,
      blocking: true,
    }
  }

  if (fighter.action === 'prejump') {
    const actionTime = fighter.actionTime + dt
    if (actionTime <= PREJUMP_TIME + 1e-6) {
      return {
        ...base,
        action: 'prejump',
        actionTime,
        x: clampX(fighter.x, arena),
        y: 0,
        vx: 0,
        vy: 0,
        blocking: false,
        crouching: false,
      }
    }
    return {
      ...base,
      action: 'jump',
      actionTime: 0,
      x: clampX(fighter.x, arena),
      y: 0,
      vy: JUMP_SPEED,
      vx: fighter.jumpDir * JUMP_CARRY,
      blocking: false,
      crouching: false,
      airAttack: false,
    }
  }

  if (fighter.action === 'land') {
    const actionTime = fighter.actionTime + dt
    if (actionTime <= LAND_TIME + 1e-6) {
      return {
        ...base,
        action: 'land',
        actionTime,
        x: clampX(fighter.x, arena),
        y: 0,
        vx: 0,
        vy: 0,
        blocking: false,
        crouching: false,
      }
    }
  }

  const continued = continueAttack(base, fighter, dt, opponent, arena)
  if (continued) {
    return continued
  }

  const vertical = integrateVertical(fighter.y, fighter.vy, dt)
  const grounded = fighter.y <= 0.001 && fighter.vy <= 0 && vertical.y <= 0
  const wantsCrouch = Boolean(intent.crouch) && grounded
  const speed = fighter.speed

  if (!grounded) {
    const x = clampX(fighter.x + fighter.vx * dt, arena)
    if (vertical.y <= 0) {
      return touchDown(base, opponent, x, 'land')
    }
    if (!fighter.airAttack && (intent.attackUp || intent.attackDown)) {
      return beginStrike(base, fighter, intent.attackUp ? 'jumpPunch' : 'jumpKick', arena, false, true)
    }
    return {
      ...base,
      action: 'jump',
      actionTime: fighter.actionTime + dt,
      x,
      y: vertical.y,
      vy: vertical.vy,
      vx: fighter.vx,
      blocking: false,
      crouching: false,
    }
  }

  let action: FighterState['action'] = 'idle'
  let vx = 0
  if (wantsCrouch) {
    action = 'crouch'
  } else if (intent.block) {
    action = 'block'
    vx = intent.move * speed * 0.28
  } else if (intent.move !== 0) {
    action = 'walk'
    vx = intent.move * speed
  }

  if (combo && !wantsCrouch) {
    return beginSpecial(base, fighter, combo, opponent, arena)
  }

  if (wantsCrouch && (intent.attackUp || intent.attackDown)) {
    return beginStrike(base, fighter, intent.attackUp ? 'crouchPunch' : 'crouchKick', arena, true)
  }

  if (!wantsCrouch && (intent.attackUp || intent.attackDown)) {
    return beginStrike(base, fighter, intent.attackUp ? 'attackUp' : 'attackDown', arena, false)
  }

  if (intent.jump && !intent.block && !wantsCrouch && !trapJump) {
    const jumpDir: -1 | 0 | 1 = intent.move < 0 ? -1 : intent.move > 0 ? 1 : 0
    return {
      ...base,
      action: 'prejump',
      actionTime: 0,
      jumpDir,
      airAttack: false,
      x: clampX(fighter.x, arena),
      y: 0,
      vx: 0,
      vy: 0,
      blocking: false,
      crouching: false,
    }
  }

  const sameLocomotion = action === fighter.action && (action === 'idle' || action === 'walk' || action === 'block' || action === 'crouch')
  return {
    ...base,
    action,
    actionTime: sameLocomotion ? fighter.actionTime + dt : 0,
    x: clampX(fighter.x + vx * dt, arena),
    y: 0,
    vy: 0,
    vx,
    jumpDir: 0,
    airAttack: false,
    blocking: action === 'block' || (action === 'crouch' && Boolean(intent.block)),
    crouching: wantsCrouch,
    special: null,
  }
}

function touchDown(
  base: FighterState,
  opponent: FighterState,
  x: number,
  action: 'land' | 'knockdown',
): FighterState {
  const facing: 1 | -1 = opponent.x >= x ? 1 : -1
  return {
    ...base,
    action,
    actionTime: 0,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    jumpDir: 0,
    airAttack: false,
    hitstun: action === 'knockdown' ? 0 : base.hitstun,
    blocking: false,
    crouching: false,
    special: null,
  }
}

function beginStrike(
  base: FighterState,
  fighter: FighterState,
  attack: AttackName,
  arena: ArenaBounds,
  crouching: boolean,
  airborne = false,
): FighterState {
  return {
    ...base,
    action: attack,
    actionTime: 0,
    attackResolved: false,
    special: null,
    x: clampX(fighter.x, arena),
    y: airborne ? fighter.y : 0,
    vy: airborne ? fighter.vy : 0,
    vx: airborne ? fighter.vx : 0,
    airAttack: airborne,
    blocking: false,
    crouching,
  }
}

function faceOpponent(self: FighterState, other: FighterState): FighterState {
  const locked = self.y > 0.02
    || self.action === 'prejump'
    || self.action === 'jump'
    || self.action === 'jumpPunch'
    || self.action === 'jumpKick'
    || self.action === 'land'
    || self.action === 'juggle'
    || self.action === 'knockdown'
  if (locked || self.ko || self.hitstun > 0 || self.blockstun > 0 || self.blocking || isAttack(self.action)) {
    return self
  }

  const facing: 1 | -1 = other.x >= self.x ? 1 : -1
  return { ...self, facing }
}

function separate(first: FighterState, second: FighterState, arena: ArenaBounds): [FighterState, FighterState] {
  const offGround = (fighter: FighterState) => fighter.y > 0.04
    || fighter.action === 'jump'
    || fighter.action === 'jumpPunch'
    || fighter.action === 'jumpKick'
    || fighter.action === 'juggle'
  if (offGround(first) || offGround(second)) {
    return [first, second]
  }
  const delta = second.x - first.x
  const distance = Math.abs(delta)
  if (distance >= PUSH_DISTANCE) {
    return [first, second]
  }

  if (distance === 0) {
    return [
      { ...first, x: clampX(first.x - PUSH_DISTANCE / 2, arena) },
      { ...second, x: clampX(second.x + PUSH_DISTANCE / 2, arena) },
    ]
  }

  const push = (PUSH_DISTANCE - distance) / 2
  const dir = delta > 0 ? 1 : -1
  return [
    { ...first, x: clampX(first.x - dir * push, arena) },
    { ...second, x: clampX(second.x + dir * push, arena) },
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

function clampX(x: number, arena: ArenaBounds): number {
  return Math.min(arena.maxX, Math.max(arena.minX, x))
}

function nameOf(state: MatchState, id: FighterId): string {
  return state.fighters.find((fighter) => fighter.id === id)?.name ?? id
}
