import { describe, expect, it } from 'vitest';
import { AMBIENCE_SAMPLE_MAP, COMBAT_SAMPLE_MAP } from '@ulf/audio/combatAudio';
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
