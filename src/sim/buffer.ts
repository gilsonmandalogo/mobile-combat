import type { ComboSpec, InputToken, Intent, MotionMemory, StampedToken } from '@src/sim/types'

const BUFFER_LIMIT = 1.5

export function emptyMotion(): MotionMemory {
  return { tokens: [], move: 0, jump: false, attackUp: false, attackDown: false }
}

export function pushMotion(
  memory: MotionMemory,
  intent: Intent,
  facing: 1 | -1,
  dt: number,
): { memory: MotionMemory; fresh: InputToken[] } {
  const tokens: StampedToken[] = memory.tokens
    .map((stamp) => ({ token: stamp.token, age: stamp.age + dt }))
    .filter((stamp) => stamp.age <= BUFFER_LIMIT)
  const fresh: InputToken[] = []
  const push = (token: InputToken) => {
    tokens.push({ token, age: 0 })
    fresh.push(token)
  }

  if (intent.move !== 0 && intent.move !== memory.move) {
    push(intent.move === facing ? 'forward' : 'back')
  }
  if (intent.jump && !memory.jump) {
    push('up')
  }
  if (intent.attackUp && !memory.attackUp) {
    push('punch')
  }
  if (intent.attackDown && !memory.attackDown) {
    push('kick')
  }

  return {
    memory: {
      tokens,
      move: intent.move,
      jump: intent.jump,
      attackUp: intent.attackUp,
      attackDown: intent.attackDown,
    },
    fresh,
  }
}

export function holdsJump(tokens: StampedToken[], combos: ComboSpec[]): boolean {
  return combos.some((combo) => {
    const upAt = combo.sequence.lastIndexOf('up')
    if (upAt < 0 || upAt === combo.sequence.length - 1) {
      return false
    }
    const prefix = combo.sequence.slice(0, upAt + 1)
    if (tokens.length < prefix.length) {
      return false
    }
    const tail = tokens.slice(-prefix.length)
    const aligned = tail.every((stamp, index) => stamp.token === prefix[index])
    return aligned && tail[0].age <= combo.window
  })
}

export function bestCombo(tokens: StampedToken[], combos: ComboSpec[], fresh: InputToken[]): ComboSpec | null {
  if (!fresh.length) {
    return null
  }

  const ranked = [...combos].sort((a, b) => b.sequence.length - a.sequence.length || b.damage - a.damage)
  for (const combo of ranked) {
    const length = combo.sequence.length
    if (tokens.length < length) {
      continue
    }
    const tail = tokens.slice(-length)
    const aligned = tail.every((stamp, index) => stamp.token === combo.sequence[index])
    const newest = tail[length - 1]
    if (!aligned || newest.age > 0 || tail[0].age > combo.window) {
      continue
    }
    if (newest.token !== fresh[fresh.length - 1]) {
      continue
    }
    return combo
  }

  return null
}
