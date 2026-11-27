import { expect, test } from '@playwright/test'

test('keyboard bindings can be remapped, persisted, and reset', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/mobile-combat/?debug=1')
  await expect(page.getByTestId('start-match')).toBeEnabled()
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('bind-player1-left')).toHaveText('KeyA')

  await page.getByTestId('bind-player1-left').click()
  await expect(page.getByTestId('bind-player1-left')).toHaveText('Press a key')
  await page.keyboard.press('KeyQ')
  await expect(page.getByTestId('bind-player1-left')).toHaveText('KeyQ')
  await expect.poll(async () => page.evaluate(() => {
    return JSON.parse(localStorage.getItem('settings') || '{}').players?.player1?.keys?.left
  })).toBe('KeyQ')
  await page.getByTestId('close-settings').click()
  await page.getByTestId('start-match').click()
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

  await page.keyboard.press('Escape')
  await page.getByTestId('pause-settings').click()
  await page.getByTestId('reset-bindings').click()
  await expect(page.getByTestId('bind-player1-left')).toHaveText('KeyA')
  await page.reload({ waitUntil: 'commit' })
  await expect.poll(async () => page.evaluate(() => {
    return JSON.parse(localStorage.getItem('settings') || '{}').players?.player1?.keys?.left
  })).toBe('KeyA')
})
