import { persistentAtom } from '@nanostores/persistent'
import { defaultSettings, normalizeSettings } from '@src/settings/schema'
import type { Settings } from '@src/settings/schema'

export type { ActionName, DeviceChoice, PlayerSettings, PlayerSlot, Settings } from '@src/settings/schema'
export { defaultSettings, normalizeSettings, rebindKey, rebindPad } from '@src/settings/schema'

export const settingsStore = persistentAtom<Settings>('settings', defaultSettings(), {
  encode: JSON.stringify,
  decode: (value) => {
    try {
      return normalizeSettings(JSON.parse(value))
    } catch {
      return defaultSettings()
    }
  },
})
