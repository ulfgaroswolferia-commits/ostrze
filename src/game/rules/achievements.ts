import type { OriginGameData, OstrzeGameState } from '../data/originTypes';
import { getVisitedOstrzeLocations, OSTRZE_LOCATIONS } from './travel';
import { getWorldAtmosphere } from './worldCycle';

export interface AchievementDef {
  id: string;
  icon: string;
  title: string;
  description: string;
  isUnlocked: (state: OstrzeGameState, data: OriginGameData) => boolean;
}

export interface EvaluatedAchievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface CampaignProgressSummary {
  daysElapsed: number;
  visitedCount: number;
  totalLocations: number;
  activeQuests: number;
  completedQuests: number;
  totalXp: number;
  perksCount: number;
  prologuePct: number;
  act1Pct: number;
  act2Pct: number;
  unlockedAchievements: number;
  totalAchievements: number;
  atmosphereLabel: string;
}

const hasAnyKnown = (state: OstrzeGameState, ids: string[]): boolean => {
  const known = new Set(state.world.knownPlaces);
  return ids.some((id) => known.has(id));
};

export const OSTRZE_ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'ocalaly_brzezina',
    icon: '🔥',
    title: 'Ocalały z Brzeziny',
    description: 'Przeżyj Noc Upiorów i dotrzyj do Strażnicy Wilczy Bród.',
    isUnlocked: (s) =>
      Boolean(s.flags.prolog_ukonczony) || hasAnyKnown(s, ['wilczy_brod', 'gluszec'])
  },
  {
    id: 'pogromca_watahy',
    icon: '🐺',
    title: 'Pogromca Watahy',
    description: 'Oczyść Wilczą Norę i zdaj raport w Wilczym Brodzie.',
    isUnlocked: (s) =>
      Boolean(s.flags.nora_wykonana || s.flags.nora_rozliczona) ||
      s.quests.wilcza_nora === 'completed'
  },
  {
    id: 'przelom_przelecz',
    icon: '⛰️',
    title: 'Przełom na Przełęczy',
    description: 'Przekrocz Kamienną Przełęcz i dotrzyj do Osady Głuszec (Akt II).',
    isUnlocked: (s) =>
      Boolean(s.flags.akt1_ukonczony) || hasAnyKnown(s, ['gluszec'])
  },
  {
    id: 'kowal_gwiazd',
    icon: '✨',
    title: 'Kowal Gwiazd',
    description: 'Wykuj Gwiezdne Ostrze u kowala Bogdana w Głuszcu.',
    isUnlocked: (s) => Boolean(s.flags.bogdan_gwiezdne_ostrze)
  },
  {
    id: 'lowca_topielcow',
    icon: '🌿',
    title: 'Łowca Topielców',
    description: 'Pokonaj Pradawnego Topielca na Bagnach Szarej Wody.',
    isUnlocked: (s) =>
      Boolean(s.flags.bagna_topielce_pokonane) || s.quests.bagna_topielce === 'completed'
  },
  {
    id: 'pamiec_towarzyszy',
    icon: '🕯️',
    title: 'Pamięć o Towarzyszach',
    description: 'Uczcij przynajmniej jedną pamiątkę po towarzyszach z Brzeziny.',
    isUnlocked: (s) =>
      Boolean(
        s.flags.echo_skarimir_kosc ||
          s.flags.echo_ragnoslawa_toast ||
          s.flags.echo_wojmir_list
      )
  },
  {
    id: 'biegly_rzemioslo',
    icon: '⚔️',
    title: 'Biegły w Rzemiośle',
    description: 'Osiągnij co najmniej 4. poziom i wybierz talent bojowy lub użytkowy.',
    isUnlocked: (s) => Boolean(s.character && s.character.level >= 4 && s.character.perks.length > 0)
  },
  {
    id: 'kartograf_rubiezy',
    icon: '🗺️',
    title: 'Kartograf Rubieży',
    description: 'Odkryj co najmniej 10 lokacji na Pogórzu i w Głuszu.',
    isUnlocked: (s) => getVisitedOstrzeLocations(s).length >= 10
  },
  {
    id: 'mistrz_ogniska',
    icon: '⛺',
    title: 'Mistrz Ogniska',
    description: 'Przygotuj lub zdobądź zapasy alchemiczne (Flasza oleju, Okład ziołowy lub Potrawka).',
    isUnlocked: (s) =>
      s.inventory.items.some(
        (i) =>
          i.qty > 0 &&
          (i.id === 'flasza_oleju' || i.id === 'oklad_ziolowy' || i.id === 'gulasz' || i.id === 'swieca_dymna')
      )
  },
  {
    id: 'zwyciezca_gluszec',
    icon: '👑',
    title: 'Zwycięzca spod Głuszca',
    description: 'Zakończ intrygę w Osadzie Głuszec (dyplomatycznie lub w starciu z Obławą).',
    isUnlocked: (s) =>
      Boolean(
        s.flags.akt2_ukonczony ||
          s.flags.oblawa_pokonana ||
          s.flags.gluszec_dyplomacja_sukces
      )
  }
];

