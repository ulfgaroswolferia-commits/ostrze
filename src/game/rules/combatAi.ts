import type { EnemyDef } from '../data/originTypes';

export type EnemyArchetype = 'melee_cautious' | 'predator' | 'ranged_kiter' | 'boss';
export type EnemyTacticalTier = 'early' | 'mid' | 'boss';

export interface TacticalBudget {
  maxAttacksPerTurn: number;
  allowPowerOrTorso: boolean;
  allowAimedHead: boolean;
  allowStatusEffects: boolean;
  allowBossTelegraph: boolean;
}

export const TACTICAL_BUDGETS: Record<EnemyTacticalTier, TacticalBudget> = {
  early: {
    maxAttacksPerTurn: 1,
    allowPowerOrTorso: false,
    allowAimedHead: false,
    allowStatusEffects: false,
    allowBossTelegraph: false
  },
  mid: {
    maxAttacksPerTurn: 2,
    allowPowerOrTorso: true,
    allowAimedHead: false,
    allowStatusEffects: true,
    allowBossTelegraph: false
  },
  boss: {
    maxAttacksPerTurn: 2,
    allowPowerOrTorso: true,
    allowAimedHead: false,
    allowStatusEffects: true,
    allowBossTelegraph: true
  }
};

export type BossTelegraphKind = 'heavy_cleave' | 'terror_howl';

export interface CombatAiSessionState {
  telegraphedIntentByEnemy: Record<string, BossTelegraphKind | undefined>;
  telegraphCooldownUntilRound: Record<string, number>;
}

export function createCombatAiSessionState(): CombatAiSessionState {
  return {
    telegraphedIntentByEnemy: {},
    telegraphCooldownUntilRound: {}
  };
}

export function resolveEnemyArchetype(
  originId: string | null,
  enemyDef: EnemyDef | undefined,
  difficulty?: 'easy' | 'normal' | 'very_hard'
): EnemyArchetype {
  if (
    originId === 'herszt_zbojcow' ||
    originId === 'upior_nocy' ||
    difficulty === 'very_hard'
  ) {
    return 'boss';
  }
  if (
    originId === 'rabus_lucznik' ||
    originId === 'klusownik' ||
    enemyDef?.ai === 'ranged'
  ) {
    return 'ranged_kiter';
  }
  if (
    originId === 'wilk' ||
    originId === 'dzik' ||
    originId === 'zmija_lesna' ||
    originId === 'upior_zwiadowca'
  ) {
    return 'predator';
  }
  return 'melee_cautious';
}

const EARLY_GUARDRAIL_SCENES = new Set(['brzezina_dziedziniec', 'brzezina_yard', 'trakt_zasadzka']);

export function resolveEnemyTacticalTier(
  sceneId: string | null,
  originId: string | null,
  difficulty?: 'easy' | 'normal' | 'very_hard'
): EnemyTacticalTier {
  if (
    originId === 'instruktor' ||
    (sceneId !== null && EARLY_GUARDRAIL_SCENES.has(sceneId))
  ) {
    return 'early';
  }
  if (
    originId === 'herszt_zbojcow' ||
    originId === 'upior_nocy' ||
    difficulty === 'very_hard'
  ) {
    return 'boss';
  }
  return 'mid';
}

export interface GridPoint {
  x: number;
  y: number;
}

/**
 * Finds the best walkable tile for a ranged kiter to retreat to (distance 2..5 from player,
 * within `maxSteps` Manhattan/Chebyshev budget, preferring distance 3..4.5).
 */
export function findBestKiteTile(params: {
  enemyPos: GridPoint;
  playerPos: GridPoint;
  mapWidth: number;
  mapHeight: number;
  maxSteps: number;
  isWalkable: (x: number, y: number) => boolean;
}): GridPoint | null {
  const { enemyPos, playerPos, mapWidth, mapHeight, maxSteps, isWalkable } = params;
  if (maxSteps <= 0) return null;

  const currentDist = Math.hypot(playerPos.x - enemyPos.x, playerPos.y - enemyPos.y);
  let best: { x: number; y: number; score: number } | null = null;

  const minX = Math.max(0, enemyPos.x - maxSteps);
  const maxX = Math.min(mapWidth - 1, enemyPos.x + maxSteps);
  const minY = Math.max(0, enemyPos.y - maxSteps);
  const maxY = Math.min(mapHeight - 1, enemyPos.y + maxSteps);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x === enemyPos.x && y === enemyPos.y) continue;
      const stepDist = Math.abs(x - enemyPos.x) + Math.abs(y - enemyPos.y);
      if (stepDist > maxSteps) continue;
      if (!isWalkable(x, y)) continue;

      const distToPlayer = Math.hypot(playerPos.x - x, playerPos.y - y);
      if (distToPlayer <= currentDist + 0.5 || distToPlayer > 5.2) continue;

      // Ideal range is ~3.5 tiles: safely out of melee, comfortably within bow range
      const idealPenalty = Math.abs(distToPlayer - 3.6);
      const score = distToPlayer * 2.0 - idealPenalty * 1.5 - stepDist * 0.25;
      if (!best || score > best.score) {
        best = { x, y, score };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}

