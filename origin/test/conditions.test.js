import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, validateCondition } from "../src/engine/conditions.js";

const st = { flags: { a: true, b: false } };
test("flag / notFlag", () => {
  assert.equal(evaluate({ flag: "a" }, st), true);
  assert.equal(evaluate({ flag: "b" }, st), false);
  assert.equal(evaluate({ flag: "brak" }, st), false);
  assert.equal(evaluate({ notFlag: "b" }, st), true);
  assert.equal(evaluate({ notFlag: "brak" }, st), true);
});
test("all / any / zagnieżdżenie / wiele kluczy = AND", () => {
  assert.equal(evaluate({ all: [{ flag: "a" }, { notFlag: "b" }] }, st), true);
  assert.equal(evaluate({ any: [{ flag: "b" }, { flag: "a" }] }, st), true);
  assert.equal(evaluate({ any: [{ flag: "b" }, { all: [{ flag: "a" }, { flag: "b" }] }] }, st), false);
  assert.equal(evaluate({ flag: "a", notFlag: "a" }, st), false);
});
test("validateCondition", () => {
  assert.deepEqual(validateCondition({ flag: "a" }, "if"), []);
  assert.deepEqual(validateCondition({ flga: "a" }, "if"), ["if.flga: nieznany warunek"]);
  assert.deepEqual(validateCondition({ all: [] }, "if"), ["if.all: oczekiwano niepustej tablicy warunków"]);
  assert.deepEqual(validateCondition({ any: [{ flag: 3 }] }, "if"), ["if.any[0].flag: oczekiwano tekstu"]);
  assert.deepEqual(validateCondition({}, "if"), ["if: pusty warunek"]);
  assert.deepEqual(validateCondition("a", "if"), ["if: oczekiwano obiektu"]);
});

test("var gte/lte/eq i brak zmiennej = 0", () => {
  const s = { flags: {}, vars: { wola: 2 } };
  assert.equal(evaluate({ var: "wola", gte: 2 }, s), true); assert.equal(evaluate({ var: "wola", lte: 1 }, s), false);
  assert.equal(evaluate({ var: "dlug", eq: 0 }, s), true); assert.equal(evaluate({ var: "dlug", gte: 1 }, { flags: {} }), false);
});
test("validateCondition var", () => {
  const o = { vars: ["wola", "dlug"] };
  assert.deepEqual(validateCondition({ var: "wola", gte: 1 }, "if", o), []);
  assert.deepEqual(validateCondition({ var: "zlosc", gte: 1 }, "if", o), ['if.var: nieznana zmienna "zlosc"']);
  assert.deepEqual(validateCondition({ var: "zlosc", gte: 1 }, "if"), []);
  assert.deepEqual(validateCondition({ var: "wola", gte: 1, lte: 3 }, "if", o), ["if: warunek var wymaga dokładnie jednego z gte/lte/eq"]);
  assert.deepEqual(validateCondition({ var: "wola" }, "if", o), ["if: warunek var wymaga dokładnie jednego z gte/lte/eq"]);
  assert.deepEqual(validateCondition({ var: "wola", gte: 1.5 }, "if", o), ["if.gte: oczekiwano liczby całkowitej"]);
  assert.deepEqual(validateCondition({ var: 5, gte: 1 }, "if", o), ["if.var: oczekiwano tekstu"]);
  assert.deepEqual(validateCondition({ all: [{ var: "x", eq: 0 }] }, "if", o), ['if.all[0].var: nieznana zmienna "x"']);
});

// --- C1: item / money / attribute / skill / timeOfDay / effect ---
import { minimalData } from "./helpers.js";
import { getStats } from "../src/systems/stats.js";
import { applyEffect } from "../src/systems/effects.js";