export function evaluateAchievements(
  state: OstrzeGameState,
  data: OriginGameData
): EvaluatedAchievement[] {
  return OSTRZE_ACHIEVEMENTS.map((def) => ({
    id: def.id,
    icon: def.icon,
    title: def.title,
    description: def.description,
    unlocked: Boolean(state.flags[`ach_${def.id}`]) || def.isUnlocked(state, data)
  }));
}

/**
 * Checks for newly unlocked achievements, marks them in `state.flags` so each
 * unlock toast fires only once per playthrough, and returns newly unlocked items.
 */
export function checkNewAchievementUnlocks(
  state: OstrzeGameState,
  data: OriginGameData
): EvaluatedAchievement[] {
  if (!state.character) return [];
  const newlyUnlocked: EvaluatedAchievement[] = [];
  for (const def of OSTRZE_ACHIEVEMENTS) {
    const flagKey = `ach_${def.id}`;
    if (state.flags[flagKey]) continue;
    if (def.isUnlocked(state, data)) {
      state.flags[flagKey] = true;
      newlyUnlocked.push({
        id: def.id,
        icon: def.icon,
        title: def.title,
        description: def.description,
        unlocked: true
      });
    }
  }
  return newlyUnlocked;
}

export function evaluateCampaignProgress(
  state: OstrzeGameState,
  data: OriginGameData
): CampaignProgressSummary {
  const visited = getVisitedOstrzeLocations(state);
  const visitedIds = new Set(visited.map((l) => l.id));
  const quests = Object.values(state.quests);
  const activeQuests = quests.filter((q) => q === 'active').length;
  const completedQuests = quests.filter((q) => q === 'completed').length;

  const prologueTotal = OSTRZE_LOCATIONS.filter((l) => l.chapter === 'prologue').length;
  const act1Total = OSTRZE_LOCATIONS.filter((l) => l.chapter === 'chapter1').length;
  const act2Total = OSTRZE_LOCATIONS.filter((l) => l.chapter === 'chapter2').length;

  const prologueDone =
    Boolean(state.flags.prolog_ukonczony) || visitedIds.has('wilczy_brod') || visitedIds.has('gluszec');
  const prologueVisited = OSTRZE_LOCATIONS.filter(
    (l) => l.chapter === 'prologue' && visitedIds.has(l.id)
  ).length;
  const prologuePct = prologueDone
    ? 100
    : Math.min(100, Math.round((prologueVisited / Math.max(1, prologueTotal)) * 100));

  const act1Visited = OSTRZE_LOCATIONS.filter(
    (l) => l.chapter === 'chapter1' && visitedIds.has(l.id)
  ).length;
  const act1Pct =
    Boolean(state.flags.akt1_ukonczony) || visitedIds.has('gluszec')
      ? 100
      : Math.min(100, Math.round((act1Visited / Math.max(1, act1Total)) * 100));

  const act2Visited = OSTRZE_LOCATIONS.filter(
    (l) => l.chapter === 'chapter2' && visitedIds.has(l.id)
  ).length;
  const act2Pct = Boolean(state.flags.akt2_ukonczony)
    ? 100
    : Math.min(100, Math.round((act2Visited / Math.max(1, act2Total)) * 100));

  const evaluated = evaluateAchievements(state, data);
  const atmo = getWorldAtmosphere(state, data);
  const daysElapsed = Math.max(1, Math.floor(state.time.minutes / (24 * 60)) + 1);

  return {
    daysElapsed,
    visitedCount: visited.length,
    totalLocations: OSTRZE_LOCATIONS.length,
    activeQuests,
    completedQuests,
    totalXp: state.character?.xp ?? 0,
    perksCount: state.character?.perks.length ?? 0,
    prologuePct,
    act1Pct,
    act2Pct,
    unlockedAchievements: evaluated.filter((a) => a.unlocked).length,
    totalAchievements: evaluated.length,
    atmosphereLabel: atmo.phenomenonName
      ? `${atmo.timeLabel} · ${atmo.clockText} · ${atmo.phenomenonName}`
      : `${atmo.timeLabel} · ${atmo.clockText} · Pogoda spokojna`
  };
}
