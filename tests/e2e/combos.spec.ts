import { expect, test } from '@playwright/test'

test('the pause menu lists specials and a fireball deals damage', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1&characters=colin,maria')
  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { ready: boolean; getState: () => { introTime: number; status: string } }
    }).__MOBILE_COMBAT__
    const state = api?.getState()
    return api?.ready === true && state?.status === 'running' && state.introTime === 0
  })

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('move-list')).toContainText('Ember — back, forward, punch')
  await expect(page.getByTestId('move-list')).toContainText('Needle — back, forward, kick')
  await expect(page.getByTestId('move-list')).toContainText('Slip — back, up, kick')
  await page.getByTestId('resume').click()

  const life = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setIntent: (id: string, intent: {
          move: number
          jump: boolean
          attackUp: boolean
          attackDown: boolean
          block: boolean
        } | null) => void
        stepFor: (seconds: number) => void
        getState: () => { fighters: Array<{ life: number; action: string }> }
      }
    }).__MOBILE_COMBAT__
    const empty = { move: 0, jump: false, attackUp: false, attackDown: false, block: false }
    const hold = (intent: typeof empty, seconds: number) => {
      api.setIntent('player1', intent)
      api.setIntent('player2', empty)
      api.stepFor(seconds)
    }
    hold({ ...empty, move: -1 }, 0.08)
    hold(empty, 0.04)
    hold({ ...empty, move: 1 }, 0.08)
    hold(empty, 0.04)
    hold({ ...empty, attackUp: true }, 0.06)
    const during = api.getState().fighters[0].action
    hold(empty, 1.1)
    api.setIntent('player1', null)
    api.setIntent('player2', null)
    return { during, life: api.getState().fighters[1].life }
  })
  expect(life.during).toBe('special')
  expect(life.life).toBeLessThan(86)
})
