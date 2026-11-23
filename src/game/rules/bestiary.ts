import type { OriginGameData, OstrzeGameState } from '../data/originTypes';
import { resolveEnemyArchetype } from './combatAi';
import {
  formatEnemyResistances,
  resolveEnemyPixArtId,
  type EnemyResistanceTag
} from './combatEnemyMeta';

export const HUNTER_LORE_KILL_THRESHOLD = 3;
export const HUNTER_LORE_BONUS_DAMAGE = 1;

export interface BestiaryMetaDef {
  id: string;
  loreText: string;
  tacticalTip: string;
}

export const BESTIARY_META: readonly BestiaryMetaDef[] = [
  {
    id: 'instruktor',
    loreText: 'Doświadczony fechmistrz Szkoły Ostrzy w Brzezinie. Uczy adeptów pracy nóg i szacunku do gardy.',
    tacticalTip: 'Obserwuj jego postawę obronną i używaj Finty lub Cięcia Łukiem, by przełamać gardę.'
  },
  {
    id: 'bandyta',
    loreText: 'Zdesperowany zbój z leśnych traktów Pogórza, polujący na samotnych kupców i gońców.',
    tacticalTip: 'W zwarciu przechodzi do gardy przy niskim HP — dobij go manewrem [R] lub atakiem z zaskoczenia [A].'
  },
  {
    id: 'rabus',
    loreText: 'Obdarty rzezimieszek z szajki z przełęczy, uzbrojony w wyszczerbiony topór lub pałkę.',
    tacticalTip: 'Podatny na Krwawienie i szybkie wyeliminowanie zanim okrąży cię z kompanami.'
  },
  {
    id: 'rabus_lucznik',
    loreText: 'Strzelec zasadzki trzymający dystans między drzewami i ostrzeliwujący wędrowców.',
    tacticalTip: 'Korzystaj z Osłon terenowych (-20% trafienia dyst.) lub przyprzyj go do krawędzi, by wymusić słaby cios nożem.'
  },
  {
    id: 'klusownik',
    loreText: 'Leśny strzelec z Boru Kłusowników, znający każdą ścieżkę i wykrot w Głuszy.',
    tacticalTip: 'Odskakuje przy próbie zwarcia — użyj Pchnięcia Włócznią (2 kafle), Strzału w Ścięgno lub Świecy dymnej.'
  },
  {
    id: 'maruder',
    loreText: 'Zbrojny szabrownik żerujący na spalonych osadach i porzuconych wozach.',
    tacticalTip: 'Walczy w grupie wokół ognisk i beczek ze smołą — zdetonuj beczkę (3 AP), by podpalić cały oddział.'
  },
  {
    id: 'herszt_zbojcow',
    loreText: 'Brutalny przywódca banitów w ciężkim pancerzu lamelkowym i szyszaku.',
    tacticalTip: 'Gdy bierze zamach (⚠️), włącz Gardę [3] lub ogłusz go Garnkiem huku / Hukiem Zaporowym.'
  },
  {
    id: 'wilk',
    loreText: 'Wygłodniały drapieżnik z Wilczej Nory i Starego Traktu, polujący w zgranej watasze.',
    tacticalTip: 'Wilki flankują i nakładają Krwawienie — nie daj się otoczyć i trzymaj bandaże na Pasie [4–7].'
  },
  {
    id: 'dzik',
    loreText: 'Masywny odyniec z gęstwiny Lasu Rubieży, szarżujący bez strachu na każdego intruza.',
    tacticalTip: 'Duża pula HP, ale niska obrona — broń drzewcowa i celowane ciosy szybko go powalą.'
  },
  {
    id: 'zmija_lesna',
    loreText: 'Zwinna żmija kryjąca się w paprociach i kamiennych rozpadlinach.',
    tacticalTip: 'Jej ukąszenie nakłada Zatrucie (-10% trafienia i obrażenia co turę) — miej pod ręką Odtrutkę.'
  },
  {
    id: 'utopiec',
    loreText: 'Trupi stwór z Bagien Szarej Wody i zalanych sztolni, wciągający ofiary w topiel.',
    tacticalTip: 'Bardzo groźny w grupie nad wodą — ogień (Flasza oleju, beczki) oraz cięcia mieczem szybko go niszczą.'
  },
  {
    id: 'blednik',
    loreText: 'Zdradliwy świetlik moczarów, mamiący podróżnych we mgle i sprowadzający rozkojarzenie.',
    tacticalTip: 'Niska wytrzymałość, ale wysoka zwinność — użyj broni o wysokiej celności lub ataku obszarowego.'
  },
  {
    id: 'skrzat_zlosnik',
    loreText: 'Złośliwy duch leśnych ostępów i opuszczonych młynów, rzucający klątwy i kamienie.',
    tacticalTip: 'Nie pozwól mu przedłużać starcia — szybki doskok i jeden celny manewr wystarczą.'
  },
  {
    id: 'upior_zwiadowca',
    loreText: 'Pomniejszy cień zrodzony w pobliżu spadłego gwiezdnego żelaza, patrolujący mroczne uroczyska.',
    tacticalTip: 'Zwykła stal zadaje mu ułamek obrażeń — użyj Flaszy oleju, ognia lub Gwiezdnego Ostrza.'
  },
  {
    id: 'upior_nocy',
    loreText: 'Pradawna Zmora z Uroczyska, Starego Młyna i głębi Starej Kopalni, niemal niewrażliwa na zwykłe żelazo.',
    tacticalTip: 'Odporna (-90%) na zwykłe cięcia i kłucia! Używaj Flaszy oleju (×2 obr.), wybuchowych beczek lub Gwiezdnego Ostrza od Bogdana.'
  }
];

