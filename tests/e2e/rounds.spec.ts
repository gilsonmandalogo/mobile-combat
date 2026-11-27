import { expect, test } from '@playwright/test'

const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false, crouch: false }

test('a knockout shows the medallion, then Round 2 and Fight', async ({ page }) => {
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
        setIntent: (id: string, intent: typeof idleIntent) => void
        stepFor: (seconds: number) => void
        getState: () => {
          banner: string | null
          round: number
          introTime: number
          score: { player1: number }
          fighters: Array<{ x: number; life: number }>
        }
      }
    }).__MOBILE_COMBAT__
    api.setIntent('player1', { ...idleIntent, move: 1 })
    api.setIntent('player2', idleIntent)
    api.stepFor(1.4)
    for (let swing = 0; swing < 16 && api.getState().score.player1 === 0; swing += 1) {
      api.setIntent('player1', { ...idleIntent, move: 1 })
      api.stepFor(0.55)
      api.setIntent('player1', { ...idleIntent, attackDown: true })
      api.stepFor(0.5)
    }
    const ended = api.getState()
    let intro = ''
    let fight = ''
    let life = 0
    let left = 0
    let round = ended.round
    for (let frame = 0; frame < 220; frame += 1) {
      api.stepFor(1 / 60)
      const state = api.getState()
      round = state.round
      if (state.banner === 'Round 2') {
        intro = state.banner
      }
      if (state.banner === 'Fight!') {
        fight = state.banner
        life = state.fighters[1].life
        left = state.fighters[0].x
        break
      }
    }
    return {
      banner: ended.banner,
      score: ended.score.player1,
      round,
      intro,
      fight,
      life,
      left,
    }
  }, idle)

  expect(result.score).toBe(1)
  expect(['K.O.', 'Flawless victory']).toContain(result.banner)
  expect(result.round).toBe(2)
  expect(result.intro).toBe('Round 2')
  expect(result.fight).toBe('Fight!')
  expect(result.life).toBe(100)
  expect(result.left).toBeLessThan(0)
  await expect(page.getByTestId('rounds-player1').locator('.pip.won')).toHaveCount(1)
  await expect(page.getByTestId('rounds-player2').locator('.pip.won')).toHaveCount(0)
})
