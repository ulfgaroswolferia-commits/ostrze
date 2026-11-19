import {
  computeReachableTilesBfs,
  computeTileTransitions
} from '@ulf/assets/terrainBlending';
import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import {
  createKamiennaPrzeleczScene,
  createLesniczowkaScene,
  createRuinyStraznicyScene,
  createStaryMlynScene,
  createTraktKupieckiScene,
  createWilczaNoraScene,
  createWilczyBrodScene,
  createWilczyLasScene
} from '../src/game/maps/chapter1Maps';
import {
  createBrzezinaYardScene,
  createPobojowiskoSwitScene,
  createTraktZasadzkaScene,
  createUroczyskoNocScene
} from '../src/game/maps/prologueMaps';
import { createTestBrzezinaYardScene } from '../src/game/maps/testYardMap';

describe('OstrzeEngineState bridge', () => {
  it('registers and loads a custom 2.5D Ostrze scene without mutating ulfRPG', () => {
    const game = new OstrzeEngineState();
    const { scene, dialogues } = createTestBrzezinaYardScene();

    game.registerDialogues(dialogues);
    game.registerCustomScene(scene);

    const revBefore = game.mapRevision;
    const loaded = game.loadCustomScene('brzezina_test_yard');
    expect(loaded).toBe(true);
    expect(game.mapRevision).toBeGreaterThan(revBefore);
    expect(game.activeCustomSceneId).toBe('brzezina_test_yard');
    expect(game.map.name).toContain('Brzezina');
    expect(game.player.tileX).toBe(9);
    expect(game.player.tileY).toBe(11);
    expect(game.npcs.some((npc) => npc.id === 'npc_gnieworad')).toBe(true);
  });

  it('returns false for unknown custom scene IDs', () => {
    const game = new OstrzeEngineState();
    expect(game.loadCustomScene('non_existent_scene')).toBe(false);
  });

  it('clones scene actors on load so runtime mutations do not leak across reloads', () => {
    const game = new OstrzeEngineState();
    const { scene } = createTestBrzezinaYardScene();
    game.registerCustomScene(scene);

    game.loadCustomScene('brzezina_test_yard');
    const npcFirst = game.npcs.find((n) => n.id === 'npc_gnieworad')!;
    npcFirst.tileX = 1;
    npcFirst.recipe.equipment.mainHand = null;

    game.loadCustomScene('brzezina_test_yard');
    const npcSecond = game.npcs.find((n) => n.id === 'npc_gnieworad')!;
    expect(npcSecond.tileX).toBe(9);
    expect(npcSecond.recipe.equipment.mainHand).toBe('weapon_sunblade_longsword');
  });

  it('validates all Prologue & Chapter 1 maps for organic terrain blending, walkability, and combat BFS', () => {
    const scenes = [
      createTestBrzezinaYardScene().scene,
      createBrzezinaYardScene({ withCourier: true }),
      createTraktZasadzkaScene(),
      createUroczyskoNocScene(),
      createPobojowiskoSwitScene(),
      createWilczyBrodScene(),
      createWilczaNoraScene(),
      createKamiennaPrzeleczScene(),
      createWilczyLasScene({ withHunt: true }),
      createStaryMlynScene({ isNight: true }),
      createTraktKupieckiScene({ withHunt: true }),
      createLesniczowkaScene({ withHunt: true }),
      createRuinyStraznicyScene({ withHunt: true })
    ];

    for (const scene of scenes) {
      const { map, spawnX, spawnY, actors } = scene;
      const blockedPropTiles = new Set<number>();
      for (const prop of map.props) {
        expect(prop.x, `${scene.id} prop ${prop.id} x in bounds`).toBeGreaterThanOrEqual(0);
        expect(prop.y, `${scene.id} prop ${prop.id} y in bounds`).toBeGreaterThanOrEqual(0);
        expect(prop.x + prop.sizeX, `${scene.id} prop ${prop.id} maxX in bounds`).toBeLessThanOrEqual(map.width);
        expect(prop.y + prop.sizeY, `${scene.id} prop ${prop.id} maxY in bounds`).toBeLessThanOrEqual(map.height);
        if (prop.blocksMovement) {
          for (let py = prop.y; py < prop.y + prop.sizeY; py++) {
            for (let px = prop.x; px < prop.x + prop.sizeX; px++) {
              blockedPropTiles.add(py * map.width + px);
            }
          }
        }
      }

      const spawnCell = map.tiles[spawnY]?.[spawnX];
      expect(spawnCell, `${scene.id} spawn tile exists`).toBeDefined();
      expect(spawnCell.walkable, `${scene.id} spawn tile is walkable`).toBe(true);
      expect(blockedPropTiles.has(spawnY * map.width + spawnX), `${scene.id} spawn not blocked by prop`).toBe(false);

      for (const actor of actors ?? []) {
        const cell = map.tiles[actor.tileY]?.[actor.tileX];
        expect(cell, `${scene.id} actor ${actor.id} tile exists`).toBeDefined();
        expect(cell.walkable, `${scene.id} actor ${actor.id} stands on walkable tile`).toBe(true);
        expect(blockedPropTiles.has(actor.tileY * map.width + actor.tileX), `${scene.id} actor ${actor.id} not blocked by prop`).toBe(false);
        expect(actor.z, `${scene.id} actor ${actor.id} elevation matches tile`).toBe(cell.z);
      }

      let transitionCount = 0;
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const cell = map.tiles[y][x];
          const overlays = computeTileTransitions(x, y, cell.terrain, cell.z, (nx, ny) => {
            const n = map.tiles[ny]?.[nx];
            return n ? { terrain: n.terrain, z: n.z } : null;
          });
          transitionCount += overlays.length;
        }
      }
      expect(transitionCount, `${scene.id} generates organic terrain transitions`).toBeGreaterThan(0);

      const reachable = computeReachableTilesBfs(
        map.width,
        map.height,
        spawnX,
        spawnY,
        4,
        (tx, ty) => Boolean(map.tiles[ty]?.[tx]?.walkable) && !blockedPropTiles.has(ty * map.width + tx),
        (tx, ty) => map.tiles[ty]?.[tx]?.z ?? 0,
        1
      );
      expect(reachable.size, `${scene.id} has reachable combat tiles from spawn`).toBeGreaterThan(0);
    }
  });
});
