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

  it('loads Wilczy Bród hub with 5 key NPCs', () => {
    const { engine, state } = setupChapter1();
    expect(state.world.location).toBe('wilczy_brod');
    expect(engine.activeCustomSceneId).toBe('wilczy_brod');
    expect(engine.npcs.map((n) => n.id)).toEqual(
      expect.arrayContaining([
        'npc_wszebor',
        'npc_wrzosek',
        'npc_kramarz_brod',
        'npc_szkarad',
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
});