/**
 * Finds the best walkable tile at range 3..5 when a ranged kiter is too far (>5.45) to shoot.
 */
export function findBestRangedApproachTile(params: {
  enemyPos: GridPoint;
  playerPos: GridPoint;
  mapWidth: number;
  mapHeight: number;
  isWalkable: (x: number, y: number) => boolean;
}): GridPoint | null {
  const { enemyPos, playerPos, mapWidth, mapHeight, isWalkable } = params;
  let best: { x: number; y: number; score: number } | null = null;

  const minX = Math.max(0, playerPos.x - 5);
  const maxX = Math.min(mapWidth - 1, playerPos.x + 5);
  const minY = Math.max(0, playerPos.y - 5);
  const maxY = Math.min(mapHeight - 1, playerPos.y + 5);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!isWalkable(x, y)) continue;
      const distToPlayer = Math.hypot(playerPos.x - x, playerPos.y - y);
      if (distToPlayer < 2.5 || distToPlayer > 4.8) continue;
      const distFromEnemy = Math.hypot(enemyPos.x - x, enemyPos.y - y);
      const score = -distFromEnemy - Math.abs(distToPlayer - 4.0) * 0.6;
      if (!best || score > best.score) {
        best = { x, y, score };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}

/**
 * Finds an adjacent walkable tile around the player that maximizes flanking separation
 * from other living allied enemies.
 */
export function findBestFlankAdjacentTile(params: {
  enemyPos: GridPoint;
  playerPos: GridPoint;
  allyPositions: GridPoint[];
  mapWidth: number;
  mapHeight: number;
  isWalkable: (x: number, y: number) => boolean;
}): GridPoint | null {
  const { enemyPos, playerPos, allyPositions, mapWidth, mapHeight, isWalkable } = params;
  let best: { x: number; y: number; score: number } | null = null;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const tx = playerPos.x + dx;
      const ty = playerPos.y + dy;
      if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= mapHeight) continue;
      if (!isWalkable(tx, ty)) continue;

      const distFromEnemy = Math.hypot(enemyPos.x - tx, enemyPos.y - ty);
      let minAllySep = 3.0;
      if (allyPositions.length > 0) {
        minAllySep = Math.min(
          ...allyPositions.map((a) => Math.hypot(a.x - tx, a.y - ty))
        );
      }
      // Prefer spreading around the player while avoiding huge detours
      const score = minAllySep * 1.4 - distFromEnemy * 0.85;
      if (!best || score > best.score) {
        best = { x: tx, y: ty, score };
      }
    }
  }

  return best ? { x: best.x, y: best.y } : null;
}

export function shouldCautiousEnemyHoldForGuard(params: {
  archetype: EnemyArchetype;
  hp: number;
  maxHp: number;
  ap: number;
  attacksThisTurn: number;
}): boolean {
  const { archetype, hp, maxHp, ap, attacksThisTurn } = params;
  if (archetype !== 'melee_cautious') return false;
  if (attacksThisTurn < 1) return false;
  const hpRatio = maxHp > 0 ? hp / maxHp : 1;
  return hpRatio < 0.4 && ap >= 2;
}

export function pickBossTelegraphIntent(params: {
  enemyId: string;
  originId: string | null;
  archetype: EnemyArchetype;
  tier: EnemyTacticalTier;
  dazedHeadTurns: number;
  currentRound: number;
  session: CombatAiSessionState;
}): { kind: BossTelegraphKind; logMessage: string; floatingText: string } | null {
  const { enemyId, originId, archetype, tier, dazedHeadTurns, currentRound, session } = params;
  const budget = TACTICAL_BUDGETS[tier];
  if (archetype !== 'boss' || !budget.allowBossTelegraph) return null;
  if (dazedHeadTurns > 0) return null;
  if (session.telegraphedIntentByEnemy[enemyId]) return null;

  const cooldownUntil = session.telegraphCooldownUntilRound[enemyId] ?? 0;
  if (currentRound < cooldownUntil) return null;

  if (originId === 'upior_nocy') {
    session.telegraphedIntentByEnemy[enemyId] = 'terror_howl';
    session.telegraphCooldownUntilRound[enemyId] = currentRound + 3;
    return {
      kind: 'terror_howl',
      floatingText: '⚠️ ZBIERA SIŁY DO WYCIA!',
      logMessage: '⚠️ Upiór nocy zbiera mroczną energię do Wycia — ogłusz go (Garnek Huku), aby przerwać!'
    };
  }

  session.telegraphedIntentByEnemy[enemyId] = 'heavy_cleave';
  session.telegraphCooldownUntilRound[enemyId] = currentRound + 3;
  return {
    kind: 'heavy_cleave',
    floatingText: '⚠️ BIERZE ZAMACH!',
    logMessage: '⚠️ Boss bierze potężny zamach — użyj Gardy lub ogłusz go w swojej turze!'
  };
}
