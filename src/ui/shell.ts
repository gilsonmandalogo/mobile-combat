import { KEY_ACTIONS, rebindKey, rebindPad, resetSettings, settingsStore } from '@stores/settings'
import type { ActionName, PlayerSlot } from '@stores/settings'
import type { DebugSnapshot } from '@src/debug/snapshot'
import { buttonName } from '@src/input/gamepad'
import type { PadBindings } from '@src/input/gamepad'
import { deviceValue, parseDifficulty, readMatchSetup } from '@src/ui/setup'
import { healthMotion, hudView } from '@src/ui/hud'
import { defaultArena, defaultPicks, loadArenas, loadCharacters, moveList, stepRoster } from '@src/content/catalog'
import { focusItems, moveFocus, paintFocus } from '@src/ui/focus'
import type { FocusDirection } from '@src/ui/focus'
import type { OnlineView } from '@src/net/session'
import type { Difficulty, MatchMode } from '@src/sim/types'
import type { PadSnapshot } from '@src/input/gamepad'

const ACTION_LABELS: Record<ActionName, string> = {
  left: 'Left',
  right: 'Right',
  jump: 'Jump',
  attackUp: 'Punch up',
  attackDown: 'Punch down',
  block: 'Block',
  crouch: 'Crouch',
}

const PAD_ACTIONS: Array<keyof PadBindings> = ['jump', 'attackUp', 'attackDown', 'block', 'crouch']

interface Listening {
  kind: 'key' | 'pad'
  slot: PlayerSlot | 'menu'
  action: ActionName | 'menu'
}

export interface MatchHost {
  beginMatch: (options: { mode: MatchMode; difficulty: Difficulty; seed?: number; characters?: [string, string]; arena?: string }) => void | Promise<void>
  play: (cue: 'menu' | 'hover') => void
  resume: () => void
  restart: () => void
  quitToMenu: () => void
  pads: () => PadSnapshot[]
  hostOnline: () => void
  joinOnline: (code: string) => void
  editOnline: (patch: { character?: string; arena?: string; ready?: boolean; rematch?: boolean; delay?: number }) => void
  leaveOnline: () => void
  manualOffer: () => Promise<string>
  manualAccept: (code: string) => Promise<string>
}

export class Shell {
  private ready = false
  private lastState: DebugSnapshot | null = null
  private listening: Listening | null = null
  private screen: 'title' | 'main' | 'setup' | 'characters' | 'arenas' | 'online' = 'title'
  private online: OnlineView | null = null
  private onlineReady = false
  private hovered: EventTarget | null = null
  private titleHeld = false
  private focusId: string | null = null
  private padNav = { x: 0, y: 0, a: false, b: false }
  private roster = loadCharacters()
  private picks = defaultPicks(this.roster)
  private rosterAxis = [0, 0]
  private arenas = loadArenas()
  private arenaPick = defaultArena(this.arenas)
  private arenaAxis = 0
  private healthShown: Record<'player1' | 'player2', number> = { player1: -1, player2: -1 }
  private bannerText = ''
  private closers = new Map<string, () => void>()

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
    this.required<HTMLSelectElement>('difficulty').addEventListener('change', () => {
      const current = settingsStore.get()
      settingsStore.set({
        ...current,
        difficulty: parseDifficulty(this.required<HTMLSelectElement>('difficulty').value),
      })
    })

    this.bindClick('resume', () => this.host.resume())
    this.bindClick('restart', () => this.host.restart())
    this.bindClick('results-rematch', () => {
      if (this.lastState?.mode === 'online') {
        this.host.editOnline({ rematch: true })
        return
      }
      this.host.restart()
    })
    this.bindClick('results-menu', () => {
      this.screen = 'main'
      this.host.quitToMenu()
    })
    this.bindClick('quit', () => {
      this.screen = 'main'
      this.host.quitToMenu()
    })
    this.bindClick('pause-settings', () => this.showSettings(true))
    this.bindClick('open-settings', () => this.showSettings(true))
    this.bindClick('close-settings', () => this.showSettings(false))
    this.bindClick('reset-bindings', () => {
      this.listening = null
      settingsStore.set(resetSettings(settingsStore.get()))
      this.renderSettings()
    })
    window.addEventListener('keydown', (event) => this.captureKey(event), true)
    window.addEventListener('keydown', (event) => this.steerCharacters(event))
    window.addEventListener('keydown', (event) => this.steerArenas(event))
    window.addEventListener('keydown', (event) => this.confirmTitleKey(event))
    window.addEventListener('keydown', (event) => this.moveMenuKey(event))
    document.body.addEventListener('pointerover', (event) => {
      const target = event.target
      if (!(target instanceof HTMLButtonElement) || target.disabled || target === this.hovered) {
        return
      }
      this.hovered = target
      this.host.play('hover')
    })
    this.watchPads()

