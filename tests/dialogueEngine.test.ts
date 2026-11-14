import { describe, expect, it } from 'vitest';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import {
  chooseOstrzeDialogueOption,
  getOstrzeDialogueView,
  startOstrzeDialogue
} from '../src/game/rules/dialogueEngine';

function createTestHeroState(seed = 42) {
  const state = createEmptyOstrzeState(ORIGIN_DATA, seed);
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
  return state;
}

describe('Ostrze dialogueEngine (Etap 3)', () => {
  it('runs kurier dialogue, computes check percentages, and mutates wola/dlug', () => {
    const state = createTestHeroState(10);
    const rng = createRng(10);

    let session = startOstrzeDialogue('kurier', state, ORIGIN_DATA);
    const view = getOstrzeDialogueView(session, state, ORIGIN_DATA);

    expect(view.speaker).toBe('Cesarski kurier');
    expect(view.options.some((o) => o.checkLabel === 'Wymowa 40')).toBe(true);

    const pyskowkaOpt = view.options.find((o) => o.option.id === 'pyskowka');
    expect(pyskowkaOpt).toBeDefined();

    session = chooseOstrzeDialogueOption(
      session,
      pyskowkaOpt!.index,
      state,
      ORIGIN_DATA,
      rng
    )!;
    expect(state.vars.wola).toBe(1);

    const afterView = getOstrzeDialogueView(session, state, ORIGIN_DATA);
    const endOpt = afterView.options[0];
    const ended = chooseOstrzeDialogueOption(
      session,
      endOpt.index,
      state,
      ORIGIN_DATA,
      rng
    );
    expect(ended).toBeNull();
  });

  it('handles kwatermistrz drink purchase (money & podchmielenie effect)', () => {
    const state = createTestHeroState(5);
    const rng = createRng(5);
    const moneyBefore = state.character!.money;

    let session = startOstrzeDialogue('kwatermistrz', state, ORIGIN_DATA);
    const view = getOstrzeDialogueView(session, state, ORIGIN_DATA);
    const drinkOpt = view.options.find((o) => o.option.id === 'lyk');
    expect(drinkOpt).toBeDefined();

    session = chooseOstrzeDialogueOption(
      session,
      drinkOpt!.index,
      state,
      ORIGIN_DATA,
      rng
    )!;

    expect(state.character!.money).toBe(moneyBefore - 2);
    expect(state.character!.effects.find((e) => e.id === 'podchmielenie')?.stacks).toBe(1);
  });
});
