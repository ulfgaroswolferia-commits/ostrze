import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { getPixArtMeta, resolvePixPortraitId } from '../src/game/assets/pixArt';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import {
  type ActiveOstrzeDialogue,
  chooseOstrzeDialogueOption,
  getOstrzeDialogueView,
  startOstrzeDialogue
} from '../src/game/rules/dialogueEngine';
import { Chapter1Director } from '../src/game/scenes/Chapter1Director';
import type { NarrativeCardData, OstrzeModalUi } from '../src/game/ui/OstrzeModalUi';

function createHeroState() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 2026);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 7,
        zrecznosc: 6,
        krzepa: 5,
        bystrosc: 7,
        rozum: 6,
        oglada: 5,
        fart: 5
      },
      tagged: ['sieczna', 'medycyna', 'wiedza_tajemna']
    },
    ORIGIN_DATA
  );
  return state;
}

describe('Act 1 Satellite Interactive Exploration Scenes & Panoramic .pix Art', () => {
  it('assigns valid 96x48 panoramic .pix scene art to all 4 satellite scenes and Wilczy Bród inn echo', () => {
    for (const dlgId of [
      'satelita_polana_ziol',
      'satelita_mlyn_noca',
      'satelita_ruiny_mur',
      'satelita_skrytka_dab',
      'wilczy_brod_pamiec_brzeziny'
    ]) {
      const def = ORIGIN_DATA.prologueDialogues[dlgId];
      expect(def, `Missing dialogue ${dlgId}`).toBeDefined();
      const artId = resolvePixPortraitId(def.portrait, def.nodes[def.start].speaker ?? '');
      expect(artId, `Missing art for ${dlgId}`).not.toBeNull();
      const meta = getPixArtMeta(artId!);
      expect(meta).not.toBeNull();
      expect(meta!.width).toBe(96);
      expect(meta!.height).toBe(48);
      expect(meta!.width).toBeGreaterThan(meta!.height);
    }
  });

  it('guarantees fail-forward quest progress on all 4 satellite dialogues regardless of roll outcome', () => {
    const state = createHeroState();
    const rng = createRng(777);

    // 1. Polana Ziół (test_medycyna)
    let s1: ActiveOstrzeDialogue | null = startOstrzeDialogue('satelita_polana_ziol', state, ORIGIN_DATA);
    s1 = chooseOstrzeDialogueOption(s1, 0, state, ORIGIN_DATA, rng);
    expect(s1).not.toBeNull();
    expect(state.flags.ziola_zebrane).toBe(true);
    expect(state.inventory.items.some((i) => i.id === 'ziola_dla_wrzoska')).toBe(true);

    // 2. Stary Młyn nocą (test_wiedza)
    let s2: ActiveOstrzeDialogue | null = startOstrzeDialogue('satelita_mlyn_noca', state, ORIGIN_DATA);
    s2 = chooseOstrzeDialogueOption(s2, 0, state, ORIGIN_DATA, rng);
    expect(s2).not.toBeNull();
    expect(state.flags.odlamek_zebrany).toBe(true);
    expect(state.inventory.items.some((i) => i.id === 'odlamek_szkla')).toBe(true);

    // 3. Ruiny Strażnicy (test_wiedza_ruiny)
    let s3: ActiveOstrzeDialogue | null = startOstrzeDialogue('satelita_ruiny_mur', state, ORIGIN_DATA);
    s3 = chooseOstrzeDialogueOption(s3, 0, state, ORIGIN_DATA, rng);
    expect(s3).not.toBeNull();
    expect(state.flags.amulet_pytanie).toBe(true);
    expect(state.flags.amulet_pasuje).toBe(true);

    // 4. Skrytka pod dębem (test_skradanie_skrytka)
    const moneyBefore = state.character!.money;
    let s4: ActiveOstrzeDialogue | null = startOstrzeDialogue('satelita_skrytka_dab', state, ORIGIN_DATA);
    s4 = chooseOstrzeDialogueOption(s4, 1, state, ORIGIN_DATA, rng);
    expect(s4).not.toBeNull();
    expect(state.flags.schowek_bylo).toBe(true);
    expect(state.character!.money).toBeGreaterThanOrEqual(moneyBefore + 20);
    expect(state.inventory.items.some((i) => i.id === 'napar_ziol')).toBe(true);
    expect(state.inventory.items.some((i) => i.id === 'opatrunek')).toBe(true);
  });

  it('opens interactive satellite dialogues and attaches .pix artId to narratives when UI is connected', () => {
    const engine = new OstrzeEngineState();
    const state = createHeroState();
    const openedDialogues: string[] = [];
    const shownNarratives: NarrativeCardData[] = [];

    const mockUi = {
      showDialogue: (session: ActiveOstrzeDialogue) => {
        openedDialogues.push(session.dialogueId);
        const view = getOstrzeDialogueView(session, state, ORIGIN_DATA);
        expect(view.portrait).toBeTruthy();
      },
      showNarrative: (card: NarrativeCardData) => {
        shownNarratives.push(card);
      },
      setHubPanel: () => {},
      showToast: () => {}
    } as unknown as OstrzeModalUi;

    const ch1 = new Chapter1Director({ engine, state, rng: createRng(2026), ui: mockUi });
    ch1.enterWilczyBrod();
    expect(shownNarratives.some((n) => n.artId === 'mapa_brod')).toBe(true);

    // Polana Ziół -> satelita_polana_ziol
    ch1.enterWilczyLas();
    ch1.handleNpcInteract('npc_las_polana');
    expect(openedDialogues).toContain('satelita_polana_ziol');

    // Ślady za polaną -> narrative with artId 'trakt'
    ch1.handleNpcInteract('npc_las_slady');
    expect(shownNarratives.some((n) => n.artId === 'trakt')).toBe(true);

    // Stary Młyn za dnia -> narrative with artId 'stary_mlyn'
    ch1.enterStaryMlyn();
    state.time.minutes = 12 * 60;
    engine.togglePropInteraction('mlyn_kolo_wodne');
    expect(shownNarratives.some((n) => n.artId === 'stary_mlyn')).toBe(true);

    // Stary Młyn nocą -> satelita_mlyn_noca
    state.time.minutes = 22 * 60;
    ch1.handleNpcInteract('npc_mlyn_wnetrze');
    expect(openedDialogues).toContain('satelita_mlyn_noca');

    // Ruiny Strażnicy -> satelita_ruiny_mur
    state.inventory.items.push({ id: 'amulet_strazniczy', qty: 1 });
    ch1.enterRuinyStraznicy();
    ch1.handleNpcInteract('npc_ruiny_mur');
    expect(openedDialogues).toContain('satelita_ruiny_mur');

    // Leśniczówka -> satelita_skrytka_dab
    ch1.enterLesniczowka();
    ch1.inspectLesniczowkaStash();
    expect(openedDialogues).toContain('satelita_skrytka_dab');

    // Wilcza Nora -> narrative with artId 'bor_klusownikow'
    ch1.startWilczaNoraQuest();
    expect(shownNarratives.some((n) => n.artId === 'bor_klusownikow')).toBe(true);
  });
});
