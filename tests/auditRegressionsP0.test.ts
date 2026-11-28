import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createWilczyBrodScene, createWilczyLasScene } from '../src/game/maps/chapter1Maps';
import { createTraktZasadzkaScene } from '../src/game/maps/prologueMaps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import { Chapter1Director } from '../src/game/scenes/Chapter1Director';
import { Chapter2Director } from '../src/game/scenes/Chapter2Director';

function makeTestState() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 12345);
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

describe('Audit P0 regressions', () => {
  it('fires onCombatEnded("victory") exactly once on oil barrel kill even after engine.update()', () => {
    const engine = new OstrzeEngineState();
    const state = makeTestState();
    const templateScene = createTraktZasadzkaScene();
    const originalPropCount = templateScene.map.props.length;

    // Add an oil barrel right next to player & enemy
    templateScene.map.props.push({
      id: 'oil_barrel_test_p0',
      kind: 'dungeon_barrel',
      name: 'Beczka ze smołą',
      x: templateScene.spawnX + 1,
      y: templateScene.spawnY,
      z: 0,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1,
      interactive: false,
      blocksMovement: true,
      blocksSight: false
    });
    const templateCountWithBarrel = templateScene.map.props.length;
    expect(templateCountWithBarrel).toBe(originalPropCount + 1);

    engine.registerCustomScene(templateScene);
    engine.loadCustomScene(templateScene.id);
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    // Keep only 1 fragile hostile right next to the barrel
    const hostiles = engine.npcs.filter((n) => n.combat?.isHostile);
    expect(hostiles.length).toBeGreaterThan(0);
    for (let i = 1; i < hostiles.length; i++) {
      hostiles[i].combat!.hp = 0;
      hostiles[i].combat!.isAlive = false;
    }
    const target = hostiles[0];
    target.tileX = templateScene.spawnX + 2;
    target.tileY = templateScene.spawnY;
    target.x = target.tileX + 0.5;
    target.y = target.tileY + 0.5;
    target.combat!.hp = 1;

    let victoryCount = 0;
    engine.onCombatEnded = (outcome) => {
      if (outcome === 'victory') victoryCount += 1;
    };

    engine.startCombatWithEnemy(target.id);
    engine.update(0.016); // sets wasCombatActive = true

    const res = engine.detonateOilBarrel('oil_barrel_test_p0', () => 0.5);
    expect(res.ok).toBe(true);
    expect(victoryCount).toBe(1);

    // Next update frame must NOT fire onCombatEnded a second time
    engine.update(0.016);
    expect(victoryCount).toBe(1);

    // Exploded barrel tile must no longer block movement in propGrid
    expect(engine.getPropAtTile(templateScene.spawnX + 1, templateScene.spawnY)).toBeUndefined();

    // Template scene must remain unmutated when reloaded
    expect(templateScene.map.props.length).toBe(templateCountWithBarrel);
    engine.loadCustomScene(templateScene.id);
    expect(engine.map.props.length).toBe(templateCountWithBarrel);
  });

  it('Chapter1Director.restoreFromSave restores combat stage for arenas and clears stale hunt scenes', () => {
    const engine = new OstrzeEngineState();
    const state = makeTestState();
    const rng = createRng(42);
    const ch1 = new Chapter1Director({ engine, state, rng });

    // Simulate entering a hostile satellite hunt (overwrites wilczy_las with hostiles)
    engine.registerCustomScene(createWilczyBrodScene());
    engine.registerCustomScene(createWilczyLasScene({ withHunt: true }));

    // Restoring into 'wilcza_nora' must arm activeCombatStage='wilcza_nora' so combat end doesn't softlock
    ch1.restoreFromSave('wilcza_nora');
    expect(engine.activeCustomSceneId).toBe('wilcza_nora');
    expect((ch1 as unknown as { activeCombatStage: string }).activeCombatStage).toBe('wilcza_nora');

    // Restoring into 'wilczy_las' must re-register non-hunt version (no stale hostile pack)
    ch1.restoreFromSave('wilczy_las');
    expect(engine.activeCustomSceneId).toBe('wilczy_las');
    expect((ch1 as unknown as { activeCombatStage: string }).activeCombatStage).toBe('none');
    const livingHostiles = engine.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
    expect(livingHostiles.length).toBe(0);
  });

  it('Chapter2Director resets chapter2Completed on restoreFromSave and resetRuntimeState', () => {
    const engine = new OstrzeEngineState();
    const state = makeTestState();
    const rng = createRng(99);
    const ch2 = new Chapter2Director({ engine, state, rng });

    ch2.finishChapter2(false);
    expect((ch2 as unknown as { chapter2Completed: boolean }).chapter2Completed).toBe(true);

    ch2.restoreFromSave('gluszec');
    expect((ch2 as unknown as { chapter2Completed: boolean }).chapter2Completed).toBe(false);

    ch2.finishChapter2(true);
    expect((ch2 as unknown as { chapter2Completed: boolean }).chapter2Completed).toBe(true);

    ch2.resetRuntimeState();
    expect((ch2 as unknown as { chapter2Completed: boolean }).chapter2Completed).toBe(false);
  });
});
