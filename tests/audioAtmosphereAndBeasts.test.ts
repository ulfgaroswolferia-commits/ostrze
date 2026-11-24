import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyFootstepSurface, ostrzeAudio } from '../src/game/audio/ostrzeAudio';
import { ORIGIN_DATA } from '../src/game/data/originData';

function createFakeAudioContext() {
  let startedSources = 0;
  let stoppedSources = 0;
  let startedOscillators = 0;
  let stoppedOscillators = 0;

  const makeParam = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn()
  });

  class FakeAudioContext {
    public state: AudioContextState = 'running';
    public sampleRate = 44100;
    public currentTime = 1.0;
    public destination = {};

    resume = vi.fn().mockResolvedValue(undefined);

    createBuffer(_ch: number, length: number) {
      const buf = new Float32Array(length);
      return {
        getChannelData: () => buf
      };
    }

    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(() => {
          startedSources++;
        }),
        stop: vi.fn(() => {
          stoppedSources++;
        })
      };
    }

    createOscillator() {
      return {
        type: 'sine' as OscillatorType,
        frequency: makeParam(),
        connect: vi.fn(),
        start: vi.fn(() => {
          startedOscillators++;
        }),
        stop: vi.fn(() => {
          stoppedOscillators++;
        })
      };
    }

    createBiquadFilter() {
      return {
        type: 'lowpass' as BiquadFilterType,
        frequency: makeParam(),
        Q: makeParam(),
        connect: vi.fn()
      };
    }

    createGain() {
      return {
        gain: makeParam(),
        connect: vi.fn(),
        disconnect: vi.fn()
      };
    }
  }

  return {
    FakeAudioContext,
    counts: () => ({ startedSources, stoppedSources, startedOscillators, stoppedOscillators }),
    resetCounts: () => {
      startedSources = 0;
      stoppedSources = 0;
      startedOscillators = 0;
      stoppedOscillators = 0;
    }
  };
}

describe('OstrzeAudioManager atmospheric phenomena & beast SFX', () => {
  const prevWindow = (globalThis as unknown as { window?: unknown }).window;
  const prevStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;
  const fake = createFakeAudioContext();

  beforeEach(() => {
    vi.useFakeTimers();
    fake.resetCounts();
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v)
    };
    (globalThis as unknown as { window: unknown }).window = {
      AudioContext: fake.FakeAudioContext
    };
  });

  afterEach(() => {
    ostrzeAudio.stopAmbience();
    ostrzeAudio.stopPhenomenonAudio();
    ostrzeAudio.setMuted(false);
    vi.useRealTimers();
    (globalThis as unknown as { window?: unknown }).window = prevWindow;
    (globalThis as unknown as { localStorage?: unknown }).localStorage = prevStorage;
  });

  it('activates and cleanly tears down audio beds for all 9 phenomena and respects mute', () => {
    expect(ORIGIN_DATA.phenomena.length).toBe(9);
    for (const ph of ORIGIN_DATA.phenomena) {
      ostrzeAudio.setPhenomenonAudio(ph.id);
      expect(ostrzeAudio.getActivePhenomenonAudio()).toBe(ph.id);
    }

    // Muting stops active nodes while remembering the active phenomenon for unmute restore
    ostrzeAudio.setMuted(true);
    expect(ostrzeAudio.getMuted()).toBe(true);
    expect(ostrzeAudio.getActivePhenomenonAudio()).toBe(ORIGIN_DATA.phenomena[ORIGIN_DATA.phenomena.length - 1].id);

    ostrzeAudio.setMuted(false);
    expect(ostrzeAudio.getMuted()).toBe(false);

    ostrzeAudio.stopPhenomenonAudio();
    expect(ostrzeAudio.getActivePhenomenonAudio()).toBeNull();
    const stats = fake.counts();
    expect(stats.startedSources + stats.startedOscillators).toBeGreaterThan(0);
    expect(stats.stoppedSources + stats.stoppedOscillators).toBeGreaterThan(0);
  });

  it('plays procedural attack voices for all Act I-II beasts and spirits', () => {
    const beasts = ['wilk', 'dzik', 'zmija_lesna', 'utopiec', 'blednik', 'skrzat_zlosnik', 'upior_nocy'];
    for (const id of beasts) {
      expect(ostrzeAudio.playEnemyAttackVoice(id)).toBe(true);
    }
    expect(ostrzeAudio.playEnemyAttackVoice('bandyta')).toBe(false);
    expect(ostrzeAudio.playEnemyAttackVoice(null)).toBe(false);

    const stats = fake.counts();
    expect(stats.startedOscillators).toBeGreaterThan(0);
    expect(stats.startedSources).toBeGreaterThan(0);
  });

  it('runs location ambience with periodic accents and stops cleanly without timer leaks', () => {
    ostrzeAudio.setAmbience('forest');
    expect(ostrzeAudio.getActiveAmbience()).toBe('forest');
    const beforeTicks = fake.counts().startedOscillators;
    vi.advanceTimersByTime(8000);
    expect(fake.counts().startedOscillators).toBeGreaterThan(beforeTicks);

    ostrzeAudio.stopAmbience();
    expect(ostrzeAudio.getActiveAmbience()).toBe('none');
    const afterStop = fake.counts().startedOscillators;
    vi.advanceTimersByTime(20000);
    expect(fake.counts().startedOscillators).toBe(afterStop);
  });

  it('classifies terrain surfaces and synthesizes footsteps, campfire crackle, and nocturnal accents', () => {
    expect(classifyFootstepSurface('forest_grass')).toBe('grass');
    expect(classifyFootstepSurface('forest_soil')).toBe('grass');
    expect(classifyFootstepSurface('dirt_path')).toBe('dirt');
    expect(classifyFootstepSurface('dungeon_stone')).toBe('stone');
    expect(classifyFootstepSurface('abyss_water')).toBe('water');

    const before = fake.counts();
    ostrzeAudio.playFootstep('forest_grass', false);
    vi.advanceTimersByTime(350);
    ostrzeAudio.playFootstep('dungeon_stone', true);
    ostrzeAudio.playCampfireCrackle(0.8);
    ostrzeAudio.playNocturnalAccent('owl');
    ostrzeAudio.playNocturnalAccent('crickets');

    const after = fake.counts();
    expect(after.startedSources).toBeGreaterThan(before.startedSources);
    expect(after.startedOscillators).toBeGreaterThan(before.startedOscillators);
  });
});
