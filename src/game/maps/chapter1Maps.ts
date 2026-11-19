import { generateRandomCharacterRecipe } from '@ulf/assets/characterBakery';
import { IsometricWorldMap, MapId, TileCell, TileTerrainType } from '@ulf/core/worldMap';
import { createDefaultProficiencies } from '@ulf/rpg/combatSystem';
import { ActorEntity } from '@ulf/rpg/gameLoop';
import type { CustomSceneConfig } from '../../engine-bridge/OstrzeEngineState';

function buildGrid(
  width: number,
  height: number,
  tileFn: (x: number, y: number) => { z: number; terrain: TileTerrainType; walkable: boolean }
): TileCell[][] {
  const tiles: TileCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ x, y, ...tileFn(x, y) });
    }
    tiles.push(row);
  }
  return tiles;
}

function makeChapterNpc(opts: {
  id: string;
  seed: number;
  name: string;
  title: string;
  x: number;
  y: number;
  z: number;
  direction?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  torso?: string;
  cloak?: string | null;
  head?: string | null;
  mainHand?: string | null;
  offHand?: string | null;
  hostile?: boolean;
  hp?: number;
  ap?: number;
  xpReward?: number;
  dialogueId?: string;
}): ActorEntity {
  const recipe = generateRandomCharacterRecipe(opts.seed, opts.id);
  recipe.name = opts.name;
  recipe.title = opts.title;
  recipe.equipment = {
    head: opts.head ?? null,
    torso: opts.torso ?? 'torso_przeszywanica',
    cloak: opts.cloak ?? null,
    legs: 'legs_leather_boots',
    mainHand: opts.mainHand ?? null,
    offHand: opts.offHand ?? null
  };

  const actor: ActorEntity = {
    id: opts.id,
    recipe,
    x: opts.x + 0.5,
    y: opts.y + 0.5,
    z: opts.z,
    tileX: opts.x,
    tileY: opts.y,
    direction: opts.direction ?? 4,
    isMoving: false,
    animFrame: 0,
    animTimer: 0,
    path: [],
    dialogueId: opts.dialogueId ?? (!opts.hostile ? opts.id : undefined)
  };

  if (opts.hostile) {
    const hp = opts.hp ?? 28;
    const ap = opts.ap ?? 6;
    actor.combat = {
      hp,
      maxHp: hp,
      ap,
      maxAp: ap,
      proficiencies: createDefaultProficiencies(),
      isHostile: true,
      isAlive: true,
      xpReward: opts.xpReward ?? 35,
      lootTable: [],
      difficulty: 'normal',
      aggroRadius: 14,
      dazedHeadTurns: 0,
      crippledLegsTurns: 0,
      defending: false
    };
  }

  return actor;
}

/**
 * Rozdział I — Hub: Strażnica Wilczy Bród (28x28)
 */
