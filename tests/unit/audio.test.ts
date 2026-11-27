import { describe, expect, it } from 'vitest'
import { clampGain, cueTones, musicNote } from '@src/audio/cues'
import { AudioEngine } from '@src/audio/engine'

describe('synthesized audio', () => {
  it('keeps every cue inside a short audible recipe', () => {
    for (const name of ['menu', 'hover', 'attack', 'hit', 'block', 'ko', 'round', 'win', 'critical', 'super'] as const) {
      const tones = cueTones(name)
      expect(tones.length).toBeGreaterThan(0)
      for (const tone of tones) {
        expect(tone.frequency).toBeGreaterThan(40)
        expect(tone.duration).toBeGreaterThan(0)
        expect(tone.duration).toBeLessThan(1)
        expect(tone.gain).toBeGreaterThan(0)
        expect(tone.gain).toBeLessThanOrEqual(1)
      }
    }
    expect(musicNote(0).frequency).toBe(musicNote(8).frequency)
    expect(musicNote(0, 'pit').frequency).not.toBe(musicNote(0, 'temple').frequency)
    expect(musicNote(-1).frequency).toBe(musicNote(7).frequency)
  })

  it('clamps volumes and remembers the last cue without a context', () => {
    expect(clampGain(-2)).toBe(0)
    expect(clampGain(Number.NaN)).toBe(0)
    expect(clampGain(1.4)).toBe(1)
    const engine = new AudioEngine(() => null)
    engine.setVolumes(2, -1)
    engine.play('hit')
    engine.setMusic(true)
    engine.update(1)
    expect(engine.snapshot()).toEqual({
      lastCue: 'hit',
      unlocked: false,
      music: true,
      musicVolume: 1,
      sfxVolume: 0,
    })
  })

  it('schedules tones once a context exists', () => {
    const started: string[] = []
    let stopped = 0
    const engine = new AudioEngine(() => ({
      currentTime: 0,
      destination: {} as AudioNode,
      state: 'running',
      resume: () => Promise.resolve(),
      createOscillator: () => ({
        type: 'sine',
        frequency: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        start() { started.push('start') },
        stop() { stopped += 1 },
      }) as unknown as OscillatorNode,
      createGain: () => ({
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      }) as unknown as GainNode,
    }))
    engine.unlock()
    engine.setVolumes(0.4, 0.8)
    engine.play('attack')
    engine.setMusic(true)
    engine.update(0.34)
    expect(engine.snapshot().unlocked).toBe(true)
    expect(engine.snapshot().lastCue).toBe('attack')
    expect(started.length).toBeGreaterThan(1)
    engine.cut()
    expect(stopped).toBeGreaterThan(0)
    expect(engine.snapshot().lastCue).toBeNull()
  })
})