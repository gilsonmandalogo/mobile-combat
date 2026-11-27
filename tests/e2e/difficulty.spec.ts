import { expect, test } from '@playwright/test'

test('nightmare difficulty is chosen from the setup menu and remembered', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1')
  await page.getByTestId('title-start').click()
  await page.getByTestId('main-fight').click()
  await expect(page.getByTestId('difficulty-select')).toBeHidden()
  await expect(page.getByTestId('mode-select')).toHaveClass(/is-focused/)

  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('difficulty-select')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('difficulty-select')).toHaveClass(/is-focused/)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('difficulty-select')).toHaveValue('nightmare')

  const stored = await page.evaluate(() => {
    const raw = window.localStorage.getItem('settings')
    return raw ? JSON.parse(raw).difficulty as string : ''
  })
  expect(stored).toBe('nightmare')

  await page.reload()
  await page.getByTestId('title-start').click()
  await page.getByTestId('main-fight').click()
  await page.getByTestId('mode-select').selectOption('ai')
  await expect(page.getByTestId('difficulty-select')).toHaveValue('nightmare')
})
