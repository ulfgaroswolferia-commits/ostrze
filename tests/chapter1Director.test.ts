import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import { Chapter1Director } from '../src/game/scenes/Chapter1Director';

describe('Chapter1Director — Wilczy Bród & Pogórze (Rozdział I)', () => {
  function setupChapter1() {
    const engine = new OstrzeEngineState();
    const state = createEmptyOstrzeState(ORIGIN_DATA, 2026);
    const rng = createRng(2026);
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
    grantXp(state, 160, ORIGIN_DATA);

    const chapter1 = new Chapter1Director({ engine, state, rng });
    chapter1.enterWilczyBrod({ skipIntro: true });
    return { engine, state, chapter1 };
  }

  it('loads Wilczy Bród hub with 8 key NPCs', () => {
    const { engine, state } = setupChapter1();
    expect(state.world.location).toBe('wilczy_brod');
    expect(engine.activeCustomSceneId).toBe('wilczy_brod');
    expect(engine.npcs.map((n) => n.id)).toEqual(
      expect.arrayContaining([
        'npc_wszebor',
        'npc_wrzosek',
        'npc_kramarz_brod',
        'npc_kowal_zbych',
        'npc_szkarad',
        'npc_zona_borka',
        'npc_corka_straznika',
        'npc_ostromir'
      ])
    );
  });

  it('completes Wilcza Nora quest and grants 25 gr + 40 XP', () => {
    const { state, chapter1 } = setupChapter1();
    const moneyBefore = state.character!.money;
    const xpBefore = state.character!.xp;

    chapter1.startWilczaNoraQuest();
    expect(chapter1.activeCombatStage).toBe('wilcza_nora');
    chapter1.handleCombatEnded('victory');

    expect(state.flags.nora_wykonana).toBe(true);
    chapter1.completeWilczaNoraQuest();
    expect(state.quests.wilcza_nora).toBe('completed');
    expect(state.character!.money).toBe(moneyBefore + 25);
    expect(state.character!.xp).toBe(xpBefore + 40);
  });

  it('completes Ostromir escort to Kamienna Przełęcz and sets akt2_koniec', () => {
    const { state, chapter1 } = setupChapter1();
    chapter1.startOstromirEscort();
    expect(chapter1.activeCombatStage).toBe('eskorta_ostromira');

    chapter1.handleCombatEnded('victory');
    expect(state.flags.akt2_koniec).toBe(true);
    expect(state.quests.eskorta_ostromira).toBe('completed');
  });

  it('loads all 5 satellite 2.5D locations and completes all 8 side quests of Act 1', () => {
    const { engine, state, chapter1 } = setupChapter1();
    const startMoney = state.character!.money;
    const startXp = state.character!.xp;

    // 1. Las Rubieży (wilczy_las): gather herbs (lek_dla_wrzoska) & find Borek's tracks
    state.quests.lek_dla_wrzoska = 'active';
    chapter1.enterWilczyLas();
    expect(engine.activeCustomSceneId).toBe('wilczy_las');
    chapter1.handleNpcInteract('npc_las_polana');
    expect(state.flags.ziola_zebrane).toBe(true);
    expect(state.inventory.items.some((i) => i.id === 'ziola_dla_wrzoska')).toBe(true);

    chapter1.handleNpcInteract('npc_las_slady');
    expect(state.flags.borek_slady).toBe(true);
    expect(state.world.knownPlaces).toContain('ruiny_straznicy');

    // Deliver herbs to Wrzosek -> +10 gr, +30 XP, reveals stary_mlyn
    state.flags.wrzosek_ziola_oddane = true;
    chapter1.checkAndCompleteSideQuests();
    expect(state.quests.lek_dla_wrzoska).toBe('completed');
    expect(state.world.knownPlaces).toContain('stary_mlyn');

    // 2. Stary Młyn (stary_mlyn): Ostap (zboze_dla_mlyna) & night glass shard (swiatlo_w_mlynie)
    state.quests.zboze_dla_mlyna = 'active';
    state.quests.swiatlo_w_mlynie = 'active';
    chapter1.enterStaryMlyn();
    expect(engine.activeCustomSceneId).toBe('stary_mlyn');
    chapter1.handleNpcInteract('npc_mlyn_wnetrze');
    expect(state.flags.odlamek_zebrany).toBe(true);
    expect(state.inventory.items.some((i) => i.id === 'odlamek_szkla')).toBe(true);

    state.flags.wrzosek_wiadomosc = true;
    state.flags.kamien_rozpoznany = true;
    chapter1.checkAndCompleteSideQuests();
    expect(state.quests.zboze_dla_mlyna).toBe('completed');
    expect(state.quests.swiatlo_w_mlynie).toBe('completed');
    expect(state.world.knownPlaces).toContain('trakt_kupiecki');

    // 3. Trakt Kupiecki (trakt_kupiecki): Ostromir debt (dlug_kupca) & scouts (kto_pyta_o_ocalalych)
    state.quests.dlug_kupca = 'active';
    state.quests.kto_pyta_o_ocalalych = 'active';
    chapter1.enterTraktKupiecki();
    expect(engine.activeCustomSceneId).toBe('trakt_kupiecki');
    state.flags.dlug_oddany = true;
    state.flags.akt3_zapowiedz = true;
    chapter1.checkAndCompleteSideQuests();
    expect(state.quests.dlug_kupca).toBe('completed');
    expect(state.quests.kto_pyta_o_ocalalych).toBe('completed');

    // 4. Leśniczówka (lesniczowka): Forester letter (list_do_lesniczego) & oak stash
    state.quests.list_do_lesniczego = 'active';
    chapter1.enterLesniczowka();
    expect(engine.activeCustomSceneId).toBe('lesniczowka');
    chapter1.inspectLesniczowkaStash();
    expect(state.flags.schowek_bylo).toBe(true);
    state.flags.list_odpowiedz = true;
    chapter1.checkAndCompleteSideQuests();
    expect(state.quests.list_do_lesniczego).toBe('completed');

    // 5. Ruiny Strażnicy (ruiny_straznicy): Borek (zaginiony_pasterz_borek) & wall mark (amulet_z_ruin)
    state.quests.zaginiony_pasterz_borek = 'active';
    state.quests.amulet_z_ruin = 'active';
    state.inventory.items.push({ id: 'amulet_strazniczy', qty: 1 });
    chapter1.enterRuinyStraznicy();
    expect(engine.activeCustomSceneId).toBe('ruiny_straznicy');
    chapter1.handleNpcInteract('npc_ruiny_mur');
    expect(state.flags.amulet_pasuje).toBe(true);

    state.flags.zona_poinformowana = true;
    state.flags.amulet_oddany = true;
    chapter1.checkAndCompleteSideQuests();
    expect(state.quests.zaginiony_pasterz_borek).toBe('completed');
    expect(state.quests.amulet_z_ruin).toBe('completed');
    expect(state.flags.technologia_wiedza).toBe(true);

    // Total money from 8 side quests + stash (20): 10 + 12 + 20 + 15 + 25 + 10 + 30 + 0 + 20 = 142 gr
    // Total XP from 8 side quests: 30 + 30 + 40 + 30 + 50 + 40 + 60 + 50 = 330 XP
    expect(state.character!.money).toBe(startMoney + 142);
    expect(state.character!.xp).toBe(startXp + 330);
  });
});
