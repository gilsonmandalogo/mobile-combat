import { describe, expect, it } from 'vitest'
import { arenaById, attackChips, characterById, defaultArena, defaultPicks, loadArenas, loadCharacters, moveList, stepRoster } from '@src/content/catalog'
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
    expect(moveList(characterById('colin'))).toContain('Block — hold Block')
    expect(moveList(characterById('colin'))).toContain('Ember — back, forward, punch')
    expect(moveList(characterById('brute'))).toContain('Riser — forward, up, punch')
    expect(attackChips(characterById('colin').moves)).toEqual({ attackUp: 0.1, attackDown: 0.15 })
    expect(attackChips([{ input: 'Punch up' }])).toEqual({ attackUp: 0.2, attackDown: 0.2 })
    expect(characterById('colin').combos[0].chip).toBe(0.4)
  })
})

describe('arena catalog', () => {
  it('discovers three stages and rejects a spawn outside the bounds', () => {
    const arenas = loadArenas()
    expect(arenas.map((arena) => arena.id).sort()).toEqual(['ember-pit', 'mayan-temple', 'moon-court'])
    expect(arenaById('ember-pit').environment.kind).toBe('primitive')
    expect(arenaById('mayan-temple').environment.kind).toBe('glb')
    expect(defaultArena(arenas)).toBe(arenas.findIndex((arena) => arena.id === 'mayan-temple'))
    expect(arenaById('moon-court').bounds.maxX).toBeGreaterThan(arenaById('mayan-temple').bounds.maxX)

    expect(() => loadArenas({
      '/src/content/arenas/void/manifest.json': {
        id: 'void',
        name: 'Void',
        preview: { color: '#112233', mark: 'V' },
        environment: {
          kind: 'primitive',
          background: '#000000',
          fog: '#111111',
          floor: '#222222',
          accent: '#333333',
          ambient: '#444444',
          ambientIntensity: 0.2,
          sun: { color: '#ffffff', intensity: 1, position: [0, 5, 0] },
          license: 'test',
        },
        bounds: { minX: -2, maxX: 2 },
        spawns: [-4, 4],
        music: 'pit',
      },
    })).toThrow(/spawns must sit inside bounds/)
  })
})