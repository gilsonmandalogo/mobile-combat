import { expect, test } from '@playwright/test'

test('the arena list is data-driven and the choice reaches the match', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1')
  await page.getByTestId('title-start').click()
  await page.getByTestId('main-fight').click()
  await expect(page.getByTestId('start-match')).toBeEnabled()
  await page.getByTestId('start-match').click()
  await page.getByTestId('confirm-characters').click()
  await expect(page.getByTestId('arena-select')).toBeVisible()
  await expect(page.getByTestId('arena-card-mayan-temple')).toBeVisible()
  await expect(page.getByTestId('arena-card-ember-pit')).toBeVisible()
  await expect(page.getByTestId('arena-card-moon-court')).toBeVisible()
  await expect(page.getByTestId('arena-name')).toHaveText(/Mayan Temple/)

  await page.keyboard.press('KeyA')
  await expect(page.getByTestId('arena-name')).toHaveText(/Ember Pit/)
  await page.getByTestId('confirm-arena').click()

  await page.waitForFunction(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__?: { getState: () => { status: string; arenaId: string } }
    }).__MOBILE_COMBAT__
    const state = api?.getState()
    return state?.status === 'running' && state.arenaId === 'ember-pit'
  })
})
