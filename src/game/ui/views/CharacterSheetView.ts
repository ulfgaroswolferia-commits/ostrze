import { getSlavicPortrait } from '@ulf/assets/slavicPortraits';
import { ostrzeAudio } from '../../audio/ostrzeAudio';
import { getPixArtMeta } from '../../assets/pixArt';
import type {
  AttributeId,
  OriginGameData,
  OstrzeGameState,
  PerkDef,
  SkillId
} from '../../data/originTypes';
import {
  evaluateAchievements,
  evaluateCampaignProgress
} from '../../rules/achievements';
import {
  evaluateBestiaryEntries,
  HUNTER_LORE_KILL_THRESHOLD
} from '../../rules/bestiary';
import {
  canPickPerk,
  getAvailablePerks,
  pickPerk,
  spendAttributePoint,
  spendSkillPoint,
  xpRequiredForLevel
} from '../../rules/character';
import {
  isQuickBeltEligible,
  pinItemToQuickBelt
} from '../../rules/combatConsumables';
import type { SeededRng } from '../../rules/dice';
import {
  countInventoryByCategory,
  filterAndSortInventoryEntries,
  type InventoryCategoryFilter
} from '../../rules/inventoryFilter';
import { renderItemStatPillsHtml } from '../../rules/itemComparison';
import { getStats } from '../../rules/stats';
import { getOstrzeLocationMeta } from '../../rules/travel';
import { escapeHtml } from '../escapeHtml';
import { mountModalCard } from '../mountModalCard';
import {
  EQUIPMENT_SLOT_META,
  INVENTORY_FILTER_META,
  renderSlavicIcon,
  type SlavicIconId
} from '../slavicIcons';

export type CharacterSheetTab = 'stats' | 'gear' | 'journal' | 'bestiary' | 'chronicle';

let activeGearCategoryFilter: InventoryCategoryFilter = 'all';
let selectedQuickBeltSlot: number | null = null;

/**
 * Returns true if the hero has at least one unspent perk pick AND at least one eligible perk.
 */
export function hasUnspentPickablePerk(state: OstrzeGameState, data: OriginGameData): boolean {
  const ch = state.character;
  return Boolean(ch && ch.freePerkPicks > 0 && getAvailablePerks(state, data).length > 0);
}

/**
 * Resolves which Quick-Belt slot (0..3 -> keys [4]..[7]) a one-click "+ Pas" action should target.
 */
export function resolveTargetQuickBeltSlot(
  quickBelt: Array<string | null> | undefined,
  preferredSlot: number | null
): number {
  if (preferredSlot !== null && preferredSlot >= 0 && preferredSlot <= 3) {
    return preferredSlot;
  }
  const belt = quickBelt ?? [null, null, null, null];
  for (let i = 0; i < 4; i++) {
    if (!belt[i]) return i;
  }
  return 3;
}

const MODIFIER_LABELS: Record<string, { label: string; suffix?: string }> = {
  ap: { label: 'AP' },
  hpMax: { label: 'HP' },
  damage: { label: 'obr.' },
  defense: { label: 'Obrona' },
  meleeHitChance: { label: 'Traf. wręcz', suffix: '%' },
  rangedHitChance: { label: 'Traf. dyst.', suffix: '%' },
  critChance: { label: 'Krytyk', suffix: '%' },
  initiative: { label: 'Inicjatywa' },
  fleeChance: { label: 'Ucieczka', suffix: '%' },
  carry: { label: 'Udźwig' },
  resist_ogluszenie: { label: 'Odp. ogłuszenie', suffix: '%' },
  resist_strach: { label: 'Odp. strach', suffix: '%' },
  resist_rozkojarzenie: { label: 'Odp. rozkojarzenie', suffix: '%' }
};

/**
 * Formats a perk's mechanical stat modifiers and special unlocks into compact Polish badges.
 */
export function formatPerkModifiers(perk: PerkDef, data: OriginGameData): string[] {
  const pills: string[] = [];
  const mods = perk.modifiers ?? {};
  for (const [key, val] of Object.entries(mods)) {
    if (typeof val !== 'number' || val === 0) continue;
    const sign = val > 0 ? '+' : '';
    const known = MODIFIER_LABELS[key];
    if (known) {
      pills.push(`${sign}${val}${known.suffix ?? ''} ${known.label}`);
      continue;
    }
    const skillDef = data.skills.find((s) => s.id === key);
    if (skillDef) {
      pills.push(`${sign}${val}% ${skillDef.name}`);
      continue;
    }
    const attrDef = data.attributes.find((a) => a.id === key);
    if (attrDef) {
      pills.push(`${sign}${val} ${attrDef.name}`);
      continue;
    }
    pills.push(`${sign}${val} ${key}`);
  }
  if (Array.isArray(perk.unlocks) && perk.unlocks.length > 0) {
    for (const u of perk.unlocks) {
      pills.push(u === 'finta' ? 'Odblokowuje: Finta (przełamuje Gardę)' : `Odblokowuje: ${u}`);
    }
  }
  if (perk.id === 'cyrulik') {
    pills.push('+25% leczenia');
  } else if (perk.id === 'sokole_oko' || perk.id === 'pewna_reka') {
    pills.push('+2 obr. rzutem');
  }
  return pills;
}

export interface PerkRequirementCheck {
  label: string;
  met: boolean;
}

/**
 * Evaluates each prerequisite of a perk against the character's permanent stats.
 */
export function formatPerkRequirements(
  perk: PerkDef,
  state: OstrzeGameState,
  data: OriginGameData
): PerkRequirementCheck[] {
  const ch = state.character;
  if (!ch) return [];
  const req = perk.requires as
    | { level?: number; attributes?: Partial<Record<AttributeId, number>>; skills?: Partial<Record<SkillId, number>> }
    | undefined;
  if (!req) return [];

  const permStats = getStats(state, data, { permanentOnly: true });
  const checks: PerkRequirementCheck[] = [];

  if (typeof req.level === 'number') {
    checks.push({
      label: `Poz. ${req.level}`,
      met: ch.level >= req.level
    });
  }
  if (req.attributes) {
    for (const [attrId, minVal] of Object.entries(req.attributes)) {
      if (typeof minVal !== 'number') continue;
      const attrName = data.attributes.find((a) => a.id === attrId)?.name ?? attrId;
      const cur = permStats.permanentAttributes[attrId as AttributeId] ?? 0;
      checks.push({
        label: `${attrName} ${minVal}`,
        met: cur >= minVal
      });
    }
  }
  if (req.skills) {
    for (const [skillId, minVal] of Object.entries(req.skills)) {
      if (typeof minVal !== 'number') continue;
      const skillName = data.skills.find((s) => s.id === skillId)?.name ?? skillId;
      const cur = permStats.skills[skillId as SkillId] ?? 0;
      checks.push({
        label: `${skillName} ${minVal}%`,
        met: cur >= minVal
      });
    }
  }
  return checks;
}

