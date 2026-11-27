import { expect, test } from '@playwright/test'

test('the title screen opens the main menu and the device setup', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1')
  await expect(page.getByTestId('title-screen')).toBeVisible()
  await expect(page.getByTestId('embers')).toBeVisible()
  await expect(page.getByTestId('main-menu')).toBeHidden()
  await expect(page.getByTestId('title-start')).toBeEnabled()

  await page.keyboard.press('Enter')
  await expect(page.getByTestId('main-menu')).toBeVisible()
  await expect(page.getByTestId('title-screen')).toBeHidden()

  await page.getByTestId('main-fight').hover()
  await expect.poll(async () => page.evaluate(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { getAudio: () => { lastCue: string | null } } }).__MOBILE_COMBAT__
    return api?.getAudio().lastCue ?? null
  })).toBe('hover')

  await page.getByTestId('main-fight').click()
  await expect(page.getByTestId('setup-menu')).toBeVisible()
  await page.getByTestId('setup-back').click()
  await expect(page.getByTestId('main-menu')).toBeVisible()
})
