import type { FighterState } from '@src/sim/types'

/** Hooks the view can map onto clips. The names stay stable for later animation work. */
export type FighterPose =
  | 'idle'
  | 'walk'
  | 'crouch'
  | 'block'
  | 'hit'
  | 'ko'
  | 'attack'
  | 'jumpStart'
  | 'jumpAscend'
  | 'jumpPeak'
  | 'jumpDescend'
  | 'jumpLand'
  | 'jumpAttack'
  | 'juggle'
  | 'super'

export function fighterPose(fighter: FighterState): FighterPose {
  if (fighter.action === 'ko') {
    return 'ko'
  }
  if (fighter.action === 'juggle') {
    return 'juggle'
  }
  if (fighter.action === 'super') {
    return 'super'
  }
  if (fighter.action === 'jumpPunch' || fighter.action === 'jumpKick') {
    return 'jumpAttack'
  }
  if (fighter.action === 'prejump') {
    return 'jumpStart'
  }
  if (fighter.action === 'land' || fighter.action === 'knockdown') {
    return 'jumpLand'
  }
  if (fighter.action === 'jump' || fighter.y > 0.05) {
    if (fighter.vy > 0.8) {
      return 'jumpAscend'
    }
    if (fighter.vy < -0.8) {
      return 'jumpDescend'
    }
    return 'jumpPeak'
  }
  if (fighter.crouching || fighter.action === 'crouch' || fighter.action === 'crouchPunch' || fighter.action === 'crouchKick') {
    return 'crouch'
  }
  if (fighter.blocking || fighter.action === 'block') {
    return 'block'
  }
  if (fighter.action === 'hitstun') {
    return 'hit'
  }
  if (fighter.action === 'attackUp' || fighter.action === 'attackDown' || fighter.action === 'special') {
    return 'attack'
  }
  if (fighter.action === 'walk') {
    return 'walk'
  }
  return 'idle'
}
