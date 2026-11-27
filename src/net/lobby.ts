export type NetRole = 'host' | 'guest'

export interface LobbyMessage {
  kind: 'lobby' | 'bye'
  role: NetRole
  code: string
  characters: [string, string]
  arena: string
  ready: [boolean, boolean]
  seed: number
  delay: number
  rematch: [boolean, boolean]
  phase: 'lobby' | 'start'
}

export interface Lobby {
  role: NetRole
  code: string
  peer: boolean
  characters: [string, string]
  arena: string
  ready: [boolean, boolean]
  seed: number
  delay: number
  rematch: [boolean, boolean]
  phase: 'lobby' | 'start' | 'bye'
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function roomCode(seed: number): string {
  let value = seed >>> 0
  let code = ''
  for (let index = 0; index < 4; index += 1) {
    code += ALPHABET[value % ALPHABET.length]
    value = Math.floor(value / ALPHABET.length)
  }
  return code
}

export function roomLink(code: string, href: string): string {
  const url = new URL(href)
  url.searchParams.set('room', code)
  url.searchParams.delete('autostart')
  return url.toString()
}

export function createLobby(role: NetRole, code: string, delay: number, seed: number, character: string, arena: string): Lobby {
  return {
    role,
    code,
    peer: false,
    characters: role === 'host' ? [character, character] : [character, character],
    arena,
    ready: [false, false],
    seed: seed >>> 0,
    delay: clampDelay(delay),
    rematch: [false, false],
    phase: 'lobby',
  }
}

export function editLobby(lobby: Lobby, patch: {
  character?: string
  arena?: string
  ready?: boolean
  rematch?: boolean
  delay?: number
}): Lobby {
  const next: Lobby = {
    ...lobby,
    characters: [lobby.characters[0], lobby.characters[1]],
    ready: [lobby.ready[0], lobby.ready[1]],
    rematch: [lobby.rematch[0], lobby.rematch[1]],
  }
  const slot = lobby.role === 'host' ? 0 : 1
  if (patch.character) {
    next.characters[slot] = patch.character
  }
  if (lobby.role === 'host' && patch.arena) {
    next.arena = patch.arena
  }
  if (lobby.role === 'host' && patch.delay !== undefined && lobby.phase === 'lobby') {
    next.delay = clampDelay(patch.delay)
  }
  if (patch.ready !== undefined) {
    next.ready[slot] = patch.ready
  }
  if (patch.rematch !== undefined) {
    next.rematch[slot] = patch.rematch
  }
  return hostAdvance(next)
}

export function mergeLobby(lobby: Lobby, message: LobbyMessage): Lobby {
  if (message.kind === 'bye') {
    return { ...lobby, phase: 'bye', peer: false }
  }
  if (message.role === lobby.role) {
    return lobby
  }
  if (lobby.role === 'host') {
    return hostAdvance({
      ...lobby,
      peer: true,
      characters: [lobby.characters[0], message.characters[1]],
      ready: [lobby.ready[0], message.ready[1]],
      rematch: [lobby.rematch[0], message.rematch[1]],
    })
  }
  return {
    ...lobby,
    peer: true,
    characters: [message.characters[0], lobby.characters[1]],
    arena: message.arena,
    ready: message.ready,
    seed: message.seed,
    delay: message.delay,
    rematch: message.rematch,
    phase: message.phase,
  }
}

export function lobbyMessage(lobby: Lobby): LobbyMessage {
  return {
    kind: 'lobby',
    role: lobby.role,
    code: lobby.code,
    characters: lobby.characters,
    arena: lobby.arena,
    ready: lobby.ready,
    seed: lobby.seed,
    delay: lobby.delay,
    rematch: lobby.rematch,
    phase: lobby.phase === 'bye' ? 'lobby' : lobby.phase,
  }
}

export function byeMessage(lobby: Lobby): LobbyMessage {
  return { ...lobbyMessage(lobby), kind: 'bye' }
}

export function lobbyStatus(lobby: Lobby, desync: boolean): string {
  if (lobby.phase === 'bye') {
    return 'Opponent left'
  }
  if (desync) {
    return 'Desync'
  }
  if (lobby.phase === 'start') {
    return 'Fight'
  }
  if (!lobby.peer) {
    return lobby.role === 'host' ? 'Waiting for an opponent' : 'Connecting'
  }
  return 'Connected — pick a fighter, then ready'
}

export function hostAdvance(lobby: Lobby): Lobby {
  if (lobby.role !== 'host' || !lobby.peer) {
    return lobby
  }
  if (lobby.phase === 'lobby' && lobby.ready[0] && lobby.ready[1]) {
    return { ...lobby, phase: 'start' }
  }
  if (lobby.rematch[0] && lobby.rematch[1]) {
    return {
      ...lobby,
      phase: 'start',
      seed: (lobby.seed + 1) >>> 0,
      rematch: [false, false],
      ready: [true, true],
    }
  }
  return lobby
}

function clampDelay(delay: number): number {
  if (!Number.isFinite(delay)) {
    return 2
  }
  return Math.max(0, Math.min(8, Math.floor(delay)))
}
