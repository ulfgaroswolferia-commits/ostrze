import { describe, expect, it } from 'vitest';
import { ORIGIN_DATA } from '../src/game/data/originData';
import {
  classifyInventoryItem,
  countInventoryByCategory,
  filterAndSortInventoryEntries
} from '../src/game/rules/inventoryFilter';

describe('Inventory Category Filtering & Sorting Ergonomics', () => {
  it('classifies weapons, armor, consumables, and quest/other items accurately', () => {
    const weapon = ORIGIN_DATA.items.find((i) => i.type === 'weapon');
    const armor = ORIGIN_DATA.items.find((i) => i.type === 'armor');
    const consumable = ORIGIN_DATA.items.find(
      (i) => i.type === 'consumable' || (Array.isArray(i.heal) && i.heal[1] > 0)
    );

    expect(weapon).toBeDefined();
    expect(armor).toBeDefined();
    expect(consumable).toBeDefined();

    expect(classifyInventoryItem(weapon)).toBe('weapon');
    expect(classifyInventoryItem(armor)).toBe('armor');
    expect(classifyInventoryItem(consumable)).toBe('consumable');
    expect(classifyInventoryItem(undefined)).toBe('other');
  });

  it('counts categories and pins equipped items at the top of filtered results', () => {
    const weapons = ORIGIN_DATA.items.filter((i) => i.type === 'weapon').slice(0, 2);
    const armor = ORIGIN_DATA.items.find((i) => i.type === 'armor')!;
    const consumable = ORIGIN_DATA.items.find((i) => i.type === 'consumable')!;
    expect(weapons.length).toBe(2);

    const entries = [
      { id: consumable.id, qty: 2 },
      { id: weapons[0].id, qty: 1 },
      { id: armor.id, qty: 1 },
      { id: weapons[1].id, qty: 1 }
    ];

    const counts = countInventoryByCategory(entries, ORIGIN_DATA);
    expect(counts.all).toBe(4);
    expect(counts.weapon).toBe(2);
    expect(counts.armor).toBe(1);
    expect(counts.consumable).toBe(1);

    // Equip the second weapon and verify it is pinned first in both 'all' and 'weapon'
    const equipped = { bron: weapons[1].id };
    const allSorted = filterAndSortInventoryEntries(entries, equipped, ORIGIN_DATA, 'all');
    expect(allSorted[0].id).toBe(weapons[1].id);

    const weaponsOnly = filterAndSortInventoryEntries(entries, equipped, ORIGIN_DATA, 'weapon');
    expect(weaponsOnly.map((e) => e.id)).toEqual([weapons[1].id, weapons[0].id]);

    const consumablesOnly = filterAndSortInventoryEntries(
      entries,
      equipped,
      ORIGIN_DATA,
      'consumable'
    );
    expect(consumablesOnly).toEqual([{ id: consumable.id, qty: 2 }]);
  });
});
