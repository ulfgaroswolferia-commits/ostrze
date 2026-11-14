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
    const isMainRoad = (x >= 13 && x <= 14) || (y >= 13 && y <= 14 && x >= 4 && x <= 23);
    const isSouthGate = x >= 13 && x <= 14 && y === height - 1;
    if (isPalisade) {
      return { z: 1, terrain: 'forest_soil', walkable: isSouthGate };
    }
    return {
      z: 0,
      terrain: isMainRoad ? 'dirt_path' : 'forest_grass',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'slavic_village' as MapId,
    name: 'Strażnica Wilczy Bród',
    subtitle: 'Rozdział I: Pogórze — Palisada, Wieża i Błoto',
    locationType: 'town',
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
      }
    ],
    lights: [
      {
        id: 'light_wb_fire',
        x: 12.5,
        y: 12.5,
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
      mainHand: 'weapon_iron_longsword',
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
      id: 'npc_ostromir',
      seed: 405,
      name: 'Kupiec Ostromir',
      title: 'Kupiec z Wozem przy Bramie',
      x: 12,
      y: 22,
      z: tiles[22][12].z,
      direction: 2,
      torso: 'torso_slavic_giezlo',
      cloak: 'cloak_forest_ranger'
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
    const isRavine = Math.abs(x - 11) <= 3;
    return {
      z: isWall && !isRavine ? 2 : 0,
      terrain: isRavine ? 'forest_soil' : 'forest_grass',
      walkable: !isWall || (x >= 10 && x <= 12 && y >= height - 2)
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Wilcza Nora — Wąwóz',
    subtitle: 'Zlecenie Komendanta Wszebora',
    locationType: 'wilderness',
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
        x: 11.5,
        y: 8.5,
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
    const isRoad = Math.abs(x - 12) <= 2;
    const isCliff = x <= 3 || x >= width - 4;
    return {
      z: isCliff ? 2 : 0,
      terrain: isRoad ? 'dirt_path' : isCliff ? 'dungeon_stone' : 'forest_soil',
      walkable: !isCliff
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Droga ku Kamiennej Przełęczy',
    subtitle: 'Eskorta wozu kupca Ostromira',
    locationType: 'wilderness',
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
        x: 11.5,
        y: 8.5,
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
      mainHand: 'weapon_iron_longsword',
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
      mainHand: 'weapon_spear_or_staff',
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
