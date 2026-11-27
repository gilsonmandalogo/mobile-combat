import * as THREE from 'three'
import Player from '@src/player'
import Animations from '@src/animations'
import { characterById } from '@src/content/catalog'
import type { CharacterDef } from '@src/content/schema'
import { updateDebug } from '@src/debug'
import { settingsStore } from '@stores/settings'
import { contextStore } from '@stores/context'
import { publishDebugApi } from '@src/debug/bridge'
import { snapshotMatch } from '@src/debug/snapshot'
import type { DebugSnapshot } from '@src/debug/snapshot'
import { hitbox, hurtbox } from '@src/sim/hitboxes'
import { createMatch, pauseMatch, quitToMenu as menuState, restartMatch, resumeMatch, startMatch, stepMatch } from '@src/sim/match'
import type { Aabb, Difficulty, FighterId, FighterProfile, GameEvent, Intent, MatchMode, MatchState } from '@src/sim/types'
import { KeyboardTracker, keyboardIntent } from '@src/input/keyboard'
import type { Shell } from '@src/ui/shell'
import { gamepadIntent, mergeGamepads } from '@src/input/gamepad'
import type { HapticGamepad, PadSnapshot } from '@src/input/gamepad'
import { createAiMemory, stepAi } from '@src/ai/opponent'
import type { AiMemory } from '@src/ai/opponent'
import { EMPTY_INTENT } from '@src/sim/types'
import { AudioEngine } from '@src/audio/engine'
import type { PlayerSlot } from '@src/settings/schema'

interface GameConstructor {
  roundTime: number
  enterArena: () => Promise<void>
}

export default class Game {
  private player1?: Player
  private player2?: Player
  private animations?: Animations
  private loadedIds: [string, string] | null = null
  private enterArena: () => Promise<void>
  private match: MatchState
  private keyboard: KeyboardTracker
  private forced: Record<FighterId, Intent | null> = { player1: null, player2: null }
  private flash: Record<FighterId, number> = { player1: 0, player2: 0 }
  private virtualPads: PadSnapshot[] = []
  private connectedPads: PadSnapshot[] = []
  private padButtons: Record<PlayerSlot, boolean[]> = { player1: [], player2: [] }
  private ready = false
  private ai: AiMemory | null = null
  private audio = new AudioEngine()
  private shell?: Shell
  private roundTime: number
  private hurtBoxes = [new THREE.Box3(), new THREE.Box3()]
  private hitBoxes = [new THREE.Box3(), new THREE.Box3()]
  private hurtHelpers: THREE.Box3Helper[]
  private hitHelpers: THREE.Box3Helper[]
  private shots: THREE.Mesh[] = []

  constructor({ roundTime, enterArena }: GameConstructor) {
    this.roundTime = roundTime
    this.enterArena = enterArena
    this.keyboard = new KeyboardTracker(window)
    this.match = this.freshMatch()
    window.addEventListener('pointerdown', (event) => {
      this.audio.unlock()
      const target = event.target
      if (target instanceof Element && target.closest('button')) {
        this.audio.play('menu')
      }
    })

    const scene = contextStore.get().scene
    this.hurtHelpers = this.hurtBoxes.map((box) => new THREE.Box3Helper(box, new THREE.Color('#5cff7a')))
    this.hitHelpers = this.hitBoxes.map((box) => new THREE.Box3Helper(box, new THREE.Color('#ff3355')))
    for (const helper of [...this.hurtHelpers, ...this.hitHelpers]) {
      helper.visible = false
      scene.add(helper)
    }
  }

  public async init() {
    this.ready = true
    const params = new URLSearchParams(window.location.search)
    if (params.get('autostart') === '1') {
      const requested = params.get('difficulty')
      const difficulty: Difficulty = requested === 'easy' || requested === 'hard' ? requested : 'normal'
      const seed = Number(params.get('seed'))
      const characters = params.get('characters')?.split(',')
      const ids: [string, string] = characters && characters.length === 2
        ? [characters[0], characters[1]]
        : ['colin', 'colin']
      await this.beginMatch({
        mode: params.get('mode') === 'ai' ? 'ai' : 'local',
        difficulty,
        seed: Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : 1,
        characters: ids,
      })
    } else {
      this.present(false, 0)
    }
    this.shell?.setReady(true)
    publishDebugApi(this.createDebugApi())
  }

  public attachShell(shell: Shell) {
    this.shell = shell
    shell.mount()
  }

  public pads(): PadSnapshot[] {
    return this.connectedPads
  }

