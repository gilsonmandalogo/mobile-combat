import { expect, test } from '@playwright/test'

test('keyboard movement reaches the simulation', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__
    return api?.ready === true
  })

  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { introTime: number } }
    }).__MOBILE_COMBAT__
    return api.getState().introTime === 0
  })

  const before = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { fighters: Array<{ x: number }> } }
    }).__MOBILE_COMBAT__
    return api.getState().fighters[0].x
  })

  await page.keyboard.down('KeyD')
  await page.waitForFunction((start) => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { fighters: Array<{ x: number }> } }
    }).__MOBILE_COMBAT__
    return api.getState().fighters[0].x > start + 0.25
  }, before)
  await page.keyboard.up('KeyD')

  const after = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { fighters: Array<{ x: number }> } }
    }).__MOBILE_COMBAT__
    return api.getState().fighters[0].x
  })
  expect(after).toBeGreaterThan(before)
})

test('punches damage, knock back, and decide the match', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__
    return api?.ready === true
  })

  const report = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        getState: () => {
          status: string
          banner: string | null
          winner: string | null
          round: number
          score: { player1: number; player2: number }
          fighters: Array<{ x: number; life: number; score: number; ko: boolean }>
        }
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
    const mash = () => {
      api.setIntent('player1', { ...idle, move: 1 })
      api.setIntent('player2', idle)
      api.stepFor(3.2)
      const before = api.getState().fighters[1]
      api.setIntent('player1', { ...idle, attackDown: true })
      api.stepFor(0.45)
      const struck = api.getState().fighters[1]
      let guard = 0
      while (api.getState().fighters[1].life > 0 && guard < 40) {
        api.setIntent('player1', { ...idle, move: 1 })
        api.stepFor(0.55)
        api.setIntent('player1', { ...idle, attackDown: true })
        api.stepFor(0.5)
        guard += 1
      }
      return { beforeX: before.x, struckX: struck.x, struckLife: struck.life, ko: api.getState() }
    }

    const first = mash()
    api.stepFor(3.4)
    const second = mash()
    api.stepFor(2.6)
    return {
      firstLife: first.struckLife,
      knockback: first.struckX - first.beforeX,
      firstStatus: first.ko.status,
      firstScore: first.ko.score,
      final: api.getState(),
      secondLife: second.struckLife,
    }
  })

  expect(report.firstLife).toBeLessThan(100)
  expect(report.knockback).toBeGreaterThan(0)
  expect(report.firstScore.player1).toBeGreaterThanOrEqual(1)
  expect(report.final.status).toBe('matchEnd')
  expect(report.final.winner).toBe('player1')
  expect(report.final.banner).toBe('Player 1 wins')
})
