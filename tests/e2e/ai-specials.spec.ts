import { expect, test } from '@playwright/test'

test('nightmare AI throws its character special through the real input buffer', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1&mode=ai&difficulty=nightmare&characters=maria,colin&seed=4')
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { ready: boolean; getState: () => { introTime: number } }
    }).__MOBILE_COMBAT__
    return api?.ready === true && api.getState().introTime === 0
  })

  const found = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        stepFor: (seconds: number) => void
        getState: () => {
          aiState: string | null
          projectiles: number
          fighters: Array<{ action: string; characterId: string; device: string }>
        }
      }
    }).__MOBILE_COMBAT__
    for (let frame = 0; frame < 80; frame += 1) {
      api.stepFor(0.05)
      const state = api.getState()
      if (state.fighters[1].action === 'special' || state.projectiles > 0 || state.aiState === 'special') {
        return state
      }
    }
    return api.getState()
  })

  expect(found.fighters[1].device).toBe('ai')
  expect(found.fighters[1].characterId).toBe('colin')
  expect(found.fighters[1].action === 'special' || found.projectiles > 0 || found.aiState === 'special').toBe(true)
})
