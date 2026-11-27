import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import type { ArenaDef } from '@src/content/schema'
import FireParticleSystem from '@particles/fire'
import { assetUrl } from '@src/utils'

export interface ArenaView {
  camera: THREE.PerspectiveCamera | null
  update(dt: number): void
  dispose(): void
}

export async function mountArena(def: ArenaDef, scene: THREE.Scene): Promise<ArenaView> {
  scene.background = new THREE.Color(def.environment.background)
  scene.fog = def.environment.kind === 'primitive'
    ? new THREE.Fog(def.environment.fog, 9, 24)
    : null
  if (def.environment.kind === 'primitive') {
    return mountPrimitive(def, scene)
  }
  return mountGlb(def, scene)
}

function mountPrimitive(def: ArenaDef, scene: THREE.Scene): ArenaView {
  const env = def.environment
  if (env.kind !== 'primitive') {
    throw new Error('Expected a procedural arena')
  }
  const root = new THREE.Group()
  const width = def.bounds.maxX - def.bounds.minX + 4
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: env.floor, roughness: 0.84 }),
  )
  floor.position.y = -0.25
  floor.receiveShadow = true
  const ambient = new THREE.AmbientLight(env.ambient, env.ambientIntensity)
  const sun = new THREE.DirectionalLight(env.sun.color, env.sun.intensity)
  sun.position.set(env.sun.position[0], env.sun.position[1], env.sun.position[2])
  sun.castShadow = true
  const markers = [marker(env.accent, def.bounds.minX + 0.6), marker(env.accent, def.bounds.maxX - 0.6)]
  root.add(floor, ambient, sun, ...markers)
  scene.add(root)
  let pulse = 0
  return {
    camera: null,
    update(dt: number) {
      pulse += dt
      const glow = 0.22 + Math.sin(pulse * 2.2) * 0.14
      for (const mesh of markers) {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.emissiveIntensity = glow
        }
      }
    },
    dispose() {
      scene.remove(root)
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })
    },
  }
}

function marker(color: string, x: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 2.8, 0.42),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
  )
  mesh.position.set(x, 1.4, -2.4)
  mesh.castShadow = true
  return mesh
}

async function mountGlb(def: ArenaDef, scene: THREE.Scene): Promise<ArenaView> {
  const env = def.environment
  if (env.kind !== 'glb') {
    throw new Error('Expected a model arena')
  }
  const model = await new GLTFLoader().loadAsync(assetUrl(env.file))
  scene.add(model.scene)
  let camera: THREE.PerspectiveCamera | null = null
  const fires: FireParticleSystem[] = []
  const anchors: THREE.Object3D[] = []
  const spots: THREE.Object3D[] = []
  model.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
    if (child instanceof THREE.PerspectiveCamera) {
      camera = child
    }
    if (child.userData.fireParticle) {
      spots.push(child)
    }
  })
  if (camera) {
    for (const spot of spots) {
      const anchor = new THREE.Object3D()
      scene.add(anchor)
      spot.getWorldPosition(anchor.position)
      anchors.push(anchor)
      fires.push(new FireParticleSystem({ parent: anchor, camera }))
    }
  }
  return {
    camera,
    update(dt: number) {
      for (const fire of fires) {
        fire.update(dt)
      }
    },
    dispose() {
      scene.remove(model.scene)
      for (const anchor of anchors) {
        scene.remove(anchor)
      }
      for (const fire of fires) {
        fire.dispose()
      }
    },
  }
}
