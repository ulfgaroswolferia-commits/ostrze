import type { CombatAttackMode, CombatAttackOutcome } from '@ulf/rpg/combatSystem';

export interface GuardRiposteInput {
  playerDefending: boolean;
  playerAlive: boolean;
  playerWeaponIsMelee: boolean;
  attackerAlive: boolean;
  distanceTiles: number;
  currentRound: number;
  riposteUsedRound: number;
  playerBaseAvgDamage: number;
  outcome: Pick<CombatAttackOutcome, 'hit' | 'rawDamage' | 'mitigatedByArmor' | 'damageDealt'>;
}

export interface GuardRiposteResult {
  triggered: boolean;
  reason?: 'miss' | 'blocked';
  damage: number;
}

export const RIPOSTE_DAMAGE_MULTIPLIER = 0.65;
export const GUARD_BREAK_DAMAGE_MULTIPLIER = 1.25;
export const GUARD_BREAK_AP_PENALTY = 1;
export const BLEED_SYNERGY_DAMAGE_MULT = 1.2;
export const BLEED_SYNERGY_CRIT_BONUS_PCT = 10;
export const BURN_FLARE_BONUS_DAMAGE = 5;
export const BURN_FLARE_EXTRA_TURNS = 1;
export const EXPOSED_SYNERGY_HIT_BONUS_PCT = 15;
export const EXPOSED_SYNERGY_DAMAGE_MULT = 1.15;

/**
 * Evaluates whether a defending player triggers a 1x-per-round melee Guard Riposte
 * after dodging or strongly blocking an enemy's melee attack (0 AP cost).
 */
export function evaluateGuardRiposte(input: GuardRiposteInput): GuardRiposteResult {
  if (
    !input.playerDefending ||
    !input.playerAlive ||
    !input.playerWeaponIsMelee ||
    !input.attackerAlive ||
    input.distanceTiles > 1.9 ||
    input.riposteUsedRound === input.currentRound
  ) {
    return { triggered: false, damage: 0 };
  }

  const wasMissed = !input.outcome.hit;
  const wasStronglyBlocked =
    input.outcome.hit &&
    (input.outcome.damageDealt <= 0 ||
      (input.outcome.rawDamage > 0 &&
        input.outcome.mitigatedByArmor >= input.outcome.rawDamage * 0.45));

  if (!wasMissed && !wasStronglyBlocked) {
    return { triggered: false, damage: 0 };
  }

  const damage = Math.max(2, Math.round(Math.max(2, input.playerBaseAvgDamage) * RIPOSTE_DAMAGE_MULTIPLIER));
  return {
    triggered: true,
    reason: wasMissed ? 'miss' : 'blocked',
    damage
  };
}

export interface GuardBreakInput {
  targetDefending: boolean;
  attackMode?: CombatAttackMode;
  isWeaponManeuver?: boolean;
  isFeint?: boolean;
}

export interface GuardBreakResult {
  triggered: boolean;
  damageMultiplier: number;
  apPenalty: number;
}

/**
 * Asymmetric Guard Break (player vs defending enemy only):
 * Heavy/power attacks, weapon maneuvers, or Feint strip enemy Guard,
 * grant +25% damage, and sap 1 AP from the staggered defender.
 */
export function evaluateGuardBreak(input: GuardBreakInput): GuardBreakResult {
  if (!input.targetDefending) {
    return { triggered: false, damageMultiplier: 1, apPenalty: 0 };
  }
  const canBreak =
    input.attackMode === 'power' || Boolean(input.isWeaponManeuver) || Boolean(input.isFeint);
  if (!canBreak) {
    return { triggered: false, damageMultiplier: 1, apPenalty: 0 };
  }
  return {
    triggered: true,
    damageMultiplier: GUARD_BREAK_DAMAGE_MULTIPLIER,
    apPenalty: GUARD_BREAK_AP_PENALTY
  };
}

export interface StatusSynergyInput {
  targetBleeding: boolean;
  targetBurning: boolean;
  targetDazedOrCrippled: boolean;
  isMeleeAttack: boolean;
  isHeavyOrManeuver: boolean;
}

export interface StatusSynergyResult {
  damageMultiplier: number;
  hitBonusPct: number;
  critBonusPct: number;
  bonusFireDamage: number;
  extraBurnTurns: number;
  tags: string[];
}

/**
 * Evaluates the 3 "Setup -> Payoff" status combos against an enemy:
 * 1. Krwawa Rzeź (Bleeding + melee) -> +20% dmg, +10% crit
 * 2. Wybuch Żaru (Burning + heavy/maneuver) -> +5 fire dmg, +1 burn turn
 * 3. Wykorzystanie Luki (Dazed/Crippled + any attack) -> +15% hit, +15% dmg
 */
export function evaluateStatusSynergies(input: StatusSynergyInput): StatusSynergyResult {
  let damageMultiplier = 1;
  let hitBonusPct = 0;
  let critBonusPct = 0;
  let bonusFireDamage = 0;
  let extraBurnTurns = 0;
  const tags: string[] = [];

  if (input.targetBleeding && input.isMeleeAttack) {
    damageMultiplier *= BLEED_SYNERGY_DAMAGE_MULT;
    critBonusPct += BLEED_SYNERGY_CRIT_BONUS_PCT;
    tags.push('🩸 KRWAWA RZEŹ');
  }

  if (input.targetBurning && input.isHeavyOrManeuver) {
    bonusFireDamage += BURN_FLARE_BONUS_DAMAGE;
    extraBurnTurns += BURN_FLARE_EXTRA_TURNS;
    tags.push('🔥 WYBUCH ŻARU (+5)');
  }

  if (input.targetDazedOrCrippled) {
    hitBonusPct += EXPOSED_SYNERGY_HIT_BONUS_PCT;
    damageMultiplier *= EXPOSED_SYNERGY_DAMAGE_MULT;
    tags.push('⚡ LUKA W OBRONIE');
  }

  return {
    damageMultiplier,
    hitBonusPct,
    critBonusPct,
    bonusFireDamage,
    extraBurnTurns,
    tags
  };
}
