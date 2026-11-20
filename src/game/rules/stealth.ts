import type { OriginGameData, OstrzeGameState } from '../data/originTypes';
import type { SeededRng } from './dice';
import { getStats } from './stats';
import { timeOfDay } from './time';

export interface StealthCheckResult {
  evadeChancePct: number;
  roll: number;
  detected: boolean;
}

/**
 * Computes the player's chance (10..95%) to remain unseen when crossing an enemy's
 * vision cone, combining Ostrze's `skradanie` skill, time of day, active phenomenon
 * (e.g. `mgla_ciszy` +20%), and proximity distance.
 */
export function computeStealthEvadeChance(
  state: OstrzeGameState,
  data: OriginGameData,
  enemyDistance: number
): number {
  const stats = getStats(state, data);
  const baseSkill = stats.skills.skradanie ?? 25;

  const tod = timeOfDay(state.time.minutes, data.rules);
  const timeBonus = tod === 'noc' ? 18 : tod === 'zmierzch' || tod === 'swit' ? 8 : 0;

  let phenomenonBonus = 0;
  if (state.world.activePhenomenon) {
    const ph = data.phenomena.find((p) => p.id === state.world.activePhenomenon);
    if (ph?.modifiers?.skradanie) {
      phenomenonBonus += ph.modifiers.skradanie;
    } else if (state.world.activePhenomenon === 'mgla_poranna') {
      phenomenonBonus += 12;
    }
  }

  const distPenalty = enemyDistance < 4 ? Math.round((4 - enemyDistance) * 6) : 0;
  return Math.max(10, Math.min(95, Math.round(baseSkill + timeBonus + phenomenonBonus - distPenalty)));
}

export function rollStealthCheck(
  state: OstrzeGameState,
  data: OriginGameData,
  rng: SeededRng,
  enemyDistance: number
): StealthCheckResult {
  const evadeChancePct = computeStealthEvadeChance(state, data, enemyDistance);
  const roll = rng.int(1, 100);
  return {
    evadeChancePct,
    roll,
    detected: roll > evadeChancePct
  };
}
