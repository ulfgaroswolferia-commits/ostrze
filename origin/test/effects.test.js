import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEffect, removeEffect, hasEffect, tickHour, clearBySleep } from "../src/systems/effects.js";
import { createCharacter } from "../src/systems/character.js";
import { getStats } from "../src/systems/stats.js";
import { advanceTime, HOURLY_HOOKS } from "../src/engine/time.js";
import { createRng } from "../src/engine/dice.js";
import { minimalData } from "./helpers.js";

const fixed = (k) => ({ int: () => k });

function fresh(data = minimalData()) {
  const choices = {
    name: "Test", classId: "miecz",
    attributes: Object.fromEntries(data.attributes.map((a) => [a.id, 5])),
    tagged: ["sieczna", "wymowa", "medycyna"],
  };
  // find a valid 5/5 choice: the creator pool is fixed, so spend points by attributes of start
  const start = Object.fromEntries(data.attributes.map((a) => [a.id, data.rules.creator.attributeStart + (data.rules.creator.gifts[a.id] ?? 0)]));
  let pool = data.rules.creator.points;
  const attributes = { ...start };
  for (const a of data.attributes) {
    while (pool > 0 && attributes[a.id] < data.rules.creator.attributeMax) { attributes[a.id]++; pool--; }
  }
  choices.attributes = attributes;
  const cls = data.classes.find((c) => c.id === "miecz");
  choices.tagged = [...new Set([cls.taggedSkill, "wymowa", "medycyna"])].slice(0, data.rules.creator.taggedCount);
  const character = createCharacter(choices, data);
  for (const a of data.attributes) character.attributes[a.id] = 5;
  return { data, state: { character, time: { minutes: 12 * 60 } } };
}

test("createCharacter ustawia effects: []", () => {
  assert.deepEqual(fresh().state.character.effects, []);
});

test("applyEffect: stan, modyfikatory i breakdown", () => {
  const { data, state } = fresh();
  const before = getStats(state, data).skills.wymowa;
  const res = applyEffect(state, data, "podchmielenie", fixed(100));
  assert.deepEqual(res, { ok: true, resisted: false, stacks: 1 });
  assert.deepEqual(state.character.effects, [{ id: "podchmielenie", remaining: 3, stacks: 1 }]);
  assert.ok(hasEffect(state, "podchmielenie"));
  const stats = getStats(state, data);
  assert.equal(stats.skills.wymowa, before + 10);
  assert.ok(stats.breakdown.wymowa.some((e) => e.source.kind === "effect" && e.source.id === "podchmielenie" && e.value === 10));
  assert.equal(getStats(state, data, { permanentOnly: true }).skills.wymowa, before);
});

test("applyEffect: nieznany id i efekt turowy rzucają", () => {
  const { data, state } = fresh();
  assert.throws(() => applyEffect(state, data, "nie_ma", fixed(1)));
  assert.throws(() => applyEffect(state, data, "oslepienie", fixed(1)));
});

test("odporność: próg, force i shorten", () => {
  const { data, state } = fresh();
  const resist = state.character.attributes.krzepa * data.rules.effects.resistAttributeMult;
  assert.equal(resist, 25);
  assert.deepEqual(applyEffect(state, data, "trucizna", fixed(25)), { ok: true, resisted: true, stacks: 0 });
  assert.deepEqual(state.character.effects, []);
  assert.equal(applyEffect(state, data, "trucizna", fixed(26)).resisted, false);
  assert.equal(state.character.effects.length, 1);
  removeEffect(state, "trucizna");
  assert.equal(applyEffect(state, data, "trucizna", fixed(1), { force: true }).resisted, false);
  assert.equal(state.character.effects.length, 1);

  const s2 = fresh();
  s2.data.rules.effects.resistOutcome = "shorten";
  const r = applyEffect(s2.state, s2.data, "trucizna", fixed(1));
  assert.equal(r.resisted, true);
  assert.equal(s2.state.character.effects[0].remaining, 2);
});

for (const mode of ["refresh", "extend", "stack"]) {
  test(`odporność shorten: oparty na aktywnym efekcie (${mode}) nic nie zmienia`, () => {
    const { data, state } = fresh();
    data.rules.effects.resistOutcome = "shorten";
    data.effects.find((e) => e.id === "trucizna").stack = mode;
    applyEffect(state, data, "trucizna", fixed(1), { force: true });
    state.character.effects[0].remaining = 2;
    const before = structuredClone(state.character.effects);
    const r = applyEffect(state, data, "trucizna", fixed(1));
    assert.deepEqual(r, { ok: true, resisted: true, stacks: 1 });
    assert.deepEqual(state.character.effects, before);
  });
}

