import { generateRandomCharacterRecipe } from '@ulf/assets/characterBakery';
import { IsometricWorldMap, MapId, TileCell, TileTerrainType } from '@ulf/core/worldMap';
import { createDefaultProficiencies } from '@ulf/rpg/combatSystem';
import { ActorEntity } from '@ulf/rpg/gameLoop';
import type { CustomSceneConfig } from '../../engine-bridge/OstrzeEngineState';
import { organicPatchNoise } from './terrainNoise';
import { applyWorldDressing } from './worldDressing';

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

function makeChapter2Npc(opts: {
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
  difficulty?: 'easy' | 'normal' | 'very_hard';
  hp?: number;
  ap?: number;
  xpReward?: number;
  dialogueId?: string;
}): ActorEntity {
  const recipe = generateRandomCharacterRecipe(opts.seed, opts.id);
  recipe.id = opts.id;
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
    const hp = opts.hp ?? 26;
    const ap = opts.ap ?? 6;
    actor.combat = {
      hp,
      maxHp: hp,
      ap,
      maxAp: ap,
      proficiencies: createDefaultProficiencies(),
      isHostile: true,
      isAlive: true,
      xpReward: opts.xpReward ?? 40,
      lootTable: [],
      difficulty: opts.difficulty ?? 'normal',
      aggroRadius: 14,
      dazedHeadTurns: 0,
      crippledLegsTurns: 0,
      defending: false
    };
  }

  return actor;
}

/**
 * Dedicated quadruped wolf builder — guarantees custom wolf sprite baking
 * (`isWolfRecipe` + `resolveCharacterArchetypeTag === 'wilk'`) with ZERO human gear.
 */
function makeWolfActor(opts: {
  id: string;
  seed: number;
  name: string;
  x: number;
  y: number;
  z: number;
  hp?: number;
  xpReward?: number;
  difficulty?: 'easy' | 'normal' | 'very_hard';
}): ActorEntity {
  const recipe = generateRandomCharacterRecipe(opts.seed, opts.id);
  recipe.id = opts.id;
  recipe.name = opts.name;
  recipe.title = 'Wataha Starego Traktu';
  recipe.equipment = {
    head: null,
    torso: 'torso_przeszywanica',
    cloak: null,
    legs: 'legs_leather_boots',
    mainHand: null,
    offHand: null
  };
  const hp = opts.hp ?? 18;
  return {
    id: opts.id,
    recipe,
    x: opts.x + 0.5,
    y: opts.y + 0.5,
    z: opts.z,
    tileX: opts.x,
    tileY: opts.y,
    direction: 4,
    isMoving: false,
    animFrame: 0,
    animTimer: 0,
    path: [],
    combat: {
      hp,
      maxHp: hp,
      ap: 6,
      maxAp: 6,
      proficiencies: createDefaultProficiencies(),
      isHostile: true,
      isAlive: true,
      xpReward: opts.xpReward ?? 30,
      lootTable: [],
      difficulty: opts.difficulty ?? 'normal',
      aggroRadius: 14,
      dazedHeadTurns: 0,
      crippledLegsTurns: 0,
      defending: false
    }
  };
}

/**
 * Akt II — Hub: Osada Głuszec (28x28)
 */
