import type { WorldPropEntity } from '@ulf/core/worldMap';

export const TACTICAL_COVER_RANGED_PENALTY_PCT = 20;
export const OIL_BARREL_AP_COST = 3;
export const OIL_BARREL_BLAST_RADIUS = 2.6;

const COVER_PROP_KINDS = new Set([
  'dungeon_crate',
  'rock_cliff',
  'pillar',
  'wall_block',
  'market_stall',
  'dungeon_barrel',
  'wattle_fence',
  'sarcophagus',
  'runic_altar'
]);

export interface TacticalCoverInfo {
  hasCover: boolean;
  coverPropName: string | null;
  rangedHitPenaltyPct: number;
}

export function isOilBarrelProp(prop: Pick<WorldPropEntity, 'id' | 'kind' | 'name'>): boolean {
  if (prop.kind !== 'dungeon_barrel') return false;
  const idLow = prop.id.toLowerCase();
  const nameLow = (prop.name ?? '').toLowerCase();
  return idLow.startsWith('oil_barrel') || nameLow.includes('smoł') || nameLow.includes('olej');
}

export function computeActorTacticalCover(
  tileX: number,
  tileY: number,
  props: readonly WorldPropEntity[],
  detonatedBarrelIds: ReadonlySet<string>
): TacticalCoverInfo {
  for (const prop of props) {
    if (!prop.blocksMovement) continue;
    if (detonatedBarrelIds.has(prop.id)) continue;
    if (!COVER_PROP_KINDS.has(prop.kind)) continue;

    const minX = prop.x - 1;
    const maxX = prop.x + Math.max(1, prop.sizeX);
    const minY = prop.y - 1;
    const maxY = prop.y + Math.max(1, prop.sizeY);
    if (tileX >= minX && tileX <= maxX && tileY >= minY && tileY <= maxY) {
      return {
        hasCover: true,
        coverPropName: prop.name || 'Osłona',
        rangedHitPenaltyPct: TACTICAL_COVER_RANGED_PENALTY_PCT
      };
    }
  }
  return {
    hasCover: false,
    coverPropName: null,
    rangedHitPenaltyPct: 0
  };
}

export function findDetonatableOilBarrel(
  playerX: number,
  playerY: number,
  props: readonly WorldPropEntity[],
  detonatedBarrelIds: ReadonlySet<string>,
  maxRange: number
): WorldPropEntity | null {
  let best: WorldPropEntity | null = null;
  let bestDist = Infinity;
  for (const prop of props) {
    if (detonatedBarrelIds.has(prop.id)) continue;
    if (!isOilBarrelProp(prop)) continue;
    const dist = Math.hypot(prop.x - playerX, prop.y - playerY);
    if (dist <= maxRange && dist < bestDist) {
      best = prop;
      bestDist = dist;
    }
  }
  return best;
}