export function renderCharacterSheetView(params: {
  root: HTMLElement;
  state: OstrzeGameState;
  data: OriginGameData;
  rng: SeededRng;
  activeTab: CharacterSheetTab;
  closeGuardActive?: boolean;
  onSelectTab: (tab: CharacterSheetTab) => void;
  onUpdated: () => void;
  onShowToast: (text: string, tone: 'info' | 'gold' | 'success') => void;
  onRerender: () => void;
  onAttemptClose?: () => void;
  onCancelCloseGuard?: () => void;
  onClose: () => void;
}): void {
  const {
    root,
    state,
    data,
    rng,
    activeTab,
    closeGuardActive = false,
    onSelectTab,
    onUpdated,
    onShowToast,
    onRerender,
    onAttemptClose,
    onCancelCloseGuard,
    onClose
  } = params;
  const ch = state.character;
  if (!ch) {
    onClose();
    return;
  }

  const stats = getStats(state, data);
  const cls = data.classes.find((c) => c.id === ch.classId);
  const curFloorXp = xpRequiredForLevel(ch.level, data.rules.leveling.xpStep);
  const nextLvXp = xpRequiredForLevel(ch.level + 1, data.rules.leveling.xpStep);
  const xpSpan = Math.max(1, nextLvXp - curFloorXp);
  const xpPct = Math.min(100, Math.max(0, Math.round(((ch.xp - curFloorXp) / xpSpan) * 100)));

  const attrMaxBase = data.rules.creator.attributeMax;
  const attrsHtml = data.attributes
    .map((attr) => {
      const val = stats.permanentAttributes[attr.id];
      const max = attrMaxBase + (data.rules.creator.gifts[attr.id] ?? 0);
      const canAdd = ch.freeAttributePoints > 0 && ch.attributes[attr.id] < max;
      return `
        <div class="ostrze-row ostrze-cs-stat-row" title="${escapeHtml(attr.description)}">
          <span class="ostrze-cs-stat-name">${escapeHtml(attr.name)}</span>
          <span class="ostrze-stepper">
            <strong class="ostrze-num">${val}</strong>
            ${canAdd ? `<button type="button" class="ostrze-step-btn is-upgrade" data-cs-attr="${attr.id}" title="Dodaj +1 do ${escapeHtml(attr.name)}">+</button>` : ''}
          </span>
        </div>
      `;
    })
    .join('');

  const taggedStep = data.rules.skills.taggedPointValue;
  const skillsHtml = data.skills
    .map((sk) => {
      const val = stats.skills[sk.id];
      const isTagged = ch.tagged.includes(sk.id);
      const step = isTagged ? taggedStep : 1;
      const canAdd = ch.freeSkillPoints > 0 && val + step <= data.rules.skills.max;
      return `
        <div class="ostrze-row ostrze-cs-stat-row ${isTagged ? 'is-tagged' : ''}">
          <span class="ostrze-cs-stat-name">${escapeHtml(sk.name)}${isTagged ? ' <span class="ostrze-cs-star" title="Umiejętność oznaczona (+2% za punkt)">★</span>' : ''}</span>
          <span class="ostrze-stepper">
            <strong class="ostrze-num">${val}%</strong>
            ${canAdd ? `<button type="button" class="ostrze-step-btn is-upgrade is-skill-step" data-cs-skill="${sk.id}" title="Zwiększ ${escapeHtml(sk.name)} o +${step}%">+${step}</button>` : ''}
          </span>
        </div>
      `;
    })
    .join('');

  const availablePerks = getAvailablePerks(state, data);
  const maxPerks = data.rules.leveling.maxPerks;
  const perkInterval = data.rules.leveling.perkEveryLevels;
  const nextPerkLevel =
    ch.perks.length + ch.freePerkPicks >= maxPerks
      ? null
      : Math.ceil((ch.level + 1) / perkInterval) * perkInterval;

  const pickedPerksHtml =
    ch.perks.length > 0
      ? ch.perks
          .map((id) => {
            const p = data.perks.find((x) => x.id === id);
            const modPills = p ? formatPerkModifiers(p, data) : [];
            return `
              <div class="ostrze-perk-card is-owned">
                <div class="ostrze-perk-head">
                  <strong class="ostrze-perk-name">${escapeHtml(p?.name ?? id)}</strong>
                  <span class="ostrze-perk-owned-mark">✓</span>
                </div>
                ${
                  modPills.length > 0
                    ? `<div class="ostrze-perk-mods">${modPills.map((m) => `<span class="ostrze-perk-mod-pill">${escapeHtml(m)}</span>`).join('')}</div>`
                    : ''
                }
              </div>
            `;
          })
          .join('')
      : '<div class="ostrze-perk-empty">Brak wybranych talentów. Nowy talent odblokujesz co 2 poziomy.</div>';

  const perkChoicesHtml =
    ch.freePerkPicks > 0
      ? availablePerks.length > 0
        ? availablePerks
            .map((p) => {
              const modPills = formatPerkModifiers(p, data);
              return `
                <div class="ostrze-perk-card is-pickable">
                  <div class="ostrze-perk-head">
                    <strong class="ostrze-perk-name">${escapeHtml(p.name)}</strong>
                    <button type="button" class="ostrze-hub-btn is-alert ostrze-perk-pick-btn" data-cs-perk="${escapeHtml(p.id)}">Wybierz</button>
                  </div>
                  ${
                    modPills.length > 0
                      ? `<div class="ostrze-perk-mods">${modPills.map((m) => `<span class="ostrze-perk-mod-pill is-highlight">${escapeHtml(m)}</span>`).join('')}</div>`
                      : ''
                  }
                  <div class="ostrze-perk-desc">${escapeHtml(p.description ?? '')}</div>
                </div>
              `;
            })
            .join('')
        : '<div class="ostrze-perk-empty">Brak talentów spełniających wymagania. Rozdaj najpierw punkty Atrybutów lub Umiejętności.</div>'
      : '';

  const lockedPerks = data.perks.filter(
    (p) => !ch.perks.includes(p.id) && !canPickPerk(state, p, data)
  );
  const upcomingPerksHtml =
    ch.perks.length < maxPerks && lockedPerks.length > 0
      ? `
        <details class="ostrze-perk-preview" ${ch.freePerkPicks === 0 && ch.perks.length === 0 ? 'open' : ''}>
          <summary>Katalog talentów i wymagania (${lockedPerks.length})</summary>
          <div class="ostrze-perk-preview-list">
            ${lockedPerks
              .map((p) => {
                const modPills = formatPerkModifiers(p, data);
                const reqChecks = formatPerkRequirements(p, state, data);
                return `
                  <div class="ostrze-perk-card is-locked">
                    <div class="ostrze-perk-head">
                      <strong class="ostrze-perk-name">${escapeHtml(p.name)}</strong>
                    </div>
                    ${
                      modPills.length > 0
                        ? `<div class="ostrze-perk-mods">${modPills.map((m) => `<span class="ostrze-perk-mod-pill">${escapeHtml(m)}</span>`).join('')}</div>`
                        : ''
                    }
                    ${
                      reqChecks.length > 0
                        ? `<div class="ostrze-perk-reqs">${reqChecks
                            .map(
                              (r) =>
                                `<span class="ostrze-perk-req ${r.met ? 'is-met' : 'is-unmet'}">${r.met ? '✓' : '✕'} ${escapeHtml(r.label)}</span>`
                            )
                            .join('')}</div>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </details>
      `
      : '';

  const gearCounts = countInventoryByCategory(state.inventory.items, data);
  if (activeGearCategoryFilter !== 'all' && gearCounts[activeGearCategoryFilter] === 0) {
    activeGearCategoryFilter = 'all';
  }
  const visibleInventoryEntries = filterAndSortInventoryEntries(
    state.inventory.items,
    state.inventory.equipped,
    data,
    activeGearCategoryFilter
  );
  const gearFiltersHtml = `
    <div class="ostrze-gear-filters" role="tablist" aria-label="Filtr kategorii ekwipunku">
      ${INVENTORY_FILTER_META
        .map(
          (f) => `
          <button
            type="button"
            class="ostrze-gear-filter-btn ${activeGearCategoryFilter === f.id ? 'is-active' : ''}"
            data-cs-gear-filter="${f.id}"
            ${f.id !== 'all' && gearCounts[f.id] === 0 ? 'disabled' : ''}
          >
            ${renderSlavicIcon(f.icon)}
            <span>${f.label}</span>
            <span class="ostrze-gear-filter-count">${gearCounts[f.id]}</span>
          </button>
        `
        )
        .join('')}
    </div>
  `;

  const quickBelt = state.inventory.quickBelt ?? [null, null, null, null];
  const targetBeltSlot = resolveTargetQuickBeltSlot(quickBelt, selectedQuickBeltSlot);

  const quickBeltStripHtml = `
    <div class="ostrze-belt-strip" data-cs-quickbelt-strip="true">
      <div class="ostrze-belt-strip-head">
        <span class="ostrze-belt-strip-title ostrze-ico-title">${renderSlavicIcon('belt')}<span>Pas Szybkiego Użycia</span> <kbd class="ostrze-kbd">4–7</kbd></span>
        <span class="ostrze-belt-strip-hint">
          ${
            selectedQuickBeltSlot !== null
              ? `Wybrano docelowy slot [${selectedQuickBeltSlot + 4}] — kliknij „+ Pas” przy przedmiocie.`
              : 'Kliknij „+ Pas” przy przedmiocie lub wybierz konkretny slot.'
          }
        </span>
      </div>
      <div class="ostrze-belt-slots-grid">
        ${[0, 1, 2, 3]
          .map((slotIdx) => {
            const pinnedId = quickBelt[slotIdx] ?? null;
            const pinnedItem = pinnedId ? data.items.find((i) => i.id === pinnedId) : undefined;
            const pinnedQty = pinnedId
              ? state.inventory.items.find((i) => i.id === pinnedId)?.qty ?? 0
              : 0;
            const isTarget = selectedQuickBeltSlot === slotIdx;
            return `
              <div
                class="ostrze-belt-slot ${pinnedId ? 'is-filled' : 'is-empty'} ${isTarget ? 'is-target' : ''}"
                data-cs-belt-slot-select="${slotIdx}"
                role="button"
                tabindex="0"
                title="${pinnedId ? `Slot [${slotIdx + 4}]: ${escapeHtml(pinnedItem?.name ?? pinnedId)}` : `Wybierz slot [${slotIdx + 4}] jako docelowy`}"
              >
                <kbd class="ostrze-kbd">${slotIdx + 4}</kbd>
                <div class="ostrze-belt-slot-info">
                  ${
                    pinnedId
                      ? `<strong class="ostrze-belt-slot-name">${escapeHtml(pinnedItem?.name ?? pinnedId)}</strong>
                         <span class="ostrze-belt-slot-qty ostrze-num">×${pinnedQty}</span>`
                      : `<span class="ostrze-belt-slot-empty">Wolny slot</span>`
                  }
                </div>
                ${
                  pinnedId
                    ? `<button type="button" class="ostrze-belt-slot-clear" data-cs-belt-unpin="${slotIdx}" title="Odepnij slot [${slotIdx + 4}]" aria-label="Odepnij">×</button>`
                    : ''
                }
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;

  const itemsHtml =
    visibleInventoryEntries.length > 0
      ? visibleInventoryEntries
          .map((entry) => {
            const item = data.items.find((i) => i.id === entry.id);
            const equipSlot = item?.slot ?? (item?.type === 'weapon' ? 'bron' : undefined);
            const isEquipped = Boolean(equipSlot && state.inventory.equipped[equipSlot] === entry.id);
            const canEquip = Boolean(equipSlot) && !isEquipped;
            const healRange = item?.heal;
            const healFlat = item?.healHp;
            const canRemoveEffect = Boolean(
              item?.removes?.some((effId) => ch.effects.some((e) => e.id === effId))
            );
            const hasHeal =
              (Array.isArray(healRange) && healRange[1] > 0) ||
              (typeof healFlat === 'number' && healFlat > 0);
            const canUse =
              (hasHeal && ch.hp < stats.derived.hpMax) || canRemoveEffect;
            const useLabel = Array.isArray(healRange)
              ? healRange[0] === healRange[1]
                ? `Użyj (+${healRange[0]} HP)`
                : `Użyj (+${healRange[0]}–${healRange[1]} HP)`
              : typeof healFlat === 'number' && healFlat > 0
                ? `Użyj (+${healFlat} HP)`
                : 'Użyj';
            const beltEligible = isQuickBeltEligible(item);
            const pinnedSlotIdx = quickBelt.indexOf(entry.id);
            const beltPinHtml = beltEligible
              ? pinnedSlotIdx >= 0
                ? `<button type="button" class="ostrze-hub-btn ostrze-belt-pinned-btn" data-cs-belt-unpin="${pinnedSlotIdx}" title="Odepnij z pasa szybkiego użycia">Pas [${pinnedSlotIdx + 4}] ✕</button>`
                : `<button type="button" class="ostrze-hub-btn ostrze-belt-pin-btn" data-cs-belt-quickpin="${escapeHtml(entry.id)}" title="Przypnij do slotu pasa [${targetBeltSlot + 4}]">+ Pas [${targetBeltSlot + 4}]</button>`
              : '';
            const statPillsHtml = renderItemStatPillsHtml(item, state, data);
            return `
              <div class="ostrze-row ostrze-gear-row">
                <div style="flex:1;min-width:0;">
                  <div class="ostrze-gear-item-line">
                    <strong>${escapeHtml(item?.name ?? entry.id)}</strong>
                    <span class="ostrze-shop-qty ostrze-num">×${entry.qty}</span>
                    ${isEquipped ? '<span class="ostrze-gear-equipped-tag">Założono</span>' : ''}
                    ${pinnedSlotIdx >= 0 ? `<span class="ostrze-gear-belt-tag">Pas ${pinnedSlotIdx + 4}</span>` : ''}
                  </div>
                  ${statPillsHtml}
                </div>
                <span class="ostrze-stepper">
                  ${beltPinHtml}
                  ${canEquip ? `<button type="button" class="ostrze-hub-btn" data-cs-equip="${escapeHtml(entry.id)}">Załóż</button>` : ''}
                  ${isEquipped && equipSlot ? `<button type="button" class="ostrze-hub-btn" data-cs-unequip="${escapeHtml(equipSlot)}">Zdejmij</button>` : ''}
                  ${canUse ? `<button type="button" class="ostrze-hub-btn" data-cs-use="${escapeHtml(entry.id)}">${useLabel}</button>` : ''}
                </span>
              </div>
            `;
          })
          .join('')
      : '<div class="ostrze-subtitle" style="margin-bottom:0">Pusty plecak.</div>';

  const pendingPts = ch.freeAttributePoints + ch.freeSkillPoints + ch.freePerkPicks;
  const hpMax = Math.max(1, stats.derived.hpMax);
  const hpPct = Math.min(100, Math.max(0, Math.round((ch.hp / hpMax) * 100)));
  const wola = state.vars.wola ?? 0;
  const dlug = state.vars.dlug ?? 0;

  const knownSlotSet = new Set<string>(EQUIPMENT_SLOT_META.map((s) => s.slot));
  const extraEquippedSlots = Object.entries(state.inventory.equipped)
    .filter(([slot, itemId]) => !knownSlotSet.has(slot) && typeof itemId === 'string' && itemId.length > 0)
    .map(([slot]) => ({ slot, label: slot, icon: 'pack' as SlavicIconId }));

  const allEquipmentSlots: ReadonlyArray<{ slot: string; label: string; icon: SlavicIconId }> = [
    ...EQUIPMENT_SLOT_META,
    ...extraEquippedSlots
  ];
  const equippedHtml = `
    <div class="ostrze-equip-slots-grid" data-cs-equip-slots="true">
      ${allEquipmentSlots
        .map(({ slot, label, icon }) => {
          const itemId = state.inventory.equipped[slot];
          const hasItem = typeof itemId === 'string' && itemId.length > 0;
          const item = hasItem ? data.items.find((i) => i.id === itemId) : undefined;
          const pills = hasItem ? renderItemStatPillsHtml(item, null, data) : '';
          return `
            <div class="ostrze-equip-slot-card ${hasItem ? 'is-filled' : 'is-empty'}" data-equip-slot="${escapeHtml(slot)}">
              <div class="ostrze-equip-slot-top">
                <span class="ostrze-equip-slot-badge">${renderSlavicIcon(icon)}<span>${escapeHtml(label)}</span></span>
                ${
                  hasItem
                    ? `<button type="button" class="ostrze-equip-unequip-btn" data-cs-unequip="${escapeHtml(slot)}" aria-label="Zdejmij ${escapeHtml(item?.name ?? itemId)}" title="Zdejmij ${escapeHtml(item?.name ?? itemId)}">Zdejmij</button>`
                    : ''
                }
              </div>
              <div class="ostrze-equip-slot-body">
                ${
                  hasItem
                    ? `<strong class="ostrze-equip-slot-name">${escapeHtml(item?.name ?? itemId)}</strong>${pills}`
                    : `<span class="ostrze-equip-slot-empty">Pusty slot</span>`
                }
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  const questEntries = Object.entries(state.quests).filter(([, st]) => st && st !== 'none');
  const activeQuests = questEntries.filter(([, st]) => st === 'active');
  const doneQuests = questEntries.filter(([, st]) => st === 'completed');

  const locationLabelMap: Record<string, string> = {
    wilczy_brod: 'Wilczy Bród',
    wilcza_nora: 'Wilcza Nora',
    wilczy_las: 'Las Rubieży',
    stary_mlyn: 'Stary Młyn',
    trakt_kupiecki: 'Trakt Kupiecki',
    lesniczowka: 'Leśniczówka',
    ruiny_straznicy: 'Ruiny Strażnicy',
    kamienna_przelecz: 'Kamienna Przełęcz',
    gluszec: 'Głuszec',
    bor_klusownikow: 'Bór Kłusowników',
    stary_trakt: 'Stary Trakt',
    kapliczka_rozstaje: 'Kapliczka na Rozstajach',
    kamieniolom: 'Kamieniołom',
    bagna_szarej_wody: 'Bagna Szarej Wody',
    wzgorze_wartownicze: 'Wzgórze Wartownicze',
    spalona_osada: 'Spalona Osada',
    stara_kopalnia: 'Stara Kopalnia'
  };

  const formatAtHint = (at?: string): string => {
    if (!at) return '';
    const [locId, spotId] = at.split('.');
    const locName = locationLabelMap[locId] ?? locId.replace(/_/g, ' ');
    if (!spotId) return locName;
    return `${locName} · ${spotId.replace(/_/g, ' ')}`;
  };

  const isObjectiveDone = (done?: { flag?: string; item?: string }): boolean => {
    if (!done) return false;
    if (done.flag && state.flags[done.flag]) return true;
    if (
      done.item &&
      (state.inventory.items.some((i) => i.id === done.item && i.qty > 0) ||
        Object.values(state.inventory.equipped).includes(done.item))
    ) {
      return true;
    }
    return false;
  };

  const renderQuestList = (list: Array<[string, string]>, emptyMsg: string): string => {
    if (list.length === 0) return `<div class="ostrze-subtitle" style="margin-bottom:0">${emptyMsg}</div>`;
    return list
      .map(([qId, status]) => {
        const def = data.quests.find((q) => q.id === qId);
        const objectivesHtml =
          status === 'active' && def?.objectives && def.objectives.length > 0
            ? `<ul class="ostrze-quest-objectives">${def.objectives
                .map((obj) => {
                  const done = isObjectiveDone(obj.done);
                  const hint = formatAtHint(obj.at);
                  return `<li class="ostrze-quest-obj ${done ? 'is-done' : ''}">
                    <span class="ostrze-quest-obj-mark">${done ? '✓' : '○'}</span>
                    <span>${escapeHtml(obj.text)}${hint ? ` <em class="ostrze-quest-obj-loc">(${escapeHtml(hint)})</em>` : ''}</span>
                  </li>`;
                })
                .join('')}</ul>`
            : '';
        return `
          <div class="ostrze-row ostrze-quest-row ${status === 'completed' ? 'is-completed' : ''}">
            <div style="flex:1;min-width:0;">
              <strong class="ostrze-quest-name">${escapeHtml(def?.name ?? qId)}</strong>
              ${def?.description ? `<div class="ostrze-shop-desc ostrze-lore-copy">${escapeHtml(def.description)}</div>` : ''}
              ${objectivesHtml}
            </div>
            <span class="ostrze-seal-tag ${status === 'completed' ? 'is-done' : 'is-active'}">
              ${status === 'completed' ? `${renderSlavicIcon('check')}<span>Ukończone</span>` : `${renderSlavicIcon('quest')}<span>Aktywne</span>`}
            </span>
          </div>
        `;
      })
      .join('');
  };

  const keepsakeDefs: Array<{
    id: string;
    owner: string;
    echoFlag: string;
    honoredText: string;
    pendingText: string;
  }> = [
    {
      id: 'kosc_skarimira',
      owner: 'Skarimir',
      echoFlag: 'echo_skarimir_kosc',
      honoredText: 'Uczczony rzutem kością w karczmie Wilczego Brodu.',
      pendingText: 'Czeka na ostatni rzut w karczmie „Pod Wilczym Kłem”.'
    },
    {
      id: 'miedziak_ragnoslawy',
      owner: 'Ragnosława',
      echoFlag: 'echo_ragnoslawa_toast',
      honoredText: 'Zakład spełniony — piwo postawione w Wilczym Brodzie.',
      pendingText: 'Zastaw za pierwsze piwo w karczmie Wilczego Brodu.'
    },
    {
      id: 'list_wojmira',
      owner: 'Wojmir Cienki',
      echoFlag: 'echo_wojmir_list',
      honoredText: state.flags.echo_wojmir_list_wyslany
        ? 'Przekazany Wrzoskowi dla gońca do Brzeziny.'
        : 'Zachowany przy sercu jako pamiątka.',
      pendingText: 'Zapieczętowany list do matki — do przekazania lub zachowania w karczmie.'
    }
  ];

  const keepsakesHtml = keepsakeDefs
    .filter((k) => {
      const hasItem = state.inventory.items.some((i) => i.id === k.id && i.qty > 0);
      return hasItem || Boolean(state.flags[k.echoFlag]);
    })
    .map((k) => {
      const item = data.items.find((i) => i.id === k.id);
      const honored = Boolean(state.flags[k.echoFlag]);
      return `
        <div class="ostrze-keepsake-card">
          <div class="ostrze-notice-head">
            <span class="ostrze-notice-title ostrze-ico-title">${renderSlavicIcon('candle')}<span>${escapeHtml(item?.name ?? k.owner)}</span></span>
            <span class="ostrze-seal-tag ${honored ? 'is-done' : ''}">${honored ? `${renderSlavicIcon('check')}<span>Uczczono</span>` : 'Pamiątka'}</span>
          </div>
          <div class="ostrze-shop-desc ostrze-lore-copy">${escapeHtml(honored ? k.honoredText : k.pendingText)}</div>
        </div>
      `;
    })
    .join('');

  const progress = evaluateCampaignProgress(state, data);
  const achievements = evaluateAchievements(state, data);
  const readableKnownPlaces = Array.from(
    new Set(
      state.world.knownPlaces.map((id) => {
        const normalized = id === 'brzezina' ? 'brzezina_dziedziniec' : id;
        return getOstrzeLocationMeta(normalized)?.name ?? id;
      })
    )
  );

  const bestiaryEntries = evaluateBestiaryEntries(state, data);
  const unlockedBestiaryCount = bestiaryEntries.filter((b) => b.unlocked).length;
  const bestiaryCardsHtml = bestiaryEntries
    .map((entry) => {
      if (!entry.unlocked) {
        return `
          <div class="ostrze-bestiary-card is-locked">
            <div class="ostrze-bestiary-head">
              <strong class="ostrze-ico-title">${renderSlavicIcon('beast')}<span>Nieznany przeciwnik</span></strong>
              <span class="ostrze-shop-tag">${escapeHtml(entry.archetypeLabel)}</span>
            </div>
            <div class="ostrze-shop-desc ostrze-lore-copy">Spotkaj lub pokonaj tego wroga na szlaku, aby poznać jego słabości i taktykę.</div>
          </div>
        `;
      }
      const pixMeta = entry.pixArtId ? getPixArtMeta(entry.pixArtId) : null;
      const portraitHtml = pixMeta
        ? `<div class="ostrze-bestiary-portrait-wrap"><img class="ostrze-bestiary-portrait ostrze-pix-art" src="${escapeHtml(pixMeta.dataUri)}" width="${pixMeta.width}" height="${pixMeta.height}" alt="${escapeHtml(entry.name)}" /></div>`
        : '';
      const resistHtml = entry.resistances
        .map(
          (r) =>
            `<span class="ostrze-combat-pill ${r.kind === 'resist' ? 'is-resist' : 'is-weak'}">${escapeHtml(r.label)}</span>`
        )
        .join('');
      const hunterBadge = entry.hunterLoreActive
        ? `<span class="ostrze-combat-pill is-defend ostrze-ico-pill" title="Pokonano co najmniej ${HUNTER_LORE_KILL_THRESHOLD} szt. — stała premia +1 obr. przeciwko temu wrogowi">${renderSlavicIcon('target')}<span>Wiedza Łowiecka (+1 obr.)</span></span>`
        : `<span class="ostrze-shop-tag">Pokonano: ${entry.killCount}/${HUNTER_LORE_KILL_THRESHOLD} do premii +1 obr.</span>`;
      return `
        <div class="ostrze-bestiary-card is-unlocked">
          <div class="ostrze-bestiary-top">
            ${portraitHtml}
            <div class="ostrze-bestiary-meta">
              <div class="ostrze-bestiary-head">
                <strong class="ostrze-bestiary-name">${escapeHtml(entry.name)}</strong>
                <span class="ostrze-shop-tag">${escapeHtml(entry.archetypeLabel)}</span>
              </div>
              <div class="ostrze-bestiary-stats">
                <span>HP: <strong class="ostrze-num">${entry.hp}</strong></span>
                <span>AP: <strong class="ostrze-num">${entry.ap}</strong></span>
                <span>Obrona: <strong class="ostrze-num">${entry.defense}</strong></span>
                <span>Pokonano: <strong class="ostrze-num">${entry.killCount}</strong></span>
              </div>
              <div class="ostrze-combat-pills" style="margin-top:5px;">
                ${hunterBadge}
                ${resistHtml}
              </div>
            </div>
          </div>
          <div class="ostrze-shop-desc ostrze-lore-copy" style="margin-top:8px;">${escapeHtml(entry.loreText)}</div>
          <div class="ostrze-bestiary-tip">${renderSlavicIcon('tip')}<span><strong>Taktyka:</strong> ${escapeHtml(entry.tacticalTip)}</span></div>
        </div>
      `;
    })
    .join('');

  const achievementsGridHtml = achievements
    .map(
      (ach) => `
        <div class="ostrze-ach-card ${ach.unlocked ? 'is-unlocked' : ''}">
          <div class="ostrze-ach-seal ${ach.unlocked ? 'is-unlocked' : ''}">
            ${renderSlavicIcon(ach.unlocked ? 'trophy' : 'star')}
          </div>
          <div class="ostrze-ach-body">
            <div class="ostrze-ach-title">${escapeHtml(ach.title)}</div>
            <div class="ostrze-ach-desc">${escapeHtml(ach.description)}</div>
          </div>
        </div>
      `
    )
    .join('');

  const levelUpBannerHtml =
    pendingPts > 0
      ? `
        <div class="ostrze-levelup-banner" data-cs-levelup-banner="true">
          <span class="ostrze-levelup-label">Awans — do rozdania:</span>
          <div class="ostrze-levelup-steps">
            ${
              ch.freeAttributePoints > 0
                ? `<span class="ostrze-levelup-pill is-pending">Atrybuty <strong>+${ch.freeAttributePoints}</strong></span>`
                : ''
            }
            ${
              ch.freeSkillPoints > 0
                ? `<span class="ostrze-levelup-pill is-pending">Umiejętności <strong>+${ch.freeSkillPoints}</strong></span>`
                : ''
            }
            ${
              ch.freePerkPicks > 0
                ? `<button type="button" class="ostrze-levelup-pill is-perk-cta" data-cs-focus-perks="true">★ Wybierz Talent <strong>+${ch.freePerkPicks}</strong> →</button>`
                : ''
            }
          </div>
        </div>
      `
      : '';

  const weaponId = state.inventory?.equipped?.bron;
  const weapon = weaponId ? data.items.find((it) => it.id === weaponId) : undefined;
  const wMin = (weapon?.damage?.[0] ?? 2) + stats.derived.bonusDamage;
  const wMax = (weapon?.damage?.[1] ?? 4) + stats.derived.bonusDamage;
  const wLabel = weapon ? weapon.name : 'Walka wręcz';
  const hasResists =
    stats.derived.resistStrach > 0 ||
    stats.derived.resistOgluszenie > 0 ||
    stats.derived.resistRozkojarzenie > 0;

  const tabContentHtml =
    activeTab === 'stats'
      ? `
        ${levelUpBannerHtml}
        <div class="ostrze-cs-stats-grid">
          <div class="ostrze-panel ostrze-cs-col ${ch.freeAttributePoints > 0 ? 'is-action-ready' : ''}" data-preserve-scroll="cs-attrs">
            <h3>
              Atrybuty
              ${ch.freeAttributePoints > 0 ? `<span class="ostrze-panel-badge">+${ch.freeAttributePoints} pkt</span>` : ''}
            </h3>
            ${attrsHtml}
            <h3 class="ostrze-cs-subhead">Pochodne bojowe</h3>
            <div class="ostrze-cs-derived-grid">
              <div class="ostrze-cs-derived-item" title="${escapeHtml(wLabel)}">
                <span>Obrażenia</span>
                <strong class="ostrze-num">${wMin}–${wMax}</strong>
              </div>
              <div class="ostrze-cs-derived-item">
                <span>Pancerz / Obr.</span>
                <strong class="ostrze-num">${stats.derived.armor} / ${stats.derived.defense}</strong>
              </div>
              <div class="ostrze-cs-derived-item">
                <span>Traf. wręcz / dyst.</span>
                <strong class="ostrze-num">+${stats.derived.meleeHitChance}% / +${stats.derived.rangedHitChance}%</strong>
              </div>
              <div class="ostrze-cs-derived-item">
                <span>Krytyk / Inic.</span>
                <strong class="ostrze-num">${stats.derived.critChance}% / ${stats.derived.initiative}</strong>
              </div>
              ${
                stats.derived.bonusDamage !== 0
                  ? `<div class="ostrze-cs-derived-item"><span>Premia obr.</span><strong class="ostrze-num">+${stats.derived.bonusDamage}</strong></div>`
                  : ''
              }
              ${
                hasResists
                  ? `<div class="ostrze-cs-derived-item"><span>Odp. Str/Ogł/Roz</span><strong class="ostrze-num">${stats.derived.resistStrach}/${stats.derived.resistOgluszenie}/${stats.derived.resistRozkojarzenie}%</strong></div>`
                  : ''
              }
            </div>
          </div>

          <div class="ostrze-panel ostrze-cs-col ${ch.freeSkillPoints > 0 ? 'is-action-ready' : ''}" data-preserve-scroll="cs-skills">
            <h3>
              Umiejętności
              ${ch.freeSkillPoints > 0 ? `<span class="ostrze-panel-badge">+${ch.freeSkillPoints} pkt</span>` : ''}
            </h3>
            ${skillsHtml}
          </div>

          <div class="ostrze-panel ostrze-cs-col ostrze-cs-perks-col ${ch.freePerkPicks > 0 ? 'is-perk-ready' : ''}" data-cs-perks-panel="true" data-preserve-scroll="cs-perks">
            <h3>
              Talenty (${ch.perks.length}/${maxPerks})
              ${
                ch.freePerkPicks > 0
                  ? `<span class="ostrze-panel-badge is-perk-alert">★ Wybierz: ${ch.freePerkPicks}</span>`
                  : nextPerkLevel
                    ? `<span class="ostrze-panel-badge is-muted">Nast. poz. ${nextPerkLevel}</span>`
                    : ''
              }
            </h3>
            ${
              ch.freePerkPicks > 0
                ? `<div class="ostrze-perk-pick-section" data-cs-perk-picker="true">
                    <div class="ostrze-perk-section-label">Dostępne teraz (${availablePerks.length}):</div>
                    ${perkChoicesHtml}
                  </div>`
                : ''
            }
            ${
              ch.perks.length > 0 || ch.freePerkPicks === 0
                ? `<div class="ostrze-perk-owned-section">
                    ${ch.freePerkPicks > 0 && ch.perks.length > 0 ? '<div class="ostrze-perk-section-label">Posiadane talenty:</div>' : ''}
                    ${pickedPerksHtml}
                  </div>`
                : ''
            }
            ${upcomingPerksHtml}
          </div>
        </div>
      `
      : activeTab === 'gear'
        ? `
          ${quickBeltStripHtml}
          <div class="ostrze-creator-grid ostrze-cs-two-col">
            <div class="ostrze-panel ostrze-cs-col" data-preserve-scroll="cs-equipped">
              <h3>Założony ekwipunek</h3>
              ${equippedHtml}
            </div>
            <div class="ostrze-panel ostrze-cs-col" data-preserve-scroll="cs-bag">
              <h3>Plecak (${state.inventory.items.length})</h3>
              ${gearFiltersHtml}
              ${itemsHtml}
            </div>
          </div>
        `
        : activeTab === 'journal'
          ? `
          <div class="ostrze-creator-grid ostrze-cs-two-col">
            <div class="ostrze-panel ostrze-cs-col" data-preserve-scroll="cs-quests">
              <h3>Aktywne zadania (${activeQuests.length})</h3>
              ${renderQuestList(activeQuests, 'Brak aktywnych zadań.')}
              <h3 class="ostrze-cs-subhead">Ukończone zadania (${doneQuests.length})</h3>
              ${renderQuestList(doneQuests, 'Brak ukończonych zadań.')}
            </div>
            <div class="ostrze-panel ostrze-cs-col" data-preserve-scroll="cs-keepsakes">
              <h3>Pamiątki z Brzeziny</h3>
              ${
                keepsakesHtml ||
                '<div class="ostrze-subtitle" style="margin-bottom:0">Nie niesiesz jeszcze żadnych osobistych pamiątek po towarzyszach.</div>'
              }
              <h3 class="ostrze-cs-subhead">Poznane lokacje (${readableKnownPlaces.length} / ${progress.totalLocations})</h3>
              <div class="ostrze-shop-desc">${escapeHtml(readableKnownPlaces.join(', ') || 'Brzezina — Dziedziniec')}</div>
            </div>
          </div>
        `
          : activeTab === 'bestiary'
            ? `
          <div class="ostrze-panel ostrze-cs-col" data-cs-bestiary="true" data-preserve-scroll="cs-bestiary">
            <h3>Bestiariusz i Wiedza Łowiecka (${unlockedBestiaryCount} / ${bestiaryEntries.length})</h3>
            <p class="ostrze-subtitle" style="margin-bottom:8px;">Pokonanie <strong>${HUNTER_LORE_KILL_THRESHOLD} sztuk</strong> danego gatunku odblokowuje <strong>Wiedzę Łowiecką (+1 obr. przeciwko temu wrogowi)</strong>.</p>
            <div class="ostrze-bestiary-grid">
              ${bestiaryCardsHtml}
            </div>
          </div>
        `
            : `
          <div class="ostrze-creator-grid ostrze-cs-two-col" data-cs-chronicle="true">
            <div class="ostrze-panel ostrze-cs-col" data-preserve-scroll="cs-progress">
              <h3>Postęp kampanii</h3>
              <div class="ostrze-chronicle-bars">
                <div class="ostrze-progress-item">
                  <div class="ostrze-row"><span>Prolog — Brzezina</span><strong class="ostrze-num">${progress.prologuePct}%</strong></div>
                  <div class="ostrze-progress-track"><div class="ostrze-progress-fill" style="width:${progress.prologuePct}%"></div></div>
                </div>
                <div class="ostrze-progress-item">
                  <div class="ostrze-row"><span>Akt I — Pogórze</span><strong class="ostrze-num">${progress.act1Pct}%</strong></div>
                  <div class="ostrze-progress-track"><div class="ostrze-progress-fill" style="width:${progress.act1Pct}%"></div></div>
                </div>
                <div class="ostrze-progress-item">
                  <div class="ostrze-row"><span>Akt II — Głusz</span><strong class="ostrze-num">${progress.act2Pct}%</strong></div>
                  <div class="ostrze-progress-track"><div class="ostrze-progress-fill" style="width:${progress.act2Pct}%"></div></div>
                </div>
              </div>
              <h3 class="ostrze-cs-subhead">Statystyki wyprawy</h3>
              <div class="ostrze-row"><span>Dzień wyprawy</span><strong>Dzień ${progress.daysElapsed}</strong></div>
              <div class="ostrze-row"><span>Atmosfera i pora</span><strong>${escapeHtml(progress.atmosphereLabel)}</strong></div>
              <div class="ostrze-row"><span>Odkryte lokacje</span><strong class="ostrze-num">${progress.visitedCount} / ${progress.totalLocations}</strong></div>
              <div class="ostrze-row"><span>Zadania (ukończone / aktywne)</span><strong class="ostrze-num">${progress.completedQuests} / ${progress.activeQuests}</strong></div>
              <div class="ostrze-row"><span>Doświadczenie / Talenty</span><strong class="ostrze-num">${progress.totalXp} XP · ${progress.perksCount}</strong></div>
            </div>
            <div class="ostrze-panel ostrze-cs-col" data-preserve-scroll="cs-achievements">
              <h3>Dokonania (${progress.unlockedAchievements} / ${progress.totalAchievements})</h3>
              <div class="ostrze-ach-grid">
                ${achievementsGridHtml}
              </div>
            </div>
          </div>
        `;

  const perkGuardVisible = closeGuardActive && hasUnspentPickablePerk(state, data);
  const requestClose = (): void => {
    if (onAttemptClose) {
      onAttemptClose();
    } else {
      onClose();
    }
  };

  const heroPortraitUrl = getSlavicPortrait('player');
  const footerHtml = perkGuardVisible
    ? `
        <div class="ostrze-modal-footer is-perk-guard" data-cs-perk-guard="true">
          <span class="ostrze-perk-guard-text ostrze-ico-title">${renderSlavicIcon('warn')}<span>Masz jeszcze niewybrany Talent (${ch.freePerkPicks})!</span></span>
          <div class="ostrze-perk-guard-actions">
            <button type="button" class="ostrze-hub-btn is-alert" data-cs-guard-go-perks="true">Przejdź do Talentów</button>
            <button type="button" class="ostrze-hub-btn" data-cs-guard-force-close="true">Zamknij mimo to</button>
          </div>
        </div>
      `
    : `
        <div class="ostrze-modal-footer">
          <span class="ostrze-modal-footer-hint">
            ${
              activeTab === 'stats'
                ? '★ Umiejętności oznaczone rosną o +2% za punkt · Talenty odblokowują się co 2 poziomy.'
                : activeTab === 'gear'
                  ? 'Przypnij opatrunki i mikstury do Pasa [4–7], aby używać ich szybko w walce.'
                  : 'Naciśnij ESC, aby wrócić do gry.'
            }
          </span>
          <button type="button" class="ostrze-btn ostrze-modal-close-btn" id="ostrze-cs-close">Zamknij <kbd class="ostrze-kbd">ESC</kbd></button>
        </div>
      `;

  mountModalCard(
    root,
    'ostrze-card ostrze-cs-card',
    `
        <div class="ostrze-cs-header">
          <div class="ostrze-cs-identity-wrap">
            <div class="ostrze-cs-portrait-frame">
              <img class="ostrze-cs-portrait" src="${escapeHtml(heroPortraitUrl)}" alt="${escapeHtml(ch.name)}" />
            </div>
            <div class="ostrze-cs-identity">
              <h2 class="ostrze-title ostrze-cs-hero-name">${escapeHtml(ch.name)} <span class="ostrze-cs-level-pill">Poz. ${ch.level}</span></h2>
              <div class="ostrze-shop-meta">
                <span class="ostrze-shop-tag">${escapeHtml(cls?.name ?? ch.classId)}</span>
                <span class="ostrze-shop-tag ostrze-num">AP: ${stats.derived.ap}</span>
                <span class="ostrze-shop-tag ostrze-num">Wola: ${wola} · Dług: ${dlug}</span>
                <span class="ostrze-purse-pill ostrze-ico-pill">${renderSlavicIcon('coin')}<strong class="ostrze-num">${ch.money} gr</strong></span>
              </div>
            </div>
          </div>
          <div class="ostrze-cs-header-right">
            <div class="ostrze-cs-bars">
              <div class="ostrze-hp-bar">
                <div class="ostrze-hp-fill ${hpPct <= 30 ? 'is-low' : ''}" style="width:${hpPct}%"></div>
                <span class="ostrze-hp-label">${ch.hp} / ${hpMax} HP</span>
              </div>
              <div class="ostrze-cs-xp-row" title="XP: ${ch.xp} / ${nextLvXp}">
                <div class="ostrze-xp-bar" style="margin:0;flex:1;">
                  <div class="ostrze-xp-fill" style="width:${xpPct}%"></div>
                </div>
                <span class="ostrze-cs-xp-text ostrze-num">${ch.xp}/${nextLvXp} XP</span>
              </div>
            </div>
            <button type="button" class="ostrze-modal-close-x" data-cs-close-top="true" aria-label="Zamknij" title="Zamknij [ESC]">×</button>
          </div>
        </div>

        <div class="ostrze-cs-tabs" role="tablist" aria-label="Sekcje karty postaci">
          <button type="button" role="tab" aria-selected="${activeTab === 'stats'}" class="ostrze-cs-tab ${activeTab === 'stats' ? 'is-active' : ''}" data-cs-tab="stats">
            ${renderSlavicIcon('star')}<span>Postać i Rozwój</span> <kbd class="ostrze-kbd">K</kbd> ${pendingPts > 0 ? `<span class="ostrze-cs-tab-badge">+${pendingPts}</span>` : ''}
          </button>
          <button type="button" role="tab" aria-selected="${activeTab === 'gear'}" class="ostrze-cs-tab ${activeTab === 'gear' ? 'is-active' : ''}" data-cs-tab="gear">
            ${renderSlavicIcon('weapon')}<span>Ekwipunek (${state.inventory.items.length})</span> <kbd class="ostrze-kbd">I</kbd>
          </button>
          <button type="button" role="tab" aria-selected="${activeTab === 'journal'}" class="ostrze-cs-tab ${activeTab === 'journal' ? 'is-active' : ''}" data-cs-tab="journal">
            ${renderSlavicIcon('quest')}<span>Dziennik</span> <kbd class="ostrze-kbd">J</kbd> ${activeQuests.length > 0 ? `<span class="ostrze-cs-tab-count">${activeQuests.length}</span>` : ''}
          </button>
          <button type="button" role="tab" aria-selected="${activeTab === 'bestiary'}" class="ostrze-cs-tab ${activeTab === 'bestiary' ? 'is-active' : ''}" data-cs-tab="bestiary">
            ${renderSlavicIcon('beast')}<span>Bestiariusz (${unlockedBestiaryCount}/${bestiaryEntries.length})</span> <kbd class="ostrze-kbd">B</kbd>
          </button>
          <button type="button" role="tab" aria-selected="${activeTab === 'chronicle'}" class="ostrze-cs-tab ${activeTab === 'chronicle' ? 'is-active' : ''}" data-cs-tab="chronicle">
            ${renderSlavicIcon('trophy')}<span>Kronika (${progress.unlockedAchievements}/${progress.totalAchievements})</span>
          </button>
        </div>

        <div class="ostrze-cs-body" data-preserve-scroll="cs-body">
          ${tabContentHtml}
        </div>

        ${footerHtml}
    `,
    { onOverlayBackdropClick: requestClose }
  );

  root.querySelectorAll<HTMLElement>('[data-cs-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextTab = btn.dataset.csTab as CharacterSheetTab | undefined;
      if (nextTab && nextTab !== activeTab) {
        ostrzeAudio.playUiClick();
        onSelectTab(nextTab);
      }
    });
  });

  root.querySelector('[data-cs-focus-perks]')?.addEventListener('click', () => {
    const perksPanel = root.querySelector<HTMLElement>('[data-cs-perks-panel]');
    perksPanel?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    perksPanel?.classList?.add('is-pulse-highlight');
    window.setTimeout(() => perksPanel?.classList?.remove('is-pulse-highlight'), 900);
  });

  root.querySelectorAll<HTMLElement>('[data-cs-gear-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextFilter = btn.dataset.csGearFilter as InventoryCategoryFilter | undefined;
      if (nextFilter && nextFilter !== activeGearCategoryFilter) {
        ostrzeAudio.playUiClick();
        activeGearCategoryFilter = nextFilter;
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-attr]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const attrId = btn.dataset.csAttr as AttributeId;
      if (spendAttributePoint(state, attrId, data)) {
        ostrzeAudio.playUiClick();
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-skill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skillId = btn.dataset.csSkill as SkillId;
      if (spendSkillPoint(state, skillId, data)) {
        ostrzeAudio.playUiClick();
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-perk]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const perkId = btn.dataset.csPerk ?? '';
      const perkDef = data.perks.find((p) => p.id === perkId);
      if (pickPerk(state, perkId, data)) {
        ostrzeAudio.playPerkPick();
        if (perkDef) {
          onShowToast(`Wybrano talent: ${perkDef.name}`, 'gold');
        }
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-equip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.csEquip ?? '';
      const item = data.items.find((i) => i.id === itemId);
      const equipSlot = item?.slot ?? (item?.type === 'weapon' ? 'bron' : undefined);
      if (item && equipSlot) {
        state.inventory.equipped[equipSlot] = itemId;
        if (state.character) {
          const maxHp = getStats(state, data).derived.hpMax;
          state.character.hp = Math.max(1, Math.min(maxHp, state.character.hp));
        }
        onShowToast(`Założono: ${item.name}`, 'info');
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-unequip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slot = btn.dataset.csUnequip ?? '';
      const prevId = state.inventory.equipped[slot];
      if (slot && prevId) {
        const prevItem = data.items.find((i) => i.id === prevId);
        delete state.inventory.equipped[slot];
        if (state.character) {
          const maxHp = getStats(state, data).derived.hpMax;
          state.character.hp = Math.max(1, Math.min(maxHp, state.character.hp));
        }
        onShowToast(`Zdjęto: ${prevItem?.name ?? prevId}`, 'info');
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-use]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.csUse ?? '';
      const item = data.items.find((i) => i.id === itemId);
      const invEntry = state.inventory.items.find((i) => i.id === itemId);
      if (item && invEntry && invEntry.qty > 0 && state.character) {
        const curStats = getStats(state, data);
        const maxHp = curStats.derived.hpMax;
        let healed = 0;
        if (Array.isArray(item.heal)) {
          const [lo, hi] = item.heal;
          const skillBonus = item.healSkill ? (curStats.skills[item.healSkill] ?? 0) : 0;
          const rawHeal = Math.floor(rng.int(lo, hi) * (1 + skillBonus / 100));
          healed = Math.max(0, Math.min(maxHp - state.character.hp, rawHeal));
          state.character.hp += healed;
        } else if (typeof item.healHp === 'number' && item.healHp > 0) {
          healed = Math.max(0, Math.min(maxHp - state.character.hp, item.healHp));
          state.character.hp += healed;
        }
        if (Array.isArray(item.removes) && item.removes.length > 0) {
          const removeSet = new Set(item.removes);
          state.character.effects = state.character.effects.filter(
            (eff) => !removeSet.has(eff.id)
          );
        }
        invEntry.qty -= 1;
        if (invEntry.qty <= 0) {
          state.inventory.items = state.inventory.items.filter((i) => i.id !== itemId);
        }
        onShowToast(
          healed > 0 ? `Użyto ${item.name} (+${healed} HP)` : `Użyto ${item.name}`,
          'success'
        );
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-belt-slot-select]').forEach((slotEl) => {
    const toggleSlot = (): void => {
      const idx = Number(slotEl.dataset.csBeltSlotSelect);
      if (!Number.isNaN(idx)) {
        ostrzeAudio.playUiClick();
        selectedQuickBeltSlot = selectedQuickBeltSlot === idx ? null : idx;
        onRerender();
      }
    };
    slotEl.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement | null)?.closest('[data-cs-belt-unpin]')) return;
      toggleSlot();
    });
    slotEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggleSlot();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-belt-quickpin]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.csBeltQuickpin ?? '';
      if (itemId) {
        const slotIdx = resolveTargetQuickBeltSlot(state.inventory.quickBelt, selectedQuickBeltSlot);
        pinItemToQuickBelt(state, slotIdx, itemId);
        selectedQuickBeltSlot = null;
        ostrzeAudio.playUiClick();
        onShowToast(`Przypięto do pasa szybkiego użycia [Slot ${slotIdx + 4}].`, 'info');
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-cs-belt-unpin]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const slotIdx = Number(btn.dataset.csBeltUnpin);
      if (!Number.isNaN(slotIdx)) {
        pinItemToQuickBelt(state, slotIdx, null);
        ostrzeAudio.playUiClick();
        onShowToast(`Odpięto slot [${slotIdx + 4}] (powrót do auto-doboru).`, 'info');
        onUpdated();
        onRerender();
      }
    });
  });

  root.querySelector('#ostrze-cs-close')?.addEventListener('click', requestClose);
  root.querySelector('[data-cs-close-top]')?.addEventListener('click', requestClose);

  root.querySelector('[data-cs-guard-go-perks]')?.addEventListener('click', () => {
    ostrzeAudio.playUiClick();
    onCancelCloseGuard?.();
    if (activeTab !== 'stats') {
      onSelectTab('stats');
    } else {
      const perksPanel = root.querySelector<HTMLElement>('[data-cs-perks-panel]');
      perksPanel?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      perksPanel?.classList?.add('is-pulse-highlight');
      window.setTimeout(() => perksPanel?.classList?.remove('is-pulse-highlight'), 900);
    }
  });

  root.querySelector('[data-cs-guard-force-close]')?.addEventListener('click', () => {
    ostrzeAudio.playUiClick();
    onClose();
  });
}
