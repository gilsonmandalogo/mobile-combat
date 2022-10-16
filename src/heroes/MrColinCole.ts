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
}
