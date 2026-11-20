import { describe, expect, it } from 'vitest';
import { getPixArtMeta } from '../src/game/assets/pixArt';
import { ostrzeAudio } from '../src/game/audio/ostrzeAudio';
import { ORIGIN_DATA } from '../src/game/data/originData';
import {
  classifyCombatLogEvent,
  formatEnemyResistances,
  resolveEnemyOriginId,
  resolveEnemyPixArtId
} from '../src/game/rules/combatEnemyMeta';

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
});
