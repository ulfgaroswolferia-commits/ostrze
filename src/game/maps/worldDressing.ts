import {
  IsometricWorldMap,
  PointLightSource,
  PropKind,
  WorldPropEntity
} from '@ulf/core/worldMap';
import { ActorEntity } from '@ulf/rpg/gameLoop';

export interface PropBlueprint {
  id: string;
  name: string;
  kind: PropKind;
  variant?: number;
  x: number;
  y: number;
  sizeX?: number;
  sizeY?: number;
  heightZ?: number;
  blocksMovement?: boolean;
  blocksSight?: boolean;
  interactive?: boolean;
  isOpen?: boolean;
  linkedLightId?: string;
}

export interface PerimeterDressingOptions {
  seed: number;
  spawnX: number;
  spawnY: number;
  actors: ReadonlyArray<ActorEntity>;
  reservedPoints?: ReadonlyArray<{ x: number; y: number; radius?: number }>;
  bespokeProps?: ReadonlyArray<PropBlueprint>;
  bespokeLights?: ReadonlyArray<PointLightSource>;
  /** Sides that should form an impassable rocky cliff escarpment ('N' | 'S' | 'E' | 'W') */
  cliffSides?: ReadonlyArray<'N' | 'S' | 'E' | 'W'>;
  /** Sides that should form a dense multi-layered forest backdrop ('N' | 'S' | 'E' | 'W') */
  forestSides?: ReadonlyArray<'N' | 'S' | 'E' | 'W'>;
  /** Depth in tiles of perimeter forest/cliff belt (default 3) */
  beltDepth?: number;
  /** Whether to use dead/twisted trees in the forest belt */
  deadForest?: boolean;
  /** Ruined stone walls & pillars scattered in the perimeter belt */
  ruinsScatter?: boolean;
}

