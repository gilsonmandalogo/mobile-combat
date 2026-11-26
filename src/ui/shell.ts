import { settingsStore } from '@stores/settings'
import type { DebugSnapshot } from '@src/debug/snapshot'
import { deviceValue, readMatchSetup } from '@src/ui/setup'
import { hudView } from '@src/ui/hud'
import type { Difficulty, MatchMode } from '@src/sim/types'

export interface MatchHost {
  beginMatch: (options: { mode: MatchMode; difficulty: Difficulty; seed?: number }) => void
  resume: () => void
  restart: () => void
  quitToMenu: () => void
}

export class Shell {
  private ready = false
  private lastState: DebugSnapshot | null = null

  constructor(private host: MatchHost) {}

  mount() {
    const mode = this.required<HTMLSelectElement>('mode')
    const difficultyRow = this.required<HTMLElement>('difficulty-row')
    const syncMode = () => {
      const versusAi = mode.value === 'ai'
      difficultyRow.hidden = !versusAi
      this.required<HTMLSelectElement>('device2').disabled = versusAi
    }
    mode.addEventListener('change', syncMode)
    syncMode()

    this.bindClick('resume', () => this.host.resume())
    this.bindClick('restart', () => this.host.restart())
    this.bindClick('quit', () => this.host.quitToMenu())
    this.bindClick('pause-settings', () => this.showSettings(true))
    this.bindClick('close-settings', () => this.showSettings(false))

    this.required<HTMLButtonElement>('start-match').addEventListener('click', () => {
      if (!this.ready) {
        return
      }
      const setup = readMatchSetup({
        mode: mode.value,
        difficulty: this.required<HTMLSelectElement>('difficulty').value,
        name1: this.required<HTMLInputElement>('name1').value,
        name2: this.required<HTMLInputElement>('name2').value,
        device1: this.required<HTMLSelectElement>('device1').value,
        device2: this.required<HTMLSelectElement>('device2').value,
      })
      this.persistSetup(setup)
      this.host.beginMatch({ mode: setup.mode, difficulty: setup.difficulty })
    })

    window.addEventListener('gamepadconnected', () => this.refreshPads())
    window.addEventListener('gamepaddisconnected', () => this.refreshPads())
    this.refreshPads()
    this.fillFromSettings()
  }

  setReady(ready: boolean) {
    this.ready = ready
    const button = document.getElementById('start-match')
    if (button instanceof HTMLButtonElement) {
      button.disabled = !ready
      button.textContent = ready ? 'Start match' : 'Loading arena…'
    }
  }

  render(state: DebugSnapshot) {
    this.lastState = state
    const settingsOpen = this.settingsOpen()
    this.required<HTMLElement>('main-menu').hidden = state.status !== 'menu' || settingsOpen
    const pause = document.getElementById('pause-menu')
    if (pause) {
      pause.hidden = state.status !== 'paused' || settingsOpen
    }
    this.renderHud(state)
  }

  private renderHud(state: DebugSnapshot) {
    const hud = document.getElementById('hud')
    const banner = document.getElementById('banner')
    if (!hud || !banner) {
      return
    }
    const settings = settingsStore.get()
    const view = hudView(state, [
      settings.players.player1.gamepadIndex,
      settings.players.player2.gamepadIndex,
    ])
    hud.hidden = !view.visible
    this.text('timer', view.timer)
    this.text('round-label', view.roundLabel)
    banner.hidden = view.banner === null
    banner.textContent = view.banner ?? ''
    view.fighters.forEach((fighter, index) => {
      const slot = index === 0 ? 'player1' : 'player2'
      this.text(`hud-name-${slot}`, fighter.name)
      this.text(`hud-device-${slot}`, fighter.device)
      this.text(`life-${slot}`, String(fighter.life))
      const bar = document.querySelector(`[data-testid="health-${slot}"]`)
      if (bar instanceof HTMLElement) {
        bar.style.transform = `scaleX(${fighter.health})`
      }
      const pips = document.querySelector(`[data-testid="rounds-${slot}"]`)
      if (pips) {
        pips.replaceChildren()
        for (const won of fighter.rounds) {
          const pip = document.createElement('span')
          pip.className = won ? 'pip won' : 'pip'
          pips.append(pip)
        }
      }
    })
  }

