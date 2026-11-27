import { stepMatch } from '@src/sim/match'
import { EMPTY_INTENT } from '@src/sim/types'
import type { GameEvent, Intent, MatchState } from '@src/sim/types'

export const FRAME_DT = 1 / 60
export const INPUT_HISTORY = 12

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
  add(quantize(state.timeLeft))
  for (const fighter of state.fighters) {
    add(quantize(fighter.x))
    add(quantize(fighter.y))
    add(quantize(fighter.vx))
    add(quantize(fighter.vy))
    add(quantize(fighter.actionTime))
    add(fighter.life)
    add(fighter.action)
    add(fighter.facing)
    add(fighter.crouching ? 1 : 0)
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
  }
  return hash >>> 0
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
  }
}

export function pushLocal(session: Rollback, intent: Intent, now = 0): SimMessage[] {
  const target = session.frame + session.delay
  session.local[target] = packInput(intent)
  stepForward(session, false)
  const frames: Array<{ frame: number; input: NetInput }> = []
  for (let frame = Math.max(0, target - INPUT_HISTORY + 1); frame <= target; frame += 1) {
    const input = session.local[frame]
    if (input) {
      frames.push({ frame, input })
    }
  }
  const outbound: SimMessage[] = [{ kind: 'inputs', side: session.side, frames }]
  if (session.confirmed >= 15 && session.confirmed % 15 === 0 && session.confirmed !== session.lastCheck && session.sums[session.confirmed] !== undefined) {
    session.lastCheck = session.confirmed
    outbound.push({ kind: 'check', frame: session.confirmed, sum: session.sums[session.confirmed] })
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
  if (message.kind === 'check') {
    session.checks.set(message.frame, message.sum)
    considerChecks(session)
    return []
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
      stepForward(session, true)
    }
  }
  session.confirmed = confirmedFrame(session)
  considerChecks(session)
  return []
}

function stepForward(session: Rollback, replaying: boolean) {
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
  session.events = replaying ? [] : result.events
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

function considerChecks(session: Rollback) {
  for (const [frame, sum] of session.checks) {
    if (frame <= session.confirmed && session.sums[frame] !== undefined) {
      if (session.sums[frame] !== sum) {
        session.desync = true
      }
      session.checks.delete(frame)
    }
  }
}