    this.required<HTMLButtonElement>('start-match').addEventListener('click', () => {
      if (!this.ready) {
        return
      }
      this.screen = 'characters'
      this.renderRoster()
      if (this.lastState) {
        this.render(this.lastState)
      }
    })
    this.bindClick('title-start', () => {
      if (this.ready) {
        this.showScreen('main')
      }
    })
    this.bindClick('main-fight', () => this.showScreen('setup'))
    this.bindClick('main-online', () => this.showScreen('online'))
    this.bindOnline()
    this.bindClick('setup-back', () => this.showScreen('main'))
    this.bindClick('characters-back', () => {
      this.screen = 'setup'
      if (this.lastState) {
        this.render(this.lastState)
      }
    })
    this.bindClick('confirm-characters', () => {
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
      this.screen = 'arenas'
      this.renderArenas()
      if (this.lastState) {
        this.render(this.lastState)
      }
    })
    this.bindClick('arenas-back', () => {
      this.screen = 'characters'
      this.renderRoster()
      if (this.lastState) {
        this.render(this.lastState)
      }
    })
    this.bindClick('confirm-arena', () => {
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
      const ids: [string, string] = [
        this.roster[this.picks.player1].id,
        this.roster[this.picks.player2].id,
      ]
      void this.host.beginMatch({
        mode: setup.mode,
        difficulty: setup.difficulty,
        characters: ids,
        arena: this.arenas[this.arenaPick].id,
      })
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
      button.textContent = ready ? 'Fighters' : 'Loading…'
    }
    const title = document.getElementById('title-start')
    if (title instanceof HTMLButtonElement) {
      title.disabled = !ready
      title.textContent = ready ? 'Press start' : 'Loading…'
    }
  }

  private showScreen(screen: 'main' | 'setup' | 'characters' | 'arenas' | 'online') {
    this.screen = screen
    if (screen === 'characters') {
      this.renderRoster()
    }
    if (screen === 'arenas') {
      this.renderArenas()
    }
    if (this.lastState) {
      this.render(this.lastState)
    }
  }

  private menuRoot(): HTMLElement | null {
    if (this.settingsOpen()) {
      return document.getElementById('settings-panel')
    }
    if (this.lastState?.status === 'paused') {
      return document.getElementById('pause-menu')
    }
    if (this.lastState?.status === 'matchEnd') {
      return document.getElementById('results-panel')
    }
    const id = this.screen === 'title'
      ? 'title-screen'
      : this.screen === 'main'
        ? 'main-menu'
        : this.screen === 'setup'
          ? 'setup-menu'
          : this.screen === 'arenas'
            ? 'arena-select'
            : this.screen === 'online'
              ? 'online-menu'
              : ''
    const element = id ? document.getElementById(id) : null
    return element && !element.hidden ? element : null
  }

  private ensureFocus() {
    const root = this.menuRoot()
    if (!root || this.screen === 'characters') {
      return
    }
    const enabled = focusItems(root).filter((item) => !item.disabled)
    if (!enabled.some((item) => item.id === this.focusId)) {
      const arenaId = this.arenas[this.arenaPick]?.id
      const preferred = this.screen === 'arenas' && arenaId ? `arena-card-${arenaId}` : enabled[0]?.id
      this.focusId = enabled.some((item) => item.id === preferred) ? preferred ?? null : enabled[0]?.id ?? null
    }
    paintFocus(root, this.focusId)
  }

