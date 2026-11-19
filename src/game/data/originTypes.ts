export type AttributeId =
  | 'sila'
  | 'zrecznosc'
  | 'krzepa'
  | 'bystrosc'
  | 'rozum'
  | 'oglada'
  | 'fart';

export type SkillId =
  | 'sieczna'
  | 'drzewcowa'
  | 'strzelecka'
  | 'proch'
  | 'wrecz'
  | 'miotanie'
  | 'medycyna'
  | 'skradanie'
  | 'wymowa'
  | 'handel'
  | 'wiedza_tajemna';

export type ClassId = 'miecz' | 'wlocznia';

export type TimeOfDayId = 'swit' | 'dzien' | 'zmierzch' | 'noc';

export interface AttributeDef {
  id: AttributeId;
  name: string;
  description: string;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  taggedSkill: SkillId;
  startItems: Array<{ id: string; qty: number }>;
  startEquipped: Record<string, string>;
  startMoney: number;
  masteryStart: Record<string, number>;
  modifiers?: Record<string, number>;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  primary: AttributeId;
  secondary: AttributeId;
}

export interface PerkDef {
  id: string;
  name: string;
  description?: string;
  requires?: Record<string, unknown>;
  modifiers?: Record<string, number>;
  unlocks?: string[];
}

export interface EffectDef {
  id: string;
  name: string;
  unit?: 'turn' | 'hour';
  modifiers?: Record<string, number>;
  maxStacks?: number;
}

export interface PhenomenonDef {
  id: string;
  name: string;
  kind?: 'magiczne' | 'pogodowe';
  modifiers?: Record<string, number>;
  bystroscSkillPenalty?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  type: string;
  slot?: string;
  value?: number;
  weight?: number;
  armor?: number;
  reduction?: Record<string, number>;
  damage?: [number, number];
  damageType?: string;
  skill?: SkillId;
  mastery?: string;
  masteryType?: string;
  heal?: [number, number];
  healSkill?: SkillId;
  healHp?: number;
  removes?: string[];
  applies?: string[];
  food?: {
    order: number;
    risk?: { effect: string; chance: number; safeTagged?: SkillId };
  };
  modifiers?: Record<string, number>;
  description?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  ap: number;
  defense: number;
  initiative: number;
  xp: number;
  damage?: [number, number];
  damageTaken?: Record<string, number>;
}

export interface ShopDef {
  id: string;
  name?: string;
  stock: Array<{ id: string; qty: number }>;
  buys?: string[];
  priceModifiers?: Array<{
    if?: ConditionSpec;
    buyPercent?: number;
    sellPercent?: number;
  }>;
}

export interface StoryDataDef {
  start: string;
  scenes: Array<Record<string, unknown>>;
}

export type ConditionSpec = Record<string, unknown>;

export interface DialogueActionSpec {
  setFlag?: string;
  clearFlag?: string;
  addVar?: Record<string, number>;
  giveItem?: string | { id: string; qty?: number };
  takeItem?: string | { id: string; qty?: number };
  takeMoney?: number;
  giveMoney?: number;
  giveXp?: number;
  applyEffect?: string | { id: string; stacks?: number };
  addEffect?: string | { id: string; stacks?: number };
  healFull?: boolean;
  openShop?: string;
  startQuest?: string;
  completeQuest?: string;
  failQuest?: string;
  reveal?: string;
  time?: number;
}

export type QuestStatus = 'none' | 'active' | 'completed' | 'failed';

export interface QuestDef {
  id: string;
  kind?: string;
  name: string;
  hub?: string;
  description: string;
  location?: string;
  route?: string;
  deadlineDays?: number | null;
  report?: boolean;
  reportTo?: string;
  onComplete?: Array<{ giveMoney?: number; xp?: number }>;
}

export interface DialogueOptionDef {
  id?: string;
  text: string;
  goto?: string;
  requires?: ConditionSpec;
  check?: {
    skill?: SkillId;
    attribute?: AttributeId;
    difficulty: number;
    retry?: boolean;
  };
  success?: string;
  failure?: string;
  actions?: DialogueActionSpec[];
}

export interface DialogueNodeDef {
  speaker?: string;
  text: string;
  actions?: DialogueActionSpec[];
  options?: DialogueOptionDef[];
}

