import { expect, test } from '@playwright/test'

test('a hit fills the meter under the health bar', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { ready: boolean; getState: () => { introTime: number } }
    }).__MOBILE_COMBAT__
    return api?.ready === true && api.getState().introTime === 0
  })

  const energy = await page.evaluate(() => {
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
        getState: () => { fighters: Array<{ energy: number; life: number }> }
      }
    }).__MOBILE_COMBAT__
    const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false, crouch: false }
    api.setIntent('player1', { ...idle, move: 1 })
    api.setIntent('player2', idle)
    api.stepFor(2.2)
    api.setIntent('player1', { ...idle, attackDown: true })
    api.stepFor(0.45)
    return api.getState().fighters[0].energy
  })

  expect(energy).toBeGreaterThan(0)
  const style = await page.getByTestId('meter-fill-player1').getAttribute('style')
  expect(style ?? '').toContain('scaleX(')
  expect(style ?? '').not.toContain('scaleX(0)')
  await expect(page.getByTestId('meter-player1')).not.toHaveClass(/is-full/)
})