export function createGluszecScene(): CustomSceneConfig {
  const width = 28;
  const height = 28;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isSouthExit = x >= 13 && x <= 14 && y === height - 1;
    const isMainRoad = (x >= 13 && x <= 14) || (y >= 13 && y <= 14 && x >= 4 && x <= 23);
    const isSquare = Math.hypot(x - 13.5, y - 13.5) <= 3.2;
    const isInnerEdge = x === 1 || y === 1 || x === width - 2 || y === height - 2;
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isSouthExit };
    }
    const isDirt = isMainRoad || isSquare;
    return {
      z: 0,
      terrain: isDirt
        ? 'dirt_path'
        : isInnerEdge && organicPatchNoise(x, y, 5) > 0.05
          ? 'forest_soil'
          : 'forest_grass',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'slavic_village' as MapId,
    name: 'Osada Głuszec',
    subtitle: 'Akt II: Leśna Osada za Kamienną Przełęczą',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'gluszec_dom_soltysa',
        name: 'Dom Sołtysa',
        kind: 'slavic_cottage',
        variant: 1,
        x: 11,
        y: 3,
        z: 0,
        sizeX: 3,
        sizeY: 2,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'gluszec_karczma',
        name: 'Karczma „Pod Zdechłym Kogutem” (Izba)',
        kind: 'slavic_cottage',
        variant: 12,
        x: 4,
        y: 7,
        z: 0,
        sizeX: 3,
        sizeY: 2,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: true
      },
      {
        id: 'gluszec_kuznia',
        name: 'Kuźnia Bogdana',
        kind: 'slavic_cottage',
        variant: 4,
        x: 20,
        y: 16,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: true
      },
      {
        id: 'gluszec_kramy',
        name: 'Kramy wędrownych handlarzy',
        kind: 'market_stall',
        x: 19,
        y: 9,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'gluszec_znachorka_szalas',
        name: 'Szałas Znachorki',
        kind: 'slavic_cottage',
        variant: 0,
        x: 4,
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
        id: 'gluszec_tablica',
        name: 'Tablica Ogłoszeń w Głuszcu',
        kind: 'travel_signpost',
        x: 11,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'gluszec_ognisko',
        name: 'Ognisko na placu osady',
        kind: 'campfire',
        x: 14,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_gluszec_fire'
      },
      {
        id: 'gluszec_studnia',
        name: 'Studnia w Głuszcu',
        kind: 'slavic_well',
        x: 15,
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
        id: 'gluszec_kapliczka_cmentarz',
        name: 'Cmentarz i kapliczka (Echo z kamieni)',
        kind: 'travel_signpost',
        x: 22,
        y: 4,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'gluszec_drogowskaz',
        name: '🚪 Brama na Okolice Głuszca (Podróż)',
        kind: 'exit_path',
        x: 13,
        y: 25,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'gluszec_brama_l',
        name: 'Pochodnia przy bramie',
        kind: 'torch_sconce',
        x: 12,
        y: 25,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false,
        linkedLightId: 'light_gluszec_gate_l'
      },
      {
        id: 'gluszec_brama_p',
        name: 'Pochodnia przy bramie',
        kind: 'torch_sconce',
        x: 15,
        y: 25,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false,
        linkedLightId: 'light_gluszec_gate_r'
      },
      {
        id: 'gluszec_latarnia_karczma',
        name: 'Pochodnia przed karczmą',
        kind: 'torch_sconce',
        x: 7,
        y: 9,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false,
        linkedLightId: 'light_gluszec_inn'
      },
      {
        id: 'gluszec_latarnia_kuznia',
        name: 'Pochodnia przy kuźni Bogdana',
        kind: 'torch_sconce',
        x: 19,
        y: 16,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false,
        linkedLightId: 'light_gluszec_smithy'
      },
      {
        id: 'gluszec_dab_plac',
        name: 'Stara Brzoza na skraju Głuszca',
        kind: 'ancient_oak',
        x: 22,
        y: 20,
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
        id: 'light_gluszec_fire',
        x: 14,
        y: 12,
        z: 0.7,
        color: { r: 255, g: 160, b: 78 },
        intensity: 1.45,
        radius: 7,
        flickerSpeed: 4.1,
        enabled: true
      },
      {
        id: 'light_gluszec_inn',
        x: 7,
        y: 9,
        z: 1.1,
        color: { r: 255, g: 175, b: 92 },
        intensity: 1.15,
        radius: 5.5,
        flickerSpeed: 3.1,
        enabled: true
      },
      {
        id: 'light_gluszec_smithy',
        x: 19,
        y: 16,
        z: 1.0,
        color: { r: 255, g: 138, b: 64 },
        intensity: 1.15,
        radius: 5.0,
        flickerSpeed: 3.6,
        enabled: true
      },
      {
        id: 'light_gluszec_gate_l',
        x: 12,
        y: 25,
        z: 1.0,
        color: { r: 255, g: 168, b: 84 },
        intensity: 1.05,
        radius: 4.5,
        flickerSpeed: 3.8,
        enabled: true
      },
      {
        id: 'light_gluszec_gate_r',
        x: 15,
        y: 25,
        z: 1.0,
        color: { r: 255, g: 168, b: 84 },
        intensity: 1.05,
        radius: 4.5,
        flickerSpeed: 3.8,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapter2Npc({
      id: 'npc_soltys_gluszec',
      seed: 2101,
      name: 'Sołtys (Starosta Głuszca)',
      title: 'Sołtys Osady Głuszec',
      x: 13,
      y: 7,
      z: 0,
      direction: 4,
      torso: 'torso_warden_brigandine',
      cloak: 'cloak_forest',
      dialogueId: 'soltys'
    }),
    makeChapter2Npc({
      id: 'npc_karczmarz_kogut',
      seed: 2102,
      name: 'Karczmarz z Koguta',
      title: 'Karczma „Pod Zdechłym Kogutem”',
      x: 8,
      y: 10,
      z: 0,
      direction: 2,
      torso: 'torso_przeszywanica',
      dialogueId: 'karczmarz_kogut'
    }),
    makeChapter2Npc({
      id: 'npc_najemnik_kogut',
      seed: 2103,
      name: 'Najemnik (Strażnik najemny)',
      title: 'Bywalec karczmy',
      x: 7,
      y: 12,
      z: 0,
      direction: 3,
      torso: 'torso_warden_brigandine',
      mainHand: 'weapon_iron_longsword',
      dialogueId: 'najemnik'
    }),
    makeChapter2Npc({
      id: 'npc_kramarz_gluszec',
      seed: 2104,
      name: 'Kramarz Wędrowny',
      title: 'Kramy w Głuszcu',
      x: 18,
      y: 11,
      z: 0,
      direction: 6,
      torso: 'torso_przeszywanica',
      dialogueId: 'npc_kramarz_gluszec'
    }),
    makeChapter2Npc({
      id: 'npc_kowal_bogdan',
      seed: 2105,
      name: 'Kowal Bogdan',
      title: 'Kuźnia w Głuszcu',
      x: 19,
      y: 17,
      z: 0,
      direction: 6,
      torso: 'torso_przeszywanica',
      dialogueId: 'kowal_gluszec'
    }),
    makeChapter2Npc({
      id: 'npc_zielarka_znachorka',
      seed: 2106,
      name: 'Znachorka Zielarka',
      title: 'Szałas na skraju osady',
      x: 7,
      y: 19,
      z: 0,
      direction: 2,
      torso: 'torso_przeszywanica',
      dialogueId: 'znachorka'
    }),
    makeChapter2Npc({
      id: 'npc_wartownik_gajowy',
      seed: 2107,
      name: 'Gajowy (Strażnik Boru)',
      title: 'Gajówka przy bramie',
      x: 11,
      y: 23,
      z: 0,
      direction: 3,
      torso: 'torso_warden_brigandine',
      cloak: 'cloak_forest',
      dialogueId: 'gajowy'
    }),
    makeChapter2Npc({
      id: 'npc_kopacz_jerzy',
      seed: 2108,
      name: 'Kopacz Jerzy (Kmieć)',
      title: 'Cmentarz w Głuszcu',
      x: 21,
      y: 6,
      z: 0,
      direction: 5,
      torso: 'torso_przeszywanica',
      dialogueId: 'kopacz'
    }),
    makeChapter2Npc({
      id: 'npc_zona_wdowa_jaga',
      seed: 2109,
      name: 'Wdowa Jaga (Żona strażnika)',
      title: 'Mieszkanka Głuszca',
      x: 17,
      y: 17,
      z: 0,
      direction: 5,
      torso: 'torso_przeszywanica',
      dialogueId: 'wdowa'
    }),
    makeChapter2Npc({
      id: 'npc_mlynarz_radosz',
      seed: 2110,
      name: 'Młynarz Radosz',
      title: 'Młyn wodny w Głuszcu',
      x: 22,
      y: 21,
      z: 0,
      direction: 6,
      torso: 'torso_przeszywanica',
      dialogueId: 'radosz'
    })
  ];

  applyWorldDressing(map, {
    seed: 20262,
    spawnX: 13,
    spawnY: 22,
    actors,
    reservedPoints: [
      { x: 13, y: 24, radius: 1 },
      { x: 14, y: 24, radius: 1 },
      { x: 13, y: 25, radius: 1 },
      { x: 14, y: 25, radius: 1 },
      { x: 13, y: 26, radius: 1 },
      { x: 14, y: 26, radius: 1 }
    ],
    forestSides: ['W', 'N', 'E'],
    beltDepth: 2
  });

  return {
    id: 'gluszec',
    map,
    spawnX: 13,
    spawnY: 22,
    actors,
    ambientLightIntensity: 0.78,
    fogOfWarEnabled: false,
    introLog: '🏘️ Osada Głuszec — leśna osada za Kamienną Przełęczą.'
  };
}

