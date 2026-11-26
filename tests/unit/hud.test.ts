import { describe, expect, it } from 'vitest'
import { deviceLabel, hudView } from '@src/ui/hud'
import type { DebugSnapshot } from '@src/debug/snapshot'

function snapshot(partial: Partial<DebugSnapshot> = {}): DebugSnapshot {
  return {
    ready: true,
    status: 'running',
    mode: 'local',
    difficulty: 'normal',
    round: 1,
    timeLeft: 59.2,
    introTime: 0,
    banner: null,
    winner: null,
    roundWinner: null,
    life: { player1: 80, player2: 100 },
    score: { player1: 1, player2: 0 },
    aiState: null,
    fighters: [
      { id: 'player1', name: 'Rio', life: 80, maxLife: 100, x: 0, y: 0, vx: 0, score: 1, action: 'idle', facing: 1, device: 'keyboard', blocking: false, ko: false },
      { id: 'player2', name: 'CPU', life: 100, maxLife: 100, x: 1, y: 0, vx: 0, score: 0, action: 'idle', facing: -1, device: 'ai', blocking: false, ko: false },
    ],
    ...partial,
  }
}

describe('hud', () => {
  it('labels keyboard, gamepad, and AI', () => {
    expect(deviceLabel('keyboard')).toBe('Keyboard')
    expect(deviceLabel('gamepad', 1)).toBe('Pad 2')
    expect(deviceLabel('ai')).toBe('AI')
  })

  it('maps life, round pips, the clock, and banners', () => {
    const view = hudView(snapshot(), [0, 0])
    expect(view.visible).toBe(true)
    expect(view.timer).toBe('60')
    expect(view.roundLabel).toBe('Round 1')
    expect(view.banner).toBeNull()
    expect(view.fighters[0]).toMatchObject({ name: 'Rio', device: 'Keyboard', life: 80, health: 0.8, rounds: [true, false] })
    expect(view.fighters[1].device).toBe('AI')

    const ko = hudView(snapshot({ status: 'roundEnd', banner: 'K.O.' }), [0, 0])
    expect(ko.banner).toBe('K.O.')
    const menu = hudView(snapshot({ status: 'menu', banner: 'Round 1', introTime: 1 }), [0, 0])
    expect(menu.visible).toBe(false)
  })
})
