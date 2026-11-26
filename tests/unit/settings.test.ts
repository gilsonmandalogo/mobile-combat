import { describe, expect, it } from 'vitest'
import { defaultSettings, normalizeSettings, rebindKey, rebindPad } from '@src/settings/schema'

describe('settings', () => {
  it('migrates the original keyboard map', () => {
    const settings = normalizeSettings({
      debug: true,
      inputs: {
        player1: { left: 'KeyQ', right: 'KeyD', jump: 'Space', attackUp: 'KeyG', attackDown: 'KeyV', block: 'KeyY' },
        player2: { left: 'ArrowLeft' },
        menu: 'KeyP',
      },
      inputType: 'keyboard',
    })
    expect(settings.debug).toBe(true)
    expect(settings.menuKey).toBe('KeyP')
    expect(settings.players.player1.keys.left).toBe('KeyQ')
    expect(settings.players.player1.device).toBe('keyboard')
    expect(settings.players.player2.keys.left).toBe('ArrowLeft')
    expect(settings.players.player2.keys.jump).toBe(defaultSettings().players.player2.keys.jump)
    expect(settings.musicVolume).toBeGreaterThan(0)
  })

  it('clamps volumes and keeps a gamepad assignment', () => {
    const settings = normalizeSettings({
      musicVolume: 4,
      sfxVolume: -2,
      players: {
        player1: { device: 'gamepad', gamepadIndex: 1, name: 'Ada' },
        player2: { device: 'keyboard' },
      },
    })
    expect(settings.musicVolume).toBe(1)
    expect(settings.sfxVolume).toBe(0)
    expect(settings.players.player1.device).toBe('gamepad')
    expect(settings.players.player1.gamepadIndex).toBe(1)
    expect(settings.players.player1.name).toBe('Ada')
  })

  it('swaps a key or button that is already bound on the same player', () => {
    const rebound = rebindKey(defaultSettings(), 'player1', 'left', 'KeyD')
    expect(rebound.players.player1.keys.left).toBe('KeyD')
    expect(rebound.players.player1.keys.right).toBe('KeyA')

    const pad = rebindPad(defaultSettings(), 'player2', 'block', 0)
    expect(pad.players.player2.pad.block).toBe(0)
    expect(pad.players.player2.pad.jump).toBe(5)
  })
})
