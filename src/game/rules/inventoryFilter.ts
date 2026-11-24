import type { ItemDef, OriginGameData, OstrzeGameState } from '../data/originTypes';

export type InventoryCategoryFilter = 'all' | 'weapon' | 'armor' | 'consumable' | 'other';

export interface InventoryEntry {
  id: string;
  qty: number;
}

export function classifyInventoryItem(
  item: ItemDef | undefined
): Exclude<InventoryCategoryFilter, 'all'> {
  if (!item) return 'other';
  if (item.type === 'weapon' || item.slot === 'bron') return 'weapon';
  if (
    item.type === 'armor' ||
    item.slot === 'pancerz' ||
    item.slot === 'tarcza' ||
    item.slot === 'helm' ||
    item.slot === 'talizman'
  ) {
    return 'armor';
  }
  if (
    item.type === 'consumable' ||
    (Array.isArray(item.heal) && item.heal[1] > 0) ||
    (typeof item.healHp === 'number' && item.healHp > 0) ||
    (Array.isArray(item.removes) && item.removes.length > 0)
  ) {
    return 'consumable';
  }
  return 'other';
}

export function countInventoryByCategory(
  items: readonly InventoryEntry[],
  data: OriginGameData
): Record<InventoryCategoryFilter, number> {
  const counts: Record<InventoryCategoryFilter, number> = {
    all: items.length,
    weapon: 0,
    armor: 0,
    consumable: 0,
    other: 0
  };
  for (const entry of items) {
    const def = data.items.find((i) => i.id === entry.id);
    counts[classifyInventoryItem(def)]++;
  }
  return counts;
}

export function isInventoryEntryEquipped(
  entryId: string,
  equipped: OstrzeGameState['inventory']['equipped'],
  item: ItemDef | undefined
): boolean {
  const slot = item?.slot ?? (item?.type === 'weapon' ? 'bron' : undefined);
  return Boolean(slot && equipped[slot] === entryId);
}

/**
 * Filters backpack entries by category and pins equipped items at the top,
 * followed by Polish alphabetical order.
 */
export function filterAndSortInventoryEntries(
  items: readonly InventoryEntry[],
  equipped: OstrzeGameState['inventory']['equipped'],
  data: OriginGameData,
  category: InventoryCategoryFilter
): InventoryEntry[] {
  const filtered = items.filter((entry) => {
    if (category === 'all') return true;
    const def = data.items.find((i) => i.id === entry.id);
    return classifyInventoryItem(def) === category;
  });

  return [...filtered].sort((a, b) => {
    const defA = data.items.find((i) => i.id === a.id);
    const defB = data.items.find((i) => i.id === b.id);
    const eqA = isInventoryEntryEquipped(a.id, equipped, defA) ? 1 : 0;
    const eqB = isInventoryEntryEquipped(b.id, equipped, defB) ? 1 : 0;
    if (eqA !== eqB) return eqB - eqA;
    const nameA = defA?.name ?? a.id;
    const nameB = defB?.name ?? b.id;
    return nameA.localeCompare(nameB, 'pl');
  });
}
