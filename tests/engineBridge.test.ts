import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { createTestBrzezinaYardScene } from '../src/game/maps/testYardMap';

describe('OstrzeEngineState bridge', () => {
  it('registers and loads a custom 2.5D Ostrze scene without mutating ulfRPG', () => {
    const game = new OstrzeEngineState();
    const { scene, dialogues } = createTestBrzezinaYardScene();

    game.registerDialogues(dialogues);
    game.registerCustomScene(scene);

    const loaded = game.loadCustomScene('brzezina_test_yard');
    expect(loaded).toBe(true);
    expect(game.activeCustomSceneId).toBe('brzezina_test_yard');
    expect(game.map.name).toContain('Brzezina');
    expect(game.player.tileX).toBe(9);
    expect(game.player.tileY).toBe(11);
    expect(game.npcs.some((npc) => npc.id === 'npc_gnieworad')).toBe(true);
  });

  it('returns false for unknown custom scene IDs', () => {
    const game = new OstrzeEngineState();
    expect(game.loadCustomScene('non_existent_scene')).toBe(false);
  });

  it('clones scene actors on load so runtime mutations do not leak across reloads', () => {
    const game = new OstrzeEngineState();
    const { scene } = createTestBrzezinaYardScene();
    game.registerCustomScene(scene);

    game.loadCustomScene('brzezina_test_yard');
    const npcFirst = game.npcs.find((n) => n.id === 'npc_gnieworad')!;
    npcFirst.tileX = 1;
    npcFirst.recipe.equipment.mainHand = null;

    game.loadCustomScene('brzezina_test_yard');
    const npcSecond = game.npcs.find((n) => n.id === 'npc_gnieworad')!;
    expect(npcSecond.tileX).toBe(9);
    expect(npcSecond.recipe.equipment.mainHand).toBe('weapon_sunblade_longsword');
  });
});
