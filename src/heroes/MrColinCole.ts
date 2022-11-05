import * as THREE from 'three'
import Hero, { HeroName } from '@src/hero'
import type { HeroConstructor } from '@src/hero'
import { settingsStore } from '@src/stores/settings'

type MrColinColeConstructor = Omit<HeroConstructor, 'name'>

export default class MrColinCole extends Hero {
  constructor(props: MrColinColeConstructor) {
    super({
      ...props,
      name: HeroName.MrColinCole,
    })
  }

  public async loadMesh() {
    const mesh = await super.loadMesh()
    mesh.scene.scale.set(1.5,1.5,1.5)

    const headBone = mesh.scene.getObjectByName('mixamorigHead') as THREE.Bone

    const headCollider = new THREE.Mesh(
      new THREE.BoxGeometry(25, 25, 25),
      new THREE.MeshBasicMaterial({ color: 'yellow', wireframe: true }),
    )
    headCollider.position.z += 5
    headCollider.position.y += 3
    headBone.add(headCollider)

    const handsCollider = new THREE.Mesh(
      new THREE.BoxGeometry(17, 25, 12),
      new THREE.MeshBasicMaterial({ color: 'green', wireframe: true }),
    )
    handsCollider.position.y += 12

    const leftHandBone = mesh.scene.getObjectByName('mixamorigLeftHand') as THREE.Bone
    const leftHandCollider = handsCollider.clone()
    this._atttackMembersColliders.push(leftHandCollider)
    leftHandBone.add(leftHandCollider)

    const rightHandBone = mesh.scene.getObjectByName('mixamorigRightHand') as THREE.Bone
    const rightHandCollider = handsCollider.clone()
    this._atttackMembersColliders.push(rightHandCollider)
    rightHandBone.add(rightHandCollider)

    settingsStore.subscribe(({ debug }) => {
      headCollider.visible = debug
      leftHandBone.visible = debug
      rightHandBone.visible = debug
    })

    this._ready = true

    return mesh
  }
}
