import { computeAttackPreview, resolveCombatAttack } from '@ulf/rpg/combatSystem';
import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createKamiennaPrzeleczScene, createWilczaNoraScene } from '../src/game/maps/chapter1Maps';
import { createBrzezinaYardScene, createTraktZasadzkaScene } from '../src/game/maps/prologueMaps';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';

function createLevel2PlayerState() {
  const engine = new OstrzeEngineState();
  const state = createEmptyOstrzeState(ORIGIN_DATA, 2026);
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
      tagged: ['sieczna', 'wymowa', 'skradanie']
    },
    ORIGIN_DATA
  );
  grantXp(state, 160, ORIGIN_DATA);
  state.inventory.equipped.glowa = 'kaptur_mysliwego';
  return { engine, state };
}

function simulateGuaranteedMaxCrit(
  attacker: ReturnType<OstrzeEngineState['getActorCombatant']>,
  defender: ReturnType<OstrzeEngineState['getActorCombatant']>
) {
  const rolls = [0.0, 0.0, 1.0];
  let i = 0;
  return resolveCombatAttack(
    { ...attacker, combat: { ...attacker.combat } },
    { ...defender, combat: { ...defender.combat } },
    1,
    'quick',
    () => rolls[i++] ?? 0.5
  );
}

describe('Combat balance (Prologue & Chapter 1 early encounters)', () => {
  it('calibrates Trakt ambush bandits to Ostrze rules (no 37%+ crit, no 15 AP, no near-one-shot crits)', () => {
    const { engine, state } = createLevel2PlayerState();
    engine.registerCustomScene(createTraktZasadzkaScene());
    engine.loadCustomScene('trakt_zasadzka');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const playerSnap = engine.getActorCombatant(engine.player);
    const bandits = engine.npcs.filter((n) => n.combat?.isHostile);
    expect(bandits.length).toBe(2);

    for (const bandit of bandits) {
      const bSnap = engine.getActorCombatant(bandit);
      const preview = computeAttackPreview(bSnap, playerSnap, 1, 'quick');
      const critOutcome = simulateGuaranteedMaxCrit(bSnap, playerSnap);

      expect(bSnap.derived.maxAp).toBe(6);
      expect(preview.critChancePct).toBeLessThanOrEqual(10);
      expect(critOutcome.damageDealt).toBeLessThanOrEqual(Math.round(playerSnap.combat.maxHp * 0.35));
    }
  });

  it('keeps sparing Instructor Radogost and Chapter 1 early encounters balanced', () => {
    const scenes = [
      createBrzezinaYardScene({ sparingHostile: true }),
      createWilczaNoraScene(),
      createKamiennaPrzeleczScene()
    ];

    for (const scene of scenes) {
      const { engine, state } = createLevel2PlayerState();
      engine.registerCustomScene(scene);
      engine.loadCustomScene(scene.id);
      engine.syncFromOstrzeState(state, ORIGIN_DATA);

      const playerSnap = engine.getActorCombatant(engine.player);
      const hostiles = engine.npcs.filter((n) => n.combat?.isHostile);
      expect(hostiles.length).toBeGreaterThan(0);

      for (const enemy of hostiles) {
        const eSnap = engine.getActorCombatant(enemy);
        const preview = computeAttackPreview(eSnap, playerSnap, 1, 'quick');
        const critOutcome = simulateGuaranteedMaxCrit(eSnap, playerSnap);

        expect(eSnap.derived.maxAp).toBeLessThanOrEqual(7);
        expect(preview.critChancePct).toBeLessThanOrEqual(10);
        expect(critOutcome.damageDealt).toBeLessThanOrEqual(Math.round(playerSnap.combat.maxHp * 0.35));
      }
    }
  });
});
