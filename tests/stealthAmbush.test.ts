import { isTileInEnemyVisionCone } from '@ulf/rpg/gameLoop';
import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { computeStealthEvadeChance } from '../src/game/rules/stealth';

describe('Filar 2: Stealth [C], Vision Cones & Surprise Ambush Round', () => {
  it('computes higher stealth evade chance at night and during Mgła Ciszy', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 7);
    createCharacter(
      state,
      {
        name: 'Mściwój',
        classId: 'miecz',
        attributes: {
          sila: 6,
          zrecznosc: 8,
          krzepa: 5,
          bystrosc: 6,
          rozum: 6,
          oglada: 5,
          fart: 5
        },
        tagged: ['sieczna', 'skradanie', 'wymowa']
      },
      ORIGIN_DATA
    );

    // Midday, clear weather
    state.time.minutes = 12 * 60;
    state.world.activePhenomenon = null;
    const dayClear = computeStealthEvadeChance(state, ORIGIN_DATA, 4.5);

    // Night + Mgła Ciszy
    state.time.minutes = 23 * 60;
    state.world.activePhenomenon = 'mgla_ciszy';
    const nightFog = computeStealthEvadeChance(state, ORIGIN_DATA, 4.5);

    expect(nightFog).toBeGreaterThan(dayClear);
  });

  it('detects front vision cone vs safe blind spot behind enemy', () => {
    // Enemy at (10, 10) facing South (direction 0 -> +Y)
    const enemy = { tileX: 10, tileY: 10, direction: 0 as const };
    expect(isTileInEnemyVisionCone(enemy, 10, 14, 5.5)).toBe(true); // Directly in front
    expect(isTileInEnemyVisionCone(enemy, 10, 6, 5.5)).toBe(false); // Safely behind
  });

  it('grants Surprise Round (enemies start with half AP) and Surprise Strike bonus when attacking from Stealth', () => {
    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createBrzezinaYardScene({ sparingHostile: true }));
    engine.loadCustomScene('brzezina_dziedziniec');

    const enemy = engine.npcs.find((n) => n.combat?.isHostile)!;
    expect(engine.toggleStealth()).toBe(true);
    expect(engine.isStealthActive).toBe(true);

    // Initiate combat from stealth
    engine.startCombatWithEnemy(enemy.id);
    expect(engine.isStealthActive).toBe(false);
    expect(engine.isSurpriseAmbushActive).toBe(true);
    expect(engine.surpriseBonusPending).toBe(true);
    expect(enemy.combat!.ap).toBe(Math.max(1, Math.floor(enemy.combat!.maxAp / 2)));

    // Opening ambush strike consumes surpriseBonusPending
    engine.player.tileX = enemy.tileX;
    engine.player.tileY = enemy.tileY + 1;
    const outcome = engine.performPlayerCombatAttack(enemy.id, 'quick', () => 0.01);
    expect(outcome).not.toBeNull();
    expect(engine.surpriseBonusPending).toBe(false);
    expect(engine.combatLogs.some((l) => l.includes('Zaskoczenie'))).toBe(true);
  });
});
