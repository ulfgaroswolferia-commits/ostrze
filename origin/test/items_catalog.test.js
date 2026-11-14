import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { validateData } from "../src/engine/data.js";
import { runActions } from "../src/systems/actions.js";
import { rollLootTable } from "../src/systems/loot.js";

const data = minimalData();
const items = data.items.filter((i) => !i.hidden);
const weapons = items.filter((i) => i.type === "weapon");
const armors = items.filter((i) => i.type === "armor");
const avg = (i) => (i.damage[0] + i.damage[1]) / 2;
const mean = (list) => list.reduce((s, x) => s + avg(x), 0) / list.length;

test("katalog: ponad 100 przedmiotów, dane przechodzą walidację", () => {
  assert.ok(data.items.length >= 100, `jest ${data.items.length}`);
  assert.deepEqual(validateData(data), []);
});

test("katalog: broń i pancerz mają tier 1–4", () => {
  for (const i of [...weapons, ...armors]) assert.ok([1, 2, 3, 4].includes(i.tier), `${i.id} tier ${i.tier}`);
});

test("katalog: każda umiejętność bojowa ma broń do wyboru", () => {
  assert.ok(weapons.filter((i) => i.skill === "sieczna" && i.range === "melee").length >= 6);
  assert.ok(weapons.filter((i) => i.pair).length >= 4, "pary włóczni");
  assert.ok(weapons.filter((i) => i.reload?.ammo === "strzala").length >= 3, "łuki");
  assert.ok(weapons.filter((i) => i.reload?.ammo === "belt").length >= 3, "kusze");
  assert.ok(weapons.filter((i) => i.skill === "proch").length >= 3, "broń palna");
  const unarmed = weapons.filter((i) => i.skill === "wrecz");
  assert.ok(unarmed.length >= 3 && unarmed.every((i) => i.masteryType === undefined), "walka wręcz bez biegłości");
});

test("katalog: w każdym slocie pancerza są trzy stopnie, talizmanów jest co najmniej osiem", () => {
  for (const slot of ["tulow", "glowa", "rece", "nogi", "plaszcz", "pas"]) {
    const tiers = new Set(armors.filter((i) => i.slot === slot).map((i) => i.tier));
    for (const t of [1, 2, 3]) assert.ok(tiers.has(t), `${slot} bez tieru ${t}`);
  }
  assert.ok(armors.filter((i) => i.slot === "talizman").length >= 8);
});

test("katalog: obrażenia rosną ze stopniem w obrębie rodzaju broni", () => {
  for (const type of ["miecz", "wlocznie", "luk", "kusza"]) {
    const group = weapons.filter((i) => i.masteryType === type && !i.offhand);
    const byTier = (t) => group.filter((i) => i.tier === t);
    const tiers = [1, 2, 3, 4].filter((t) => byTier(t).length > 0);
    for (let k = 1; k < tiers.length; k++) assert.ok(mean(byTier(tiers[k])) > mean(byTier(tiers[k - 1])), `${type}: T${tiers[k]} nie lepszy od T${tiers[k - 1]}`);
  }
});

test("katalog: surowce i kosztowności do sprzedaży (typ material)", () => {
  assert.ok(items.filter((i) => i.type === "material").length >= 9);
});

test("łupy: tabele z planu istnieją, T4 stanowi najwyżej 8% tabeli herszta", () => {
  const ids = ["lupy_zbojcy", "lupy_herszt", "lupy_zolnierz", "lupy_bestie", "lupy_bagno", "lupy_znalezisko_pogorze", "lupy_znalezisko_glusz", "lupy_znalezisko_gwiazdy", "lupy_rzadkie"];
  for (const id of ids) assert.ok(data.loot.tables.some((t) => t.id === id), id);
  const herszt = data.loot.tables.find((t) => t.id === "lupy_herszt").entries;
  const total = herszt.reduce((s, e) => s + e.weight, 0);
  const t4 = herszt.filter((e) => data.items.find((i) => i.id === e.item).tier === 4).reduce((s, e) => s + e.weight, 0);
  assert.ok(t4 / total <= 0.08, `T4 ${t4}/${total}`);
  const rare = data.loot.tables.find((t) => t.id === "lupy_rzadkie").entries;
  assert.ok(rare.every((e) => data.items.find((i) => i.id === e.item).tier === 4));
});

test("łupy: znaleziska rosną z regionem (pogórze bez T3, gwiazdy bez T1)", () => {
  const tierOf = (id) => data.items.find((i) => i.id === id).tier ?? 0;
  const tiers = (table) => data.loot.tables.find((t) => t.id === table).entries.map((e) => tierOf(e.item));
  assert.ok(tiers("lupy_znalezisko_pogorze").every((t) => t <= 2));
  assert.ok(tiers("lupy_znalezisko_gwiazdy").filter((t) => t > 0).every((t) => t >= 3));
});

test("ciężki łup (półpancerz 16 kg) przy pełnym udźwigu: za_ciezko, flagi reszty nie ustawione", () => {
  const d = structuredClone(data);
  d.loot.tables.push({ id: "ciezar", entries: [{ item: "polpancerz", qty: 1, weight: 1 }] });
  const state = createNewState({ seed: 1, startScene: "a", rules: d.rules });
  const cs = combatState(d, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.inventory.items.push({ id: "kolczuga", qty: 40 });
  const { events } = runActions(state, d, [{ giveRandom: "ciezar" }, { setFlag: "dalej" }], createRng(1));
  assert.ok(events.some((e) => e.type === "za_ciezko"));
  assert.equal(state.flags.dalej, undefined);
  assert.equal(rollLootTable(d, "ciezar", createRng(1)).id, "polpancerz");
});
