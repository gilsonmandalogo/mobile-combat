import { expect, test } from '@playwright/test'

test('a virtual gamepad moves a player and rumbles when they are hit', async ({ page }) => {
  await page.addInitScript(() => {
    const settings = {
      debug: false,
      musicVolume: 0,
      sfxVolume: 0,
      menuKey: 'Escape',
      players: {
        player1: {
          name: 'Player 1',
          device: 'keyboard',
          gamepadIndex: 0,
          keys: { left: 'KeyA', right: 'KeyD', jump: 'Space', attackUp: 'KeyG', attackDown: 'KeyV', block: 'KeyY' },
          pad: { jump: 0, attackUp: 2, attackDown: 3, block: 5 },
        },
        player2: {
          name: 'Player 2',
          device: 'gamepad',
          gamepadIndex: 0,
          keys: { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ControlRight', attackUp: 'Equal', attackDown: 'BracketRight', block: 'Backslash' },
          pad: { jump: 0, attackUp: 2, attackDown: 3, block: 5 },
        },
      },
    }
    localStorage.setItem('settings', JSON.stringify(settings))
  })

  await page.goto('/mobile-combat/?debug=1&autostart=1')
  await page.waitForFunction(() => {
    const api = (window as unknown as { __MOBILE_COMBAT__?: { ready: boolean } }).__MOBILE_COMBAT__
    return api?.ready === true
  })

  const report = await page.evaluate(() => {
    const api = (window as unknown as {
      __MOBILE_COMBAT__: {
        getState: () => { fighters: Array<{ x: number; life: number; device: string }> }
        setIntent: (id: 'player1' | 'player2', intent: {
          move: number
          jump: boolean
          attackUp: boolean
          attackDown: boolean
          block: boolean
        } | null) => void
        stepFor: (seconds: number) => void
        setVirtualGamepad: (pad: {
          index: number
          connected: boolean
          axes: number[]
          buttons: Array<{ pressed: boolean; value: number }>
          mapping: string
          id: string
          vibrate?: (strong: number, weak: number, duration: number) => boolean
        } | null) => void
      }
    }).__MOBILE_COMBAT__

    let pulses = 0
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
    api.setVirtualGamepad({
      index: 0,
      connected: true,
      axes: [-1, 0, 0, 0],
      buttons,
      mapping: 'standard',
      id: 'virtual',
      vibrate: () => {
        pulses += 1
        return true
      },
    })
    const startX = api.getState().fighters[1].x
    api.stepFor(1.8)
    const movedX = api.getState().fighters[1].x

    const idle = { move: 0, jump: false, attackUp: false, attackDown: false, block: false }
    api.setVirtualGamepad({
      index: 0,
      connected: true,
      axes: [0, 0, 0, 0],
      buttons,
      mapping: 'standard',
      id: 'virtual',
      vibrate: () => {
        pulses += 1
        return true
      },
    })
    api.setIntent('player1', { ...idle, move: 1 })
    api.setIntent('player2', null)
    api.stepFor(2.2)
    api.setIntent('player1', { ...idle, attackDown: true })
    api.stepFor(0.5)
    return {
      device: api.getState().fighters[1].device,
      startX,
      movedX,
      life: api.getState().fighters[1].life,
      pulses,
    }
  })

  expect(report.device).toBe('gamepad')
  expect(report.movedX).toBeLessThan(report.startX - 0.4)
  expect(report.life).toBeLessThan(100)
  expect(report.pulses).toBeGreaterThan(0)
})
