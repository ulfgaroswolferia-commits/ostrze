import type { OriginGameData, OstrzeGameState, RulesDef, TimeOfDayId } from '../data/originTypes';

const MINUTES_PER_DAY = 24 * 60;

export interface GameClock {
  day: number;
  hour: number;
  minute: number;
}

export interface TimeChangeEvent {
  type: 'zmiana_pory';
  to: TimeOfDayId;
  at: number;
}

export function clockOf(minutes: number): GameClock {
  const day = Math.floor(minutes / MINUTES_PER_DAY) + 1;
  const rest = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return {
    day,
    hour: Math.floor(rest / 60),
    minute: rest % 60
  };
}

function coversHour(entry: { from: number; to: number }, hour: number): boolean {
  return entry.from < entry.to
    ? hour >= entry.from && hour < entry.to
    : hour >= entry.from || hour < entry.to;
}

export function timeOfDay(minutes: number, rules: RulesDef): TimeOfDayId {
  const { hour } = clockOf(minutes);
  const entry = rules.timeOfDay.find((e) => coversHour(e, hour));
  if (!entry) {
    throw new Error(`Brak pory doby dla godziny ${hour}`);
  }
  return entry.id;
}

/**
 * Advances game minutes and emits `zmiana_pory` transitions on hour boundaries.
 */
export function advanceMinutes(
  state: OstrzeGameState,
  minutes: number,
  data: OriginGameData
): TimeChangeEvent[] {
  const events: TimeChangeEvent[] = [];
  let left = Math.max(0, Math.floor(minutes));

  while (left > 0) {
    const step = Math.min(left, 60 - (state.time.minutes % 60));
    const before = timeOfDay(state.time.minutes, data.rules);
    state.time.minutes += step;
    left -= step;

    if (state.time.minutes % 60 === 0) {
      const after = timeOfDay(state.time.minutes, data.rules);
      if (after !== before) {
        events.push({ type: 'zmiana_pory', to: after, at: state.time.minutes });
      }
    }
  }

  return events;
}

/**
 * Advances time until the next occurrence of targetHour (0..23).
 */
export function waitUntilHour(
  state: OstrzeGameState,
  targetHour: number,
  data: OriginGameData
): TimeChangeEvent[] {
  const { hour, minute } = clockOf(state.time.minutes);
  let deltaHours = targetHour - hour;
  if (deltaHours < 0 || (deltaHours === 0 && minute > 0)) {
    deltaHours += 24;
  }
  const deltaMinutes = deltaHours * 60 - minute;
  return advanceMinutes(state, deltaMinutes, data);
}
