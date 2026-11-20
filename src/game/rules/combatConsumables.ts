import type { CombatBeltCategory, CombatQuickBeltSlot } from '@ulf/rpg/gameLoop';
import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import type { ItemDef, OriginGameData, OstrzeGameState } from '../data/originTypes';
import type { SeededRng } from './dice';
import { getStats } from './stats';

export const COMBAT_BELT_AP_COST = 2;

const SLOT_DEFAULT_CATEGORIES: readonly CombatBeltCategory[] = [
  'heal',
  'remedy',
  'buff',
  'throwable'
];

export function classifyBeltCategory(item: ItemDef): CombatBeltCategory | null {
  if (item.type === 'throwable') return 'throwable';
  if (item.type !== 'consumable') return null;
  if (item.removes && item.removes.length > 0) return 'remedy';
  if (
    (Array.isArray(item.heal) && item.heal[1] > 0) ||
    (typeof item.healHp === 'number' && item.healHp > 0)
  ) {
    return 'heal';
  }
  if (item.applies && item.applies.length > 0) return 'buff';
  return null;
}

export function isQuickBeltEligible(item: ItemDef | undefined): boolean {
  return Boolean(item && classifyBeltCategory(item) !== null);
}

export function pinItemToQuickBelt(
  state: OstrzeGameState,
  slotIndex: number,
  itemId: string | null
): void {
  if (slotIndex < 0 || slotIndex > 3) return;
  if (!state.inventory.quickBelt) {
    state.inventory.quickBelt = [null, null, null, null];
  }
  // Remove any duplicate pin of the same item in another slot
  if (itemId) {
    for (let i = 0; i < 4; i++) {
      if (state.inventory.quickBelt[i] === itemId) {
        state.inventory.quickBelt[i] = null;
      }
    }
  }
  state.inventory.quickBelt[slotIndex] = itemId;
}

function summarizeBeltItem(item: ItemDef): string {
  if (item.type === 'throwable') {
    switch (item.id) {
      case 'garnek_huku':
        return 'Ogłusz. (-3 AP)';
      case 'garniec_wapno':
        return 'Oślepienie';
      case 'flasza_oleju':
        return '6–11 ogień';
      case 'swieca_dymna':
        return 'Dym + Garda';
      case 'puszka_szerszeni':
        return '4–8 + Spowoln.';
      default:
        return 'Rzut w cel';
    }
  }
  if (item.removes && item.removes.length > 0) {
    if (Array.isArray(item.heal) && item.heal[1] > 0) {
      return `+${item.heal[0]}–${item.heal[1]} HP · Rany`;
    }
    return `Usuwa: ${item.removes[0]}`;
  }
  if (Array.isArray(item.heal) && item.heal[1] > 0) {
    return item.heal[0] === item.heal[1]
      ? `+${item.heal[0]} HP`
      : `+${item.heal[0]}–${item.heal[1]} HP`;
  }
  if (typeof item.healHp === 'number' && item.healHp > 0) {
    return `+${item.healHp} HP`;
  }
  if (item.applies && item.applies.length > 0) {
    switch (item.applies[0]) {
      case 'natluszczone_ostrze':
        return '+1–3 obr.';
      case 'mocny_napar':
        return '+2 Krzepa';
      case 'najedzony':
        return '+1 Sił/Krz';
      case 'podchmielenie':
        return '+10 Wymowa';
      default:
        return 'Premia';
    }
  }
  return 'Użyj';
}

function scoreAutoCandidate(item: ItemDef, category: CombatBeltCategory): number {
  if (category === 'heal') {
    if (Array.isArray(item.heal)) return item.heal[0] + item.heal[1];
    return (item.healHp ?? 0) * 2;
  }
  if (category === 'remedy') {
    return item.id === 'opatrunek' ? 20 : 15;
  }
  if (category === 'buff') {
    if (item.id === 'loj_do_ostrza') return 30;
    if (item.id === 'napar_z_korzeni') return 25;
    if (item.id === 'gulasz') return 15;
    return 10;
  }
  // throwable
  if (item.id === 'flasza_oleju') return 30;
  if (item.id === 'garnek_huku') return 28;
  if (item.id === 'puszka_szerszeni') return 24;
  if (item.id === 'garniec_wapno') return 20;
  return 16;
}

/**
 * Resolves the 4 combat quick-use belt slots (`[4]`, `[5]`, `[6]`, `[7]`):
 * honors manual player pins from `state.inventory.quickBelt`, and auto-fills
 * remaining slots with the strongest available item in each category.
 */
