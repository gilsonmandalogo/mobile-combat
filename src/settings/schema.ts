import { DEFAULT_PAD } from '@src/input/gamepad'
import type { PadBindings } from '@src/input/gamepad'
import type { KeyBindings } from '@src/input/keyboard'

export type { KeyBindings, PadBindings }

export type DeviceChoice = 'keyboard' | 'gamepad'

export interface PlayerSettings {
  name: string
  device: DeviceChoice
  gamepadIndex: number
  keys: KeyBindings
  pad: PadBindings
}

export interface Settings {
  debug: boolean
  musicVolume: number
  sfxVolume: number
  menuKey: string
  players: {
    player1: PlayerSettings
    player2: PlayerSettings
  }
}

export type PlayerSlot = keyof Settings['players']
export type ActionName = keyof KeyBindings

const ACTIONS: ActionName[] = ['left', 'right', 'jump', 'attackUp', 'attackDown', 'block']

export function defaultSettings(): Settings {
  return {
    debug: false,
    musicVolume: 0.35,
    sfxVolume: 0.7,
    menuKey: 'Escape',
    players: {
      player1: {
        name: 'Player 1',
        device: 'keyboard',
        gamepadIndex: 0,
        keys: {
          left: 'KeyA',
          right: 'KeyD',
          jump: 'Space',
          attackUp: 'KeyG',
          attackDown: 'KeyV',
          block: 'KeyY',
        },
        pad: { ...DEFAULT_PAD },
      },
      player2: {
        name: 'Player 2',
        device: 'keyboard',
        gamepadIndex: 1,
        keys: {
          left: 'ArrowLeft',
          right: 'ArrowRight',
          jump: 'ControlRight',
          attackUp: 'Equal',
          attackDown: 'BracketRight',
          block: 'Backslash',
        },
        pad: { ...DEFAULT_PAD },
      },
    },
  }
}

export function normalizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings()
  if (!raw || typeof raw !== 'object') {
    return defaults
  }

  const value = raw as Record<string, unknown>
  if (isRecord(value.players)) {
    return {
      debug: Boolean(value.debug),
      musicVolume: clampVolume(value.musicVolume, defaults.musicVolume),
      sfxVolume: clampVolume(value.sfxVolume, defaults.sfxVolume),
      menuKey: typeof value.menuKey === 'string' ? value.menuKey : defaults.menuKey,
      players: {
        player1: normalizePlayer(value.players.player1, defaults.players.player1),
        player2: normalizePlayer(value.players.player2, defaults.players.player2),
      },
    }
  }

  const legacy = isRecord(value.inputs) ? value.inputs : null
  if (legacy && (isRecord(legacy.player1) || isRecord(legacy.player2))) {
    return {
      ...defaults,
      debug: Boolean(value.debug),
      menuKey: typeof legacy.menu === 'string' ? legacy.menu : defaults.menuKey,
      players: {
        player1: {
          ...defaults.players.player1,
          keys: normalizeKeys(legacy.player1, defaults.players.player1.keys),
        },
        player2: {
          ...defaults.players.player2,
          keys: normalizeKeys(legacy.player2, defaults.players.player2.keys),
        },
      },
    }
  }

  return defaults
}

export function rebindKey(settings: Settings, slot: PlayerSlot, action: ActionName, code: string): Settings {
  const player = settings.players[slot]
  const keys = { ...player.keys }
  for (const other of ACTIONS) {
    if (other !== action && keys[other] === code) {
      keys[other] = keys[action]
    }
  }
  keys[action] = code
  return {
    ...settings,
    players: {
      ...settings.players,
      [slot]: { ...player, keys },
    },
  }
}

export function rebindPad(settings: Settings, slot: PlayerSlot, action: keyof PadBindings, button: number): Settings {
  const player = settings.players[slot]
  const pad = { ...player.pad }
  const actions = Object.keys(pad) as Array<keyof PadBindings>
  for (const other of actions) {
    if (other !== action && pad[other] === button) {
      pad[other] = pad[action]
    }
  }
  pad[action] = button
  return {
    ...settings,
    players: {
      ...settings.players,
      [slot]: { ...player, pad },
    },
  }
}

function normalizePlayer(raw: unknown, fallback: PlayerSettings): PlayerSettings {
  if (!isRecord(raw)) {
    return fallback
  }
  const device = raw.device === 'gamepad' ? 'gamepad' : 'keyboard'
  const gamepadIndex = typeof raw.gamepadIndex === 'number' && raw.gamepadIndex >= 0
    ? Math.floor(raw.gamepadIndex)
    : fallback.gamepadIndex
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 18) : fallback.name,
    device,
    gamepadIndex,
    keys: normalizeKeys(raw.keys, fallback.keys),
    pad: normalizePad(raw.pad, fallback.pad),
  }
}

function normalizeKeys(raw: unknown, fallback: KeyBindings): KeyBindings {
  if (!isRecord(raw)) {
    return { ...fallback }
  }
  const keys = { ...fallback }
  for (const action of ACTIONS) {
    if (typeof raw[action] === 'string' && raw[action]) {
      keys[action] = raw[action] as string
    }
  }
  return keys
}

function normalizePad(raw: unknown, fallback: PadBindings): PadBindings {
  if (!isRecord(raw)) {
    return { ...fallback }
  }
  const pad = { ...fallback }
  for (const action of Object.keys(pad) as Array<keyof PadBindings>) {
    const value = raw[action]
    if (typeof value === 'number' && value >= 0) {
      pad[action] = Math.floor(value)
    }
  }
  return pad
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }
  return Math.min(1, Math.max(0, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}
