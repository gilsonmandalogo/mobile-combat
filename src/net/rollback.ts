import { stepMatch } from '@src/sim/match'
import { EMPTY_INTENT } from '@src/sim/types'
import type { GameEvent, Intent, MatchState } from '@src/sim/types'

export const FRAME_DT = 1 / 60
export const INPUT_HISTORY = 12
export const CHECK_KEEP = 4
export const CHECK_RESEND = 20

export interface NetInput {
  move: -1 | 0 | 1
  jump: boolean
  attackUp: boolean
  attackDown: boolean
  block: boolean
  crouch: boolean
}

export type SimMessage =
  | { kind: 'inputs'; side: 0 | 1; frames: Array<{ frame: number; input: NetInput }> }
  | { kind: 'check'; frame: number; sum: number }
  | { kind: 'ping'; sent: number }
  | { kind: 'pong'; sent: number }
  | { kind: 'ack'; frame: number }

export interface Rollback {
  side: 0 | 1
  delay: number
  seed: number
  frame: number
  confirmed: number
  state: MatchState
  desync: boolean
  ping: number
  rolled: number
  events: GameEvent[]
  local: Array<NetInput | undefined>
  remote: Array<NetInput | undefined>
  used: Array<NetInput | undefined>
  saved: MatchState[]
  sums: number[]
  checks: Map<number, number>
  lastCheck: number
  eventLog: GameEvent[][]
  played: Set<string>
  emitted: Map<string, GameEvent>
  recentChecks: Array<{ frame: number; sum: number }>
  acked: Set<number>
}

const EMPTY_INPUT: NetInput = {
  move: 0,
  jump: false,
  attackUp: false,
  attackDown: false,
  block: false,
  crouch: false,
}

export function packInput(intent: Intent): NetInput {
  const move = intent.move < 0 ? -1 : intent.move > 0 ? 1 : 0
  return {
    move,
    jump: Boolean(intent.jump),
    attackUp: Boolean(intent.attackUp),
    attackDown: Boolean(intent.attackDown),
    block: Boolean(intent.block),
    crouch: Boolean(intent.crouch),
  }
}

export function sameInput(left: NetInput, right: NetInput): boolean {
  return left.move === right.move
    && left.jump === right.jump
    && left.attackUp === right.attackUp
    && left.attackDown === right.attackDown
    && left.block === right.block
    && left.crouch === right.crouch
}

export function checksum(state: MatchState): number {
  let hash = 2166136261
  const add = (value: string | number) => {
    const text = String(value)
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
  }
  const quantize = (value: number) => Math.round(value * 1000)
  add(state.status)
  add(state.round)
  add(state.roundsToWin)
  add(quantize(state.timeLeft))
  for (const fighter of state.fighters) {
    add(quantize(fighter.x))
    add(quantize(fighter.y))
    add(quantize(fighter.vx))
    add(quantize(fighter.vy))
    add(quantize(fighter.actionTime))
    add(fighter.life)
    add(quantize(fighter.energy))
    add(fighter.action)
    add(fighter.facing)
    add(fighter.crouching ? 1 : 0)
    add(fighter.jumpDir)
    add(fighter.airAttack ? 1 : 0)
    add(fighter.blocking ? 1 : 0)
    add(fighter.score)
    add(fighter.ko ? 1 : 0)
  }
  add(state.projectiles.length)
  for (const shot of state.projectiles) {
    add(shot.owner)
    add(quantize(shot.x))
    add(quantize(shot.y))
    add(quantize(shot.vx))
    add(shot.damage)
    add(shot.level)
  }
  return hash >>> 0
}

export function effectKey(frame: number, event: GameEvent): string {
  if (event.type === 'hit') {
    return `${frame}:hit:${event.attacker}:${event.defender}:${event.damage}:${event.blocked ? 1 : 0}:${event.critical ? 1 : 0}`
  }
  if (event.type === 'retract') {
    return `${frame}:retract:${event.of}`
  }
  if (event.type === 'attack') {
    return `${frame}:attack:${event.fighter}:${event.attack}`
  }
  if (event.type === 'ko') {
    return `${frame}:ko:${event.fighter}`
  }
  if (event.type === 'roundStart') {
    return `${frame}:roundStart:${event.round}`
  }
  if (event.type === 'roundEnd') {
    return `${frame}:roundEnd:${event.winner}:${event.round}`
  }
  return `${frame}:matchEnd:${event.winner}`
}

export function takeEffects(session: Rollback): GameEvent[] {
  const cues: GameEvent[] = []
  const live = new Set<string>()
  for (let frame = 0; frame < session.frame; frame += 1) {
    const events = session.eventLog[frame]
    if (!events) {
      continue
    }
    for (const event of events) {
      if (event.type === 'retract') {
        continue
      }
      live.add(effectKey(frame, event))
    }
  }
  for (const key of [...session.played]) {
    if (live.has(key)) {
      continue
    }
    const cause = session.emitted.get(key)
    session.played.delete(key)
    session.emitted.delete(key)
    const retract = cause ? retractEvent(cause) : null
    if (retract) {
      cues.push(retract)
    }
  }
  for (let frame = 0; frame < session.frame; frame += 1) {
    const events = session.eventLog[frame]
    if (!events) {
      continue
    }
    for (const event of events) {
      if (event.type === 'retract') {
        continue
      }
      const key = effectKey(frame, event)
      if (session.played.has(key)) {
        continue
      }
      session.played.add(key)
      session.emitted.set(key, event)
      cues.push(event)
    }
  }
  return cues
}