  private shiftFocus(direction: FocusDirection) {
    const root = this.menuRoot()
    if (!root || this.listening) {
      return
    }
    this.focusId = moveFocus(focusItems(root), this.focusId, direction)
    this.syncArenaFromFocus()
    paintFocus(root, this.focusId)
  }

  private syncArenaFromFocus() {
    if (this.screen !== 'arenas' || !this.focusId?.startsWith('arena-card-')) {
      return
    }
    const id = this.focusId.slice('arena-card-'.length)
    const index = this.arenas.findIndex((arena) => arena.id === id)
    if (index < 0 || index === this.arenaPick) {
      return
    }
    this.arenaPick = index
    this.renderArenas()
  }

  private moveMenuKey(event: KeyboardEvent) {
    if (event.defaultPrevented || this.listening || this.screen === 'characters' || this.screen === 'title') {
      return
    }
    if (event.target instanceof HTMLInputElement && event.target.type !== 'range') {
      return
    }
    const direction: FocusDirection | null = event.code === 'ArrowUp'
      ? 'up'
      : event.code === 'ArrowDown'
        ? 'down'
        : event.code === 'ArrowLeft'
          ? 'left'
          : event.code === 'ArrowRight'
            ? 'right'
            : null
    if (!direction) {
      if ((event.code === 'Enter' || event.code === 'Space') && this.activateFocused()) {
        event.preventDefault()
      }
      return
    }
    if (this.nudgeValue(direction)) {
      event.preventDefault()
      return
    }
    event.preventDefault()
    this.shiftFocus(direction)
  }

