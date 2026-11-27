import { expect, test } from '@playwright/test'

test('the main menu starts a versus-AI match with the chosen name', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1')
  await expect(page.getByTestId('main-menu')).toBeVisible()
  await expect(page.getByTestId('difficulty-select')).toBeHidden()

  await page.getByTestId('mode-select').selectOption('ai')
  await expect(page.getByTestId('difficulty-select')).toBeVisible()
  await page.getByTestId('difficulty-select').selectOption('hard')
  await page.getByTestId('name-player1-input').fill('Rio')
  await page.getByTestId('device-player1').selectOption('keyboard')

  const start = page.getByTestId('start-match')
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page.getByTestId('character-select')).toBeVisible()
  await page.getByTestId('confirm-characters').click()
  await page.getByTestId('confirm-arena').click()

  await expect(page.getByTestId('main-menu')).toBeHidden()
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { getState: () => { status: string } } }).__MOBILE_COMBAT__
    return api?.getState().status === 'running'
  })
  const state = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: { getState: () => { status: string; mode: string; difficulty: string; fighters: Array<{ name: string; device: string }> } }
    }).__MOBILE_COMBAT__
    return api.getState()
  })
  expect(state.status).toBe('running')
  expect(state.mode).toBe('ai')
  expect(state.difficulty).toBe('hard')
  expect(state.fighters[0].name).toBe('Rio')
  expect(state.fighters[1].device).toBe('ai')
})
