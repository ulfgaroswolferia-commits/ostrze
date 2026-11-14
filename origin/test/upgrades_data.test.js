import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { itemById } from "../src/systems/items.js";
import { CHAINS } from "../tools/upgrades/recipes.mjs";

const data = await loadData();
/** Item upgrades; the bolt exchange (entries with `qty`) trades whole packs and keeps no weight or value rule. */
const ITEM_CHAINS = CHAINS.filter((c) => !c.qty);

test("27 łańcuchów po 2 stopnie", () => assert.equal(ITEM_CHAINS.length, 54));
test("wymiana bełtów: paczki po 10, zwykłe → wzmocnione → wybuchowe", () => {
  const bolts = CHAINS.filter((c) => c.qty).map(({ from, to, stage, cost, qty, kind }) => ({ from, to, stage, cost, qty, kind }));
  assert.deepEqual(bolts, [
    { from: "belt", to: "belt_wzmocniony", stage: 1, cost: 20, qty: 10, kind: "kusza" },
    { from: "belt_wzmocniony", to: "belt_wybuchowy", stage: 2, cost: 100, qty: 10, kind: "kusza" },
  ]);
});
test("każdy przedmiot istnieje, waży tyle co bazowy i jest droższy od poprzedniego", () => {
  for (const c of ITEM_CHAINS) {
    const base = itemById(data, c.base), from = itemById(data, c.from), to = itemById(data, c.to);
    assert.ok(base && from && to, c.to);
    assert.equal(to.weight, base.weight, c.to);
    assert.ok(to.value > from.value, c.to);
    assert.equal(to.value, from.value + c.cost, c.to);
  }
});
test("drugi stopień bierze przedmiot po pierwszym", () => {
  for (const c of ITEM_CHAINS.filter((x) => x.stage === 2)) assert.equal(c.from, `${c.base}_u1`);
});
test("zakres: bez łuków, ukrytych i pomocniczych", () => {
  for (const id of ["luk_mysliwski", "sztylet", "piesci", "kaptur_mysliwego"])
    assert.ok(!CHAINS.some((c) => c.base === id), id);
});
test("miecz krótki", () => {
  const u1 = itemById(data, "miecz_krotki_u1"), u2 = itemById(data, "miecz_krotki_u2");
  assert.equal(u1.modifiers.sieczna, 5);
  assert.equal(u2.modifiers.sieczna, 5);
  assert.equal(u2.armorPierce, 1);
});
test("kolczuga traci karę PA dopiero na drugim stopniu", () => {
  assert.equal(itemById(data, "kolczuga_u1").modifiers.ap, -1);
  assert.equal(itemById(data, "kolczuga_u2").modifiers.ap, undefined);
});
test("pistolet: mniej niewypałów na drugim stopniu", () => assert.equal(itemById(data, "pistolet_skalkowy_u2").misfireChance, 12));
