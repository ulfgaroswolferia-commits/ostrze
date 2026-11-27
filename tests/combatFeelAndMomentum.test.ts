import { describe, expect, it } from 'vitest';
import { OstrzeEngineState, type CombatFeedbackEvent } from '../src/engine-bridge/OstrzeEngineState';
import { ostrzeAudio } from '../src/game/audio/ostrzeAudio';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import {
  evaluateExecutionBonus,
  evaluateMomentumBonus,
  evaluateTimedStrikePosition,
  KILL_RUSH_AP_REFUND,
  pickCombatBark,
  TIMED_STRIKE_SWEET_CENTER
} from '../src/game/rules/combatMomentum';

function setupCombatEngine(): OstrzeEngineState {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 42);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 7,
        zrecznosc: 7,
        krzepa: 7,
        bystrosc: 5,
        rozum: 6,
        oglada: 4,
        fart: 5
      },
      tagged: ['sieczna', 'skradanie', 'wymowa']
    },
    ORIGIN_DATA
  );

  const engine = new OstrzeEngineState();
  engine.registerCustomScene(createBrzezinaYardScene({ sparingHostile: true }));
  engine.loadCustomScene('brzezina_dziedziniec');
  engine.syncFromOstrzeState(state, ORIGIN_DATA);
  return engine;
}

