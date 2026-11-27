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

const chipSchema = z.number().min(0).max(1)

export const hitLevelSchema = z.enum(['high', 'mid', 'low', 'overhead'])

const strikeTiming = {
  startup: z.number().nonnegative().optional(),
  active: z.number().positive().optional(),
  recovery: z.number().nonnegative().optional(),
  reach: z.number().positive().optional(),
  hitY: z.number().nonnegative().optional(),
  hitW: z.number().positive().optional(),
  hitH: z.number().positive().optional(),
  knockback: z.number().nonnegative().optional(),
  hop: z.number().nonnegative().optional(),
}

export const moveSchema = z.object({
  name: z.string().min(1),
  input: z.string().min(1),
  damage: z.number().positive(),
  chip: chipSchema.optional(),
  slot: z.enum(['attackUp', 'attackDown', 'crouchPunch', 'crouchKick', 'jumpPunch', 'jumpKick']).optional(),
  hitLevel: hitLevelSchema.optional(),
  height: z.enum(['stand', 'crouch', 'air']).optional(),
  ...strikeTiming,
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
  chip: chipSchema.optional(),
  hitLevel: hitLevelSchema.optional(),
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
    super: z.string().min(1).optional(),
  }),
  model: z.discriminatedUnion('kind', [glbModelSchema, primitiveModelSchema]),
  moves: z.array(moveSchema).min(1),
  combos: z.array(comboSchema).default([]),
  air: z.object({
    hurtHeight: z.number().positive().max(3),
    hurtHalfW: z.number().positive().max(1.5),
  }).optional(),
})

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb color')

const sunSchema = z.object({
  color: colorSchema,
  intensity: z.number().nonnegative().max(8),
  position: z.tuple([z.number(), z.number(), z.number()]),
})

const glbEnvironmentSchema = z.object({
  kind: z.literal('glb'),
  file: z.string().min(1),
  background: colorSchema,
  license: z.string().min(1),
})

const primitiveEnvironmentSchema = z.object({
  kind: z.literal('primitive'),
  background: colorSchema,
  fog: colorSchema,
  floor: colorSchema,
  accent: colorSchema,
  ambient: colorSchema,
  ambientIntensity: z.number().nonnegative().max(4),
  sun: sunSchema,
  license: z.string().min(1),
})

export const arenaSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'must be a lowercase id'),
  name: z.string().min(1).max(32),
  preview: portraitSchema,
  environment: z.discriminatedUnion('kind', [glbEnvironmentSchema, primitiveEnvironmentSchema]),
  bounds: z.object({
    minX: z.number(),
    maxX: z.number(),
  }),
  spawns: z.tuple([z.number(), z.number()]),
  music: z.enum(['temple', 'pit', 'court']),
}).superRefine((arena, ctx) => {
  if (arena.bounds.maxX <= arena.bounds.minX) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bounds'], message: 'maxX must be greater than minX' })
  }
  for (const spawn of arena.spawns) {
    if (spawn < arena.bounds.minX || spawn > arena.bounds.maxX) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['spawns'], message: 'spawns must sit inside bounds' })
      break
    }
  }
})

export type ArenaDef = z.infer<typeof arenaSchema>
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
