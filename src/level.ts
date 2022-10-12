import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

type LevelName = 'Mayan-Temple'

export default class Level {
  public async loadLevel(name: LevelName) {
    const loader = new GLTFLoader()
    const model = await loader.loadAsync(`assets/models/${name}.glb`)
    model.scene.traverse(child => {
      if (child instanceof THREE.Mesh && child.isMesh) {
        child.receiveShadow = true
        child.castShadow = true
      }
      
      if (child instanceof THREE.Light && child.isLight) {
        child.castShadow = true
        child.shadow.bias = -0.001
      }
    })
    return model
  }
}
