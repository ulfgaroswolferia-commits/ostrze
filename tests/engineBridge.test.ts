import {
  bakeCharacterBuffers,
  computeCharacterRecipeHash
} from '@ulf/assets/characterBakery';
import {
  computeReachableTilesBfs,
  computeTileTransitions
} from '@ulf/assets/terrainBlending';
import { deltaToDirection8 } from '@ulf/core/pathfinding';
import { resolvePropVisualTransform } from '@ulf/renderer/isoSceneView';
import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { getPropVisualTransform } from '../src/game/assets/buildingScaling';
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
    const loadedSceneIds: string[] = [];
    game.onSceneLoaded = (id) => loadedSceneIds.push(id);
    const loaded = game.loadCustomScene('brzezina_test_yard');
    expect(loaded).toBe(true);
    expect(loadedSceneIds).toEqual(['brzezina_test_yard']);
    expect(game.mapRevision).toBeGreaterThan(revBefore);
    expect(game.activeCustomSceneId).toBe('brzezina_test_yard');
    expect(game.map.name).toContain('Brzezina');
    expect(game.player.tileX).toBe(9);
    expect(game.player.tileY).toBe(11);
    expect(game.npcs.some((npc) => npc.id === 'npc_gnieworad')).toBe(true);
    expect(
      game.chronicleEntries.some((entry) => entry.text.includes('Polanie Wilczego Ognia'))
    ).toBe(false);
    expect(game.logs.some((line) => line.includes('Polanie Wilczego Ognia'))).toBe(false);
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
      expect(map.props.length, `${scene.id} has rich environmental background dressing`).toBeGreaterThanOrEqual(25);
      const blockedPropTiles = new Set<number>();
      const occupiedPropTiles = new Set<number>();
      for (const prop of map.props) {
        expect(prop.x, `${scene.id} prop ${prop.id} x in bounds`).toBeGreaterThanOrEqual(0);
        expect(prop.y, `${scene.id} prop ${prop.id} y in bounds`).toBeGreaterThanOrEqual(0);
        expect(prop.x + prop.sizeX, `${scene.id} prop ${prop.id} maxX in bounds`).toBeLessThanOrEqual(map.width);
        expect(prop.y + prop.sizeY, `${scene.id} prop ${prop.id} maxY in bounds`).toBeLessThanOrEqual(map.height);
        for (let py = prop.y; py < prop.y + prop.sizeY; py++) {
          for (let px = prop.x; px < prop.x + prop.sizeX; px++) {
            const tileIdx = py * map.width + px;
            expect(occupiedPropTiles.has(tileIdx), `${scene.id} prop ${prop.id} does not overlap at (${px},${py})`).toBe(false);
            occupiedPropTiles.add(tileIdx);
            if (prop.blocksMovement) {
              blockedPropTiles.add(tileIdx);
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

    const brzezina = scenes.find((s) => s.id === 'brzezina_dziedziniec')!;
    const brzezinaPropIds = new Set(brzezina.map.props.map((p) => p.id));
    expect(brzezinaPropIds.has('brzezina_dwor_szkoly')).toBe(true);
    expect(brzezinaPropIds.has('brzezina_sztandar_szkoly')).toBe(true);
    expect(brzezinaPropIds.has('brzezina_baszta_szkoly')).toBe(true);
    expect(brzezinaPropIds.has('brzezina_dormitorium_1')).toBe(true);
    expect(brzezinaPropIds.has('brzezina_dormitorium_2')).toBe(true);
    expect(brzezinaPropIds.has('brzezina_kukla_1')).toBe(true);
    expect(brzezinaPropIds.has('brzezina_kukla_2')).toBe(true);
    expect(brzezinaPropIds.has('brzezina_stojak_miecze')).toBe(true);
    expect(brzezinaPropIds.has('brzezina_stojak_wlocznie')).toBe(true);
    expect(brzezina.map.props.some((p) => p.kind === 'rock_cliff' && p.blocksSight)).toBe(true);
    expect(
      brzezina.map.props.some((p) => (p.kind === 'pine_tree' || p.kind === 'ancient_oak') && p.blocksSight)
    ).toBe(true);
  });

  it('scales buildings and assigns architectural variants according to their purpose', () => {
    const brzezina = createBrzezinaYardScene();
    const wilczyBrod = createWilczyBrodScene();
    const staryMlyn = createStaryMlynScene();
    const lesniczowka = createLesniczowkaScene();

    const school = brzezina.map.props.find((p) => p.id === 'brzezina_dwor_szkoly')!;
    const schoolBanner = brzezina.map.props.find((p) => p.id === 'brzezina_sztandar_szkoly')!;
    const trainingDummy = brzezina.map.props.find((p) => p.id === 'brzezina_kukla_1')!;
    const schoolTower = brzezina.map.props.find((p) => p.id === 'brzezina_baszta_szkoly')!;
    const dorm1 = brzezina.map.props.find((p) => p.id === 'brzezina_dormitorium_1')!;
    const inn = wilczyBrod.map.props.find((p) => p.id === 'wb_karczma')!;
    const barracks = wilczyBrod.map.props.find((p) => p.id === 'wb_koszary_straznicy')!;
    const smithy = wilczyBrod.map.props.find((p) => p.id === 'wb_kuznia')!;
    const peasantCottage = wilczyBrod.map.props.find((p) => p.id === 'wb_chata_osadnikow_1')!;
    const watermill = staryMlyn.map.props.find((p) => p.id === 'mlyn_budynek')!;
    const watermillWheel = staryMlyn.map.props.find((p) => p.id === 'mlyn_kolo_wodne');
    const forest = createWilczyLasScene({ withHunt: true });
    const forester = createLesniczowkaScene();
    const ruins = createRuinyStraznicyScene();
    const dog = forester.actors?.find((actor) => actor.id === 'npc_pies_burek')!;
    const boar = forest.actors?.find((actor) => actor.id === 'enemy_las_dzik')!;
    const shed = lesniczowka.map.props.find((p) => p.id === 'lesniczowka_szopa')!;

    // Grand institutions & public halls use Row 3 (variants 12..15) manor sprites, never tiny Row 0 shacks
    expect(school.variant).toBeGreaterThanOrEqual(12);
    expect(schoolTower.y).toBe(3);
    expect(inn.variant).toBeGreaterThanOrEqual(12);
    expect(barracks.variant).toBeGreaterThanOrEqual(12);
    expect(watermill.variant).toBeGreaterThanOrEqual(12);
    expect(watermillWheel?.kind).toBe('watermill_wheel');
    expect(watermillWheel?.name).toBe('Koło Młyńskie');
    expect(watermillWheel?.blocksMovement).toBe(false);
    expect(staryMlyn.map.props.some((p) => p.id === 'mlyn_wnetrze_krysztal' || p.kind === 'arcane_crystal')).toBe(false);
    expect(staryMlyn.actors?.some((actor) => actor.id === 'npc_mlyn_wnetrze')).toBe(false);
    expect(forest.actors?.some((actor) => ['npc_las_polana', 'npc_las_slady'].includes(actor.id))).toBe(false);
    expect(ruins.actors?.some((actor) => ['npc_ruiny_mur', 'npc_ruiny_kruk'].includes(actor.id))).toBe(false);
    expect(ruins.map.props.some((prop) => prop.id === 'ruiny_kruk' && prop.kind === 'perched_crow')).toBe(true);
    const scouts = createTraktKupieckiScene().actors?.find((actor) => actor.id === 'npc_trakt_zwiadowcy');
    expect(scouts?.recipe.name).toBe('Zwiadowca przy ognisku');
    expect(scouts?.recipe.title).toBe('Jeden z jeźdźców w szarym płaszczu');
    // Smithy uses a medium stone-chimney building, never a Row 0 shed
    expect(smithy.variant).toBeGreaterThanOrEqual(4);
    // Shed genuinely uses a compact Row 0 shed sprite
    expect(shed.variant).toBeLessThan(4);

    // Visual scale hierarchy: School > Inn/Barracks/Watermill > Dormitory > Village Cottage > Shed
    const schoolScale = getPropVisualTransform(school).scaleX;
    const innScale = getPropVisualTransform(inn).scaleX;
    const dormScale = getPropVisualTransform(dorm1).scaleX;
    const cottageScale = getPropVisualTransform(peasantCottage).scaleX;
    const shedScale = getPropVisualTransform(shed).scaleX;
    const towerScale = getPropVisualTransform(schoolTower).scaleX;
    const dummyScale = getPropVisualTransform(trainingDummy).scaleX;

    expect(schoolScale).toBeGreaterThan(innScale);
    expect(innScale).toBeGreaterThan(dormScale);
    expect(dormScale).toBeGreaterThan(cottageScale);
    expect(cottageScale).toBeGreaterThan(shedScale);
    expect(towerScale).toBeGreaterThan(cottageScale);
    expect(dummyScale).toBeGreaterThan(1);
    expect(schoolBanner.kind).toBe('school_banner');
    expect(schoolBanner.blocksMovement).toBe(false);

    // Verify official engine hooks (registerPropVisualTransform & registerCustomCharacterBaker) are active
    new OstrzeEngineState();
    expect(resolvePropVisualTransform(school).scaleX).toBe(schoolScale);
    expect(computeCharacterRecipeHash(dog.recipe)).toContain('dog_');
    expect(computeCharacterRecipeHash(boar.recipe)).toContain('boar_');
    const wolfScene = createWilczaNoraScene();
    const wolfActor = wolfScene.actors!.find((a) => a.id === 'enemy_wilk_1')!;
    expect(computeCharacterRecipeHash(wolfActor.recipe)).toBe(
      `wolf|${wolfActor.recipe.id}|${wolfActor.recipe.name}`
    );
    expect(bakeCharacterBuffers(wolfActor.recipe).recipeHash).toContain('wolf_');
  });

  it('turns dialogue NPCs toward the player when a custom scene loads', () => {
    const game = new OstrzeEngineState();
    const scene = createBrzezinaYardScene();
    game.registerCustomScene(scene);
    expect(game.loadCustomScene(scene.id)).toBe(true);

    for (const npc of game.npcs.filter((actor) => actor.dialogueId)) {
      expect(npc.direction).toBe(
        deltaToDirection8(game.player.tileX - npc.tileX, game.player.tileY - npc.tileY)
      );
    }
  });
});
