import { expect, test } from '@playwright/test'

test('loads the arena and runs the round clock', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__
    return api?.ready === true
  })

  await expect(page.getByTestId('game-canvas')).toBeVisible()

  const read = () => page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { timeLeft: number; life: { player1: number; player2: number } } }
    }).__MOBILE_COMBAT__
    return api.getState()
  })

  const before = await read()
  await page.waitForFunction((start) => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { timeLeft: number } }
    }).__MOBILE_COMBAT__
    return api.getState().timeLeft < start
  }, before.timeLeft)
  const after = await read()

  expect(after.timeLeft).toBeLessThan(before.timeLeft)
  expect(after.life).toEqual({ player1: 100, player2: 100 })
})
