import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { validateActions, runActions } from "../src/systems/actions.js";
import { evaluate, validateCondition } from "../src/engine/conditions.js";
import { createCharacter } from "../src/systems/character.js";
import { addItem, countOf, equip } from "../src/systems/inventory.js";
import { minimalData } from "./helpers.js";

const rng = { int: () => 1 };
let state;
let data;

beforeEach(() => {
  data = minimalData();
  const rules = data.rules.creator;
  const attributes = Object.fromEntries(data.attributes.map((a) => [a.id, rules.attributeStart + (rules.gifts[a.id] ?? 0)]));
  let pool = rules.points;
  for (const a of data.attributes) while (pool > 0 && attributes[a.id] < rules.attributeMax) { attributes[a.id]++; pool--; }
  const cls = data.classes.find((c) => c.id === "miecz");
  const tagged = [...new Set([cls.taggedSkill, "wymowa", "medycyna"])].slice(0, rules.taggedCount);
  const character = createCharacter({ name: "Test", classId: "miecz", attributes, tagged }, data);
  state = { character, time: { minutes: 12 * 60 }, flags: {}, vars: {}, inventory: { items: [], equipped: {}, quickSlots: [] } };
  addItem(state, data, "miecz_krotki", 1);
  equip(state, data, "miecz_krotki", "bron");
});

test("unequipItem zdejmuje jedyną sztukę", () => {
  runActions(state, data, [{ unequipItem: "miecz_krotki" }], rng);
  assert.equal(state.inventory.equipped.bron, undefined);
  assert.equal(countOf(state, "miecz_krotki"), 1);
});

test("unequipItem nie zdejmuje, gdy jest wolna sztuka", () => {
  addItem(state, data, "miecz_krotki", 1);
  runActions(state, data, [{ unequipItem: "miecz_krotki" }, { takeItem: "miecz_krotki" }], rng);
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(countOf(state, "miecz_krotki"), 1);
});

test("moneyBelow", () => {
  state.character.money = 10;
  assert.equal(evaluate({ moneyBelow: 11 }, state, data), true);
  assert.equal(evaluate({ moneyBelow: 10 }, state, data), false);
});

test("walidacja odrzuca zły unequipItem i moneyBelow", () => {
  assert.deepEqual(validateActions([{ unequipItem: "miecz_krotki" }], "a", data), []);
  assert.equal(validateActions([{ unequipItem: "nie_ma_takiego" }], "a", data).length, 1);
  assert.equal(validateActions([{ unequipItem: { id: "miecz_krotki", qty: 2 } }], "a", data).length, 1);
  assert.deepEqual(validateCondition({ moneyBelow: 5 }, "c"), []);
  assert.equal(validateCondition({ moneyBelow: "x" }, "c").length, 1);
  assert.equal(validateCondition({ moneyBelow: -1 }, "c").length, 1);
});
