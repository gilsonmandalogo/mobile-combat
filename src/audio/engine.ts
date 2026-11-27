import { clampGain, cueTones, musicNote } from '@src/audio/cues'
import type { CueName, Tone } from '@src/audio/cues'

/** How long a cue stays silent so a discarded prediction can cancel it. */
export const CUE_ARM_SECONDS = 0.05

/** How quickly a cue that already started fades when a prediction is dropped. */
export const CUE_RELEASE_SECONDS = 0.012

export interface AudioSnapshot {
  lastCue: CueName | null
  unlocked: boolean
  music: boolean
  musicVolume: number
  sfxVolume: number
  arm: number
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
  private sfx: Array<{ silence: () => void }> = []

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
    this.voice(cueTones(cue), this.sfxVolume, true)
  }

  /**
   * Drops every effect that has not finished.
   * A cue is scheduled a moment ahead at zero gain, so a cut during that
   * window removes the ramp and the tone never becomes audible. A cue that
   * has already started ramps to silence instead of ringing out.
   */
  cut() {
    for (const voice of this.sfx) {
      voice.silence()
    }
    this.sfx = []
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
      this.voice([musicNote(this.musicStep, this.theme)], this.musicVolume * 0.55, false)
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
      arm: CUE_ARM_SECONDS,
    }
  }

  private voice(tones: Tone[], volume: number, cancelable: boolean) {
    const context = this.context
    if (!context || volume <= 0) {
      return
    }
    const arm = cancelable ? CUE_ARM_SECONDS : 0
    let when = context.currentTime + arm
    for (const tone of tones) {
      const osc = context.createOscillator()
      const gain = context.createGain()
      const peak = Math.max(0.0002, tone.gain * volume)
      const attack = Math.min(0.03, tone.duration * 0.45)
      osc.type = tone.type
      osc.frequency.setValueAtTime(tone.frequency, when)
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, tone.slide), when + tone.duration)
      gain.gain.setValueAtTime(0.0001, when)
      gain.gain.exponentialRampToValueAtTime(peak, when + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, when + tone.duration)
      osc.connect(gain)
      gain.connect(context.destination)
      osc.start(when)
      const end = when + tone.duration + 0.02
      osc.stop(end)
      if (cancelable) {
        this.sfx.push({
          silence: () => {
            const now = context.currentTime
            try {
              gain.gain.cancelScheduledValues(now)
              const level = Math.max(0.0001, gain.gain.value || 0.0001)
              gain.gain.setValueAtTime(level, now)
              gain.gain.exponentialRampToValueAtTime(0.0001, now + CUE_RELEASE_SECONDS)
            } catch {
              // the context is already closed
            }
            if (now < when) {
              try {
                osc.stop(now)
              } catch {
                // stop was already scheduled; the zero gain keeps it silent
              }
            }
          },
        })
      }
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
