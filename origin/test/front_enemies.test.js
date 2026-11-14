import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState, playFight } from "./helpers.js";
import { createRng } from "../src/engine/dice.js";
import { validateData } from "../src/engine/data.js";
import { createCombat } from "../src/systems/combat/state.js";
import { attackTargets, playerActions } from "../src/systems/combat/actions.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { techniqueActions } from "../src/systems/combat/techniques.js";

const data = minimalData();
const NEW = ["jarnowski_strzelec", "jarnowski_kowal", "jarnowski_zwiadowca", "cesarski_pikinier", "cesarski_kusznik", "szabrownik"];

test("front: sześciu wrogów z grafiką, biernikiem i łupem z tabeli; dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  for (const id of NEW) {
    const e = data.enemies.find((x) => x.id === id);
    assert.ok(e, id);
    assert.ok(data.art[e.art], `${id}: grafika`);
    assert.ok(e.nameAcc, `${id}: biernik`);
    assert.ok(e.tags.includes("czlowiek"), id);
    assert.ok(e.loot.some((l) => l.giveRandom), `${id}: łup z tabeli`);
  }
  for (const t of ["lupy_front_cesarski", "lupy_front_jarnowski", "lupy_pole_bitwy"]) assert.ok(data.loot.tables.some((x) => x.id === t), t);
});

test("front: łupy frontu nie dają T4", () => {
  for (const t of ["lupy_front_cesarski", "lupy_front_jarnowski", "lupy_pole_bitwy"]) {
    for (const e of data.loot.tables.find((x) => x.id === t).entries) assert.ok((data.items.find((i) => i.id === e.item).tier ?? 0) <= 3, `${t}: ${e.item}`);
  }
});

/** The hero at the front: level 4, the Blade of the Stars and tier-2 armour. */
function frontHero(classId) {
  const state = combatState(data, classId);
  const blade = classId === "miecz" ? "ostrze_gwiazd_bogdana" : "para_gwiazd_bogdana";
  for (const id of [blade, "skorznia_nabijana", "helm_zelazny"]) addItem(state, data, id, 1);
  equip(state, data, blade, "bron");
  equip(state, data, "skorznia_nabijana", "tulow");
  equip(state, data, "helm_zelazny", "glowa");
  state.character.level = 4;
  state.character.hp = getStats(state, data).derived.hpMax;
  return state;
}
function strategy(state, d, combat) {
  const actions = playerActions(state, d, combat);
  const can = (id) => !actions.find((a) => a.id === id).disabled;
  if (state.character.hp < 0.4 * getStats(state, d).derived.hpMax && can("use")) return { id: "use", itemId: "opatrunek" };
  if (can("attack")) return { id: "attack", target: attackTargets(state, d, combat)[0] };
  const far = combat.enemies.find((e) => !e.dead && !e.fled && e.band === "far");
  if (far && can("move")) return { id: "move", target: far.uid };
  return null;
}
/** The spear class prefers the pair's double attack, as a player would. */
function dualStrategy(state, d, combat) {
  const dual = techniqueActions(state, d, combat).find((a) => a.id === "dual");
  if (dual && !dual.disabled && state.character.hp >= 0.4 * getStats(state, d).derived.hpMax) {
    const target = combat.enemies.find((e) => !e.dead && !e.fled && e.band === "melee");
    if (target) return { id: "dual", target: target.uid };
  }
  return strategy(state, d, combat);
}
function winRate(classId, enemies) {
  let wins = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const state = frontHero(classId);
    const combat = createCombat(state, data, { enemies, start: "far", canFlee: true, id: "front_sim" }, rng);
    if (playFight(state, data, combat, rng, classId === "wlocznia" ? dualStrategy : strategy).outcome === "win") wins++;
  }
  return wins / 200;
}

const FIGHTS = [
  ["jarnowski strzelec solo", [{ id: "jarnowski_strzelec", count: 1 }], 0.8, 1],
  ["jarnowski kowal solo", [{ id: "jarnowski_kowal", count: 1 }], 0.8, 1],
  ["zwiadowca solo", [{ id: "jarnowski_zwiadowca", count: 1 }], 0.85, 1],
  ["cesarski pikinier solo", [{ id: "cesarski_pikinier", count: 1 }], 0.8, 1],
  ["szabrownicy ×3", [{ id: "szabrownik", count: 3 }], 0.8, 1],
  ["trzech pikinierów", [{ id: "cesarski_pikinier", count: 3 }], 0.35, 0.9],
  ["kusznik + 2 pikinierów", [{ id: "cesarski_kusznik", count: 1 }, { id: "cesarski_pikinier", count: 2 }], 0.3, 0.85],
  ["strzelec + kowal + zwiadowca", [{ id: "jarnowski_strzelec", count: 1 }, { id: "jarnowski_kowal", count: 1 }, { id: "jarnowski_zwiadowca", count: 1 }], 0.3, 0.85],
];
for (const [label, enemies, lo, hi] of FIGHTS) {
  test(`symulacja frontu: ${label} – wygrane w widełkach ${lo}–${hi} (200 ziaren, miecz i włócznia)`, (t) => {
    for (const classId of ["miecz", "wlocznia"]) {
      const rate = winRate(classId, enemies);
      t.diagnostic(`${label} ${classId}: ${rate}`);
      assert.ok(rate >= lo && rate <= hi, `${classId}: ${rate} poza ${lo}–${hi}`);
    }
  });
}
