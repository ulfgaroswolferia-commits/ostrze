import {
  bakeCharacterBuffers,
  generateRandomCharacterRecipe
} from '@ulf/assets/characterBakery';
import { describe, expect, it } from 'vitest';
import { createPobojowiskoSwitScene } from '../src/game/maps/prologueMaps';

describe('Fallen ambush corpses and unclipped hero sprites', () => {
  it('marks fallen ambush companions in Pobojowisko as lying dead corpses (isFallenCorpse)', () => {
    const scene = createPobojowiskoSwitScene();
    const actors = scene.actors ?? [];
    for (const id of [
      'npc_pobojowisko_skarimir',
      'npc_pobojowisko_ragnoslawa',
      'npc_pobojowisko_wojmir'
    ]) {
      const actor = actors.find((a) => a.id === id);
      expect(actor, `Expected ${id}`).toBeDefined();
      expect(actor?.isFallenCorpse).toBe(true);
    }
  });

  it('bakes complete 8x4 hero sprite sheet without clipping the top of the head', () => {
    const recipe = generateRandomCharacterRecipe(1001, 'player_hero');
    recipe.equipment.head = null;
    const baked = bakeCharacterBuffers(recipe);
    expect(baked.frameWidth).toBe(64);
    expect(baked.frameHeight).toBe(96);

    for (let dir = 0; dir < 8; dir++) {
      for (let frame = 0; frame < 4; frame++) {
        let topRowPixels = 0;
        const sy = dir * baked.frameHeight;
        for (let x = 0; x < baked.frameWidth; x++) {
          const sx = frame * baked.frameWidth + x;
          if (baked.albedoRGBA[(sy * baked.sheetWidth + sx) * 4 + 3] > 20) {
            topRowPixels++;
          }
        }
        expect(topRowPixels, `Head clipped at y=0 in dir=${dir}, frame=${frame}`).toBe(0);
      }
    }
  });
});
