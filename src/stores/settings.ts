import { persistentAtom } from '@nanostores/persistent'

export type InputType = 'keyboard' | 'touch'

export interface PlayerInputs {
  left: string
  right: string
  jump: string
  attackUp: string
  attackDown: string
  block: string
}

interface SettingsValues {
  debug: boolean
  inputs: {
    player1: PlayerInputs
    player2: PlayerInputs
    menu: string
  }
  inputType: InputType
}

export const settingsStore = persistentAtom<SettingsValues>('settings', {
  debug: false,
  inputs: {
    player1: {
      left: 'KeyA',
      right: 'KeyD',
      jump: 'Space',
      attackUp: 'KeyG',
      attackDown: 'KeyV',
      block: 'KeyY',
    },
    player2: {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      jump: 'ControlRight',
      attackUp: 'Equal',
      attackDown: 'BracketRight',
      block: 'Backslash',
    },
    menu: 'Escape',
  },
  inputType: 'keyboard',
}, {
  encode: JSON.stringify,
  decode: JSON.parse,
})
