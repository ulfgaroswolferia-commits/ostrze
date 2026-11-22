import type { WorldPropEntity } from '@ulf/core/worldMap';
import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import type { OriginGameData, OstrzeGameState } from '../data/originTypes';
import type { SeededRng } from './dice';
import { getStats } from './stats';
import { advanceWorldTimeAndPhenomena } from './worldCycle';

export interface CampRecipe {
  id: string;
  label: string;
  category: 'alchemy' | 'weapon' | 'cooking' | 'sleep';
  description: string;
  ingredients: Array<{ itemId: string; qty: number }>;
  resultItemId?: string;
  resultEffectId?: string;
  durationMinutes: number;
  minMedycyna?: number;
  minMedycynaOrWiedza?: number;
}

export const CAMP_RECIPES: readonly CampRecipe[] = [
  {
    id: 'brew_napar_ziol',
    label: 'Warz Napar ziół (+6–10 HP)',
    category: 'alchemy',
    description: 'Zaparza leśne zioła w wywar przywracający siły.',
    ingredients: [{ itemId: 'ziola_lesne', qty: 2 }],
    resultItemId: 'napar_ziol',
    durationMinutes: 30
  },
  {
    id: 'brew_oklad_ziolowy',
    label: 'Przygotuj Okład ziołowy (+8–14 HP)',
    category: 'alchemy',
    description: 'Mocny okład leczniczy z ziół i opatrunku (Medycyna ≥ 25).',
    ingredients: [
      { itemId: 'ziola_lesne', qty: 2 },
      { itemId: 'opatrunek', qty: 1 }
    ],
    resultItemId: 'oklad_ziolowy',
    durationMinutes: 40,
    minMedycyna: 25
  },
  {
    id: 'brew_odtrutka',
    label: 'Warz Odtrutkę (usuwa Truciznę)',
    category: 'alchemy',
    description: 'Gorzki wywar z ziół i grzybów neutralizujący jad.',
    ingredients: [
      { itemId: 'ziola_lesne', qty: 1 },
      { itemId: 'grzyby', qty: 1 }
    ],
    resultItemId: 'odtrutka',
    durationMinutes: 30
  },
  {
    id: 'brew_napar_korzeni',
    label: 'Warz Napar z korzeni (+2 Krzepa / 6h)',
    category: 'alchemy',
    description: 'Rozgrzewający wywar zwiększający Krzepę przed ciężką walką.',
    ingredients: [
      { itemId: 'grzyby', qty: 2 },
      { itemId: 'ziola_lesne', qty: 1 }
    ],
    resultItemId: 'napar_z_korzeni',
    durationMinutes: 45
  },
  {
    id: 'camp_oil_blade',
    label: 'Natłuść i naostrz ostrze (+1–3 obr. / 2h)',
    category: 'weapon',
    description: 'Konserwacja broni łojem zwiększa skuteczność ciosów.',
    ingredients: [{ itemId: 'loj_do_ostrza', qty: 1 }],
    resultEffectId: 'natluszczone_ostrze',
    durationMinutes: 20
  },
  {
    id: 'camp_cook_meat',
    label: 'Upiecz mięso nad żarem (Najedzony +6 HP)',
    category: 'cooking',
    description: 'Ciepły posiłek usuwa głód i daje +1 Siła, +1 Krzepa na 8h.',
    ingredients: [{ itemId: 'mieso', qty: 1 }],
    resultEffectId: 'najedzony',
    durationMinutes: 30
  },
  {
    id: 'camp_cook_prowiant',
    label: 'Podgrzej prowiant (Najedzony +4 HP)',
    category: 'cooking',
    description: 'Pożywna porcja z zapasów usuwa głód i wzmacnia na 8h.',
    ingredients: [{ itemId: 'prowiant', qty: 1 }],
    resultEffectId: 'najedzony',
    durationMinutes: 20
  },
  {
    id: 'camp_cook_gulasz',
    label: 'Ugotuj Potrawkę z kaszą (przedmiot do plecaka)',
    category: 'cooking',
    description: 'Sycąca potrawka z mięsa i grzybów na drogę lub do Pasa Szybkiego Użycia.',
    ingredients: [
      { itemId: 'mieso', qty: 1 },
      { itemId: 'grzyby', qty: 1 }
    ],
    resultItemId: 'gulasz',
    durationMinutes: 35
  },
  {
    id: 'camp_render_oil',
    label: 'Wytop Łój do ostrza (z mięsa i ziół)',
    category: 'alchemy',
    description: 'Wytapia tłuszcz z ziołami w łój do smarowania klingi (+2 obr.).',
    ingredients: [
      { itemId: 'mieso', qty: 1 },
      { itemId: 'ziola_lesne', qty: 1 }
    ],
    resultItemId: 'loj_do_ostrza',
    durationMinutes: 30
  },
  {
    id: 'brew_flasza_oleju',
    label: 'Przygotuj Flaszę oleju (6–11 obr. ogień)',
    category: 'alchemy',
    description: 'Butelka zapalająca skuteczna przeciw upiorom (Medycyna lub Wiedza tajemna ≥ 20).',
    ingredients: [
      { itemId: 'loj_do_ostrza', qty: 1 },
      { itemId: 'bimber', qty: 1 }
    ],
    resultItemId: 'flasza_oleju',
    durationMinutes: 35,
    minMedycynaOrWiedza: 20
  },
  {
    id: 'brew_swieca_dymna',
    label: 'Zrób Świecę dymną (Dym + Garda w walce)',
    category: 'alchemy',
    description: 'Mieszanka ziół, grzybów i łoju tworząca gęstą zasłonę dymną.',
    ingredients: [
      { itemId: 'ziola_lesne', qty: 1 },
      { itemId: 'grzyby', qty: 1 },
      { itemId: 'loj_do_ostrza', qty: 1 }
    ],
    resultItemId: 'swieca_dymna',
    durationMinutes: 30
  },
  {
    id: 'camp_sleep_6h',
    label: 'Sen i odpoczynek przy ognisku (6h)',
    category: 'sleep',
    description: 'Regeneruje zdrowie, usuwa Zmęczenie i przesuwa zegar o 6 godzin.',
    ingredients: [],
    durationMinutes: 360
  }
];

