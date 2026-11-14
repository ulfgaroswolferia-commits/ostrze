import { applyEffect } from "../src/systems/effects.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, countOf, removeItem, useConsumable } from "../src/systems/inventory.js";
import { mealsLeft, eatItem, eatMeal } from "../src/systems/food.js";
import { restHealMultiplier } from "../src/systems/effects.js";
import { getStats } from "../src/systems/stats.js";
import { advanceTime } from "../src/engine/time.js";
import { createNewState } from "../src/engine/state.js";

const data = minimalData();

/** Rng answering `int` from `values` in order; throws when asked for more. */
function scripted(values = []) {
  const queue = [...values];
  return { int(min, max) {
    if (queue.length === 0) throw new Error(`rng: nieoczekiwany rzut int(${min}, ${max})`);
    return queue.shift();
  }, left: () => queue.length };
}
/** Sword hero without the start provisions; `food` = [[id, qty], …]. */
function hero(food = []) {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.character.tagged = ["sieczna"]; // no Medycyna: bad mushrooms can hurt
  s.world.phenomenonRolledDay = 99;
  removeItem(s, data, "prowiant", 2);
  for (const [id, qty] of food) addItem(s, data, id, qty);
  return s;
}
const glod = (s) => s.character.effects.find((e) => e.id === "glod");
const types = (events) => events.map((e) => e.type);

test("mealsLeft: suma sztuk jedzenia (zioła się nie liczą)", () => {
  assert.equal(mealsLeft(hero([["prowiant", 2], ["jagody", 3], ["ziola_lesne", 1]]), data), 5);
  assert.equal(mealsLeft(hero(), data), 0);
});

test("eatMeal: najpierw to, co się psuje – jagody, potem mięso (przed orzechami), na końcu prowiant", () => {
  const s = hero([["prowiant", 1], ["orzechy", 1], ["mieso", 1], ["jagody", 1]]);
  const eaten = [];
  for (let i = 0; i < 4; i++) {
    const events = eatMeal(s, data, scripted());
    const meal = events.find((e) => e.type === "posilek");
    eaten.push(meal.id);
    assert.equal(meal.left, 3 - i);
  }
  assert.deepEqual(eaten, ["jagody", "mieso", "orzechy", "prowiant"]);
  assert.equal(mealsLeft(s, data), 0);
});

test("eatMeal bez jedzenia: nic się nie dzieje, głód wynika z licznika (test/hunger.test.js)", () => {
  const s = hero();
  assert.deepEqual(eatMeal(s, data, scripted()), []);
  assert.equal(glod(s), undefined);
});

test("grzyby: rzut ≤ 15 – zatrucie (potem rzut odporności), 16 – nic; wiodąca Medycyna – bez rzutu", () => {
  const sick = hero([["grzyby", 1]]);
  const r1 = scripted([15, 100]);
  assert.deepEqual(types(eatMeal(sick, data, r1)), ["posilek", "zatrucie_jedzeniem"]);
  assert.ok(sick.character.effects.some((e) => e.id === "trucizna"));
  assert.equal(r1.left(), 0);
  const fine = hero([["grzyby", 1]]);
  const r2 = scripted([16]);
  assert.deepEqual(types(eatMeal(fine, data, r2)), ["posilek"]);
  assert.equal(r2.left(), 0);
  const medic = hero([["grzyby", 1]]);
  medic.character.tagged = ["medycyna"];
  assert.deepEqual(types(eatMeal(medic, data, scripted())), ["posilek"]);
});

test("eatItem: brak przedmiotu / nie jedzenie → błąd bez zmian", () => {
  const s = hero([["jagody", 1]]);
  assert.deepEqual(eatItem(s, data, "prowiant", scripted()), { ok: false, reason: "inv.notOwned" });
  assert.deepEqual(eatItem(s, data, "opatrunek", scripted()), { ok: false, reason: "inv.notFood" });
  assert.equal(countOf(s, "jagody"), 1);
});

test("restHealMultiplier: 1 bez efektów, 0,5 przy głodzie", () => {
  const s = hero();
  assert.equal(restHealMultiplier(s, data), 1);
  applyEffect(s, data, "glod", null, { force: true });
  assert.equal(restHealMultiplier(s, data), 0.5);
});

test("useConsumable(jagody): posiłek z ekwipunku – zdejmuje głód, przesuwa czas, bez rzutu leczenia", () => {
  const s = hero();
  s.character.lastMeal = s.time.minutes - data.rules.appetite.fullHours * 60;
  applyEffect(s, data, "glod", null, { force: true });
  addItem(s, data, "jagody", 1);
  const t0 = s.time.minutes;
  const r = useConsumable(s, data, "jagody", scripted());
  assert.equal(r.ok, true);
  assert.equal(r.healed, 0);
  assert.equal(glod(s), undefined);
  assert.deepEqual(types(r.effects), ["posilek", "efekt_koniec"]);
  assert.equal(s.time.minutes, t0 + data.rules.inventory.useMinutes);
});

test("final: głód obniża maks. HP – HP od razu przycięte, a sen na głodzie nigdy nie odbiera HP", async () => {
  const { rest } = await import("../src/scenes/rest.js");
  const { createScriptedIO } = await import("../src/ui/io.js");
  const s = hero();
  s.character.hp = getStats(s, data).derived.hpMax;
  for (let i = 0; i < 3; i++) eatMeal(s, data, scripted());
  const max = getStats(s, data).derived.hpMax;
  assert.ok(s.character.hp <= max, `HP ${s.character.hp}/${max}`);
  const before = s.character.hp;
  const ctx = { state: s, data, io: createScriptedIO(["1+++", "2", ""]), rng: { int: (a) => a }, debug: false, notices: [] };
  await rest(ctx, {});
  assert.ok(s.character.hp >= before, `sen zabrał HP: ${before} → ${s.character.hp}`);
});