  public async beginMatch(options: { mode: MatchMode; difficulty: Difficulty; seed?: number; characters?: [string, string] }) {
    const settings = settingsStore.get()
    const ids = options.characters ?? ['colin', 'colin']
    await this.prepareFighters(ids)
    await this.enterArena()
    const secondDevice = options.mode === 'ai'
      ? 'ai'
      : settings.players.player2.device === 'gamepad' ? 'gamepad' : 'keyboard'
    this.forced = { player1: null, player2: null }
    this.flash = { player1: 0, player2: 0 }
    this.ai = options.mode === 'ai' ? createAiMemory(options.seed ?? 1) : null
    this.match = startMatch(createMatch({
      mode: options.mode,
      difficulty: options.difficulty,
      roundTime: this.roundTime,
      names: [settings.players.player1.name, settings.players.player2.name],
      devices: [
        settings.players.player1.device === 'gamepad' ? 'gamepad' : 'keyboard',
        secondDevice,
      ],
      seed: options.seed ?? 1,
      profiles: [profileFrom(characterById(ids[0])), profileFrom(characterById(ids[1]))],
    })).state
    this.present(false, 0)
  }

  private async prepareFighters(ids: [string, string]) {
    if (!this.animations) {
      this.animations = new Animations()
    }
    if (!this.animations.animations.Idle) {
      await this.animations.loadAnimations()
    }
    if (!this.player1 || !this.player2) {
      this.player1 = new Player({ animations: this.animations.animations })
      this.player2 = new Player({ animations: this.animations.animations })
    }
    const same = this.loadedIds && this.loadedIds[0] === ids[0] && this.loadedIds[1] === ids[1]
    if (!same) {
      await Promise.all([
        this.player1.load(characterById(ids[0])),
        this.player2.load(characterById(ids[1])),
      ])
      this.loadedIds = [ids[0], ids[1]]
    }
  }

  public resume() {
    this.match = resumeMatch(this.match)
    this.present(false, 0)
  }

  public restart() {
    this.forced = { player1: null, player2: null }
    this.ai = this.match.mode === 'ai' ? createAiMemory(this.match.seed) : null
    this.match = restartMatch(this.match)
    this.present(false, 0)
  }

  public quitToMenu() {
    this.shell?.showSettings(false)
    this.forced = { player1: null, player2: null }
    this.ai = null
    this.match = menuState(this.match)
    this.present(false, 0)
  }

  public update(delta: number) {
    this.tick(Math.min(Math.max(delta, 0), 0.05))
  }

  private tick(dt: number) {
    if (!this.ready) {
      return
    }

    const status = this.match.status
    const audible = settingsStore.get()
    this.audio.setVolumes(audible.musicVolume, audible.sfxVolume)
    this.audio.setMusic(status !== 'menu')
    this.audio.update(dt)
    const simulate = status !== 'paused' && status !== 'menu' && status !== 'matchEnd'
    const intents = this.pollIntents(dt, simulate)
    if (!simulate) {
      this.present(false, 0)
      return
    }

    const result = stepMatch(this.match, intents, dt)
    this.match = result.state
    for (const event of result.events) {
      this.onEvent(event)
    }
    this.flash.player1 = Math.max(0, this.flash.player1 - dt)
    this.flash.player2 = Math.max(0, this.flash.player2 - dt)
    this.present(true, dt)
  }

  private freshMatch(): MatchState {
    const settings = settingsStore.get()
    const deviceFor = (slot: PlayerSlot): MatchState['fighters'][number]['device'] => {
      return settings.players[slot].device === 'gamepad' ? 'gamepad' : 'keyboard'
    }
    return createMatch({
      mode: 'local',
      difficulty: 'normal',
      roundTime: this.roundTime,
      names: [settings.players.player1.name, settings.players.player2.name],
      devices: [deviceFor('player1'), deviceFor('player2')],
      seed: 1,
    })
  }

  private pollIntents(dt: number, simulate: boolean): Record<FighterId, Intent> {
    const settings = settingsStore.get()
    const edges = this.keyboard.consumeEdges()
    if (edges.has(settings.menuKey)) {
      if (this.shell?.settingsOpen()) {
        this.shell.showSettings(false)
      } else {
        this.togglePause()
      }
    }

    const native = typeof navigator !== 'undefined' && navigator.getGamepads
      ? navigator.getGamepads()
      : []
    const pads = mergeGamepads(native as Array<HapticGamepad | null> | null, this.virtualPads)
    this.connectedPads = pads
    const fromDevice = {
      player1: this.intentFor('player1', settings, edges, pads, dt, simulate),
      player2: this.intentFor('player2', settings, edges, pads, dt, simulate),
    }

    return {
      player1: this.forced.player1 ?? fromDevice.player1,
      player2: this.forced.player2 ?? fromDevice.player2,
    }
  }

  private intentFor(
    slot: PlayerSlot,
    settings: ReturnType<typeof settingsStore.get>,
    edges: ReadonlySet<string>,
    pads: PadSnapshot[],
    dt: number,
    simulate: boolean,
  ): Intent {
    const fighter = this.match.fighters.find((item) => item.id === slot)
    if (fighter?.device === 'ai') {
      if (!simulate || !this.ai) {
        return { ...EMPTY_INTENT }
      }
      const enemy = this.match.fighters.find((item) => item.id !== slot) ?? fighter
      const result = stepAi(this.ai, fighter, enemy, this.match.difficulty, dt)
      this.ai = result.memory
      return result.intent
    }
    const player = settings.players[slot]
    if (player.device === 'gamepad') {
      const pad = pads.find((item) => item.index === player.gamepadIndex) ?? null
      const result = gamepadIntent(pad, player.pad, this.padButtons[slot])
      this.padButtons[slot] = result.pressed
      return result.intent
    }
    return keyboardIntent(this.keyboard.held, player.keys, edges)
  }

