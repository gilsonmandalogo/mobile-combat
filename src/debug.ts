import { settingsStore } from '@stores/settings'

const debugDiv = document.getElementById('debug') as HTMLDivElement
const debugData = new Map<string, any>()
let debug: boolean

settingsStore.subscribe(store => {
  debug = store.debug
  debugDiv.style.display = debug ? 'block' : 'none'
})

export function updateDebug(key: string, value: any) {
  debugData.set(key, value)

  if (!debug) {
    return
  }

  let data = ''
  for (const [itemKey, itemValue] of debugData) {
    data += `${itemKey}: ${String(itemValue)}\n`
  }
  debugDiv.textContent = data
}
