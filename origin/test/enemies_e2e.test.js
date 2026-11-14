import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState, playFight } from "./helpers.js";
import { createRng } from "../src/engine/dice.js";
import { createCombat } from "../src/systems/combat/state.js";
import { attackTargets, playerActions } from "../src/systems/combat/actions.js";
import { techniqueActions } from "../src/systems/combat/techniques.js";
import { getStats } from "../src/systems/stats.js";
import { validateData } from "../src/engine/data.js";

const data = minimalData();
const NEW = ["rabus", "rabus_lucznik", "maruder", "herszt_zbojcow", "zolnierz_pogranicza", "sierzant_pogranicza", "dzik", "zmija_lesna", "utopiec", "blednik", "skrzat_zlosnik"];

test("wrogowie: 56 typów, nowe mają łup i grafikę, dane przechodzą walidację", () => {
  assert.equal(data.enemies.length, 56);
  assert.deepEqual(validateData(data), []);
  for (const id of NEW) {
    const e = data.enemies.find((x) => x.id === id);
    assert.ok(e, id);
    assert.ok(Array.isArray(e.loot) && e.loot.length > 0, `${id}: brak łupu`);
    assert.ok(data.art[e.art], `${id}: brak grafiki ${e.art}`);
    assert.ok(e.nameAcc, `${id}: brak biernika`);
  }
});

test("wrogowie: ludzie dropią sprzęt z tabel, bestie surowce", () => {
  for (const id of ["rabus", "rabus_lucznik", "herszt_zbojcow", "zolnierz_pogranicza", "sierzant_pogranicza"]) {
    const e = data.enemies.find((x) => x.id === id);
    assert.ok(e.tags.includes("czlowiek"), id);
    assert.ok(e.loot.some((l) => l.giveRandom), `${id}: brak giveRandom`);
  }
  for (const id of ["dzik", "zmija_lesna", "utopiec", "blednik"]) {
    const e = data.enemies.find((x) => x.id === id);
    assert.ok(e.tags.includes("bestia"), id);
  }
  assert.ok(data.enemies.find((x) => x.id === "herszt_zbojcow").loot.some((l) => l.chance === 100 && l.giveRandom === "lupy_herszt"));
});

function strategy(state, d, combat) {
  const actions = playerActions(state, d, combat);
  const can = (id) => !actions.find((a) => a.id === id).disabled;
  if (state.character.hp < 0.4 * getStats(state, d).derived.hpMax && can("use")) return { id: "use", itemId: "opatrunek" };
  if (can("attack")) return { id: "attack", target: attackTargets(state, d, combat)[0] };
  const far = combat.enemies.find((e) => !e.dead && !e.fled && e.band === "far");
  if (far && can("move")) return { id: "move", target: far.uid };
  return null;
}
function dual(state, d, combat) {
  const t = techniqueActions(state, d, combat).find((a) => a.id === "dual");
  const hurt = state.character.hp < 0.4 * getStats(state, d).derived.hpMax;
  if (t && !t.disabled && !hurt) {
    const target = combat.enemies.find((e) => !e.dead && !e.fled && e.band === "melee");
    if (target) return { id: "dual", target: target.uid };
  }
  return strategy(state, d, combat);
}
function winRate(classId, enemies, strat) {
  let wins = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const state = combatState(data, classId);
    const combat = createCombat(state, data, { enemies, start: "far", canFlee: true, id: "sim_e2e" }, rng);
    if (playFight(state, data, combat, rng, strat).outcome === "win") wins++;
  }
  return wins / 200;
}

// Przeżywalność postaci 1. poziomu w sprzęcie ze szkoły (T1), widełki z planu E2e (win rate z 200 ziaren, obie klasy).
const FIGHTS = [
  ["1 rabuś", [{ id: "rabus", count: 1 }], 0.85, 1],
  ["rabuś + 2 łuczników", [{ id: "rabus", count: 1 }, { id: "rabus_lucznik", count: 2 }], 0.30, 0.80],
  ["2 maruderzy", [{ id: "maruder", count: 2 }], 0.85, 1],
  ["patrol: sierżant + 2 żołnierzy", [{ id: "sierzant_pogranicza", count: 1 }, { id: "zolnierz_pogranicza", count: 2 }], 0.10, 0.55],
  ["dzik", [{ id: "dzik", count: 1 }], 0.65, 1],
  ["żmija", [{ id: "zmija_lesna", count: 1 }], 0.85, 1],
  ["utopiec", [{ id: "utopiec", count: 1 }], 0.50, 0.90],
  ["błędnik", [{ id: "blednik", count: 1 }], 0.50, 0.90],
  ["skrzat", [{ id: "skrzat_zlosnik", count: 1 }], 0.80, 1],
  ["herszt solo", [{ id: "herszt_zbojcow", count: 1 }], 0.10, 0.50],
];
for (const [label, enemies, lo, hi] of FIGHTS) {
  test(`symulacja: ${label} – wygrane w widełkach ${lo}–${hi} (200 ziaren, miecz i włócznia)`, (t) => {
    for (const [classId, strat] of [["miecz", strategy], ["wlocznia", dual]]) {
      const rate = winRate(classId, enemies, strat);
      t.diagnostic(`${label} ${classId}: ${rate}`);
      assert.ok(rate >= lo && rate <= hi, `${classId}: ${rate} poza ${lo}–${hi}`);
    }
  });
}
