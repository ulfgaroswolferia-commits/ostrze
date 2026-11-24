import { describe, expect, it } from 'vitest';
import { isOutdoorMap } from '@ulf/renderer/isoSceneView';
import type { CharacterVisualRecipe } from '@ulf/rpg/characterData';
import {
  bakeBlednikCharacterBuffers,
  bakeSkrzatCharacterBuffers,
  bakeViperCharacterBuffers,
  isBlednikRecipe,
  isBoarRecipe,
  isDogRecipe,
  isSkrzatRecipe,
  isViperRecipe,
  isWolfRecipe
} from '../src/game/assets/beastSprites';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { resolveEnemyOriginId } from '../src/game/rules/combatEnemyMeta';
import { getWorldAtmosphere } from '../src/game/rules/worldCycle';
import { createEmptyOstrzeState } from '../src/game/rules/character';
import { getPhenomenonVisualMeta, PhenomenonOverlay } from '../src/game/ui/phenomenonOverlay';

function countVisiblePixels(rgba: Uint8ClampedArray): number {
  let visible = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] > 40) visible++;
  }
  return visible;
}

class FakeElement {
  public tagName: string;
  public className = '';
  public textContent = '';
  public title = '';
  public width = 0;
  public height = 0;
  public style: Record<string, string> = {};
  public attributes = new Map<string, string>();
  public children: FakeElement[] = [];
  public parent: FakeElement | null = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }

  setAttribute(key: string, value: string): void {
    this.attributes.set(key, value);
  }

  getAttribute(key: string): string | null {
    return this.attributes.get(key) ?? null;
  }

  removeAttribute(key: string): void {
    this.attributes.delete(key);
  }

  getContext(): null {
    return null;
  }
}

describe('Dedicated beast sprite bakers & non-human recipe matching', () => {
  it('matches viper, blednik, skrzat, wolf, boar, and dog without false-matching humans', () => {
    expect(isViperRecipe({ id: 'enemy_zmija_1', name: 'Żmija leśna' })).toBe(true);
    expect(isViperRecipe({ id: 'travel_enemy_0', name: 'Żmija leśna' })).toBe(true);
    expect(isBlednikRecipe({ id: 'enemy_blednik_1', name: 'Błędnik' })).toBe(true);
    expect(isBlednikRecipe({ id: 'travel_enemy_1', name: 'Błędnik z bagien' })).toBe(true);
    expect(isSkrzatRecipe({ id: 'enemy_skrzat_1', name: 'Skrzat-złośnik' })).toBe(true);
    expect(isSkrzatRecipe({ id: 'travel_enemy_2', name: 'Leśny chochlik' })).toBe(true);
    expect(isBoarRecipe({ id: 'travel_enemy_3', name: 'Dzik' })).toBe(true);
    expect(isWolfRecipe({ id: 'enemy_wilk_trakt_1', name: 'Basior Starego Traktu' })).toBe(true);
    expect(isDogRecipe({ id: 'npc_pies_burek', name: 'Burek' })).toBe(true);

    const humans = [
      { id: 'enemy_bandyta_1', name: 'Bandyta' },
      { id: 'npc_kowal_bogdan', name: 'Kowal Bogdan' },
      { id: 'npc_soltys_gluszec', name: 'Sołtys Głuszca' },
      { id: 'enemy_bor_herszt', name: 'Herszt Zbójców' },
      { id: 'enemy_zwiadowca', name: 'Cesarski zwiadowca' },
      { id: 'hero', name: 'Mściwój' }
    ];
    for (const h of humans) {
      expect(isWolfRecipe(h)).toBe(false);
      expect(isDogRecipe(h)).toBe(false);
      expect(isBoarRecipe(h)).toBe(false);
      expect(isViperRecipe(h)).toBe(false);
      expect(isBlednikRecipe(h)).toBe(false);
      expect(isSkrzatRecipe(h)).toBe(false);
    }
  });

  it('bakes valid 8x4 PBR sprite sheets for viper, blednik, and skrzat', () => {
    const viperRecipe = { id: 'enemy_zmija_1', name: 'Żmija leśna' } as CharacterVisualRecipe;
    const blednikRecipe = { id: 'enemy_blednik_1', name: 'Błędnik' } as CharacterVisualRecipe;
    const skrzatRecipe = { id: 'enemy_skrzat_1', name: 'Skrzat-złośnik' } as CharacterVisualRecipe;

    const viper = bakeViperCharacterBuffers(viperRecipe);
    const blednik = bakeBlednikCharacterBuffers(blednikRecipe);
    const skrzat = bakeSkrzatCharacterBuffers(skrzatRecipe);

    for (const [label, sheet] of [
      ['viper', viper],
      ['blednik', blednik],
      ['skrzat', skrzat]
    ] as const) {
      expect(sheet.frameWidth, label).toBe(64);
      expect(sheet.frameHeight, label).toBe(96);
      expect(sheet.directions, label).toBe(8);
      expect(sheet.framesPerDirection, label).toBe(4);
      expect(sheet.sheetWidth, label).toBe(256);
      expect(sheet.sheetHeight, label).toBe(768);
      expect(sheet.albedoRGBA.length, label).toBe(256 * 768 * 4);
      expect(sheet.normalMaterialRGBA.length, label).toBe(256 * 768 * 4);
      expect(countVisiblePixels(sheet.albedoRGBA), label).toBeGreaterThan(2500);
    }

    expect(viper.recipeHash).not.toBe(blednik.recipeHash);
    expect(blednik.recipeHash).not.toBe(skrzat.recipeHash);
  });

  it('resolves canonical enemy origin IDs for all Act I-II beasts and spirits', () => {
    expect(resolveEnemyOriginId('travel_enemy_0', 'Żmija leśna')).toBe('zmija_lesna');
    expect(resolveEnemyOriginId('enemy_bagna_blednik', 'Błędnik')).toBe('blednik');
    expect(resolveEnemyOriginId('enemy_bor_skrzat', 'Skrzat-złośnik')).toBe('skrzat_zlosnik');
    expect(resolveEnemyOriginId('enemy_bagna_utopiec_boss', 'Pradawny Topielec')).toBe('utopiec');
  });
});

