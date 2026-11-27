import { expect, test } from '@playwright/test'

const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false, crouch: false }

async function critHit(page: import('@playwright/test').Page) {
  return page.evaluate((idleIntent) => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setCritChance: (chance: number) => void
        setIntent: (id: string, intent: typeof idleIntent) => void
        stepFor: (seconds: number) => void
        getAudio: () => { lastCue: string | null }
        getState: () => { callout: string | null; fighters: Array<{ life: number }> }
      }
    }).__MOBILE_COMBAT__
    api.setCritChance(1)
    api.setIntent('player1', { ...idleIntent, move: 1 })
    api.setIntent('player2', idleIntent)
    api.stepFor(2.2)
    api.setIntent('player1', { ...idleIntent, attackDown: true })
    api.stepFor(0.2)
    let callout: string | null = null
    for (let frame = 0; frame < 30 && callout !== 'CRITICAL!'; frame += 1) {
      api.stepFor(1 / 60)
      callout = api.getState().callout
    }
    return {
      banner: callout,
      life: api.getState().fighters[1].life,
      cue: api.getAudio().lastCue,
      sparks: document.querySelectorAll('[data-testid="sparks"] .spark').length,
    }
  }, idle)
}

test('a critical hit shows the banner, sparks, and a distinct cue', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean; getState: () => { introTime: number } } }).__MOBILE_COMBAT__
    return api?.ready === true && api.getState().introTime === 0
  })
  const result = await critHit(page)
  expect(result.life).toBeLessThan(100)
  expect(result.banner).toBe('CRITICAL!')
  expect(result.cue).toBe('critical')
  expect(result.sparks).toBeGreaterThan(0)
  await expect(page.getByTestId('banner')).toHaveText('CRITICAL!')
})

test('reduced motion keeps the critical text without sparks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean; getState: () => { introTime: number } } }).__MOBILE_COMBAT__
    return api?.ready === true && api.getState().introTime === 0
  })
  const result = await critHit(page)
  expect(result.banner).toBe('CRITICAL!')
  expect(result.sparks).toBe(0)
})
