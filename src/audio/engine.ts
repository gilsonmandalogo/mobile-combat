import { clampGain, cueTones, musicNote } from '@src/audio/cues'
import type { CueName, Tone } from '@src/audio/cues'

export interface AudioSnapshot {
  lastCue: CueName | null
  unlocked: boolean
  music: boolean
  musicVolume: number
  sfxVolume: number
}

interface ToneContext {
  currentTime: number
  destination: AudioNode
  state: AudioContextState
  resume: () => Promise<void>
  createOscillator: () => OscillatorNode
  createGain: () => GainNode
}

export class AudioEngine {
  private context: ToneContext | null = null
  private lastCue: CueName | null = null
  private music = false
  private musicVolume = 0.35
  private sfxVolume = 0.7
  private musicClock = 0
  private musicStep = 0
  private theme = 'temple'
  private live: Array<{ stop: () => void }> = []

  constructor(private readonly createContext: () => ToneContext | null = defaultContext) {}

  unlock() {
    if (!this.context) {
      this.context = this.createContext()
    }
    if (this.context && this.context.state === 'suspended') {
      void this.context.resume()
    }
  }

  setVolumes(musicVolume: number, sfxVolume: number) {
    this.musicVolume = clampGain(musicVolume)
    this.sfxVolume = clampGain(sfxVolume)
  }

  setMusic(enabled: boolean) {
    this.music = enabled
  }

  setTheme(theme: string) {
    if (theme !== this.theme) {
      this.theme = theme
      this.musicStep = 0
    }
  }

  play(cue: CueName) {
    this.lastCue = cue
    this.voice(cueTones(cue), this.sfxVolume)
  }

  /** Stops the cues that are still sounding. A discarded prediction uses this. */
  cut() {
    for (const voice of this.live) {
      try {
        voice.stop()
      } catch {
        // already stopped
      }
    }
    this.live = []
    this.lastCue = null
  }

  update(dt: number) {
    if (!this.music || this.musicVolume <= 0) {
      return
    }
    this.musicClock += dt
    const spacing = 0.34
    while (this.musicClock >= spacing) {
      this.musicClock -= spacing
      this.voice([musicNote(this.musicStep, this.theme)], this.musicVolume * 0.55)
      this.musicStep += 1
    }
  }

  snapshot(): AudioSnapshot {
    return {
      lastCue: this.lastCue,
      unlocked: this.context !== null,
      music: this.music,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
    }
  }

  private voice(tones: Tone[], volume: number) {
    const context = this.context
    if (!context || volume <= 0) {
      return
    }
    let when = context.currentTime
    for (const tone of tones) {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = tone.type
      osc.frequency.setValueAtTime(tone.frequency, when)
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, tone.slide), when + tone.duration)
      gain.gain.setValueAtTime(tone.gain * volume, when)
      gain.gain.exponentialRampToValueAtTime(0.0001, when + tone.duration)
      osc.connect(gain)
      gain.connect(context.destination)
      osc.start(when)
      osc.stop(when + tone.duration + 0.02)
      this.live.push(osc)
      when += tone.duration * 0.72
    }
  }
}

function defaultContext(): ToneContext | null {
  if (typeof window === 'undefined') {
    return null
  }
  const Context = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) {
    return null
  }
  try {
    return new Context()
  } catch {
    return null
  }
}
