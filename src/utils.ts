import type { HeroName } from '@src/hero'
import MrColinCole from '@heroes/MrColinCole'

export function getHeroClassByName(heroName: HeroName) {
  switch (heroName) {
    case 'Mr Colin Cole':
      return MrColinCole
    default:
      throw new Error(`Unable to find hero "${heroName}"`)
  }
}
