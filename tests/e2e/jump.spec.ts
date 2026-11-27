import { expect, test } from '@playwright/test'

test('a forward jump punches once in the air and lands', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { ready: boolean; getState: () => { introTime: number } }
    }).__MOBILE_COMBAT__
    return api?.ready === true && api.getState().introTime === 0
  })

  const result = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setIntent: (id: string, intent: {
          move: number
          jump: boolean
          attackUp: boolean
          attackDown: boolean
          block: boolean
          crouch: boolean
        }) => void
        stepFor: (seconds: number) => void
        getState: () => {
          fighters: Array<{ x: number; y: number; facing: number; action: string; pose: string; life: number; airAttack?: boolean }>
        }
      }
    }).__MOBILE_COMBAT__
    const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false, crouch: false }
    api.setIntent('player1', { ...idle, move: 1 })
    api.setIntent('player2', { ...idle, move: -1 })
    api.stepFor(0.9)
    api.setIntent('player1', { ...idle, jump: true, move: 1 })
    api.setIntent('player2', idle)
    api.stepFor(1 / 60)
    const started = api.getState().fighters[0]
    api.setIntent('player1', idle)
    api.stepFor(0.2)
    const airborne = api.getState().fighters[0]
    api.setIntent('player1', { ...idle, attackUp: true })
    api.stepFor(0.05)
    const swinging = api.getState().fighters[0]
    api.setIntent('player1', idle)
    api.stepFor(1.3)
    const landed = api.getState()
    return {
      started: { action: started.action, pose: started.pose, y: started.y },
      airborne: { y: airborne.y, pose: airborne.pose },
      swinging: { action: swinging.action, pose: swinging.pose },
      landed: {
        y: landed.fighters[0].y,
        x: landed.fighters[0].x,
        facing: landed.fighters[0].facing,
        otherX: landed.fighters[1].x,
        life: landed.fighters[1].life,
      },
    }
  })

  expect(result.started.action).toBe('prejump')
  expect(result.started.pose).toBe('jumpStart')
  expect(result.started.y).toBe(0)
  expect(result.airborne.y).toBeGreaterThan(0.4)
  expect(['jumpAscend', 'jumpPeak', 'jumpAttack']).toContain(result.airborne.pose)
  expect(result.swinging.action).toBe('jumpPunch')
  expect(result.swinging.pose).toBe('jumpAttack')
  expect(result.landed.y).toBe(0)
  expect(result.landed.life).toBeLessThan(100)
})

test('a forward jump lands on the far side and turns around', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { ready: boolean; getState: () => { introTime: number } }
    }).__MOBILE_COMBAT__
    return api?.ready === true && api.getState().introTime === 0
  })

  const landed = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setIntent: (id: string, intent: {
          move: number
          jump: boolean
          attackUp: boolean
          attackDown: boolean
          block: boolean
          crouch: boolean
        }) => void
        stepFor: (seconds: number) => void
        getState: () => {
          fighters: Array<{ x: number; y: number; facing: number; action: string; pose: string }>
        }
      }
    }).__MOBILE_COMBAT__
    const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false, crouch: false }
    api.setIntent('player1', { ...idle, move: 1 })
    api.setIntent('player2', { ...idle, move: -1 })
    api.stepFor(0.9)
    const before = api.getState().fighters
    api.setIntent('player1', { ...idle, jump: true, move: 1 })
    api.setIntent('player2', idle)
    api.stepFor(1 / 60)
    api.setIntent('player1', idle)
    api.stepFor(1.25)
    const after = api.getState().fighters[0]
    return {
      beforeX: before[0].x,
      otherX: before[1].x,
      y: after.y,
      x: after.x,
      facing: after.facing,
      pose: after.pose,
      action: after.action,
    }
  })

  expect(landed.beforeX).toBeLessThan(landed.otherX)
  expect(landed.y).toBe(0)
  expect(landed.x).toBeGreaterThan(landed.otherX)
  expect(landed.facing).toBe(-1)
  expect(['jumpLand', 'idle']).toContain(landed.pose)
})
