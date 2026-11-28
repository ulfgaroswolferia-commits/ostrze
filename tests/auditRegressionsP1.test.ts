import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createTraktZasadzkaScene } from '../src/game/maps/prologueMaps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { evaluateCondition } from '../src/game/rules/conditions';
import { executeDialogueActions } from '../src/game/rules/dialogueEngine';

function makeTestState() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 777);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 8,
        zrecznosc: 7,
        krzepa: 5,
        bystrosc: 5,
        rozum: 6,
        oglada: 5,
        fart: 5
      },
      tagged: ['sieczna', 'wymowa', 'skradanie']
    },
    ORIGIN_DATA
  );
  return state;
}

describe('Audit P1 regressions', () => {
  it('preserves enemy Guard, Feint perk, and Surprise flag when player attack is rejected (0 AP / out of range)', () => {
    const engine = new OstrzeEngineState();
    const state = makeTestState();
    state.character!.perks.push('finta');

    const scene = createTraktZasadzkaScene();
    engine.registerCustomScene(scene);
    engine.loadCustomScene(scene.id);
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const enemy = engine.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    engine.startCombatWithEnemy(enemy.id);
    enemy.combat!.defending = true;
    engine.player.combat!.ap = 0; // force rejection
    engine.pendingSurpriseAttack = true;

    const outcome = engine.performPlayerCombatAttack(enemy.id, 'power');
    expect(outcome).toBeNull();
    expect(enemy.combat!.defending).toBe(true);
    expect(engine.pendingSurpriseAttack).toBe(true);
  });

  it('blocks detonateOilBarrel and weapon maneuver during enemy turn', () => {
    const engine = new OstrzeEngineState();
    const state = makeTestState();
    const scene = createTraktZasadzkaScene();
    scene.map.props.push({
      id: 'oil_barrel_p1_turn',
      kind: 'dungeon_barrel',
      name: 'Beczka ze smołą',
      x: scene.spawnX + 1,
      y: scene.spawnY,
      z: 0,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1,
      interactive: false,
      blocksMovement: true,
      blocksSight: false
    });
    engine.registerCustomScene(scene);
    engine.loadCustomScene(scene.id);
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const enemy = engine.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    engine.startCombatWithEnemy(enemy.id);
    engine.combatState.activeTurnActorId = enemy.id;

    expect(engine.getWeaponManeuverState(enemy.id).canUse).toBe(false);
    expect(engine.detonateOilBarrel('oil_barrel_p1_turn').ok).toBe(false);
  });

  it('matches questStatus "done" against "completed" and executes xp + giveRandom dialogue actions', () => {
    const state = makeTestState();
    state.quests.zaginiona_karawana = 'completed';
    expect(
      evaluateCondition({ questStatus: { id: 'zaginiona_karawana', is: 'done' } }, state, ORIGIN_DATA)
    ).toBe(true);

    const xpBefore = state.character!.xp;
    const itemsBefore = state.inventory.items.reduce((sum, i) => sum + i.qty, 0);
    executeDialogueActions(
      [
        { xp: 25 } as unknown as { giveXp?: number },
        { giveRandom: 'lupy_znalezisko_pogorze' } as unknown as { giveItem?: string }
      ],
      state,
      ORIGIN_DATA
    );
    expect(state.character!.xp).toBe(xpBefore + 25);
    const itemsAfter = state.inventory.items.reduce((sum, i) => sum + i.qty, 0);
    expect(itemsAfter).toBeGreaterThan(itemsBefore);
  });
});
