import * as THREE from 'three'
import type { HeroName } from '@src/hero'
import type Hero from '@src/hero'
import { getHeroClassByName } from '@src/utils'
import { ErrorUndefinedProperty } from '@src/errors'
import { contextStore } from '@stores/context'
import type { FighterState } from '@src/sim/types'

const PUNCH_CLIPS = new Set(['PunchUp', 'PunchDown'])

function clipFor(state: FighterState): string {
  if (state.action === 'attackUp') {
    return 'PunchUp'
  }
  if (state.action === 'attackDown') {
    return 'PunchDown'
  }
  if (state.action === 'walk') {
    if (Math.sign(state.vx) === state.facing) {
      return 'WalkForward'
    }
    if (Math.sign(state.vx) === -state.facing) {
      return 'WalkBackward'
    }
  }
  return 'Idle'
}

interface PlayerConstructor {
  heroName: HeroName
  animations: Record<string, THREE.AnimationClip>
  playerName: string
}

export default class Player {
  private _hero?: Hero
  public get hero() {
    if (!this._hero) {
      throw new ErrorUndefinedProperty('hero')
    }
    return this._hero
  }

  private _ready = false
  public get ready() {
    return this._ready
  }

  readonly playerName: string
  private scene = contextStore.get().scene
  private animations: Record<string, THREE.AnimationClip>
  private heroName: HeroName
  private animationMixer?: THREE.AnimationMixer
  private clips: Record<string, THREE.AnimationAction> = {}
  private currentAnimation = 'Idle'
  private emissive = new Map<THREE.Material, { color: THREE.Color; intensity: number }>()

  constructor({ heroName, animations, playerName }: PlayerConstructor) {
    this.heroName = heroName
    this.animations = animations
    this.playerName = playerName
  }

  public async loadData() {
    const heroClass = getHeroClassByName(this.heroName)
    this._hero = new heroClass({})
    const heroMesh = await this.hero.loadMesh()
    this.scene.add(heroMesh.scene)
    this.rememberMaterials(heroMesh.scene)

    this.animationMixer = new THREE.AnimationMixer(heroMesh.scene)
    for (const [name, clip] of Object.entries(this.animations)) {
      const action = this.animationMixer.clipAction(clip)
      if (PUNCH_CLIPS.has(name)) {
        action.clampWhenFinished = true
        action.setLoop(THREE.LoopOnce, 1)
      }
      this.clips[name] = action
    }

    this.clips['WalkForward'].timeScale = 1.5
    this.clips['WalkBackward'].timeScale = 1.1
    this.clips['PunchUp'].timeScale = 1.35
    this.clips['PunchDown'].timeScale = 1.25
    this.clips[this.currentAnimation].play()
    this._ready = true
  }

  public sync(state: FighterState, flash: number, delta: number, animate: boolean) {
    if (!this.ready || !this.hero.ready) {
      return
    }

    const actor = this.hero.actor
    actor.position.x = state.x
    actor.position.y = state.y
    actor.rotation.y = state.facing === 1 ? Math.PI / 2 : -Math.PI / 2
    const fall = state.action === 'ko' ? Math.min(1, state.actionTime / 0.45) : 0
    actor.rotation.z = -state.facing * fall * (Math.PI / 2.4)
    this.tint(flash, state.blocking)

    const next = clipFor(state)
    const restart = PUNCH_CLIPS.has(next) && state.actionTime < 0.05
    this.playClip(next, restart)

    if (animate && this.animationMixer) {
      this.animationMixer.update(delta)
    }
  }

  private rememberMaterials(root: THREE.Object3D) {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return
      }
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        const standard = material as THREE.MeshStandardMaterial
        if (!standard.emissive) {
          continue
        }
        this.emissive.set(material, {
          color: standard.emissive.clone(),
          intensity: standard.emissiveIntensity ?? 1,
        })
      }
    })
  }

  private tint(flash: number, blocking: boolean) {
    for (const [material, original] of this.emissive) {
      const standard = material as THREE.MeshStandardMaterial
      if (flash > 0) {
        standard.emissive.setHex(0xff2a1a)
        standard.emissiveIntensity = 0.85
      } else if (blocking) {
        standard.emissive.setHex(0x2a4cff)
        standard.emissiveIntensity = 0.45
      } else {
        standard.emissive.copy(original.color)
        standard.emissiveIntensity = original.intensity
      }
    }
  }

  private playClip(name: string, restart: boolean) {
    const next = this.clips[name]
    if (!next) {
      return
    }

    if (restart && name === this.currentAnimation) {
      next.reset()
      next.play()
      return
    }

    if (name === this.currentAnimation) {
      return
    }

    const previous = this.clips[this.currentAnimation]
    if (previous) {
      previous.fadeOut(0.1)
    }
    next.reset()
    next.fadeIn(0.1)
    next.play()
    this.currentAnimation = name
  }
}
