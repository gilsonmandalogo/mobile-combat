import type { DebugSnapshot } from '@src/debug/snapshot'

export interface HudFighterView {
  name: string
  device: string
  life: number
  health: number
  rounds: boolean[]
  guard: string
}

export interface HudView {
  visible: boolean
  timer: string
  roundLabel: string
  banner: string | null
  callout: string
  fighters: [HudFighterView, HudFighterView]
}

export function deviceLabel(device: string, gamepadIndex = 0): string {
  if (device === 'ai') {
    return 'AI'
  }
  if (device === 'gamepad') {
    return `Pad ${gamepadIndex + 1}`
  }
  return 'Keyboard'
}

/** A drop at least this fraction of the bar shakes and flashes. */
export const BIG_HIT = 0.12

export function healthMotion(previous: number, next: number): { snap: boolean; shake: boolean } {
  if (previous < 0) {
    return { snap: true, shake: false }
  }
  const drop = previous - next
  return { snap: drop <= 0.004, shake: drop >= BIG_HIT }
}

export function hudView(state: DebugSnapshot, gamepadIndexes: [number, number]): HudView {
  const showBanner = Boolean(state.banner) && (
    state.introTime > 0 || state.status === 'roundEnd' || state.status === 'matchEnd'
  )
  return {
    visible: state.status !== 'menu',
    timer: String(Math.max(0, Math.ceil(state.timeLeft))),
    roundLabel: `Round ${state.round}`,
    banner: showBanner ? state.banner : null,
    callout: state.callout ?? '',
    fighters: state.fighters.map((fighter, index) => ({
      name: fighter.name,
      device: deviceLabel(fighter.device, gamepadIndexes[index]),
      life: fighter.life,
      health: fighter.maxLife <= 0 ? 0 : fighter.life / fighter.maxLife,
      rounds: Array.from({ length: Math.max(1, state.roundsToWin) }, (_, index) => fighter.score > index),
      guard: fighter.blocking ? 'BLOCK' : '',
    })) as [HudFighterView, HudFighterView],
  }
}
