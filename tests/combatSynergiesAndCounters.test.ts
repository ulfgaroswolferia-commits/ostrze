import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import {
  evaluateGuardBreak,
  evaluateGuardRiposte,
  evaluateStatusSynergies
} from '../src/game/rules/combatSynergies';

describe('Combat Synergies & Counters (Riposte, Guard Break, Status Combos)', () => {
  it('triggers melee Guard Riposte 1x per round on miss or strong block and blocks ranged/duplicate triggers', () => {
    const onMiss = evaluateGuardRiposte({
      playerDefending: true,
      playerAlive: true,
      playerWeaponIsMelee: true,
      attackerAlive: true,
      distanceTiles: 1.0,
      currentRound: 2,
      riposteUsedRound: 1,
      playerBaseAvgDamage: 8,
      outcome: { hit: false, rawDamage: 8, mitigatedByArmor: 0, damageDealt: 0 }
    });
    expect(onMiss).toEqual({ triggered: true, reason: 'miss', damage: 5 });

    const onStrongBlock = evaluateGuardRiposte({
      playerDefending: true,
      playerAlive: true,
      playerWeaponIsMelee: true,
      attackerAlive: true,
      distanceTiles: 1.4,
      currentRound: 2,
      riposteUsedRound: 1,
      playerBaseAvgDamage: 10,
      outcome: { hit: true, rawDamage: 10, mitigatedByArmor: 6, damageDealt: 4 }
    });
    expect(onStrongBlock).toEqual({ triggered: true, reason: 'blocked', damage: 7 });

    // Already used this round -> blocked
    expect(
      evaluateGuardRiposte({
        playerDefending: true,
        playerAlive: true,
        playerWeaponIsMelee: true,
        attackerAlive: true,
        distanceTiles: 1.0,
        currentRound: 2,
        riposteUsedRound: 2,
        playerBaseAvgDamage: 8,
        outcome: { hit: false, rawDamage: 8, mitigatedByArmor: 0, damageDealt: 0 }
      }).triggered
    ).toBe(false);

    // Ranged weapon cannot melee riposte
    expect(
      evaluateGuardRiposte({
        playerDefending: true,
        playerAlive: true,
        playerWeaponIsMelee: false,
        attackerAlive: true,
        distanceTiles: 1.0,
        currentRound: 2,
        riposteUsedRound: 1,
        playerBaseAvgDamage: 8,
        outcome: { hit: false, rawDamage: 8, mitigatedByArmor: 0, damageDealt: 0 }
      }).triggered
    ).toBe(false);
  });

  it('triggers asymmetric Guard Break on power attacks, maneuvers, or feint against defending enemies', () => {
    expect(evaluateGuardBreak({ targetDefending: true, attackMode: 'power' })).toEqual({
      triggered: true,
      damageMultiplier: 1.25,
      apPenalty: 1
    });
    expect(evaluateGuardBreak({ targetDefending: true, isWeaponManeuver: true }).triggered).toBe(
      true
    );
    expect(evaluateGuardBreak({ targetDefending: true, isFeint: true }).triggered).toBe(true);
    expect(evaluateGuardBreak({ targetDefending: true, attackMode: 'quick' }).triggered).toBe(
      false
    );
    expect(evaluateGuardBreak({ targetDefending: false, attackMode: 'power' }).triggered).toBe(
      false
    );
  });

  it('evaluates Krwawa Rzeź, Wybuch Żaru, and Wykorzystanie Luki synergies cleanly', () => {
    const combo = evaluateStatusSynergies({
      targetBleeding: true,
      targetBurning: true,
      targetDazedOrCrippled: true,
      isMeleeAttack: true,
      isHeavyOrManeuver: true
    });
    expect(combo.damageMultiplier).toBeCloseTo(1.2 * 1.15, 4);
    expect(combo.hitBonusPct).toBe(15);
    expect(combo.critBonusPct).toBe(10);
    expect(combo.bonusFireDamage).toBe(5);
    expect(combo.extraBurnTurns).toBe(1);
    expect(combo.tags).toEqual([
      '🩸 KRWAWA RZEŹ',
      '🔥 WYBUCH ŻARU (+5)',
      '⚡ LUKA W OBRONIE'
    ]);

    const rangedOnBleed = evaluateStatusSynergies({
      targetBleeding: true,
      targetBurning: false,
      targetDazedOrCrippled: false,
      isMeleeAttack: false,
      isHeavyOrManeuver: false
    });
    expect(rangedOnBleed.damageMultiplier).toBe(1);
    expect(rangedOnBleed.tags).toEqual([]);
  });

  it('integrates enemy bleeding DoT, Guard Break, Wybuch Żaru, and Guard Riposte in OstrzeEngineState', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 42);
    createCharacter(
      state,
      {
        name: 'Mściwój',
        classId: 'miecz',
        attributes: {
          sila: 7,
          zrecznosc: 6,
          krzepa: 7,
          bystrosc: 5,
          rozum: 7,
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

    const enemy = engine.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    expect(enemy).toBeDefined();
    enemy.combat!.hp = 120;
    enemy.combat!.maxHp = 120;
    enemy.combat!.ap = 6;
    enemy.tileX = engine.player.tileX + 1;
    enemy.tileY = engine.player.tileY;
    enemy.x = enemy.tileX + 0.5;
    enemy.y = enemy.tileY + 0.5;
    engine.combatState.active = true;
    engine.combatState.round = 1;
    engine.combatState.selectedTargetId = enemy.id;
    engine.player.combat!.ap = 10;

    // 1. Setup Guard + Burn on enemy, then use Ciecie Lukiem maneuver -> Guard Break + Wybuch Zaru + Bleed!
    enemy.combat!.defending = true;
    engine.applyEnemyBurn(enemy.id, 2);
    const manRes = engine.performPlayerWeaponManeuver(enemy.id, () => 0.5);
    expect(manRes.ok).toBe(true);
    expect(enemy.combat!.defending).toBe(false);
    expect(enemy.combat!.ap).toBe(5); // -1 AP from Guard Break
    expect(engine.getEnemyBleedTurns(enemy.id)).toBe(2);
    expect(engine.getEnemyBurnTurns(enemy.id)).toBe(3); // +1 turn from Wybuch Zaru
    expect(engine.getActorVisualStatuses(enemy.id)).toEqual(['krwawienie', 'podpalenie']);

    // 2. Tick enemy bleed DoT
    const hpBeforeBleed = enemy.combat!.hp;
    const bleedDmg = engine.tickEnemyBleed(enemy, () => 0.5);
    expect(bleedDmg).toBe(3);
    expect(enemy.combat!.hp).toBe(hpBeforeBleed - 3);

    // 3. Player Guard Riposte triggers when enemy misses in melee
    engine.player.combat!.defending = true;
    const hpBeforeRiposte = enemy.combat!.hp;
    engine.triggerCombatAttackResolved({
      attacker: enemy,
      target: engine.player,
      outcome: {
        attackerId: enemy.id,
        defenderId: engine.player.id,
        mode: 'quick',
        apSpent: 3,
        hit: false,
        hitChancePct: 50,
        rollPct: 90,
        critical: false,
        rawDamage: 8,
        mitigatedByArmor: 0,
        damageDealt: 0,
        appliedStatus: null,
        targetDefeated: false
      }
    });
    expect(enemy.combat!.hp).toBeLessThan(hpBeforeRiposte);
    expect(engine.combatLogs.some((l) => l.includes('RIPOSTA Z GARDY'))).toBe(true);
  });
});
