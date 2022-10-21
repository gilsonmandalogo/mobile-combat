const debugDiv = document.getElementById('debug') as HTMLDivElement
const debugData = new Map<string, any>()

export function updateDebug(key: string, value: any) {
  debugData.set(key, value)
  let data = ''
  for (const [itemKey, itemValue] of debugData) {
    data += `${itemKey}: ${String(itemValue)}\n`
  }
  debugDiv.textContent = data
}
