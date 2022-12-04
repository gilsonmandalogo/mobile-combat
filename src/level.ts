import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

export const allLevels = ['Mayan-Temple'] as const
export type LevelName = typeof allLevels[number]

export default abstract class Level {
  protected abstract levelName: LevelName

  public async loadLevel() {
    const loader = new GLTFLoader()
    const model = await loader.loadAsync(`assets/models/${this.levelName}.glb`)
    return model
  }

  public abstract update(delta: number): void
}