/**
 * Akt II — Satelita 1: Bór Kłusowników (24x24)
 */
export function createBorKlusownikowScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isExit = x >= 11 && x <= 12 && y === height - 1;
    const isTrail = x >= 11 && x <= 12 && y >= 5;
    const isClearing = Math.hypot(x - 12, y - 9) <= 4.2;
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isExit };
    }
    return {
      z: 0,
      terrain: isTrail || isClearing ? 'dirt_path' : 'forest_grass',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Bór Kłusowników',
    subtitle: 'Akt II: Polana z sidłami i obóz maruderów',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'bor_namiot_obozu',
        name: 'Namiot maruderów',
        kind: 'ranger_tent',
        x: 11,
        y: 4,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'bor_ognisko_obozu',
        name: 'Ognisko obozu maruderów',
        kind: 'campfire',
        x: 12,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_bor_camp'
      },
      {
        id: 'bor_sidla_polana',
        name: 'Polana z sidłami kłusowników',
        kind: 'dungeon_crate',
        x: 8,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'bor_drogowskaz',
        name: '🚪 Powrót do Głuszca',
        kind: 'exit_path',
        x: 11,
        y: 21,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      }
    ],
    lights: [
      {
        id: 'light_bor_camp',
        x: 12,
        y: 8,
        z: 0.7,
        color: { r: 255, g: 158, b: 74 },
        intensity: 1.3,
        radius: 6,
        flickerSpeed: 4.0,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapter2Npc({
      id: 'npc_stach_bor',
      seed: 2201,
      name: 'Kłusownik Stach (Drwal)',
      title: 'Kłusownik z boru',
      x: 9,
      y: 13,
      z: 0,
      direction: 3,
      torso: 'torso_przeszywanica',
      cloak: 'cloak_forest',
      dialogueId: 'stach'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeChapter2Npc({
        id: 'enemy_bor_klusownik_1',
        seed: 2211,
        name: 'Kłusownik Łucznik',
        title: 'Strzelec z boru',
        x: 9,
        y: 7,
        z: 0,
        direction: 4,
        torso: 'torso_przeszywanica',
        head: 'helm_shadow_hood',
        mainHand: 'weapon_hunting_bow',
        hostile: true,
        hp: 22,
        ap: 6,
        xpReward: 40
      }),
      makeChapter2Npc({
        id: 'enemy_bor_klusownik_2',
        seed: 2212,
        name: 'Kłusownik Łucznik',
        title: 'Strzelec z boru',
        x: 15,
        y: 7,
        z: 0,
        direction: 4,
        torso: 'torso_przeszywanica',
        head: 'helm_shadow_hood',
        mainHand: 'weapon_hunting_bow',
        hostile: true,
        hp: 22,
        ap: 6,
        xpReward: 40
      }),
      makeChapter2Npc({
        id: 'enemy_bor_herszt',
        seed: 2213,
        name: 'Herszt Zbójców',
        title: 'Dowódca obozu maruderów',
        x: 12,
        y: 6,
        z: 0,
        direction: 4,
        torso: 'torso_slavic_lamellar',
        head: 'helm_szyszak',
        cloak: 'cloak_crimson',
        mainHand: 'weapon_slavic_axe',
        offHand: 'offhand_slavic_shield',
        hostile: true,
        difficulty: 'very_hard',
        hp: 58,
        ap: 7,
        xpReward: 95
      })
    );
  }

  applyWorldDressing(map, {
    seed: 20263,
    spawnX: 11,
    spawnY: 19,
    actors,
    reservedPoints: [
      { x: 11, y: 21, radius: 1 },
      { x: 12, y: 21, radius: 1 },
      { x: 12, y: 8, radius: 3 }
    ],
    forestSides: ['W', 'N', 'E'],
    beltDepth: 2
  });

  return {
    id: 'bor_klusownikow',
    map,
    spawnX: 11,
    spawnY: 19,
    actors,
    ambientLightIntensity: 0.72,
    fogOfWarEnabled: false
  };
}

/**
 * Akt II — Satelita 2: Stary Trakt (24x24)
 */
export function createStaryTraktScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isExit = x >= 11 && x <= 12 && y === height - 1;
    const isRoad = x >= 10 && x <= 13;
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isExit };
    }
    return {
      z: 0,
      terrain: isRoad ? 'dirt_path' : 'forest_grass',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Stary Trakt',
    subtitle: 'Akt II: Zarośnięty gościniec i wąwóz zaginionej karawany',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'stary_trakt_rozbity_woz',
        name: 'Rozbity wóz karawany',
        kind: 'market_stall',
        x: 10,
        y: 6,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'stary_trakt_sakwa',
        name: 'Sakwa pod mostkiem',
        kind: 'dungeon_crate',
        x: 15,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'stary_trakt_drogowskaz',
        name: '🚪 Powrót do Głuszca',
        kind: 'exit_path',
        x: 11,
        y: 21,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      }
    ],
    lights: []
  };

  const actors: ActorEntity[] = [
    makeChapter2Npc({
      id: 'npc_furman_sieciech',
      seed: 2301,
      name: 'Furman Sieciech (Kupiec)',
      title: 'Ocalały woźnica',
      x: 13,
      y: 15,
      z: 0,
      direction: 6,
      torso: 'torso_przeszywanica',
      dialogueId: 'furman'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeWolfActor({
        id: 'enemy_wilk_trakt_1',
        seed: 2311,
        name: 'Wilk leśny',
        x: 9,
        y: 9,
        z: 0,
        hp: 16,
        xpReward: 25
      }),
      makeWolfActor({
        id: 'enemy_wilk_trakt_2',
        seed: 2312,
        name: 'Wilk leśny',
        x: 14,
        y: 9,
        z: 0,
        hp: 16,
        xpReward: 25
      }),
      makeWolfActor({
        id: 'enemy_wilk_trakt_basior',
        seed: 2313,
        name: 'Basior Starego Traktu',
        x: 11,
        y: 8,
        z: 0,
        hp: 26,
        xpReward: 40
      })
    );
  }

  applyWorldDressing(map, {
    seed: 20264,
    spawnX: 11,
    spawnY: 19,
    actors,
    reservedPoints: [
      { x: 11, y: 21, radius: 1 },
      { x: 12, y: 21, radius: 1 },
      { x: 11, y: 8, radius: 3 }
    ],
    forestSides: ['W', 'N', 'E'],
    beltDepth: 2
  });

  return {
    id: 'stary_trakt',
    map,
    spawnX: 11,
    spawnY: 19,
    actors,
    ambientLightIntensity: 0.74,
    fogOfWarEnabled: false
  };
}

