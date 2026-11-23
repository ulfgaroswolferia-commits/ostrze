import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createWzgorzeWartowniczeScene } from '../src/game/maps/chapter2Maps';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';
import {
  cycleOstrzeDifficulty,
  getDifficultyProfile,
  getOstrzeDifficulty,
  setOstrzeDifficulty
} from '../src/game/rules/difficulty';
import { buildCampaignSummaryData } from '../src/game/ui/views/CampaignSummaryView';

function createHeroState() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 99);
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
      tagged: ['sieczna', 'skradanie', 'wymowa']
    },
    ORIGIN_DATA
  );
  grantXp(state, 900, ORIGIN_DATA);
  return state;
}

describe('Difficulty Tiers & Campaign Summary Screen', () => {
  it('cycles difficulty tiers and scales enemy HP/damage/boss AP and player hit bonus without compounding', () => {
    const state = createHeroState();
    expect(getOstrzeDifficulty(state)).toBe('classic');
    expect(cycleOstrzeDifficulty('story')).toBe('classic');
    expect(cycleOstrzeDifficulty('classic')).toBe('challenge');
    expect(cycleOstrzeDifficulty('challenge')).toBe('story');

    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createWzgorzeWartowniczeScene({ withHunt: true }));
    engine.loadCustomScene('wzgorze_wartownicze');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const boss = engine.npcs.find((n) => n.id === 'enemy_oblawa_dowodca')!;
    const classicHp = boss.combat!.maxHp;
    const classicSnap = engine.getActorCombatant(boss);
    const classicPlayerSnap = engine.getActorCombatant(engine.player);

    // Switch to Story: -25% HP, -25% damage, player +15% hit
    setOstrzeDifficulty(state, 'story');
    engine.applyDifficultyScalingToLoadedEnemies();
    expect(boss.combat!.maxHp).toBe(Math.round(classicHp * 0.75));
    expect(engine.getActorCombatant(boss).derived.maxDamage).toBeLessThan(classicSnap.derived.maxDamage);
    expect(engine.getActorCombatant(engine.player).derived.activeProficiency).toBeGreaterThan(
      classicPlayerSnap.derived.activeProficiency
    );

    // Switch to Challenge: +25% HP (from original base, NOT compounded!), +20% dmg, boss +1 AP
    setOstrzeDifficulty(state, 'challenge');
    engine.applyDifficultyScalingToLoadedEnemies();
    expect(boss.combat!.maxHp).toBe(Math.round(classicHp * 1.25));
    expect(engine.getActorCombatant(boss).derived.maxDamage).toBeGreaterThan(classicSnap.derived.maxDamage);
    expect(engine.getActorCombatant(boss).derived.maxAp).toBe(classicSnap.derived.maxAp + 1);

    // Back to Classic restores exact original base HP
    setOstrzeDifficulty(state, 'classic');
    engine.applyDifficultyScalingToLoadedEnemies();
    expect(boss.combat!.maxHp).toBe(classicHp);
    expect(getDifficultyProfile('classic').label).toBe('Klasyczny');
  });

  it('builds dynamic campaign epilogue and full stats across moral axes and finale routes', () => {
    const state = createHeroState();
    setOstrzeDifficulty(state, 'challenge');
    state.vars.wola = 5;
    state.vars.dlug = 1;
    state.quests.przyjecie_w_osadzie = 'completed';
    state.quests.dlug_mlynarza = 'completed';
    state.world.knownPlaces.push('brzezina_dziedziniec', 'wilczy_brod', 'gluszec');

    const wolaOblawa = buildCampaignSummaryData(state, ORIGIN_DATA, true);
    expect(wolaOblawa.title).toContain('Przerwanie Obławy');
    expect(wolaOblawa.moralPathTitle).toBe('Ścieżka Woli');
    expect(wolaOblawa.difficultyLabel).toBe('Wyzwanie');
    expect(wolaOblawa.completedQuests).toBe(2);
    expect(wolaOblawa.visitedCount).toBe(3);

    state.vars.wola = 1;
    state.vars.dlug = 5;
    const dlugDiplo = buildCampaignSummaryData(state, ORIGIN_DATA, false);
    expect(dlugDiplo.title).toContain('Za Głuszcem');
    expect(dlugDiplo.moralPathTitle).toBe('Ścieżka Długu');

    state.vars.wola = 3;
    state.vars.dlug = 3;
    const balanced = buildCampaignSummaryData(state, ORIGIN_DATA, false);
    expect(balanced.moralPathTitle).toBe('Równowaga Wędrowca');
  });
});
