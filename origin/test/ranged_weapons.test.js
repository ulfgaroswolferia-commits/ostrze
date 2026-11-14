import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData } from "./helpers.js";
import { itemById } from "../src/systems/items.js";
import { createCombat, enemyByUid } from "../src/systems/combat/state.js";
import { playerHitChance } from "../src/systems/combat/formulas.js";
import { strike } from "../src/systems/combat/strike.js";

const data = minimalData();
const fixed = (k) => ({ int: () => k });

function mkState(minutes = 12 * 60) {
  return {
    character: {
      name: "T", classId: "miecz", level: 1, xp: 0,
      attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 },
      skillPoints: {}, tagged: ["sieczna"], perks: [], pendingLevelUp: null, hp: 35,
    },
    time: { minutes },
    inventory: { items: [], equipped: {}, quickSlots: [], loaded: {} },
  };
}
const mk = (state) => createCombat(state, data, { enemies: [{ id: "bandyta", count: 1 }], start: "far" }, fixed(1));

test("szansa trafienia broni dystansowych", () => {
  const cases = [
    ["kusza_lekka", "far", 35], ["kusza_lekka", "melee", 50],
    ["kusza_zolnierska", "far", 50], ["kusza_zolnierska", "melee", 30],
    ["pistolet_skalkowy", "far", 46], ["pistolet_skalkowy", "melee", 46],
    ["rusznica", "far", 46], ["rusznica", "melee", 26],
  ];
  const s = mkState();
  const c = mk(s);
  for (const [id, band, want] of cases) {
    c.enemies[0].band = band;
    assert.equal(playerHitChance(s, data, c, itemById(data, id), c.enemies[0]), want, `${id} ${band}`);
  }
});
test("pointBlank: cel na dystansie, ale liczy się bliska premia", () => {
  const s = mkState();
  const c = mk(s);
  assert.equal(playerHitChance(s, data, c, itemById(data, "kusza_lekka"), c.enemies[0], { pointBlank: true }), 50);
});
test("nowe koszty i pola broni", () => {
  const want = {
    kusza_lekka: [3, 6, 0, 15, true, 5], kusza_zolnierska: [3, 6, 15, 15, false, 6], kusza_cesarska: [3, 6, 15, 15, false, 6],
    pistolet_skalkowy: [3, 6, 10, 10, true, 5], pistolet_wojskowy: [3, 6, 10, 10, true, 5], rusznica: [4, 6, 10, 10, false, 6],
  };
  for (const [id, w] of Object.entries(want)) {
    const it = itemById(data, id);
    assert.deepEqual([it.apCost, it.reload.apCost, it.hitFar, it.hitClose, it.noMeleePenalty, it.retreatShotAp], w, id);
    assert.deepEqual(it.effects, [{ id: "spowolnienie", chance: 50 }], id);
  }
  assert.equal(itemById(data, "kusza_lekka").value, 60);
});
test("łuk bez zmian", () => {
  const bow = itemById(data, "luk_mysliwski");
  assert.equal(bow.apCost, 4);
  assert.equal(bow.reload.apCost, 1);
  const s = mkState();
  const c = mk(s);
  const far = playerHitChance(s, data, c, bow, c.enemies[0]);
  c.enemies[0].band = "melee";
  assert.equal(playerHitChance(s, data, c, bow, c.enemies[0]), far - 20);
});
test("żadne ładowanie nie przekracza 6 PA", () => {
  for (const it of data.items.filter((i) => i.reload)) assert.ok(it.reload.apCost <= 6, it.id);
});
test("trafienie może spowolnić", () => {
  const s = mkState();
  const c = mk(s);
  const enemy = enemyByUid(c, c.enemies[0].uid);
  enemy.hp = 500;
  const weapon = itemById(data, "kusza_lekka");
  s.inventory.loaded[weapon.id] = 1;
  const events = strike(s, data, c, { weapon, target: enemy, rng: fixed(1) });
  assert.ok(events.some((e) => e.type === "efekt_nalozony" && e.id === "spowolnienie"));
  assert.ok(enemy.effects.some((e) => e.id === "spowolnienie"));
});
