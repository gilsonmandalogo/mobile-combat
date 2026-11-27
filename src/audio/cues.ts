export type CueName = 'menu' | 'hover' | 'attack' | 'hit' | 'block' | 'ko' | 'round' | 'win' | 'critical' | 'super'

export interface Tone {
  frequency: number
  duration: number
  type: OscillatorType
  gain: number
  slide: number
}

const SCALES: Record<string, number[]> = {
  temple: [196, 220, 247, 262, 294, 247, 220, 196],
  pit: [110, 131, 147, 165, 147, 131, 110, 98],
  court: [262, 311, 349, 392, 349, 311, 262, 233],
}

export function clampGain(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 0
  }
  return Math.min(1, Math.max(0, volume))
}

export function cueTones(name: CueName): Tone[] {
  switch (name) {
  case 'menu':
    return [tone(660, 0.06, 'square', 0.25, 880)]
  case 'hover':
    return [tone(880, 0.035, 'sine', 0.08, 990)]
  case 'attack':
    return [tone(220, 0.09, 'sawtooth', 0.35, 90)]
  case 'hit':
    return [tone(140, 0.12, 'square', 0.5, 50)]
  case 'block':
    return [tone(320, 0.08, 'triangle', 0.3, 180)]
  case 'ko':
    return [tone(440, 0.12, 'sawtooth', 0.4, 220), tone(180, 0.28, 'square', 0.45, 60)]
  case 'round':
    return [tone(523, 0.1, 'triangle', 0.28, 523), tone(784, 0.16, 'triangle', 0.28, 784)]
  case 'win':
    return [tone(523, 0.12, 'square', 0.3, 523), tone(659, 0.12, 'square', 0.3, 659), tone(784, 0.28, 'square', 0.34, 1046)]
  case 'critical':
    return [tone(880, 0.08, 'square', 0.55, 220), tone(180, 0.22, 'sawtooth', 0.6, 60)]
  case 'super':
    return [tone(110, 0.16, 'sawtooth', 0.55, 55), tone(440, 0.2, 'square', 0.4, 880)]
  }
}

export function musicNote(step: number, theme = 'temple'): Tone {
  const scale = SCALES[theme] ?? SCALES.temple
  const index = ((Math.floor(step) % scale.length) + scale.length) % scale.length
  return tone(scale[index], 0.32, 'triangle', 0.18, scale[index])
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  slide: number,
): Tone {
  return { frequency, duration, type, gain, slide }
}
