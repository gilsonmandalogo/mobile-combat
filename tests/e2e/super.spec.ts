import { expect, test } from '@playwright/test'

const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false, crouch: false, super: false }

test('a full meter super spends the bar, chips on block, and shows the banner', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { ready: boolean; getState: () => { introTime: number } }
    }).__MOBILE_COMBAT__
    return api?.ready === true && api.getState().introTime === 0
  })

  const result = await page.evaluate((idleIntent) => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setEnergy: (id: string, value: number) => void
        setIntent: (id: string, intent: typeof idleIntent) => void
        stepFor: (seconds: number) => void
        getAudio: () => { lastCue: string | null }
        getState: () => {
          callout: string | null
          fighters: Array<{ action: string; energy: number; life: number; pose: string }>
        }
      }
    }).__MOBILE_COMBAT__
    api.setIntent('player1', { ...idleIntent, move: 1 })
    api.setIntent('player2', idleIntent)
    api.stepFor(2.2)
    api.setEnergy('player1', 100)
    api.setIntent('player1', { ...idleIntent, super: true })
    api.stepFor(1 / 60)
    const started = api.getState()
    const cue = api.getAudio().lastCue
    api.setIntent('player1', idleIntent)
    api.stepFor(1.1)
    const landed = api.getState()
    const before = landed.fighters[1].life
    api.setEnergy('player1', 100)
    api.setIntent('player2', { ...idleIntent, block: true })
    api.setIntent('player1', { ...idleIntent, move: 1 })
    api.stepFor(0.8)
    api.setIntent('player1', { ...idleIntent, super: true })
    api.stepFor(1 / 60)
    api.setIntent('player1', idleIntent)
    api.stepFor(0.55)
    const blocked = api.getState()
    return {
      action: started.fighters[0].action,
      pose: started.fighters[0].pose,
      energy: started.fighters[0].energy,
      callout: started.callout,
      cue,
      life: landed.fighters[1].life,
      chip: before - blocked.fighters[1].life,
      blockedEnergy: blocked.fighters[0].energy,
      shade: document.getElementById('shade') !== null,
    }
  }, idle)

  expect(result.action).toBe('super')
  expect(result.pose).toBe('super')
  expect(result.energy).toBe(0)
  expect(result.callout).toBe('SUPER')
  expect(result.cue).toBe('super')
  expect(result.life).toBeLessThan(70)
  expect(result.blockedEnergy).toBeLessThan(8)
  expect(result.chip).toBeGreaterThan(0)
  expect(result.chip).toBeLessThan(12)
  expect(result.shade).toBe(true)
  await expect(page.getByTestId('shade')).toBeAttached()
})
