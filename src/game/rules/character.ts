import type {
  AttributeId,
  ClassId,
  OriginGameData,
  OstrzeGameState,
  PerkDef,
  SkillId
} from '../data/originTypes';
import type { SeededRng } from './dice';
import { getStats } from './stats';

export interface CharacterCreationInput {
  name: string;
  classId: ClassId;
  attributes: Record<AttributeId, number>;
  tagged: SkillId[];
}

export interface XpAwardResult {
  xpAdded: number;
  levelsGained: number;
  newLevel: number;
}

export interface DialogueCheckResult {
  chance: number;
  roll: number;
  success: boolean;
  alreadyFailed: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function createEmptyOstrzeState(
  data: OriginGameData,
  seed: number = 12345
): OstrzeGameState {
  const vars: Record<string, number> = {};
  for (const name of data.rules.vars) {
    vars[name] = 0;
  }

  return {
    character: null,
    inventory: {
      items: [],
      equipped: {}
    },
    time: {
      minutes: data.rules.startHour * 60
    },
    flags: {},
    vars,
    quests: {},
    world: {
      location: 'brzezina',
      activePhenomenon: null,
      failedChecks: [],
      knownPlaces: ['brzezina']
    },
    rngState: seed >>> 0
  };
}

/**
 * Validates and initializes a level-1 Ostrze character on the game state.
 */
export function createCharacter(
  state: OstrzeGameState,
  input: CharacterCreationInput,
  data: OriginGameData
): OstrzeGameState {
  const cls = data.classes.find((c) => c.id === input.classId);
  if (!cls) {
    throw new Error(`Nieznana klasa postaci: ${input.classId}`);
  }

  const creator = data.rules.creator;
  const trimmedName = input.name.trim();
  if (trimmedName.length < creator.nameMin || trimmedName.length > creator.nameMax) {
    throw new Error(
      `Imię musi mieć od ${creator.nameMin} do ${creator.nameMax} znaków.`
    );
  }

  const totalPool =
    data.attributes.length * creator.attributeStart +
    creator.points +
    Object.values(creator.gifts).reduce((sum, v) => sum + (v ?? 0), 0);

  let spentPool = 0;
  for (const attr of data.attributes) {
    const val = input.attributes[attr.id];
    const min = creator.attributeMin + (creator.gifts[attr.id] ?? 0);
    const max = creator.attributeMax + (creator.gifts[attr.id] ?? 0);
    if (!Number.isInteger(val) || val < min || val > max) {
      throw new Error(`Atrybut ${attr.id} poza zakresem (${min}..${max}).`);
    }
    spentPool += val;
  }

  if (spentPool !== totalPool) {
    throw new Error(`Suma atrybutów musi wynosić ${totalPool} (jest ${spentPool}).`);
  }

  const uniqueTagged = Array.from(new Set(input.tagged));
  if (uniqueTagged.length !== creator.taggedCount) {
    throw new Error(`Wymagane dokładnie ${creator.taggedCount} oznaczone umiejętności.`);
  }
  if (!uniqueTagged.includes(cls.taggedSkill)) {
    throw new Error(`Klasa ${cls.id} wymaga oznaczenia umiejętności ${cls.taggedSkill}.`);
  }

  state.character = {
    name: trimmedName,
    classId: cls.id,
    level: 1,
    xp: 0,
    hp: 1,
    money: cls.startMoney,
    attributes: { ...input.attributes },
    tagged: uniqueTagged,
    skillPoints: {},
    freeSkillPoints: 0,
    freeAttributePoints: 0,
    freePerkPicks: 0,
    perks: [],
    mastery: { ...cls.masteryStart },
    effects: []
  };

  state.inventory = {
    items: cls.startItems.map((entry) => ({ ...entry })),
    equipped: { ...cls.startEquipped }
  };

  state.flags[`klasa_${cls.id}`] = true;

  const stats = getStats(state, data);
  state.character.hp = stats.derived.hpMax;

  return state;
}

export function xpRequiredForLevel(level: number, xpStep: number): number {
  if (level <= 1) return 0;
  return (xpStep * (level - 1) * level) / 2;
}

export function grantXp(
  state: OstrzeGameState,
  amount: number,
  data: OriginGameData
): XpAwardResult {
  const ch = state.character;
  if (!ch) throw new Error('grantXp: brak postaci');
  const xpAdded = Math.max(0, Math.floor(amount));
  ch.xp += xpAdded;

  let levelsGained = 0;
  const lv = data.rules.leveling;

  while (ch.xp >= xpRequiredForLevel(ch.level + 1, lv.xpStep)) {
    ch.level += 1;
    levelsGained += 1;
    const rozum = getStats(state, data).permanentAttributes.rozum;
    ch.freeSkillPoints += lv.skillPointsBase + Math.floor(rozum / lv.skillPointsRozumDiv);

    if (ch.level % lv.perkEveryLevels === 0 && ch.perks.length + ch.freePerkPicks < lv.maxPerks) {
      ch.freePerkPicks += 1;
    }
    if (ch.level % lv.attributeEveryLevels === 1) {
      ch.freeAttributePoints += 1;
    }
  }

  if (levelsGained > 0) {
    ch.hp = getStats(state, data).derived.hpMax;
  }

  return {
    xpAdded,
    levelsGained,
    newLevel: ch.level
  };
}

export function computeDialogueCheckChance(
  state: OstrzeGameState,
  checkId: string,
  difficulty: number,
  data: OriginGameData
): number {
  const stats = getStats(state, data);
  const d = data.rules.dialogue;

  const skillVal = (stats.skills as Record<string, number>)[checkId];
  const attrVal = (stats.attributes as Record<string, number>)[checkId];
  const score =
    typeof skillVal === 'number'
      ? skillVal
      : typeof attrVal === 'number'
        ? attrVal * d.attributeMult
        : 0;

  return clamp(score - difficulty + d.skillBase, d.chanceMin, d.chanceMax);
}

export function rollDialogueCheck(
  state: OstrzeGameState,
  checkKey: string,
  checkId: string,
  difficulty: number,
  retry: boolean,
  data: OriginGameData,
  rng: SeededRng
): DialogueCheckResult {
  if (!retry && state.world.failedChecks.includes(checkKey)) {
    return {
      chance: computeDialogueCheckChance(state, checkId, difficulty, data),
      roll: 100,
      success: false,
      alreadyFailed: true
    };
  }

  const chance = computeDialogueCheckChance(state, checkId, difficulty, data);
  const { roll, success } = rng.percent(chance);

  if (!success && !retry) {
    state.world.failedChecks.push(checkKey);
  }

  return {
    chance,
    roll,
    success,
    alreadyFailed: false
  };
}

/**
 * Spends 1 free attribute point on the given attribute (respecting attributeMax).
 */
export function spendAttributePoint(
  state: OstrzeGameState,
  attrId: AttributeId,
  data: OriginGameData
): boolean {
  const ch = state.character;
  if (!ch || ch.freeAttributePoints <= 0) return false;
  const current = ch.attributes[attrId] ?? 0;
  const max = data.rules.creator.attributeMax + (data.rules.creator.gifts[attrId] ?? 0);
  if (current >= max) return false;
  ch.attributes[attrId] = current + 1;
  ch.freeAttributePoints -= 1;
  const newMax = getStats(state, data).derived.hpMax;
  ch.hp = Math.min(newMax, ch.hp + data.rules.derived.hpPerKrzepa);
  return true;
}

/**
 * Spends 1 free skill point (+2 for tagged skills, +1 otherwise) on the given skill.
 */
export function spendSkillPoint(
  state: OstrzeGameState,
  skillId: SkillId,
  data: OriginGameData
): boolean {
  const ch = state.character;
  if (!ch || ch.freeSkillPoints <= 0) return false;
  const stats = getStats(state, data);
  const currentTotal = stats.skills[skillId] ?? 0;
  if (currentTotal >= 100) return false;

  const gain = ch.tagged.includes(skillId) ? 2 : 1;
  ch.skillPoints[skillId] = (ch.skillPoints[skillId] ?? 0) + gain;
  ch.freeSkillPoints -= 1;
  return true;
}

/**
 * Checks whether the character meets a perk's requirements and has not picked it yet.
 */
export function canPickPerk(
  state: OstrzeGameState,
  perk: PerkDef,
  data: OriginGameData
): boolean {
  const ch = state.character;
  if (!ch || ch.perks.includes(perk.id)) return false;

  const req = perk.requires as
    | { level?: number; attributes?: Partial<Record<AttributeId, number>>; skills?: Partial<Record<SkillId, number>> }
    | undefined;
  if (!req) return true;

  if (typeof req.level === 'number' && ch.level < req.level) {
    return false;
  }

  const stats = getStats(state, data);
  if (req.attributes) {
    for (const [attr, minVal] of Object.entries(req.attributes)) {
      if ((stats.permanentAttributes[attr as AttributeId] ?? 0) < (minVal ?? 0)) {
        return false;
      }
    }
  }
  if (req.skills) {
    for (const [skill, minVal] of Object.entries(req.skills)) {
      if ((stats.skills[skill as SkillId] ?? 0) < (minVal ?? 0)) {
        return false;
      }
    }
  }
  return true;
}

export function getAvailablePerks(state: OstrzeGameState, data: OriginGameData): PerkDef[] {
  return data.perks.filter((perk) => canPickPerk(state, perk, data));
}

/**
 * Picks an eligible perk using 1 free perk pick.
 */
export function pickPerk(
  state: OstrzeGameState,
  perkId: string,
  data: OriginGameData
): boolean {
  const ch = state.character;
  if (!ch || ch.freePerkPicks <= 0) return false;
  const perk = data.perks.find((p) => p.id === perkId);
  if (!perk || !canPickPerk(state, perk, data)) return false;

  ch.perks.push(perk.id);
  ch.freePerkPicks -= 1;
  const newMax = getStats(state, data).derived.hpMax;
  ch.hp = Math.min(newMax, ch.hp);
  return true;
}
