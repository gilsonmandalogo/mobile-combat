import { describe, expect, it } from 'vitest'
import { characterById, defaultPicks, loadCharacters, moveList, stepRoster } from '@src/content/catalog'
import { CatalogError } from '@src/content/schema'

describe('character catalog', () => {
  it('discovers a manifest per folder and rejects a broken one with the field path', () => {
    const roster = loadCharacters()
    expect(roster.map((character) => character.id).sort()).toEqual(['brute', 'colin', 'maria'])
    expect(characterById('brute').model.kind).toBe('primitive')
    expect(characterById('colin').stats.health).toBe(100)
    expect(characterById('maria').stats.speed).toBeGreaterThan(characterById('colin').stats.speed)

    expect(() => loadCharacters({
      '/src/content/characters/rex/manifest.json': {
        id: 'rex',
        name: '',
        portrait: { color: 'red', mark: 'R' },
        stats: { health: 0, speed: 3, damage: 1 },
        animations: { idle: 'Idle', walkForward: 'WalkForward', walkBackward: 'WalkBackward', punchUp: 'PunchUp', punchDown: 'PunchDown' },
        model: { kind: 'primitive', color: '#112233', scale: 1, license: 'test' },
        moves: [],
      },
    })).toThrow(CatalogError)

    try {
      loadCharacters({
        '/src/content/characters/rex/manifest.json': { id: 'other' },
      })
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogError)
      const details = (error as CatalogError).details.join('\n')
      expect(details).toContain('manifest.json')
      expect(details).toContain('name')
    }
  })

  it('refuses a manifest whose id does not match its folder', () => {
    const valid = characterById('colin')
    expect(() => loadCharacters({
      '/src/content/characters/colin/manifest.json': { ...valid, id: 'maria' },
    })).toThrow(/does not match the folder/)
  })

  it('cycles the roster without walking off either end', () => {
    expect(stepRoster(0, -1, 3)).toBe(2)
    expect(stepRoster(2, 1, 3)).toBe(0)
    const roster = loadCharacters()
    const picks = defaultPicks(roster)
    expect(roster[picks.player1].id).toBe('colin')
    expect(roster[picks.player2].id).toBe('maria')
  })

  it('lists a different special for each fighter', () => {
    const effects = ['colin', 'maria', 'brute'].flatMap((id) => characterById(id).combos.map((combo) => combo.effect))
    expect(effects.sort()).toEqual(['dash', 'projectile', 'teleport', 'uppercut'])
    expect(moveList(characterById('colin'))).toContain('Ember — back, forward, punch')
    expect(moveList(characterById('brute'))).toContain('Riser — forward, up, punch')
  })
})