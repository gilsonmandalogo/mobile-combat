export type FocusDirection = 'up' | 'down' | 'left' | 'right'

export interface FocusItem {
  id: string
  x: number
  y: number
  disabled?: boolean
}

export function moveFocus(items: FocusItem[], currentId: string | null, direction: FocusDirection): string | null {
  const enabled = items.filter((item) => item.id && !item.disabled)
  if (!enabled.length) {
    return null
  }
  const current = enabled.find((item) => item.id === currentId)
  if (!current) {
    return enabled[0].id
  }

  const toward = enabled.filter((item) => item.id !== current.id && faces(current, item, direction))
  toward.sort((a, b) => distance(current, a) - distance(current, b))
  return toward[0]?.id ?? current.id
}

export function focusItems(root: ParentNode): FocusItem[] {
  const nodes = root.querySelectorAll('button, select, input')
  const items: FocusItem[] = []
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement) || !node.id || node.closest('[hidden]')) {
      return
    }
    const rect = node.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return
    }
    const disabled = (node instanceof HTMLButtonElement || node instanceof HTMLSelectElement || node instanceof HTMLInputElement)
      && node.disabled
    items.push({ id: node.id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, disabled })
  })
  return items
}

export function paintFocus(root: ParentNode, id: string | null) {
  root.querySelectorAll('.is-focused').forEach((node) => node.classList.remove('is-focused'))
  if (!id) {
    return
  }
  const target = root.querySelector(`#${CSS.escape(id)}`)
  if (target instanceof HTMLElement) {
    target.classList.add('is-focused')
  }
}

function faces(from: FocusItem, to: FocusItem, direction: FocusDirection): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (direction === 'up') {
    return dy < -4 && Math.abs(dx) <= Math.abs(dy) * 1.6
  }
  if (direction === 'down') {
    return dy > 4 && Math.abs(dx) <= Math.abs(dy) * 1.6
  }
  if (direction === 'left') {
    return dx < -4 && Math.abs(dy) <= Math.abs(dx) * 1.6
  }
  return dx > 4 && Math.abs(dy) <= Math.abs(dx) * 1.6
}

function distance(from: FocusItem, to: FocusItem): number {
  return Math.hypot(to.x - from.x, to.y - from.y)
}
