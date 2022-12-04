import type { HeroName } from '@src/hero'
import MrColinCole from '@heroes/MrColinCole'
import type { LevelName } from '@src/level'
import MayanTempleLevel from '@levels/mayanTemple'

export function getHeroClassByName(heroName: HeroName) {
  switch (heroName) {
  case 'Mr Colin Cole':
    return MrColinCole
  default:
    throw new Error(`Unable to find hero "${heroName}"`)
  }
}

export function getLevelClassByName(levelName: LevelName) {
  switch (levelName) {
  case 'Mayan-Temple':
    return MayanTempleLevel
  default:
    throw new Error(`Unable to find level "${levelName}"`)
  }
}
