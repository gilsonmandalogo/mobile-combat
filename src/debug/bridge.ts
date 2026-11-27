import type { AudioSnapshot } from '@src/audio/engine'
import type { DebugSnapshot } from '@src/debug/snapshot'
import type { PadSnapshot } from '@src/input/gamepad'
import type { FighterId, Intent } from '@src/sim/types'

export interface DebugApi {
  ready: boolean
  getState: () => DebugSnapshot
  setIntent: (id: FighterId, intent: Intent | null) => void
  stepFor: (seconds: number) => void
  getAudio: () => AudioSnapshot
  setVirtualGamepad: (pad: PadSnapshot | null) => void
  setCritChance: (chance: number) => void
  setEnergy: (id: FighterId, value: number) => void
}

export function debugQueryEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1'
}

declare global {
  interface Window {
    __MOBILE_COMBAT__?: DebugApi
  }
}

export function publishDebugApi(api: DebugApi) {
  if (typeof window === 'undefined') {
    return
  }

  if (!debugQueryEnabled(window.location.search)) {
    return
  }

  window.__MOBILE_COMBAT__ = api
}
