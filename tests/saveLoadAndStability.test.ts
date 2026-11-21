import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import { Chapter1Director } from '../src/game/scenes/Chapter1Director';
import { PrologueDirector } from '../src/game/scenes/PrologueDirector';
import { OSTRZE_LOCATIONS } from '../src/game/rules/travel';
import {
  CHAPTER_DEV_SCENES,
  clearOstrzeSave,
  exportSaveKey,
  hasOstrzeSave,
  importSaveKey,
  isValidChapterId,
  loadOstrzeGame,
  normalizeSavePayload,
  saveOstrzeGame,
  VALID_CHAPTER_IDS
} from '../src/game/state/saveManager';

function createSampleState() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 2026);
  createCharacter(
    state,
    {
      name: 'Mściwój z Brzeziny',
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
  state.vars.wiez_skarimir = 3;
  state.vars.wiez_ragnoslawa = 3;
  state.vars.wiez_wojmir = 2;
  state.flags.przysluga_skarimir_done = true;
  state.flags.mlyn_wizja_szkla = true;
  state.inventory.items.push(
    { id: 'kosc_skarimira', qty: 1 },
    { id: 'miedziak_ragnoslawy', qty: 1 },
    { id: 'list_wojmira', qty: 1 }
  );
  state.inventory.quickBelt = ['opatrunek', 'napar_ziol', null, null];
  return state;
}

describe('Save/Load E2E, Portable Keys & Restore Stability', () => {
  it('round-trips OSTRZE1 portable save keys with Unicode names, companion bonds, keepsakes and quickBelt', () => {
    const state = createSampleState();
    const key = exportSaveKey({
      chapter: 'chapter1',
      sceneId: 'wilczy_brod',
      state
    });
    expect(key).not.toBeNull();
    expect(key!.startsWith('OSTRZE1:')).toBe(true);

    const restored = importSaveKey(key!);
    expect(restored).not.toBeNull();
    expect(restored!.chapter).toBe('chapter1');
    expect(restored!.sceneId).toBe('wilczy_brod');
    expect(restored!.state.character?.name).toBe('Mściwój z Brzeziny');
    expect(restored!.state.vars.wiez_skarimir).toBe(3);
    expect(restored!.state.vars.wiez_ragnoslawa).toBe(3);
    expect(restored!.state.vars.wiez_wojmir).toBe(2);
    expect(restored!.state.flags.mlyn_wizja_szkla).toBe(true);
    expect(restored!.state.inventory.items.some((i) => i.id === 'kosc_skarimira')).toBe(true);
    expect(restored!.state.inventory.quickBelt?.[0]).toBe('opatrunek');
  });

  it('rejects corrupted keys and safely normalizes legacy v1 payloads missing newer fields', () => {
    expect(importSaveKey('')).toBeNull();
    expect(importSaveKey('INVALID_PREFIX:abc')).toBeNull();
    expect(importSaveKey('OSTRZE1:!!!not-base64!!!')).toBeNull();

    const state = createSampleState();
    // Simulate a legacy v1 payload missing quickBelt, visitedLocations, vars, and effects
    const legacyRaw = {
      version: 1,
      savedAt: '2026-01-01T00:00:00.000Z',
      chapter: 'prologue',
      sceneId: 'brzezina_dziedziniec',
      prologueStep: 'brzezina_towarzysze',
      state: {
        ...state,
        vars: undefined,
        inventory: {
          items: state.inventory.items,
          equipped: state.inventory.equipped
        },
        world: {
          location: 'brzezina',
          knownPlaces: ['brzezina'],
          failedChecks: [],
          activePhenomenon: null
        },
        character: {
          ...state.character!,
          effects: undefined
        }
      }
    };

    const normalized = normalizeSavePayload(legacyRaw);
    expect(normalized).not.toBeNull();
    expect(normalized!.state.vars).toEqual({});
    expect(normalized!.state.inventory.quickBelt).toEqual([null, null, null, null]);
    expect(normalized!.state.world.eventsSeen).toEqual([]);
    expect(normalized!.state.character?.effects).toEqual([]);

    expect(VALID_CHAPTER_IDS).toEqual(['prologue', 'chapter1']);
    expect(CHAPTER_DEV_SCENES.map((s) => s.id)).toEqual([...VALID_CHAPTER_IDS]);
    expect(isValidChapterId('prologue')).toBe(true);
    expect(isValidChapterId('chapter1')).toBe(true);
    expect(isValidChapterId('unknown_chapter')).toBe(false);
    expect(normalizeSavePayload({ ...legacyRaw, chapter: 'unknown_chapter' })).toBeNull();
  });

  it('restores Prologue phases cleanly — including removing npc_noc_* silhouettes in noc_istota', () => {
    const engine = new OstrzeEngineState();
    const director = new PrologueDirector({ engine, seed: 2026 });
    Object.assign(director.state, createSampleState());

    // 1. brzezina_towarzysze -> Courier present, companions marked
    director.restoreFromSave('brzezina_towarzysze', 'brzezina_dziedziniec');
    expect(engine.npcs.some((n) => n.id === 'npc_kurier')).toBe(true);
    expect(engine.npcs.find((n) => n.id === 'npc_skarimir')?.speechBubbleText).toBe('❗ Skarimir');

    // 2. trakt_ognisko -> bandits cleared, campfire & companions present
    director.restoreFromSave('trakt_ognisko', 'trakt_zasadzka');
    expect(engine.npcs.some((n) => n.id.startsWith('enemy_bandyta_'))).toBe(false);
    expect(engine.npcs.some((n) => n.id === 'npc_trakt_ognisko')).toBe(true);
    expect(engine.npcs.some((n) => n.id === 'npc_trakt_skarimir')).toBe(true);

    // 3. noc_istota -> BOTH enemy_upior_* AND npc_noc_* silhouettes cleared, Istota present
    director.restoreFromSave('noc_istota', 'uroczysko_noc');
    expect(engine.npcs.some((n) => n.id.startsWith('enemy_upior_'))).toBe(false);
    expect(engine.npcs.some((n) => n.id.startsWith('npc_noc_'))).toBe(false);
    expect(engine.npcs.some((n) => n.id === 'npc_istota')).toBe(true);

    // 4. pobojowisko -> individual fallen companions present & marked
    director.restoreFromSave('pobojowisko', 'pobojowisko_swit');
    expect(engine.npcs.find((n) => n.id === 'npc_pobojowisko_skarimir')?.speechBubbleText).toBe('🕯️ Skarimir');
    expect(engine.npcs.find((n) => n.id === 'npc_pobojowisko_ragnoslawa')?.speechBubbleText).toBe('🕯️ Ragnosława');
    expect(engine.npcs.find((n) => n.id === 'npc_pobojowisko_wojmir')?.speechBubbleText).toBe('🕯️ Wojmir');
  });

  it('restores Chapter 1 with Brzezina keepsakes and memory echo availability intact', () => {
    const engine = new OstrzeEngineState();
    const state = createSampleState();
    const key = exportSaveKey({ chapter: 'chapter1', sceneId: 'wilczy_brod', state })!;
    const loaded = importSaveKey(key)!;

    const ch1 = new Chapter1Director({
      engine,
      state: loaded.state,
      rng: createRng(loaded.state.rngState)
    });
    ch1.restoreFromSave(loaded.sceneId);
    expect(engine.activeCustomSceneId).toBe('wilczy_brod');
    expect(ch1.hasBrzezinaMemoryEchoAvailable()).toBe(true);
  });

  it('round-trips and restores campaign state in every playable Prologue and Act I location', () => {
    const engine = new OstrzeEngineState();
    const prologue = new PrologueDirector({ engine, seed: 2026 });
    const chapter1 = new Chapter1Director({ engine, state: prologue.state, rng: createRng(2026) });
    const sourceState = createSampleState();
    sourceState.time.minutes = 17 * 60 + 25;
    sourceState.quests.wilcza_nora = 'active';
    sourceState.inventory.items.push({ id: 'kamien_zmierzchu', qty: 1 });
    sourceState.flags.teleport_regression_marker = true;

    const expectedCharacter = JSON.stringify(sourceState.character);
    const expectedInventory = JSON.stringify(sourceState.inventory);
    const expectedFlags = JSON.stringify(sourceState.flags);
    const expectedQuests = JSON.stringify(sourceState.quests);

    for (const location of OSTRZE_LOCATIONS) {
      sourceState.world.location = location.id;
      const payload = importSaveKey(
        exportSaveKey({ chapter: location.chapter, sceneId: location.id, state: sourceState })!
      );
      expect(payload, `save payload for ${location.id}`).not.toBeNull();
      Object.assign(prologue.state, payload!.state);

      if (location.chapter === 'prologue') {
        const phaseByScene = {
          brzezina_dziedziniec: 'brzezina_towarzysze',
          trakt_zasadzka: 'trakt_ognisko',
          uroczysko_noc: 'noc_istota',
          pobojowisko_swit: 'pobojowisko'
        } as const;
        prologue.restoreFromSave(phaseByScene[location.id as keyof typeof phaseByScene], location.id);
      } else {
        chapter1.restoreFromSave(location.id);
      }

      expect(engine.activeCustomSceneId, `restored scene ${location.id}`).toBe(location.id);
      expect(prologue.state.world.location).toBe(location.id);
      expect(JSON.stringify(prologue.state.character)).toBe(expectedCharacter);
      expect(JSON.stringify(prologue.state.inventory)).toBe(expectedInventory);
      expect(JSON.stringify(prologue.state.flags)).toBe(expectedFlags);
      expect(JSON.stringify(prologue.state.quests)).toBe(expectedQuests);
      expect(prologue.state.time.minutes).toBe(17 * 60 + 25);
    }
  });

  it('caches hasOstrzeSave() across save/clear cycles without re-parsing JSON on every HUD render', () => {
    const store = new Map<string, string>();
    let getItemCalls = 0;
    const origWindow = (globalThis as any).window;

    try {
      (globalThis as any).window = {
        localStorage: {
          getItem: (k: string) => {
            getItemCalls++;
            return store.get(k) ?? null;
          },
          setItem: (k: string, v: string) => {
            store.set(k, v);
          },
          removeItem: (k: string) => {
            store.delete(k);
          }
        }
      };

      clearOstrzeSave();
      expect(hasOstrzeSave()).toBe(false);

      const state = createSampleState();
      expect(
        saveOstrzeGame({
          chapter: 'chapter1',
          sceneId: 'wilczy_brod',
          state
        })
      ).toBe(true);

      const callsBefore = getItemCalls;
      expect(hasOstrzeSave()).toBe(true);
      expect(hasOstrzeSave()).toBe(true);
      expect(hasOstrzeSave()).toBe(true);
      expect(getItemCalls).toBe(callsBefore);

      expect(loadOstrzeGame()?.sceneId).toBe('wilczy_brod');
      clearOstrzeSave();
      expect(hasOstrzeSave()).toBe(false);
    } finally {
      (globalThis as any).window = origWindow;
    }
  });
});
