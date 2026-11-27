import { z } from 'zod'
import rawRules from '@src/content/rules/combat.json'
import type { AttackSpec } from '@src/sim/constants'

const rulesSchema = z.object({
  roundsToWin: z.number().int().min(1).max(5),
  maxRounds: z.number().int().min(1).max(9),
  energyMax: z.number().positive().max(300),
  energyOnDeal: z.number().nonnegative().max(5),
  energyOnTake: z.number().nonnegative().max(5),
  energyOnBlock: z.number().nonnegative().max(5),
  energyCarry: z.boolean(),
  critChance: z.number().min(0).max(1),
  critDamage: z.number().min(1).max(4),
  critEnergyScale: z.number().min(1).max(8),
  hitStop: z.number().nonnegative().max(0.5),
  critHitStop: z.number().nonnegative().max(0.5),
  superDamage: z.number().positive().max(80),
  superChip: z.number().min(0).max(1),
  superStartup: z.number().nonnegative().max(1),
  superActive: z.number().positive().max(1),
  superRecovery: z.number().nonnegative().max(1.5),
  superReach: z.number().positive().max(4),
  superHitY: z.number().nonnegative().max(3),
  superHitW: z.number().positive().max(4),
  superHitH: z.number().positive().max(3),
  superKnockback: z.number().nonnegative().max(20),
  superHop: z.number().nonnegative().max(12),
  superHitstun: z.number().positive().max(1.5),
  superFreeze: z.number().nonnegative().max(1),
}).refine((rules) => rules.maxRounds >= rules.roundsToWin, {
  message: 'maxRounds must be at least roundsToWin',
})

export type CombatRules = z.infer<typeof rulesSchema>

export function loadCombatRules(raw: unknown = rawRules): CombatRules {
  const parsed = rulesSchema.safeParse(raw)
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => {
      const field = issue.path.length ? issue.path.join('.') : '(root)'
      return `${field} ${issue.message}`
    })
    throw new Error(details.join('\n'))
  }
  return parsed.data
}

export const COMBAT = loadCombatRules()

export function superAttack(rules: CombatRules = COMBAT): AttackSpec {
  return {
    damage: rules.superDamage,
    knockback: rules.superKnockback,
    hitstun: rules.superHitstun,
    startup: rules.superStartup,
    active: rules.superActive,
    recovery: rules.superRecovery,
    reach: rules.superReach,
    hitY: rules.superHitY,
    hitW: rules.superHitW,
    hitH: rules.superHitH,
    hop: rules.superHop,
    hitLevel: 'mid',
  }
}
