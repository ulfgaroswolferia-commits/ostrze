import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import type { OriginGameData, OstrzeGameState, TimeOfDayId } from '../data/originTypes';
import type { SeededRng } from './dice';
import { clockOf, timeOfDay } from './time';

export interface WorldAtmosphereSnapshot {
  timeOfDay: TimeOfDayId;
  timeLabel: string;
  clockText: string;
  ambientIntensity: number;
  phenomenonId: string | null;
  phenomenonName: string | null;
  phenomenonSummary: string | null;
}

const TOD_LABELS: Record<TimeOfDayId, string> = {
  swit: 'Świt',
  dzien: 'Dzień',
  zmierzch: 'Zmierzch',
  noc: 'Noc'
};

const TOD_AMBIENT: Record<TimeOfDayId, number> = {
  swit: 0.56,
  dzien: 0.78,
  zmierzch: 0.44,
  noc: 0.26
};

export function summarizePhenomenon(
  phenomenonId: string | null,
  data: OriginGameData
): string | null {
  if (!phenomenonId) return null;
  const ph = data.phenomena.find((p) => p.id === phenomenonId);
  if (!ph) return null;
  const parts: string[] = [];
  if (ph.modifiers?.skradanie) parts.push(`+${ph.modifiers.skradanie}% Skradanie`);
  if (ph.modifiers?.rangedHitChance) parts.push(`${ph.modifiers.rangedHitChance}% Strzelecka`);
  if (ph.bystroscSkillPenalty) parts.push(`${ph.bystroscSkillPenalty}% Bystrość`);
  if (ph.id === 'mgla_ciszy') parts.push('Blokuje proch');
  return parts.length > 0 ? parts.join(' · ') : ph.kind === 'magiczne' ? 'Zjawisko magiczne' : 'Pogoda';
}

export function getWorldAtmosphere(
  state: OstrzeGameState,
  data: OriginGameData
): WorldAtmosphereSnapshot {
  const tod = timeOfDay(state.time.minutes, data.rules);
  let ambient = TOD_AMBIENT[tod];
  const phId = state.world.activePhenomenon;
  const ph = phId ? data.phenomena.find((p) => p.id === phId) : undefined;

  if (phId === 'noc_bez_gwiazd') ambient -= 0.1;
  else if (phId === 'mgla_ciszy' || phId === 'ulewa' || phId === 'mgla_poranna') ambient -= 0.08;
  else if (phId === 'burza_iskier') ambient += 0.04;

  const { hour, minute } = clockOf(state.time.minutes);
  const clockText = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    timeOfDay: tod,
    timeLabel: TOD_LABELS[tod],
    clockText,
    ambientIntensity: Math.max(0.16, Math.min(0.92, Number(ambient.toFixed(2)))),
    phenomenonId: ph?.id ?? null,
    phenomenonName: ph?.name ?? null,
    phenomenonSummary: summarizePhenomenon(ph?.id ?? null, data)
  };
}

export function syncWorldLighting(
  state: OstrzeGameState,
  data: OriginGameData,
  engine: OstrzeEngineState
): WorldAtmosphereSnapshot {
  const snap = getWorldAtmosphere(state, data);
  engine.ambientLightIntensity = snap.ambientIntensity;
  return snap;
}

export interface AdvanceTimeResult {
  hoursElapsed: number;
  expiredEffects: string[];
  newPhenomenonName: string | null;
  fatigueApplied: boolean;
  hungerApplied: boolean;
}

/**
 * Advances Ostrze world time, expires timed effects, updates gentle survival counters
 * (fatigue/hunger only trigger after >16h without sleep/food), rolls atmospheric
 * phenomena from `origin/data/phenomena.json`, and syncs 2.5D ambient lighting.
 */
