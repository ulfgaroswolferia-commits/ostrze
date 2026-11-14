import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState, playFight } from "./helpers.js";
import { createRng } from "../src/engine/dice.js";
import { createCombat } from "../src/systems/combat/state.js";
import { attackTargets, playerActions } from "../src/systems/combat/actions.js";
import { techniqueActions, doTechnique } from "../src/systems/combat/techniques.js";
import { getStats } from "../src/systems/stats.js";

// Simple player: heal below 40% HP, attack when possible, close in otherwise, else end the turn.
function strategy(state, data, combat) {
  const actions = playerActions(state, data, combat);
  const can = (id) => !actions.find((a) => a.id === id).disabled;
  if (state.character.hp < 0.4 * getStats(state, data).derived.hpMax && can("use")) return { id: "use", itemId: "opatrunek" };
  if (can("attack")) return { id: "attack", target: attackTargets(state, data, combat)[0] };
  const far = combat.enemies.find((e) => !e.dead && !e.fled && e.band === "far");
  if (far && can("move")) return { id: "move", target: far.uid };
  return null;
}

// Spear variant: prefers the pair's "Atak obiema" technique whenever it is available, otherwise the plain strategy.
function dualStrategy(state, data, combat) {
  const dual = techniqueActions(state, data, combat).find((a) => a.id === "dual");
  if (dual && !dual.disabled && state.character.hp >= 0.4 * getStats(state, data).derived.hpMax) {
    const target = combat.enemies.find((e) => !e.dead && !e.fled && e.band === "melee");
    if (target) return { id: "dual", target: target.uid };
  }
  return strategy(state, data, combat);
}

for (const [classId, strat, label] of [["miecz", strategy, "miecz bez sztyletu"], ["wlocznia", strategy, "włócznia (zwykły atak)"], ["wlocznia", dualStrategy, "włócznia z akcjami pary"]]) {
  test(`symulacja: ${label} wygrywa >= 60% z 2 bandytami (200 ziaren)`, (t) => {
    const data = minimalData();
    let wins = 0;
    let lost = 0;
    let draws = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRng(seed);
      const state = combatState(data, classId);
      const combat = createCombat(state, data, { enemies: [{ id: "bandyta", count: 2 }], start: "far", canFlee: true, id: "sim" }, rng);
      const hpMax = getStats(state, data).derived.hpMax;
      const { outcome } = playFight(state, data, combat, rng, strat);
      if (outcome === "win") wins++;
      if (outcome === "draw") draws++;
      lost += (hpMax - Math.max(0, state.character.hp)) / hpMax;
    }
    t.diagnostic(`${label}: wygrane ${wins}/200`);
    assert.ok(wins >= 120, `${classId}: wygrane ${wins}/200`);
    assert.ok(lost / 200 >= 0.25, `${classId}: srednia utrata HP ${(lost / 2).toFixed(1)}% < 25%`);
    assert.equal(draws, 0);
  });
}

test("symulacja informacyjna: upiór zwiadowca przeciw postaci 1. poziomu (bez progu)", (t) => {
  const data = minimalData();
  for (const [classId, strat] of [["miecz", strategy], ["wlocznia", dualStrategy]]) {
    let wins = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRng(seed);
      const state = combatState(data, classId);
      const combat = createCombat(state, data, { enemies: [{ id: "upior_zwiadowca", count: 1 }], start: "far", canFlee: true, id: "sim_upior" }, rng);
      if (playFight(state, data, combat, rng, strat).outcome === "win") wins++;
    }
    t.diagnostic(`upior_zwiadowca vs ${classId} (poziom 1): wygrane ${wins}/200`);
  }
});

test("sparing z instruktorem: HP gracza nigdy < 1, wynik win/defeat (200 ziaren)", () => {
  const data = minimalData();
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const state = combatState(data, "miecz");
    const combat = createCombat(state, data, { enemies: [{ id: "instruktor" }], start: "far", canFlee: false, training: true, nonLethal: true, id: "sparing" }, rng);
    const result = playFight(state, data, combat, rng, strategy);
    assert.ok(["win", "defeat"].includes(result.outcome), `seed ${seed}: ${result.outcome}`);
    assert.ok(state.character.hp >= 1, `seed ${seed}: hp ${state.character.hp}`);
    assert.ok(combat.enemies[0].hp >= 1);
  }
});

test("cios w głowę: startowe klasy trafiają go realnie (≥25%) i opłaca się go ćwiczyć", () => {
  const data = minimalData();
  for (const classId of ["miecz", "wlocznia"]) {
    const state = combatState(data, classId);
    const combat = createCombat(state, data, { enemies: [{ id: "bandyta", count: 1 }], start: "melee", canFlee: true, id: "sim_glowa" }, createRng(1));
    combat.playerAp = 10;
    const chance = (m) => {
      for (const k of Object.keys(state.character.mastery)) state.character.mastery[k] = m;
      const rolls = [];
      const rng = { int: (lo, hi) => (lo === 1 && hi === 100 ? 100 : lo) };
      const r = doTechnique(state, data, combat, { id: "aimed", target: "bandyta#1", zone: "glowa" }, rng);
      rolls.push(r.events.find((e) => e.type === "atak").chance);
      combat.playerAp = 10;
      return rolls[0];
    };
    const start = chance(15);
    assert.ok(start >= 25, `${classId}: głowa ${start}% na starcie`);
    assert.ok(chance(100) > start, `${classId}: mistrzostwo poprawia głowę`);
  }
});
