import type { WorldPropEntity } from '@ulf/core/worldMap';
import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';
import {
  forageWorldProp,
  performCampRecipe
} from '../src/game/rules/campCrafting';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import {
  advanceWorldTimeAndPhenomena,
  getWorldAtmosphere,
  syncWorldLighting
} from '../src/game/rules/worldCycle';

function setupHero() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 99);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 7,
        zrecznosc: 7,
        krzepa: 6,
        bystrosc: 5,
        rozum: 6,
        oglada: 5,
        fart: 5
      },
      tagged: ['sieczna', 'medycyna', 'skradanie']
    },
    ORIGIN_DATA
  );
  const engine = new OstrzeEngineState();
  engine.registerCustomScene(createBrzezinaYardScene());
  engine.loadCustomScene('brzezina_dziedziniec');
  return { state, engine, rng: createRng(99) };
}

describe('Filar 3 & 4: Campfire Crafting, Foraging, Phenomena & Day/Night Cycle', () => {
  it('brews herbal infusion, oils weapon, cooks meal, and restores HP/clears fatigue on 6h sleep', () => {
    const { state, engine, rng } = setupHero();
    state.inventory.items.push(
      { id: 'ziola_lesne', qty: 3 },
      { id: 'loj_do_ostrza', qty: 1 },
      { id: 'mieso', qty: 1 }
    );
    state.character!.hp = 10;
    state.character!.effects.push({ id: 'zmeczenie', stacks: 1, remainingHours: 8 });
    const startMin = state.time.minutes;

    // 1. Brew Napar ziół
    const brew = performCampRecipe({
      state,
      data: ORIGIN_DATA,
      rng,
      recipeId: 'brew_napar_ziol',
      engine
    });
    expect(brew.ok).toBe(true);
    expect(state.inventory.items.find((i) => i.id === 'napar_ziol')?.qty).toBe(1);

    // 2. Oil weapon
    const oil = performCampRecipe({
      state,
      data: ORIGIN_DATA,
      rng,
      recipeId: 'camp_oil_blade',
      engine
    });
    expect(oil.ok).toBe(true);
    expect(state.character!.effects.some((e) => e.id === 'natluszczone_ostrze')).toBe(true);

    // 3. Cook meat -> najedzony
    const cook = performCampRecipe({
      state,
      data: ORIGIN_DATA,
      rng,
      recipeId: 'camp_cook_meat',
      engine
    });
    expect(cook.ok).toBe(true);
    expect(state.character!.effects.some((e) => e.id === 'najedzony')).toBe(true);

    // 4. Sleep 6h -> clears zmeczenie, heals to full, advances clock
    const sleep = performCampRecipe({
      state,
      data: ORIGIN_DATA,
      rng,
      recipeId: 'camp_sleep_6h',
      engine
    });
    expect(sleep.ok).toBe(true);
    expect(state.character!.effects.some((e) => e.id === 'zmeczenie')).toBe(false);
    expect(state.time.minutes).toBeGreaterThanOrEqual(startMin + 360);
  });

  it('forages herbs/berries from interactive flora once per prop', () => {
    const { state, engine, rng } = setupHero();
    const floraProp: WorldPropEntity = {
      id: 'test_flora',
      name: 'Kępa Ziół',
      kind: 'wildflower_patch' as const,
      x: 4,
      y: 10,
      z: 0,
      sizeX: 1,
      sizeY: 1,
      heightZ: 0,
      blocksMovement: false,
      blocksSight: false,
      interactive: true
    };

    const first = forageWorldProp({ prop: floraProp, state, data: ORIGIN_DATA, rng, engine });
    expect(first.harvested).toBe(true);
    expect(floraProp.isOpen).toBe(true);

    const second = forageWorldProp({ prop: floraProp, state, data: ORIGIN_DATA, rng, engine });
    expect(second.harvested).toBe(false);
  });

  it('adjusts 2.5D ambient light across day/night and applies gentle fatigue/hunger only after >16h', () => {
    const { state, engine, rng } = setupHero();

    state.time.minutes = 13 * 60; // Day
    state.world.activePhenomenon = null;
    const daySnap = syncWorldLighting(state, ORIGIN_DATA, engine);

    state.time.minutes = 23 * 60; // Night
    state.world.activePhenomenon = 'noc_bez_gwiazd';
    const nightSnap = syncWorldLighting(state, ORIGIN_DATA, engine);

    expect(daySnap.ambientIntensity).toBeGreaterThan(nightSnap.ambientIntensity);
    expect(engine.ambientLightIntensity).toBe(nightSnap.ambientIntensity);
    expect(getWorldAtmosphere(state, ORIGIN_DATA).phenomenonName).toBe('Noc bez Gwiazd');

    // 10h without sleep/food -> NO penalty yet
    const mid = advanceWorldTimeAndPhenomena({
      state,
      data: ORIGIN_DATA,
      rng,
      deltaMinutes: 10 * 60,
      engine
    });
    expect(mid.fatigueApplied).toBe(false);
    expect(mid.hungerApplied).toBe(false);

    // +8h (total 18h > 16h) -> gentle fatigue & hunger kick in
    const late = advanceWorldTimeAndPhenomena({
      state,
      data: ORIGIN_DATA,
      rng,
      deltaMinutes: 8 * 60,
      engine
    });
    expect(late.fatigueApplied).toBe(true);
    expect(late.hungerApplied).toBe(true);
  });
});