/**
 * Dedicated swamp monster builder — guarantees `utopiec` monster sprite with ZERO human gear.
 */
function makeUtopiecActor(opts: {
  id: string;
  seed: number;
  name: string;
  x: number;
  y: number;
  z: number;
  hp?: number;
  xpReward?: number;
  difficulty?: 'easy' | 'normal' | 'very_hard';
}): ActorEntity {
  const recipe = generateRandomCharacterRecipe(opts.seed, opts.id);
  recipe.id = opts.id;
  recipe.name = opts.name;
  recipe.title = 'Potwór z Bagien Szarej Wody';
  recipe.equipment = {
    head: null,
    torso: 'torso_przeszywanica',
    cloak: null,
    legs: 'legs_leather_boots',
    mainHand: null,
    offHand: null
  };
  const hp = opts.hp ?? 28;
  return {
    id: opts.id,
    recipe,
    x: opts.x + 0.5,
    y: opts.y + 0.5,
    z: opts.z,
    tileX: opts.x,
    tileY: opts.y,
    direction: 4,
    isMoving: false,
    animFrame: 0,
    animTimer: 0,
    path: [],
    combat: {
      hp,
      maxHp: hp,
      ap: 6,
      maxAp: 6,
      proficiencies: createDefaultProficiencies(),
      isHostile: true,
      isAlive: true,
      xpReward: opts.xpReward ?? 45,
      lootTable: [],
      difficulty: opts.difficulty ?? 'normal',
      aggroRadius: 14,
      dazedHeadTurns: 0,
      crippledLegsTurns: 0,
      defending: false
    }
  };
}

/**
 * Akt II — Satelita 3: Kapliczka na Rozstajach (24x24)
 */
