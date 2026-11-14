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
const IDS = ["sluga_wiru", "straz_szklanna", "istota_szklanna"];

test("Wir: świta i Istota mają grafikę, biernik i łup bez T4; Istota ma ≥3 ataki, morale null i nie ucieka z walki", () => {
  assert.deepEqual(validateData(data), []);
  for (const id of IDS) {
    const e = data.enemies.find((x) => x.id === id);
    assert.ok(e && data.art[e.art] && e.nameAcc, id);
    assert.ok(e.loot.some((l) => l.giveMoney || l.giveRandom), id);
  }
  const istota = data.enemies.find((x) => x.id === "istota_szklanna");
  assert.ok(istota.attacks.length >= 3);
  assert.equal(istota.morale, null);
  assert.ok(istota.attacks.some((a) => a.name === "Pękające szkło"));
  for (const e of data.loot.tables.find((t) => t.id === "lupy_wir").entries) assert.ok((item(e.item).tier ?? 0) <= 3, e.item);
});

// --- balans (poziom 6, Ostrze, T2–T3) ---
const mdata = minimalData();
function hero(classId, raw) {
  const state = combatState(mdata, classId);
  const blade = (classId === "miecz" ? "ostrze_gwiazd_" : "para_gwiazd_") + (raw ? (classId === "miecz" ? "surowe" : "surowa") : "bogdana");
  for (const id of [blade, "skorznia_nabijana", "helm_zelazny", "opatrunek", "opatrunek", "opatrunek"]) addItem(state, mdata, id, 1);
  equip(state, mdata, blade, "bron");
  equip(state, mdata, "skorznia_nabijana", "tulow");
  equip(state, mdata, "helm_zelazny", "glowa");
  state.character.level = 6;
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
function rate(classId, raw, enemies, flee = true) {
  let wins = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const state = hero(classId, raw);
    const combat = createCombat(state, mdata, { enemies, start: "far", canFlee: flee, id: "wir_sim" }, rng);
    if (playFight(state, mdata, combat, rng, strat).outcome === "win") wins++;
  }
  return wins / 200;
}
for (const classId of ["miecz", "wlocznia"]) {
  for (const raw of [false, true]) {
    const label = `${classId}, ${raw ? "surowe" : "Bogdana"}`;
    for (const [name, enemies, lo, hi] of [
      ["sługa wiru + strażnik szklanny", [{ id: "sluga_wiru", count: 1 }, { id: "straz_szklanna", count: 1 }], 0.7, 1],
      ["strażnik szklanny ×2", [{ id: "straz_szklanna", count: 2 }], 0.5, 1],
    ]) {
      test(`symulacja Wiru: ${name} (${label}) – ${lo}–${hi}`, (t) => {
        const r = rate(classId, raw, enemies);
        t.diagnostic(`${name}: ${r}`);
        assert.ok(r >= lo && r <= hi, `${r} poza ${lo}–${hi}`);
      });
    }
    test(`symulacja Wiru: Istota (${label}) – trudniejsza od Pełnomocnika, ale ≥ 0,4 i ≤ 0,95`, (t) => {
      const r = rate(classId, raw, [{ id: "istota_szklanna", count: 1 }], false);
      const p = rate(classId, raw, [{ id: "pelnomocnik", count: 1 }], false);
      t.diagnostic(`Istota ${label}: ${r} (Pełnomocnik ${p})`);
      assert.ok(r >= 0.4 && r <= 0.95, `${r}`);
      assert.ok(r < p, `Istota ${r} nie jest trudniejsza od Pełnomocnika ${p}`);
    });
  }
}
