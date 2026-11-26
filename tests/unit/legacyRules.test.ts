import { describe, expect, it } from 'vitest'
import { debugQueryEnabled } from '@src/debug/bridge'

describe('debug hook', () => {
  it('turns on only for the debug query param', () => {
    expect(debugQueryEnabled('?debug=1')).toBe(true)
    expect(debugQueryEnabled('?foo=1')).toBe(false)
    expect(debugQueryEnabled('')).toBe(false)
  })
})
