import { expect, test } from '@playwright/test'

test('the ai opponent walks in and keeps a readable state', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1&mode=ai&seed=3')
  await page.waitForFunction(() => window.__MOBILE_COMBAT__?.ready)
  const start = await page.evaluate(() => window.__MOBILE_COMBAT__.getState().fighters[1].x)
  await page.evaluate(() => window.__MOBILE_COMBAT__.stepFor(2.4))
  const state = await page.evaluate(() => window.__MOBILE_COMBAT__.getState())
  expect(state.mode).toBe('ai')
  expect(state.fighters[1].device).toBe('ai')
  expect(state.fighters[1].x).toBeLessThan(start - 0.4)
  expect(['approach', 'attack', 'block', 'evade', 'retreat']).toContain(state.aiState)
})
