import type { InventoryCategoryFilter } from '../rules/inventoryFilter';
import { escapeHtml } from './escapeHtml';

/**
 * Cohesive Slavic dark-fantasy inline SVG icon set (16x16 viewBox, consistent 1.45 stroke).
 * Used across Character Sheet, Shop, Campfire, Journal, Bestiary, and Chronicle modals
 * to replace raw OS emoji with forged-iron & brass iconography.
 */

export type SlavicIconId =
  | 'weapon'
  | 'armor'
  | 'helm'
  | 'cloak'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'talisman'
  | 'consumable'
  | 'pack'
  | 'coin'
  | 'shop'
  | 'quest'
  | 'check'
  | 'star'
  | 'candle'
  | 'beast'
  | 'trophy'
  | 'target'
  | 'tip'
  | 'dawn'
  | 'day'
  | 'dusk'
  | 'night'
  | 'info'
  | 'warn'
  | 'key'
  | 'lock'
  | 'all';

const ICON_PATHS: Readonly<Record<SlavicIconId, string>> = {
  all: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.8"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="0.8"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="0.8"/><rect x="9" y="9" width="4.5" height="4.5" rx="0.8"/>',
  weapon: '<path d="M13 2.5 6.5 9M13 2.5l-.6 3.2-5 5M5.2 7.8l3 3M3 13l2.7-2.7"/>',
  armor: '<path d="M8 2 3.2 4v3.8c0 3.1 2 5.2 4.8 6.2 2.8-1 4.8-3.1 4.8-6.2V4L8 2Z"/><path d="M8 4.8v6.2" opacity="0.6"/>',
  helm: '<path d="M3.5 9.5a4.5 4.5 0 0 1 9 0v2.8H3.5V9.5Z"/><path d="M8 5v4.5M5.5 9.5h5" opacity="0.7"/>',
  cloak: '<path d="M5.5 3 8 4.2 10.5 3l2.2 9.8-4.7-1.4-4.7 1.4L5.5 3Z"/><path d="M8 4.2v7.2" opacity="0.55"/>',
  gloves: '<path d="M5 13.2V7.8a1 1 0 0 1 2 0V6.2a1 1 0 0 1 2 0v.6a1 1 0 0 1 2 0v3.9l-1.2 2.5H5Z"/>',
  boots: '<path d="M5 3v6.5L3.2 11v2h9.2v-2.2L9.2 9.5V3H5Z"/>',
  belt: '<rect x="2.2" y="5.8" width="11.6" height="4.4" rx="1"/><rect x="6.4" y="5.2" width="3.2" height="5.6" rx="0.6"/><line x1="8" y1="7" x2="8" y2="9"/>',
  talisman: '<path d="M5.5 2.5c1.5 1.8 3.5 1.8 5 0"/><polygon points="8,5.4 11.4,9 8,13.5 4.6,9"/>',
  consumable: '<path d="M6.4 2.5h3.2M7 2.5v2.7L3.8 10.8a2 2 0 0 0 1.7 3h5a2 2 0 0 0 1.7-3L9 5.2V2.5"/><path d="M5.4 10h5.2" opacity="0.65"/>',
  pack: '<path d="M4.2 6.2a3.8 3.8 0 0 1 7.6 0v7H4.2v-7Z"/><path d="M6 6.2V4.8a2 2 0 0 1 4 0v1.4M6 9.5h4"/>',
  coin: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5.2v5.6M6.5 6.6h3" opacity="0.85"/>',
  shop: '<path d="M3 6.5h10l-.8 7H3.8l-.8-7Z"/><path d="M5.5 6.5V5a2.5 2.5 0 0 1 5 0v1.5"/>',
  quest: '<path d="M8 1.8l1.6 4.1 4.4.4-3.3 2.9 1 4.3L8 11.2 4.3 13.5l1-4.3L2 6.3l4.4-.4L8 1.8Z"/>',
  check: '<path d="M3.5 8.4 6.6 11.5 12.6 4.8"/>',
  star: '<polygon points="8,2 9.8,6 14,6.4 10.8,9.2 11.8,13.4 8,11.2 4.2,13.4 5.2,9.2 2,6.4 6.2,6"/>',
  candle: '<path d="M8 2.2c1.2 1.2 1.2 2.6 0 3.5-1.2-.9-1.2-2.3 0-3.5Z"/><rect x="6" y="7" width="4" height="6.5" rx="0.6"/><path d="M4.5 13.5h7"/>',
  beast: '<path d="M3 4.2 5.4 6.5h5.2L13 4.2l-.6 5.6L8 13.5 3.6 9.8 3 4.2Z"/><circle cx="6.2" cy="8.5" r="0.6" fill="currentColor"/><circle cx="9.8" cy="8.5" r="0.6" fill="currentColor"/>',
  trophy: '<path d="M4.8 3h6.4v3.4a3.2 3.2 0 0 1-6.4 0V3Z"/><path d="M4.8 4.2H3a1.5 1.5 0 0 0 1.8 2.4M11.2 4.2H13a1.5 1.5 0 0 1-1.8 2.4M8 9.6V13M5.4 13h5.2"/>',
  target: '<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2.6"/><circle cx="8" cy="8" r="0.7" fill="currentColor"/>',
  tip: '<path d="M5.8 11.2h4.4M6.4 13.2h3.2M5.2 8.2a3.4 3.4 0 1 1 5.6 0c-.5.6-.8 1.3-.8 2h-4c0-.7-.3-1.4-.8-2Z"/>',
  dawn: '<path d="M2.5 11.5h11M4.5 11.5a3.5 3.5 0 0 1 7 0M8 4v2M4.3 5.8l1.2 1.2M11.7 5.8l-1.2 1.2"/>',
  day: '<circle cx="8" cy="8" r="3"/><path d="M8 2.2v1.6M8 12.2v1.6M2.2 8h1.6M12.2 8h1.6M3.9 3.9l1.1 1.1M11 11l1.1 1.1M12.1 3.9 11 5M5 11l-1.1 1.1"/>',
  dusk: '<path d="M2.5 10.8h11M4.5 10.8a3.5 3.5 0 0 1 7 0M4.5 13h7" opacity="0.9"/>',
  night: '<path d="M11.6 10.2A4.8 4.8 0 0 1 5.8 4.4a5 5 0 1 0 5.8 5.8Z"/>',
  info: '<circle cx="8" cy="8" r="5.5"/><path d="M8 7.4v3.4M8 5.2h.01"/>',
  warn: '<path d="M8 2.4 14 13H2L8 2.4Z"/><path d="M8 6.4v3.2M8 11.2h.01"/>',
  key: '<circle cx="5.4" cy="8" r="2.8"/><path d="M8.2 8h5.6M11.6 8v2.2M13.6 8v1.6"/>',
  lock: '<rect x="3.5" y="7.2" width="9" height="6.3" rx="1.2"/><path d="M5.5 7.2V5.4a2.5 2.5 0 0 1 5 0v1.8"/>'
};

