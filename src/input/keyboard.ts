import type { Intent } from '@src/sim/types'

export interface KeyBindings {
  left: string
  right: string
  jump: string
  attackUp: string
  attackDown: string
  block: string
  crouch: string
}

export interface KeyTarget {
  addEventListener(type: 'keydown' | 'keyup' | 'blur', listener: (event: KeyboardEvent) => void): void
}

export function keyboardIntent(
  held: ReadonlySet<string>,
  bindings: KeyBindings,
  edges: ReadonlySet<string>,
): Intent {
  const left = held.has(bindings.left)
  const right = held.has(bindings.right)
  let move: Intent['move'] = 0
  if (left && !right) {
    move = -1
  } else if (right && !left) {
    move = 1
  }

  return {
    move,
    jump: edges.has(bindings.jump),
    attackUp: edges.has(bindings.attackUp),
    attackDown: edges.has(bindings.attackDown),
    block: held.has(bindings.block),
    crouch: held.has(bindings.crouch),
  }
}

/**
 * Tracks keys held and keys pressed since the last consume.
 * A tap that lands between frames still counts, because the edge is kept until consumed.
 */
export class KeyboardTracker {
  readonly held = new Set<string>()
  private edges = new Set<string>()

  constructor(target: KeyTarget) {
    target.addEventListener('keydown', (event) => {
      if (event.repeat) {
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
      }
      if (!this.held.has(event.code)) {
        this.edges.add(event.code)
      }
      this.held.add(event.code)
    })

    target.addEventListener('keyup', (event) => {
      this.held.delete(event.code)
    })

    target.addEventListener('blur', () => {
      this.held.clear()
    })
  }

  consumeEdges(): Set<string> {
    const edges = this.edges
    this.edges = new Set()
    return edges
  }
}
