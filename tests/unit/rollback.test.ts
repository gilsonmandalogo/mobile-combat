import { describe, expect, it } from 'vitest'
import { createLobby, editLobby, lobbyMessage, mergeLobby, roomCode } from '@src/net/lobby'
import { checksum, createRollback, INPUT_HISTORY, pushLocal, receiveSim } from '@src/net/rollback'
import type { Rollback, SimMessage } from '@src/net/rollback'
import { packSdp, unpackSdp } from '@src/net/transport'
import { nextRng } from '@src/ai/opponent'
import { createMatch, startMatch } from '@src/sim/match'
import { EMPTY_INTENT } from '@src/sim/types'
import type { Intent, MatchState } from '@src/sim/types'

function started(): MatchState {
  const match = startMatch(createMatch({
    mode: 'local',
    difficulty: 'normal',
    roundTime: 30,
    names: ['Red', 'Blue'],
    devices: ['keyboard', 'keyboard'],
    seed: 4,
  })).state
  return { ...match, introTime: 0, banner: null }
}

function intentAt(frame: number, side: 0 | 1): Intent {
  if (side === 0) {
    return {
      ...EMPTY_INTENT,
      move: frame % 30 < 15 ? 1 : 0,
      attackDown: frame % 47 === 10,
      crouch: frame % 47 > 32,
    }
  }
  return {
    ...EMPTY_INTENT,
    move: -1,
    block: frame % 22 > 14,
    crouch: frame % 22 > 14,
  }
}

function relay(options: { latency: number; loss: number; seed: number }) {
  let time = 0
  let seed = options.seed
  const queues: Array<Array<{ at: number; message: SimMessage }>> = [[], []]
  return {
    send(from: 0 | 1, message: SimMessage) {
      const roll = nextRng(seed)
      seed = roll.seed
      if (roll.value < options.loss) {
        return
      }
      queues[1 - from].push({ at: time + options.latency, message })
    },
    tick(): [SimMessage[], SimMessage[]] {
      time += 1
      const ready: [SimMessage[], SimMessage[]] = [[], []]
      for (const side of [0, 1] as const) {
        const keep: Array<{ at: number; message: SimMessage }> = []
        for (const packet of queues[side]) {
          if (packet.at <= time) {
            ready[side].push(packet.message)
          } else {
            keep.push(packet)
          }
        }
        queues[side] = keep
      }
      return ready
    },
  }
}

function run(delay: number, latency: number, loss: number) {
  const base = started()
  const left = createRollback(base, 0, delay, 4)
  const right = createRollback(started(), 1, delay, 4)
  const wire = relay({ latency, loss, seed: 9 })
  const frames = 160
  for (let frame = 0; frame < frames; frame += 1) {
    exchange(left, right, wire, frame)
  }
  for (let extra = 0; extra < latency + INPUT_HISTORY + delay + 4; extra += 1) {
    exchange(left, right, wire, frames + extra)
  }
  return { left, right }
}

function exchange(
  left: Rollback,
  right: Rollback,
  wire: ReturnType<typeof relay>,
  frame: number,
) {
  for (const message of pushLocal(left, intentAt(frame, 0), frame)) {
    wire.send(0, message)
  }
  for (const message of pushLocal(right, intentAt(frame, 1), frame)) {
    wire.send(1, message)
  }
  const ready = wire.tick()
  for (const message of ready[0]) {
    for (const reply of receiveSim(left, message, frame)) {
      wire.send(0, reply)
    }
  }
  for (const message of ready[1]) {
    for (const reply of receiveSim(right, message, frame)) {
      wire.send(1, reply)
    }
  }
}

describe('rollback netcode', () => {
  it('stays deterministic when packets are on time', () => {
    const { left, right } = run(2, 0, 0)
    const frame = Math.min(left.confirmed, right.confirmed)
    expect(frame).toBeGreaterThan(40)
    expect(left.sums[frame]).toBe(right.sums[frame])
    expect(left.rolled).toBe(0)
    expect(right.rolled).toBe(0)
    expect(left.desync).toBe(false)
  })

  it('corrects prediction after latency and packet loss', () => {
    const calm = run(2, 0, 0)
    const delayed = run(2, 6, 0)
    expect(delayed.left.rolled + delayed.right.rolled).toBeGreaterThan(0)
    const frame = Math.min(delayed.left.confirmed, delayed.right.confirmed)
    expect(frame).toBeGreaterThan(40)
    expect(delayed.left.sums[frame]).toBe(delayed.right.sums[frame])
    expect(delayed.left.desync).toBe(false)
    expect(delayed.right.desync).toBe(false)
    expect(delayed.left.sums[80]).toBe(calm.left.sums[80])

    const lossy = run(3, 4, 0.25)
    const shared = Math.min(lossy.left.confirmed, lossy.right.confirmed)
    expect(shared).toBeGreaterThan(30)
    expect(lossy.left.sums[shared]).toBe(lossy.right.sums[shared])
    expect(lossy.left.desync).toBe(false)
  })

  it('flags a checksum that does not match the confirmed frame', () => {
    const { left, right } = run(2, 0, 0)
    const frame = left.confirmed
    left.sums[frame] = (left.sums[frame] ^ 1) >>> 0
    receiveSim(left, { kind: 'check', frame, sum: right.sums[frame] }, 0)
    expect(left.desync).toBe(true)
    expect(checksum(started())).toBe(checksum(started()))
  })

  it('starts the fight when both are ready and rematches on a new seed', () => {
    const host = createLobby('host', roomCode(12), 2, 7, 'colin', 'mayan-temple')
    const guest = createLobby('guest', host.code, 2, 1, 'maria', 'ember-pit')
    expect(host.code).toHaveLength(4)
    const joined = mergeLobby(host, lobbyMessage(editLobby(guest, { character: 'maria' })))
    expect(joined.peer).toBe(true)
    expect(joined.characters[1]).toBe('maria')
    const readyHost = editLobby(joined, { ready: true })
    const readyGuest = lobbyMessage(editLobby(guest, { ready: true, character: 'maria' }))
    const startedFight = mergeLobby(readyHost, readyGuest)
    expect(startedFight.phase).toBe('start')
    const half = editLobby(startedFight, { rematch: true })
    const again = mergeLobby(half, { ...readyGuest, rematch: [false, true] })
    expect(again.seed).toBe(startedFight.seed + 1)
    expect(again.rematch).toEqual([false, false])
    const packed = packSdp({ type: 'offer', sdp: 'v=0' })
    expect(unpackSdp(packed)).toEqual({ type: 'offer', sdp: 'v=0' })
  })
})