export function createKapliczkaRozstajeScene(): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isExit = x >= 11 && x <= 12 && y === height - 1;
    const isCross = (x >= 11 && x <= 12) || (y >= 11 && y <= 12 && x >= 4 && x <= 19);
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isExit };
    }
    return {
      z: 0,
      terrain: isCross ? 'dirt_path' : 'forest_grass',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Kapliczka na Rozstajach',
    subtitle: 'Akt II: Cicha kapliczka, Siostra Halina i Pustelnik',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'kapliczka_oltarz',
        name: 'Kapliczka na Rozstajach',
        kind: 'travel_signpost',
        x: 11,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'kapliczka_skrzynka',
        name: 'Skrzynka ofiarna przy kapliczce',
        kind: 'dungeon_crate',
        x: 13,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'kapliczka_drogowskaz',
        name: '🚪 Powrót do Głuszca',
        kind: 'exit_path',
        x: 11,
        y: 21,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'kapliczka_pochodnia',
        name: 'Latarnia wotywna przy kapliczce',
        kind: 'torch_sconce',
        x: 10,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false,
        linkedLightId: 'light_kapliczka_shrine'
      },
      {
        id: 'kapliczka_dab_w',
        name: 'Stara Brzoza nad Rozstajami',
        kind: 'ancient_oak',
        x: 6,
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
        id: 'kapliczka_dab_e',
        name: 'Stara Brzoza nad Rozstajami',
        kind: 'ancient_oak',
        x: 17,
        y: 6,
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
        id: 'light_kapliczka_shrine',
        x: 11,
        y: 8,
        z: 1.1,
        color: { r: 255, g: 198, b: 120 },
        intensity: 1.2,
        radius: 6,
        flickerSpeed: 2.4,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapter2Npc({
      id: 'npc_halina_kapliczka',
      seed: 2401,
      name: 'Siostra Halina (Zielarka)',
      title: 'Opiekunka kapliczki',
      x: 10,
      y: 10,
      z: 0,
      direction: 3,
      torso: 'torso_przeszywanica',
      dialogueId: 'halina'
    }),
    makeChapter2Npc({
      id: 'npc_pustelnik_rozstaje',
      seed: 2402,
      name: 'Pustelnik (Pielgrzym)',
      title: 'Wędrowiec spod kapliczki',
      x: 14,
      y: 10,
      z: 0,
      direction: 5,
      torso: 'torso_przeszywanica',
      cloak: 'cloak_forest',
      dialogueId: 'pisarz'
    })
  ];

  applyWorldDressing(map, {
    seed: 20265,
    spawnX: 11,
    spawnY: 19,
    actors,
    reservedPoints: [
      { x: 11, y: 21, radius: 1 },
      { x: 12, y: 21, radius: 1 },
      { x: 12, y: 9, radius: 3 }
    ],
    forestSides: ['W', 'N', 'E'],
    beltDepth: 2
  });

  return {
    id: 'kapliczka_rozstaje',
    map,
    spawnX: 11,
    spawnY: 19,
    actors,
    ambientLightIntensity: 0.82,
    fogOfWarEnabled: false
  };
}

/**
 * Akt II — Satelita 4: Kamieniołom (24x24)
 */
export function createKamieniolomScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isExit = x >= 11 && x <= 12 && y === height - 1;
    const isPit = Math.hypot(x - 12, y - 10) <= 5.5;
    const isRoad = x >= 11 && x <= 12 && y >= 10;
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isExit };
    }
    return {
      z: 0,
      terrain: isPit || isRoad ? 'dirt_path' : 'forest_soil',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Kamieniołom',
    subtitle: 'Akt II: Sztolnia, Dozorca Wincenty i ranny górnik',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'kamieniolom_sztolnia',
        name: 'Wejście do sztolni (ognisko górników)',
        kind: 'campfire',
        x: 12,
        y: 6,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_kamieniolom_fire'
      },
      {
        id: 'kamieniolom_drogowskaz',
        name: '🚪 Powrót do Głuszca',
        kind: 'exit_path',
        x: 11,
        y: 21,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'kamieniolom_wejscie_sztolni',
        name: 'Wejście do sztolni kamieniołomu',
        kind: 'rock_cliff',
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
        id: 'kamieniolom_namiot_gornikow',
        name: 'Namiot górników',
        kind: 'ranger_tent',
        x: 5,
        y: 13,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      }
    ],
    lights: [
      {
        id: 'light_kamieniolom_fire',
        x: 12,
        y: 6,
        z: 0.7,
        color: { r: 255, g: 165, b: 80 },
        intensity: 1.35,
        radius: 6,
        flickerSpeed: 3.9,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapter2Npc({
      id: 'npc_dozorca_wincenty',
      seed: 2501,
      name: 'Dozorca Wincenty (Strażnik)',
      title: 'Dozorca kamieniołomu',
      x: 9,
      y: 13,
      z: 0,
      direction: 2,
      torso: 'torso_warden_brigandine',
      dialogueId: 'dozorca'
    }),
    makeChapter2Npc({
      id: 'npc_ranny_gornik',
      seed: 2502,
      name: 'Ranny Górnik (Kmieć)',
      title: 'Ocalały ze sztolni',
      x: 14,
      y: 9,
      z: 0,
      direction: 5,
      torso: 'torso_przeszywanica',
      dialogueId: 'ranny'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeChapter2Npc({
        id: 'enemy_kamieniolom_maruder_1',
        seed: 2511,
        name: 'Maruder ze Sztolni',
        title: 'Grabieżca kamieniołomu',
        x: 10,
        y: 7,
        z: 0,
        direction: 4,
        torso: 'torso_warden_brigandine',
        head: 'helm_shadow_hood',
        mainHand: 'weapon_slavic_axe',
        hostile: true,
        hp: 26,
        ap: 6,
        xpReward: 40
      }),
      makeChapter2Npc({
        id: 'enemy_kamieniolom_lucznik',
        seed: 2512,
        name: 'Kłusownik Łucznik',
        title: 'Strzelec na skalnej półce',
        x: 14,
        y: 6,
        z: 0,
        direction: 4,
        torso: 'torso_przeszywanica',
        head: 'helm_shadow_hood',
        mainHand: 'weapon_hunting_bow',
        hostile: true,
        hp: 22,
        ap: 6,
        xpReward: 40
      })
    );
  }

  applyWorldDressing(map, {
    seed: 20266,
    spawnX: 11,
    spawnY: 19,
    actors,
    reservedPoints: [
      { x: 11, y: 21, radius: 1 },
      { x: 12, y: 21, radius: 1 },
      { x: 12, y: 8, radius: 4 }
    ],
    forestSides: ['W', 'N', 'E'],
    beltDepth: 2
  });

  return {
    id: 'kamieniolom',
    map,
    spawnX: 11,
    spawnY: 19,
    actors,
    ambientLightIntensity: 0.68,
    fogOfWarEnabled: false
  };
}

/**
 * Akt II — Satelita 5: Bagna Szarej Wody (24x24)
 */
export function createBagnaSzarejWodyScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isExit = x >= 11 && x <= 12 && y === height - 1;
    const isCauseway = x >= 10 && x <= 13;
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isExit };
    }
    return {
      z: 0,
      terrain: isCauseway ? 'dirt_path' : 'forest_soil',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Bagna Szarej Wody',
    subtitle: 'Akt II: Zbutwiała grobla, szara trzcina i topiel z utopcami',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'bagna_trzcinowisko',
        name: 'Trzcinowisko (Szara trzcina)',
        kind: 'wildflower_patch',
        x: 8,
        y: 12,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'bagna_topiel',
        name: 'Topiel (legowisko utopców)',
        kind: 'campfire',
        x: 12,
        y: 7,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_bagna_wisp'
      },
      {
        id: 'bagna_drogowskaz',
        name: '🚪 Powrót do Głuszca',
        kind: 'exit_path',
        x: 11,
        y: 21,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'bagna_szalas_zielarki',
        name: 'Szałas Bagiennej Zielarki',
        kind: 'slavic_cottage',
        x: 5,
        y: 15,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'bagna_martwe_drzewo_1',
        name: 'Zbutwiała wierzba nad topielą',
        kind: 'dead_tree',
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
        id: 'bagna_martwe_drzewo_2',
        name: 'Suchy pień na moczarach',
        kind: 'dead_tree',
        x: 17,
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
        id: 'bagna_martwe_drzewo_3',
        name: 'Obumarła olsza',
        kind: 'dead_tree',
        x: 16,
        y: 15,
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
        id: 'light_bagna_wisp',
        x: 12,
        y: 7,
        z: 0.8,
        color: { r: 110, g: 225, b: 195 },
        intensity: 1.25,
        radius: 5.5,
        flickerSpeed: 2.6,
        enabled: true
      },
      {
        id: 'light_bagna_wisp_2',
        x: 7,
        y: 12,
        z: 0.7,
        color: { r: 105, g: 210, b: 185 },
        intensity: 0.95,
        radius: 4.5,
        flickerSpeed: 2.1,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapter2Npc({
      id: 'npc_zielarka_bagna',
      seed: 2601,
      name: 'Bagienna Zielarka',
      title: 'Szałas na skraju moczarów',
      x: 9,
      y: 16,
      z: 0,
      direction: 2,
      torso: 'torso_przeszywanica',
      dialogueId: 'znachorka'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeUtopiecActor({
        id: 'enemy_bagna_utopiec_1',
        seed: 2611,
        name: 'Utopiec z Topieli',
        x: 9,
        y: 8,
        z: 0,
        hp: 26,
        xpReward: 40
      }),
      makeUtopiecActor({
        id: 'enemy_bagna_utopiec_2',
        seed: 2612,
        name: 'Utopiec z Topieli',
        x: 14,
        y: 8,
        z: 0,
        hp: 26,
        xpReward: 40
      }),
      makeUtopiecActor({
        id: 'enemy_bagna_utopiec_boss',
        seed: 2613,
        name: 'Pradawny Topielec',
        x: 12,
        y: 6,
        z: 0,
        hp: 46,
        xpReward: 75,
        difficulty: 'very_hard'
      })
    );
  }

  applyWorldDressing(map, {
    seed: 20267,
    spawnX: 11,
    spawnY: 19,
    actors,
    reservedPoints: [
      { x: 11, y: 21, radius: 1 },
      { x: 12, y: 21, radius: 1 },
      { x: 12, y: 8, radius: 4 }
    ],
    forestSides: ['W', 'N', 'E'],
    beltDepth: 2
  });

  return {
    id: 'bagna_szarej_wody',
    map,
    spawnX: 11,
    spawnY: 19,
    actors,
    ambientLightIntensity: 0.6,
    fogOfWarEnabled: false
  };
}