const cdata = minimalData();
function cstate(over = {}, minutes = 12 * 60) {
  return {
    flags: { x: true }, vars: {},
    inventory: { items: [{ id: "bimber", qty: 2 }] },
    character: {
      name: "T", classId: "miecz", level: 1, xp: 0, money: 30,
      attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 },
      skillPoints: {}, tagged: ["sieczna", "wymowa", "medycyna"], perks: [], pendingLevelUp: null, hp: 35,
      ...over,
    },
    time: { minutes },
  };
}

test("item: tekst = co najmniej 1, { id, qty } = co najmniej qty", () => {
  const s = cstate();
  assert.equal(evaluate({ item: "bimber" }, s, cdata), true);
  assert.equal(evaluate({ item: "miecz" }, s, cdata), false);
  assert.equal(evaluate({ item: { id: "bimber", qty: 2 } }, s, cdata), true);
  assert.equal(evaluate({ item: { id: "bimber", qty: 3 } }, s, cdata), false);
});
test("money: character.money >= N", () => {
  assert.equal(evaluate({ money: 30 }, cstate(), cdata), true);
  assert.equal(evaluate({ money: 31 }, cstate(), cdata), false);
});
test("attribute / skill: wartości końcowe getStats", () => {
  assert.equal(evaluate({ attribute: { id: "sila", gte: 5 } }, cstate(), cdata), true);
  const s6 = cstate(); s6.character.attributes.sila = 4;
  assert.equal(evaluate({ attribute: { id: "sila", gte: 5 } }, s6, cdata), false);
  const base = getStats(cstate(), cdata).skills.wymowa;
  assert.equal(evaluate({ skill: { id: "wymowa", gte: base } }, cstate(), cdata), true);
  assert.equal(evaluate({ skill: { id: "wymowa", gte: base + 1 } }, cstate(), cdata), false);
  const s = cstate();
  applyEffect(s, cdata, "podchmielenie", () => 0.99);
  const boosted = getStats(s, cdata).skills.wymowa;
  assert.ok(boosted > base);
  assert.equal(evaluate({ skill: { id: "wymowa", gte: boosted } }, s, cdata), true);
});
test("timeOfDay: id albo lista", () => {
  const s = cstate({}, 6 * 60 + 30);
  assert.equal(evaluate({ timeOfDay: "swit" }, s, cdata), true);
  assert.equal(evaluate({ timeOfDay: ["dzien", "noc"] }, s, cdata), false);
  assert.equal(evaluate({ timeOfDay: ["swit", "noc"] }, s, cdata), true);
});
test("effect: aktywny efekt", () => {
  const s = cstate();
  assert.equal(evaluate({ effect: "podchmielenie" }, s, cdata), false);
  applyEffect(s, cdata, "podchmielenie", () => 0.99);
  assert.equal(evaluate({ effect: "podchmielenie" }, s, cdata), true);
});
test("brak postaci: item/money/attribute/skill/effect = false", () => {
  const s = { flags: { x: true }, inventory: { items: [{ id: "bimber", qty: 2 }] }, character: null, time: { minutes: 0 } };
  for (const c of [{ item: "bimber" }, { money: 0 }, { attribute: { id: "sila", gte: 0 } },
    { skill: { id: "wymowa", gte: 0 } }, { effect: "podchmielenie" }]) assert.equal(evaluate(c, s, cdata), false);
});
test("klucze łączą się (AND), all/any rekurencyjnie", () => {
  assert.equal(evaluate({ money: 2, flag: "x" }, cstate(), cdata), true);
  assert.equal(evaluate({ money: 2, flag: "y" }, cstate(), cdata), false);
  assert.equal(evaluate({ any: [{ money: 99 }, { all: [{ item: "bimber" }, { flag: "x" }] }] }, cstate(), cdata), true);
});
test("validateCondition: nowe klucze", () => {
  const o = { items: ["bimber"], attributes: ["sila"], skills: ["wymowa"], timesOfDay: ["swit", "noc"], effects: ["podchmielenie"] };
  assert.deepEqual(validateCondition({ item: "bimber", money: 0, attribute: { id: "sila", gte: 5 },
    skill: { id: "wymowa", gte: 1 }, timeOfDay: ["swit"], effect: "podchmielenie" }, "if", o), []);
  assert.deepEqual(validateCondition({ item: { id: "bimber", qty: 2 } }, "if", o), []);
  assert.deepEqual(validateCondition({ item: "x" }, "if", o), ['if.item: nieznany przedmiot "x"']);
  assert.deepEqual(validateCondition({ item: { id: "x", qty: 1 } }, "if", o), ['if.item: nieznany przedmiot "x"']);
  assert.deepEqual(validateCondition({ attribute: { id: "x", gte: 1 } }, "if", o), ['if.attribute.id: nieznany atrybut "x"']);
  assert.deepEqual(validateCondition({ skill: { id: "x", gte: 1 } }, "if", o), ['if.skill.id: nieznana umiejętność "x"']);
  assert.deepEqual(validateCondition({ timeOfDay: "x" }, "if", o), ['if.timeOfDay: nieznana pora "x"']);
  assert.deepEqual(validateCondition({ timeOfDay: ["swit", "x"] }, "if", o), ['if.timeOfDay: nieznana pora "x"']);
  assert.deepEqual(validateCondition({ effect: "x" }, "if", o), ['if.effect: nieznany efekt "x"']);
  assert.deepEqual(validateCondition({ money: -1 }, "if", o), ["if.money: oczekiwano liczby całkowitej ≥ 0"]);
  assert.deepEqual(validateCondition({ money: 1.5 }, "if", o), ["if.money: oczekiwano liczby całkowitej ≥ 0"]);
  assert.deepEqual(validateCondition({ attribute: { id: "sila", gte: 1.5 } }, "if", o), ["if.attribute.gte: oczekiwano liczby całkowitej"]);
  assert.deepEqual(validateCondition({ item: "x", effect: "y" }, "if"), []);
});

