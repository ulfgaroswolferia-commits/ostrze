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
      const cell = tileFn(x, y);
      row.push({ x, y, ...cell });
    }
    tiles.push(row);
  }
  return tiles;
}

function makeNpc(opts: {
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
  attack?: number;
  defense?: number;
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
    const hp = opts.hp ?? 30;
    const ap = opts.ap ?? 6;
    actor.combat = {
      hp,
      maxHp: hp,
      ap,
      maxAp: ap,
      proficiencies: createDefaultProficiencies(),
      isHostile: true,
      isAlive: true,
      xpReward: opts.xpReward ?? 30,
      lootTable: [],
      difficulty: hp >= 100 ? 'very_hard' : 'normal',
      aggroRadius: 14,
      dazedHeadTurns: 0,
      crippledLegsTurns: 0,
      defending: false,
      customArmorBonus: hp >= 100 ? 12 : 0
    };
  }

  return actor;
}

/**
 * Lokacja 1: Brzezina — Dziedziniec Szkoły Ostrzy
 */
export function createBrzezinaYardScene(opts?: {
  sparingHostile?: boolean;
  withCourier?: boolean;
}): CustomSceneConfig {
  const width = 22;
  const height = 22;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isYard = x >= 5 && x <= 16 && y >= 5 && y <= 16;
    const isSouthGate = x >= 10 && x <= 11 && y >= 16;
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isSouthGate };
    }
    return {
      z: 0,
      terrain: isYard || isSouthGate ? 'dirt_path' : 'forest_grass',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Brzezina — Dziedziniec Szkoły Ostrzy',
    subtitle: 'Prolog: Cień Szkoły i Cesarski Wyrok',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'brzezina_chata',
        name: 'Izba Mistrza Gnieworada',
        kind: 'slavic_cottage',
        x: 9,
        y: 3,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'brzezina_kram',
        name: 'Kram Kwatermistrza Dobrogosta',
        kind: 'market_stall',
        x: 14,
        y: 7,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'brzezina_ognisko',
        name: 'Palenisko Dziedzińca',
        kind: 'campfire',
        x: 11,
        y: 10,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_brzezina_fire'
      },
      {
        id: 'brzezina_studnia',
        name: 'Studnia Szkolna',
        kind: 'slavic_well',
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
        id: 'brzezina_dab',
        name: 'Stary Dąb',
        kind: 'ancient_oak',
        x: 3,
        y: 5,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'brzezina_drogowskaz',
        name: 'Brama na Trakt do Wilczego Brodu',
        kind: 'travel_signpost',
        x: 12,
        y: 19,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'brzezina_kapliczka',
        name: 'Przydrożny Światowid',
        kind: 'slavic_shrine',
        x: 5,
        y: 16,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'brzezina_beczki',
        name: 'Beczki Kwatermistrza',
        kind: 'dungeon_barrel',
        x: 16,
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
        id: 'brzezina_plot_1',
        name: 'Płot wiklinowy',
        kind: 'wattle_fence',
        x: 6,
        y: 19,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'brzezina_kwiaty',
        name: 'Polne zioła',
        kind: 'wildflower_patch',
        x: 4,
        y: 10,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 0,
        blocksMovement: false,
        blocksSight: false,
        interactive: false
      }
    ],
    lights: [
      {
        id: 'light_brzezina_fire',
        x: 11.5,
        y: 10.5,
        z: 0.7,
        color: { r: 255, g: 168, b: 84 },
        intensity: 1.35,
        radius: 6.5,
        flickerSpeed: 4.5,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeNpc({
      id: 'npc_gnieworad',
      seed: 101,
      name: 'Mistrz Gnieworad',
      title: 'Mistrz Szkoły Ostrzy',
      x: 10,
      y: 6,
      z: tiles[6][10].z,
      torso: 'torso_warden_brigandine',
      cloak: 'cloak_forest_ranger',
      mainHand: 'weapon_iron_longsword'
    }),
    makeNpc({
      id: 'npc_radogost',
      seed: 102,
      name: 'Instruktor Radogost',
      title: 'Instruktor Szkolny',
      x: 10,
      y: 11,
      z: tiles[11][10].z,
      direction: 0,
      torso: 'torso_przeszywanica',
      mainHand: 'weapon_wooden_club',
      hostile: Boolean(opts?.sparingHostile),
      hp: 30,
      ap: 6,
      attack: 3,
      defense: 15,
      xpReward: 30
    }),
    makeNpc({
      id: 'npc_dobrogost',
      seed: 103,
      name: 'Kwatermistrz Dobrogost',
      title: 'Szkolny Kramarz',
      x: 15,
      y: 9,
      z: tiles[9][15].z,
      direction: 6,
      torso: 'torso_slavic_giezlo'
    }),
    makeNpc({
      id: 'npc_skarimir',
      seed: 104,
      name: 'Skarimir',
      title: 'Adept (Miecz)',
      x: 8,
      y: 16,
      z: tiles[16][8].z,
      mainHand: 'weapon_iron_longsword'
    }),
    makeNpc({
      id: 'npc_ragnoslawa',
      seed: 105,
      name: 'Ragnosława',
      title: 'Adeptka (Włócznia)',
      x: 13,
      y: 16,
      z: tiles[16][13].z,
      mainHand: 'weapon_spear_or_staff'
    }),
    makeNpc({
      id: 'npc_wojmir',
      seed: 106,
      name: 'Wojmir Cienki',
      title: 'Adept (Pióro i Włócznia)',
      x: 7,
      y: 17,
      z: tiles[17][7].z
    })
  ];

  if (opts?.withCourier) {
    actors.push(
      makeNpc({
        id: 'npc_kurier',
        seed: 107,
        name: 'Cesarski Kurier',
        title: 'Posłaniec w Czerwonym Płaszczu',
        x: 11,
        y: 8,
        z: tiles[8][11].z,
        cloak: 'cloak_crimson_mantle',
        torso: 'torso_warden_brigandine'
      })
    );
  }

  return {
    id: 'brzezina_dziedziniec',
    map,
    spawnX: 10,
    spawnY: 13,
    actors,
    ambientLightIntensity: 0.46,
    fogOfWarEnabled: false
  };
}

