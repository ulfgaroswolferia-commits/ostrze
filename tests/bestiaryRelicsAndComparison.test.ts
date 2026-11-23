import { describe, expect, it } from 'vitest';
import { ORIGIN_DATA } from '../src/game/data/originData';
import {
  RELIKTY_ITEMS,
  SECRET_CACHES,
  tryOpenSecretCache
} from '../src/game/data/secretCachesAndRelics';
import {
  evaluateBestiaryEntries,
  getHunterLoreBonusDamage,
  recordBestiaryEncounter,
  recordBestiaryKill
} from '../src/game/rules/bestiary';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { describeItemStatsAndComparison } from '../src/game/rules/itemComparison';
import { getStats } from '../src/game/rules/stats';

function createTesterState(bystrosc = 7) {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 123);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 6,
        zrecznosc: 6,
        krzepa: 6,
        bystrosc,
        rozum: 6,
        oglada: 5,
        fart: 12 - bystrosc
      },
      tagged: ['sieczna', 'skradanie', 'wiedza_tajemna']
    },
    ORIGIN_DATA
  );
  return state;
}

describe('Bestiary & Hunter Lore, Item Comparison, and 6 Secret Caches / Relics', () => {
  it('unlocks Bestiary entries on encounter and grants +1 Hunter Lore bonus damage after 3 kills', () => {
    const state = createTesterState();
    expect(getHunterLoreBonusDamage(state, 'wilk')).toBe(0);

    recordBestiaryEncounter(state, 'wilk');
    let entries = evaluateBestiaryEntries(state, ORIGIN_DATA);
    const wolfEntry = entries.find((e) => e.id === 'wilk')!;
    expect(wolfEntry.unlocked).toBe(true);
    expect(wolfEntry.killCount).toBe(0);
    expect(wolfEntry.hunterLoreActive).toBe(false);

    recordBestiaryKill(state, 'wilk');
    recordBestiaryKill(state, 'wilk');
    expect(getHunterLoreBonusDamage(state, 'wilk')).toBe(0);

    const third = recordBestiaryKill(state, 'wilk');
    expect(third.newKillCount).toBe(3);
    expect(third.justUnlockedHunterLore).toBe(true);
    expect(getHunterLoreBonusDamage(state, 'wilk')).toBe(1);

    entries = evaluateBestiaryEntries(state, ORIGIN_DATA);
    expect(entries.find((e) => e.id === 'wilk')!.hunterLoreActive).toBe(true);
  });

  it('computes item stat badges and upgrade/downgrade deltas against equipped gear', () => {
    const state = createTesterState();
    // Equip basic tunic (armor 1)
    state.inventory.equipped.tulow = 'przeszywanica';
    const relicMail = ORIGIN_DATA.items.find((i) => i.id === 'relikt_kolczuga_gwardii')!;
    expect(relicMail).toBeDefined();

    const cmp = describeItemStatsAndComparison(relicMail, state, ORIGIN_DATA);
    expect(cmp.equipSlot).toBe('tulow');
    expect(cmp.statBadges.some((b) => b.includes('Pancerz 5'))).toBe(true);
    expect(cmp.statBadges.some((b) => b.includes('+10 HP'))).toBe(true);
    expect(cmp.diffBadges.some((d) => d.kind === 'up' && d.text.includes('▲'))).toBe(true);
  });

  it('validates all 6 secret caches and 6 unique relics across Act I and Act II', () => {
    expect(RELIKTY_ITEMS.length).toBe(6);
    expect(Object.keys(SECRET_CACHES).length).toBe(6);

    // Low perception/stealth fails requirement
    const lowState = createEmptyOstrzeState(ORIGIN_DATA, 55);
    createCharacter(
      lowState,
      {
        name: 'Ślepy',
        classId: 'miecz',
        attributes: {
          sila: 8,
          zrecznosc: 5,
          krzepa: 8,
          bystrosc: 4,
          rozum: 6,
          oglada: 5,
          fart: 5
        },
        tagged: ['sieczna', 'wymowa', 'handel']
      },
      ORIGIN_DATA
    );
    const blocked = tryOpenSecretCache('skrytka_wilcza_nora', lowState, ORIGIN_DATA);
    expect(blocked.handled).toBe(true);
    expect(blocked.opened).toBe(false);

    // High perception/stealth opens all 6 caches once and grants all 6 relics
    const heroState = createTesterState(7);
    for (const cacheId of Object.keys(SECRET_CACHES)) {
      const cacheDef = SECRET_CACHES[cacheId];
      const res = tryOpenSecretCache(cacheId, heroState, ORIGIN_DATA);
      expect(res.handled).toBe(true);
      expect(res.opened).toBe(true);
      expect(heroState.inventory.items.some((i) => i.id === cacheDef.relicId && i.qty > 0)).toBe(true);

      // Second attempt reports already opened
      const again = tryOpenSecretCache(cacheId, heroState, ORIGIN_DATA);
      expect(again.alreadyOpened).toBe(true);
      expect(again.opened).toBe(false);
    }

    // Equipping relics boosts derived stats
    const baseHpMax = getStats(heroState, ORIGIN_DATA).derived.hpMax;
    heroState.inventory.equipped.plaszcz = 'relikt_plaszcz_wilczy';
    heroState.inventory.equipped.tulow = 'relikt_kolczuga_gwardii';
    const boostedHpMax = getStats(heroState, ORIGIN_DATA).derived.hpMax;
    expect(boostedHpMax).toBeGreaterThanOrEqual(baseHpMax + 15);
  });
});