export function createWilczyBrodScene(): CustomSceneConfig {
  const width = 28;
  const height = 28;
  const tiles = buildGrid(width, height, (x, y) => {
    const isPalisade = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isSouthGate = x >= 13 && x <= 14 && y === height - 1;
    const isMainRoad = (x >= 13 && x <= 14) || (y >= 13 && y <= 14 && x >= 4 && x <= 23);
    const isSquare = Math.hypot(x - 13.5, y - 13) <= 3.1;
    const isTavernYard = x >= 6 && x <= 9 && y >= 9 && y <= 12;
    const isMarketYard = x >= 18 && x <= 21 && y >= 11 && y <= 13;
    const isSmithyApproach = x >= 18 && x <= 20 && y >= 15 && y <= 16;
    const isWatchtowerApproach = x >= 12 && x <= 15 && y >= 5 && y <= 8;
    const isInnerEdge = x === 1 || y === 1 || x === width - 2 || y === height - 2;
    if (isPalisade) {
      return { z: 1, terrain: 'forest_soil', walkable: isSouthGate };
    }
    const isDirt =
      isMainRoad ||
      isSquare ||
      isTavernYard ||
      isMarketYard ||
      isSmithyApproach ||
      isWatchtowerApproach;
    return {
      z: 0,
      terrain: isDirt ? 'dirt_path' : isInnerEdge && (x + y) % 2 === 0 ? 'forest_soil' : 'forest_grass',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'slavic_village' as MapId,
    name: 'Strażnica Wilczy Bród',
    subtitle: 'Rozdział I: Pogórze — Palisada, Wieża i Błoto',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'wb_straznica',
        name: 'Strażnica Komendanta Wszebora',
        kind: 'watchtower',
        x: 13,
        y: 4,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'wb_karczma',
        name: 'Karczma „Pod Wilczym Kłem”',
        kind: 'slavic_cottage',
        x: 6,
        y: 8,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'wb_kramik',
        name: 'Kramik Kupiecki',
        kind: 'market_stall',
        x: 19,
        y: 10,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'wb_szkarad_warsztat',
        name: 'Warsztat Rusznikarza Szkarada',
        kind: 'slavic_cottage',
        x: 20,
        y: 18,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'wb_ognisko',
        name: 'Ognisko Strażnicze',
        kind: 'campfire',
        x: 12,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_wb_fire'
      },
      {
        id: 'wb_studnia',
        name: 'Studnia w Brodzie',
        kind: 'slavic_well',
        x: 9,
        y: 16,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'wb_tablica',
        name: 'Tablica Zleceń Strażnicy',
        kind: 'travel_signpost',
        x: 14,
        y: 10,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'wb_drogowskaz',
        name: 'Brama i Szlak na Pogórze',
        kind: 'travel_signpost',
        x: 15,
        y: 24,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'wb_kuznia',
        name: 'Kuźnia Kowala Zbycha',
        kind: 'slavic_cottage',
        x: 19,
        y: 14,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      }
    ],
    lights: [
      {
        id: 'light_wb_fire',
        x: 12,
        y: 12,
        z: 0.7,
        color: { r: 255, g: 166, b: 82 },
        intensity: 1.35,
        radius: 7,
        flickerSpeed: 4.2,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapterNpc({
      id: 'npc_wszebor',
      seed: 401,
      name: 'Komendant Wszebor',
      title: 'Dowódca Strażnicy Wilczy Bród',
      x: 13,
      y: 7,
      z: tiles[7][13].z,
      torso: 'torso_warden_brigandine',
      cloak: 'cloak_crimson_mantle',
      mainHand: 'weapon_sunblade_longsword',
      offHand: 'offhand_slavic_shield'
    }),
    makeChapterNpc({
      id: 'npc_wrzosek',
      seed: 402,
      name: 'Karczmarz Wrzosek',
      title: 'Gospodarz „Pod Wilczym Kłem”',
      x: 7,
      y: 11,
      z: tiles[11][7].z,
      torso: 'torso_slavic_giezlo'
    }),
    makeChapterNpc({
      id: 'npc_kramarz_brod',
      seed: 403,
      name: 'Kramarz z Brodu',
      title: 'Handlarz Zaopatrzeniem',
      x: 20,
      y: 12,
      z: tiles[12][20].z,
      direction: 6,
      torso: 'torso_slavic_giezlo'
    }),
    makeChapterNpc({
      id: 'npc_kowal_zbych',
      seed: 406,
      name: 'Kowal Zbych',
      title: 'Kowal w Wilczym Brodzie',
      x: 19,
      y: 16,
      z: tiles[16][19].z,
      direction: 6,
      torso: 'torso_warden_brigandine',
      mainHand: 'weapon_slavic_axe'
    }),
    makeChapterNpc({
      id: 'npc_szkarad',
      seed: 404,
      name: 'Rusznikarz Szkarad',
      title: 'Mistrz Prochu i Żelaza',
      x: 21,
      y: 20,
      z: tiles[20][21].z,
      direction: 6,
      torso: 'torso_warden_brigandine',
      head: 'helm_shadow_hood'
    }),
    makeChapterNpc({
      id: 'npc_zona_borka',
      seed: 407,
      name: 'Żona Borka',
      title: 'Kobieta przy Studni',
      x: 8,
      y: 16,
      z: tiles[16][8].z,
      direction: 4,
      torso: 'torso_slavic_giezlo'
    }),
    makeChapterNpc({
      id: 'npc_corka_straznika',
      seed: 408,
      name: 'Córka strażnika',
      title: 'Córka Dawnego Strażnika z Ruin',
      x: 10,
      y: 6,
      z: tiles[6][10].z,
      direction: 4,
      torso: 'torso_linen_tunic'
    }),
    makeChapterNpc({
      id: 'npc_wartownik',
      seed: 409,
      name: 'Wartownik przy palisadzie',
      title: 'Żołnierz Garnizonu',
      x: 16,
      y: 7,
      z: tiles[7][16].z,
      direction: 4,
      head: 'helm_szyszak',
      torso: 'torso_przeszywanica',
      mainHand: 'weapon_astral_staff'
    }),
    makeChapterNpc({
      id: 'npc_ostromir',
      seed: 405,
      name: 'Kupiec Ostromir',
      title: 'Kupiec z Wozem przy Bramie',
      x: 12,
      y: 22,
      z: tiles[22][12].z,
      direction: 2,
      torso: 'torso_slavic_giezlo',
      cloak: 'cloak_ranger_quiver'
    })
  ];

  return {
    id: 'wilczy_brod',
    map,
    spawnX: 13,
    spawnY: 19,
    actors,
    ambientLightIntensity: 0.44,
    fogOfWarEnabled: false
  };
}

/**
 * Rozdział I — Lokacja questowa: Wilcza Nora (Wąwóz)
 */
export function createWilczaNoraScene(): CustomSceneConfig {
  const width = 22;
  const height = 22;
  const tiles = buildGrid(width, height, (x, y) => {
    const isWall = x <= 2 || x >= width - 3 || y <= 2 || y >= height - 2;
    const ravineCenter = 11 + Math.sin(y * 0.3) * 1.1;
    const ravineDist = Math.abs(x - ravineCenter);
    const isRavine = ravineDist <= 3.15;
    const isAnimalTrail = ravineDist <= 1.15 && y >= 6;
    return {
      z: isWall && !isRavine ? 2 : 0,
      terrain: isAnimalTrail ? 'dirt_path' : isRavine ? 'forest_soil' : 'forest_grass',
      walkable: !isWall || (x >= 10 && x <= 12 && y >= height - 2)
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Wilcza Nora — Wąwóz',
    subtitle: 'Zlecenie Komendanta Wszebora',
    width,
    height,
    maxElevation: 3,
    tiles,
    props: [
      {
        id: 'nora_kloda',
        name: 'Korzenie Starego Buka',
        kind: 'fallen_log',
        x: 10,
        y: 6,
        z: 0,
        sizeX: 1,
        sizeY: 2,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'nora_skala',
        name: 'Ściana Wąwozu',
        kind: 'rock_cliff',
        x: 7,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'nora_martwe_drzewo',
        name: 'Spękany Buk nad Norą',
        kind: 'dead_tree',
        x: 15,
        y: 6,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'nora_krzak',
        name: 'Ciernie i jagody',
        kind: 'berry_bush',
        x: 6,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: false,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'nora_pniak',
        name: 'Pniak przy wąwozie',
        kind: 'tree_stump',
        x: 13,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      }
    ],
    lights: [
      {
        id: 'light_nora_mist',
        x: 11,
        y: 8,
        z: 1.5,
        color: { r: 155, g: 185, b: 230 },
        intensity: 0.9,
        radius: 9,
        flickerSpeed: 0.6,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapterNpc({
      id: 'enemy_wilk_1',
      seed: 501,
      name: 'Basior z Wąwozu',
      title: 'Przywódca Watahy',
      x: 11,
      y: 8,
      z: tiles[8][11].z,
      head: 'helm_druid_antlers',
      torso: 'torso_warden_brigandine',
      mainHand: 'weapon_Executioner_axe',
      hostile: true,
      hp: 26,
      ap: 7,
      xpReward: 25
    }),
    makeChapterNpc({
      id: 'enemy_wilk_2',
      seed: 502,
      name: 'Dziki Wilk',
      title: 'Wataha',
      x: 9,
      y: 9,
      z: tiles[9][9].z,
      head: 'helm_druid_antlers',
      torso: 'torso_przeszywanica',
      mainHand: 'weapon_slavic_axe',
      hostile: true,
      hp: 20,
      ap: 7,
      xpReward: 20
    }),
    makeChapterNpc({
      id: 'enemy_wilk_3',
      seed: 503,
      name: 'Dziki Wilk',
      title: 'Wataha',
      x: 13,
      y: 9,
      z: tiles[9][13].z,
      head: 'helm_druid_antlers',
      torso: 'torso_przeszywanica',
      mainHand: 'weapon_slavic_axe',
      hostile: true,
      hp: 20,
      ap: 7,
      xpReward: 20
    })
  ];

  return {
    id: 'wilcza_nora',
    map,
    spawnX: 11,
    spawnY: 17,
    actors,
    ambientLightIntensity: 0.24,
    fogOfWarEnabled: false
  };
}

/**
 * Rozdział I — Eskorta Ostromira: Droga ku Kamiennej Przełęczy
 */
export function createKamiennaPrzeleczScene(): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const roadCenter = 12 + Math.sin(y * 0.25) * 1.3;
    const roadDist = Math.abs(x - roadCenter);
    const isRoad = roadDist <= 2.1;
    const isOldCobble = roadDist <= 0.9 && (x * 3 + y * 5) % 5 === 0;
    const isCliff = x <= 3 || x >= width - 4;
    const isGrassTuft = !isCliff && !isRoad && roadDist >= 3.3 && (x + y * 2) % 3 === 0;
    return {
      z: isCliff ? 2 : 0,
      terrain: isOldCobble
        ? 'mossy_cobble'
        : isRoad
          ? 'dirt_path'
          : isCliff
            ? 'dungeon_stone'
            : isGrassTuft
              ? 'forest_grass'
              : 'forest_soil',
      walkable: !isCliff
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Droga ku Kamiennej Przełęczy',
    subtitle: 'Eskorta wozu kupca Ostromira',
    width,
    height,
    maxElevation: 3,
    tiles,
    props: [
      {
        id: 'przelecz_skala_l',
        name: 'Górski Urwisko',
        kind: 'rock_cliff',
        x: 8,
        y: 9,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'przelecz_skala_p',
        name: 'Górski Głaz',
        kind: 'rock_cliff',
        x: 15,
        y: 10,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'przelecz_martwe_drzewo',
        name: 'Spękany Buk nad Przełęczą',
        kind: 'dead_tree',
        x: 15,
        y: 6,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'przelecz_krzak',
        name: 'Górskie Ciernie',
        kind: 'berry_bush',
        x: 6,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: false,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'przelecz_pniak',
        name: 'Pniak przy Trakcie',
        kind: 'tree_stump',
        x: 13,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      }
    ],
    lights: [
      {
        id: 'light_przelecz_mist',
        x: 11,
        y: 8,
        z: 1.5,
        color: { r: 155, g: 185, b: 230 },
        intensity: 0.9,
        radius: 9,
        flickerSpeed: 0.6,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapterNpc({
      id: 'enemy_przelecz_bandyta_1',
      seed: 601,
      name: 'Zbir spod Mostku',
      title: 'Napastnik w masce z worka',
      x: 11,
      y: 8,
      z: tiles[8][11].z,
      head: 'helm_shadow_hood',
      mainHand: 'weapon_sunblade_longsword',
      hostile: true,
      hp: 28,
      ap: 6,
      xpReward: 40
    }),
    makeChapterNpc({
      id: 'enemy_przelecz_bandyta_2',
      seed: 602,
      name: 'Zbir z Widłami',
      title: 'Napastnik w masce z worka',
      x: 13,
      y: 8,
      z: tiles[8][13].z,
      head: 'helm_shadow_hood',
      mainHand: 'weapon_astral_staff',
      hostile: true,
      hp: 28,
      ap: 6,
      xpReward: 40
    })
  ];

  return {
    id: 'kamienna_przelecz',
    map,
    spawnX: 12,
    spawnY: 16,
    actors,
    ambientLightIntensity: 0.36,
    fogOfWarEnabled: false
  };
}

/**
 * Rozdział I — Lokacja satelicka 1: Las Rubieży (wilczy_las)
 * Polana ziół (lek_dla_wrzoska), Ślady za polaną (zaginiony_pasterz_borek), Drwal, Legowisko w gęstwinie.
 */
export function createWilczyLasScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const wobble = Math.sin(x * 0.65) * 0.6 + Math.cos(y * 0.6) * 0.6;
    const isClearing = Math.hypot(x - 11, y - 11) <= 5.5 + wobble;
    const pathCenter = 11 + Math.sin(y * 0.35) * 0.9;
    const isPath = Math.abs(x - pathCenter) <= 1.2 && y >= 10;
    return {
      z: isBorder && !isPath ? 1 : 0,
      terrain: isPath ? 'dirt_path' : isClearing ? 'forest_grass' : 'forest_soil',
      walkable: !isBorder || isPath
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Las Rubieży',
    subtitle: 'Pogórze — Polana Ziół i Ścieżki za Strażnicą',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'las_polana_ziol',
        name: 'Polana Ziół',
        kind: 'wildflower_patch',
        x: 9,
        y: 10,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'las_slady_borka',
        name: 'Ślady za Polaną',
        kind: 'ground_loot',
        x: 14,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'las_stary_dab',
        name: 'Stary Dąb z Wydrążeniem',
        kind: 'ancient_oak',
        x: 6,
        y: 7,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'las_kloda',
        name: 'Powalony Pień Drwala',
        kind: 'fallen_log',
        x: 15,
        y: 13,
        z: 0,
        sizeX: 1,
        sizeY: 2,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'las_drogowskaz',
        name: 'Ścieżka powrotna do Wilczego Brodu',
        kind: 'travel_signpost',
        x: 11,
        y: 20,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      }
    ],
    lights: [
      {
        id: 'light_las_clearing',
        x: 10,
        y: 10,
        z: 1.4,
        color: { r: 195, g: 235, b: 175 },
        intensity: 1.0,
        radius: 8,
        flickerSpeed: 1.2,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapterNpc({
      id: 'npc_las_polana',
      seed: 701,
      name: 'Polana Ziół',
      title: 'Zioła dla karczmarza Wrzoska',
      x: 9,
      y: 10,
      z: tiles[10][9].z,
      torso: 'torso_linen_tunic',
      head: 'helm_ranger_cowl'
    }),
    makeChapterNpc({
      id: 'npc_las_slady',
      seed: 702,
      name: 'Ślady za Polaną',
      title: 'Odciski owczych racic i ciężkich butów',
      x: 14,
      y: 8,
      z: tiles[8][14].z,
      torso: 'torso_przeszywanica',
      cloak: 'cloak_ranger_quiver'
    }),
    makeChapterNpc({
      id: 'npc_las_drwal',
      seed: 703,
      name: 'Drwal z Lasu Rubieży',
      title: 'Rębacz z Pogórza',
      x: 14,
      y: 14,
      z: tiles[14][14].z,
      direction: 6,
      torso: 'torso_slavic_giezlo',
      mainHand: 'weapon_slavic_axe'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeChapterNpc({
        id: 'enemy_las_dzik',
        seed: 704,
        name: 'Dzik z Gęstwiny',
        title: 'Bestia z Lasu Rubieży',
        x: 10,
        y: 6,
        z: tiles[6][10].z,
        head: 'helm_druid_antlers',
        torso: 'torso_warden_brigandine',
        mainHand: 'weapon_Executioner_axe',
        hostile: true,
        hp: 30,
        ap: 6,
        xpReward: 30
      }),
      makeChapterNpc({
        id: 'enemy_las_wilk_1',
        seed: 705,
        name: 'Dziki Wilk',
        title: 'Wataha z Gęstwiny',
        x: 8,
        y: 6,
        z: tiles[6][8].z,
        head: 'helm_druid_antlers',
        torso: 'torso_przeszywanica',
        mainHand: 'weapon_slavic_axe',
        hostile: true,
        hp: 20,
        ap: 7,
        xpReward: 20
      }),
      makeChapterNpc({
        id: 'enemy_las_wilk_2',
        seed: 706,
        name: 'Dziki Wilk',
        title: 'Wataha z Gęstwiny',
        x: 12,
        y: 6,
        z: tiles[6][12].z,
        head: 'helm_druid_antlers',
        torso: 'torso_przeszywanica',
        mainHand: 'weapon_slavic_axe',
        hostile: true,
        hp: 20,
        ap: 7,
        xpReward: 20
      })
    );
  }

  return {
    id: 'wilczy_las',
    map,
    spawnX: 11,
    spawnY: 18,
    actors,
    ambientLightIntensity: 0.36,
    fogOfWarEnabled: false
  };
}

/**
 * Rozdział I — Lokacja satelicka 2: Stary młyn nad rzeką (stary_mlyn)
 * Młynarz Ostap (zboze_dla_mlyna), Wnętrze młyna nocą (swiatlo_w_mlynie), Żona młynarza.
 */
export function createStaryMlynScene(opts?: { isNight?: boolean }): CustomSceneConfig {
  const width = 22;
  const height = 22;
  const tiles = buildGrid(width, height, (x, y) => {
    const riverBank = width - 4 + Math.round(Math.sin(y * 0.38) * 1.0);
    const isRiver = x >= riverBank;
    const isMudBank = x === riverBank - 1;
    const isBorder = x === 0 || y === 0 || y === height - 1;
    const roadCenter = 10 + Math.sin(y * 0.3) * 0.8;
    const isRoad = (Math.abs(x - roadCenter) <= 1.25 && y >= 9) || (x >= 9 && x <= 14 && y >= 8 && y <= 10);
    if (isRiver) {
      return { z: 0, terrain: 'abyss_water', walkable: false };
    }
    return {
      z: isBorder && !isRoad ? 1 : 0,
      terrain: isRoad ? 'dirt_path' : isMudBank ? 'forest_soil' : 'forest_grass',
      walkable: !isBorder || isRoad
    };
  });

  const map: IsometricWorldMap = {
    id: 'slavic_village' as MapId,
    name: 'Stary Młyn nad Rzeką',
    subtitle: 'Pogórze — Młyn Ostapa i Zimny Blask po Zmroku',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'mlyn_budynek',
        name: 'Stary Młyn Wodny',
        kind: 'slavic_cottage',
        x: 12,
        y: 7,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: true
      },
      {
        id: 'mlyn_wnetrze_krysztal',
        name: 'Koło Młyńskie i Wnętrze Młyna',
        kind: 'arcane_crystal',
        x: 14,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_mlyn_glow'
      },
      {
        id: 'mlyn_beczki',
        name: 'Worki i Beczki Ostapa',
        kind: 'dungeon_barrel',
        x: 9,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'mlyn_drogowskaz',
        name: 'Droga powrotna do Wilczego Brodu',
        kind: 'travel_signpost',
        x: 10,
        y: 19,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      }
    ],
    lights: [
      {
        id: 'light_mlyn_glow',
        x: 14,
        y: 8,
        z: 1.0,
        color: { r: 90, g: 195, b: 255 },
        intensity: opts?.isNight ? 1.45 : 0.4,
        radius: 6.5,
        flickerSpeed: 3.5,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapterNpc({
      id: 'npc_ostap',
      seed: 711,
      name: 'Młynarz Ostap',
      title: 'Gospodarz Starego Młyna',
      x: 10,
      y: 9,
      z: tiles[9][10].z,
      torso: 'torso_slavic_giezlo'
    }),
    makeChapterNpc({
      id: 'npc_mlyn_wnetrze',
      seed: 712,
      name: 'Wnętrze Młyna',
      title: 'Zbadaj młyn pod kołem zębatym',
      x: 13,
      y: 9,
      z: tiles[9][13].z,
      torso: 'torso_archmage_robes',
      head: 'helm_arcane_circlet'
    }),
    makeChapterNpc({
      id: 'npc_zona_mlynarza',
      seed: 713,
      name: 'Żona młynarza',
      title: 'Gospodyni znad Rzeki',
      x: 7,
      y: 11,
      z: tiles[11][7].z,
      torso: 'torso_slavic_giezlo'
    })
  ];

  return {
    id: 'stary_mlyn',
    map,
    spawnX: 10,
    spawnY: 16,
    actors,
    ambientLightIntensity: opts?.isNight ? 0.18 : 0.42,
    fogOfWarEnabled: false
  };
}

/**
 * Rozdział I — Lokacja satelicka 3: Trakt kupiecki (trakt_kupiecki)
 * Kupiec Ostromir (dlug_kupca), Ognisko zwiadowców (kto_pyta_o_ocalalych), Pielgrzym, Rozbójnicy.
 */
export function createTraktKupieckiScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const roadCenter = 12 + Math.sin(y * 0.26) * 1.2;
    const roadDist = Math.abs(x - roadCenter);
    const isWagonTurnout = x >= 9 && x <= 11 && y >= 11 && y <= 14;
    const isCampTurnout = x >= 14 && x <= 16 && y >= 8 && y <= 10;
    const isRoad = roadDist <= 2.1 || isWagonTurnout || isCampTurnout;
    const isShoulder = !isRoad && roadDist <= 3.0;
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    return {
      z: isBorder && !isRoad ? 1 : 0,
      terrain: isRoad ? 'dirt_path' : isShoulder ? 'forest_soil' : 'forest_grass',
      walkable: !isBorder || isRoad
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Trakt Kupiecki',
    subtitle: 'Pogórze — Wóz Ostromira i Obozowisko Zwiadowców',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'trakt_k_woz',
        name: 'Wóz Kupca Ostromira',
        kind: 'market_stall',
        x: 9,
        y: 12,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'trakt_k_ognisko',
        name: 'Ognisko Zwiadowców',
        kind: 'campfire',
        x: 15,
        y: 9,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_trakt_k_fire'
      },
      {
        id: 'trakt_k_kamien',
        name: 'Przydrożny Kamień Pielgrzyma',
        kind: 'rock_cliff',
        x: 7,
        y: 15,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'trakt_k_drogowskaz',
        name: 'Drogowskaz do Wilczego Brodu',
        kind: 'travel_signpost',
        x: 12,
        y: 20,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      }
    ],
    lights: [
      {
        id: 'light_trakt_k_fire',
        x: 15,
        y: 9,
        z: 0.7,
        color: { r: 255, g: 164, b: 82 },
        intensity: 1.3,
        radius: 6.5,
        flickerSpeed: 4.0,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapterNpc({
      id: 'npc_trakt_ostromir',
      seed: 405,
      name: 'Kupiec Ostromir',
      title: 'Postój na Trakcie Kupieckim',
      x: 10,
      y: 13,
      z: tiles[13][10].z,
      torso: 'torso_slavic_giezlo',
      cloak: 'cloak_ranger_quiver'
    }),
    makeChapterNpc({
      id: 'npc_trakt_zwiadowcy',
      seed: 721,
      name: 'Ognisko Zwiadowców',
      title: 'Dwóch jeźdźców w szarych płaszczach',
      x: 16,
      y: 9,
      z: tiles[9][16].z,
      direction: 6,
      head: 'helm_shadow_hood',
      torso: 'torso_warden_brigandine',
      cloak: 'cloak_ranger_quiver',
      mainHand: 'weapon_sunblade_longsword'
    }),
    makeChapterNpc({
      id: 'npc_trakt_pielgrzym',
      seed: 722,
      name: 'Pielgrzym na kamieniu',
      title: 'Wędrowny Pątnik',
      x: 8,
      y: 15,
      z: tiles[15][8].z,
      torso: 'torso_linen_tunic',
      mainHand: 'weapon_astral_staff'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeChapterNpc({
        id: 'enemy_trakt_rabus_1',
        seed: 723,
        name: 'Rozbójnik z Krzaków',
        title: 'Zbir przy gościńcu',
        x: 11,
        y: 5,
        z: tiles[5][11].z,
        head: 'helm_shadow_hood',
        torso: 'torso_przeszywanica',
        mainHand: 'weapon_slavic_axe',
        hostile: true,
        hp: 26,
        ap: 6,
        xpReward: 35
      }),
      makeChapterNpc({
        id: 'enemy_trakt_rabus_2',
        seed: 724,
        name: 'Rozbójnik z Pałką',
        title: 'Zbir przy gościńcu',
        x: 13,
        y: 5,
        z: tiles[5][13].z,
        head: 'helm_ranger_cowl',
        torso: 'torso_warden_brigandine',
        mainHand: 'weapon_Executioner_axe',
        hostile: true,
        hp: 26,
        ap: 6,
        xpReward: 35
      })
    );
  }

  return {
    id: 'trakt_kupiecki',
    map,
    spawnX: 12,
    spawnY: 18,
    actors,
    ambientLightIntensity: 0.34,
    fogOfWarEnabled: false
  };
}

/**
 * Rozdział I — Lokacja satelicka 4: Leśniczówka (lesniczowka)
 * Leśniczy (list_do_lesniczego), Pomocnik Gniewosz, Pies Burek, Skrytka pod dębem, Kłusownicy.
 */
export function createLesniczowkaScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 22;
  const height = 22;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const wobble = Math.sin(x * 0.7) * 0.08 + Math.cos(y * 0.7) * 0.08;
    const isYard = Math.hypot((x - 10.5) / 5.1, (y - 10.5) / 5.1) + wobble <= 1.02;
    const pathCenter = 11 + Math.sin(y * 0.35) * 0.75;
    const isPath = Math.abs(x - pathCenter) <= 1.25 && y >= 14;
    const isOakSoil = Math.hypot(x - 5.5, y - 9) <= 2.2;
    return {
      z: isBorder && !isPath ? 1 : 0,
      terrain: isYard || isPath ? 'dirt_path' : isOakSoil ? 'forest_soil' : 'forest_grass',
      walkable: !isBorder || isPath
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Leśniczówka na Wschodzie',
    subtitle: 'Pogórze — Chata Leśniczego i Skrytka pod Dębem',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'lesniczowka_chata',
        name: 'Chata Leśniczego',
        kind: 'slavic_cottage',
        x: 10,
        y: 6,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'lesniczowka_dab',
        name: 'Ułamany Dąb na Skraju Polany',
        kind: 'ancient_oak',
        x: 5,
        y: 9,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'lesniczowka_schowek',
        name: 'Skrytka pod Dębem',
        kind: 'chest',
        x: 6,
        y: 9,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'lesniczowka_pniak',
        name: 'Pień do Rąbania',
        kind: 'tree_stump',
        x: 14,
        y: 10,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'lesniczowka_drogowskaz',
        name: 'Szlak powrotny do Wilczego Brodu',
        kind: 'travel_signpost',
        x: 11,
        y: 19,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      }
    ],
    lights: [
      {
        id: 'light_lesniczowka_cabin',
        x: 10,
        y: 7,
        z: 1.2,
        color: { r: 255, g: 182, b: 88 },
        intensity: 1.2,
        radius: 6,
        flickerSpeed: 2.5,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapterNpc({
      id: 'npc_lesniczy',
      seed: 731,
      name: 'Leśniczy',
      title: 'Gospodarz Leśniczówki',
      x: 10,
      y: 9,
      z: tiles[9][10].z,
      torso: 'torso_warden_brigandine',
      cloak: 'cloak_ranger_quiver',
      mainHand: 'weapon_hunting_bow'
    }),
    makeChapterNpc({
      id: 'npc_gniewosz',
      seed: 732,
      name: 'Pomocnik Gniewosz',
      title: 'Drwal przy Stercie Drewna',
      x: 14,
      y: 11,
      z: tiles[11][14].z,
      direction: 6,
      torso: 'torso_linen_tunic',
      mainHand: 'weapon_slavic_axe'
    }),
    makeChapterNpc({
      id: 'npc_pies_burek',
      seed: 733,
      name: 'Pies Burek (Wilk)',
      title: 'Wielki Pies Leśniczego',
      x: 8,
      y: 8,
      z: tiles[8][8].z,
      torso: 'torso_przeszywanica'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeChapterNpc({
        id: 'enemy_klusownik_1',
        seed: 734,
        name: 'Kłusownik z Zagajnika',
        title: 'Złodziej Zwierzyny',
        x: 9,
        y: 4,
        z: tiles[4][9].z,
        head: 'helm_ranger_cowl',
        torso: 'torso_przeszywanica',
        mainHand: 'weapon_hunting_bow',
        hostile: true,
        hp: 24,
        ap: 6,
        xpReward: 35
      }),
      makeChapterNpc({
        id: 'enemy_klusownik_2',
        seed: 735,
        name: 'Kłusownik z Nożem',
        title: 'Złodziej Zwierzyny',
        x: 12,
        y: 4,
        z: tiles[4][12].z,
        head: 'helm_shadow_hood',
        torso: 'torso_linen_tunic',
        mainHand: 'weapon_slavic_axe',
        hostile: true,
        hp: 24,
        ap: 6,
        xpReward: 35
      })
    );
  }

  return {
    id: 'lesniczowka',
    map,
    spawnX: 11,
    spawnY: 16,
    actors,
    ambientLightIntensity: 0.38,
    fogOfWarEnabled: false
  };
}

/**
 * Rozdział I — Lokacja satelicka 5: Ruiny strażnicy (ruiny_straznicy)
 * Pasterz Borek (zaginiony_pasterz_borek), Mur ze znakiem (amulet_z_ruin), Wartownik Czcibor, Obóz zbójców.
 */
export function createRuinyStraznicyScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const wobble = Math.sin(x * 0.65) * 0.65 + Math.cos(y * 0.65) * 0.65;
    const courtyardDist = Math.hypot((x - 11.5) / 6.1, (y - 10.5) / 6.1);
    const isCourtyard = courtyardDist <= 1.0 + wobble * 0.1;
    const isOvergrownPatch = isCourtyard && courtyardDist > 0.78 && (x * 7 + y * 11) % 4 === 0;
    const roadCenter = 12 + Math.sin(y * 0.35) * 0.7;
    const isRoad = Math.abs(x - roadCenter) <= 1.25 && y >= 15;
    const isPerimeterGrass = !isBorder && !isCourtyard && !isRoad && (x + y * 3) % 3 === 0;
    return {
      z: isBorder && !isRoad ? 1 : 0,
      terrain: isOvergrownPatch
        ? 'forest_soil'
        : isCourtyard
          ? 'mossy_cobble'
          : isRoad
            ? 'dirt_path'
            : isPerimeterGrass
              ? 'forest_grass'
              : 'forest_soil',
      walkable: !isBorder || isRoad
    };
  });

  const map: IsometricWorldMap = {
    id: 'sanctum_dungeon' as MapId,
    name: 'Ruiny Strażnicy na Wzgórzu',
    subtitle: 'Pogórze — Czarne Mury, Pasterz Borek i Dawny Znak',
    width,
    height,
    maxElevation: 3,
    tiles,
    props: [
      {
        id: 'ruiny_wieza',
        name: 'Zawalona Baszta Strażnicy',
        kind: 'watchtower',
        x: 11,
        y: 4,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'ruiny_mur_znak',
        name: 'Mur z Wyżłobionym Znakiem Strażnicy',
        kind: 'runic_altar',
        x: 13,
        y: 6,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_ruiny_mark'
      },
      {
        id: 'ruiny_rumowisko',
        name: 'Rumowisko Rozwalonej Izby',
        kind: 'sarcophagus',
        x: 8,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 2,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'ruiny_kolumna_1',
        name: 'Pęknięty Filar',
        kind: 'pillar',
        x: 7,
        y: 13,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'ruiny_drogowskaz',
        name: 'Szlak powrotny do Wilczego Brodu',
        kind: 'travel_signpost',
        x: 12,
        y: 20,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      }
    ],
    lights: [
      {
        id: 'light_ruiny_mark',
        x: 13,
        y: 6,
        z: 1.2,
        color: { r: 120, g: 195, b: 255 },
        intensity: 1.15,
        radius: 6.5,
        flickerSpeed: 2.0,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapterNpc({
      id: 'npc_borek_ruiny',
      seed: 741,
      name: 'Pasterz Borek',
      title: 'Ranny Pasterz w Rumowisku',
      x: 9,
      y: 9,
      z: tiles[9][9].z,
      torso: 'torso_slavic_giezlo'
    }),
    makeChapterNpc({
      id: 'npc_ruiny_mur',
      seed: 742,
      name: 'Mur ze Znakiem Strażnicy',
      title: 'Starożytne Drzwi w Ruinach',
      x: 14,
      y: 8,
      z: tiles[8][14].z,
      torso: 'torso_aethel_plate',
      head: 'helm_arcane_circlet'
    }),
    makeChapterNpc({
      id: 'npc_czcibor',
      seed: 743,
      name: 'Wartownik Czcibor',
      title: 'Stary Strażnik w Zawalonej Bramie',
      x: 10,
      y: 15,
      z: tiles[15][10].z,
      head: 'helm_szyszak',
      torso: 'torso_warden_brigandine',
      mainHand: 'weapon_astral_staff'
    }),
    makeChapterNpc({
      id: 'npc_ruiny_kruk',
      seed: 744,
      name: 'Kruk między kamieniami',
      title: 'Czarny Ptak na Murze',
      x: 16,
      y: 13,
      z: tiles[13][16].z,
      head: 'helm_shadow_hood',
      torso: 'torso_archmage_robes'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeChapterNpc({
        id: 'enemy_ruiny_rabus_1',
        seed: 745,
        name: 'Zbójca z Ruin',
        title: 'Szajka spod Muru',
        x: 10,
        y: 6,
        z: tiles[6][10].z,
        head: 'helm_shadow_hood',
        torso: 'torso_warden_brigandine',
        mainHand: 'weapon_slavic_axe',
        hostile: true,
        hp: 28,
        ap: 6,
        xpReward: 35
      }),
      makeChapterNpc({
        id: 'enemy_ruiny_rabus_2',
        seed: 746,
        name: 'Zbójca z Toporem',
        title: 'Szajka spod Muru',
        x: 12,
        y: 6,
        z: tiles[6][12].z,
        head: 'helm_ranger_cowl',
        torso: 'torso_przeszywanica',
        mainHand: 'weapon_Executioner_axe',
        hostile: true,
        hp: 28,
        ap: 6,
        xpReward: 35
      }),
      makeChapterNpc({
        id: 'enemy_ruiny_lucznik',
        seed: 747,
        name: 'Zbójca Łucznik',
        title: 'Szajka spod Muru',
        x: 11,
        y: 5,
        z: tiles[5][11].z,
        head: 'helm_ranger_cowl',
        torso: 'torso_linen_tunic',
        mainHand: 'weapon_hunting_bow',
        hostile: true,
        hp: 22,
        ap: 6,
        xpReward: 35
      })
    );
  }

  return {
    id: 'ruiny_straznicy',
    map,
    spawnX: 12,
    spawnY: 18,
    actors,
    ambientLightIntensity: 0.32,
    fogOfWarEnabled: false
  };
}