/**
 * Lokacja 2: Leśny Trakt — Dzień 1 (Zasadzka Bandytów i Ognisko)
 */
export function createTraktZasadzkaScene(): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isRoad = Math.abs(x - 12) <= 2;
    const isRidge = x <= 2 || x >= width - 3 || y === 0 || y === height - 1;
    return {
      z: isRidge ? 1 : 0,
      terrain: isRoad ? 'dirt_path' : isRidge ? 'forest_soil' : 'forest_grass',
      walkable: !isRidge || isRoad
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Leśny Trakt ku Wilczemu Brodowi',
    subtitle: 'Dzień 1: Zasadzka na gościńcu',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'trakt_ognisko',
        name: 'Obozowe Ognisko',
        kind: 'campfire',
        x: 10,
        y: 15,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_trakt_fire'
      },
      {
        id: 'trakt_kloda',
        name: 'Zwalony Pień',
        kind: 'fallen_log',
        x: 11,
        y: 10,
        z: 0,
        sizeX: 1,
        sizeY: 2,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'trakt_skala_1',
        name: 'Głaz przy Trakcie',
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
        id: 'trakt_sosna_1',
        name: 'Bór Pogórza',
        kind: 'pine_tree',
        x: 16,
        y: 7,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      }
    ],
    lights: [
      {
        id: 'light_trakt_fire',
        x: 10.5,
        y: 15.5,
        z: 0.7,
        color: { r: 255, g: 162, b: 78 },
        intensity: 1.25,
        radius: 6,
        flickerSpeed: 4,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeNpc({
      id: 'enemy_bandyta_1',
      seed: 201,
      name: 'Bandyta z Traktu',
      title: 'Zbir z gościńca',
      x: 11,
      y: 7,
      z: tiles[7][11].z,
      head: 'helm_shadow_hood',
      torso: 'torso_warden_brigandine',
      mainHand: 'weapon_slavic_axe',
      hostile: true,
      hp: 26,
      ap: 6,
      attack: 5,
      defense: 11,
      xpReward: 40
    }),
    makeNpc({
      id: 'enemy_bandyta_2',
      seed: 202,
      name: 'Bandyta Łupieżca',
      title: 'Zbir z gościńca',
      x: 13,
      y: 7,
      z: tiles[7][13].z,
      head: 'helm_ranger_cowl',
      torso: 'torso_przeszywanica',
      mainHand: 'weapon_Executioner_axe',
      hostile: true,
      hp: 26,
      ap: 6,
      attack: 5,
      defense: 11,
      xpReward: 40
    })
  ];

  return {
    id: 'trakt_zasadzka',
    map,
    spawnX: 12,
    spawnY: 16,
    actors,
    ambientLightIntensity: 0.38,
    fogOfWarEnabled: false
  };
}

/**
 * Lokacja 3: Uroczysko Nocą — Dzień 2 (Burza Iskier, Upiory Nocy i Istota)
 */
