import { describe, expect, it } from 'vitest'
import { ATTACKS, CROUCH_HURT_HEIGHT, GRAVITY, JUMP_SPEED } from '@src/sim/constants'
import { attackPhase, hitbox, hurtbox, overlaps } from '@src/sim/hitboxes'
import { createFighter } from '@src/sim/match'

describe('hitboxes', () => {
  it('treats touching boxes as overlaps and separated boxes as misses', () => {
    expect(overlaps(
      { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      { minX: 1, maxX: 2, minY: 0, maxY: 1 },
    )).toBe(true)
    expect(overlaps(
      { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      { minX: 1.01, maxX: 2, minY: 0, maxY: 1 },
    )).toBe(false)
  })

  it('keeps the hurtbox on the body and hides the hitbox until active frames', () => {
    const fighter = createFighter('player1', 'Red', 0, 1, 'keyboard')
    fighter.action = 'attackUp'
    fighter.actionTime = ATTACKS.attackUp.startup - 0.01
    expect(hitbox(fighter)).toBeNull()
    expect(attackPhase(fighter)).toBe('startup')

    fighter.actionTime = ATTACKS.attackUp.startup + 0.01
    const box = hitbox(fighter)
    const body = hurtbox(fighter)
    expect(box).not.toBeNull()
    expect(box!.minX).toBeGreaterThan(fighter.x)
    expect(body.maxY - body.minY).toBeGreaterThan(1)
  })

  it('puts a low punch under a high punch', () => {
    const high = createFighter('player1', 'Red', 0, 1, 'keyboard')
    const low = createFighter('player2', 'Blue', 0, 1, 'keyboard')
    high.action = 'attackUp'
    low.action = 'attackDown'
    high.actionTime = ATTACKS.attackUp.startup + 0.01
    low.actionTime = ATTACKS.attackDown.startup + 0.01
    expect(hitbox(high)!.minY).toBeGreaterThan(hitbox(low)!.maxY - 0.2)
  })

  it('reaches a crouching body from the top of a jump', () => {
    const apex = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)
    const attacker = createFighter('player1', 'Red', 0, 1, 'keyboard')
    attacker.action = 'jumpPunch'
    attacker.y = apex
    attacker.actionTime = attacker.attacks.jumpPunch.startup + 0.01
    const croucher = createFighter('player2', 'Blue', attacker.attacks.jumpPunch.reach, -1, 'keyboard')
    croucher.crouching = true
    croucher.action = 'crouch'
    const box = hitbox(attacker)
    expect(box).not.toBeNull()
    expect(box!.minY).toBeLessThanOrEqual(CROUCH_HURT_HEIGHT * 0.5)
    expect(overlaps(box!, hurtbox(croucher))).toBe(true)

    const far = { ...croucher, x: 4 }
    expect(overlaps(box!, hurtbox(far))).toBe(false)
  })
})
