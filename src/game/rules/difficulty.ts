import type { OstrzeGameState } from '../data/originTypes';

export type OstrzeDifficultyId = 'story' | 'classic' | 'challenge';

export interface OstrzeDifficultyProfile {
  id: OstrzeDifficultyId;
  code: number;
  label: string;
  shortDesc: string;
  enemyHpMult: number;
  enemyDamageMult: number;
  playerHitBonusPct: number;
  bossApBonus: number;
}

export const DIFFICULTY_PROFILES: Readonly<Record<OstrzeDifficultyId, OstrzeDifficultyProfile>> = {
  story: {
    id: 'story',
    code: 0,
    label: 'Fabularny',
    shortDesc: 'Wrogowie -25% HP i obrażeń, +15% trafienia gracza',
    enemyHpMult: 0.75,
    enemyDamageMult: 0.75,
    playerHitBonusPct: 15,
    bossApBonus: 0
  },
  classic: {
    id: 'classic',
    code: 1,
    label: 'Klasyczny',
    shortDesc: 'Zbalansowany standard Drakensang / Fallout (100%)',
    enemyHpMult: 1,
    enemyDamageMult: 1,
    playerHitBonusPct: 0,
    bossApBonus: 0
  },
  challenge: {
    id: 'challenge',
    code: 2,
    label: 'Wyzwanie',
    shortDesc: 'Wrogowie +25% HP, +20% obrażeń, bossowie +1 AP',
    enemyHpMult: 1.25,
    enemyDamageMult: 1.2,
    playerHitBonusPct: 0,
    bossApBonus: 1
  }
};

export const DIFFICULTY_ORDER: readonly OstrzeDifficultyId[] = ['story', 'classic', 'challenge'];

export function getDifficultyProfile(id: OstrzeDifficultyId): OstrzeDifficultyProfile {
  return DIFFICULTY_PROFILES[id] ?? DIFFICULTY_PROFILES.classic;
}

export function getOstrzeDifficulty(state: OstrzeGameState | null | undefined): OstrzeDifficultyId {
  const code = state?.vars?.difficulty_tier;
  if (code === 0) return 'story';
  if (code === 2) return 'challenge';
  return 'classic';
}

export function setOstrzeDifficulty(state: OstrzeGameState, id: OstrzeDifficultyId): void {
  state.vars.difficulty_tier = DIFFICULTY_PROFILES[id].code;
}

export function cycleOstrzeDifficulty(current: OstrzeDifficultyId): OstrzeDifficultyId {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  return DIFFICULTY_ORDER[(idx + 1) % DIFFICULTY_ORDER.length];
}