/**
 * Akt II — Satelita 6 & Finał Obławy: Wzgórze Wartownicze (24x24)
 */
export function createWzgorzeWartowniczeScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isExit = x >= 11 && x <= 12 && y === height - 1;
    const isRidge = Math.hypot(x - 12, y - 9) <= 4.5;
    const isPath = x >= 11 && x <= 12 && y >= 9;
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isExit };
    }
    return {
      z: 0,
      terrain: isRidge || isPath ? 'dirt_path' : 'forest_grass',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Wzgórze Wartownicze',
    subtitle: 'Akt II: Punkt zwiadowczy i finał Cesarskiej Obławy',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'wzgorze_wieza',
        name: 'Stara wieża wartownicza (Finał Obławy)',
        kind: 'watchtower',
        x: 11,
        y: 4,
        z: 0,
        sizeX: 2,
        sizeY: 2,
        heightZ: 4,
        blocksMovement: true,
        blocksSight: true,
        interactive: true
      },
      {
        id: 'wzgorze_drogowskaz',
        name: '🚪 Powrót do Głuszca',
        kind: 'exit_path',
        x: 11,
        y: 21,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      }
    ],
    lights: []
  };

  const actors: ActorEntity[] = [
    makeChapter2Npc({
      id: 'npc_pasterz_wzgorze',
      seed: 2701,
      name: 'Stary Pasterz (Kmieć)',
      title: 'Świadek ze wzgórza',
      x: 9,
      y: 15,
      z: 0,
      direction: 2,
      torso: 'torso_przeszywanica',
      dialogueId: 'kontrola'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeChapter2Npc({
        id: 'enemy_oblawa_zwiadowca_1',
        seed: 2711,
        name: 'Cesarski Zwiadowca Łucznik',
        title: 'Obława Cesarska',
        x: 9,
        y: 8,
        z: 0,
        direction: 4,
        torso: 'torso_warden_brigandine',
        head: 'helm_shadow_hood',
        mainHand: 'weapon_hunting_bow',
        hostile: true,
        hp: 26,
        ap: 6,
        xpReward: 45
      }),
      makeChapter2Npc({
        id: 'enemy_oblawa_zwiadowca_2',
        seed: 2712,
        name: 'Cesarski Strażnik Obławy',
        title: 'Obława Cesarska',
        x: 14,
        y: 8,
        z: 0,
        direction: 4,
        torso: 'torso_warden_brigandine',
        head: 'helm_szyszak',
        mainHand: 'weapon_iron_longsword',
        offHand: 'offhand_slavic_shield',
        hostile: true,
        hp: 32,
        ap: 6,
        xpReward: 50
      }),
      makeChapter2Npc({
        id: 'enemy_oblawa_dowodca',
        seed: 2713,
        name: 'Herszt Dowódca Obławy',
        title: 'Oficer Cesarskiej Obławy',
        x: 12,
        y: 7,
        z: 0,
        direction: 4,
        torso: 'torso_slavic_lamellar',
        head: 'helm_szyszak',
        cloak: 'cloak_crimson',
        mainHand: 'weapon_slavic_axe',
        offHand: 'offhand_slavic_shield',
        hostile: true,
        difficulty: 'very_hard',
        hp: 62,
        ap: 7,
        xpReward: 120
      })
    );
  }

  applyWorldDressing(map, {
    seed: 20268,
    spawnX: 11,
    spawnY: 19,
    actors,
    reservedPoints: [
      { x: 11, y: 21, radius: 1 },
      { x: 12, y: 21, radius: 1 },
      { x: 12, y: 8, radius: 4 }
    ],
    forestSides: ['W', 'N', 'E'],
    beltDepth: 2
  });

  return {
    id: 'wzgorze_wartownicze',
    map,
    spawnX: 11,
    spawnY: 19,
    actors,
    ambientLightIntensity: 0.8,
    fogOfWarEnabled: false
  };
}