export function resolveQuickBeltSlots(
  state: OstrzeGameState,
  data: OriginGameData,
  currentAp: number,
  options?: { playerHp?: number; playerMaxHp?: number; hasLivingEnemy?: boolean }
): Array<CombatQuickBeltSlot | null> {
  const ch = state.character;
  if (!ch) return [null, null, null, null];

  const stats = getStats(state, data);
  const hp = options?.playerHp ?? ch.hp;
  const maxHp = options?.playerMaxHp ?? stats.derived.hpMax;
  const hasLivingEnemy = options?.hasLivingEnemy ?? true;
  const pins = state.inventory.quickBelt ?? [null, null, null, null];

  const inventoryMap = new Map<string, { qty: number; item: ItemDef; cat: CombatBeltCategory }>();
  for (const entry of state.inventory.items) {
    if (entry.qty <= 0) continue;
    const item = data.items.find((i) => i.id === entry.id);
    if (!item) continue;
    const cat = classifyBeltCategory(item);
    if (!cat) continue;
    inventoryMap.set(entry.id, { qty: entry.qty, item, cat });
  }

  const assignedIds = new Set<string>();
  const resolved: Array<CombatQuickBeltSlot | null> = [null, null, null, null];

  const buildSlot = (
    slotIndex: 0 | 1 | 2 | 3,
    entry: { qty: number; item: ItemDef; cat: CombatBeltCategory }
  ): CombatQuickBeltSlot => {
    const { item, qty, cat } = entry;
    let canUse = currentAp >= COMBAT_BELT_AP_COST;
    let disabledReason: string | undefined =
      currentAp < COMBAT_BELT_AP_COST ? `Wymaga ${COMBAT_BELT_AP_COST} AP` : undefined;

    if (canUse && cat === 'heal' && hp >= maxHp) {
      canUse = false;
      disabledReason = 'Pełne zdrowie';
    } else if (canUse && cat === 'remedy') {
      const hasMatchingDebuff = Boolean(
        item.removes?.some((effId) => ch.effects.some((e) => e.id === effId))
      );
      const canHealMissingHp = Boolean(Array.isArray(item.heal) && item.heal[1] > 0 && hp < maxHp);
      if (!hasMatchingDebuff && !canHealMissingHp) {
        canUse = false;
        disabledReason = 'Brak ran lub zatrucia';
      }
    } else if (canUse && cat === 'throwable' && item.id !== 'swieca_dymna' && !hasLivingEnemy) {
      canUse = false;
      disabledReason = 'Brak celu';
    }

    return {
      slotIndex,
      itemId: item.id,
      name: item.name,
      qty,
      apCost: COMBAT_BELT_AP_COST,
      category: cat,
      summary: summarizeBeltItem(item),
      canUse,
      disabledReason
    };
  };

  // Pass 1: apply valid manual pins first
  for (let i = 0; i < 4; i++) {
    const pinnedId = pins[i];
    if (!pinnedId) continue;
    const inv = inventoryMap.get(pinnedId);
    if (inv && !assignedIds.has(pinnedId)) {
      resolved[i] = buildSlot(i as 0 | 1 | 2 | 3, inv);
      assignedIds.add(pinnedId);
    }
  }

  // Pass 2: auto-fill unpinned slots by preferred category, then fallback to any remaining eligible item
  for (let i = 0; i < 4; i++) {
    if (resolved[i]) continue;
    const targetCat = SLOT_DEFAULT_CATEGORIES[i];
    let best: { qty: number; item: ItemDef; cat: CombatBeltCategory; score: number } | null = null;
    for (const [id, inv] of inventoryMap.entries()) {
      if (assignedIds.has(id) || inv.cat !== targetCat) continue;
      const score = scoreAutoCandidate(inv.item, inv.cat);
      if (!best || score > best.score) {
        best = { ...inv, score };
      }
    }
    if (best) {
      resolved[i] = buildSlot(i as 0 | 1 | 2 | 3, best);
      assignedIds.add(best.item.id);
    }
  }

  return resolved;
}

export interface UseBeltItemResult {
  used: boolean;
  message?: string;
}

/**
 * Executes a Quick-Use Belt item during active turn-based combat:
 * spends 2 AP, decrements inventory quantity, applies Ostrze rules (healing,
 * status cure, buff, or throwable attack), syncs hero stats, and logs to combat log.
 */