  private togglePause() {
    if (this.match.status === 'running' || this.match.status === 'roundEnd') {
      this.match = pauseMatch(this.match)
      return
    }
    if (this.match.status === 'paused') {
      this.match = resumeMatch(this.match)
    }
  }

  private onEvent(event: GameEvent) {
    if (event.type === 'attack') {
      this.audio.play('attack')
      return
    }
    if (event.type === 'ko') {
      this.audio.play('ko')
      return
    }
    if (event.type === 'roundStart') {
      this.audio.play('round')
      return
    }
    if (event.type === 'matchEnd') {
      this.audio.play('win')
      return
    }
    if (event.type !== 'hit') {
      return
    }
    this.audio.play(event.blocked ? 'block' : 'hit')
    this.flash[event.defender] = 0.16
    const strength = event.blocked ? 0.35 : 0.9
    this.rumble(event.defender, strength, event.blocked ? 0.2 : 0.45, event.blocked ? 70 : 150)
    this.rumble(event.attacker, 0.25, 0.12, 60)
  }

  private rumble(id: FighterId, strong: number, weak: number, duration: number) {
    const player = settingsStore.get().players[id]
    if (player.device !== 'gamepad') {
      return
    }
    const pad = this.connectedPads.find((item) => item.index === player.gamepadIndex)
    pad?.vibrate?.(strong, weak, duration)
  }

  private syncViews(animate: boolean, delta: number) {
    const players = [this.player1, this.player2]
    const showDebug = settingsStore.get().debug
    this.match.fighters.forEach((fighter, index) => {
      players[index]?.sync(fighter, this.flash[fighter.id], delta, animate)
      applyAabb(this.hurtBoxes[index], hurtbox(fighter))
      applyAabb(this.hitBoxes[index], hitbox(fighter))
      this.hurtHelpers[index].visible = showDebug
      this.hitHelpers[index].visible = showDebug && hitbox(fighter) !== null
    })
    this.syncShots()
  }

  private syncShots() {
    const live = this.match.projectiles
    const scene = contextStore.get().scene
    while (this.shots.length < live.length) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#ffb15a', emissive: '#ff6a1a', emissiveIntensity: 0.85 }),
      )
      mesh.castShadow = true
      scene.add(mesh)
      this.shots.push(mesh)
    }
    this.shots.forEach((mesh, index) => {
      const shot = live[index]
      mesh.visible = Boolean(shot)
      if (shot) {
        mesh.position.set(shot.x, shot.y, 0)
      }
    })
  }

  private present(animate: boolean, delta: number) {
    this.syncViews(animate, delta)
    this.publishDebug()
    this.shell?.render(snapshotMatch(this.match, this.ready, this.ai?.state ?? null))
  }

  private publishDebug() {
    const [first, second] = this.match.fighters
    updateDebug('Game status', this.match.status)
    updateDebug('Round', this.match.round)
    updateDebug('Round time', Math.ceil(this.match.timeLeft))
    updateDebug('Banner', this.match.banner ?? '')
    updateDebug(`${first.name} life`, first.life)
    updateDebug(`${second.name} life`, second.life)
    updateDebug(`${first.name} score`, first.score)
    updateDebug(`${second.name} score`, second.score)
  }

  private createDebugApi() {
    return {
      ready: true,
      getState: (): DebugSnapshot => snapshotMatch(this.match, this.ready, this.ai?.state ?? null),
      setIntent: (id: FighterId, intent: Intent | null) => {
        this.forced[id] = intent
      },
      stepFor: (seconds: number) => {
        const frame = 1 / 60
        let left = Math.max(0, seconds)
        while (left > 1e-6) {
          const step = Math.min(frame, left)
          this.tick(step)
          left -= step
        }
      },
      getAudio: () => this.audio.snapshot(),
      setVirtualGamepad: (pad: PadSnapshot | null) => {
        if (!pad) {
          this.virtualPads = []
          return
        }
        this.virtualPads = this.virtualPads.filter((item) => item.index !== pad.index).concat(pad)
      },
    }
  }
}

function profileFrom(def: CharacterDef): FighterProfile {
  return {
    characterId: def.id,
    maxLife: def.stats.health,
    speed: def.stats.speed,
    damageScale: def.stats.damage,
    combos: def.combos,
  }
}

function applyAabb(box: THREE.Box3, aabb: Aabb | null) {
  if (!aabb) {
    box.min.set(0, 0, 0)
    box.max.set(0, 0, 0)
    return
  }
  box.min.set(aabb.minX, aabb.minY, -0.3)
  box.max.set(aabb.maxX, aabb.maxY, 0.3)
}