/**
 * Akt II — Eksploracja 1: Spalona Osada (24x24)
 */
export function createSpalonaOsadaScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isExit = x >= 11 && x <= 12 && y === height - 1;
    const isRuins = Math.hypot(x - 12, y - 10) <= 5.2 || (x >= 11 && x <= 12 && y >= 10);
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isExit };
    }
    return {
      z: 0,
      terrain: isRuins ? 'dirt_path' : 'forest_soil',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Spalona Osada',
    subtitle: 'Akt II: Zgliszcza, ocalała piwnica i pogorzelec Chwalisław',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'spalona_zgliszcza',
        name: 'Zgliszcza z maruderami',
        kind: 'campfire',
        x: 12,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_spalona_ember'
      },
      {
        id: 'spalona_piwnica',
        name: 'Ocalała piwnica pod zgliszczami',
        kind: 'dungeon_crate',
        x: 8,
        y: 11,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'spalona_drogowskaz',
        name: '🚪 Powrót do Głuszca',
        kind: 'exit_path',
        x: 11,
        y: 21,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'spalona_chata_zachod',
        name: 'Spalone ruiny chaty',
        kind: 'slavic_cottage',
        x: 5,
        y: 8,
        z: 0,
        sizeX: 2,
        sizeY: 2,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'spalona_chata_wschod',
        name: 'Zgliszcza stodoły',
        kind: 'slavic_cottage',
        x: 16,
        y: 10,
        z: 0,
        sizeX: 2,
        sizeY: 2,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'oil_barrel_spalona_1',
        name: 'Beczka ze smołą (wybuchowa)',
        kind: 'dungeon_barrel',
        x: 11,
        y: 9,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'spalona_martwe_drzewo_1',
        name: 'Osmalone drzewo',
        kind: 'dead_tree',
        x: 6,
        y: 15,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'spalona_martwe_drzewo_2',
        name: 'Wypalony pień',
        kind: 'dead_tree',
        x: 17,
        y: 5,
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
        id: 'light_spalona_ember',
        x: 12,
        y: 8,
        z: 0.7,
        color: { r: 255, g: 120, b: 55 },
        intensity: 1.25,
        radius: 6,
        flickerSpeed: 3.4,
        enabled: true
      },
      {
        id: 'light_spalona_ember_2',
        x: 16,
        y: 11,
        z: 0.6,
        color: { r: 245, g: 108, b: 48 },
        intensity: 0.95,
        radius: 4.5,
        flickerSpeed: 2.9,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapter2Npc({
      id: 'npc_pogorzelec_chwalislaw',
      seed: 2801,
      name: 'Pogorzelec Chwalisław (Kmieć)',
      title: 'Ocalały ze spalonej osady',
      x: 14,
      y: 14,
      z: 0,
      direction: 5,
      torso: 'torso_przeszywanica',
      dialogueId: 'npc_pogorzelec_chwalislaw'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeChapter2Npc({
        id: 'enemy_spalona_maruder_1',
        seed: 2811,
        name: 'Maruder ze Zgliszczy',
        title: 'Szabrownik',
        x: 10,
        y: 7,
        z: 0,
        direction: 4,
        torso: 'torso_warden_brigandine',
        head: 'helm_shadow_hood',
        mainHand: 'weapon_slavic_axe',
        hostile: true,
        hp: 28,
        ap: 6,
        xpReward: 42
      }),
      makeChapter2Npc({
        id: 'enemy_spalona_maruder_2',
        seed: 2812,
        name: 'Maruder z Mieczem',
        title: 'Szabrownik',
        x: 14,
        y: 7,
        z: 0,
        direction: 4,
        torso: 'torso_warden_brigandine',
        head: 'helm_shadow_hood',
        mainHand: 'weapon_iron_longsword',
        hostile: true,
        hp: 28,
        ap: 6,
        xpReward: 42
      }),
      makeChapter2Npc({
        id: 'enemy_spalona_lucznik',
        seed: 2813,
        name: 'Kłusownik Łucznik',
        title: 'Strzelec szabrowników',
        x: 12,
        y: 5,
        z: 0,
        direction: 4,
        torso: 'torso_przeszywanica',
        head: 'helm_shadow_hood',
        mainHand: 'weapon_hunting_bow',
        hostile: true,
        hp: 24,
        ap: 6,
        xpReward: 42
      })
    );
  }

  applyWorldDressing(map, {
    seed: 20269,
    spawnX: 11,
    spawnY: 15,
    actors,
    reservedPoints: [
      { x: 11, y: 21, radius: 1 },
      { x: 12, y: 21, radius: 1 },
      { x: 12, y: 8, radius: 4 }
    ],
    forestSides: ['W', 'N', 'E'],
    beltDepth: 2
  });

  return {
    id: 'spalona_osada',
    map,
    spawnX: 11,
    spawnY: 15,
    actors,
    ambientLightIntensity: 0.65,
    fogOfWarEnabled: false
  };
}

