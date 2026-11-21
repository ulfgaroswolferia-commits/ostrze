import type { OstrzeAmbienceMood } from '../audio/ostrzeAudio';
import type {
  ConditionSpec,
  OriginGameData,
  OriginTravelEventDef,
  OstrzeGameState
} from '../data/originTypes';
import { evaluateCondition } from './conditions';
import type { SeededRng } from './dice';
import { timeOfDay } from './time';
import type { ChapterId } from '../state/saveManager';

export interface OstrzeLocationMeta {
  id: string;
  chapter: ChapterId;
  name: string;
  subtitle: string;
  danger: number;
  ambience: OstrzeAmbienceMood;
  travelMinutes: number;
}

export const OSTRZE_LOCATIONS: readonly OstrzeLocationMeta[] = [
  {
    id: 'brzezina_dziedziniec',
    chapter: 'prologue',
    name: 'Brzezina — Dziedziniec',
    subtitle: 'Szkoła Ostrzy na Pogórzu',
    danger: 1,
    ambience: 'dawn',
    travelMinutes: 90
  },
  {
    id: 'trakt_zasadzka',
    chapter: 'prologue',
    name: 'Leśny Trakt',
    subtitle: 'Droga przez lasy Pogórza',
    danger: 2,
    ambience: 'forest',
    travelMinutes: 75
  },
  {
    id: 'uroczysko_noc',
    chapter: 'prologue',
    name: 'Uroczysko',
    subtitle: 'Polana na skraju boru',
    danger: 3,
    ambience: 'creepy_forest',
    travelMinutes: 90
  },
  {
    id: 'pobojowisko_swit',
    chapter: 'prologue',
    name: 'Rozdroże i Pobojowisko',
    subtitle: 'Przedpola Wilczego Brodu',
    danger: 2,
    ambience: 'dawn',
    travelMinutes: 60
  },
  {
    id: 'wilczy_brod',
    chapter: 'chapter1',
    name: 'Strażnica Wilczy Bród',
    subtitle: 'Główna strażnica na Pogórzu',
    danger: 1,
    ambience: 'town',
    travelMinutes: 60
  },
  {
    id: 'wilcza_nora',
    chapter: 'chapter1',
    name: 'Wilcza Nora',
    subtitle: 'Wąwóz w górę strumienia',
    danger: 3,
    ambience: 'creepy_forest',
    travelMinutes: 80
  },
  {
    id: 'wilczy_las',
    chapter: 'chapter1',
    name: 'Las Rubieży',
    subtitle: 'Puszcza wokół Wilczego Brodu',
    danger: 2,
    ambience: 'forest',
    travelMinutes: 75
  },
  {
    id: 'stary_mlyn',
    chapter: 'chapter1',
    name: 'Stary Młyn nad Rzeką',
    subtitle: 'Młyn Ostapa przy brodzie',
    danger: 2,
    ambience: 'dawn',
    travelMinutes: 60
  },
  {
    id: 'trakt_kupiecki',
    chapter: 'chapter1',
    name: 'Trakt Kupiecki',
    subtitle: 'Gościniec ku przełęczy',
    danger: 2,
    ambience: 'forest',
    travelMinutes: 85
  },
  {
    id: 'lesniczowka',
    chapter: 'chapter1',
    name: 'Leśniczówka na Skraju Puszczy',
    subtitle: 'Siedziba leśniczego',
    danger: 2,
    ambience: 'forest',
    travelMinutes: 75
  },
  {
    id: 'ruiny_straznicy',
    chapter: 'chapter1',
    name: 'Ruiny Starej Strażnicy',
    subtitle: 'Zarośnięte gruzowisko na wzgórzu',
    danger: 3,
    ambience: 'creepy_forest',
    travelMinutes: 95
  },
  {
    id: 'kamienna_przelecz',
    chapter: 'chapter1',
    name: 'Kamienna Przełęcz',
    subtitle: 'Górski przesmyk Pogórza',
    danger: 3,
    ambience: 'dawn',
    travelMinutes: 110
  }
];

export function getOstrzeLocationMeta(locationId: string): OstrzeLocationMeta | undefined {
  return OSTRZE_LOCATIONS.find((loc) => loc.id === locationId);
}

