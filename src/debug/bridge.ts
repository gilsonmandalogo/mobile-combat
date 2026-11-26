export interface DebugState {
  ready: boolean
  status: string
  round: number
  timeLeft: number
  life: { player1: number; player2: number }
  score: { player1: number; player2: number }
}

export interface DebugApi {
  ready: boolean
  getState: () => DebugState
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
