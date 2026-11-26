import { expect, test } from '@playwright/test'

test('hits play a cue and the volume sliders persist', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => window.__MOBILE_COMBAT__?.ready)
  await page.getByTestId('game-canvas').click()
  await page.evaluate(() => {
    const api = window.__MOBILE_COMBAT__
    api.setIntent('player1', { move: 1, jump: false, attackUp: false, attackDown: true, block: false })
    api.setIntent('player2', { move: -1, jump: false, attackUp: false, attackDown: false, block: false })
    api.stepFor(3.2)
    for (let i = 0; i < 24; i += 1) {
      const life = api.getState().fighters[1].life
      api.stepFor(0.55)
      api.setIntent('player1', { move: 1, jump: false, attackUp: false, attackDown: true, block: false })
      api.stepFor(0.5)
      if (api.getState().fighters[1].life < life) {
        break
      }
    }
  })
  const cue = await page.evaluate(() => window.__MOBILE_COMBAT__.getAudio())
  expect(cue.unlocked).toBe(true)
  expect(['attack', 'hit', 'block', 'ko']).toContain(cue.lastCue)

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('pause-menu')).toBeVisible()
  await page.getByTestId('pause-settings').click()
  const slider = page.getByTestId('sfxVolume')
  await slider.fill('0.15')
  await page.waitForFunction(() => window.__MOBILE_COMBAT__.getAudio().sfxVolume === 0.15)
  await page.reload()
  await page.waitForFunction(() => window.__MOBILE_COMBAT__?.ready)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('settings') || '{}').sfxVolume)
  expect(stored).toBe(0.15)
})
