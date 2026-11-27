import { CatalogError, arenaSchema, characterSchema, folderId, formatIssues } from '@src/content/schema'
import type { ArenaDef, CharacterDef } from '@src/content/schema'
import { BLOCK_CHIP } from '@src/sim/constants'
import type { AttackChips } from '@src/sim/types'

const characterModules = import.meta.glob('./characters/*/manifest.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

const arenaModules = import.meta.glob('./arenas/*/manifest.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

export function loadCharacters(modules: Record<string, unknown> = characterModules): CharacterDef[] {
  return loadGroup(modules, characterSchema, 'character')
}

export function loadArenas(modules: Record<string, unknown> = arenaModules): ArenaDef[] {
  return loadGroup(modules, arenaSchema, 'arena')
}

export function arenaById(id: string): ArenaDef {
  const found = loadArenas().find((arena) => arena.id === id)
  if (!found) {
    throw new CatalogError([`No arena "${id}" in the catalog.`])
  }
  return found
}

export function defaultArena(arenas: Array<{ id: string }>): number {
  const index = arenas.findIndex((arena) => arena.id === 'mayan-temple')
  return index >= 0 ? index : 0
}

export function characterById(id: string): CharacterDef {
  const found = loadCharacters().find((character) => character.id === id)
  if (!found) {
    throw new CatalogError([`No character "${id}" in the roster.`])
  }
  return found
}

export function defaultPicks(roster: Array<{ id: string }>): { player1: number; player2: number } {
  const player1 = Math.max(0, roster.findIndex((character) => character.id === 'colin'))
  const maria = roster.findIndex((character) => character.id === 'maria')
  return { player1, player2: maria >= 0 ? maria : player1 }
}

export function moveList(def: CharacterDef): string[] {
  return [
    'Block — hold Block',
    ...def.moves.map((move) => `${move.name} — ${move.input}`),
    ...def.combos.map((combo) => `${combo.name} — ${combo.sequence.join(', ')}`),
  ]
}

export function attackChips(moves: Array<{ input: string; chip?: number }>): AttackChips {
  const ratio = (move: { chip?: number } | undefined) => move?.chip === undefined ? BLOCK_CHIP : move.chip
  const up = moves.find((move) => /up/i.test(move.input)) ?? moves[0]
  const down = moves.find((move) => /down/i.test(move.input)) ?? moves[1] ?? moves[0]
  return { attackUp: ratio(up), attackDown: ratio(down) }
}

export function stepRoster(index: number, delta: number, count: number): number {
  if (count <= 0) {
    return 0
  }
  const shift = ((delta % count) + count) % count
  return (index + shift) % count
}

function loadGroup<T extends { id: string; name: string }>(
  modules: Record<string, unknown>,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: import('zod').ZodError } },
  label: string,
): T[] {
  const details: string[] = []
  const items: T[] = []
  const paths = Object.keys(modules).sort()
  if (!paths.length) {
    throw new CatalogError([`No ${label} manifests found. Add a folder with manifest.json.`])
  }

  for (const path of paths) {
    const id = folderId(path)
    const parsed = schema.safeParse(modules[path])
    if (!parsed.success) {
      details.push(...formatIssues(path, parsed.error))
      continue
    }
    if (!id) {
      details.push(`${path}: folder name could not be read`)
      continue
    }
    if (parsed.data.id !== id) {
      details.push(`${path}: id "${parsed.data.id}" does not match the folder "${id}"`)
      continue
    }
    items.push(parsed.data)
  }

  if (details.length) {
    throw new CatalogError(details)
  }

  return items.sort((a, b) => a.name.localeCompare(b.name))
}