test("kumulacja: stack, refresh, extend", () => {
  const { data, state } = fresh();
  for (let i = 0; i < 4; i++) applyEffect(state, data, "trucizna", fixed(100));
  assert.deepEqual(state.character.effects, [{ id: "trucizna", remaining: 4, stacks: 3 }]);

  applyEffect(state, data, "zmeczenie", fixed(100));
  tickHour(state, data, fixed(1));
  assert.equal(state.character.effects.find((e) => e.id === "zmeczenie").remaining, 11);
  applyEffect(state, data, "zmeczenie", fixed(100));
  assert.deepEqual(state.character.effects.find((e) => e.id === "zmeczenie"), { id: "zmeczenie", remaining: 12, stacks: 1 });

  const ext = structuredClone(data);
  ext.effects.push({ id: "test_extend", name: "T", description: "T", unit: "hour", duration: 3, stack: "extend" });
  const e = fresh(ext);
  applyEffect(e.state, ext, "test_extend", fixed(100));
  applyEffect(e.state, ext, "test_extend", fixed(100));
  assert.equal(e.state.character.effects[0].remaining, 4);
});

test("tickHour: obrażenia obcięte do HP 1, zdarzenia, koniec", () => {
  const { data, state } = fresh();
  applyEffect(state, data, "trucizna", fixed(100));
  applyEffect(state, data, "trucizna", fixed(100));
  state.character.hp = 3;
  const events = tickHour(state, data, fixed(3));
  assert.deepEqual(events, [{ type: "efekt_obrazenia", id: "trucizna", damage: 2 }]);
  assert.equal(state.character.hp, 1);
  assert.equal(state.character.effects[0].remaining, 3);
  const all = [];
  for (let i = 0; i < 3; i++) all.push(...tickHour(state, data, fixed(3)));
  assert.deepEqual(all.at(-1), { type: "efekt_koniec", id: "trucizna" });
  assert.deepEqual(state.character.effects, []);
  assert.equal(state.character.hp, 1);
});

test("tickHour: HP 1 → brak zdarzenia obrażeń; bez rng = min × stosy", () => {
  const { data, state } = fresh();
  applyEffect(state, data, "trucizna", fixed(100));
  state.character.hp = 1;
  assert.deepEqual(tickHour(state, data, fixed(3)), []);
  state.character.hp = 10;
  tickHour(state, data);
  assert.equal(state.character.hp, 9);
});

test("advanceTime: tyknięcia przed haczykami godzinowymi, w kolejności czasu", () => {
  const { data, state } = fresh();
  applyEffect(state, data, "trucizna", fixed(100));
  const hook = (_s, _d, at) => [{ type: "hook", at }];
  HOURLY_HOOKS.push(hook);
  try {
    const events = advanceTime(state, 120, data, createRng(7));
    assert.deepEqual(events.map((e) => e.type), ["efekt_obrazenia", "hook", "efekt_obrazenia", "hook"]);
    assert.equal(events[1].at, 13 * 60);
  } finally {
    HOURLY_HOOKS.splice(HOURLY_HOOKS.indexOf(hook), 1);
  }
});

test("clearBySleep: zdejmuje zmęczenie od 6 h, nie truciznę", () => {
  const { data, state } = fresh();
  applyEffect(state, data, "zmeczenie", fixed(100));
  applyEffect(state, data, "trucizna", fixed(100));
  assert.deepEqual(clearBySleep(state, data, 5), []);
  assert.deepEqual(clearBySleep(state, data, 6), ["zmeczenie"]);
  assert.ok(hasEffect(state, "trucizna"));
  assert.ok(!hasEffect(state, "zmeczenie"));
});

test("removeEffect nieobecnego", () => {
  const { state } = fresh();
  assert.deepEqual(removeEffect(state, "trucizna"), { ok: true, removed: false });
});

test("podchmielenie: każdy łyk to stopień (max 3), czas wraca do 3 h", () => {
  const { data, state } = fresh();
  const base = getStats(state, data).skills.wymowa;
  applyEffect(state, data, "podchmielenie", fixed(100));
  tickHour(state, data, fixed(1));
  applyEffect(state, data, "podchmielenie", fixed(100));
  assert.deepEqual(state.character.effects.find((e) => e.id === "podchmielenie"), { id: "podchmielenie", remaining: 3, stacks: 2 });
  applyEffect(state, data, "podchmielenie", fixed(100));
  applyEffect(state, data, "podchmielenie", fixed(100));
  assert.equal(state.character.effects.find((e) => e.id === "podchmielenie").stacks, 3);
  assert.equal(getStats(state, data).skills.wymowa, base + 30);
});
