/**
 * Combat Feel & Momentum Rules for Ostrze 2.5D:
 * - Impet Walki (Momentum 0..5, 3 tiers) rewarding aggressive & tactical play
 * - Dobicie / Egzekucja (<= 30% enemy HP) + Krwawy Pęd (+2 AP refund on kill)
 * - Aktywny Cios (Timed Strike) grading for Silny cios [2] and Manewr [R]
 * - Short Slavic dark-fantasy combat barks
 */

export const MAX_COMBAT_MOMENTUM = 5;
export const EXECUTION_HP_THRESHOLD = 0.3;
export const EXECUTION_DAMAGE_MULT = 1.2;
export const EXECUTION_CRIT_BONUS_PCT = 12;
export const KILL_RUSH_AP_REFUND = 2;

export type MomentumTier = 0 | 1 | 2;

export interface MomentumBonus {
  momentum: number;
  tier: MomentumTier;
  label: string;
  shortLabel: string;
  damageMultiplier: number;
  critBonusPct: number;
  hitBonusPct: number;
}

export function clampMomentum(value: number): number {
  return Math.max(0, Math.min(MAX_COMBAT_MOMENTUM, Math.round(value)));
}

export function evaluateMomentumBonus(momentumRaw: number): MomentumBonus {
  const momentum = clampMomentum(momentumRaw);
  if (momentum >= 4) {
    return {
      momentum,
      tier: 2,
      label: '⚡ SZAŁ OSTRZA',
      shortLabel: 'Szał Ostrza',
      damageMultiplier: 1.2,
      critBonusPct: 15,
      hitBonusPct: 5
    };
  }
  if (momentum >= 2) {
    return {
      momentum,
      tier: 1,
      label: '🔥 PĘD WALKI',
      shortLabel: 'Pęd Walki',
      damageMultiplier: 1.1,
      critBonusPct: 8,
      hitBonusPct: 0
    };
  }
  return {
    momentum,
    tier: 0,
    label: 'Skupienie',
    shortLabel: 'Skupienie',
    damageMultiplier: 1.0,
    critBonusPct: 0,
    hitBonusPct: 0
  };
}

export interface ExecutionCheckResult {
  isExecutable: boolean;
  damageMultiplier: number;
  critBonusPct: number;
  tag: string | null;
}

export function evaluateExecutionBonus(hp: number, maxHp: number): ExecutionCheckResult {
  if (hp <= 0 || maxHp <= 0) {
    return { isExecutable: false, damageMultiplier: 1, critBonusPct: 0, tag: null };
  }
  const ratio = hp / maxHp;
  if (ratio <= EXECUTION_HP_THRESHOLD) {
    return {
      isExecutable: true,
      damageMultiplier: EXECUTION_DAMAGE_MULT,
      critBonusPct: EXECUTION_CRIT_BONUS_PCT,
      tag: '💀 DOBICIE (+20%)'
    };
  }
  return { isExecutable: false, damageMultiplier: 1, critBonusPct: 0, tag: null };
}

export type TimedStrikeGrade = 'none' | 'miss' | 'good' | 'perfect';

export interface TimedStrikeEvaluation {
  grade: TimedStrikeGrade;
  damageMultiplier: number;
  critBonusPct: number;
  hitBonusPct: number;
  momentumBonus: number;
  label: string | null;
}

export const TIMED_STRIKE_DURATION_MS = 1050;
export const TIMED_STRIKE_SWEET_CENTER = 0.68;
export const TIMED_STRIKE_PERFECT_HALF_WIDTH = 0.08;
export const TIMED_STRIKE_GOOD_HALF_WIDTH = 0.175;

/**
 * Evaluates a normalized cursor position (0..1) on the Timed Strike bar.
 * Missing the sweet spot carries zero penalty (normal attack), so it is pure upside & fun.
 */
export function evaluateTimedStrikePosition(
  position01: number,
  center = TIMED_STRIKE_SWEET_CENTER
): TimedStrikeEvaluation {
  const dist = Math.abs(position01 - center);
  if (dist <= TIMED_STRIKE_PERFECT_HALF_WIDTH) {
    return getTimedStrikeModifiers('perfect');
  }
  if (dist <= TIMED_STRIKE_GOOD_HALF_WIDTH) {
    return getTimedStrikeModifiers('good');
  }
  return getTimedStrikeModifiers('miss');
}

export function getTimedStrikeModifiers(grade: TimedStrikeGrade): TimedStrikeEvaluation {
  if (grade === 'perfect') {
    return {
      grade: 'perfect',
      damageMultiplier: 1.3,
      critBonusPct: 35,
      hitBonusPct: 12,
      momentumBonus: 1,
      label: '⚡ IDEALNY CIOS!'
    };
  }
  if (grade === 'good') {
    return {
      grade: 'good',
      damageMultiplier: 1.12,
      critBonusPct: 10,
      hitBonusPct: 5,
      momentumBonus: 0,
      label: '✨ DOBRY RYTM!'
    };
  }
  return {
    grade,
    damageMultiplier: 1,
    critBonusPct: 0,
    hitBonusPct: 0,
    momentumBonus: 0,
    label: null
  };
}

export type CombatBarkTrigger =
  | 'crit'
  | 'execution_kill'
  | 'guard_break'
  | 'riposte'
  | 'perfect_strike'
  | 'momentum_peak';

const COMBAT_BARKS: Readonly<Record<CombatBarkTrigger, readonly string[]>> = {
  crit: ['Prosto w lukę!', 'Poczuj stal!', 'Trafiony czysto!'],
  execution_kill: ['Po tobie!', 'Koniec pieśni!', 'Padnij, bestio!'],
  guard_break: ['Tarcza pęka!', 'Otwarty!', 'Łamię gardę!'],
  riposte: ['Za wolno!', 'Mój cios!', 'Odbite!'],
  perfect_strike: ['Czyste cięcie!', 'W punkt!', 'Idealnie!'],
  momentum_peak: ['Szał ostrza!', 'Nie zatrzymasz mnie!', 'Krew wre!']
};

export function pickCombatBark(trigger: CombatBarkTrigger, rng: () => number = Math.random): string {
  const pool = COMBAT_BARKS[trigger];
  const idx = Math.floor(rng() * pool.length) % pool.length;
  return pool[idx] ?? pool[0];
}
