import { expect, test } from '@playwright/test'

test('keyboard bindings can be remapped, persisted, and reset', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/mobile-combat/?debug=1')
  await page.getByTestId('title-start').click()
  await expect(page.getByTestId('open-settings')).toBeVisible()
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('bind-player1-left')).toHaveText('KeyA')

  await page.getByTestId('bind-player1-left').click()
  await expect(page.getByTestId('bind-player1-left')).toHaveText('Press a key')
  await page.keyboard.press('KeyQ')
  await expect(page.getByTestId('bind-player1-left')).toHaveText('KeyQ')
  await expect.poll(async () => savedLeft(page)).toBe('KeyQ')

  await page.getByTestId('reset-bindings').evaluate((button) => {
    if (button instanceof HTMLButtonElement) {
      button.click()
    }
  })
  await expect(page.getByTestId('bind-player1-left')).toHaveText('KeyA')
  await expect.poll(async () => savedLeft(page)).toBe('KeyA')

  await page.getByTestId('bind-player1-left').click()
  await page.keyboard.press('KeyQ')
  await expect(page.getByTestId('bind-player1-left')).toHaveText('KeyQ')
  await page.getByTestId('close-settings').click()
  await page.getByTestId('main-fight').click()
  await page.getByTestId('start-match').click()
  await page.getByTestId('confirm-characters').click()
  await page.getByTestId('confirm-arena').click()
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { getState: () => { introTime: number; status: string } }
    }).__MOBILE_COMBAT__
    const state = api?.getState()
    return state?.status === 'running' && state.introTime === 0
  })

  const start = await page.evaluate(() => {
    return (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { fighters: Array<{ x: number }> } }
    }).__MOBILE_COMBAT__.getState().fighters[0].x
  })
  await page.keyboard.down('KeyQ')
  await page.waitForFunction((origin) => {
    const x = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { fighters: Array<{ x: number }> } }
    }).__MOBILE_COMBAT__.getState().fighters[0].x
    return x < origin - 0.35
  }, start)
  await page.keyboard.up('KeyQ')

  const parked = await page.evaluate(() => {
    return (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { fighters: Array<{ x: number }> } }
    }).__MOBILE_COMBAT__.getState().fighters[0].x
  })
  await page.keyboard.down('KeyA')
  await page.waitForTimeout(350)
  await page.keyboard.up('KeyA')
  const afterOldKey = await page.evaluate(() => {
    return (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { fighters: Array<{ x: number }> } }
    }).__MOBILE_COMBAT__.getState().fighters[0].x
  })
  expect(Math.abs(afterOldKey - parked)).toBeLessThan(0.25)

  await page.reload({ waitUntil: 'commit' })
  await expect.poll(async () => savedLeft(page)).toBe('KeyQ')
})

function savedLeft(page: import('@playwright/test').Page): Promise<string | undefined> {
  return page.evaluate(() => {
    return JSON.parse(localStorage.getItem('settings') || '{}').players?.player1?.keys?.left
  })
}
