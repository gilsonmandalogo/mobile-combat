import * as THREE from 'three'
import Level, { LevelName } from '@src/level'
import { contextStore } from '@stores/context'
import FireParticleSystem from '@particles/fire'

export default class MayanTempleLevel extends Level {
  protected levelName = 'Mayan-Temple' as LevelName
  private scene = contextStore.get().scene
  private particles: Array<FireParticleSystem> = []

  public async loadLevel() {
    const model = await super.loadLevel()
    let camera: THREE.PerspectiveCamera | null = null
    const fireLocations: Array<THREE.Object3D> = []

    model.scene.traverse(child => {
      if (child instanceof THREE.Mesh && child.isMesh) {
        child.receiveShadow = true
        child.castShadow = true
      }

      if (child instanceof THREE.PointLight && child.isLight) {
        child.castShadow = true

        if (child.userData.sunLight) {
          child.shadow.bias = -0.01
          child.shadow.mapSize.set(4096, 4096)
          child.shadow.radius = 4
          child.shadow.camera.near = 75
          child.shadow.camera.far = 95
        }

        if (child.userData.fireLight) {
          child.power = 22
          child.shadow.bias = -0.01
          child.shadow.radius = 2
          child.shadow.mapSize.set(1024, 1024)
          child.shadow.camera.far = 15
        }
      }

      if (child instanceof THREE.PerspectiveCamera && child.isPerspectiveCamera) {
        camera = child
      }

      if (child.userData.fireParticle) {
        fireLocations.push(child)
      }
    })

    if (!camera) {
      throw new Error(`Cannot find a PerspectiveCamera for the level ${this.levelName}.`)
    }

    for (const fireLocation of fireLocations) {
      const parent = new THREE.Object3D()
      this.scene.add(parent)
      fireLocation.getWorldPosition(parent.position)
      this.particles.push(new FireParticleSystem({
        parent,
        camera,
      }))
    }

    return model
  }

  public update(delta: number) {
    for (const particle of this.particles) {
      particle.update(delta)
    }
  }
}