export function createUroczyskoNocScene(): CustomSceneConfig {
  const width = 22;
  const height = 22;
  const tiles = buildGrid(width, height, (x, y) => {
    const dist = Math.hypot(x - 10.5, y - 10.5);
    const isOuter = dist >= 9.5;
    return {
      z: isOuter ? 1 : 0,
      terrain: dist <= 4 ? 'dirt_path' : isOuter ? 'forest_soil' : 'forest_grass',
      walkable: !isOuter
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Uroczysko pod Burzą Iskier',
    subtitle: 'Dzień 2, Noc: Upiory Nocy i Przebudzenie',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'noc_ognisko',
        name: 'Wygasające Ognisko',
        kind: 'campfire',
        x: 10,
        y: 11,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false,
        linkedLightId: 'light_noc_fire'
      },
      {
        id: 'noc_krysztal_iskier',
        name: 'Rozbłysk Burzy Iskier',
        kind: 'arcane_crystal',
        x: 10,
        y: 5,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false,
        linkedLightId: 'light_noc_spark'
      },
      {
        id: 'noc_martwe_drzewo',
        name: 'Omalony Pień',
        kind: 'dead_tree',
        x: 6,
        y: 7,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      }
    ],
    lights: [
      {
        id: 'light_noc_fire',
        x: 10.5,
        y: 11.5,
        z: 0.6,
        color: { r: 225, g: 120, b: 60 },
        intensity: 0.75,
        radius: 4.5,
        flickerSpeed: 6,
        enabled: true
      },
      {
        id: 'light_noc_spark',
        x: 10.5,
        y: 5.5,
        z: 1.2,
        color: { r: 120, g: 185, b: 255 },
        intensity: 1.4,
        radius: 7,
        flickerSpeed: 8,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeNpc({
      id: 'enemy_upior_1',
      seed: 301,
      name: 'Upiór Nocy',
      title: 'Cień zza Burzy Iskier',
      x: 9,
      y: 8,
      z: tiles[8][9].z,
      head: 'helm_dread_plate',
      torso: 'torso_archmage_robes',
      cloak: 'cloak_crimson_mantle',
      mainHand: 'weapon_astral_staff',
      hostile: true,
      hp: 150,
      ap: 8,
      attack: 16,
      defense: 24,
      xpReward: 120
    }),
    makeNpc({
      id: 'enemy_upior_2',
      seed: 302,
      name: 'Upiór Nocy',
      title: 'Cień zza Burzy Iskier',
      x: 12,
      y: 8,
      z: tiles[8][12].z,
      head: 'helm_dread_plate',
      torso: 'torso_archmage_robes',
      cloak: 'cloak_crimson_mantle',
      mainHand: 'weapon_astral_staff',
      hostile: true,
      hp: 150,
      ap: 8,
      attack: 16,
      defense: 24,
      xpReward: 120
    })
  ];

  return {
    id: 'uroczysko_noc',
    map,
    spawnX: 10,
    spawnY: 13,
    actors,
    ambientLightIntensity: 0.16,
    fogOfWarEnabled: false
  };
}

/**
 * Lokacja 4: Pobojowisko o Świcie i Rozdroże przed Wilczym Brodem
 */
export function createPobojowiskoSwitScene(): CustomSceneConfig {
  const width = 22;
  const height = 22;
  const tiles = buildGrid(width, height, (x, y) => {
    const isCrossroad = Math.abs(x - 11) <= 1 || Math.abs(y - 11) <= 1;
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    return {
      z: isBorder ? 1 : 0,
      terrain: isCrossroad ? 'dirt_path' : isBorder ? 'forest_soil' : 'forest_grass',
      walkable: !isBorder || isCrossroad
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Pobojowisko i Rozdroże',
    subtitle: 'Świt po Nocy Upiorów — Wybór Drogi',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'rozdroze_drogowskaz',
        name: 'Drogowskaz: Wilczy Bród / Stolica',
        kind: 'travel_signpost',
        x: 12,
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
        id: 'rozdroze_plecak',
        name: 'Porzucony Tobół Przewodnika',
        kind: 'ground_loot',
        x: 9,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      }
    ],
    lights: []
  };

  return {
    id: 'pobojowisko_swit',
    map,
    spawnX: 11,
    spawnY: 13,
    actors: [
      makeNpc({
        id: 'npc_pobojowisko_slad',
        seed: 350,
        name: 'Polegli Towarzysze i Tobół',
        title: 'Zbadaj pobojowisko o świcie',
        x: 9,
        y: 12,
        z: tiles[12][9].z,
        torso: 'torso_slavic_giezlo',
        cloak: 'cloak_forest_ranger'
      }),
      makeNpc({
        id: 'npc_rozdroze_szlak',
        seed: 351,
        name: 'Rozdroże ku Wilczemu Brodowi',
        title: 'Wybierz dalszą drogę',
        x: 12,
        y: 10,
        z: tiles[10][12].z,
        torso: 'torso_przeszywanica',
        head: 'helm_shadow_hood'
      })
    ],
    ambientLightIntensity: 0.34,
    fogOfWarEnabled: false
  };
}

/**
 * Spawns the mysterious Entity (Istota) in Uroczysko Nocą after Night of Wraiths.
 */
export function createIstotaActor(z: number): ActorEntity {
  return makeNpc({
    id: 'npc_istota',
    seed: 399,
    name: 'Istota zza Gwiazd',
    title: 'Postać o twarzy z czarnego szkła',
    x: 10,
    y: 9,
    z,
    direction: 4,
    head: 'helm_arcane_circlet',
    torso: 'torso_aethel_plate',
    cloak: 'cloak_crimson_mantle',
    mainHand: 'weapon_astral_staff'
  });
}

/**
 * Spawns Skarimir at the Trakt campfire after bandits are cleared.
 */
export function createTraktCampfireActor(z: number): ActorEntity {
  return makeNpc({
    id: 'npc_trakt_ognisko',
    seed: 104,
    name: 'Skarimir i Drużyna przy Ognisku',
    title: 'Odpoczynek po zasadzce',
    x: 11,
    y: 15,
    z,
    direction: 4,
    torso: 'torso_przeszywanica',
    mainHand: 'weapon_iron_longsword'
  });
}
