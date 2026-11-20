import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import {
  COMBAT_BELT_AP_COST,
  pinItemToQuickBelt,
  resolveQuickBeltSlots,
  useCombatBeltItem
} from '../src/game/rules/combatConsumables';
import { createRng } from '../src/game/rules/dice';

function setupCombatHero() {
  const data = ORIGIN_DATA;
  const state = createEmptyOstrzeState(data, 42);
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
    data
  );

  // Give one of each belt category
  state.inventory.items = [
    { id: 'napar_ziol', qty: 2 },
    { id: 'opatrunek', qty: 1 },
    { id: 'loj_do_ostrza', qty: 1 },
    { id: 'garnek_huku', qty: 1 }
  ];

  const engine = new OstrzeEngineState();
  engine.registerCustomScene(createBrzezinaYardScene({ sparingHostile: true }));
  engine.loadCustomScene('brzezina_dziedziniec');
  engine.syncFromOstrzeState(state, data);

  const enemy = engine.npcs.find((n) => n.combat?.isHostile)!;
  engine.startCombatWithEnemy(enemy.id);

  return { data, state, engine, enemy, rng: createRng(42) };
}

describe('Filar 1: Combat Quick-Use Belt (4 slots, 2 AP)', () => {
  it('auto-fills 4 slots by category and honors manual pin overrides', () => {
    const { data, state } = setupCombatHero();

    const autoSlots = resolveQuickBeltSlots(state, data, 6, {
      playerHp: 20,
      playerMaxHp: 40,
      hasLivingEnemy: true
    });

    expect(autoSlots[0]?.itemId).toBe('napar_ziol');
    expect(autoSlots[0]?.category).toBe('heal');
    expect(autoSlots[1]?.itemId).toBe('opatrunek');
    expect(autoSlots[1]?.category).toBe('remedy');
    expect(autoSlots[2]?.itemId).toBe('loj_do_ostrza');
    expect(autoSlots[2]?.category).toBe('buff');
    expect(autoSlots[3]?.itemId).toBe('garnek_huku');
    expect(autoSlots[3]?.category).toBe('throwable');

    // Manual pin puts garnek_huku in slot 0 ([4]) without duplicating it in slot 3
    pinItemToQuickBelt(state, 0, 'garnek_huku');
    const pinnedSlots = resolveQuickBeltSlots(state, data, 6, {
      playerHp: 20,
      playerMaxHp: 40,
      hasLivingEnemy: true
    });
    expect(pinnedSlots[0]?.itemId).toBe('garnek_huku');
    expect(pinnedSlots[3]).toBeNull();
  });

  it('heals player, spends 2 AP, removes bleeding, and decrements inventory qty', () => {
    const { data, state, engine, rng } = setupCombatHero();
    const pCombat = engine.player.combat!;
    pCombat.hp = 12;
    state.character!.hp = 12;
    state.character!.effects.push({ id: 'krwawienie', stacks: 1, remainingHours: 1 });
    const startAp = pCombat.ap;

    // Slot 1 is opatrunek (heals + removes krwawienie)
    const res = useCombatBeltItem({ state, data, rng, engine, slotIndex: 1 });
    expect(res.used).toBe(true);
    expect(pCombat.ap).toBe(startAp - COMBAT_BELT_AP_COST);
    expect(pCombat.hp).toBeGreaterThan(12);
    expect(state.character!.hp).toBe(pCombat.hp);
    expect(state.character!.effects.some((e) => e.id === 'krwawienie')).toBe(false);
    expect(state.inventory.items.find((i) => i.id === 'opatrunek')).toBeUndefined();
  });

  it('applies buff (loj_do_ostrza) and throws garnek_huku to damage & stun active enemy', () => {
    const { data, state, engine, enemy, rng } = setupCombatHero();
    const pCombat = engine.player.combat!;
    pCombat.ap = 6;
    const baseBonus = pCombat.customDamageBonus ?? 0;

    // Slot 2: loj_do_ostrza
    const buffRes = useCombatBeltItem({ state, data, rng, engine, slotIndex: 2 });
    expect(buffRes.used).toBe(true);
    expect(state.character!.effects.some((e) => e.id === 'natluszczone_ostrze')).toBe(true);
    expect(pCombat.customDamageBonus).toBe(baseBonus + 2);

    // Slot 3: garnek_huku
    const enemyHpBefore = enemy.combat!.hp;
    const throwRes = useCombatBeltItem({ state, data, rng, engine, slotIndex: 3 });
    expect(throwRes.used).toBe(true);
    expect(enemy.combat!.hp).toBeLessThan(enemyHpBefore);
    expect(enemy.combat!.dazedHeadTurns).toBeGreaterThanOrEqual(1);
    expect(pCombat.ap).toBe(6 - COMBAT_BELT_AP_COST * 2);
  });
});