function retractEvent(event: GameEvent): GameEvent | null {
  if (event.type === 'hit') {
    return { type: 'retract', of: 'hit', attacker: event.attacker, defender: event.defender }
  }
  if (event.type === 'attack') {
    return { type: 'retract', of: 'attack', attacker: event.fighter }
  }
  if (event.type === 'ko') {
    return { type: 'retract', of: 'ko', defender: event.fighter }
  }
  if (event.type === 'roundStart' || event.type === 'roundEnd' || event.type === 'matchEnd') {
    return { type: 'retract', of: event.type }
  }
  return null
}

export function createRollback(state: MatchState, side: 0 | 1, delay: number, seed: number): Rollback {
  return {
    side,
    delay: Math.max(0, Math.min(8, Math.floor(delay))),
    seed,
    frame: 0,
    confirmed: -1,
    state,
    desync: false,
    ping: 0,
    rolled: 0,
    events: [],
    local: [],
    remote: [],
    used: [],
    saved: [],
    sums: [],
    checks: new Map(),
    lastCheck: -1,
    eventLog: [],
    played: new Set(),
    emitted: new Map(),
    recentChecks: [],
    acked: new Set(),
  }
}

export function pushLocal(session: Rollback, intent: Intent, now = 0): SimMessage[] {
  const target = session.frame + session.delay
  session.local[target] = packInput(intent)
  stepForward(session)
  const frames: Array<{ frame: number; input: NetInput }> = []
  for (let frame = Math.max(0, target - INPUT_HISTORY + 1); frame <= target; frame += 1) {
    const input = session.local[frame]
    if (input) {
      frames.push({ frame, input })
    }
  }
  const outbound: SimMessage[] = [{ kind: 'inputs', side: session.side, frames }]
  const fresh = rememberCheck(session)
  const pending = session.recentChecks.filter((item) => !session.acked.has(item.frame))
  if (pending.length && (fresh || session.frame % CHECK_RESEND === 0)) {
    for (const item of pending) {
      outbound.push({ kind: 'check', frame: item.frame, sum: item.sum })
    }
  }
  if (session.frame % 30 === 0) {
    outbound.push({ kind: 'ping', sent: now })
  }
  return outbound
}

export function receiveSim(session: Rollback, message: SimMessage, now = 0): SimMessage[] {
  if (message.kind === 'ping') {
    return [{ kind: 'pong', sent: message.sent }]
  }
  if (message.kind === 'pong') {
    session.ping = Math.max(0, now - message.sent)
    return []
  }
  if (message.kind === 'ack') {
    session.acked.add(message.frame)
    return []
  }
  if (message.kind === 'check') {
    session.checks.set(message.frame, message.sum)
    return considerChecks(session)
  }
  if (message.side === session.side) {
    return []
  }
  let earliest = -1
  for (const item of message.frames) {
    const previous = session.remote[item.frame]
    session.remote[item.frame] = item.input
    const used = session.used[item.frame]
    if (item.frame < session.frame && (!previous || !sameInput(previous, item.input)) && used && !sameInput(used, item.input)) {
      earliest = earliest < 0 ? item.frame : Math.min(earliest, item.frame)
    }
  }
  if (earliest >= 0) {
    const until = session.frame
    session.rolled += until - earliest
    session.state = session.saved[earliest]
    session.frame = earliest
    while (session.frame < until) {
      stepForward(session)
    }
  }
  session.confirmed = confirmedFrame(session)
  return considerChecks(session)
}

function stepForward(session: Rollback) {
  const frame = session.frame
  const local = session.local[frame] ?? EMPTY_INPUT
  const known = session.remote[frame]
  const remote = frame < session.delay
    ? EMPTY_INPUT
    : known ?? lastKnown(session.remote, frame) ?? EMPTY_INPUT
  session.saved[frame] = session.state
  session.used[frame] = remote
  const result = stepMatch(session.state, intentsFor(session.side, local, remote), FRAME_DT)
  session.state = result.state
  session.sums[frame] = checksum(result.state)
  session.eventLog[frame] = result.events
  session.events = []
  session.frame += 1
  session.confirmed = confirmedFrame(session)
}

function intentsFor(side: 0 | 1, local: NetInput, remote: NetInput): Record<'player1' | 'player2', Intent> {
  const mine = toIntent(local)
  const theirs = toIntent(remote)
  return side === 0
    ? { player1: mine, player2: theirs }
    : { player1: theirs, player2: mine }
}

function toIntent(input: NetInput): Intent {
  return { ...EMPTY_INTENT, ...input }
}

function lastKnown(table: Array<NetInput | undefined>, frame: number): NetInput | undefined {
  for (let index = frame - 1; index >= 0; index -= 1) {
    if (table[index]) {
      return table[index]
    }
  }
  return undefined
}

function confirmedFrame(session: Rollback): number {
  let frame = 0
  while (frame < session.delay || session.remote[frame]) {
    frame += 1
  }
  return frame - 1
}

function rememberCheck(session: Rollback): boolean {
  let fresh = false
  let frame = session.lastCheck < 0 ? 15 : session.lastCheck + 15
  for (; frame <= session.confirmed; frame += 15) {
    if (session.sums[frame] === undefined) {
      continue
    }
    session.lastCheck = frame
    session.recentChecks = session.recentChecks.filter((item) => item.frame !== frame)
    session.recentChecks.push({ frame, sum: session.sums[frame] })
    fresh = true
  }
  if (session.recentChecks.length > CHECK_KEEP) {
    session.recentChecks = session.recentChecks.slice(-CHECK_KEEP)
  }
  return fresh
}

function considerChecks(session: Rollback): SimMessage[] {
  const acks: SimMessage[] = []
  for (const [frame, sum] of session.checks) {
    if (frame <= session.confirmed && session.sums[frame] !== undefined) {
      if (session.sums[frame] !== sum) {
        session.desync = true
      }
      session.checks.delete(frame)
      acks.push({ kind: 'ack', frame })
    }
  }
  return acks
}
