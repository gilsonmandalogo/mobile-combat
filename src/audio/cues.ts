export type CueName = 'menu' | 'attack' | 'hit' | 'block' | 'ko' | 'round' | 'win'

export interface Tone {
  frequency: number
  duration: number
  type: OscillatorType
  gain: number
  slide: number
}

const SCALE = [196, 220, 247, 262, 294, 247, 220, 196]

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
  }
}

export function musicNote(step: number): Tone {
  const index = ((Math.floor(step) % SCALE.length) + SCALE.length) % SCALE.length
  return tone(SCALE[index], 0.32, 'triangle', 0.18, SCALE[index])
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