function getItemQty(state: OstrzeGameState, itemId: string): number {
  return state.inventory.items.find((i) => i.id === itemId)?.qty ?? 0;
}

function addItemQty(state: OstrzeGameState, itemId: string, qty: number): void {
  const existing = state.inventory.items.find((i) => i.id === itemId);
  if (existing) existing.qty += qty;
  else state.inventory.items.push({ id: itemId, qty });
}

function consumeItemQty(state: OstrzeGameState, itemId: string, qty: number): void {
  const existing = state.inventory.items.find((i) => i.id === itemId);
  if (!existing) return;
  existing.qty -= qty;
  if (existing.qty <= 0) {
    state.inventory.items = state.inventory.items.filter((i) => i.id !== itemId);
  }
}

export function canPerformCampRecipe(
  state: OstrzeGameState,
  data: OriginGameData,
  recipe: CampRecipe
): { ok: boolean; reason?: string } {
  if (!state.character) return { ok: false, reason: 'Brak postaci' };
  if (recipe.minMedycyna) {
    const med = getStats(state, data).skills.medycyna ?? 0;
    if (med < recipe.minMedycyna) {
      return { ok: false, reason: `Wymaga Medycyny ≥ ${recipe.minMedycyna}` };
    }
  }
  if (recipe.minMedycynaOrWiedza) {
    const sk = getStats(state, data).skills;
    const best = Math.max(sk.medycyna ?? 0, sk.wiedza_tajemna ?? 0);
    if (best < recipe.minMedycynaOrWiedza) {
      return {
        ok: false,
        reason: `Wymaga Medycyny lub Wiedzy tajemnej ≥ ${recipe.minMedycynaOrWiedza}`
      };
    }
  }
  for (const ing of recipe.ingredients) {
    if (getItemQty(state, ing.itemId) < ing.qty) {
      const def = data.items.find((i) => i.id === ing.itemId);
      return { ok: false, reason: `Brak: ${def?.name ?? ing.itemId} (×${ing.qty})` };
    }
  }
  return { ok: true };
}

