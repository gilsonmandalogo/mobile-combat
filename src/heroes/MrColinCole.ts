import Hero, { HeroName } from '@src/hero'
import type { HeroConstructor } from '@src/hero'

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
    mesh.scene.scale.set(1.5, 1.5, 1.5)
    this._ready = true
    return mesh
  }
}
