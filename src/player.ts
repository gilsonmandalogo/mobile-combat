import * as THREE from 'three'
import type { CharacterDef } from '@src/content/schema'
import { contextStore } from '@stores/context'
import { loadCharacterModel } from '@src/view/model'
import { fighterPose } from '@src/sim/pose'
import type { FighterState } from '@src/sim/types'

interface PlayerConstructor {
  animations: Record<string, THREE.AnimationClip>
}

export default class Player {
  private ready = false
  private scene = contextStore.get().scene
  private animations: Record<string, THREE.AnimationClip>
  private definition?: CharacterDef
  private actor?: THREE.Group
  private primitive = false
  private animationMixer?: THREE.AnimationMixer
  private clips: Record<string, THREE.AnimationAction> = {}
  private currentAnimation = ''
  private emissive = new Map<THREE.Material, { color: THREE.Color; intensity: number }>()

  constructor({ animations }: PlayerConstructor) {
    this.animations = animations
  }

  public async load(def: CharacterDef) {
    this.dispose()
    this.definition = def
    this.primitive = def.model.kind === 'primitive'
    this.actor = await loadCharacterModel(def)
    this.scene.add(this.actor)
    this.rememberMaterials(this.actor)
    this.animationMixer = new THREE.AnimationMixer(this.actor)
    if (!this.primitive) {
      for (const clipName of new Set(Object.values(def.animations))) {
        const clip = this.animations[clipName]
        if (!clip) {
          continue
        }
        const action = this.animationMixer.clipAction(clip)
        if (clipName.startsWith('Punch')) {
          action.clampWhenFinished = true
          action.setLoop(THREE.LoopOnce, 1)
        }
        this.clips[clipName] = action
      }
      const idle = def.animations.idle
      this.currentAnimation = idle
      this.clips[idle]?.play()
    }
    this.ready = true
  }

  public dispose() {
    if (this.actor) {
      this.scene.remove(this.actor)
      this.actor = undefined
    }
    this.animationMixer?.stopAllAction()
    this.clips = {}
    this.emissive.clear()
    this.ready = false
  }

  public sync(state: FighterState, flash: number, delta: number, animate: boolean) {
    if (!this.ready || !this.actor || !this.definition) {
      return
    }

    this.actor.position.x = state.x
    this.actor.position.y = state.y
    this.actor.rotation.y = state.facing === 1 ? Math.PI / 2 : -Math.PI / 2
    const fall = state.action === 'ko' ? Math.min(1, state.actionTime / 0.45) : 0
    let lean = -state.facing * fall * (Math.PI / 2.4)
    this.actor.rotation.x = 0
    this.actor.scale.y = this.actor.scale.x
    const crouching = state.crouching || state.action === 'crouch' || state.action === 'crouchPunch' || state.action === 'crouchKick'
    if (crouching) {
      this.actor.scale.y = this.actor.scale.x * 0.62
      lean += -state.facing * 0.55
    }
    const pose = fighterPose(state)
    if (pose === 'jumpStart') {
      this.actor.scale.y = this.actor.scale.x * 0.86
    } else if (pose === 'jumpLand') {
      this.actor.scale.y = this.actor.scale.x * 0.76
    } else if (pose === 'jumpAttack' || pose === 'juggle') {
      lean += -state.facing * 0.4
    }
    const guarding = state.action === 'block' || state.blocking
    if (guarding) {
      lean += -state.facing * 0.5
      this.actor.position.y -= 0.1
    }
    if (this.primitive && (state.action === 'attackUp' || state.action === 'attackDown' || state.action === 'special')) {
      lean += -state.facing * 0.35
      this.actor.position.y += Math.sin(Math.min(1, state.actionTime) * Math.PI) * 0.08
    }
    if (this.primitive && state.action === 'walk') {
      this.actor.position.y += Math.abs(Math.sin(state.actionTime * 8)) * 0.05
    }
    this.actor.rotation.z = lean
    this.tint(flash, state.blocking)

    if (!this.primitive) {
      const next = this.clipName(state)
      const restart = next.startsWith('Punch') && state.actionTime < 0.05
      this.playClip(next, restart)
      if (animate && this.animationMixer) {
        this.animationMixer.update(delta)
      }
    }
  }

  private clipName(state: FighterState): string {
    const map = this.definition?.animations
    if (!map) {
      return 'Idle'
    }
    if (state.action === 'attackUp' || state.action === 'jumpPunch' || state.action === 'special') {
      return map.punchUp
    }
    if (state.action === 'attackDown' || state.action === 'crouchPunch' || state.action === 'crouchKick' || state.action === 'jumpKick') {
      return map.punchDown
    }
    if (state.action === 'walk') {
      if (Math.sign(state.vx) === state.facing) {
        return map.walkForward
      }
      if (Math.sign(state.vx) === -state.facing) {
        return map.walkBackward
      }
    }
    return map.idle
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
      if (flash > 0 && blocking) {
        standard.emissive.setHex(0x9fd0ff)
        standard.emissiveIntensity = 0.95
      } else if (flash > 0) {
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