export function performCampRecipe(params: {
  state: OstrzeGameState;
  data: OriginGameData;
  rng: SeededRng;
  recipeId: string;
  engine?: OstrzeEngineState;
}): { ok: boolean; message: string } {
  const { state, data, rng, recipeId, engine } = params;
  const recipe = CAMP_RECIPES.find((r) => r.id === recipeId);
  if (!recipe || !state.character) {
    return { ok: false, message: 'Nieznana czynność obozowa.' };
  }

  const check = canPerformCampRecipe(state, data, recipe);
  if (!check.ok) {
    return { ok: false, message: check.reason ?? 'Nie można wykonać.' };
  }

  for (const ing of recipe.ingredients) {
    consumeItemQty(state, ing.itemId, ing.qty);
  }

  const ch = state.character;
  let message = '';

  if ((recipe.category === 'alchemy' || recipe.category === 'cooking') && recipe.resultItemId) {
    addItemQty(state, recipe.resultItemId, 1);
    const outItem = data.items.find((i) => i.id === recipe.resultItemId);
    message = `Przygotowano przy ognisku: ${outItem?.name ?? recipe.resultItemId}.`;
  } else if (recipe.category === 'weapon' && recipe.resultEffectId) {
    ch.effects = ch.effects.filter((e) => e.id !== recipe.resultEffectId);
    ch.effects.push({ id: recipe.resultEffectId, stacks: 1, remainingHours: 2 });
    message = 'Ostrze zostało natłuszczone i naostrzone (+1–3 obr. na 2h).';
  } else if (recipe.category === 'cooking') {
    ch.effects = ch.effects.filter(
      (e) => e.id !== 'glod_lekki' && e.id !== 'glod' && e.id !== 'glod_konanie' && e.id !== 'najedzony'
    );
    ch.effects.push({ id: 'najedzony', stacks: 1, remainingHours: 8 });
    state.vars.hours_without_food = 0;
    const maxHp = getStats(state, data).derived.hpMax;
    const heal = recipe.id === 'camp_cook_meat' ? 6 : 4;
    const prevHp = ch.hp;
    ch.hp = Math.min(maxHp, ch.hp + heal);
    const gained = ch.hp - prevHp;
    message = `Ciepły posiłek przy ognisku: status Najedzony (+1 Siła/Krzepa)${gained > 0 ? `, +${gained} HP` : ''}.`;
  } else if (recipe.category === 'sleep') {
    const isHungry = ch.effects.some((e) => e.id === 'glod' || e.id === 'glod_konanie');
    const maxHp = getStats(state, data).derived.hpMax;
    const missing = Math.max(0, maxHp - ch.hp);
    const healRatio = isHungry ? 0.5 : 1.0;
    const healed = Math.round(missing * healRatio);
    ch.hp = Math.min(maxHp, ch.hp + healed);
    ch.effects = ch.effects.filter((e) => e.id !== 'zmeczenie' && e.id !== 'krwawienie');
    message = `Odpocząłeś 6 godzin przy ognisku${healed > 0 ? ` (+${healed} HP)` : ''}. Zmęczenie ustąpiło.`;
  }

  advanceWorldTimeAndPhenomena({
    state,
    data,
    rng,
    deltaMinutes: recipe.durationMinutes,
    engine,
    isSleeping: recipe.category === 'sleep'
  });

  if (engine) {
    engine.syncFromOstrzeState(state, data);
    engine.addLog(message, 'info');
  }

  return { ok: true, message };
}

/**
 * Handles foraging herbs/berries from interactive flora props on 2.5D maps.
 */
export function forageWorldProp(params: {
  prop: WorldPropEntity;
  state: OstrzeGameState;
  data: OriginGameData;
  rng: SeededRng;
  engine?: OstrzeEngineState;
}): { harvested: boolean; message: string } {
  const { prop, state, data, rng, engine } = params;
  if (prop.kind !== 'wildflower_patch' && prop.kind !== 'berry_bush') {
    return { harvested: false, message: '' };
  }
  if (prop.isOpen) {
    return { harvested: false, message: 'To miejsce zostało już ogołocone z ziół.' };
  }

  prop.isOpen = true;
  const itemId =
    prop.kind === 'berry_bush'
      ? rng.int(1, 100) <= 65
        ? 'jagody'
        : 'ziola_lesne'
      : rng.int(1, 100) <= 70
        ? 'ziola_lesne'
        : 'grzyby';
  const qty = rng.int(1, 2);
  addItemQty(state, itemId, qty);
  const itemDef = data.items.find((i) => i.id === itemId);
  const msg = `Zebrano: ${itemDef?.name ?? itemId} ×${qty}.`;
  engine?.addLog(msg, 'info');
  return { harvested: true, message: msg };
}
