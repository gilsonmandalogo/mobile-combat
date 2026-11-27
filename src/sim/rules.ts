import { z } from 'zod'
import rawRules from '@src/content/rules/combat.json'

const rulesSchema = z.object({
  roundsToWin: z.number().int().min(1).max(5),
  maxRounds: z.number().int().min(1).max(9),
  energyMax: z.number().positive().max(300),
  energyOnDeal: z.number().nonnegative().max(5),
  energyOnTake: z.number().nonnegative().max(5),
  energyOnBlock: z.number().nonnegative().max(5),
  energyCarry: z.boolean(),
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
