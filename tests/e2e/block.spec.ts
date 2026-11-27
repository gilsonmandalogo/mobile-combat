import { expect, test } from '@playwright/test'

test('a front block chips damage, plays the cue, and shows on the HUD and move list', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { ready: boolean; getState: () => { introTime: number } }
    }).__MOBILE_COMBAT__
    return api?.ready === true && api.getState().introTime === 0
  })

  const result = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setIntent: (id: string, intent: {
          move: number
          jump: boolean
          attackUp: boolean
          attackDown: boolean
          block: boolean
        }) => void
        stepFor: (seconds: number) => void
        getState: () => {
          callout: string | null
          fighters: Array<{ blocking: boolean; action: string; life: number }>
        }
        getAudio: () => { lastCue: string | null }
      }
    }).__MOBILE_COMBAT__
    const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false }
    api.setIntent('player1', { ...idle, move: 1 })
    api.setIntent('player2', { ...idle, move: -1, block: true })
    api.stepFor(2.2)
    api.setIntent('player1', { ...idle, attackUp: true })
    api.setIntent('player2', { ...idle, block: true })
    api.stepFor(0.45)
    return { state: api.getState(), cue: api.getAudio().lastCue }
  })

  expect(result.state.fighters[1].blocking).toBe(true)
  expect(result.state.fighters[1].action).toBe('block')
  expect(result.state.fighters[1].life).toBeLessThan(100)
  expect(result.state.fighters[1].life).toBeGreaterThan(90)
  expect(result.state.callout).toBe('BLOCK')
  expect(result.cue).toBe('block')
  await expect(page.getByTestId('combat-callout')).toHaveText('BLOCK')
  await expect(page.getByTestId('guard-player2')).toHaveText('BLOCK')

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('move-list')).toContainText('Block — hold Block')
})