export interface EvaluatedBestiaryEntry {
  id: string;
  name: string;
  archetypeLabel: string;
  unlocked: boolean;
  killCount: number;
  hunterLoreActive: boolean;
  hp: number;
  ap: number;
  defense: number;
  pixArtId: string | null;
  resistances: EnemyResistanceTag[];
  loreText: string;
  tacticalTip: string;
}

export function recordBestiaryEncounter(
  state: OstrzeGameState | null | undefined,
  originId: string | null | undefined
): void {
  if (!state || !originId) return;
  if (!BESTIARY_META.some((m) => m.id === originId)) return;
  state.flags[`bestiary_seen_${originId}`] = true;
}

export function recordBestiaryKill(
  state: OstrzeGameState | null | undefined,
  originId: string | null | undefined
): { newKillCount: number; justUnlockedHunterLore: boolean } {
  if (!state || !originId || !BESTIARY_META.some((m) => m.id === originId)) {
    return { newKillCount: 0, justUnlockedHunterLore: false };
  }
  state.flags[`bestiary_seen_${originId}`] = true;
  const key = `bestiary_kills_${originId}`;
  const prev = state.vars[key] ?? 0;
  const next = prev + 1;
  state.vars[key] = next;
  return {
    newKillCount: next,
    justUnlockedHunterLore: prev < HUNTER_LORE_KILL_THRESHOLD && next >= HUNTER_LORE_KILL_THRESHOLD
  };
}

export function getHunterLoreBonusDamage(
  state: OstrzeGameState | null | undefined,
  originId: string | null | undefined
): number {
  if (!state || !originId) return 0;
  const kills = state.vars[`bestiary_kills_${originId}`] ?? 0;
  return kills >= HUNTER_LORE_KILL_THRESHOLD ? HUNTER_LORE_BONUS_DAMAGE : 0;
}

export function evaluateBestiaryEntries(
  state: OstrzeGameState,
  data: OriginGameData
): EvaluatedBestiaryEntry[] {
  const archetypeLabels = {
    boss: '👑 Boss / Elita',
    ranged_kiter: '🏹 Strzelec',
    predator: '🐺 Drapieżnik',
    melee_cautious: '⚔️ Zbrojny'
  } as const;

  return BESTIARY_META.map((meta) => {
    const def = data.enemies.find((e) => e.id === meta.id);
    const killCount = state.vars[`bestiary_kills_${meta.id}`] ?? 0;
    const unlocked = Boolean(state.flags[`bestiary_seen_${meta.id}`]) || killCount > 0;
    const archetype = resolveEnemyArchetype(meta.id, def);
    return {
      id: meta.id,
      name: def?.name ?? meta.id,
      archetypeLabel: archetypeLabels[archetype],
      unlocked,
      killCount,
      hunterLoreActive: killCount >= HUNTER_LORE_KILL_THRESHOLD,
      hp: def?.hp ?? 20,
      ap: def?.ap ?? 6,
      defense: def?.defense ?? 10,
      pixArtId: resolveEnemyPixArtId(meta.id, def?.name ?? meta.id),
      resistances: formatEnemyResistances(meta.id, data),
      loreText: meta.loreText,
      tacticalTip: meta.tacticalTip
    };
  });
}