/**
 * Akt II — Eksploracja 2: Stara Kopalnia (24x24)
 */
export function createStaraKopalniaScene(opts?: { withHunt?: boolean }): CustomSceneConfig {
  const width = 24;
  const height = 24;
  const tiles = buildGrid(width, height, (x, y) => {
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const isExit = x >= 11 && x <= 12 && y === height - 1;
    const isShaft = Math.hypot(x - 12, y - 9) <= 5.0 || (x >= 11 && x <= 12 && y >= 9);
    if (isBorder) {
      return { z: 1, terrain: 'forest_soil', walkable: isExit };
    }
    return {
      z: 0,
      terrain: isShaft ? 'dirt_path' : 'forest_soil',
      walkable: true
    };
  });

  const map: IsometricWorldMap = {
    id: 'forest_clearing' as MapId,
    name: 'Stara Kopalnia',
    subtitle: 'Akt II: Zalana sztolnia i żyła gwiezdnego żelaza',
    width,
    height,
    maxElevation: 2,
    tiles,
    props: [
      {
        id: 'kopalnia_zyla_zelaza',
        name: 'Żyła gwiezdnego żelaza',
        kind: 'dungeon_crate',
        x: 15,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true,
        linkedLightId: 'light_kopalnia_stariron'
      },
      {
        id: 'kopalnia_zalana_sztolnia',
        name: 'Zalana sztolnia (głębia kopalni)',
        kind: 'campfire',
        x: 11,
        y: 7,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'kopalnia_drogowskaz',
        name: '🚪 Powrót do Głuszca',
        kind: 'exit_path',
        x: 11,
        y: 21,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'kopalnia_wejscie_glowne',
        name: 'Stary szyb kopalniany',
        kind: 'rock_cliff',
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
        id: 'kopalnia_oltarz_rudy',
        name: 'Pradawny kamień runiczny w szybie',
        kind: 'runic_altar',
        x: 17,
        y: 8,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false
      },
      {
        id: 'oil_barrel_kopalnia_1',
        name: 'Beczka z olejem górniczym (wybuchowa)',
        kind: 'dungeon_barrel',
        x: 11,
        y: 9,
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
        id: 'light_kopalnia_stariron',
        x: 15,
        y: 8,
        z: 0.9,
        color: { r: 120, g: 210, b: 255 },
        intensity: 1.4,
        radius: 6,
        flickerSpeed: 2.2,
        enabled: true
      },
      {
        id: 'light_kopalnia_lantern',
        x: 11,
        y: 5,
        z: 1.2,
        color: { r: 255, g: 170, b: 82 },
        intensity: 1.15,
        radius: 5.5,
        flickerSpeed: 3.2,
        enabled: true
      }
    ]
  };

  const actors: ActorEntity[] = [
    makeChapter2Npc({
      id: 'npc_pustelnik_rudy',
      seed: 2901,
      name: 'Pustelnik Rudy (Pielgrzym)',
      title: 'Stary górnik spod kopalni',
      x: 9,
      y: 15,
      z: 0,
      direction: 2,
      torso: 'torso_przeszywanica',
      cloak: 'cloak_forest',
      dialogueId: 'npc_pustelnik_rudy'
    })
  ];

  if (opts?.withHunt) {
    actors.push(
      makeUtopiecActor({
        id: 'enemy_kopalnia_utopiec_1',
        seed: 2911,
        name: 'Utopiec ze Sztolni',
        x: 9,
        y: 8,
        z: 0,
        hp: 28,
        xpReward: 45
      }),
      makeUtopiecActor({
        id: 'enemy_kopalnia_utopiec_2',
        seed: 2912,
        name: 'Utopiec ze Sztolni',
        x: 14,
        y: 8,
        z: 0,
        hp: 28,
        xpReward: 45
      }),
      makeChapter2Npc({
        id: 'enemy_kopalnia_zmora_boss',
        seed: 2913,
        name: 'Zmora z Kopalni',
        title: 'Cień przy żyle gwiezdnego żelaza',
        x: 12,
        y: 6,
        z: 0,
        direction: 4,
        head: null,
        torso: 'torso_przeszywanica',
        mainHand: null,
        offHand: null,
        hostile: true,
        difficulty: 'very_hard',
        hp: 52,
        ap: 6,
        xpReward: 110
      })
    );
  }

  applyWorldDressing(map, {
    seed: 20270,
    spawnX: 11,
    spawnY: 15,
    actors,
    reservedPoints: [
      { x: 11, y: 21, radius: 1 },
      { x: 12, y: 21, radius: 1 },
      { x: 12, y: 8, radius: 4 }
    ],
    forestSides: ['W', 'N', 'E'],
    beltDepth: 2
  });

  return {
    id: 'stara_kopalnia',
    map,
    spawnX: 11,
    spawnY: 15,
    actors,
    ambientLightIntensity: 0.56,
    fogOfWarEnabled: false
  };
}
