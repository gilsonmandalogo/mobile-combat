import { expect, test } from '@playwright/test'

test('the hud shows health, the clock, devices, and a KO banner', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__
    return api?.ready === true
  })

  await expect(page.getByTestId('hud')).toBeVisible()
  await expect(page.getByTestId('hud-name-player1')).toHaveText('Player 1')
  await expect(page.getByTestId('hud-device-player1')).toHaveText('Keyboard')
  await expect(page.getByTestId('hud-device-player2')).toHaveText('Keyboard')
  await expect(page.getByTestId('life-player1')).toHaveText('100')
  await expect(page.getByTestId('round-label')).toHaveText('Round 1')
  await expect(page.getByTestId('banner')).toHaveText('Round 1')

  const afterHit = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        getState: () => { fighters: Array<{ life: number }> ; banner: string | null; status: string }
        setIntent: (id: 'player1' | 'player2', intent: {
          move: number
          jump: boolean
          attackUp: boolean
          attackDown: boolean
          block: boolean
        } | null) => void
        stepFor: (seconds: number) => void
      }
    }).__MOBILE_COMBAT__
    const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false }
    api.setIntent('player1', { ...idle, move: 1 })
    api.setIntent('player2', idle)
    api.stepFor(3.2)
    api.setIntent('player1', { ...idle, attackDown: true })
    api.stepFor(0.45)
    let guard = 0
    while (api.getState().status === 'running' && guard < 40) {
      api.setIntent('player1', { ...idle, move: 1 })
      api.stepFor(0.35)
      api.setIntent('player1', { ...idle, attackDown: true })
      api.stepFor(0.55)
      guard += 1
    }
    return api.getState()
  })

  await expect(page.getByTestId('life-player2')).toHaveText(String(afterHit.fighters[1].life))
  expect(afterHit.fighters[1].life).toBeLessThan(100)
  await expect(page.getByTestId('banner')).toHaveText('K.O.')
})
