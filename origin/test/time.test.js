import { test } from "node:test";
import assert from "node:assert/strict";
import { clockOf, timeOfDay, advanceTime, HOURLY_HOOKS } from "../src/engine/time.js";
import { minimalData } from "./helpers.js";

test("clockOf", () => {
  assert.deepEqual(clockOf(360), { day: 1, hour: 6, minute: 0 });
  assert.deepEqual(clockOf(1439), { day: 1, hour: 23, minute: 59 });
  assert.deepEqual(clockOf(1440 + 90), { day: 2, hour: 1, minute: 30 });
});

const R = minimalData().rules;
const at = (h, m = 0) => h * 60 + m;

test("timeOfDay na granicach", () => {
  const cases = [[at(4, 59), "noc"], [at(5), "swit"], [at(6, 59), "swit"], [at(7), "dzien"], [at(17, 59), "dzien"],
    [at(18), "zmierzch"], [at(19, 59), "zmierzch"], [at(20), "noc"], [at(0), "noc"], [1440 + at(5), "swit"]];
  for (const [m, id] of cases) assert.equal(timeOfDay(m, R), id, String(m));
});

test("10 × 6 minut = 60 minut (te same zdarzenia)", () => {
  const a = { time: { minutes: at(17, 30) } }, b = { time: { minutes: at(17, 30) } };
  const ea = Array.from({ length: 10 }, () => advanceTime(a, 6, minimalData())).flat();
  assert.deepEqual(ea, advanceTime(b, 60, minimalData()));
  assert.equal(a.time.minutes, b.time.minutes);
  assert.deepEqual(ea.map((e) => e.to), ["zmierzch"]);
});

test("8 h od 22:00 → świt o 5:00; 24 h → 4 zmiany", () => {
  const s = { time: { minutes: at(22) } };
  assert.deepEqual(advanceTime(s, 480, minimalData()), [{ type: "zmiana_pory", to: "swit", at: 1440 + at(5) }]);
  assert.equal(advanceTime({ time: { minutes: at(6) } }, 1440, minimalData()).length, 4);
});

test("hook godzinowy wołany na każdej pełnej godzinie, po zmianie pory", () => {
  const calls = [];
  const hook = (_s, _d, atMinutes) => { calls.push(atMinutes); return [{ type: "hook", at: atMinutes }]; };
  HOURLY_HOOKS.push(hook);
  try {
    const events = advanceTime({ time: { minutes: at(6, 30) } }, 150, minimalData());
    assert.deepEqual(calls, [at(7), at(8), at(9)]);
    assert.deepEqual(events.map((e) => e.type), ["zmiana_pory", "hook", "hook", "hook"]);
  } finally {
    HOURLY_HOOKS.splice(HOURLY_HOOKS.indexOf(hook), 1);
  }
  assert.equal(HOURLY_HOOKS.length, 0);
});
