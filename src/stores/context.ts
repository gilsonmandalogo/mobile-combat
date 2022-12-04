import type * as THREE from 'three'
import { map } from 'nanostores'

interface ContextValues {
  canvas: HTMLCanvasElement
  scene: THREE.Scene
}

export const contextStore = map<ContextValues>()