  private text(id: string, value: string) {
    const element = document.querySelector(`[data-testid="${id}"]`)
    if (element) {
      element.textContent = value
    }
  }

  showSettings(show: boolean) {
    const panel = document.getElementById('settings-panel')
    if (!panel) {
      return
    }
    if (show) {
      this.renderSettings()
    }
    panel.hidden = !show
    if (this.lastState) {
      this.render(this.lastState)
    }
  }

  settingsOpen(): boolean {
    const panel = document.getElementById('settings-panel')
    return Boolean(panel && !panel.hidden)
  }

  private renderVolumes(body: HTMLElement, settings: ReturnType<typeof settingsStore.get>) {
    const group = document.createElement('div')
    group.className = 'volumes'
    for (const [key, label] of [['musicVolume', 'Music'], ['sfxVolume', 'Effects']] as const) {
      const row = document.createElement('label')
      row.textContent = label
      const input = document.createElement('input')
      input.type = 'range'
      input.min = '0'
      input.max = '1'
      input.step = '0.05'
      input.value = String(settings[key])
      input.dataset.testid = key
      input.addEventListener('input', () => {
        const current = settingsStore.get()
        settingsStore.set({ ...current, [key]: Number(input.value) })
      })
      row.append(input)
      group.append(row)
    }
    body.append(group)
  }

  private renderSettings() {
    const body = document.getElementById('settings-body')
    if (!body) {
      return
    }
    body.replaceChildren()
    const settings = settingsStore.get()
    this.renderVolumes(body, settings)
    const note = document.createElement('p')
    note.className = 'note'
    note.textContent = 'Keyboard and gamepad bindings for this browser.'
    body.append(note)
    for (const slot of ['player1', 'player2'] as const) {
      const player = settings.players[slot]
      const heading = document.createElement('h3')
      heading.textContent = player.name
      const list = document.createElement('ul')
      for (const [action, code] of Object.entries(player.keys)) {
        const item = document.createElement('li')
        item.textContent = `${action}: ${code}`
        list.append(item)
      }
      body.append(heading, list)
    }
  }

  private bindClick(id: string, action: () => void) {
    document.getElementById(id)?.addEventListener('click', action)
  }

  private persistSetup(setup: ReturnType<typeof readMatchSetup>) {
    const current = settingsStore.get()
    const secondDevice = setup.mode === 'ai'
      ? { device: current.players.player2.device, gamepadIndex: current.players.player2.gamepadIndex }
      : setup.device2
    settingsStore.set({
      ...current,
      players: {
        player1: { ...current.players.player1, name: setup.name1, ...setup.device1 },
        player2: { ...current.players.player2, name: setup.name2, ...secondDevice },
      },
    })
  }

  private fillFromSettings() {
    const settings = settingsStore.get()
    this.setValue('name1', settings.players.player1.name)
    this.setValue('name2', settings.players.player2.name)
    this.setValue('device1', deviceValue(settings.players.player1))
    this.setValue('device2', deviceValue(settings.players.player2))
  }

  private refreshPads() {
    const note = document.getElementById('pad-note')
    if (!note || typeof navigator === 'undefined' || !navigator.getGamepads) {
      return
    }
    const count = navigator.getGamepads().filter((pad) => pad && pad.connected).length
    note.textContent = count === 0
      ? 'No gamepad detected. Press a button on a pad, or play on the keyboard.'
      : `${count} gamepad${count === 1 ? '' : 's'} connected.`
  }

  private setValue(id: string, value: string) {
    const element = document.getElementById(id)
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      element.value = value
    }
  }

  private required<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id)
    if (!element) {
      throw new Error(`Missing #${id}`)
    }
    return element as T
  }
}