export function useCombatBeltItem(params: {
  state: OstrzeGameState;
  data: OriginGameData;
  rng: SeededRng;
  engine: OstrzeEngineState;
  slotIndex: number;
}): UseBeltItemResult {
  const { state, data, rng, engine, slotIndex } = params;
  const ch = state.character;
  const pCombat = engine.player.combat;
  if (!ch || !pCombat || !engine.combatState.active) {
    return { used: false };
  }

  const livingEnemies = engine.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
  const slots = resolveQuickBeltSlots(state, data, pCombat.ap, {
    playerHp: pCombat.hp,
    playerMaxHp: pCombat.maxHp,
    hasLivingEnemy: livingEnemies.length > 0
  });
  const slot = slots[slotIndex];
  if (!slot || !slot.canUse || pCombat.ap < slot.apCost) {
    return { used: false };
  }

  const item = data.items.find((i) => i.id === slot.itemId);
  const invEntry = state.inventory.items.find((i) => i.id === slot.itemId);
  if (!item || !invEntry || invEntry.qty <= 0) {
    return { used: false };
  }

  // Spend AP and consume 1 item
  pCombat.ap = Math.max(0, pCombat.ap - slot.apCost);
  invEntry.qty -= 1;
  if (invEntry.qty <= 0) {
    state.inventory.items = state.inventory.items.filter((i) => i.id !== slot.itemId);
  }

  let logMessage = '';

  if (slot.category === 'heal' || slot.category === 'remedy') {
    const stats = getStats(state, data);
    const medBonus = Math.floor((stats.skills.medycyna ?? 0) / 20);
    let healed = 0;
    if (Array.isArray(item.heal)) {
      healed = rng.int(item.heal[0], item.heal[1]) + medBonus;
    } else if (typeof item.healHp === 'number') {
      healed = item.healHp + medBonus;
    }
    const prevHp = pCombat.hp;
    if (healed > 0) {
      pCombat.hp = Math.min(pCombat.maxHp, pCombat.hp + healed);
      ch.hp = pCombat.hp;
    }
    const actualHeal = pCombat.hp - prevHp;

    const removedNames: string[] = [];
    if (item.removes && item.removes.length > 0) {
      for (const effId of item.removes) {
        const had = ch.effects.some((e) => e.id === effId);
        if (had) {
          ch.effects = ch.effects.filter((e) => e.id !== effId);
          const def = data.effects.find((d) => d.id === effId);
          removedNames.push(def?.name ?? effId);
        }
      }
    }

    const parts: string[] = [];
    if (actualHeal > 0) parts.push(`+${actualHeal} HP`);
    if (removedNames.length > 0) parts.push(`usunięto: ${removedNames.join(', ')}`);
    logMessage = `Użyto [${item.name}] (${parts.join(' · ') || 'zastosowano'}, -${slot.apCost} AP).`;
    engine.addCombatLog(logMessage);
    return { used: true, message: logMessage };
  }

  if (slot.category === 'buff') {
    const appliedNames: string[] = [];
    for (const effId of item.applies ?? []) {
      const def = data.effects.find((d) => d.id === effId);
      const existing = ch.effects.find((e) => e.id === effId);
      if (existing) {
        existing.remainingHours = Math.max(existing.remainingHours ?? 0, 2);
      } else {
        ch.effects.push({ id: effId, stacks: 1, remainingHours: 2 });
      }
      appliedNames.push(def?.name ?? effId);
    }

    // Apply immediate combat damage bonus for natluszczone_ostrze
    if (item.applies?.includes('natluszczone_ostrze')) {
      pCombat.customDamageBonus = (pCombat.customDamageBonus ?? 0) + 2;
    } else {
      engine.syncFromOstrzeState(state, data);
    }

    logMessage = `Użyto [${item.name}] → aktywowano: ${appliedNames.join(', ')} (-${slot.apCost} AP).`;
    engine.addCombatLog(logMessage);
    return { used: true, message: logMessage };
  }

  // Throwable category
  if (item.id === 'swieca_dymna') {
    pCombat.defending = true;
    logMessage = `Rzucono [${item.name}] — kłęby dymu osłaniają pole walki (Garda aktywna, -${slot.apCost} AP).`;
    engine.addCombatLog(logMessage);
    return { used: true, message: logMessage };
  }

  const target =
    livingEnemies.find((e) => e.id === engine.combatState.selectedTargetId) ?? livingEnemies[0];
  if (!target || !target.combat) {
    return { used: false };
  }

  let dmg = 0;
  let statusNote = '';
  if (item.id === 'flasza_oleju') {
    dmg = rng.int(6, 11);
    statusNote = ' (ogień)';
  } else if (item.id === 'garnek_huku') {
    dmg = rng.int(3, 6);
    target.combat.dazedHeadTurns = Math.max(target.combat.dazedHeadTurns, 1);
    statusNote = ' + OGŁUSZENIE (-3 AP)';
  } else if (item.id === 'garniec_wapno') {
    dmg = rng.int(2, 4);
    target.combat.dazedHeadTurns = Math.max(target.combat.dazedHeadTurns, 1);
    statusNote = ' + OŚLEPIENIE';
  } else if (item.id === 'puszka_szerszeni') {
    dmg = rng.int(4, 8);
    target.combat.crippledLegsTurns = Math.max(target.combat.crippledLegsTurns, 2);
    statusNote = ' + OKALECZENIE (rój)';
  } else {
    dmg = rng.int(3, 6);
  }

  target.combat.hp = Math.max(0, target.combat.hp - dmg);
  target.damageFlashTimer = 0.28;

  if (target.combat.hp <= 0) {
    target.combat.isAlive = false;
    logMessage = `Trafienie! [${item.name}] Zadano ${dmg} obr.${statusNote} — Pokonano: ${target.recipe.name}! (-${slot.apCost} AP).`;
    engine.addCombatLog(logMessage);

    const remainingHostiles = engine.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
    if (remainingHostiles.length === 0) {
      engine.combatState.active = false;
      engine.addLog(`Zwycięstwo w walce! Pokonano: ${target.recipe.name}.`, 'important');
    } else {
      engine.combatState.selectedTargetId = remainingHostiles[0].id;
    }
  } else {
    logMessage = `Trafienie! [${item.name}] Zadano ${dmg} obr.: ${target.recipe.name}${statusNote} (-${slot.apCost} AP).`;
    engine.addCombatLog(logMessage);
  }

  return { used: true, message: logMessage };
}
