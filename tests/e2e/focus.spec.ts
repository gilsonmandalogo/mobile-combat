import { expect, test } from '@playwright/test'

test('keyboard and gamepad move a visible focus ring through the menus', async ({ page }) => {
  await page.goto('/mobile-combat/?debug=1')
  await page.getByTestId('title-start').click()
  await expect(page.getByTestId('main-fight')).toHaveClass(/is-focused/)

  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('open-settings')).toHaveClass(/is-focused/)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('settings-panel')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('main-menu')).toBeVisible()

  await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setVirtualGamepad: (pad: {
          index: number
          connected: boolean
          axes: number[]
          buttons: Array<{ pressed: boolean; value: number }>
          mapping: string
          id: string
        } | null) => void
      }
    }).__MOBILE_COMBAT__
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
    buttons[13] = { pressed: true, value: 1 }
    api.setVirtualGamepad({
      index: 0,
      connected: true,
      axes: [0, 1],
      buttons,
      mapping: 'standard',
      id: 'virtual',
    })
  })
  await expect(page.getByTestId('open-settings')).toHaveClass(/is-focused/)
  await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        setVirtualGamepad: (pad: {
          index: number
          connected: boolean
          axes: number[]
          buttons: Array<{ pressed: boolean; value: number }>
          mapping: string
          id: string
        } | null) => void
      }
    }).__MOBILE_COMBAT__
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
    buttons[0] = { pressed: true, value: 1 }
    api.setVirtualGamepad({
      index: 0,
      connected: true,
      axes: [0, 0],
      buttons,
      mapping: 'standard',
      id: 'virtual',
    })
  })
  await expect(page.getByTestId('settings-panel')).toBeVisible()
})
