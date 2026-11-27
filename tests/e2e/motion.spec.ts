import { expect, test } from '@playwright/test'

test('menus, the round banner, and the health trail animate', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__
    return api?.ready === true
  })
  const fight = page.getByTestId('title-start')
  await expect(fight).toBeEnabled()
  await expect(fight).toHaveCSS('transition-property', /transform/)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('main-menu')).toBeVisible()
  await expect(page.getByTestId('title-screen')).toBeHidden()
  await expect(page.getByTestId('main-fight')).toHaveCSS('transition-duration', /0\.14s/)

  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const banner = document.getElementById('banner')
    return banner?.classList.contains('banner-pop') && !banner.hidden
  })

  const hit = await page.evaluate(() => {
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
      }
    }).__MOBILE_COMBAT__
    const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false, crouch: false }
    api.setIntent('player1', { ...idle, move: 1 })
    api.setIntent('player2', { ...idle, move: -1 })
    api.stepFor(2.2)
    api.setIntent('player1', { ...idle, attackDown: true })
    api.setIntent('player2', idle)
    api.stepFor(0.5)
    const trail = document.querySelector('[data-testid="health-trail-player2"]')
    const bar = document.querySelector('[data-testid="health-player2"]')?.parentElement
    return {
      from: Number((trail as HTMLElement | null)?.dataset.from),
      to: Number((trail as HTMLElement | null)?.dataset.to),
      hit: Boolean(bar?.classList.contains('is-hit')),
    }
  })
  expect(hit.from).toBeGreaterThan(hit.to)
  expect(hit.hit).toBe(true)
})

test('reduced motion removes the button transition', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', baseURL })
  const page = await context.newPage()
  await page.goto('/mobile-combat/?debug=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__
    return api?.ready === true
  })
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('main-menu')).toBeVisible()
  const duration = await page.getByTestId('main-fight').evaluate((button) => getComputedStyle(button).transitionDuration)
  expect(parseFloat(duration)).toBeLessThan(0.05)
  await context.close()
})
