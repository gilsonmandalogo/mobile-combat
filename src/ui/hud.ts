import type { DebugSnapshot } from '@src/debug/snapshot'

export interface HudFighterView {
  name: string
  device: string
  life: number
  health: number
  rounds: [boolean, boolean]
}

export interface HudView {
  visible: boolean
  timer: string
  roundLabel: string
  banner: string | null
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

export function hudView(state: DebugSnapshot, gamepadIndexes: [number, number]): HudView {
  const showBanner = Boolean(state.banner) && (
    state.introTime > 0 || state.status === 'roundEnd' || state.status === 'matchEnd'
  )
  return {
    visible: state.status !== 'menu',
    timer: String(Math.max(0, Math.ceil(state.timeLeft))),
    roundLabel: `Round ${state.round}`,
    banner: showBanner ? state.banner : null,
    fighters: state.fighters.map((fighter, index) => ({
      name: fighter.name,
      device: deviceLabel(fighter.device, gamepadIndexes[index]),
      life: fighter.life,
      health: fighter.maxLife <= 0 ? 0 : fighter.life / fighter.maxLife,
      rounds: [fighter.score >= 1, fighter.score >= 2] as [boolean, boolean],
    })) as [HudFighterView, HudFighterView],
  }
}
