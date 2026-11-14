import { describe, expect, it, vi } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import { Chapter1Director } from '../src/game/scenes/Chapter1Director';
import { PrologueDirector } from '../src/game/scenes/PrologueDirector';
import { exportSaveKey, importSaveKey } from '../src/game/state/saveManager';

function makeTestHero(state: ReturnType<typeof createEmptyOstrzeState>) {
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
}

describe('Demo E2E: Save Key, Defeat Reset & Chapter 1 Rewards', () => {
  it('round-trips portable OSTRZE1 save key without data loss', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 999);
    makeTestHero(state);
    state.flags.ukryte_insygnia = true;
    state.quests.wilcza_nora = 'active';

    const key = exportSaveKey({
      chapter: 'chapter1',
      sceneId: 'wilczy_brod',
      state
    });
    expect(key).toBeTruthy();
    expect(key!.startsWith('OSTRZE1:')).toBe(true);

    const parsed = importSaveKey(key!);
    expect(parsed).not.toBeNull();
    expect(parsed!.chapter).toBe('chapter1');
    expect(parsed!.sceneId).toBe('wilczy_brod');
    expect(parsed!.state.character?.name).toBe('Mściwój');
    expect(parsed!.state.flags.ukryte_insygnia).toBe(true);
    expect(parsed!.state.quests.wilcza_nora).toBe('active');
    expect(importSaveKey('INVALID_KEY')).toBeNull();
  });

  it('triggers onDefeatToPrologue when defeated by bandits on the Trakt', () => {
    const engine = new OstrzeEngineState();
    const director = new PrologueDirector({ engine });
    makeTestHero(director.state);
    const onDefeat = vi.fn();
    director.onDefeatToPrologue = onDefeat;

    director.beginMarchDay1();
    expect(director.phase).toBe('trakt_bandyci');
    director.handleCombatEnded('defeat');
    expect(onDefeat).toHaveBeenCalledTimes(1);
  });

  it('grants exact origin rewards (+40 gr, +2 prowiant, +80 XP) on Ostromir escort victory and resets on defeat', () => {
    const engine = new OstrzeEngineState();
    const state = createEmptyOstrzeState(ORIGIN_DATA, 42);
    makeTestHero(state);
    const rng = createRng(state.rngState);
    const ch1 = new Chapter1Director({ engine, state, rng });
    const onDefeat = vi.fn();
    ch1.onDefeatToPrologue = onDefeat;

    const moneyBefore = state.character!.money;
    const xpBefore = state.character!.xp;
    const prowiantBefore = state.inventory.items.find((i) => i.id === 'prowiant')?.qty ?? 0;

    ch1.enterWilczyBrod({ skipIntro: true });
    ch1.startOstromirEscort();
    ch1.handleCombatEnded('victory');

    expect(state.flags.akt2_koniec).toBe(true);
    expect(state.quests.eskorta_ostromira).toBe('completed');
    expect(state.character!.money).toBe(moneyBefore + 40);
    expect(state.character!.xp).toBe(xpBefore + 80);
    const prowiantAfter = state.inventory.items.find((i) => i.id === 'prowiant')?.qty ?? 0;
    expect(prowiantAfter).toBe(prowiantBefore + 2);

    ch1.startWilczaNoraQuest();
    ch1.handleCombatEnded('defeat');
    expect(onDefeat).toHaveBeenCalledTimes(1);
  });
});