describe('PhenomenonOverlay atmospheric layer & HUD badge', () => {
  it('syncs all 9 phenomena from origin/data/phenomena.json and cleans up on clear/destroy', () => {
    const prevDoc = (globalThis as unknown as { document?: unknown }).document;
    const fakeBody = new FakeElement('body');
    (globalThis as unknown as { document: unknown }).document = {
      body: fakeBody,
      createElement: (tag: string) => new FakeElement(tag)
    };

    try {
      const overlay = new PhenomenonOverlay(fakeBody as unknown as HTMLElement);
      const state = createEmptyOstrzeState(ORIGIN_DATA, 42);

      // Clear weather -> hidden
      overlay.sync(getWorldAtmosphere(state, ORIGIN_DATA));
      expect(overlay.getActivePhenomenonId()).toBeNull();
      expect(fakeBody.children.length).toBe(2);
      const [layerEl, badgeEl] = fakeBody.children;
      expect(layerEl.style.display).toBe('none');
      expect(badgeEl.style.display).toBe('none');

      // Every single phenomenon from phenomena.json activates layer & badge
      expect(ORIGIN_DATA.phenomena.length).toBe(9);
      for (const ph of ORIGIN_DATA.phenomena) {
        state.world.activePhenomenon = ph.id;
        const snap = getWorldAtmosphere(state, ORIGIN_DATA);
        const meta = getPhenomenonVisualMeta(ph.id);
        expect(meta).not.toBeNull();

        overlay.sync(snap);
        expect(overlay.getActivePhenomenonId()).toBe(ph.id);
        expect(layerEl.style.display).toBe('block');
        expect(layerEl.getAttribute('data-phenomenon')).toBe(ph.id);
        expect(badgeEl.style.display).toBe('inline-flex');
        expect(badgeEl.getAttribute('data-phenomenon')).toBe(ph.id);
        expect(badgeEl.textContent).toContain(ph.name);
        expect(badgeEl.textContent).toContain(meta!.icon);
      }

      // Clearing phenomenon hides layer & badge again
      state.world.activePhenomenon = null;
      overlay.sync(getWorldAtmosphere(state, ORIGIN_DATA));
      expect(overlay.getActivePhenomenonId()).toBeNull();
      expect(layerEl.style.display).toBe('none');
      expect(badgeEl.style.display).toBe('none');

      overlay.destroy();
      expect(fakeBody.children.length).toBe(0);
    } finally {
      (globalThis as unknown as { document?: unknown }).document = prevDoc;
    }
  });

  it('distinguishes outdoor maps from underground stone crypts/mines for ambient particles', () => {
    const outdoorMap = {
      width: 2,
      height: 2,
      tiles: [
        [{ terrain: 'forest_grass' as const }, { terrain: 'dirt_path' as const }],
        [{ terrain: 'forest_grass' as const }, { terrain: 'forest_soil' as const }]
      ],
      props: [{ kind: 'ancient_oak' as const }]
    };
    const dungeonMap = {
      width: 2,
      height: 2,
      tiles: [
        [{ terrain: 'dungeon_stone' as const }, { terrain: 'dungeon_stone' as const }],
        [{ terrain: 'dungeon_stone' as const }, { terrain: 'dungeon_stone' as const }]
      ],
      props: [{ kind: 'sarcophagus' as const }]
    };

    expect(isOutdoorMap(outdoorMap)).toBe(true);
    expect(isOutdoorMap(dungeonMap)).toBe(false);
  });
});
