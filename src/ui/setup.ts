import type { Difficulty, MatchMode } from '@src/sim/types'
import type { DeviceChoice } from '@src/settings/schema'

export interface DeviceChoiceValue {
  device: DeviceChoice
  gamepadIndex: number
}

export interface MatchSetup {
  mode: MatchMode
  difficulty: Difficulty
  name1: string
  name2: string
  device1: DeviceChoiceValue
  device2: DeviceChoiceValue
}

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'nightmare']

export function parseDifficulty(value: string | null | undefined): Difficulty {
  return DIFFICULTIES.includes(value as Difficulty) ? value as Difficulty : 'normal'
}

export function parseDevice(value: string, fallbackIndex: number): DeviceChoiceValue {
  if (value === 'pad-0') {
    return { device: 'gamepad', gamepadIndex: 0 }
  }
  if (value === 'pad-1') {
    return { device: 'gamepad', gamepadIndex: 1 }
  }
  return { device: 'keyboard', gamepadIndex: fallbackIndex }
}

export function deviceValue(choice: DeviceChoiceValue): string {
  if (choice.device === 'gamepad') {
    return choice.gamepadIndex === 1 ? 'pad-1' : 'pad-0'
  }
  return 'keyboard'
}

export function readMatchSetup(input: {
  mode: string
  difficulty: string
  name1: string
  name2: string
  device1: string
  device2: string
}): MatchSetup {
  const mode: MatchMode = input.mode === 'ai' ? 'ai' : 'local'
  const difficulty = parseDifficulty(input.difficulty)
  return {
    mode,
    difficulty,
    name1: cleanName(input.name1, 'Player 1'),
    name2: cleanName(input.name2, 'Player 2'),
    device1: parseDevice(input.device1, 0),
    device2: parseDevice(input.device2, 1),
  }
}

function cleanName(value: string, fallback: string): string {
  const trimmed = value.trim().slice(0, 18)
  return trimmed || fallback
}