  private nudgeValue(direction: FocusDirection): boolean {
    if (direction !== 'left' && direction !== 'right') {
      return false
    }
    const root = this.menuRoot()
    const element = this.focusId && root ? root.querySelector(`#${CSS.escape(this.focusId)}`) : null
    const delta = direction === 'right' ? 1 : -1
    if (element instanceof HTMLSelectElement) {
      const next = Math.min(element.options.length - 1, Math.max(0, element.selectedIndex + delta))
      if (next !== element.selectedIndex) {
        element.selectedIndex = next
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }
      return true
    }
    if (element instanceof HTMLInputElement && element.type === 'range') {
      const step = Number(element.step) || 0.05
      const value = Math.min(Number(element.max), Math.max(Number(element.min), Number(element.value) + delta * step))
      element.value = String(value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
    return false
  }

  private activateFocused(): boolean {
    const root = this.menuRoot()
    const element = this.focusId && root ? root.querySelector(`#${CSS.escape(this.focusId)}`) : null
    if (element instanceof HTMLButtonElement && !element.disabled) {
      element.click()
      return true
    }
    return false
  }

  private steerMenuPad(pads: PadSnapshot[]) {
    const root = this.menuRoot()
    if (this.listening || this.screen === 'title' || (!root && this.screen !== 'characters')) {
      return
    }
    const pad = pads.find((item) => item.connected && item.index === 0) ?? pads.find((item) => item.connected)
    const axisX = pad?.axes[0] ?? 0
    const axisY = pad?.axes[1] ?? 0
    const horizontal = pad?.buttons[14]?.pressed ? -1 : pad?.buttons[15]?.pressed ? 1 : axisX <= -0.6 ? -1 : axisX >= 0.6 ? 1 : 0
    const vertical = pad?.buttons[12]?.pressed ? -1 : pad?.buttons[13]?.pressed ? 1 : axisY <= -0.6 ? -1 : axisY >= 0.6 ? 1 : 0
    const direction: FocusDirection | null = vertical === -1 ? 'up' : vertical === 1 ? 'down' : horizontal === -1 ? 'left' : horizontal === 1 ? 'right' : null
    if (direction && root && this.padNav.x === 0 && this.padNav.y === 0 && !this.nudgeValue(direction)) {
      this.shiftFocus(direction)
    }
    this.padNav.x = horizontal
    this.padNav.y = vertical
    const a = Boolean(pad?.buttons[0]?.pressed)
    const b = Boolean(pad?.buttons[1]?.pressed)
    if (a && !this.padNav.a) {
      if (this.screen === 'characters') {
        document.getElementById('confirm-characters')?.click()
      } else {
        this.activateFocused()
      }
    }
    if (b && !this.padNav.b) {
      if (this.screen === 'characters') {
        document.getElementById('characters-back')?.click()
      } else {
        const back = root?.querySelector('[data-back]')
        if (back instanceof HTMLElement) {
          back.click()
        }
      }
    }
    this.padNav.a = a
    this.padNav.b = b
  }

  private confirmTitleKey(event: KeyboardEvent) {
    if (this.screen !== 'title' || !this.ready || this.listening) {
      return
    }
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault()
      this.showScreen('main')
    }
  }

  render(state: DebugSnapshot) {
    this.lastState = state
    const settingsOpen = this.settingsOpen()
    const menu = state.status === 'menu' && !settingsOpen
    this.setHidden('embers', state.status !== 'menu')
    this.setHidden('title-screen', !(menu && this.screen === 'title'))
    this.setHidden('main-menu', !(menu && this.screen === 'main'))
    this.setHidden('setup-menu', !(menu && this.screen === 'setup'))
    this.setHidden('character-select', !(menu && this.screen === 'characters'))
    this.setHidden('arena-select', !(menu && this.screen === 'arenas'))
    this.setHidden('online-menu', !(menu && this.screen === 'online'))
    this.setHidden('online-disconnect', !this.online?.disconnected)
    this.setHidden('results-panel', state.status !== 'matchEnd' || settingsOpen)
    this.paintOnline()
    if (state.status === 'matchEnd') {
      this.text('results-title', state.banner ?? 'Match over')
    }
    this.ensureFocus()
    const showPause = state.status === 'paused' && !settingsOpen
    this.setHidden('pause-menu', !showPause)
    if (showPause) {
      this.renderMoveList()
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
    this.text('combat-callout', view.callout)
    this.text('net-status', state.net ? `${state.net.link} ${state.net.ping} ms` : '')
    const bannerText = view.banner ?? ''
    const hideBanner = view.banner === null || state.status === 'matchEnd'
    if (banner.hidden !== hideBanner || banner.textContent !== bannerText) {
      banner.hidden = hideBanner
      banner.textContent = bannerText
      banner.classList.remove('banner-pop', 'banner-ko')
      if (!hideBanner && bannerText && bannerText !== this.bannerText) {
        void banner.offsetWidth
        banner.classList.add(bannerText === 'K.O.' ? 'banner-ko' : 'banner-pop')
      }
      this.bannerText = bannerText
    }
    view.fighters.forEach((fighter, index) => {
      const slot = index === 0 ? 'player1' : 'player2'
      this.text(`hud-name-${slot}`, fighter.name)
      this.text(`hud-device-${slot}`, fighter.device)
      this.text(`life-${slot}`, String(fighter.life))
      this.text(`guard-${slot}`, fighter.guard)
      this.paintHealth(slot, fighter.health)
      this.paintMeter(slot, fighter.energy, fighter.meterFull)
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

  private paintMeter(slot: 'player1' | 'player2', ratio: number, full: boolean) {
    const meter = document.querySelector(`[data-testid="meter-${slot}"]`)
    const fill = document.querySelector(`[data-testid="meter-fill-${slot}"]`)
    if (!(meter instanceof HTMLElement) || !(fill instanceof HTMLElement)) {
      return
    }
    fill.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`
    meter.classList.toggle('is-full', full)
  }

  private paintHealth(slot: 'player1' | 'player2', ratio: number) {
    const fill = document.querySelector(`[data-testid="health-${slot}"]`)
    const trail = document.querySelector(`[data-testid="health-trail-${slot}"]`)
    if (!(fill instanceof HTMLElement) || !(trail instanceof HTMLElement)) {
      return
    }
    const previous = this.healthShown[slot]
    fill.style.transform = `scaleX(${ratio})`
    if (previous >= 0 && Math.abs(previous - ratio) <= 0.004) {
      this.healthShown[slot] = ratio
      return
    }
    const motion = healthMotion(previous, ratio)
    trail.style.transition = motion.snap ? 'none' : ''
    trail.style.transform = `scaleX(${ratio})`
    trail.dataset.from = (motion.snap ? ratio : previous).toFixed(3)
    trail.dataset.to = ratio.toFixed(3)
    const bar = fill.parentElement
    if (motion.shake && bar) {
      bar.classList.remove('is-hit')
      bar.parentElement?.classList.remove('is-hit')
      void bar.offsetWidth
      bar.classList.add('is-hit')
      bar.parentElement?.classList.add('is-hit')
    }
    this.healthShown[slot] = ratio
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
    this.setHidden('settings-panel', !show)
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
      input.id = key
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
    button.id = testId
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

  private confirmTitlePad(pads: PadSnapshot[]) {
    if (this.screen !== 'title') {
      this.titleHeld = false
      return
    }
    const pressed = pads.some((pad) => pad.connected && (pad.buttons[0]?.pressed || pad.buttons[9]?.pressed))
    if (pressed && !this.titleHeld && this.ready) {
      this.showScreen('main')
    }
    this.titleHeld = pressed
  }

  private setHidden(id: string, hidden: boolean) {
    const element = document.getElementById(id)
    if (!element) {
      return
    }
    const finish = this.closers.get(id)
    if (!hidden) {
      finish?.()
      element.classList.remove('is-closing')
      element.hidden = false
      return
    }
    if (element.hidden || element.classList.contains('is-closing')) {
      return
    }
    const animated = element.classList.contains('panel') || element.id === 'title-screen'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animated || reduce) {
      element.hidden = true
      return
    }
    element.classList.add('is-closing')
    const done = () => {
      element.removeEventListener('animationend', done)
      this.closers.delete(id)
      if (!element.classList.contains('is-closing')) {
        return
      }
      element.classList.remove('is-closing')
      element.hidden = true
    }
    this.closers.set(id, () => {
      element.removeEventListener('animationend', done)
      this.closers.delete(id)
    })
    element.addEventListener('animationend', done)
  }

  private renderMoveList() {
    const root = document.getElementById('move-list')
    if (!root || !this.lastState) {
      return
    }
    root.replaceChildren()
    for (const fighter of this.lastState.fighters) {
      const def = this.roster.find((character) => character.id === fighter.characterId)
      if (!def) {
        continue
      }
      const column = document.createElement('div')
      const heading = document.createElement('p')
      heading.className = 'move-heading'
      heading.textContent = def.name
      column.append(heading)
      for (const line of moveList(def)) {
        const row = document.createElement('p')
        row.textContent = line
        column.append(row)
      }
      root.append(column)
    }
  }

  private renderArenas() {
    const selected = this.arenas[this.arenaPick]
    this.text('arena-name', selected ? `${selected.name} · ${selected.music}` : '')
    const list = document.getElementById('arena-list')
    if (!list) {
      return
    }
    list.replaceChildren()
    this.arenas.forEach((arena, index) => {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = index === this.arenaPick ? 'roster-card selected' : 'roster-card'
      card.id = `arena-card-${arena.id}`
      card.dataset.testid = `arena-card-${arena.id}`
      const mark = document.createElement('span')
      mark.className = 'mark'
      mark.style.background = arena.preview.color
      mark.textContent = arena.preview.mark
      const label = document.createElement('span')
      label.textContent = arena.name
      card.append(mark, label)
      card.addEventListener('click', () => {
        this.arenaPick = index
        this.renderArenas()
      })
      list.append(card)
    })
  }

  private steerArenas(event: KeyboardEvent) {
    if (this.screen !== 'arenas' || this.listening) {
      return
    }
    if (event.code !== 'KeyA' && event.code !== 'KeyD' && event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') {
      return
    }
    event.preventDefault()
    const delta = event.code === 'KeyD' || event.code === 'ArrowRight' ? 1 : -1
    this.arenaPick = stepRoster(this.arenaPick, delta, this.arenas.length)
    this.renderArenas()
  }

  private steerArenaPads(pads: PadSnapshot[]) {
    if (this.screen !== 'arenas') {
      return
    }
    const pad = pads.find((item) => item.connected && (item.index === 0 || item.index === 1))
    const axis = pad?.axes[0] ?? 0
    const direction = pad?.buttons[14]?.pressed ? -1 : pad?.buttons[15]?.pressed ? 1 : axis <= -0.6 ? -1 : axis >= 0.6 ? 1 : 0
    if (direction !== 0 && this.arenaAxis === 0) {
      this.arenaPick = stepRoster(this.arenaPick, direction, this.arenas.length)
      this.renderArenas()
    }
    this.arenaAxis = direction
  }

  private renderRoster() {
    for (const slot of ['player1', 'player2'] as const) {
      const selected = this.picks[slot]
      const character = this.roster[selected]
      this.text(`pick-name-${slot}`, character ? `${character.name} · ${character.stats.health} hp` : '')
      const list = document.getElementById(`roster-${slot}`)
      if (!list || !character) {
        continue
      }
      list.replaceChildren()
      this.roster.forEach((item, index) => {
        const card = document.createElement('button')
        card.type = 'button'
        card.className = index === selected ? 'roster-card selected is-focused' : 'roster-card'
        card.dataset.testid = `character-card-${item.id}-${slot}`
        const mark = document.createElement('span')
        mark.className = 'mark'
        mark.style.background = item.portrait.color
        mark.textContent = item.portrait.mark
        const label = document.createElement('span')
        label.textContent = item.name
        card.append(mark, label)
        card.addEventListener('click', () => {
          this.picks[slot] = index
          this.renderRoster()
        })
        list.append(card)
      })
    }
  }

  private steerCharacters(event: KeyboardEvent) {
    if (this.screen !== 'characters' || this.listening) {
      return
    }
    if (event.code === 'KeyA' || event.code === 'KeyD') {
      event.preventDefault()
      this.picks.player1 = stepRoster(this.picks.player1, event.code === 'KeyD' ? 1 : -1, this.roster.length)
      this.renderRoster()
    }
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault()
      this.picks.player2 = stepRoster(this.picks.player2, event.code === 'ArrowRight' ? 1 : -1, this.roster.length)
      this.renderRoster()
    }
  }

  private steerRosterPads(pads: PadSnapshot[]) {
    if (this.screen !== 'characters') {
      return
    }
    for (const slot of [0, 1] as const) {
      const pad = pads.find((item) => item.index === slot && item.connected)
      const axis = pad?.axes[0] ?? 0
      const direction = pad?.buttons[14]?.pressed ? -1 : pad?.buttons[15]?.pressed ? 1 : axis <= -0.6 ? -1 : axis >= 0.6 ? 1 : 0
      if (direction !== 0 && this.rosterAxis[slot] === 0) {
        const key = slot === 0 ? 'player1' : 'player2'
        this.picks[key] = stepRoster(this.picks[key], direction, this.roster.length)
        this.renderRoster()
      }
      this.rosterAxis[slot] = direction
    }
  }

  private watchPads() {
    let previous: boolean[][] = []
    const tick = () => {
      const pads = readPads(this.host.pads())
      this.steerRosterPads(pads)
      this.steerArenaPads(pads)
      this.confirmTitlePad(pads)
      this.steerMenuPad(pads)
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
      difficulty: setup.difficulty,
      players: {
        player1: { ...current.players.player1, name: setup.name1, ...setup.device1 },
        player2: { ...current.players.player2, name: setup.name2, ...secondDevice },
      },
    })
  }

  private bindOnline() {
    const character = this.required<HTMLSelectElement>('online-character')
    const arena = this.required<HTMLSelectElement>('online-arena')
    for (const fighter of this.roster) {
      const option = document.createElement('option')
      option.value = fighter.id
      option.textContent = fighter.name
      character.append(option)
    }
    for (const stage of this.arenas) {
      const option = document.createElement('option')
      option.value = stage.id
      option.textContent = stage.name
      arena.append(option)
    }
    character.addEventListener('change', () => this.host.editOnline({ character: character.value }))
    arena.addEventListener('change', () => this.host.editOnline({ arena: arena.value }))
    this.required<HTMLInputElement>('input-delay').addEventListener('change', () => {
      const delay = Number(this.required<HTMLInputElement>('input-delay').value)
      const current = settingsStore.get()
      settingsStore.set({ ...current, inputDelay: delay })
      this.host.editOnline({ delay })
    })
    this.bindClick('online-host', () => { void this.host.hostOnline() })
    this.bindClick('online-join', () => {
      void this.host.joinOnline(this.required<HTMLInputElement>('join-code').value)
    })
    this.bindClick('online-ready', () => {
      this.onlineReady = !this.onlineReady
      this.required<HTMLButtonElement>('online-ready').textContent = this.onlineReady ? 'Waiting' : 'Ready'
      this.host.editOnline({ ready: this.onlineReady })
    })
    this.bindClick('online-copy', () => {
      const link = this.online?.link
      if (link && navigator.clipboard) {
        void navigator.clipboard.writeText(link)
      }
    })
    this.bindClick('manual-offer', () => {
      void this.host.manualOffer().then((code) => {
        this.required<HTMLTextAreaElement>('manual-code').value = code
      }).catch(() => {
        this.text('online-status', 'WebRTC is not available')
      })
    })
    this.bindClick('manual-accept', () => {
      const box = this.required<HTMLTextAreaElement>('manual-code')
      void this.host.manualAccept(box.value).then((answer) => {
        if (answer) {
          box.value = answer
        }
      }).catch(() => {
        this.text('online-status', 'That connection code could not be accepted')
      })
    })
    this.bindClick('online-back', () => {
      this.onlineReady = false
      this.host.leaveOnline()
      this.showScreen('main')
    })
    this.bindClick('online-leave', () => {
      this.online = null
      this.onlineReady = false
      this.screen = 'main'
      this.host.leaveOnline()
      this.host.quitToMenu()
    })
  }

  setOnline(view: OnlineView | null) {
    this.online = view
    if (view?.disconnected) {
      if (this.lastState) {
        this.render(this.lastState)
      }
      return
    }
    if (view && (!this.lastState || this.lastState.status === 'menu')) {
      this.screen = 'online'
    }
    if (!view && this.screen === 'online') {
      this.screen = 'main'
    }
    if (this.lastState) {
      this.render(this.lastState)
    }
  }

  private paintOnline() {
    const view = this.online
    if (!view) {
      return
    }
    this.text('online-status', view.status)
    this.text('room-code', view.code && view.code !== 'MANUAL' ? `Room ${view.code}` : '')
    this.text('room-link', view.link)
    const opponent = this.roster.find((fighter) => fighter.id === view.opponent)
    const stage = this.arenas.find((arena) => arena.id === view.arena)
    this.text('online-opponent', view.disconnected ? '' : `Opponent ${opponent?.name ?? view.opponent} · ${stage?.name ?? view.arena}`)
    const character = document.getElementById('online-character')
    if (character instanceof HTMLSelectElement && document.activeElement !== character) {
      character.value = view.yours
    }
    const arena = document.getElementById('online-arena')
    if (arena instanceof HTMLSelectElement) {
      arena.disabled = view.role !== 'host'
      if (document.activeElement !== arena) {
        arena.value = view.arena
      }
    }
  }

  private fillFromSettings() {
    const settings = settingsStore.get()
    this.setValue('difficulty', settings.difficulty)
    this.setValue('name1', settings.players.player1.name)
    this.setValue('name2', settings.players.player2.name)
    this.setValue('device1', deviceValue(settings.players.player1))
    this.setValue('device2', deviceValue(settings.players.player2))
    this.setValue('input-delay', String(settings.inputDelay))
    const room = new URLSearchParams(location.search).get('room')
    if (room) {
      this.setValue('join-code', room.toUpperCase())
      this.screen = 'online'
    }
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

function readPads(virtual: PadSnapshot[]): PadSnapshot[] {
  if (virtual.length) {
    return virtual
  }
  if (typeof navigator === 'undefined' || !navigator.getGamepads) {
    return []
  }
  return Array.from(navigator.getGamepads()).flatMap((pad) => {
    if (!pad) {
      return []
    }
    return [{
      index: pad.index,
      connected: pad.connected,
      axes: Array.from(pad.axes),
      buttons: Array.from(pad.buttons).map((button) => ({ pressed: button.pressed, value: button.value })),
      mapping: pad.mapping,
      id: pad.id,
    }]
  })
}
