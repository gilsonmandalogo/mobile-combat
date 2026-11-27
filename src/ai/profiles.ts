import { z } from 'zod'
import rawProfiles from '@src/content/ai/difficulties.json'
import type { Difficulty } from '@src/sim/types'

const profileSchema = z.object({
  prefer: z.number().positive(),
  attack: z.number().positive(),
  threat: z.number().positive(),
  reaction: z.number().nonnegative(),
  aggression: z.number().min(0).max(1),
  block: z.number().min(0).max(1),
  evade: z.number().min(0).max(1),
  retreatLife: z.number().nonnegative(),
  heavy: z.number().min(0).max(1),
  attackCd: z.number().nonnegative(),
  retry: z.number().nonnegative(),
  accuracy: z.number().min(0).max(1),
  timingError: z.number().nonnegative().max(1),
  special: z.number().min(0).max(1),
  specialCd: z.number().nonnegative(),
  followUp: z.number().min(0).max(1),
  crouchBlock: z.number().min(0).max(1),
  lowAttack: z.number().min(0).max(1),
  jumpIn: z.number().min(0).max(1),
  superUse: z.number().min(0).max(1),
})

const tableSchema = z.object({
  easy: profileSchema,
  normal: profileSchema,
  hard: profileSchema,
  nightmare: profileSchema,
})

export type DifficultyProfile = z.infer<typeof profileSchema>

export function loadProfiles(raw: unknown = rawProfiles): Record<Difficulty, DifficultyProfile> {
  const parsed = tableSchema.safeParse(raw)
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => {
      const field = issue.path.length ? issue.path.join('.') : '(root)'
      return `${field} ${issue.message}`
    })
    throw new Error(details.join('\n'))
  }
  return parsed.data
}

const PROFILES = loadProfiles()

export function profileFor(difficulty: Difficulty): DifficultyProfile {
  return PROFILES[difficulty]
}
