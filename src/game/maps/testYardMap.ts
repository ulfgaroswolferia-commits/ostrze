import { generateRandomCharacterRecipe } from '@ulf/assets/characterBakery';
import { IsometricWorldMap, MapId, TileCell, TileTerrainType } from '@ulf/core/worldMap';
import { DialogueNode } from '@ulf/rpg/dialogueSystem';
import { ActorEntity } from '@ulf/rpg/gameLoop';
import { CustomSceneConfig } from '../../engine-bridge/OstrzeEngineState';
import { organicEdgeWobble, organicPatchNoise } from './terrainNoise';

/**
 * Etap 1 test 2.5D scene: "Dziedziniec Szkoły Ostrzy — Brzezina"
 * Verifies tile elevation, props, lighting, NPCs, and dialogues via engine-bridge.
 */
export function createTestBrzezinaYardScene(): {
  scene: CustomSceneConfig;
  dialogues: Record<string, DialogueNode>;
} {
  const width = 20;
  const height = 20;
  const tiles: TileCell[][] = [];

  for (let y = 0; y < height; y++) {
    const row: TileCell[] = [];
    for (let x = 0; x < width; x++) {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const yardWobble = organicEdgeWobble(x, y, 0.12, 0.65);
      const isYardCenter = Math.hypot((x - 9.5) / 5.2, (y - 9.5) / 5.2) + yardWobble <= 1.02;
      const isPath = x >= 9 && x <= 10 && y >= 14;
      const isInnerEdge = x === 1 || y === 1 || x === width - 2 || y === height - 2;

      let terrain: TileTerrainType = 'forest_grass';
      let z = 0;
      let walkable = true;

      if (isBorder) {
        z = 1;
        terrain = 'forest_soil';
        walkable = x >= 9 && x <= 10 && y === height - 1;
      } else if (isYardCenter || isPath) {
        terrain = 'dirt_path';
      } else if (isInnerEdge && organicPatchNoise(x, y, 7) > -0.05) {
        terrain = 'forest_soil';
      }

      row.push({ x, y, z, terrain, walkable });
    }
    tiles.push(row);
  }

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
        id: 'brzezina_palisade_n',
        name: 'Chata Mistrza Gnieworada',
        kind: 'slavic_cottage',
        x: 8,
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
        id: 'brzezina_campfire',
        name: 'Palenisko Dziedzińca',
        kind: 'campfire',
        x: 10,
        y: 9,
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
        id: 'brzezina_well',
        name: 'Studnia Szkolna',
        kind: 'slavic_well',
        x: 6,
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
        id: 'brzezina_oak_1',
        name: 'Stary Dąb na Skraju Pogórza',
        kind: 'ancient_oak',
        x: 3,
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
        id: 'brzezina_pine_1',
        name: 'Sosna Graniczna',
        kind: 'pine_tree',
        x: 16,
        y: 5,
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
        id: 'light_brzezina_fire',
        x: 10,
        y: 9,
        z: 0.7,
        color: { r: 255, g: 168, b: 84 },
        intensity: 1.35,
        radius: 6.5,
        flickerSpeed: 4.5,
        enabled: true
      }
    ]
  };

  const gnieworadRecipe = generateRandomCharacterRecipe(101, 'npc_gnieworad');
  gnieworadRecipe.name = 'Mistrz Gnieworad';
  gnieworadRecipe.title = 'Mistrz Szkoły Ostrzy w Brzezinie';
  gnieworadRecipe.equipment = {
    head: null,
    torso: 'torso_warden_brigandine',
    cloak: 'cloak_ranger_quiver',
    legs: 'legs_leather_boots',
    mainHand: 'weapon_sunblade_longsword',
    offHand: null
  };

  const gnieworad: ActorEntity = {
    id: 'npc_gnieworad',
    recipe: gnieworadRecipe,
    x: 9.5,
    y: 6.5,
    z: tiles[6][9].z,
    tileX: 9,
    tileY: 6,
    direction: 4, // S
    isMoving: false,
    animFrame: 0,
    animTimer: 0,
    path: [],
    dialogueId: 'ostrze_gnieworad_start'
  };

  const dialogues: Record<string, DialogueNode> = {
    ostrze_gnieworad_start: {
      id: 'ostrze_gnieworad_start',
      speakerName: 'Mistrz Gnieworad',
      speakerTitle: 'Mistrz Szkoły Ostrzy',
      text: 'Świt jeszcze chłodny, a mgła stoi na dziedzińcu. Zanim staniesz do sparingu z Radogostem, powiedz mi jedno — pamiętasz jeszcze, po co tu przyszedłeś?',
      choices: [
        {
          id: 'gnieworad_choice_duty',
          text: 'Przyszedłem uczyć się ostrza, mistrzu.',
          nextNodeId: null,
          logMessage: 'Gnieworad skinął krótko głową. „Dobrze. Niedługo sprawdzimy, ile warte są twoje słowa.”'
        },
        {
          id: 'gnieworad_choice_question',
          text: 'Mówią we wsi, że z południa jedzie cesarski goniec.',
          nextNodeId: null,
          logMessage: 'Gnieworad zmrużył oczy. „Plotki niech zostaną za płotem. Na placu liczy się stal.”'
        }
      ]
    }
  };

  return {
    scene: {
      id: 'brzezina_test_yard',
      map,
      spawnX: 9,
      spawnY: 11,
      actors: [gnieworad],
      ambientLightIntensity: 0.72,
      fogOfWarEnabled: true,
      introLog: 'Prolog 2.5D — Brzezina: Dziedziniec Szkoły Ostrzy (scena bazowa Etapu 1). Porozmawiaj z Mistrzem Gnieworadem.'
    },
    dialogues
  };
}
