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
});
