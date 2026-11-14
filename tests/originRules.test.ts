import { describe, expect, it } from 'vitest';
import { ORIGIN_DATA } from '../src/game/data/originData';
import {
  createCharacter,
  createEmptyOstrzeState,
  grantXp,
  rollDialogueCheck
} from '../src/game/rules/character';
import { evaluateCondition } from '../src/game/rules/conditions';
import { createRng } from '../src/game/rules/dice';
import { getStats } from '../src/game/rules/stats';
import { advanceMinutes, timeOfDay } from '../src/game/rules/time';

function makeDefaultAttributes() {
  // 7 attributes: base 5 each, rozum +1 gift (6), +5 free points (e.g. +3 sila, +2 zrecznosc) = 41 total
  return {
    sila: 8,
    zrecznosc: 7,
    krzepa: 5,
    bystrosc: 5,
    rozum: 6,
    oglada: 5,
    fart: 5
  };
}

describe('originData & originRules (Etap 2)', () => {
  it('loads attributes, classes, skills, and prologue dialogues from origin/data', () => {
    expect(ORIGIN_DATA.attributes).toHaveLength(7);
    expect(ORIGIN_DATA.classes.map((c) => c.id)).toEqual(['miecz', 'wlocznia']);
    expect(ORIGIN_DATA.skills).toHaveLength(11);
    expect(Object.keys(ORIGIN_DATA.prologueDialogues)).toEqual(
      expect.arrayContaining([
        'kurier',
        'delegacja',
        'kwatermistrz',
        'towarzysze',
        'ognisko',
        'istota',
        'pobojowisko',
        'rozdroze'
      ])
    );
  });

  it('produces deterministic rolls with createRng', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.int(1, 100), a.int(1, 100), a.int(1, 100)]).toEqual([
      b.int(1, 100),
      b.int(1, 100),
      b.int(1, 100)
    ]);
  });

  it('creates a character, computes getStats, and applies night penalty', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 777);
    createCharacter(
      state,
      {
        name: 'Mściwój',
        classId: 'miecz',
        attributes: makeDefaultAttributes(),
        tagged: ['sieczna', 'wymowa', 'skradanie']
      },
      ORIGIN_DATA
    );

    expect(state.flags.klasa_miecz).toBe(true);
    expect(state.character?.money).toBe(30);
    expect(state.inventory.equipped.bron).toBe('miecz_krotki');

    const dayStats = getStats(state, ORIGIN_DATA);
    // sieczna = 2*8 + 7 + 20(tagged) = 43
    expect(dayStats.skills.sieczna).toBe(43);
    // hpMax = 20 + 3*5 = 35
    expect(dayStats.derived.hpMax).toBe(35);
    // ap = 5 + floor(7/2) = 8
    expect(dayStats.derived.ap).toBe(8);

    // Advance from 06:00 to 21:00 (noc) -> skradanie gets +10 (timeOfDay) and -15 (bystrosc penalty) = -5 net
    advanceMinutes(state, 15 * 60, ORIGIN_DATA);
    expect(timeOfDay(state.time.minutes, ORIGIN_DATA.rules)).toBe('noc');
    const nightStats = getStats(state, ORIGIN_DATA);
    expect(nightStats.skills.skradanie).toBe(dayStats.skills.skradanie - 5);
  });

  it('levels up on 160 XP sparring reward with skill points and perk pick', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 1);
    createCharacter(
      state,
      {
        name: 'Dobrawa',
        classId: 'wlocznia',
        attributes: makeDefaultAttributes(),
        tagged: ['drzewcowa', 'medycyna', 'handel']
      },
      ORIGIN_DATA
    );

    state.character!.hp = 10;
    const res = grantXp(state, 160, ORIGIN_DATA);
    expect(res.levelsGained).toBe(1);
    expect(res.newLevel).toBe(2);
    // skillPoints = 3 + floor(6/2) = 6
    expect(state.character?.freeSkillPoints).toBe(6);
    expect(state.character?.freePerkPicks).toBe(1);
    expect(state.character?.hp).toBe(getStats(state, ORIGIN_DATA).derived.hpMax);
  });

  it('evaluates conditions and locks failed non-retry dialogue checks', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 99);
    createCharacter(
      state,
      {
        name: 'Wilk',
        classId: 'miecz',
        attributes: makeDefaultAttributes(),
        tagged: ['sieczna', 'wymowa', 'handel']
      },
      ORIGIN_DATA
    );
    state.flags.rozkaz_danina = true;
    state.vars.wola = 2;

    expect(
      evaluateCondition(
        {
          all: [
            { flag: 'rozkaz_danina' },
            { notFlag: 'rozkaz_bez_powrotu' },
            { var: 'wola', gte: 2 },
            { item: { id: 'opatrunek', qty: 2 } }
          ]
        },
        state,
        ORIGIN_DATA
      )
    ).toBe(true);

    const rng = createRng(1);
    const first = rollDialogueCheck(state, 'kurier_wymowa', 'wymowa', 999, false, ORIGIN_DATA, rng);
    expect(first.success).toBe(false);
    expect(first.alreadyFailed).toBe(false);
    expect(state.world.failedChecks).toContain('kurier_wymowa');

    const second = rollDialogueCheck(state, 'kurier_wymowa', 'wymowa', 999, false, ORIGIN_DATA, rng);
    expect(second.success).toBe(false);
    expect(second.alreadyFailed).toBe(true);
  });
});