export function markOstrzeLocationVisited(state: OstrzeGameState, sceneId: string): void {
  if (!getOstrzeLocationMeta(sceneId)) return;
  if (!state.world.knownPlaces.includes(sceneId)) {
    state.world.knownPlaces.push(sceneId);
  }
}

export function getVisitedOstrzeLocations(state: OstrzeGameState): OstrzeLocationMeta[] {
  const known = new Set(state.world.knownPlaces);
  if (known.has('brzezina')) {
    known.add('brzezina_dziedziniec');
  }
  return OSTRZE_LOCATIONS.filter((loc) => known.has(loc.id));
}

function isSupportedTravelEvent(ev: OriginTravelEventDef, data: OriginGameData): boolean {
  if (ev.weight <= 0 || ev.endsTrip) return false;
  if (ev.kind !== 'encounter' && ev.kind !== 'attack' && ev.kind !== 'weather') return false;
  if (ev.kind === 'weather') return typeof ev.phenomenon === 'string';
  if (!Array.isArray(ev.scenes) || ev.scenes.length === 0) return false;
  for (const sc of ev.scenes) {
    if (sc.type === 'dialogue' && (!sc.dialogue || !data.prologueDialogues[sc.dialogue])) {
      return false;
    }
    if (sc.type === 'shop' && (!sc.shop || !data.shops.some((s) => s.id === sc.shop))) {
      return false;
    }
  }
  return true;
}

/**
 * Rolls a random travel encounter between two Ostrze locations using origin/data/travel.json
 * and origin/data/rules.json (`localEventChance`, repeat decay, night attack weight).
 */
export function rollOriginTravelEncounter(
  state: OstrzeGameState,
  data: OriginGameData,
  rng: SeededRng,
  fromId: string,
  toId: string
): OriginTravelEventDef | null {
  const dest = getOstrzeLocationMeta(toId);
  const travelRules = data.rules.travel ?? {
    localEventChance: 40,
    localDangerBonus: 20,
    repeat: { decay: 0.8, floorWalk: 15 },
    night: { periods: ['zmierzch', 'noc'], eventBonus: 20, attackWeight: 3 }
  };
  const passKey = [fromId, toId].sort().join('>');
  state.world.passes ??= {};
  const passes = state.world.passes[passKey] ?? 0;
  state.world.passes[passKey] = passes + 1;

  const baseChance =
    travelRules.localEventChance + ((dest?.danger ?? 1) >= 3 ? travelRules.localDangerBonus : 0);
  const decay = travelRules.repeat?.decay ?? 0.8;
  const floor = travelRules.repeat?.floorWalk ?? 15;
  const thinnedChance = Math.min(baseChance, Math.max(floor, Math.round(baseChance * decay ** passes)));

  const currentPeriod = timeOfDay(state.time.minutes, data.rules);
  const isDark = travelRules.night?.periods.includes(currentPeriod) ?? false;
  const finalChance = thinnedChance + (isDark ? (travelRules.night?.eventBonus ?? 0) : 0);

  if (rng.int(1, 100) > finalChance) {
    return null;
  }

  const seen = new Set(state.world.eventsSeen ?? []);
  const pool = data.travelEvents.filter((ev) => {
    if (!isSupportedTravelEvent(ev, data)) return false;
    if (ev.once && seen.has(ev.id)) return false;
    if (ev.if && !evaluateCondition(ev.if as ConditionSpec, state, data)) return false;
    return true;
  });

  if (pool.length === 0) return null;

  const attackMult = isDark ? (travelRules.night?.attackWeight ?? 1) : 1;
  const weighted = pool.map((ev) => ({
    ev,
    w: ev.weight * (ev.kind === 'attack' ? attackMult : 1)
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.w, 0);
  let roll = rng.int(1, Math.max(1, totalWeight));
  let picked = weighted[weighted.length - 1].ev;
  for (const item of weighted) {
    roll -= item.w;
    if (roll <= 0) {
      picked = item.ev;
      break;
    }
  }

  if (picked.once) {
    state.world.eventsSeen ??= [];
    if (!state.world.eventsSeen.includes(picked.id)) {
      state.world.eventsSeen.push(picked.id);
    }
  }

  return picked;
}
