export interface SeededRng {
  next(): number;
  int(min: number, max: number): number;
  percent(chance: number): { roll: number; success: boolean };
  getState(): number;
  setState(newState: number): void;
}

function stepMulberry32(s: number): [number, number] {
  const nextState = (s + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [nextState, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}

/**
 * Seeded mulberry32 RNG matching origin/src/engine/dice.js.
 */
export function createRng(seed: number): SeededRng {
  let state = seed >>> 0;
  const rng: SeededRng = {
    next() {
      const [s, value] = stepMulberry32(state);
      state = s;
      return value;
    },
    int(min: number, max: number) {
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    percent(chance: number) {
      const roll = rng.int(1, 100);
      return { roll, success: roll <= chance };
    },
    getState() {
      return state;
    },
    setState(newState: number) {
      state = newState >>> 0;
    }
  };
  return rng;
}
