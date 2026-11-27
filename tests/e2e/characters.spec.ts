import { expect, test } from '@playwright/test'

test('players pick distinct characters with the keyboard and a gamepad', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1')
  await expect(page.getByTestId('start-match')).toBeEnabled()
  await page.getByTestId('start-match').click()
  await expect(page.getByTestId('character-select')).toBeVisible()
  await expect(page.getByTestId('character-card-colin-player1')).toBeVisible()
  await expect(page.getByTestId('character-card-maria-player2')).toBeVisible()
  await expect(page.getByTestId('character-card-brute-player1')).toBeVisible()

  await expect(page.getByTestId('pick-name-player1')).toHaveText(/Colin Cole/)
  await page.keyboard.press('KeyA')
  await expect(page.getByTestId('pick-name-player1')).toHaveText(/Brute/)

  await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setVirtualGamepad: (pad: {
          index: number
          connected: boolean
          axes: number[]
          buttons: Array<{ pressed: boolean; value: number }>
          mapping: string
          id: string
        } | null) => void
      }
    }).__MOBILE_COMBAT__
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
    api.setVirtualGamepad({
      index: 1,
      connected: true,
      axes: [-1, 0],
      buttons,
      mapping: 'standard',
      id: 'virtual',
    })
  })
  await expect(page.getByTestId('pick-name-player2')).toHaveText(/Colin Cole/)
  await page.getByTestId('confirm-characters').click()

  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { getState: () => { status: string; fighters: Array<{ characterId: string; maxLife: number }> } }
    }).__MOBILE_COMBAT__
    return api?.getState().status === 'running'
  })
  const fighters = await page.evaluate(() => {
    return (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { fighters: Array<{ characterId: string; maxLife: number; device: string }> } }
    }).__MOBILE_COMBAT__.getState().fighters
  })
  expect(fighters[0].characterId).toBe('brute')
  expect(fighters[0].maxLife).toBe(130)
  expect(fighters[1].characterId).toBe('colin')
  expect(fighters[1].maxLife).toBe(100)
})
