import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { minimalData, combatState, playFight } from "./helpers.js";
import { createRng } from "../src/engine/dice.js";
import { createCombat } from "../src/systems/combat/state.js";
import { attackTargets, playerActions } from "../src/systems/combat/actions.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";

const data = await loadData();
const item = (id) => data.items.find((i) => i.id === id);
const IDS = ["straznik_progu", "szeptacz", "kustosz_kabli", "niespiacy", "pelnomocnik"];

test("loch: pięciu wrogów frakcji Rdzenia ma grafikę, biernik i łup z tabeli bez T4; dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  for (const id of IDS) {
    const e = data.enemies.find((x) => x.id === id);
    assert.ok(e && data.art[e.art] && e.nameAcc, id);
    assert.ok(e.loot.some((l) => l.giveRandom === "lupy_loch" || l.giveMoney), id);
  }
  const table = data.loot.tables.find((t) => t.id === "lupy_loch");
  assert.ok(table && table.entries.length >= 8);
  for (const e of table.entries) assert.ok((item(e.item).tier ?? 0) <= 3, e.item);
  assert.equal(data.enemies.find((x) => x.id === "pelnomocnik").attacks.length, 3);
  assert.ok(data.enemies.find((x) => x.id === "niespiacy").tags.includes("upior"));
});

// --- balans (poziom 5, Ostrze, T2) ---
const mdata = minimalData();
function lochHero(classId, raw = false) {
  const state = combatState(mdata, classId);
  const blade = (classId === "miecz" ? "ostrze_gwiazd_" : "para_gwiazd_") + (raw ? (classId === "miecz" ? "surowe" : "surowa") : "bogdana");
  for (const id of [blade, "skorznia_nabijana", "helm_zelazny", "opatrunek", "opatrunek"]) addItem(state, mdata, id, 1);
  equip(state, mdata, blade, "bron");
  equip(state, mdata, "skorznia_nabijana", "tulow");
  equip(state, mdata, "helm_zelazny", "glowa");
  state.character.level = 5;
  state.character.hp = getStats(state, mdata).derived.hpMax;
  return state;
}
function strat(state, d, combat) {
  const actions = playerActions(state, d, combat);
  const can = (id) => !actions.find((a) => a.id === id).disabled;
  if (state.character.hp < 0.4 * getStats(state, d).derived.hpMax && can("use")) return { id: "use", itemId: "opatrunek" };
  if (can("attack")) return { id: "attack", target: attackTargets(state, d, combat)[0] };
  const far = combat.enemies.find((e) => !e.dead && !e.fled && e.band === "far");
  if (far && can("move")) return { id: "move", target: far.uid };
  return null;
}
function rate(classId, id, raw = false) {
  let wins = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const state = lochHero(classId, raw);
    const combat = createCombat(state, mdata, { enemies: [{ id, count: 1 }], start: "far", canFlee: false, id: "loch_sim" }, rng);
    if (playFight(state, mdata, combat, rng, strat).outcome === "win") wins++;
  }
  return wins / 200;
}
for (const classId of ["miecz", "wlocznia"]) {
  for (const [id, lo, hi] of [["straznik_progu", 0.75, 1], ["szeptacz", 0.75, 1], ["kustosz_kabli", 0.75, 1], ["niespiacy", 0.7, 1], ["pelnomocnik", 0.45, 0.9]]) {
    test(`symulacja lochu: ${id} (${classId}) – wygrane w widełkach ${lo}–${hi}`, (t) => {
      const r = rate(classId, id);
      t.diagnostic(`${id} ${classId}: ${r}`);
      assert.ok(r >= lo && r <= hi, `${r} poza ${lo}–${hi}`);
    });
  }
}

for (const classId of ["miecz", "wlocznia"]) {
  test(`symulacja lochu: Pełnomocnik z surowym Ostrzem (${classId}) – pokonywalny`, (t) => {
    const r = rate(classId, "pelnomocnik", true);
    t.diagnostic(`pelnomocnik surowe ${classId}: ${r}`);
    assert.ok(r >= 0.4 && r <= 0.9, `${r}`);
  });
}