export interface DialogueFileDef {
  id: string;
  portrait?: string;
  start: string;
  nodes: Record<string, DialogueNodeDef>;
}

export interface RulesDef {
  startHour: number;
  creator: {
    attributeStart: number;
    attributeMin: number;
    attributeMax: number;
    points: number;
    gifts: Partial<Record<AttributeId, number>>;
    taggedCount: number;
    taggedBonus: number;
    nameMin: number;
    nameMax: number;
  };
  skills: {
    primaryMult: number;
    secondaryMult: number;
    max: number;
    taggedPointValue: number;
  };
  derived: {
    hpBase: number;
    hpPerKrzepa: number;
    hpPerLevelBase: number;
    hpPerLevelKrzepaDiv: number;
    apBase: number;
    apZrecznoscDiv: number;
    carryBase: number;
    carryPerSila: number;
    defensePerZrecznosc: number;
  };
  leveling: {
    xpStep: number;
    skillPointsBase: number;
    skillPointsRozumDiv: number;
    perkEveryLevels: number;
    maxPerks: number;
    attributeEveryLevels: number;
  };
  timeOfDay: Array<{
    id: TimeOfDayId;
    from: number;
    to: number;
    modifiers: Record<string, number>;
    bystroscSkillPenalty?: number;
  }>;
  dialogue: {
    minutes: number;
    skillBase: number;
    attributeMult: number;
    chanceMin: number;
    chanceMax: number;
  };
  inventory?: {
    maxReductionPercent?: number;
    softCap?: {
      armorFrom: number;
      reductionFrom: number;
      rate: number;
    };
  };
  vars: string[];
  travel?: {
    localEventChance: number;
    localDangerBonus: number;
    repeat?: { decay: number; floorWalk: number };
    night?: { periods: string[]; eventBonus: number; attackWeight: number };
  };
}

export interface OriginTravelSceneDef {
  id: string;
  type: string;
  title?: string;
  text?: string;
  time?: number;
  goto?: string;
  items?: string[];
  shop?: string;
  dialogue?: string;
  start?: string;
  canFlee?: boolean;
  onFlee?: string;
  enemies?: Array<{ id: string; count: number }>;
  if?: ConditionSpec;
}

export interface OriginTravelEventDef {
  id: string;
  kind: 'encounter' | 'attack' | 'weather' | 'story';
  weight: number;
  once?: boolean;
  endsTrip?: boolean;
  phenomenon?: string;
  if?: ConditionSpec;
  scenes?: OriginTravelSceneDef[];
}

export interface OriginGameData {
  attributes: AttributeDef[];
  classes: ClassDef[];
  skills: SkillDef[];
  perks: PerkDef[];
  effects: EffectDef[];
  phenomena: PhenomenonDef[];
  items: ItemDef[];
  enemies: EnemyDef[];
  shops: ShopDef[];
  quests: QuestDef[];
  story: StoryDataDef;
  travelScenes: Record<string, { id: string; title?: string; text?: string; type?: string }>;
  travelEvents: OriginTravelEventDef[];
  rules: RulesDef;
  prologueDialogues: Record<string, DialogueFileDef>;
}

export interface OstrzeCharacterState {
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  hp: number;
  money: number;
  attributes: Record<AttributeId, number>;
  tagged: SkillId[];
  skillPoints: Partial<Record<SkillId, number>>;
  freeSkillPoints: number;
  freeAttributePoints: number;
  freePerkPicks: number;
  perks: string[];
  mastery: Record<string, number>;
  effects: Array<{ id: string; stacks: number; remainingHours?: number }>;
}

export interface OstrzeGameState {
  character: OstrzeCharacterState | null;
  inventory: {
    items: Array<{ id: string; qty: number }>;
    equipped: Record<string, string | null>;
  };
  time: {
    minutes: number;
  };
  flags: Record<string, boolean>;
  vars: Record<string, number>;
  quests: Record<string, QuestStatus>;
  world: {
    location: string;
    activePhenomenon: string | null;
    failedChecks: string[];
    knownPlaces: string[];
    passes?: Record<string, number>;
    eventsSeen?: string[];
  };
  rngState: number;
}
