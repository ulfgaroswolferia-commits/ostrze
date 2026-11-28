import { describe, expect, it } from 'vitest';
import { AMBIENCE_SAMPLE_MAP, COMBAT_SAMPLE_MAP, CombatAudioEngine } from '@ulf/audio/combatAudio';
import { IsoSceneView } from '@ulf/renderer/isoSceneView';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';

describe('Audit Fala 3 — Engine performance, disposal & audio paths', () => {
  it('uses relative ./audio/... URLs in CombatAudioEngine sample maps for base: "./" compatibility', () => {
    for (const urls of Object.values(COMBAT_SAMPLE_MAP)) {
      for (const u of urls) {
        expect(u.startsWith('./audio/')).toBe(true);
      }
    }
    for (const urls of Object.values(AMBIENCE_SAMPLE_MAP)) {
      for (const u of urls) {
        expect(u.startsWith('./audio/')).toBe(true);
      }
    }
  });

  it('lazily initializes AudioContext on first playSound() call instead of staying muted', () => {
    let createdCount = 0;
    let soundNodesStarted = 0;
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      sampleRate = 44100;
      destination = {};
      constructor() {
        createdCount += 1;
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        return Promise.resolve();
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
            linearRampToValueAtTime() {}
          },
          connect() {}
        };
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
          start() {
            soundNodesStarted += 1;
          },
          stop() {}
        };
      }
      createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          Q: { value: 1, setValueAtTime() {} },
          connect() {}
        };
      }
      createBuffer(_ch: number, len: number) {
        return { getChannelData: () => new Float32Array(Math.max(1, Math.floor(len))) };
      }
      createBufferSource() {
        return {
          buffer: null,
          connect() {},
          start() {
            soundNodesStarted += 1;
          },
          stop() {}
        };
      }
    }

    const prevWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = { AudioContext: FakeAudioContext };
    try {
      const audio = new CombatAudioEngine();
      // Must NOT eagerly allocate AudioContext in constructor
      expect(createdCount).toBe(0);
      // First playSound() must lazily initialize context and emit audio
      audio.playSound('slash_blade');
      expect(createdCount).toBe(1);
      expect(soundNodesStarted).toBeGreaterThan(0);
      audio.dispose();
    } finally {
      if (prevWindow === undefined) {
        delete (globalThis as Record<string, unknown>).window;
      } else {
        (globalThis as Record<string, unknown>).window = prevWindow;
      }
    }
  });

  it('unsubscribes combat attack listener and cleans up IsoSceneView safely on destroy()', () => {
    const engine = new OstrzeEngineState();
    const listeners = (engine as unknown as { combatAttackListeners: Set<unknown> }).combatAttackListeners;
    const beforeCount = listeners.size;
    const view = new IsoSceneView(engine);
    expect(listeners.size).toBe(beforeCount + 1);

    view.destroy();
    expect(listeners.size).toBe(beforeCount);
    // Second destroy must be a safe no-op
    expect(() => view.destroy()).not.toThrow();
  });
});
