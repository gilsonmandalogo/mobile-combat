import { byeMessage, editLobby, lobbyMessage, lobbyStatus, mergeLobby, roomLink } from '@src/net/lobby'
import type { Lobby, LobbyMessage } from '@src/net/lobby'
import { createRollback, pushLocal, receiveSim } from '@src/net/rollback'
import type { Rollback, SimMessage } from '@src/net/rollback'
import type { NetEnvelope, Transport } from '@src/net/transport'
import type { GameEvent, Intent, MatchState } from '@src/sim/types'

export interface OnlineView {
  role: Lobby['role']
  code: string
  link: string
  status: string
  characters: [string, string]
  arena: string
  yours: string
  opponent: string
  delay: number
  disconnected: boolean
  fighting: boolean
  ping: number
  desync: boolean
}

export function disconnectedView(): OnlineView {
  return {
    role: 'host',
    code: '',
    link: '',
    status: 'Opponent left',
    characters: ['colin', 'colin'],
    arena: 'mayan-temple',
    yours: 'colin',
    opponent: 'colin',
    delay: 2,
    disconnected: true,
    fighting: false,
    ping: 0,
    desync: false,
  }
}

export class NetPlay {
  rollback: Rollback | null = null
  pending: SimMessage[] = []

  constructor(
    readonly lobby: { current: Lobby },
    private readonly transport: Transport,
    private readonly now: () => number,
  ) {
    transport.onMessage((envelope) => this.receive(envelope))
  }

  get current(): Lobby {
    return this.lobby.current
  }

  receive(envelope: NetEnvelope) {
    if (envelope.channel === 'lobby') {
      this.lobby.current = mergeLobby(this.current, envelope.body as LobbyMessage)
      if (this.current.role === 'host' && envelope.body.kind !== 'bye') {
        this.sendLobby()
      }
      return
    }
    const message = envelope.body as SimMessage
    if (!this.rollback) {
      this.pending.push(message)
      return
    }
    this.apply(message)
  }

  sendLobby() {
    this.transport.send({ channel: 'lobby', body: lobbyMessage(this.current) })
  }

  leave() {
    this.transport.send({ channel: 'lobby', body: byeMessage(this.current) })
    this.lobby.current = { ...this.current, phase: 'bye', peer: false }
    this.transport.close()
    this.rollback = null
  }

  edit(patch: Parameters<typeof editLobby>[1]) {
    this.lobby.current = editLobby(this.current, patch)
    this.sendLobby()
  }

  begin(state: MatchState) {
    if (this.rollback && this.rollback.seed === this.current.seed) {
      return
    }
    const side = this.current.role === 'host' ? 0 : 1
    this.rollback = createRollback(state, side, this.current.delay, this.current.seed)
    const waiting = this.pending.splice(0)
    for (const message of waiting) {
      this.apply(message)
    }
  }

  step(intent: Intent, now: number): GameEvent[] {
    if (!this.rollback) {
      return []
    }
    const outbound = pushLocal(this.rollback, intent, now)
    for (const message of outbound) {
      this.transport.send({ channel: 'sim', body: message })
    }
    return this.rollback.events
  }

  view(href: string): OnlineView {
    const yours = this.current.role === 'host' ? this.current.characters[0] : this.current.characters[1]
    const opponent = this.current.role === 'host' ? this.current.characters[1] : this.current.characters[0]
    return {
      role: this.current.role,
      code: this.current.code,
      link: roomLink(this.current.code, href),
      status: lobbyStatus(this.current, Boolean(this.rollback?.desync)),
      characters: this.current.characters,
      arena: this.current.arena,
      yours,
      opponent,
      delay: this.current.delay,
      disconnected: this.current.phase === 'bye',
      fighting: this.current.phase === 'start',
      ping: this.rollback?.ping ?? 0,
      desync: Boolean(this.rollback?.desync),
    }
  }

  private apply(message: SimMessage) {
    if (!this.rollback) {
      return
    }
    const extra = receiveSim(this.rollback, message, this.now())
    for (const reply of extra) {
      this.transport.send({ channel: 'sim', body: reply })
    }
  }
}