export function advanceWorldTimeAndPhenomena(params: {
  state: OstrzeGameState;
  data: OriginGameData;
  rng: SeededRng;
  deltaMinutes: number;
  engine?: OstrzeEngineState;
  isSleeping?: boolean;
}): AdvanceTimeResult {
  const { state, data, rng, deltaMinutes, engine, isSleeping } = params;
  const hoursElapsed = Math.max(0, deltaMinutes / 60);
  state.time.minutes += Math.max(0, Math.round(deltaMinutes));

  const expiredEffects: string[] = [];
  let fatigueApplied = false;
  let hungerApplied = false;

  const ch = state.character;
  if (ch && hoursElapsed > 0) {
    // 1. Tick timed effects
    const kept: typeof ch.effects = [];
    for (const eff of ch.effects) {
      if (typeof eff.remainingHours === 'number') {
        const nextRem = eff.remainingHours - hoursElapsed;
        if (nextRem <= 0) {
          expiredEffects.push(eff.id);
          continue;
        }
        kept.push({ ...eff, remainingHours: Number(nextRem.toFixed(2)) });
      } else {
        kept.push(eff);
      }
    }
    ch.effects = kept;

    // 2. Gentle survival counters (>16h threshold so exploration stays fun, not tedious)
    if (isSleeping) {
      state.vars.hours_without_sleep = 0;
      ch.effects = ch.effects.filter((e) => e.id !== 'zmeczenie');
    } else {
      state.vars.hours_without_sleep = (state.vars.hours_without_sleep ?? 0) + hoursElapsed;
      if (
        state.vars.hours_without_sleep > 16 &&
        !ch.effects.some((e) => e.id === 'zmeczenie')
      ) {
        ch.effects.push({ id: 'zmeczenie', stacks: 1, remainingHours: 12 });
        fatigueApplied = true;
        engine?.addLog('Zmęczenie daje o sobie znać (-1 AP, -1 Bystrość). Odpocznij przy ognisku.', 'info');
      }
    }

    const isWellFed = ch.effects.some((e) => e.id === 'najedzony');
    if (isWellFed) {
      state.vars.hours_without_food = 0;
    } else {
      state.vars.hours_without_food = (state.vars.hours_without_food ?? 0) + hoursElapsed;
      if (
        state.vars.hours_without_food > 16 &&
        !ch.effects.some((e) => e.id === 'glod_lekki' || e.id === 'glod')
      ) {
        ch.effects.push({ id: 'glod_lekki', stacks: 1 });
        hungerApplied = true;
        engine?.addLog('Burczy w brzuchu (-1 Siła). Zjedz posiłek lub ugotuj coś przy ognisku.', 'info');
      }
    }
  }

  // 3. Phenomenon duration & roll
  let newPhenomenonName: string | null = null;
  if (hoursElapsed > 0) {
    if (state.world.activePhenomenon) {
      const rem = (state.vars.phenomenon_hours_left ?? 3) - hoursElapsed;
      if (rem <= 0) {
        const oldPh = data.phenomena.find((p) => p.id === state.world.activePhenomenon);
        state.world.activePhenomenon = null;
        state.vars.phenomenon_hours_left = 0;
        if (oldPh) {
          engine?.addLog(`Zjawisko ustępuje: ${oldPh.name}.`, 'info');
        }
      } else {
        state.vars.phenomenon_hours_left = rem;
      }
    } else if (hoursElapsed >= 1 && data.phenomena.length > 0) {
      const tod = timeOfDay(state.time.minutes, data.rules);
      const roll = rng.int(1, 100);
      // Scaled probability per elapsed hours (~12% per 6h rest/travel)
      const triggerThreshold = Math.min(30, Math.round(hoursElapsed * 3));
      if (roll <= triggerThreshold) {
        const eligible = data.phenomena.filter((ph) => {
          const allowed = (ph as unknown as { timeOfDay?: TimeOfDayId[] | null }).timeOfDay;
          return !allowed || allowed.includes(tod);
        });
        if (eligible.length > 0) {
          const chosen = eligible[rng.int(0, eligible.length - 1)];
          state.world.activePhenomenon = chosen.id;
          state.vars.phenomenon_hours_left = rng.int(2, 5);
          newPhenomenonName = chosen.name;
          const omenText = (chosen as unknown as { omen?: { text?: string } }).omen?.text;
          engine?.addLog(
            omenText
              ? `Znak na niebie: ${omenText} (${chosen.name})`
              : `Nadchodzi zjawisko: ${chosen.name}.`,
            'important'
          );
        }
      }
    }
  }

  if (engine) {
    syncWorldLighting(state, data, engine);
  }

  return {
    hoursElapsed,
    expiredEffects,
    newPhenomenonName,
    fatigueApplied,
    hungerApplied
  };
}
