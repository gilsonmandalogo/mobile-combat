import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import type { CharacterDef } from '@src/content/schema'
import { assetUrl } from '@src/utils'

export async function loadCharacterModel(def: CharacterDef): Promise<THREE.Group> {
  if (def.model.kind === 'primitive') {
    return primitiveFighter(def.model.color, def.model.scale)
  }

  const loader = new GLTFLoader()
  const model = await loader.loadAsync(assetUrl(def.model.file))
  model.scene.scale.setScalar(def.model.scale)
  model.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  return model.scene
}

function primitiveFighter(color: string, scale: number): THREE.Group {
  const group = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.08,
    emissive: new THREE.Color('#000000'),
  })
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.46), material)
  torso.position.y = 1.15
  torso.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), material.clone())
  head.position.y = 1.86
  head.castShadow = true
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.22), material.clone())
  arm.position.set(0.48, 1.2, 0)
  arm.castShadow = true
  const otherArm = arm.clone()
  otherArm.position.x = -0.48
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.24), material.clone())
  leg.position.set(-0.16, 0.36, 0)
  leg.castShadow = true
  const otherLeg = leg.clone()
  otherLeg.position.x = 0.16
  group.add(torso, head, arm, otherArm, leg, otherLeg)
  group.scale.setScalar(scale)
  return group
}
