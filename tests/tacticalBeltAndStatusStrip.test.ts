import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createWilczyBrodScene } from '../src/game/maps/chapter1Maps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { useCombatBeltItem } from '../src/game/rules/combatConsumables';
import { createRng } from '../src/game/rules/dice';
import { CombatTargetOverlay } from '../src/game/ui/combatTargetOverlay';

function makeHero() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 77);
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
      tagged: ['sieczna', 'medycyna', 'wymowa']
    },
    ORIGIN_DATA
  );
  return state;
}

describe('Tactical Quick-Use Belt upgrades & player combat status strip', () => {
  it('applies Burn DoT from flasza_oleju and scales tick damage by wraith fire vulnerability', () => {
    const state = makeHero();
    state.inventory.items = [{ id: 'flasza_oleju', qty: 1 }];
    state.inventory.quickBelt = [null, null, null, 'flasza_oleju'];

    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createWilczyBrodScene());
    engine.loadCustomScene('wilczy_brod');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const wraith = engine.npcs[0];
    wraith.id = 'enemy_upior_test';
    wraith.recipe.name = 'Upiór nocy';
    wraith.combat = {
      hp: 60,
      maxHp: 60,
      ap: 6,
      maxAp: 6,
      proficiencies: engine.player.combat!.proficiencies,
      isHostile: true,
      isAlive: true,
      xpReward: 50,
      lootTable: [],
      difficulty: 'normal',
      aggroRadius: 8,
      dazedHeadTurns: 0,
      crippledLegsTurns: 0,
      defending: false
    };
    engine.combatState.active = true;
    engine.combatState.selectedTargetId = wraith.id;
    engine.player.combat!.ap = 8;

    const res = useCombatBeltItem({
      state,
      data: ORIGIN_DATA,
      rng: createRng(10),
      engine,
      slotIndex: 3
    });
    expect(res.used).toBe(true);
    expect(res.message).toContain('PODPALENIE');
    expect(engine.getEnemyBurnTurns(wraith.id)).toBe(2);

    const hpBeforeTick = wraith.combat.hp;
    const tickDmg = engine.tickEnemyBurn(wraith, () => 0.0); // base 3 * 2 (wraith ogien weakness) = 6
    expect(tickDmg).toBe(6);
    expect(wraith.combat.hp).toBe(hpBeforeTick - 6);
    expect(engine.getEnemyBurnTurns(wraith.id)).toBe(1);
  });

  it('swieca_dymna grants Guard and dazes adjacent hostile enemies within 2 tiles', () => {
    const state = makeHero();
    state.inventory.items = [{ id: 'swieca_dymna', qty: 1 }];
    state.inventory.quickBelt = [null, null, null, 'swieca_dymna'];

    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createWilczyBrodScene());
    engine.loadCustomScene('wilczy_brod');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const nearEnemy = engine.npcs[0];
    nearEnemy.tileX = engine.player.tileX + 1;
    nearEnemy.tileY = engine.player.tileY;
    nearEnemy.combat = {
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

    engine.combatState.active = true;
    engine.player.combat!.ap = 8;

    const res = useCombatBeltItem({
      state,
      data: ORIGIN_DATA,
      rng: createRng(2),
      engine,
      slotIndex: 3
    });
    expect(res.used).toBe(true);
    expect(engine.player.combat!.defending).toBe(true);
    expect(nearEnemy.combat.dazedHeadTurns).toBeGreaterThanOrEqual(1);
  });

  it('renders enemy Burn pill and player status strip with cure slot hint in CombatTargetOverlay', () => {
    const prevDoc = (globalThis as unknown as { document?: unknown }).document;
    const fakeRoot = {
      id: '',
      innerHTML: '',
      remove: () => undefined,
      querySelectorAll: () => []
    };
    (globalThis as unknown as { document: unknown }).document = {
      body: { appendChild: () => undefined },
      getElementById: () => null,
      createElement: () => fakeRoot
    };

    try {
      const state = makeHero();
      state.character!.perks.push('finta');
      state.character!.effects.push({ id: 'natluszczone_ostrze', stacks: 1, remainingHours: 2 });
      state.inventory.items = [{ id: 'opatrunek', qty: 1 }];
      state.inventory.quickBelt = ['opatrunek', null, null, null];

      const engine = new OstrzeEngineState();
      engine.registerCustomScene(createWilczyBrodScene());
      engine.loadCustomScene('wilczy_brod');
      engine.syncFromOstrzeState(state, ORIGIN_DATA);

      const enemy = engine.npcs[0];
      enemy.combat = {
        hp: 25,
        maxHp: 25,
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
      engine.combatState.active = true;
      engine.combatState.round = 1;
      engine.combatState.selectedTargetId = enemy.id;
      engine.player.combat!.defending = true;
      engine.applyEnemyBurn(enemy.id, 2);

      const overlay = new CombatTargetOverlay(engine, ORIGIN_DATA);
      overlay.sync();

      expect(fakeRoot.innerHTML).toContain('Podpalony (2 t.)');
      expect(fakeRoot.innerHTML).toContain('data-player-combat-status="true"');
      expect(fakeRoot.innerHTML).toContain('Garda aktywna');
      expect(fakeRoot.innerHTML).toContain('Natłuszczone ostrze');
      expect(fakeRoot.innerHTML).toContain('Finta gotowa');
      overlay.destroy();
    } finally {
      (globalThis as unknown as { document?: unknown }).document = prevDoc;
    }
  });
});
