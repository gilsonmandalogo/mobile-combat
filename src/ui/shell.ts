import { KEY_ACTIONS, rebindKey, rebindPad, resetSettings, settingsStore } from '@stores/settings'
import type { ActionName, PlayerSlot } from '@stores/settings'
import type { DebugSnapshot } from '@src/debug/snapshot'
import { buttonName } from '@src/input/gamepad'
import type { PadBindings } from '@src/input/gamepad'
import { deviceValue, readMatchSetup } from '@src/ui/setup'
import { hudView } from '@src/ui/hud'
import type { Difficulty, MatchMode } from '@src/sim/types'

const ACTION_LABELS: Record<ActionName, string> = {
  left: 'Left',
  right: 'Right',
  jump: 'Jump',
  attackUp: 'Punch up',
  attackDown: 'Punch down',
  block: 'Block',
}

const PAD_ACTIONS: Array<keyof PadBindings> = ['jump', 'attackUp', 'attackDown', 'block']

interface Listening {
  kind: 'key' | 'pad'
  slot: PlayerSlot | 'menu'
  action: ActionName | 'menu'
}

export interface MatchHost {
  beginMatch: (options: { mode: MatchMode; difficulty: Difficulty; seed?: number }) => void
  resume: () => void
  restart: () => void
  quitToMenu: () => void
}

export class Shell {
  private ready = false
  private lastState: DebugSnapshot | null = null
  private listening: Listening | null = null

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
    this.bindClick('open-settings', () => this.showSettings(true))
    this.bindClick('close-settings', () => this.showSettings(false))
    this.bindClick('reset-bindings', () => {
      this.listening = null
      settingsStore.set(resetSettings(settingsStore.get()))
      this.renderSettings()
    })
    window.addEventListener('keydown', (event) => this.captureKey(event), true)
    this.watchPads()

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
    if (!show) {
      this.listening = null
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
    note.textContent = 'Click a binding, then press a key or gamepad button. A duplicate on the same player swaps.'
    body.append(note)
    for (const slot of ['player1', 'player2'] as const) {
      body.append(this.playerBindings(slot, settings))
    }
    const menu = document.createElement('p')
    menu.append('Menu ', this.bindButton('bind-menu', 'key', 'menu', 'menu', settings.menuKey, 'Press a key'))
    body.append(menu)
  }

  private playerBindings(slot: PlayerSlot, settings: ReturnType<typeof settingsStore.get>): HTMLElement {
    const player = settings.players[slot]
    const section = document.createElement('section')
    const heading = document.createElement('h3')
    heading.textContent = player.name
    const table = document.createElement('table')
    table.className = 'bind-table'
    const head = document.createElement('tr')
    for (const label of ['Action', 'Keyboard', 'Gamepad']) {
      const cell = document.createElement('th')
      cell.textContent = label
      head.append(cell)
    }
    table.append(head)
    for (const action of KEY_ACTIONS) {
      const row = document.createElement('tr')
      const name = document.createElement('td')
      name.textContent = ACTION_LABELS[action]
      const keyCell = document.createElement('td')
      keyCell.append(this.bindButton(
        `bind-${slot}-${action}`,
        'key',
        slot,
        action,
        player.keys[action],
        'Press a key',
      ))
      const padCell = document.createElement('td')
      if (PAD_ACTIONS.includes(action as keyof PadBindings)) {
        const padAction = action as keyof PadBindings
        padCell.append(this.bindButton(
          `pad-${slot}-${padAction}`,
          'pad',
          slot,
          padAction,
          buttonName(player.pad[padAction]),
          'Press a button',
        ))
      } else {
        padCell.textContent = 'Stick'
      }
      row.append(name, keyCell, padCell)
      table.append(row)
    }
    section.append(heading, table)
    return section
  }

  private bindButton(
    testId: string,
    kind: Listening['kind'],
    slot: Listening['slot'],
    action: Listening['action'],
    label: string,
    prompt: string,
  ): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.testid = testId
    const active = this.listening?.kind === kind
      && this.listening.slot === slot
      && this.listening.action === action
    button.textContent = active ? prompt : label
    button.addEventListener('click', () => {
      this.listening = { kind, slot, action }
      this.renderSettings()
    })
    return button
  }

  private captureKey(event: KeyboardEvent) {
    if (!this.listening || this.listening.kind !== 'key' || !event.code) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const current = settingsStore.get()
    if (this.listening.slot === 'menu') {
      settingsStore.set({ ...current, menuKey: event.code })
    } else {
      settingsStore.set(rebindKey(current, this.listening.slot, this.listening.action as ActionName, event.code))
    }
    this.listening = null
    this.renderSettings()
  }

  private watchPads() {
    let previous: boolean[][] = []
    const tick = () => {
      const pads = typeof navigator !== 'undefined' && navigator.getGamepads
        ? navigator.getGamepads()
        : []
      if (this.listening?.kind === 'pad' && this.listening.slot !== 'menu') {
        for (const pad of pads) {
          if (!pad || this.listening?.kind !== 'pad' || this.listening.slot === 'menu') {
            continue
          }
          const before = previous[pad.index] ?? []
          for (let index = 0; index < pad.buttons.length; index += 1) {
            if (pad.buttons[index].pressed && !before[index]) {
              settingsStore.set(rebindPad(
                settingsStore.get(),
                this.listening.slot,
                this.listening.action as keyof PadBindings,
                index,
              ))
              this.listening = null
              this.renderSettings()
              break
            }
          }
        }
      }
      previous = Array.from(pads).map((pad) => pad ? pad.buttons.map((button) => button.pressed) : [])
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
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
