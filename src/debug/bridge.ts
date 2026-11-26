import type { DebugSnapshot } from '@src/debug/snapshot'
import type { PadSnapshot } from '@src/input/gamepad'
import type { FighterId, Intent } from '@src/sim/types'

export interface DebugApi {
  ready: boolean
  getState: () => DebugSnapshot
  setIntent: (id: FighterId, intent: Intent | null) => void
  stepFor: (seconds: number) => void
  setVirtualGamepad: (pad: PadSnapshot | null) => void
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
