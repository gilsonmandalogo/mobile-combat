export interface PadButton {
  pressed: boolean
  value: number
}

export interface PadBindings {
  jump: number
  attackUp: number
  attackDown: number
  block: number
}

export interface PadSnapshot {
  index: number
  connected: boolean
  axes: number[]
  buttons: PadButton[]
  mapping: string
  id: string
  vibrate?: (strong: number, weak: number, duration: number) => boolean
}

export interface HapticActuator {
  pulse: (value: number, duration: number) => Promise<void> | void
}

export interface VibrationActuator {
  playEffect: (type: string, params: {
    startDelay: number
    duration: number
    weakMagnitude: number
    strongMagnitude: number
  }) => Promise<void> | void
}

/** Structural slice of the Gamepad API, including optional haptics. */
export interface HapticGamepad {
  index: number
  connected: boolean
  axes: readonly number[]
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>
  mapping: string
  id: string
  vibrationActuator?: VibrationActuator
  hapticActuators?: readonly HapticActuator[]
}

export const DEFAULT_PAD: PadBindings = {
  jump: 0,
  attackUp: 2,
  attackDown: 3,
  block: 5,
}

export const PAD_BUTTON_NAMES = [
  'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT',
  'Back', 'Start', 'LS', 'RS', 'Up', 'Down', 'Left', 'Right',
]

const AXIS_DEADZONE = 0.4

export function buttonName(index: number): string {
  return PAD_BUTTON_NAMES[index] ?? `Button ${index}`
}

export function gamepadIntent(
  pad: PadSnapshot | null,
  bindings: PadBindings,
  previouslyPressed: boolean[],
): { intent: { move: -1 | 0 | 1; jump: boolean; attackUp: boolean; attackDown: boolean; block: boolean }; pressed: boolean[] } {
  if (!pad || !pad.connected) {
    return {
      intent: { move: 0, jump: false, attackUp: false, attackDown: false, block: false },
      pressed: previouslyPressed,
    }
  }

  const axis = pad.axes[0] ?? 0
  const dpadLeft = Boolean(pad.buttons[14]?.pressed)
  const dpadRight = Boolean(pad.buttons[15]?.pressed)
  let move: -1 | 0 | 1 = 0
  if (dpadLeft && !dpadRight) {
    move = -1
  } else if (dpadRight && !dpadLeft) {
    move = 1
  } else if (axis < -AXIS_DEADZONE) {
    move = -1
  } else if (axis > AXIS_DEADZONE) {
    move = 1
  }

  const pressed = pad.buttons.map((button) => Boolean(button?.pressed))
  const edge = (index: number) => pressed[index] === true && previouslyPressed[index] !== true

  return {
    intent: {
      move,
      jump: edge(bindings.jump),
      attackUp: edge(bindings.attackUp),
      attackDown: edge(bindings.attackDown),
      block: pressed[bindings.block] === true,
    },
    pressed,
  }
}

export function vibrateGamepad(pad: HapticGamepad | null | undefined, strong: number, weak: number, duration: number): boolean {
  if (!pad) {
    return false
  }

  const strongMagnitude = clampUnit(strong)
  const weakMagnitude = clampUnit(weak)
  const actuator = pad.vibrationActuator
  if (actuator && typeof actuator.playEffect === 'function') {
    try {
      const pending = actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        weakMagnitude,
        strongMagnitude,
      })
      if (pending && typeof pending.catch === 'function') {
        pending.catch(() => undefined)
      }
      return true
    } catch {
      return false
    }
  }

  const haptic = pad.hapticActuators?.[0]
  if (haptic && typeof haptic.pulse === 'function') {
    try {
      const pending = haptic.pulse(Math.max(strongMagnitude, weakMagnitude), duration)
      if (pending && typeof pending.catch === 'function') {
        pending.catch(() => undefined)
      }
      return true
    } catch {
      return false
    }
  }

  return false
}

export function snapshotGamepad(pad: HapticGamepad): PadSnapshot {
  return {
    index: pad.index,
    connected: pad.connected,
    axes: Array.from(pad.axes || []),
    buttons: Array.from(pad.buttons || []).map((button) => ({
      pressed: Boolean(button.pressed),
      value: button.value,
    })),
    mapping: pad.mapping,
    id: pad.id,
    vibrate: (strong, weak, duration) => vibrateGamepad(pad, strong, weak, duration),
  }
}

export function mergeGamepads(native: Array<HapticGamepad | null> | null, virtual: PadSnapshot[]): PadSnapshot[] {
  const merged = (native ?? []).filter((pad): pad is HapticGamepad => Boolean(pad && pad.connected)).map(snapshotGamepad)
  for (const pad of virtual) {
    const existing = merged.findIndex((item) => item.index === pad.index)
    if (existing >= 0) {
      merged[existing] = pad
    } else {
      merged.push(pad)
    }
  }
  return merged
}

function clampUnit(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}