export const SLAVIC_ORNAMENT_SVG = `<svg class="ostrze-dlg-ornament-svg" viewBox="0 0 120 10" fill="none" aria-hidden="true"><line x1="0" y1="5" x2="46" y2="5" stroke="currentColor" stroke-opacity="0.38"/><polygon points="60,1 65,5 60,9 55,5" fill="currentColor" fill-opacity="0.72"/><circle cx="49" cy="5" r="1.2" fill="currentColor" fill-opacity="0.5"/><circle cx="71" cy="5" r="1.2" fill="currentColor" fill-opacity="0.5"/><line x1="74" y1="5" x2="120" y2="5" stroke="currentColor" stroke-opacity="0.38"/></svg>`;

export function renderSlavicIcon(id: SlavicIconId, className = 'ostrze-svg-ico'): string {
  const inner = ICON_PATHS[id] ?? ICON_PATHS.star;
  return `<svg class="${escapeHtml(className)}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

export type EquipmentSlotId =
  | 'bron'
  | 'glowa'
  | 'tulow'
  | 'plaszcz'
  | 'rece'
  | 'nogi'
  | 'pas'
  | 'talizman';

export const EQUIPMENT_SLOT_META: ReadonlyArray<{
  slot: EquipmentSlotId;
  label: string;
  icon: SlavicIconId;
}> = [
  { slot: 'bron', label: 'Broń', icon: 'weapon' },
  { slot: 'glowa', label: 'Głowa', icon: 'helm' },
  { slot: 'tulow', label: 'Tułów', icon: 'armor' },
  { slot: 'plaszcz', label: 'Płaszcz', icon: 'cloak' },
  { slot: 'rece', label: 'Ręce', icon: 'gloves' },
  { slot: 'nogi', label: 'Nogi', icon: 'boots' },
  { slot: 'pas', label: 'Pas', icon: 'belt' },
  { slot: 'talizman', label: 'Talizman', icon: 'talisman' }
];

export const INVENTORY_FILTER_META: ReadonlyArray<{
  id: InventoryCategoryFilter;
  label: string;
  icon: SlavicIconId;
}> = [
  { id: 'all', label: 'Wszystkie', icon: 'all' },
  { id: 'weapon', label: 'Broń', icon: 'weapon' },
  { id: 'armor', label: 'Pancerz', icon: 'armor' },
  { id: 'consumable', label: 'Zużywalne', icon: 'consumable' },
  { id: 'other', label: 'Inne', icon: 'pack' }
];
