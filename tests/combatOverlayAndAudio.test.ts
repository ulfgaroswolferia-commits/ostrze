import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { getPixArtMeta } from '../src/game/assets/pixArt';
import { ostrzeAudio } from '../src/game/audio/ostrzeAudio';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createEmptyOstrzeState } from '../src/game/rules/character';
import {
  classifyCombatLogEvent,
  formatEnemyResistances,
  resolveEnemyOriginId,
  resolveEnemyPixArtId
} from '../src/game/rules/combatEnemyMeta';
import { createRng } from '../src/game/rules/dice';
import { OstrzeModalUi } from '../src/game/ui/OstrzeModalUi';
import { CombatTargetOverlay } from '../src/game/ui/combatTargetOverlay';
import { escapeHtml } from '../src/game/ui/escapeHtml';

describe('Combat Target Overlay Metadata (.pix enemy portraits, resistances & SFX classifier)', () => {
  it('resolves 64x48 .pix portraits for all Prologue and Act 1 enemy types', () => {
    const cases: Array<[string, string, string]> = [
      ['npc_radogost', 'Instruktor Radogost', 'instruktor'],
      ['enemy_bandyta_1', 'Bandyta z Traktu', 'bandyta'],
      ['enemy_upior_1', 'Upiór Nocy (Zmora)', 'upior_zwiadowca'],
      ['enemy_wilk_1', 'Wilk z Watahy', 'wilk'],
      ['enemy_dzik_1', 'Dzik leśny', 'dzik'],
      ['enemy_klusownik_1', 'Kłusownik', 'klusownik'],
      ['enemy_maruder_1', 'Maruder', 'maruder'],
      ['enemy_herszt_1', 'Herszt zbójców', 'herszt_zbojcow']
    ];

    for (const [actorId, actorName, expectedPix] of cases) {
      const pixId = resolveEnemyPixArtId(actorId, actorName);
      expect(pixId, `Expected ${expectedPix} for ${actorId}`).toBe(expectedPix);
      const meta = getPixArtMeta(pixId!);
      expect(meta).not.toBeNull();
      expect(meta!.width).toBe(64);
      expect(meta!.height).toBe(48);
    }
  });

  it('extracts canonical resistances from origin/data/enemies.json (e.g. Upiór Nocy -90% cięte/kłute)', () => {
    const upiorId = resolveEnemyOriginId('enemy_upior_1', 'Upiór Nocy');
    expect(upiorId).toBe('upior_nocy');

    const tags = formatEnemyResistances(upiorId, ORIGIN_DATA);
    expect(tags.length).toBeGreaterThanOrEqual(2);
    expect(tags.some((t) => t.kind === 'resist' && t.label.includes('90%') && t.label.includes('cięte'))).toBe(true);
    expect(tags.some((t) => t.kind === 'resist' && t.label.includes('90%') && t.label.includes('kłute'))).toBe(true);
    expect(tags.some((t) => t.kind === 'weak' && t.label.includes('+100%') && t.label.includes('ogień'))).toBe(true);
  });

  it('classifies combat log lines into crit, hit, miss, or null and safely invokes WebAudio SFX in Node', () => {
    expect(classifyCombatLogEvent('⚔️ Cios krytyczny! Zadajesz 18 obrażeń.')).toBe('crit');
    expect(classifyCombatLogEvent('Bandyta zadaje 6 obrażeń.')).toBe('hit');
    expect(classifyCombatLogEvent('Wilk spudłował — szybki unik!')).toBe('miss');
    expect(classifyCombatLogEvent('Tura: Mściwój (7 AP)')).toBeNull();

    for (const kind of ['start', 'hit', 'crit', 'miss', 'victory', 'defeat'] as const) {
      expect(() => ostrzeAudio.playCombatSfx(kind)).not.toThrow();
    }
  });

  it('cleans up DOM roots and aborts window keydown listeners on destroy()', () => {
    const removedIds: string[] = [];
    const appendedEls: Array<{ id: string; className: string; remove: () => void }> = [];
    let abortSignal: AbortSignal | undefined;

    const origWindow = (globalThis as any).window;
    const origDoc = (globalThis as any).document;

    try {
      (globalThis as any).document = {
        getElementById: (id: string) => appendedEls.find((e) => e.id === id) ?? null,
        createElement: () => {
          const el = {
            id: '',
            className: '',
            innerHTML: '',
            querySelector: () => null,
            querySelectorAll: () => [],
            remove: () => {
              removedIds.push(el.id);
              const idx = appendedEls.indexOf(el);
              if (idx >= 0) appendedEls.splice(idx, 1);
            }
          };
          return el;
        },
        body: {
          appendChild: (el: any) => {
            appendedEls.push(el);
          }
        }
      };

      (globalThis as any).window = {
        addEventListener: (_type: string, _listener: unknown, opts?: { signal?: AbortSignal }) => {
          abortSignal = opts?.signal;
        }
      };

      const engine = new OstrzeEngineState();
      const state = createEmptyOstrzeState(ORIGIN_DATA, 42);
      const rng = createRng(42);

      const modalUi = new OstrzeModalUi(ORIGIN_DATA, state, rng);
      const targetOverlay = new CombatTargetOverlay(engine, ORIGIN_DATA);

      expect(appendedEls.map((e) => e.id)).toEqual([
        'ostrze-overlay-root',
        'ostrze-hub-root',
        'ostrze-toast-root',
        'ostrze-combat-target-root'
      ]);
      expect(abortSignal?.aborted).toBe(false);

      modalUi.destroy();
      targetOverlay.destroy();

      expect(abortSignal?.aborted).toBe(true);
      expect(appendedEls).toHaveLength(0);
      expect(removedIds).toEqual([
        'ostrze-overlay-root',
        'ostrze-hub-root',
        'ostrze-toast-root',
        'ostrze-combat-target-root'
      ]);
    } finally {
      (globalThis as any).window = origWindow;
      (globalThis as any).document = origDoc;
    }
  });

  it('memoizes CombatTargetOverlay.sync() and skips innerHTML rebuilds when target state has not changed', () => {
    let innerHtmlWrites = 0;
    let currentHtml = '';
    const origDoc = (globalThis as any).document;

    try {
      (globalThis as any).document = {
        getElementById: () => null,
        createElement: () => {
          const el: any = {
            id: '',
            querySelectorAll: () => [],
            remove: () => {}
          };
          Object.defineProperty(el, 'innerHTML', {
            get: () => currentHtml,
            set: (val: string) => {
              innerHtmlWrites++;
              currentHtml = val;
            }
          });
          return el;
        },
        body: {
          appendChild: () => {}
        }
      };

      const engine = new OstrzeEngineState();
      const enemy = engine.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
      engine.startCombatWithEnemy(enemy.id);

      const overlay = new CombatTargetOverlay(engine, ORIGIN_DATA);
      overlay.sync();
      expect(innerHtmlWrites).toBe(1);

      // Subsequent syncs with identical target HP/AP/statuses should early-return without touching innerHTML
      overlay.sync();
      overlay.sync();
      expect(innerHtmlWrites).toBe(1);

      // Mutating enemy HP triggers a DOM update
      enemy.combat!.hp -= 5;
      overlay.sync();
      expect(innerHtmlWrites).toBe(2);

      overlay.destroy();
    } finally {
      (globalThis as any).document = origDoc;
    }
  });

  it('escapes all 5 HTML special characters including single quotes via shared escapeHtml helper', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });
});
