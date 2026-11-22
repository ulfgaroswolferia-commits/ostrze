import type {
  AttributeId,
  OriginGameData,
  OstrzeGameState,
  SkillId
} from '../data/originTypes';
import { timeOfDay } from './time';

export interface ModifierSource {
  kind: 'class' | 'perk' | 'timeOfDay' | 'item' | 'effect' | 'phenomenon';
  id: string;
  modifiers: Record<string, number>;
  permanent: boolean;
}

export interface ComputedStats {
  attributes: Record<AttributeId, number>;
  permanentAttributes: Record<AttributeId, number>;
  skills: Record<SkillId, number>;
  derived: {
    hpMax: number;
    ap: number;
    carry: number;
    defense: number;
    rangedHitChance: number;
    meleeHitChance: number;
    critChance: number;
    fleeChance: number;
    initiative: number;
    armor: number;
    bonusDamage: number;
    resistStrach: number;
    resistOgluszenie: number;
    resistRozkojarzenie: number;
  };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function withBystroscPenalty(
  data: OriginGameData,
  modifiers: Record<string, number> | undefined,
  penalty: number | undefined
): Record<string, number> {
  const out: Record<string, number> = { ...(modifiers ?? {}) };
  if (typeof penalty === 'number' && penalty !== 0) {
    for (const skill of data.skills) {
      if (skill.primary === 'bystrosc' || skill.secondary === 'bystrosc') {
        out[skill.id] = (out[skill.id] ?? 0) + penalty;
      }
    }
  }
  return out;
}

function collectSources(state: OstrzeGameState, data: OriginGameData): ModifierSource[] {
  const ch = state.character;
  if (!ch) return [];

  const sources: ModifierSource[] = [];

  const cls = data.classes.find((c) => c.id === ch.classId);
  if (cls?.modifiers) {
    sources.push({ kind: 'class', id: cls.id, modifiers: cls.modifiers, permanent: true });
  }

  for (const perkId of ch.perks) {
    const perk = data.perks.find((p) => p.id === perkId);
    if (perk?.modifiers) {
      sources.push({ kind: 'perk', id: perk.id, modifiers: perk.modifiers, permanent: true });
    }
  }

  const todId = timeOfDay(state.time.minutes, data.rules);
  const todEntry = data.rules.timeOfDay.find((e) => e.id === todId);
  if (todEntry) {
    sources.push({
      kind: 'timeOfDay',
      id: todId,
      modifiers: withBystroscPenalty(data, todEntry.modifiers, todEntry.bystroscSkillPenalty),
      permanent: false
    });
  }

  const equipped = state.inventory?.equipped ?? {};
  for (const [slot, itemId] of Object.entries(equipped)) {
    if (!itemId || slot === 'bron_zapas' || slot === 'bron_druga') continue;
    const item = data.items.find((it) => it.id === itemId);
    if (item?.modifiers) {
      sources.push({ kind: 'item', id: item.id, modifiers: item.modifiers, permanent: false });
    }
  }

  for (const eff of ch.effects) {
    const def = data.effects.find((e) => e.id === eff.id);
    if (!def?.modifiers) continue;
    const scaled: Record<string, number> = {};
    for (const [k, v] of Object.entries(def.modifiers)) {
      if (typeof v === 'number') {
        scaled[k] = v * eff.stacks;
      }
    }
    sources.push({ kind: 'effect', id: eff.id, modifiers: scaled, permanent: false });
  }

  if (state.world.activePhenomenon) {
    const phen = data.phenomena.find((p) => p.id === state.world.activePhenomenon);
    if (phen) {
      sources.push({
        kind: 'phenomenon',
        id: phen.id,
        modifiers: withBystroscPenalty(data, phen.modifiers, phen.bystroscSkillPenalty),
        permanent: false
      });
    }
  }

  return sources;
}

function sumKey(sources: ModifierSource[], key: string): number {
  let total = 0;
  for (const s of sources) {
    const v = s.modifiers[key];
    if (typeof v === 'number') total += v;
  }
  return total;
}

/**
 * Pure computation of Ostrze attributes, skills, and derived values.
 * Mirrors origin/src/systems/stats.js without mutating base character values.
 */
export function getStats(
  state: OstrzeGameState,
  data: OriginGameData,
  opts: { permanentOnly?: boolean } = {}
): ComputedStats {
  const ch = state.character;
  if (!ch) {
    throw new Error('getStats: brak postaci w stanie gry');
  }

  const allSources = collectSources(state, data).filter(
    (s) => !(opts.permanentOnly && !s.permanent)
  );
  const permSources = allSources.filter((s) => s.permanent);

  const permanentAttributes = {} as Record<AttributeId, number>;
  const attributes = {} as Record<AttributeId, number>;

  for (const attr of data.attributes) {
    const base = ch.attributes[attr.id];
    permanentAttributes[attr.id] = base + sumKey(permSources, attr.id);
    attributes[attr.id] = Math.max(0, base + sumKey(allSources, attr.id));
  }

  const skRules = data.rules.skills;
  const skills = {} as Record<SkillId, number>;
  for (const skill of data.skills) {
    const tagged = ch.tagged.includes(skill.id);
    const base =
      skRules.primaryMult * permanentAttributes[skill.primary] +
      skRules.secondaryMult * permanentAttributes[skill.secondary] +
      (tagged ? data.rules.creator.taggedBonus : 0) +
      (ch.skillPoints[skill.id] ?? 0) * (tagged ? skRules.taggedPointValue : 1);

    skills[skill.id] = clamp(base + sumKey(allSources, skill.id), 0, skRules.max);
  }

  const d = data.rules.derived;
  const hpMax =
    d.hpBase +
    d.hpPerKrzepa * attributes.krzepa +
    (ch.level - 1) * (d.hpPerLevelBase + Math.floor(attributes.krzepa / d.hpPerLevelKrzepaDiv)) +
    sumKey(allSources, 'hpMax');

  const ap = d.apBase + Math.floor(attributes.zrecznosc / d.apZrecznoscDiv) + sumKey(allSources, 'ap');
  const carry = d.carryBase + d.carryPerSila * attributes.sila + sumKey(allSources, 'carry');
  const defense = d.defensePerZrecznosc * attributes.zrecznosc + sumKey(allSources, 'defense');

  const equipped = opts.permanentOnly ? {} : (state.inventory?.equipped ?? {});
  let wornArmor = 0;
  for (const [slot, itemId] of Object.entries(equipped)) {
    if (!itemId || slot === 'bron_zapas' || slot === 'bron_druga') continue;
    const item = data.items.find((it) => it.id === itemId);
    if (typeof item?.armor === 'number') {
      wornArmor += item.armor;
    }
  }
  const softCap = data.rules.inventory?.softCap;
  const cappedWornArmor =
    !softCap || wornArmor <= softCap.armorFrom
      ? wornArmor
      : Math.floor(softCap.armorFrom + (wornArmor - softCap.armorFrom) * softCap.rate);
  const armor = cappedWornArmor + sumKey(allSources, 'armor');

  const hasOiledBlade = !opts.permanentOnly && ch.effects.some((e) => e.id === 'natluszczone_ostrze');
  const oilDefHasDamage = Boolean(
    data.effects.find((e) => e.id === 'natluszczone_ostrze')?.modifiers?.damage
  );
  const bonusDamage = sumKey(allSources, 'damage') + (hasOiledBlade && !oilDefHasDamage ? 2 : 0);

  return {
    attributes,
    permanentAttributes,
    skills,
    derived: {
      hpMax: Math.max(1, hpMax),
      ap: Math.max(1, ap),
      carry,
      defense,
      rangedHitChance: sumKey(allSources, 'rangedHitChance'),
      meleeHitChance: sumKey(allSources, 'meleeHitChance'),
      critChance: attributes.fart + sumKey(allSources, 'critChance'),
      fleeChance: sumKey(allSources, 'fleeChance'),
      initiative: attributes.bystrosc + attributes.zrecznosc + sumKey(allSources, 'initiative'),
      armor,
      bonusDamage,
      resistStrach: sumKey(allSources, 'resist_strach'),
      resistOgluszenie: sumKey(allSources, 'resist_ogluszenie'),
      resistRozkojarzenie: sumKey(allSources, 'resist_rozkojarzenie')
    }
  };
}
