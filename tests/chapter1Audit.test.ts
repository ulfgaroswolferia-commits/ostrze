import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import { getVisitedOstrzeLocations } from '../src/game/rules/travel';
import { Chapter1Director } from '../src/game/scenes/Chapter1Director';

function createChapter1Fixture() {
  const engine = new OstrzeEngineState();
  const state = createEmptyOstrzeState(ORIGIN_DATA, 2026);
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
      tagged: ['sieczna', 'wymowa', 'skradanie']
    },
    ORIGIN_DATA
  );
  grantXp(state, 160, ORIGIN_DATA);
  const director = new Chapter1Director({
    engine,
    state,
    rng: createRng(2026),
    data: ORIGIN_DATA
  });
  return { engine, state, director };
}

describe('Chapter 1 Audit (quests, dialogues, satellites, save/load, defeat)', () => {
  it('verifies all Act I dialogues and quests referenced by Chapter1Director exist in ORIGIN_DATA', () => {
    const expectedDialogues = [
      'wilczy_brod_pamiec_brzeziny',
      'komendant',
      'komendant_raport',
      'komendant_po',
      'komendant_odburk',
      'komendant_namysl',
      'wrzosek',
      'kowal',
      'zona_borka',
      'corka',
      'szkarad',
      'ostromir',
      'ostromir_brama',
      'ostromir_powrot',
      'ostromir_pozegnanie',
      'ostromir_trakt',
      'ostap',
      'zwiadowcy',
      'lesniczy',
      'borek_ruiny',
      'satelita_polana_ziol',
      'satelita_mlyn_noca',
      'satelita_ruiny_mur',
      'satelita_skrytka_dab'
    ];
    for (const id of expectedDialogues) {
      expect(ORIGIN_DATA.prologueDialogues[id], `Missing Act I dialogue: ${id}`).toBeDefined();
    }

    const expectedQuests = [
      'wilcza_nora',
      'eskorta_ostromira',
      'lek_dla_wrzoska',
      'zboze_dla_mlyna',
      'dlug_kupca',
      'list_do_lesniczego',
      'kto_pyta_o_ocalalych',
      'swiatlo_w_mlynie',
      'zaginiony_pasterz_borek',
      'amulet_z_ruin'
    ];
    for (const qId of expectedQuests) {
      expect(
        ORIGIN_DATA.quests.some((q) => q.id === qId),
        `Missing Act I quest in ORIGIN_DATA: ${qId}`
      ).toBe(true);
    }
  });

  it('allows picking up amulet_strazniczy in Ruins even when pobojowisko_ragnoslawa flag is set', () => {
    const { state, director } = createChapter1Fixture();
    state.flags.pobojowisko_ragnoslawa = true;
    director.enterRuinyStraznicy();
    director.handleNpcInteract('npc_borek_ruiny');

    expect(state.flags.amulet_zebrany).toBe(true);
    expect(state.inventory.items.some((i) => i.id === 'amulet_strazniczy' && i.qty > 0)).toBe(true);
  });

  it('marks every Act I location as visited and restores all 8 Act I scenes cleanly from save', () => {
    const { engine, state, director } = createChapter1Fixture();
    director.enterWilczyBrod({ skipIntro: true });
    director.enterWilczyLas();
    director.enterStaryMlyn();
    director.enterTraktKupiecki();
    director.enterLesniczowka();
    director.enterRuinyStraznicy();
    director.startWilczaNoraQuest();
    director.startOstromirEscort();

    const visitedIds = new Set(getVisitedOstrzeLocations(state).map((l) => l.id));
    const allAct1Scenes = [
      'wilczy_brod',
      'wilcza_nora',
      'kamienna_przelecz',
      'wilczy_las',
      'stary_mlyn',
      'trakt_kupiecki',
      'lesniczowka',
      'ruiny_straznicy'
    ];
    for (const id of allAct1Scenes) {
      expect(visitedIds.has(id), `Expected ${id} to be marked visited`).toBe(true);
      director.restoreFromSave(id);
      expect(engine.activeCustomSceneId).toBe(id);
      expect(state.world.location).toBe(id);
    }
  });

  it('invokes onDefeatToPrologue cleanly on travel_encounter defeat instead of soft-locking', () => {
    const { director } = createChapter1Fixture();
    let defeatedCalled = false;
    director.onDefeatToPrologue = () => {
      defeatedCalled = true;
    };
    director.activeCombatStage = 'travel_encounter';
    director.handleCombatEnded('defeat');
    expect(defeatedCalled).toBe(true);
    expect(director.activeCombatStage).toBe('none');
  });
});