describe('Combat Feel Overhaul (Momentum, Execution, Kill Rush, Kinetics & Timed Strike)', () => {
  it('evaluates Momentum tiers (0..5), Execution threshold (<=30% HP), and Timed Strike zones accurately', () => {
    expect(evaluateMomentumBonus(0)).toMatchObject({ tier: 0, damageMultiplier: 1, critBonusPct: 0 });
    expect(evaluateMomentumBonus(2)).toMatchObject({ tier: 1, damageMultiplier: 1.1, critBonusPct: 8 });
    expect(evaluateMomentumBonus(5)).toMatchObject({
      tier: 2,
      damageMultiplier: 1.2,
      critBonusPct: 15,
      hitBonusPct: 5
    });
    expect(evaluateMomentumBonus(99).momentum).toBe(5);
    expect(evaluateMomentumBonus(-3).momentum).toBe(0);

    expect(evaluateExecutionBonus(30, 100)).toMatchObject({
      isExecutable: true,
      damageMultiplier: 1.2,
      critBonusPct: 12
    });
    expect(evaluateExecutionBonus(31, 100).isExecutable).toBe(false);

    expect(evaluateTimedStrikePosition(TIMED_STRIKE_SWEET_CENTER)).toMatchObject({
      grade: 'perfect',
      damageMultiplier: 1.3,
      critBonusPct: 35,
      momentumBonus: 1
    });
    expect(evaluateTimedStrikePosition(TIMED_STRIKE_SWEET_CENTER + 0.12)).toMatchObject({
      grade: 'good',
      damageMultiplier: 1.12,
      critBonusPct: 10
    });
    expect(evaluateTimedStrikePosition(0.05)).toMatchObject({
      grade: 'miss',
      damageMultiplier: 1,
      critBonusPct: 0
    });

    expect(pickCombatBark('execution_kill', () => 0.2).length).toBeGreaterThan(2);
  });

  it('triggers kinetic lunge/recoil/flash on weapon maneuver and scales damage with Perfect Timed Strike', () => {
    const engine = setupCombatEngine();
    const enemy = engine.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    enemy.combat!.hp = 120;
    enemy.combat!.maxHp = 120;
    enemy.tileX = engine.player.tileX + 1;
    enemy.tileY = engine.player.tileY;
    enemy.x = enemy.tileX + 0.5;
    enemy.y = enemy.tileY + 0.5;
    engine.combatState.active = true;
    engine.combatState.round = 1;
    engine.combatState.selectedTargetId = enemy.id;
    engine.player.combat!.ap = 10;

    const feedbackEvents: CombatFeedbackEvent[] = [];
    engine.onCombatFeedback = (ev) => feedbackEvents.push(ev);

    // Baseline maneuver damage
    const baseRes = engine.performPlayerWeaponManeuver(enemy.id, () => 0.5);
    expect(baseRes.ok).toBe(true);
    expect(engine.player.attackAnimTimer).toBeGreaterThan(0);
    expect(enemy.hitRecoilTimer).toBeGreaterThan(0);
    expect(enemy.damageFlashTimer).toBeGreaterThan(0);
    expect(engine.getCombatMomentum()).toBeGreaterThanOrEqual(1);

    // Next maneuver on round 4 with Perfect Timed Strike -> strictly higher damage & perfect_strike feedback
    engine.combatState.round = 4;
    engine.player.combat!.ap = 10;
    engine.setPendingTimedStrikeGrade('perfect');
    const perfectRes = engine.performPlayerWeaponManeuver(enemy.id, () => 0.5);
    expect(perfectRes.ok).toBe(true);
    expect(perfectRes.damage).toBeGreaterThan(baseRes.damage);
    expect(engine.getPendingTimedStrikeGrade()).toBe('none');
    expect(feedbackEvents.some((e) => e.kind === 'perfect_strike' && e.screenFlash === 'gold')).toBe(
      true
    );
  });

  it('grants Kill Rush (+2 AP refund) and execution feedback when killing an enemy while others remain', () => {
    const engine = setupCombatEngine();
    const primary = engine.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    primary.combat!.hp = 4;
    primary.combat!.maxHp = 40;
    primary.tileX = engine.player.tileX + 1;
    primary.tileY = engine.player.tileY;
    primary.x = primary.tileX + 0.5;
    primary.y = primary.tileY + 0.5;

    // Clone a second living hostile so combat continues after primary dies
    const second = {
      ...primary,
      id: 'enemy_second_dummy',
      tileX: engine.player.tileX + 4,
      tileY: engine.player.tileY,
      x: engine.player.tileX + 4.5,
      y: engine.player.tileY + 0.5,
      combat: {
        ...primary.combat!,
        hp: 40,
        maxHp: 40,
        isAlive: true,
        proficiencies: { ...primary.combat!.proficiencies },
        lootTable: [...primary.combat!.lootTable]
      }
    };
    engine.npcs.push(second);

    engine.combatState.active = true;
    engine.combatState.round = 1;
    engine.combatState.selectedTargetId = primary.id;
    engine.player.combat!.maxAp = 8;
    engine.player.combat!.ap = 6;

    const feedbackEvents: CombatFeedbackEvent[] = [];
    engine.onCombatFeedback = (ev) => feedbackEvents.push(ev);

    // Maneuver costs 4 AP (6 -> 2), then Kill Rush refunds +2 AP (2 -> 4)!
    const res = engine.performPlayerWeaponManeuver(primary.id, () => 0.5);
    expect(res.ok).toBe(true);
    expect(primary.combat!.isAlive).toBe(false);
    expect(engine.player.combat!.ap).toBe(6 - 4 + KILL_RUSH_AP_REFUND);
    expect(engine.getCombatMomentum()).toBeGreaterThanOrEqual(3);
    expect(feedbackEvents.some((e) => e.kind === 'execution_kill' && e.zoomPunch! > 0)).toBe(true);
  });

  it('emits crimson player_hurt feedback and reduces momentum on unguarded enemy hits; new audio SFX are Node-safe', () => {
    const engine = setupCombatEngine();
    const enemy = engine.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    engine.combatState.active = true;
    engine.combatState.round = 1;
    engine.player.combat!.defending = false;

    // Build momentum to 2 via maneuver
    enemy.combat!.hp = 120;
    enemy.combat!.maxHp = 120;
    enemy.tileX = engine.player.tileX + 1;
    enemy.tileY = engine.player.tileY;
    enemy.x = enemy.tileX + 0.5;
    enemy.y = enemy.tileY + 0.5;
    engine.player.combat!.ap = 10;
    engine.setPendingTimedStrikeGrade('perfect');
    engine.performPlayerWeaponManeuver(enemy.id, () => 0.5);
    const momBefore = engine.getCombatMomentum();
    expect(momBefore).toBeGreaterThanOrEqual(2);

    const feedbackEvents: CombatFeedbackEvent[] = [];
    engine.onCombatFeedback = (ev) => feedbackEvents.push(ev);

    engine.triggerCombatAttackResolved({
      attacker: enemy,
      target: engine.player,
      outcome: {
        attackerId: enemy.id,
        defenderId: engine.player.id,
        mode: 'quick',
        apSpent: 3,
        hit: true,
        hitChancePct: 75,
        rollPct: 20,
        critical: false,
        rawDamage: 8,
        mitigatedByArmor: 2,
        damageDealt: 6,
        appliedStatus: null,
        targetDefeated: false
      }
    });

    expect(engine.getCombatMomentum()).toBe(momBefore - 1);
    expect(feedbackEvents.some((e) => e.kind === 'player_hurt' && e.screenFlash === 'crimson')).toBe(
      true
    );

    expect(() => ostrzeAudio.playPlayerHurt()).not.toThrow();
    expect(() => ostrzeAudio.playExecutionKill()).not.toThrow();
    expect(() => ostrzeAudio.playTimedStrike('perfect')).not.toThrow();
    expect(() => ostrzeAudio.playTimedStrike('good')).not.toThrow();
    expect(() => ostrzeAudio.playTimedStrike('miss')).not.toThrow();
    expect(() => ostrzeAudio.playMomentumTierUp(1)).not.toThrow();
    expect(() => ostrzeAudio.playMomentumTierUp(2)).not.toThrow();
  });
});
