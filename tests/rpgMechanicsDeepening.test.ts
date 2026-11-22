import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createWilczyBrodScene } from '../src/game/maps/chapter1Maps';
import {
  CAMP_RECIPES,
  canPerformCampRecipe,
  performCampRecipe
} from '../src/game/rules/campCrafting';
import {
  createCharacter,
  createEmptyOstrzeState,
  getAvailablePerks,
  grantXp,
  xpRequiredForLevel
} from '../src/game/rules/character';
import { useCombatBeltItem } from '../src/game/rules/combatConsumables';
import { createRng } from '../src/game/rules/dice';
import { getStats } from '../src/game/rules/stats';

function makeTestHero(levelTarget = 4) {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 123);
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
        rozum: 8,
        oglada: 4,
        fart: 4
      },
      tagged: ['sieczna', 'medycyna', 'wiedza_tajemna']
    },
    ORIGIN_DATA
  );
  if (levelTarget > 1) {
    grantXp(state, xpRequiredForLevel(levelTarget, ORIGIN_DATA.rules.leveling.xpStep), ORIGIN_DATA);
  }
  return state;
}

describe('RPG mechanics deepening: combat perks, new camp recipes & level 4-8 progression', () => {
  it('computes bonusDamage, critChance, and status resistances from perks & syncs to 2.5D combat', () => {
    const state = makeTestHero(4);
    const ch = state.character!;
    const baseStats = getStats(state, ORIGIN_DATA);

    ch.perks.push('twarda_reka', 'czytanie_walki', 'nieugiety', 'chlodna_glowa');
    ch.effects.push({ id: 'natluszczone_ostrze', stacks: 1, remainingHours: 2 });

    const perkStats = getStats(state, ORIGIN_DATA);
    expect(perkStats.derived.bonusDamage).toBe(baseStats.derived.bonusDamage + 4);
    expect(perkStats.derived.critChance).toBe(baseStats.derived.critChance + 5);
    expect(perkStats.derived.resistStrach).toBe(25);
    expect(perkStats.derived.resistOgluszenie).toBe(25);
    expect(perkStats.derived.resistRozkojarzenie).toBe(25);

    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createWilczyBrodScene());
    engine.loadCustomScene('wilczy_brod');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    expect(engine.player.combat?.customDamageBonus).toBe(
      Math.floor((perkStats.attributes.sila - 5) / 2) + perkStats.derived.bonusDamage
    );
    const snap = engine.getActorCombatant(engine.player);
    expect(snap.derived.critChancePct).toBeGreaterThanOrEqual(perkStats.derived.critChance);
  });

  it('activates Mistrz finty on first player attack per round and breaks enemy Guard', () => {
    const state = makeTestHero(4);
    state.character!.perks.push('finta');

    const engine = new OstrzeEngineState();
    const scene = createWilczyBrodScene();
    engine.registerCustomScene(scene);
    engine.loadCustomScene('wilczy_brod');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const enemy = engine.npcs[0];
    enemy.tileX = engine.player.tileX + 1;
    enemy.tileY = engine.player.tileY;
    enemy.x = enemy.tileX + 0.5;
    enemy.y = enemy.tileY + 0.5;
    enemy.combat = {
      hp: 40,
      maxHp: 40,
      ap: 6,
      maxAp: 6,
      proficiencies: engine.player.combat!.proficiencies,
      isHostile: true,
      isAlive: true,
      xpReward: 20,
      lootTable: [],
      difficulty: 'normal',
      aggroRadius: 8,
      dazedHeadTurns: 0,
      crippledLegsTurns: 0,
      defending: true
    };
    engine.combatState.active = true;
    engine.combatState.round = 1;
    engine.combatState.activeTurnActorId = engine.player.id;
    engine.player.combat!.ap = 10;

    engine.performPlayerCombatAttack(enemy.id, undefined, () => 0.1);
    expect(enemy.combat.defending).toBe(false);
    expect(engine.combatLogs.some((l) => l.includes('Mistrz finty'))).toBe(true);
  });

  it('applies Cyrulik (+25% heal) and Sokole oko (+2 throwable damage) in Quick-Use Belt', () => {
    const state = makeTestHero(4);
    const ch = state.character!;
    ch.perks.push('cyrulik', 'sokole_oko');
    state.inventory.items = [
      { id: 'opatrunek', qty: 2 },
      { id: 'flasza_oleju', qty: 1 }
    ];
    state.inventory.quickBelt = ['opatrunek', null, null, 'flasza_oleju'];

    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createWilczyBrodScene());
    engine.loadCustomScene('wilczy_brod');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    engine.combatState.active = true;
    engine.player.combat!.hp = 10;
    engine.player.combat!.ap = 8;

    const enemy = engine.npcs[0];
    enemy.combat = {
      hp: 30,
      maxHp: 30,
      ap: 6,
      maxAp: 6,
      proficiencies: engine.player.combat!.proficiencies,
      isHostile: true,
      isAlive: true,
      xpReward: 20,
      lootTable: [],
      difficulty: 'normal',
      aggroRadius: 8,
      dazedHeadTurns: 0,
      crippledLegsTurns: 0,
      defending: false
    };

    const rng = createRng(99);
    const healRes = useCombatBeltItem({ state, data: ORIGIN_DATA, rng, engine, slotIndex: 0 });
    expect(healRes.used).toBe(true);
    expect(healRes.message).toContain('Cyrulik');

    const throwRes = useCombatBeltItem({ state, data: ORIGIN_DATA, rng, engine, slotIndex: 3 });
    expect(throwRes.used).toBe(true);
    expect(throwRes.message).toContain('Sokole oko');
  });

  it('crafts all 4 new canonical camp recipes (gulasz, loj_do_ostrza, flasza_oleju, swieca_dymna)', () => {
    const state = makeTestHero(4);
    state.inventory.items = [
      { id: 'mieso', qty: 2 },
      { id: 'grzyby', qty: 2 },
      { id: 'ziola_lesne', qty: 2 },
      { id: 'bimber', qty: 1 },
      { id: 'loj_do_ostrza', qty: 2 }
    ];
    const rng = createRng(42);

    const newIds = ['camp_cook_gulasz', 'camp_render_oil', 'brew_flasza_oleju', 'brew_swieca_dymna'];
    for (const id of newIds) {
      const recipe = CAMP_RECIPES.find((r) => r.id === id);
      expect(recipe, `missing recipe ${id}`).toBeDefined();
      expect(canPerformCampRecipe(state, ORIGIN_DATA, recipe!).ok, id).toBe(true);
      const res = performCampRecipe({ state, data: ORIGIN_DATA, rng, recipeId: id });
      expect(res.ok, id).toBe(true);
    }

    const owned = new Set(state.inventory.items.filter((i) => i.qty > 0).map((i) => i.id));
    expect(owned.has('gulasz')).toBe(true);
    expect(owned.has('flasza_oleju')).toBe(true);
    expect(owned.has('swieca_dymna')).toBe(true);
  });

  it('scales level 1 to 8 cleanly and unlocks level-4 perks (nieugiety, finta, szczesciarz)', () => {
    const state = makeTestHero(1);
    const ch = state.character!;
    expect(ch.level).toBe(1);

    const lv1PerkIds = new Set(getAvailablePerks(state, ORIGIN_DATA).map((p) => p.id));
    expect(lv1PerkIds.has('nieugiety')).toBe(false);
    expect(lv1PerkIds.has('finta')).toBe(false);

    // Advance to level 4 -> unlocks level 4 perks
    grantXp(state, xpRequiredForLevel(4, ORIGIN_DATA.rules.leveling.xpStep), ORIGIN_DATA);
    expect(ch.level).toBe(4);
    expect(ch.freePerkPicks).toBeGreaterThanOrEqual(2);
    const lv4PerkIds = new Set(getAvailablePerks(state, ORIGIN_DATA).map((p) => p.id));
    expect(lv4PerkIds.has('nieugiety')).toBe(true);
    expect(lv4PerkIds.has('finta')).toBe(true);
    expect(lv4PerkIds.has('szczesciarz')).toBe(true);

    // Advance to level 8 -> monotonic XP & HP growth
    const hpLv4 = getStats(state, ORIGIN_DATA).derived.hpMax;
    const neededForLv8 =
      xpRequiredForLevel(8, ORIGIN_DATA.rules.leveling.xpStep) - ch.xp;
    grantXp(state, neededForLv8, ORIGIN_DATA);
    expect(ch.level).toBe(8);
    expect(getStats(state, ORIGIN_DATA).derived.hpMax).toBeGreaterThan(hpLv4);
  });
});