function hash2D(x: number, y: number, seed: number): number {
  let h =
    Math.imul((x | 0) + 374761393, 668265263) ^
    Math.imul((y | 0) + 1274126177, 2246822519) ^
    Math.imul((seed | 0) + 1013904223, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hashInt(x: number, y: number, seed: number, mod: number): number {
  return Math.floor(hash2D(x, y, seed) * mod) % mod;
}

/**
 * Safely enriches a 2.5D map with bespoke architectural/training/camp landmarks
 * and a dense perimeter of forests and rocky cliffs while guaranteeing zero overlap
 * with story props, spawn point, NPCs, or walkable approach corridors.
 */
export function applyWorldDressing(
  map: IsometricWorldMap,
  opts: PerimeterDressingOptions
): void {
  const { width, height, tiles } = map;
  const occupied = Array.from({ length: height }, () => new Uint8Array(width));
  const haloReserved = Array.from({ length: height }, () => new Uint8Array(width));

  const markOccupied = (x: number, y: number, sx: number, sy: number, halo = 0): void => {
    for (let dy = 0; dy < sy; dy++) {
      for (let dx = 0; dx < sx; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
          occupied[ty][tx] = 1;
          haloReserved[ty][tx] = 1;
        }
      }
    }
    if (halo > 0) {
      for (let dy = -halo; dy < sy + halo; dy++) {
        for (let dx = -halo; dx < sx + halo; dx++) {
          const tx = x + dx;
          const ty = y + dy;
          if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
            haloReserved[ty][tx] = 1;
          }
        }
      }
    }
  };

  // 1. Reserve existing story props (with 1-tile halo around interactive props so they stay reachable)
  for (const p of map.props) {
    markOccupied(p.x, p.y, p.sizeX, p.sizeY, p.interactive ? 1 : 0);
  }

  // 2. Reserve spawn point + 1-tile halo
  markOccupied(opts.spawnX, opts.spawnY, 1, 1, 1);

  // 3. Reserve all actors + 1-tile halo
  for (const a of opts.actors) {
    markOccupied(a.tileX, a.tileY, 1, 1, 1);
  }

  // 4. Reserve any explicit coordinates (e.g. conditional NPCs or quest corridors)
  if (opts.reservedPoints) {
    for (const pt of opts.reservedPoints) {
      markOccupied(pt.x, pt.y, 1, 1, pt.radius ?? 1);
    }
  }

  const canPlace = (x: number, y: number, sx: number, sy: number, respectHalo = true): boolean => {
    for (let dy = 0; dy < sy; dy++) {
      for (let dx = 0; dx < sx; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || tx >= width || ty < 0 || ty >= height) return false;
        if (occupied[ty][tx]) return false;
        if (respectHalo && haloReserved[ty][tx]) return false;
        if (tiles[ty][tx].terrain === 'abyss_water') return false;
      }
    }
    return true;
  };

  // 5. Place bespoke architectural / training / camp props
  if (opts.bespokeProps) {
    for (const bp of opts.bespokeProps) {
      const sx = bp.sizeX ?? 1;
      const sy = bp.sizeY ?? 1;
      if (!canPlace(bp.x, bp.y, sx, sy, true)) continue;
      const prop: WorldPropEntity = {
        id: bp.id,
        name: bp.name,
        kind: bp.kind,
        variant: bp.variant ?? hashInt(bp.x, bp.y, opts.seed + 13, 16),
        x: bp.x,
        y: bp.y,
        z: tiles[bp.y][bp.x].z,
        sizeX: sx,
        sizeY: sy,
        heightZ: bp.heightZ ?? 1,
        blocksMovement: bp.blocksMovement ?? true,
        blocksSight: bp.blocksSight ?? false,
        interactive: bp.interactive ?? false,
        isOpen: bp.isOpen,
        linkedLightId: bp.linkedLightId
      };
      map.props.push(prop);
      markOccupied(bp.x, bp.y, sx, sy, 0);
    }
  }

  if (opts.bespokeLights) {
    for (const light of opts.bespokeLights) {
      if (!map.lights.some((l) => l.id === light.id)) {
        map.lights.push(light);
      }
    }
  }

  // 6. Populate perimeter cliff walls & forest backdrop
  const depth = opts.beltDepth ?? 3;
  const cliffSides = new Set(opts.cliffSides ?? []);
  const forestSides = new Set(opts.forestSides ?? []);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!canPlace(x, y, 1, 1, true)) continue;
      const cell = tiles[y][x];
      // Never block dirt roads or cobble plazas with random perimeter trees/rocks
      if (
        cell.terrain === 'dirt_path' ||
        cell.terrain === 'mossy_cobble' ||
        cell.terrain === 'abyss_water'
      ) {
        continue;
      }

      const inN = y < depth;
      const inS = y >= height - depth;
      const inW = x < depth;
      const inE = x >= width - depth;
      if (!inN && !inS && !inW && !inE) continue;

      const isCliffZone =
        (inN && cliffSides.has('N')) ||
        (inS && cliffSides.has('S')) ||
        (inW && cliffSides.has('W')) ||
        (inE && cliffSides.has('E'));

      const isForestZone =
        (inN && forestSides.has('N')) ||
        (inS && forestSides.has('S')) ||
        (inW && forestSides.has('W')) ||
        (inE && forestSides.has('E'));

      const roll = hash2D(x, y, opts.seed + 71);

      if (isCliffZone) {
        // Dense rocky cliff wall blocking passage and sight
        const isOuterEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
        if (isOuterEdge || roll < 0.62) {
          map.props.push({
            id: `bg_cliff_${x}_${y}`,
            name: 'Skalna Skarpa',
            kind: 'rock_cliff',
            variant: hashInt(x, y, opts.seed + 101, 8),
            x,
            y,
            z: cell.z,
            sizeX: 1,
            sizeY: 1,
            heightZ: 2,
            blocksMovement: true,
            blocksSight: true,
            interactive: false
          });
          markOccupied(x, y, 1, 1, 0);
        } else if (roll < 0.78) {
          map.props.push({
            id: `bg_cliff_bush_${x}_${y}`,
            name: 'Górskie Zarośla',
            kind: opts.deadForest ? 'dead_tree' : 'berry_bush',
            variant: hashInt(x, y, opts.seed + 107, 16),
            x,
            y,
            z: cell.z,
            sizeX: 1,
            sizeY: 1,
            heightZ: opts.deadForest ? 2 : 1,
            blocksMovement: opts.deadForest ?? false,
            blocksSight: opts.deadForest ?? false,
            interactive: false
          });
          markOccupied(x, y, 1, 1, 0);
        }
        continue;
      }

      if (isForestZone) {
        const isOuterEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
        if (isOuterEdge || roll < 0.54) {
          const treeKind: PropKind = opts.deadForest
            ? roll < 0.38
              ? 'dead_tree'
              : 'pine_tree'
            : roll < 0.28
              ? 'ancient_oak'
              : 'pine_tree';
          map.props.push({
            id: `bg_tree_${x}_${y}`,
            name:
              treeKind === 'ancient_oak'
                ? 'Stary Dąb Puszczy'
                : treeKind === 'dead_tree'
                  ? 'Uschnięte Drzewo'
                  : 'Sosna Pogórza',
            kind: treeKind,
            variant: hashInt(x, y, opts.seed + 211, 19),
            x,
            y,
            z: cell.z,
            sizeX: 1,
            sizeY: 1,
            heightZ: 3,
            blocksMovement: true,
            blocksSight: true,
            interactive: false
          });
          markOccupied(x, y, 1, 1, 0);
        } else if (roll < 0.70) {
          const isForageable = hashInt(x, y, opts.seed + 227, 3) === 0;
          map.props.push({
            id: `bg_bush_${x}_${y}`,
            name: isForageable ? 'Krzak Leśnych Jagód (Zbierz)' : 'Leśne Poszycie',
            kind: 'berry_bush',
            variant: hashInt(x, y, opts.seed + 223, 16),
            x,
            y,
            z: cell.z,
            sizeX: 1,
            sizeY: 1,
            heightZ: 1,
            blocksMovement: false,
            blocksSight: false,
            interactive: isForageable
          });
          markOccupied(x, y, 1, 1, 0);
        } else if (roll < 0.79) {
          const isStump = hashInt(x, y, opts.seed + 229, 3) === 0;
          const isForageable = !isStump && hashInt(x, y, opts.seed + 239, 3) === 0;
          map.props.push({
            id: `bg_flora_${x}_${y}`,
            name: isStump
              ? 'Omszały Pniak'
              : isForageable
                ? 'Kępa Ziół Leczniczych (Zbierz)'
                : 'Kępa Paproci i Ziół',
            kind: isStump ? 'tree_stump' : 'wildflower_patch',
            variant: hashInt(x, y, opts.seed + 233, 40),
            x,
            y,
            z: cell.z,
            sizeX: 1,
            sizeY: 1,
            heightZ: isStump ? 1 : 0,
            blocksMovement: isStump,
            blocksSight: false,
            interactive: isForageable
          });
          markOccupied(x, y, 1, 1, 0);
        } else if (opts.ruinsScatter && roll < 0.86) {
          map.props.push({
            id: `bg_ruin_${x}_${y}`,
            name: 'Zarośnięty Głaz Ruin',
            kind: 'pillar',
            variant: hashInt(x, y, opts.seed + 241, 8),
            x,
            y,
            z: cell.z,
            sizeX: 1,
            sizeY: 1,
            heightZ: 2,
            blocksMovement: true,
            blocksSight: false,
            interactive: false
          });
          markOccupied(x, y, 1, 1, 0);
        }
      }
    }
  }
}
