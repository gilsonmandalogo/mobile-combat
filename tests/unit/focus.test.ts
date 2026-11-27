import { describe, expect, it } from 'vitest'
import { moveFocus } from '@src/ui/focus'
import type { FocusItem } from '@src/ui/focus'

const items: FocusItem[] = [
  { id: 'fight', x: 0, y: 0 },
  { id: 'settings', x: 0, y: 48 },
  { id: 'hidden', x: 0, y: 96, disabled: true },
  { id: 'name', x: 180, y: 0 },
]

describe('focus navigation', () => {
  it('starts on the first enabled control and skips disabled ones', () => {
    expect(moveFocus(items, null, 'down')).toBe('fight')
    expect(moveFocus(items, 'settings', 'down')).toBe('settings')
    expect(moveFocus([], 'fight', 'up')).toBeNull()
  })

  it('moves to the nearest control in that direction', () => {
    expect(moveFocus(items, 'fight', 'down')).toBe('settings')
    expect(moveFocus(items, 'settings', 'up')).toBe('fight')
    expect(moveFocus(items, 'fight', 'right')).toBe('name')
    expect(moveFocus(items, 'name', 'left')).toBe('fight')
  })

  it('stays put when a stale id is the only enabled control', () => {
    expect(moveFocus([{ id: 'only', x: 0, y: 0 }], 'missing', 'left')).toBe('only')
  })
})