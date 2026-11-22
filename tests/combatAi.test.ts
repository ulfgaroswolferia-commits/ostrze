import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createKamiennaPrzeleczScene } from '../src/game/maps/chapter1Maps';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';
import {
  createCombatAiSessionState,
  findBestFlankAdjacentTile,
  findBestKiteTile,
  pickBossTelegraphIntent,
  resolveEnemyArchetype,
  resolveEnemyTacticalTier,
  shouldCautiousEnemyHoldForGuard
} from '../src/game/rules/combatAi';
import { useCombatBeltItem } from '../src/game/rules/combatConsumables';
import {
  getEnemyDamageMultiplier,
  resolvePlayerWeaponDamageType
} from '../src/game/rules/combatEnemyMeta';
import {
  createCombatStatusSessionState,
  getPlayerStatusHitPenaltyPct,
  markPlayerStatusCured,
  tickPlayerCombatStatuses,
  tryApplyPlayerCombatStatus
} from '../src/game/rules/combatStatuses';
import { createRng } from '../src/game/rules/dice';

function setupHero() {
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
  grantXp(state, 200, ORIGIN_DATA);
  state.inventory.items.push({ id: 'opatrunek', qty: 2 });
  return { engine, state };
}

describe('Tactical Enemy AI & Combat Statuses', () => {
  it('maps archetypes and tactical tiers accurately', () => {
    expect(resolveEnemyArchetype('rabus_lucznik', undefined)).toBe('ranged_kiter');
    expect(resolveEnemyArchetype('klusownik', undefined)).toBe('ranged_kiter');
    expect(resolveEnemyArchetype('wilk', undefined)).toBe('predator');
    expect(resolveEnemyArchetype('herszt_zbojcow', undefined)).toBe('boss');
    expect(resolveEnemyArchetype('bandyta', undefined)).toBe('melee_cautious');

    expect(resolveEnemyTacticalTier('trakt_zasadzka', 'bandyta')).toBe('early');
    expect(resolveEnemyTacticalTier('brzezina_yard', 'instruktor')).toBe('early');
    expect(resolveEnemyTacticalTier('kamienna_przelecz', 'rabus')).toBe('mid');
    expect(resolveEnemyTacticalTier('kamienna_przelecz', 'herszt_zbojcow')).toBe('boss');
  });

  it('plans ranged kiting retreat tiles and predator flanking tiles', () => {
    const kite = findBestKiteTile({
      enemyPos: { x: 6, y: 5 },
      playerPos: { x: 5, y: 5 },
      mapWidth: 15,
      mapHeight: 15,
      maxSteps: 3,
      isWalkable: () => true
    });
    expect(kite).not.toBeNull();
    const kiteDist = Math.hypot(kite!.x - 5, kite!.y - 5);
    expect(kiteDist).toBeGreaterThanOrEqual(2.5);
    expect(kiteDist).toBeLessThanOrEqual(5.2);

    // Cornered archer has no valid retreat tile
    const cornered = findBestKiteTile({
      enemyPos: { x: 0, y: 0 },
      playerPos: { x: 1, y: 0 },
      mapWidth: 10,
      mapHeight: 10,
      maxSteps: 2,
      isWalkable: (x, y) => x === 0 && y === 0
    });
    expect(cornered).toBeNull();

    // Predator flanking avoids stacking next to an ally at (4, 5)
    const flank = findBestFlankAdjacentTile({
      enemyPos: { x: 5, y: 3 },
      playerPos: { x: 5, y: 5 },
      allyPositions: [{ x: 4, y: 5 }],
      mapWidth: 15,
      mapHeight: 15,
      isWalkable: () => true
    });
    expect(flank).not.toBeNull();
    expect(flank!.x).toBeGreaterThanOrEqual(5);
  });

  it('triggers cautious low-HP guard hold and boss telegraph cooldown', () => {
    expect(
      shouldCautiousEnemyHoldForGuard({
        archetype: 'melee_cautious',
        hp: 7,
        maxHp: 22,
        ap: 2,
        attacksThisTurn: 1
      })
    ).toBe(true);

    const session = createCombatAiSessionState();
    const t1 = pickBossTelegraphIntent({
      enemyId: 'boss_1',
      originId: 'herszt_zbojcow',
      archetype: 'boss',
      tier: 'boss',
      dazedHeadTurns: 0,
      currentRound: 1,
      session
    });
    expect(t1?.kind).toBe('heavy_cleave');

    // Clear telegraph, cooldown should block round 2 and 3
    delete session.telegraphedIntentByEnemy['boss_1'];
    const t2 = pickBossTelegraphIntent({
      enemyId: 'boss_1',
      originId: 'herszt_zbojcow',
      archetype: 'boss',
      tier: 'boss',
      dazedHeadTurns: 0,
      currentRound: 2,
      session
    });
    expect(t2).toBeNull();
  });

  it('applies, ticks, and cures Ostrze combat statuses with 2-turn anti-stunlock immunity', () => {
    const { state } = setupHero();
    const session = createCombatStatusSessionState();

    // Early tier blocks statuses
    const blocked = tryApplyPlayerCombatStatus({
      state,
      session,
      statusId: 'krwawienie',
      chancePct: 100,
      currentRound: 1,
      allowStatusEffects: false,
      sourceName: 'Bandyta',
      rng: () => 0.0
    });
    expect(blocked.applied).toBe(false);
    expect(blocked.reason).toBe('blocked_tier');

    // Mid/boss tier applies krwawienie & zatrucie
    const bleed = tryApplyPlayerCombatStatus({
      state,
      session,
      statusId: 'krwawienie',
      chancePct: 100,
      currentRound: 1,
      allowStatusEffects: true,
      sourceName: 'Wilk',
      rng: () => 0.0
    });
    expect(bleed.applied).toBe(true);
    expect(state.character!.effects.some((e) => e.id === 'krwawienie')).toBe(true);

    const poison = tryApplyPlayerCombatStatus({
      state,
      session,
      statusId: 'zatrucie',
      chancePct: 100,
      currentRound: 1,
      allowStatusEffects: true,
      sourceName: 'Żmija',
      rng: () => 0.0
    });
    expect(poison.applied).toBe(true);
    expect(getPlayerStatusHitPenaltyPct(state, session)).toBe(10);

    // Tick turn 1
    const tick1 = tickPlayerCombatStatuses({ state, session, currentRound: 2, rng: () => 0.2 });
    expect(tick1.totalDamage).toBe(4); // 2 bleed + 2 poison

    // Cure bleed manually -> grants 2-turn immunity (immune until round 4)
    markPlayerStatusCured(session, 'krwawienie', 2);
    const reapplied = tryApplyPlayerCombatStatus({
      state,
      session,
      statusId: 'krwawienie',
      chancePct: 100,
      currentRound: 3,
      allowStatusEffects: true,
      sourceName: 'Wilk',
      rng: () => 0.0
    });
    expect(reapplied.applied).toBe(false);
    expect(reapplied.reason).toBe('immune');
  });

  it('integrates Quick-Use Belt remedy with anti-stunlock and archer kiting in live engine scene', () => {
    const { engine, state } = setupHero();
    engine.registerCustomScene(createKamiennaPrzeleczScene());
    engine.loadCustomScene('kamienna_przelecz');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const archer = engine.npcs.find(
      (n) =>
        n.combat?.isHostile &&
        (n.id.toLowerCase().includes('lucznik') || n.recipe.name.toLowerCase().includes('łucznik'))
    );
    if (archer) {
      const snap = engine.getActorCombatant(archer);
      expect(snap.derived.weaponProfile.maxRange).toBe(5);
    }

    // Start combat with first hostile and test belt cure
    const enemy = engine.npcs.find((n) => n.combat?.isHostile)!;
    engine.startCombatWithEnemy(enemy.id);
    state.character!.effects.push({ id: 'krwawienie', stacks: 1, remainingHours: 1 });

    const res = useCombatBeltItem({
      state,
      data: ORIGIN_DATA,
      rng: createRng(42),
      engine,
      slotIndex: 1
    });
    expect(res.used).toBe(true);
    expect(state.character!.effects.some((e) => e.id === 'krwawienie')).toBe(false);
  });

  it('applies enemy damageTaken resistance and weakness multipliers for weapons and fire throwables', () => {
    const { engine, state } = setupHero();
    state.inventory.equipped.bron = 'miecz_krotki';
    state.inventory.items.push({ id: 'flasza_oleju', qty: 2 });

    expect(resolvePlayerWeaponDamageType(state, ORIGIN_DATA)).toBe('sieczne');
    expect(getEnemyDamageMultiplier('upior_nocy', 'sieczne', ORIGIN_DATA)).toBe(0.1);
    expect(getEnemyDamageMultiplier('upior_zwiadowca', 'sieczne', ORIGIN_DATA)).toBe(0.5);
    expect(getEnemyDamageMultiplier('upior_nocy', 'ogien', ORIGIN_DATA)).toBe(2);
    expect(getEnemyDamageMultiplier('bandyta', 'sieczne', ORIGIN_DATA)).toBe(1);

    engine.registerCustomScene(createKamiennaPrzeleczScene());
    engine.loadCustomScene('kamienna_przelecz');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    // Turn first hostile into Upiór nocy adjacent to player to test live multiplier scaling
    const enemy = engine.npcs.find((n) => n.combat?.isHostile)!;
    enemy.id = 'upior_nocy_test';
    enemy.recipe.name = 'Upiór nocy';
    enemy.combat!.hp = 150;
    enemy.combat!.maxHp = 150;
    enemy.tileX = engine.player.tileX + 1;
    enemy.tileY = engine.player.tileY;

    engine.startCombatWithEnemy(enemy.id);
    const out = engine.performPlayerCombatAttack(enemy.id, 'quick', () => 0.2);
    expect(out?.hit).toBe(true);
    expect(engine.combatLogs.some((l) => l.includes('Odporność'))).toBe(true);

    // Oil flask deals 2x fire damage to Upiór nocy
    const hpBeforeOil = enemy.combat!.hp;
    const oilRes = useCombatBeltItem({
      state,
      data: ORIGIN_DATA,
      rng: createRng(7),
      engine,
      slotIndex: 3
    });
    expect(oilRes.used).toBe(true);
    expect(oilRes.message).toContain('Podatność');
    expect(hpBeforeOil - enemy.combat!.hp).toBeGreaterThanOrEqual(12); // min 6 * 2 = 12
  });
});
