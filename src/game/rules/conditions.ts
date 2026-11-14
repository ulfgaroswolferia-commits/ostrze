import type {
  AttributeId,
  ConditionSpec,
  OriginGameData,
  OstrzeGameState,
  SkillId,
  TimeOfDayId
} from '../data/originTypes';
import { getStats } from './stats';
import { timeOfDay } from './time';

function countItem(state: OstrzeGameState, itemId: string): number {
  let total = 0;
  for (const entry of state.inventory.items) {
    if (entry.id === itemId) total += entry.qty;
  }
  for (const equippedId of Object.values(state.inventory.equipped)) {
    if (equippedId === itemId) total += 1;
  }
  return total;
}

function evaluateVar(cond: ConditionSpec, state: OstrzeGameState): boolean {
  const varName = cond.var as string;
  const val = state.vars[varName] ?? 0;
  if (typeof cond.gte === 'number') return val >= cond.gte;
  if (typeof cond.lte === 'number') return val <= cond.lte;
  if (typeof cond.eq === 'number') return val === cond.eq;
  return false;
}

/**
 * Evaluates origin-style declarative conditions against OstrzeGameState.
 */
export function evaluateCondition(
  cond: ConditionSpec | undefined,
  state: OstrzeGameState,
  data: OriginGameData
): boolean {
  if (!cond) return true;
  if (Object.hasOwn(cond, 'var')) {
    return evaluateVar(cond, state);
  }

  return Object.entries(cond).every(([key, value]) => {
    switch (key) {
      case 'flag':
        return state.flags[value as string] === true;
      case 'notFlag':
        return state.flags[value as string] !== true;
      case 'all':
        return (value as ConditionSpec[]).every((sub) => evaluateCondition(sub, state, data));
      case 'any':
        return (value as ConditionSpec[]).some((sub) => evaluateCondition(sub, state, data));
      case 'timeOfDay': {
        const current = timeOfDay(state.time.minutes, data.rules);
        const list = Array.isArray(value) ? (value as TimeOfDayId[]) : [value as TimeOfDayId];
        return list.includes(current);
      }
      case 'location':
        return state.world.location === (value as string);
      case 'known':
        return state.world.knownPlaces.includes(value as string);
      case 'questStatus': {
        const spec = value as { id: string; is: string };
        return (state.quests[spec.id] ?? 'none') === spec.is;
      }
      case 'item': {
        if (!state.character) return false;
        const spec = typeof value === 'string' ? { id: value, qty: 1 } : (value as { id: string; qty?: number });
        return countItem(state, spec.id) >= (spec.qty ?? 1);
      }
      case 'money':
        return state.character ? state.character.money >= (value as number) : false;
      case 'moneyBelow':
        return state.character ? state.character.money < (value as number) : false;
      case 'attribute': {
        if (!state.character) return false;
        const spec = value as { id: AttributeId; gte: number };
        return getStats(state, data).attributes[spec.id] >= spec.gte;
      }
      case 'skill': {
        if (!state.character) return false;
        const spec = value as { id: SkillId; gte: number };
        return getStats(state, data).skills[spec.id] >= spec.gte;
      }
      case 'effect':
        return state.character
          ? state.character.effects.some((e) => e.id === (value as string))
          : false;
      case 'effectStacks': {
        if (!state.character) return false;
        const spec = value as { id: string; gte?: number; lte?: number };
        const stacks = state.character.effects.find((e) => e.id === spec.id)?.stacks ?? 0;
        if (typeof spec.gte === 'number') return stacks >= spec.gte;
        if (typeof spec.lte === 'number') return stacks <= spec.lte;
        return false;
      }
      default:
        return false;
    }
  });
}
