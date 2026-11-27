import { expect, test } from '@playwright/test'

test('crouch lowers the guard, and only a crouch block stops a low sweep', async ({ page }) => {
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
          callout: string | null
          fighters: Array<{ action: string; crouching: boolean; life: number; blocking: boolean }>
        }
      }
    }).__MOBILE_COMBAT__
    const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false, crouch: false }
    api.setIntent('player1', { ...idle, crouch: true })
    api.setIntent('player2', idle)
    api.stepFor(0.2)
    const pose = api.getState().fighters[0]

    api.setIntent('player1', { ...idle, move: 1 })
    api.setIntent('player2', { ...idle, move: -1 })
    api.stepFor(2.2)
    const beforeStand = api.getState().fighters[1].life
    api.setIntent('player1', { ...idle, attackDown: true })
    api.setIntent('player2', { ...idle, block: true })
    api.stepFor(0.45)
    const afterStand = api.getState().fighters[1]

    api.setIntent('player1', { ...idle, move: 1 })
    api.setIntent('player2', { ...idle, move: -1 })
    api.stepFor(1.2)
    const beforeDuck = api.getState().fighters[1].life
    api.setIntent('player1', { ...idle, crouch: true, attackDown: true })
    api.setIntent('player2', { ...idle, crouch: true, block: true })
    api.stepFor(0.5)
    const after = api.getState()
    return {
      pose,
      standDamage: beforeStand - afterStand.life,
      duckDamage: beforeDuck - after.fighters[1].life,
      ducked: after.fighters[1],
      callout: after.callout,
    }
  })

  expect(result.pose.action).toBe('crouch')
  expect(result.pose.crouching).toBe(true)
  expect(result.standDamage).toBeGreaterThan(result.duckDamage)
  expect(result.ducked.crouching).toBe(true)
  expect(result.callout).toBe('BLOCK')

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('move-list')).toContainText('Low sweep — Crouch + Kick')
  await expect(page.getByTestId('move-list')).toContainText('Crouch — hold Down')
})
