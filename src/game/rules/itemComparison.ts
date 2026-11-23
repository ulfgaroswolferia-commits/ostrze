import type { ItemDef, OriginGameData, OstrzeGameState } from '../data/originTypes';
import { escapeHtml } from '../ui/escapeHtml';

export interface ItemComparisonBadge {
  text: string;
  kind: 'up' | 'down';
}

export interface ItemComparisonSummary {
  equipSlot: string | null;
  statBadges: string[];
  diffBadges: ItemComparisonBadge[];
}

const MODIFIER_LABELS: Readonly<Record<string, string>> = {
  hpMax: 'HP',
  ap: 'AP',
  defense: 'Obrona',
  armor: 'Pancerz',
  damage: 'Obrażenia',
  critChance: '% Krytyk',
  initiative: 'Inicjatywa',
  meleeHitChance: '% Trafienie wręcz',
  rangedHitChance: '% Trafienie dyst.',
  sieczna: '% Sieczna',
  drzewcowa: '% Drzewcowa',
  strzelecka: '% Strzelecka',
  proch: '% Broń palna',
  wrecz: '% Walka wręcz',
  miotanie: '% Miotanie',
  medycyna: '% Medycyna',
  skradanie: '% Skradanie',
  wymowa: '% Wymowa',
  handel: '% Handel',
  wiedza_tajemna: '% Wiedza tajemna',
  resist_strach: '% Odp. Strach',
  resist_ogluszenie: '% Odp. Ogłuszenie',
  resist_rozkojarzenie: '% Odp. Rozkojarzenie'
};

export function resolveItemEquipSlot(item: ItemDef | undefined): string | null {
  if (!item) return null;
  if (item.slot) return item.slot;
  if (item.type === 'weapon') return 'bron';
  return null;
}

export function describeItemStatsAndComparison(
  item: ItemDef | undefined,
  state: OstrzeGameState | null | undefined,
  data: OriginGameData
): ItemComparisonSummary {
  if (!item) {
    return { equipSlot: null, statBadges: [], diffBadges: [] };
  }

  const equipSlot = resolveItemEquipSlot(item);
  const statBadges: string[] = [];

  if (Array.isArray(item.damage) && item.damage.length >= 2) {
    statBadges.push(`⚔️ ${item.damage[0]}–${item.damage[1]} obr.`);
  }
  if (typeof item.armor === 'number' && item.armor > 0) {
    statBadges.push(`🛡️ Pancerz ${item.armor}`);
  }
  if (Array.isArray(item.heal) && item.heal.length >= 2) {
    statBadges.push(
      item.heal[0] === item.heal[1]
        ? `❤️ +${item.heal[0]} HP`
        : `❤️ +${item.heal[0]}–${item.heal[1]} HP`
    );
  } else if (typeof item.healHp === 'number' && item.healHp > 0) {
    statBadges.push(`❤️ +${item.healHp} HP`);
  }
  if (item.modifiers) {
    for (const [k, val] of Object.entries(item.modifiers)) {
      if (typeof val !== 'number' || val === 0) continue;
      const label = MODIFIER_LABELS[k] ?? k;
      const sign = val > 0 ? '+' : '';
      statBadges.push(`${sign}${val}${label.startsWith('%') ? label : ' ' + label}`);
    }
  }

  const diffBadges: ItemComparisonBadge[] = [];
  if (equipSlot && state?.inventory?.equipped) {
    const equippedId = state.inventory.equipped[equipSlot];
    if (equippedId && equippedId !== item.id) {
      const equippedItem = data.items.find((i) => i.id === equippedId);
      if (Array.isArray(item.damage) && item.damage.length >= 2) {
        const curAvg = (item.damage[0] + item.damage[1]) / 2;
        const eqAvg =
          equippedItem && Array.isArray(equippedItem.damage)
            ? (equippedItem.damage[0] + equippedItem.damage[1]) / 2
            : 0;
        const delta = Math.round((curAvg - eqAvg) * 10) / 10;
        if (delta > 0) {
          diffBadges.push({ text: `▲ +${delta} śr. obr.`, kind: 'up' });
        } else if (delta < 0) {
          diffBadges.push({ text: `▼ ${delta} śr. obr.`, kind: 'down' });
        }
      }
      if (typeof item.armor === 'number' || typeof equippedItem?.armor === 'number') {
        const curArmor = item.armor ?? 0;
        const eqArmor = equippedItem?.armor ?? 0;
        const delta = curArmor - eqArmor;
        if (delta > 0) {
          diffBadges.push({ text: `▲ +${delta} Pancerz`, kind: 'up' });
        } else if (delta < 0) {
          diffBadges.push({ text: `▼ ${delta} Pancerz`, kind: 'down' });
        }
      }
    }
  }

  return { equipSlot, statBadges, diffBadges };
}

export function renderItemStatPillsHtml(
  item: ItemDef | undefined,
  state: OstrzeGameState | null | undefined,
  data: OriginGameData
): string {
  const { statBadges, diffBadges } = describeItemStatsAndComparison(item, state, data);
  if (statBadges.length === 0 && diffBadges.length === 0) return '';

  const statHtml = statBadges
    .map((b) => `<span class="ostrze-item-pill">${escapeHtml(b)}</span>`)
    .join('');
  const diffHtml = diffBadges
    .map(
      (d) =>
        `<span class="ostrze-item-pill ${d.kind === 'up' ? 'is-up' : 'is-down'}">${escapeHtml(d.text)}</span>`
    )
    .join('');

  return `<div class="ostrze-item-pills">${statHtml}${diffHtml}</div>`;
}