test("effectStacks: stopnie aktywnego efektu (brak efektu = 0)", () => {
  const s = cstate();
  assert.equal(evaluate({ effectStacks: { id: "podchmielenie", lte: 2 } }, s, cdata), true);
  assert.equal(evaluate({ effectStacks: { id: "podchmielenie", gte: 1 } }, s, cdata), false);
  for (let i = 0; i < 3; i++) applyEffect(s, cdata, "podchmielenie", { int: () => 100 });
  assert.equal(evaluate({ effectStacks: { id: "podchmielenie", gte: 3 } }, s, cdata), true);
  assert.equal(evaluate({ effectStacks: { id: "podchmielenie", lte: 2 } }, s, cdata), false);
  const none = { flags: {}, character: null, time: { minutes: 0 } };
  assert.equal(evaluate({ effectStacks: { id: "podchmielenie", lte: 2 } }, none, cdata), false);
});
test("validateCondition: effectStacks", () => {
  const o = { effects: ["podchmielenie"] };
  assert.deepEqual(validateCondition({ effectStacks: { id: "podchmielenie", gte: 3 } }, "if", o), []);
  assert.deepEqual(validateCondition({ effectStacks: { id: "x", lte: 1 } }, "if", o), ['if.effectStacks.id: nieznany efekt "x"']);
  assert.deepEqual(validateCondition({ effectStacks: { id: "podchmielenie" } }, "if", o),
    ["if.effectStacks: wymagane dokładnie jedno z gte/lte"]);
  assert.deepEqual(validateCondition({ effectStacks: { id: "podchmielenie", gte: 1.5 } }, "if", o),
    ["if.effectStacks.gte: oczekiwano liczby całkowitej"]);
  assert.deepEqual(validateCondition({ effectStacks: "podchmielenie" }, "if", o),
    ["if.effectStacks: oczekiwano obiektu { id, gte|lte }"]);
});
