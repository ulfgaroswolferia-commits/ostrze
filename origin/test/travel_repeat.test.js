import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { passKey, repeatChance, recordPass } from "../src/systems/travel.js";

const R = { decay: 0.8, floor: 8 };

test("repeatChance: bez przejść zwykła szansa, potem maleje o 20% na przejście", () => {
  assert.equal(repeatChance(55, 0, R), 55);
  assert.equal(repeatChance(55, 3, R), Math.round(55 * 0.8 ** 3));
  assert.equal(repeatChance(25, 1, R), 20);
});

test("repeatChance: nigdy nie spada poniżej progu i nie jest zerem", () => {
  assert.equal(repeatChance(55, 30, R), 8);
  assert.equal(repeatChance(25, 100, { decay: 0.8, floor: 15 }), 15);
  for (let n = 0; n <= 40; n++) assert.ok(repeatChance(55, n, R) >= 8);
});

test("repeatChance: funkcja nierosnąca i nie większa niż szansa bazowa", () => {
  let prev = Infinity;
  for (let n = 0; n <= 30; n++) {
    const c = repeatChance(55, n, R);
    assert.ok(c <= prev && c <= 55);
    prev = c;
  }
  assert.equal(repeatChance(0, 0, R), 0);
  assert.equal(repeatChance(5, 0, R), 5);
});

test("passKey: kierunek bez znaczenia", () => {
  assert.equal(passKey("a", "b"), passKey("b", "a"));
  assert.notEqual(passKey("a", "b"), passKey("a", "c"));
});

test("recordPass: licznik rośnie od zera w world.passes", () => {
  const data = minimalData();
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  assert.deepEqual(state.world.passes, {});
  recordPass(state, "a>b");
  recordPass(state, "a>b");
  recordPass(state, "c>d");
  assert.deepEqual(state.world.passes, { "a>b": 2, "c>d": 1 });
});

test("walidacja reguł: decay poza (0,1), brak progu i limit near.minutes z rules", async () => {
  const { validateData } = await import("../src/engine/data.js");
  const bad = structuredClone(minimalData());
  bad.rules.travel.repeat.decay = 1.5;
  assert.ok(validateData(bad).some((m) => /repeat/.test(m)));
  const noFloor = structuredClone(minimalData());
  delete noFloor.rules.travel.repeat.floorWalk;
  assert.ok(validateData(noFloor).some((m) => /floorWalk/.test(m)));
  const far = structuredClone(minimalData());
  far.travel.locations.find((l) => l.id === "wilczy_las").near.minutes = 481;
  assert.ok(validateData(far).some((m) => /near\.minutes/.test(m)));
  assert.deepEqual(validateData(minimalData()), []);
});
