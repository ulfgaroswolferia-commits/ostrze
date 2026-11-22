import { describe, expect, it } from 'vitest';
import { ORIGIN_DATA } from '../src/game/data/originData';
import {
  checkNewAchievementUnlocks,
  evaluateAchievements,
  evaluateCampaignProgress,
  OSTRZE_ACHIEVEMENTS
} from '../src/game/rules/achievements';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import { renderCharacterSheetView } from '../src/game/ui/views/CharacterSheetView';

function makeHero() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 55);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 7,
        zrecznosc: 6,
        krzepa: 7,
        bystrosc: 5,
        rozum: 8,
        oglada: 4,
        fart: 4
      },
      tagged: ['sieczna', 'medycyna', 'wymowa']
    },
    ORIGIN_DATA
  );
  return state;
}

describe('Achievements & Campaign Chronicle tab', () => {
  it('evaluates all 10 achievements and fires each unlock exactly once', () => {
    const state = makeHero();
    expect(OSTRZE_ACHIEVEMENTS.length).toBe(10);

    // Fresh character has 0 unlocked
    const initial = evaluateAchievements(state, ORIGIN_DATA);
    expect(initial.filter((a) => a.unlocked).length).toBe(0);

    // Unlock several milestones
    state.world.knownPlaces.push('wilczy_brod', 'gluszec');
    state.flags.nora_wykonana = true;
    state.flags.bogdan_gwiezdne_ostrze = true;
    state.flags.echo_skarimir_kosc = true;

    const firstPass = checkNewAchievementUnlocks(state, ORIGIN_DATA);
    const ids = new Set(firstPass.map((a) => a.id));
    expect(ids.has('ocalaly_brzezina')).toBe(true);
    expect(ids.has('pogromca_watahy')).toBe(true);
    expect(ids.has('przelom_przelecz')).toBe(true);
    expect(ids.has('kowal_gwiazd')).toBe(true);
    expect(ids.has('pamiec_towarzyszy')).toBe(true);

    // Second pass must NOT re-emit already unlocked achievements
    const secondPass = checkNewAchievementUnlocks(state, ORIGIN_DATA);
    expect(secondPass.length).toBe(0);
  });

  it('computes campaign progress and renders readable Polish location names & Chronicle tab', () => {
    const state = makeHero();
    state.world.knownPlaces = ['brzezina', 'wilczy_brod', 'gluszec'];
    state.world.activePhenomenon = 'burza_iskier';
    state.time.minutes = 24 * 60 * 2 + 480; // Day 3
    grantXp(state, 400, ORIGIN_DATA);

    const progress = evaluateCampaignProgress(state, ORIGIN_DATA);
    expect(progress.daysElapsed).toBe(3);
    expect(progress.prologuePct).toBe(100);
    expect(progress.act1Pct).toBe(100);
    expect(progress.visitedCount).toBe(3);
    expect(progress.atmosphereLabel).toContain('Burza iskier');

    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    // Journal tab shows readable Polish location names (not raw IDs)
    renderCharacterSheetView({
      root: fakeRoot,
      state,
      data: ORIGIN_DATA,
      rng: createRng(1),
      activeTab: 'journal',
      onSelectTab: () => undefined,
      onUpdated: () => undefined,
      onShowToast: () => undefined,
      onRerender: () => undefined,
      onClose: () => undefined
    });
    expect(fakeRoot.innerHTML).toContain('Strażnica Wilczy Bród');
    expect(fakeRoot.innerHTML).toContain('Osada Głuszec');

    // Chronicle tab shows campaign bars and achievements
    renderCharacterSheetView({
      root: fakeRoot,
      state,
      data: ORIGIN_DATA,
      rng: createRng(1),
      activeTab: 'chronicle',
      onSelectTab: () => undefined,
      onUpdated: () => undefined,
      onShowToast: () => undefined,
      onRerender: () => undefined,
      onClose: () => undefined
    });
    expect(fakeRoot.innerHTML).toContain('data-cs-chronicle="true"');
    expect(fakeRoot.innerHTML).toContain('Dzień 3');
    expect(fakeRoot.innerHTML).toContain('Ocalały z Brzeziny');
    expect(fakeRoot.innerHTML).toContain('Kowal Gwiazd');
  });
});
