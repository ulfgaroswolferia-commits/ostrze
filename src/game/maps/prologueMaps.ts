import { generateRandomCharacterRecipe } from '@ulf/assets/characterBakery';
import { IsometricWorldMap, MapId, TileCell, TileTerrainType } from '@ulf/core/worldMap';
import { createDefaultProficiencies } from '@ulf/rpg/combatSystem';
import { ActorEntity } from '@ulf/rpg/gameLoop';
import type { CustomSceneConfig } from '../../engine-bridge/OstrzeEngineState';
import { organicEdgeWobble, organicPatchNoise } from './terrainNoise';
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
    const isEastCliff = x >= width - 3 && y <= 17;
    const isSouthGate = x >= 10 && x <= 11 && y >= 15;
    const yardWobble = organicEdgeWobble(x, y, 0.12, 0.65);
    const yardDist = Math.hypot((x - 10.5) / 6.3, (y - 10.5) / 6.2) + yardWobble;
    const isYard = yardDist <= 1.04;
    const isTrainingArena =
      x >= 8 &&
      x <= 13 &&
      y >= 10 &&
      y <= 14 &&
      Math.hypot(x - 10.5, y - 12.0) <= 2.45 + yardWobble * 0.4;
    const isCottageApproach = x >= 7 && x <= 14 && y >= 4 && y <= 6;
    const isDormApproach = x >= 5 && x <= 7 && y >= 7 && y <= 14;
    const isInnerEdge = x === 1 || y === 1 || x === width - 2 || y === height - 2;
    if (isBorder || isEastCliff) {
      return {
        z: isEastCliff && x === width - 1 ? 2 : 1,
        terrain: isEastCliff ? 'dungeon_stone' : 'forest_soil',
        walkable: isSouthGate
      };
    }
    const terrain: TileTerrainType = isTrainingArena
      ? 'mossy_cobble'
      : isYard || isSouthGate || isCottageApproach || isDormApproach
        ? 'dirt_path'
        : isInnerEdge && organicPatchNoise(x, y, 1) > -0.1
          ? 'forest_soil'
          : 'forest_grass';
    return {
      z: 0,
      terrain,
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
        id: 'brzezina_dwor_szkoly',
        name: 'Główny Gmach Szkoły Ostrzy (Wielka Sala)',
        kind: 'slavic_cottage',
        variant: 13,
        x: 9,
        y: 2,
        z: 0,
        sizeX: 4,
        sizeY: 2,
        heightZ: 4,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      },
      {
        id: 'brzezina_chata',
        name: 'Izba Mistrza Gnieworada',
        kind: 'slavic_cottage',
        variant: 8,
        x: 14,
        y: 2,
        z: 0,
        sizeX: 2,
        sizeY: 2,
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
        x: 2,
        y: 4,
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
        name: '🚪 Brama na Trakt do Wilczego Brodu',
        kind: 'exit_path',
        x: 10,
        y: 19,
        z: 0,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: false,
        blocksSight: false,
        interactive: true
      },
      {
        id: 'brzezina_filar_bramy_l',
        name: 'Pochodnia Bramy Szkoły Ostrzy',
        kind: 'torch_sconce',
        variant: 0,
        x: 9,
        y: 19,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false,
        isOpen: true,
        linkedLightId: 'light_brzezina_gate_l'
      },
      {
        id: 'brzezina_filar_bramy_p',
        name: 'Pochodnia Bramy Szkoły Ostrzy',
        kind: 'torch_sconce',
        variant: 0,
        x: 12,
        y: 19,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: false,
        interactive: false,
        isOpen: true,
        linkedLightId: 'light_brzezina_gate_r'
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
        x: 11,
        y: 10,
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
      cloak: 'cloak_ranger_quiver',
      mainHand: 'weapon_sunblade_longsword'
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
      mainHand: 'weapon_slavic_axe',
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
      mainHand: 'weapon_sunblade_longsword'
    }),
    makeNpc({
      id: 'npc_ragnoslawa',
      seed: 105,
      name: 'Ragnosława',
      title: 'Adeptka (Włócznia)',
      x: 13,
      y: 16,
      z: tiles[16][13].z,
      mainHand: 'weapon_astral_staff'
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

  applyWorldDressing(map, {
    seed: 1001,
    spawnX: 10,
    spawnY: 13,
    actors,
    reservedPoints: [
      { x: 11, y: 8, radius: 1 }, // Cesarski Kurier spawn
      { x: 10, y: 12, radius: 1 }, // Sparing center corridor
      { x: 10, y: 18, radius: 1 }, // South gate exit corridor (full clear path)
      { x: 11, y: 18, radius: 1 },
      { x: 10, y: 19, radius: 1 },
      { x: 11, y: 19, radius: 1 },
      { x: 10, y: 20, radius: 1 },
      { x: 11, y: 20, radius: 1 },
      { x: 10, y: 21, radius: 1 },
      { x: 11, y: 21, radius: 1 }
    ],
    cliffSides: ['E'],
    forestSides: ['W', 'N', 'S'],
    beltDepth: 3,
    bespokeProps: [
      // 1. Skrzydła Głównego Kompleksu Szkoły Ostrzy (Północ)
      {
        id: 'brzezina_baszta_szkoly',
        name: 'Kamienna Baszta Szkoły Ostrzy',
        kind: 'watchtower',
        variant: 0,
        x: 6,
        y: 3,
        sizeX: 2,
        sizeY: 2,
        heightZ: 4,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'brzezina_zbrojownia_szkoly',
        name: 'Zbrojownia i Kuźnia Szkolna',
        kind: 'slavic_cottage',
        variant: 4,
        x: 14,
        y: 4,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'brzezina_latarnia_szkoly_l',
        name: 'Latarnia Przed Szkołą',
        kind: 'torch_sconce',
        x: 8,
        y: 5,
        heightZ: 2,
        isOpen: true,
        linkedLightId: 'light_brzezina_school_l'
      },
      {
        id: 'brzezina_latarnia_szkoly_p',
        name: 'Latarnia Zbrojowni',
        kind: 'torch_sconce',
        x: 13,
        y: 5,
        heightZ: 2,
        isOpen: true,
        linkedLightId: 'light_brzezina_school_r'
      },
      // 2. Dormitorium dla Uczniów (Zachodnie Skrzydło)
      {
        id: 'brzezina_sztandar_szkoly',
        name: 'Sztandar Szkoły Ostrzy',
        kind: 'school_banner',
        x: 12,
        y: 6,
        heightZ: 3,
        blocksMovement: false,
        blocksSight: false
      },
      {
        id: 'brzezina_dormitorium_1',
        name: 'Dormitorium Adeptów (Skrzydło Północne)',
        kind: 'slavic_cottage',
        variant: 8,
        x: 3,
        y: 6,
        sizeX: 2,
        sizeY: 2,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'brzezina_dormitorium_2',
        name: 'Dormitorium Adeptów (Skrzydło Południowe)',
        kind: 'slavic_cottage',
        variant: 11,
        x: 3,
        y: 11,
        sizeX: 2,
        sizeY: 2,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'brzezina_namiot_adeptow',
        name: 'Namiot Młodszych Adeptów',
        kind: 'ranger_tent',
        variant: 0,
        x: 4,
        y: 15,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1,
        blocksMovement: true,
        blocksSight: false
      },
      {
        id: 'brzezina_stol_dormitorium',
        name: 'Ława i Stół Uczniowski',
        kind: 'dungeon_table',
        variant: 0,
        x: 6,
        y: 13,
        heightZ: 1
      },
      {
        id: 'brzezina_kufer_adeptow',
        name: 'Kufer z Opończami Adeptów',
        kind: 'chest',
        variant: 0,
        x: 6,
        y: 7,
        heightZ: 1
      },
      // 3. Plac Ćwiczeń Walki — Kukły (Dummies) i Stojaki z Bronią (Weapon Racks)
      {
        id: 'brzezina_kukla_1',
        name: 'Kukła Treningowa (Manekin Szermierczy)',
        kind: 'training_dummy',
        variant: 0,
        x: 8,
        y: 11,
        heightZ: 2
      },
      {
        id: 'brzezina_kukla_2',
        name: 'Kukła Treningowa (Słup do Pchnięć Włócznią)',
        kind: 'training_dummy',
        variant: 1,
        x: 8,
        y: 13,
        heightZ: 2
      },
      {
        id: 'brzezina_kukla_3',
        name: 'Kukła Tarczowa do Cięć Ciężkich',
        kind: 'training_dummy',
        variant: 2,
        x: 13,
        y: 12,
        heightZ: 2
      },
      {
        id: 'brzezina_stojak_miecze',
        name: 'Stojak z Mieczami Ćwiczebnymi',
        kind: 'dungeon_support',
        variant: 0,
        x: 13,
        y: 10,
        heightZ: 2
      },
      {
        id: 'brzezina_stojak_wlocznie',
        name: 'Stojak z Włóczniami i Tarczami',
        kind: 'dungeon_support',
        variant: 1,
        x: 13,
        y: 11,
        heightZ: 2
      },
      {
        id: 'brzezina_stol_zbrojmistrza',
        name: 'Stół z Ostrzałkami i Bronią Treningową',
        kind: 'dungeon_table',
        variant: 1,
        x: 13,
        y: 14,
        heightZ: 1
      },
      {
        id: 'brzezina_pniak_cwiczen',
        name: 'Pień do Ćwiczenia Rąbania',
        kind: 'tree_stump',
        variant: 2,
        x: 8,
        y: 14,
        heightZ: 1
      },
      {
        id: 'brzezina_skrzynia_broni',
        name: 'Skrzynia z Drewnianymi Ostrzami',
        kind: 'dungeon_crate',
        variant: 1,
        x: 12,
        y: 14,
        heightZ: 1
      },
      // 4. Zaplecze Kramu Kwatermistrza
      {
        id: 'brzezina_skrzynie_kramu_1',
        name: 'Skrzynie Zaopatrzeniowe Szkoły',
        kind: 'dungeon_crate',
        variant: 0,
        x: 16,
        y: 7,
        heightZ: 1
      },
      {
        id: 'brzezina_skrzynie_kramu_2',
        name: 'Worki iZapasy Kwatermistrza',
        kind: 'chest',
        variant: 1,
        x: 16,
        y: 9,
        heightZ: 1
      },
      // 5. Skalna Skarpa od Wschodu (Urwisko)
      {
        id: 'brzezina_skala_urwisko_1',
        name: 'Skalna Ściana nad Dziedzińcem',
        kind: 'rock_cliff',
        variant: 0,
        x: 17,
        y: 4,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'brzezina_skala_urwisko_2',
        name: 'Omszałe Urwisko',
        kind: 'rock_cliff',
        variant: 2,
        x: 17,
        y: 6,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'brzezina_skala_urwisko_3',
        name: 'Głaz Oporowy Skarpy',
        kind: 'rock_cliff',
        variant: 4,
        x: 17,
        y: 10,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'brzezina_skala_urwisko_4',
        name: 'Urwisko Skalnego Grzbietu',
        kind: 'rock_cliff',
        variant: 6,
        x: 17,
        y: 13,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'brzezina_skala_urwisko_5',
        name: 'Skały Zamykające Wschodnią Ścieżkę',
        kind: 'rock_cliff',
        variant: 1,
        x: 16,
        y: 15,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      // 6. Południowa Palisada i Brama Szkoły Ostrzy
      {
        id: 'brzezina_plot_brama_l1',
        name: 'Ogrodzenie Dziedzińca',
        kind: 'wattle_fence',
        variant: 0,
        x: 7,
        y: 19,
        heightZ: 1
      },
      {
        id: 'brzezina_plot_brama_l2',
        name: 'Ogrodzenie Dziedzińca',
        kind: 'wattle_fence',
        variant: 1,
        x: 8,
        y: 19,
        heightZ: 1
      },
      {
        id: 'brzezina_plot_brama_p1',
        name: 'Ogrodzenie Dziedzińca',
        kind: 'wattle_fence',
        variant: 0,
        x: 13,
        y: 19,
        heightZ: 1
      },
      {
        id: 'brzezina_plot_brama_p2',
        name: 'Ogrodzenie Dziedzińca',
        kind: 'wattle_fence',
        variant: 1,
        x: 14,
        y: 19,
        heightZ: 1
      },
      {
        id: 'brzezina_plot_brama_p3',
        name: 'Ogrodzenie Dziedzińca',
        kind: 'wattle_fence',
        variant: 2,
        x: 15,
        y: 19,
        heightZ: 1
      }
    ],
    bespokeLights: [
      {
        id: 'light_brzezina_school_l',
        x: 8,
        y: 5,
        z: 1.1,
        color: { r: 255, g: 185, b: 95 },
        intensity: 0.95,
        radius: 5.0,
        flickerSpeed: 3.2,
        enabled: true
      },
      {
        id: 'light_brzezina_school_r',
        x: 13,
        y: 5,
        z: 1.1,
        color: { r: 255, g: 185, b: 95 },
        intensity: 0.95,
        radius: 5.0,
        flickerSpeed: 3.4,
        enabled: true
      },
      {
        id: 'light_brzezina_gate_l',
        x: 9,
        y: 19,
        z: 1.1,
        color: { r: 255, g: 196, b: 92 },
        intensity: 1.15,
        radius: 5.5,
        flickerSpeed: 3.6,
        enabled: true
      },
      {
        id: 'light_brzezina_gate_r',
        x: 12,
        y: 19,
        z: 1.1,
        color: { r: 255, g: 196, b: 92 },
        intensity: 1.15,
        radius: 5.5,
        flickerSpeed: 3.8,
        enabled: true
      }
    ]
  });

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
    const roadCenter = 12 + Math.sin(y * 0.28) * 1.35;
    const roadDist = Math.abs(x - roadCenter);
    const isRoad = roadDist <= 2.15;
    const isShoulder = !isRoad && roadDist <= 3.05;
    const isRidge = x <= 2 || x >= width - 3 || y === 0 || y === height - 1;
    return {
      z: isRidge ? 1 : 0,
      terrain: isRoad ? 'dirt_path' : isRidge || isShoulder ? 'forest_soil' : 'forest_grass',
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
        x: 10,
        y: 15,
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
    }),
    makeNpc({
      id: 'npc_trakt_skarimir',
      seed: 104,
      name: 'Skarimir',
      title: 'Towarzysz z Brzeziny',
      x: 10,
      y: 16,
      z: tiles[16][10].z,
      direction: 2,
      mainHand: 'weapon_sunblade_longsword'
    }),
    makeNpc({
      id: 'npc_trakt_ragnoslawa',
      seed: 105,
      name: 'Ragnosława',
      title: 'Towarzyszka z Brzeziny',
      x: 14,
      y: 15,
      z: tiles[15][14].z,
      direction: 6,
      mainHand: 'weapon_astral_staff'
    }),
    makeNpc({
      id: 'npc_trakt_wojmir',
      seed: 106,
      name: 'Wojmir Cienki',
      title: 'Towarzysz z Brzeziny',
      x: 13,
      y: 17,
      z: tiles[17][13].z,
      direction: 0
    })
  ];

  applyWorldDressing(map, {
    seed: 1002,
    spawnX: 12,
    spawnY: 16,
    actors,
    reservedPoints: [
      { x: 11, y: 15, radius: 1 }, // Skarimir campfire spawn after ambush
      { x: 12, y: 12, radius: 1 }
    ],
    cliffSides: ['E'],
    forestSides: ['W', 'N', 'S'],
    beltDepth: 4,
    bespokeProps: [
      {
        id: 'trakt_namiot_bandytow',
        name: 'Ukryty Obóz Bandytów w Gąszczu',
        kind: 'ranger_tent',
        variant: 1,
        x: 7,
        y: 6,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1
      },
      {
        id: 'trakt_barykada_skrzynie',
        name: 'Zrabowane Skrzynie Kupieckie',
        kind: 'dungeon_crate',
        variant: 0,
        x: 9,
        y: 8,
        heightZ: 1
      },
      {
        id: 'trakt_barykada_beczki',
        name: 'Rozbite Beczki przy Gościńcu',
        kind: 'dungeon_barrel',
        variant: 1,
        x: 15,
        y: 8,
        heightZ: 1
      },
      {
        id: 'trakt_skala_zasadzki_2',
        name: 'Skalny Nawis nad Gościńcem',
        kind: 'rock_cliff',
        variant: 3,
        x: 16,
        y: 10,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'trakt_skala_zasadzki_3',
        name: 'Urwisko Wschodniego Zbocza',
        kind: 'rock_cliff',
        variant: 5,
        x: 17,
        y: 13,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'trakt_kapliczka_lesna',
        name: 'Stary Słup Drogowy',
        kind: 'slavic_shrine',
        variant: 0,
        x: 8,
        y: 17,
        heightZ: 2
      },
      {
        id: 'trakt_namiot_druzyny',
        name: 'Posłania Drużyny przy Ognisku',
        kind: 'ranger_tent',
        variant: 0,
        x: 7,
        y: 14,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1
      },
      {
        id: 'trakt_dab_1',
        name: 'Rozłożysty Dąb nad Traktem',
        kind: 'ancient_oak',
        variant: 4,
        x: 6,
        y: 11,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'trakt_sosna_2',
        name: 'Sosna Pogórza',
        kind: 'pine_tree',
        variant: 7,
        x: 16,
        y: 16,
        heightZ: 3,
        blocksMovement: true,
        blocksSight: true
      }
    ]
  });

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
    const wobble = organicEdgeWobble(x, y, 0.9, 0.68);
    const dist = Math.hypot(x - 10.5, y - 10.5);
    const isOuter = dist >= 9.5;
    const terrain: TileTerrainType =
      dist <= 3.9 + wobble
        ? 'dirt_path'
        : isOuter || dist <= 5.3 + wobble
          ? 'forest_soil'
          : 'forest_grass';
    return {
      z: isOuter ? 1 : 0,
      terrain,
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
        x: 10,
        y: 11,
        z: 0.6,
        color: { r: 225, g: 120, b: 60 },
        intensity: 0.75,
        radius: 4.5,
        flickerSpeed: 6,
        enabled: true
      },
      {
        id: 'light_noc_spark',
        x: 10,
        y: 5,
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
      name: 'Upiór Nocy (Zmora)',
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
      name: 'Upiór Nocy (Zmora)',
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
    }),
    makeNpc({
      id: 'npc_noc_skarimir',
      seed: 104,
      name: 'Skarimir',
      title: 'Osłania obóz w burzy iskier',
      x: 8,
      y: 13,
      z: tiles[13][8].z,
      direction: 1,
      mainHand: 'weapon_sunblade_longsword'
    }),
    makeNpc({
      id: 'npc_noc_ragnoslawa',
      seed: 105,
      name: 'Ragnosława',
      title: 'Staje z włócznią przeciw zmorom',
      x: 12,
      y: 13,
      z: tiles[13][12].z,
      direction: 7,
      mainHand: 'weapon_astral_staff'
    }),
    makeNpc({
      id: 'npc_noc_wojmir',
      seed: 106,
      name: 'Wojmir Cienki',
      title: 'Cofnięty pod skraj uroczyska',
      x: 10,
      y: 15,
      z: tiles[15][10].z,
      direction: 0
    })
  ];

  applyWorldDressing(map, {
    seed: 1003,
    spawnX: 10,
    spawnY: 13,
    actors,
    reservedPoints: [
      { x: 10, y: 9, radius: 1 }, // Istota zza Gwiazd spawn
      { x: 10, y: 12, radius: 1 }
    ],
    cliffSides: ['N', 'E'],
    forestSides: ['W', 'S'],
    beltDepth: 4,
    deadForest: true,
    ruinsScatter: true,
    bespokeProps: [
      {
        id: 'noc_oltarz_uroczyska',
        name: 'Spękany Krąg Uroczyska',
        kind: 'runic_altar',
        variant: 0,
        x: 10,
        y: 4,
        sizeX: 2,
        sizeY: 1,
        heightZ: 2
      },
      {
        id: 'noc_menhir_1',
        name: 'Czarny Menhir Uroczyska',
        kind: 'pillar',
        variant: 1,
        x: 7,
        y: 6,
        heightZ: 2,
        blocksSight: true
      },
      {
        id: 'noc_menhir_2',
        name: 'Czarny Menhir Uroczyska',
        kind: 'pillar',
        variant: 2,
        x: 14,
        y: 6,
        heightZ: 2,
        blocksSight: true
      },
      {
        id: 'noc_menhir_3',
        name: 'Pęknięty Obelisk',
        kind: 'pillar',
        variant: 4,
        x: 6,
        y: 11,
        heightZ: 2
      },
      {
        id: 'noc_menhir_4',
        name: 'Pęknięty Obelisk',
        kind: 'pillar',
        variant: 6,
        x: 15,
        y: 11,
        heightZ: 2
      },
      {
        id: 'noc_krysztal_iskier_2',
        name: 'Odłamek Spadającej Gwiazdy',
        kind: 'arcane_crystal',
        variant: 1,
        x: 6,
        y: 9,
        heightZ: 2,
        linkedLightId: 'light_noc_spark_w'
      },
      {
        id: 'noc_krysztal_iskier_3',
        name: 'Odłamek Spadającej Gwiazdy',
        kind: 'arcane_crystal',
        variant: 2,
        x: 15,
        y: 9,
        heightZ: 2,
        linkedLightId: 'light_noc_spark_e'
      },
      {
        id: 'noc_namiot_obozu_1',
        name: 'Namiot Obozowy Adeptów',
        kind: 'ranger_tent',
        variant: 0,
        x: 7,
        y: 14,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1
      },
      {
        id: 'noc_namiot_obozu_2',
        name: 'Namiot Przewodnika',
        kind: 'ranger_tent',
        variant: 1,
        x: 12,
        y: 14,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1
      },
      {
        id: 'noc_skala_1',
        name: 'Skalny Ostaniec',
        kind: 'rock_cliff',
        variant: 2,
        x: 15,
        y: 7,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      },
      {
        id: 'noc_martwe_drzewo_2',
        name: 'Uschnięty Dąb',
        kind: 'dead_tree',
        variant: 3,
        x: 14,
        y: 13,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      }
    ],
    bespokeLights: [
      {
        id: 'light_noc_spark_w',
        x: 6,
        y: 9,
        z: 1.0,
        color: { r: 110, g: 175, b: 255 },
        intensity: 0.95,
        radius: 5.0,
        flickerSpeed: 7.0,
        enabled: true
      },
      {
        id: 'light_noc_spark_e',
        x: 15,
        y: 9,
        z: 1.0,
        color: { r: 140, g: 165, b: 255 },
        intensity: 0.95,
        radius: 5.0,
        flickerSpeed: 6.5,
        enabled: true
      }
    ]
  });

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
    const roadX = 11 + Math.sin(y * 0.32) * 0.85;
    const roadY = 11 + Math.sin(x * 0.32) * 0.85;
    const dRoad = Math.min(Math.abs(x - roadX), Math.abs(y - roadY));
    const isCenterPlaza = Math.hypot(x - 11, y - 11) <= 2.75;
    const isCrossroad = dRoad <= 1.35 || isCenterPlaza;
    const isShoulder = !isCrossroad && dRoad <= 2.15;
    const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    return {
      z: isBorder ? 1 : 0,
      terrain: isCrossroad
        ? 'dirt_path'
        : isBorder || isShoulder
          ? 'forest_soil'
          : 'forest_grass',
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

  const pobojowiskoActors: ActorEntity[] = [
    makeNpc({
      id: 'npc_pobojowisko_skarimir',
      seed: 104,
      name: 'Poległy Skarimir',
      title: 'Zbadaj ciało Skarimira',
      x: 8,
      y: 13,
      z: tiles[13][8].z,
      direction: 4,
      torso: 'torso_przeszywanica',
      mainHand: 'weapon_sunblade_longsword'
    }),
    makeNpc({
      id: 'npc_pobojowisko_ragnoslawa',
      seed: 105,
      name: 'Poległa Ragnosława',
      title: 'Zbadaj ciało Ragnosławy',
      x: 10,
      y: 14,
      z: tiles[14][10].z,
      direction: 4,
      torso: 'torso_przeszywanica',
      mainHand: 'weapon_astral_staff'
    }),
    makeNpc({
      id: 'npc_pobojowisko_wojmir',
      seed: 106,
      name: 'Poległy Wojmir',
      title: 'Zbadaj ciało Wojmira',
      x: 8,
      y: 11,
      z: tiles[11][8].z,
      direction: 4,
      torso: 'torso_slavic_giezlo'
    }),
    makeNpc({
      id: 'npc_pobojowisko_slad',
      seed: 350,
      name: 'Porzucony Tobół Przewodnika',
      title: 'Zbadaj pobojowisko o świcie',
      x: 9,
      y: 12,
      z: tiles[12][9].z,
      torso: 'torso_slavic_giezlo',
      cloak: 'cloak_ranger_quiver'
    }),
    makeNpc({
      id: 'npc_rozdroze_szlak',
      seed: 351,
      name: 'Rozdroże ku Wilczemu Brodowi',
      title: 'Wybierz dalszą drogę',
      x: 13,
      y: 10,
      z: tiles[10][13].z,
      torso: 'torso_przeszywanica',
      head: 'helm_shadow_hood'
    })
  ];

  applyWorldDressing(map, {
    seed: 1004,
    spawnX: 11,
    spawnY: 13,
    actors: pobojowiskoActors,
    cliffSides: ['E'],
    forestSides: ['W', 'N', 'S'],
    beltDepth: 4,
    ruinsScatter: true,
    bespokeProps: [
      {
        id: 'pobojowisko_namiot_1',
        name: 'Rozdarty Namiot Adeptów',
        kind: 'ranger_tent',
        variant: 0,
        x: 6,
        y: 12,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1
      },
      {
        id: 'pobojowisko_namiot_2',
        name: 'Zniszczony Namiot Przewodnika',
        kind: 'ranger_tent',
        variant: 1,
        x: 7,
        y: 8,
        sizeX: 2,
        sizeY: 1,
        heightZ: 1
      },
      {
        id: 'pobojowisko_kopiec_1',
        name: 'Kamienny Kopiec Poległych',
        kind: 'pillar',
        variant: 5,
        x: 8,
        y: 14,
        heightZ: 2
      },
      {
        id: 'pobojowisko_kopiec_2',
        name: 'Strzaskany Obelisk przy Trakcie',
        kind: 'pillar',
        variant: 7,
        x: 14,
        y: 8,
        heightZ: 2
      },
      {
        id: 'pobojowisko_skrzynie',
        name: 'Porzucone Skrzynie Wyprawy',
        kind: 'dungeon_crate',
        variant: 1,
        x: 7,
        y: 10,
        heightZ: 1
      },
      {
        id: 'pobojowisko_beczka',
        name: 'Rozbita Beczka z Wodą',
        kind: 'dungeon_barrel',
        variant: 0,
        x: 13,
        y: 14,
        heightZ: 1
      },
      {
        id: 'pobojowisko_kapliczka',
        name: 'Przydrożny Światowid na Rozstajach',
        kind: 'slavic_shrine',
        variant: 0,
        x: 14,
        y: 12,
        heightZ: 2
      },
      {
        id: 'pobojowisko_plot_1',
        name: 'Stary Płot przy Rozdrożu',
        kind: 'wattle_fence',
        variant: 0,
        x: 15,
        y: 10,
        heightZ: 1
      },
      {
        id: 'pobojowisko_plot_2',
        name: 'Stary Płot przy Rozdrożu',
        kind: 'wattle_fence',
        variant: 1,
        x: 16,
        y: 10,
        heightZ: 1
      },
      {
        id: 'pobojowisko_skala_1',
        name: 'Głaz przy Rozdrożu',
        kind: 'rock_cliff',
        variant: 4,
        x: 16,
        y: 7,
        heightZ: 2,
        blocksMovement: true,
        blocksSight: true
      }
    ]
  });

  return {
    id: 'pobojowisko_swit',
    map,
    spawnX: 11,
    spawnY: 13,
    actors: pobojowiskoActors,
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
    mainHand: 'weapon_sunblade_longsword'
  });
}
