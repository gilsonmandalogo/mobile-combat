import { describe, expect, it } from 'vitest'
import { clampGain, cueTones, musicNote } from '@src/audio/cues'
import { AudioEngine, CUE_ARM_SECONDS, CUE_RELEASE_SECONDS } from '@src/audio/engine'

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
      arm: CUE_ARM_SECONDS,
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
          value: 0.0001,
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
          cancelScheduledValues() {},
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

  it('keeps a discarded cue silent and does not replay it on its own', () => {
    const clock = { time: 4 }
    const starts: number[] = []
    const stops: number[] = []
    const gains: Array<{ calls: Array<{ op: string; value: number; time: number }>; cancels: number; value: number }> = []
    const engine = new AudioEngine(() => ({
      get currentTime() {
        return clock.time
      },
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
        start(time: number) { starts.push(time) },
        stop(time: number) { stops.push(time) },
      }) as unknown as OscillatorNode,
      createGain: () => {
        const record = { calls: [] as Array<{ op: string; value: number; time: number }>, cancels: 0, value: 0.0001 }
        gains.push(record)
        return {
          gain: {
            get value() {
              return record.value
            },
            set value(next: number) {
              record.value = next
            },
            setValueAtTime(value: number, time: number) {
              record.calls.push({ op: 'set', value, time })
            },
            exponentialRampToValueAtTime(value: number, time: number) {
              record.calls.push({ op: 'ramp', value, time })
            },
            cancelScheduledValues() {
              record.cancels += 1
              record.calls = []
            },
          },
          connect() {},
        } as unknown as GainNode
      },
    }))
    engine.unlock()
    engine.setVolumes(0.5, 1)
    engine.play('hit')
    expect(starts).toEqual([4 + CUE_ARM_SECONDS])
    expect(gains[0].calls[0]).toEqual({ op: 'set', value: 0.0001, time: 4 + CUE_ARM_SECONDS })
    expect(gains[0].calls.some((call) => call.op === 'ramp' && call.value > 0.1)).toBe(true)

    engine.cut()
    expect(gains[0].cancels).toBe(1)
    expect(gains[0].calls.every((call) => call.value <= 0.0001)).toBe(true)
    expect(stops.some((time) => time <= 4)).toBe(true)
    expect(engine.snapshot().lastCue).toBeNull()

    engine.play('block')
    expect(starts).toHaveLength(2)
    expect(engine.snapshot().lastCue).toBe('block')
    const scheduled = starts.length
    expect(engine.snapshot().lastCue).toBe('block')
    expect(starts).toHaveLength(scheduled)

    clock.time = 4 + CUE_ARM_SECONDS + 0.02
    gains[1].value = 0.25
    engine.cut()
    const release = gains[1].calls.find((call) => call.op === 'ramp')
    expect(release?.value).toBe(0.0001)
    expect(release?.time).toBeCloseTo(clock.time + CUE_RELEASE_SECONDS)
    expect(engine.snapshot().lastCue).toBeNull()
  })
})