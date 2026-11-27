import { expect, test } from '@playwright/test'

test('pause freezes the round, restart clears it, and quit returns to the menu', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__
    return api?.ready === true
  })
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { introTime: number; timeLeft: number } }
    }).__MOBILE_COMBAT__
    const state = api.getState()
    return state.introTime === 0 && state.timeLeft < 60
  })

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause-menu')).toBeVisible()
  const frozenAt = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { timeLeft: number; status: string } }
    }).__MOBILE_COMBAT__
    return api.getState()
  })
  expect(frozenAt.status).toBe('paused')
  await page.waitForTimeout(1200)
  const frozen = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { timeLeft: number } }
    }).__MOBILE_COMBAT__
    return api.getState().timeLeft
  })
  expect(frozen).toBe(frozenAt.timeLeft)

  await page.getByTestId('pause-settings').click()
  await expect(page.getByTestId('settings-panel')).toBeVisible()
  await expect(page.getByTestId('pause-menu')).toBeHidden()
  await page.getByTestId('close-settings').click()
  await expect(page.getByTestId('pause-menu')).toBeVisible()

  await page.getByTestId('resume').click()
  await expect(page.getByTestId('pause-menu')).toBeHidden()
  await page.waitForFunction((start) => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { timeLeft: number } }
    }).__MOBILE_COMBAT__
    return api.getState().timeLeft < start
  }, frozenAt.timeLeft)

  await page.keyboard.press('Escape')
  await page.getByTestId('restart').click()
  const restarted = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { status: string; round: number; life: { player1: number }; score: { player1: number } } }
    }).__MOBILE_COMBAT__
    return api.getState()
  })
  expect(restarted.status).toBe('running')
  expect(restarted.round).toBe(1)
  expect(restarted.life.player1).toBe(100)
  expect(restarted.score.player1).toBe(0)

  await page.keyboard.press('Escape')
  await page.getByTestId('quit').click()
  await expect(page.getByTestId('main-menu')).toBeVisible()
  const menu = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { status: string } }
    }).__MOBILE_COMBAT__
    return api.getState().status
  })
  expect(menu).toBe('menu')
})
