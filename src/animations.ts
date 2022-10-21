import type * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

const ANIMATION_FILES = ['Idle', 'WalkForward', 'WalkBackward', 'PunchUp', 'PunchDown']

export default class Animations {
  private _animations: Record<string, THREE.AnimationClip> = {}
  public get animations(): Record<string, THREE.AnimationClip> {
    return this._animations
  }

  public async loadAnimations() {
    const loader = new GLTFLoader()

    for (const file of ANIMATION_FILES) {
      const gltf = await loader.loadAsync(`assets/animations/${file}.glb`)
      this._animations = {
        ...this._animations,
        [file]: gltf.animations[0],
      }
    }
  }
}
