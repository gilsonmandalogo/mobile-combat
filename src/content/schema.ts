import { z } from 'zod'

const portraitSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb color'),
  mark: z.string().min(1).max(2),
})

const glbModelSchema = z.object({
  kind: z.literal('glb'),
  file: z.string().min(1),
  scale: z.number().positive(),
  license: z.string().min(1),
})

const primitiveModelSchema = z.object({
  kind: z.literal('primitive'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb color'),
  scale: z.number().positive(),
  license: z.string().min(1),
})

export const moveSchema = z.object({
  name: z.string().min(1),
  input: z.string().min(1),
  damage: z.number().positive(),
})

export const tokenSchema = z.enum(['back', 'forward', 'up', 'punch', 'kick'])

export const comboSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sequence: z.array(tokenSchema).min(2).max(3),
  window: z.number().positive().max(1.5),
  damage: z.number().positive(),
  effect: z.enum(['projectile', 'dash', 'uppercut', 'teleport']),
  startup: z.number().nonnegative(),
  active: z.number().positive(),
  recovery: z.number().nonnegative(),
  reach: z.number().positive(),
  hitY: z.number().nonnegative(),
  hitW: z.number().positive(),
  hitH: z.number().positive(),
  knockback: z.number().nonnegative(),
  hop: z.number().nonnegative(),
})

export const characterSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'must be a lowercase id'),
  name: z.string().min(1).max(24),
  portrait: portraitSchema,
  stats: z.object({
    health: z.number().int().positive().max(300),
    speed: z.number().positive().max(12),
    damage: z.number().positive().max(3),
  }),
  animations: z.object({
    idle: z.string().min(1),
    walkForward: z.string().min(1),
    walkBackward: z.string().min(1),
    punchUp: z.string().min(1),
    punchDown: z.string().min(1),
  }),
  model: z.discriminatedUnion('kind', [glbModelSchema, primitiveModelSchema]),
  moves: z.array(moveSchema).min(1),
  combos: z.array(comboSchema).default([]),
})

export type CharacterDef = z.infer<typeof characterSchema>
export type ComboDef = z.infer<typeof comboSchema>
export type InputToken = z.infer<typeof tokenSchema>

export class CatalogError extends Error {
  readonly details: string[]

  constructor(details: string[]) {
    super(details.join('\n'))
    this.name = 'CatalogError'
    this.details = details
  }
}

export function folderId(path: string): string | null {
  const match = path.match(/\/([^/]+)\/manifest\.json$/)
  return match ? match[1] : null
}

export function formatIssues(path: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.length ? issue.path.join('.') : '(root)'
    return `${path}: ${field} ${issue.message}`
  })
}
