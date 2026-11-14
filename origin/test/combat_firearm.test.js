import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, equip, countOf } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { createCombat, livingEnemies, outcomeOf } from "../src/systems/combat/state.js";
import { doAction } from "../src/systems/combat/actions.js";
import { doTechnique } from "../src/systems/combat/techniques.js";
import { misfireChance, fireWeapon, addReinforcements } from "../src/systems/combat/firearm.js";
import { itemById } from "../src/systems/items.js";

const data = minimalData();
const fixed = (k) => ({ int: () => k });
/** Percent rolls (1–100) come from `rolls` (shots: misfire, then a missed hit = 100, noise, smoke) (the last repeats); every other range gives its low end. */
const mkRng = (rolls) => {
  let i = 0;
  return { int: (lo, hi) => (lo === 1 && hi === 100 ? rolls[Math.min(i++, rolls.length - 1)] : lo) };
};
const pistol = itemById(data, "pistolet_skalkowy");

/** State with fart 5 and proch 20, a pistol in hand (loaded), `pistols` copies in the bag. */
function mkState({ pistols = 1, loaded = 1 } = {}) {
  const state = combatState(data, "miecz");
  const ch = state.character;
  ch.hp = 100;
  ch.attributes.fart = 5;
  ch.skillPoints.proch = (ch.skillPoints.proch ?? 0) + 20 - getStats(state, data).skills.proch;
  addItem(state, data, "pistolet_skalkowy", pistols);
  assert.equal(equip(state, data, "pistolet_skalkowy", "bron").ok, true);
  state.inventory.loaded = { pistolet_skalkowy: loaded };
  return state;
}
function mkCombat(state, def = {}) {
  const combat = createCombat(state, data, { id: "walka_t", enemies: [{ id: "bandyta", count: 2 }], start: "far", canFlee: true, ...def }, fixed(1));
  combat.playerAp = 10;
  return combat;
}
const types = (events) => events.map((e) => e.type);

test("misfireChance: 15 - fart 5 - floor(proch 20 / 10) = 8, najmniej 1", () => {
  const state = mkState();
  assert.equal(getStats(state, data).skills.proch, 20);
  assert.equal(misfireChance(state, data, pistol), 8);
  assert.equal(misfireChance(state, data, { ...pistol, misfireChance: 3 }), 1);
});

test("niewypal (rzut <= 8): brak trafienia, PA -3, ładunek zużyty", () => {
  const state = mkState();
  const combat = mkCombat(state);
  const hp = combat.enemies.map((e) => e.hp);
  const r = doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, mkRng([8, 100]));
  assert.equal(r.ok, true);
  assert.deepEqual(types(r.events), ["niewypal"]);
  assert.equal(combat.playerAp, 7);
  assert.equal(state.inventory.loaded.pistolet_skalkowy, 0);
  assert.deepEqual(combat.enemies.map((e) => e.hp), hp);
  assert.equal(combat.enemies[0].morale, 60);
});

test("atak celowany z pistoletu idzie przez fireWeapon: niewypał zużywa ładunek i PA, bez trafienia", () => {
  const state = mkState();
  const combat = mkCombat(state);
  const hp = combat.enemies.map((e) => e.hp);
  const cost = pistol.apCost + data.rules.combat.aimed.tulow.ap;
  const r = doTechnique(state, data, combat, { id: "aimed", target: "bandyta#1", zone: "tulow" }, mkRng([8, 100]));
  assert.equal(r.ok, true);
  assert.deepEqual(types(r.events), ["niewypal"]);
  assert.equal(combat.playerAp, 10 - cost);
  assert.equal(state.inventory.loaded.pistolet_skalkowy, 0);
  assert.deepEqual(combat.enemies.map((e) => e.hp), hp);
});

test("rzut 9 to nie niewypał: normalny strzał", () => {
  const state = mkState();
  const combat = mkCombat(state);
  const r = doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, mkRng([9, 100, 100, 100]));
  assert.equal(types(r.events)[0], "atak");
  assert.equal(r.events.some((e) => e.type === "niewypal"), false);
  assert.equal(state.inventory.loaded.pistolet_skalkowy, 0);
});

test("rozerwanie (niewypał + rzut <= 2): pistolet znika z torby i ręki, HP gracza -4..8", () => {
  const state = mkState();
  const combat = mkCombat(state);
  const hp0 = state.character.hp;
  const r = doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, mkRng([8, 2]));
  assert.deepEqual(types(r.events), ["niewypal", "rozerwanie"]);
  assert.equal(countOf(state, "pistolet_skalkowy"), 0);
  assert.equal(state.inventory.equipped.bron, undefined);
  const burst = r.events[1];
  assert.equal(burst.damage, 4);
  assert.equal(burst.weapon, "pistolet_skalkowy");
  assert.equal(state.character.hp, hp0 - 4);
  const other = mkState();
  const events = fireWeapon(other, data, mkCombat(other), pistol, null, { int: (lo, hi) => (lo === 1 && hi === 100 ? 1 : hi) });
  assert.equal(events[1].damage, 8);
});

test("rozerwanie przy dwóch pistoletach: zostaje 1 w torbie, ręka pusta (Review Focus 2)", () => {
  const state = mkState({ pistols: 2 });
  const combat = mkCombat(state);
  doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, mkRng([8, 1]));
  assert.equal(countOf(state, "pistolet_skalkowy"), 1);
  assert.equal(state.inventory.equipped.bron, undefined);
});

test("obrażenia z rozerwania idą przez dealDamage (HP nie spada poniżej 0)", () => {
  const state = mkState();
  state.character.hp = 3;
  const combat = mkCombat(state);
  doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, mkRng([8, 1]));
  assert.equal(state.character.hp, 0);
});

test("strach: morale bandyty 60 -> 40, upiór (null) bez zmian; zdarzenie strach_bronia", () => {
  const state = mkState();
  const combat = mkCombat(state, { enemies: [{ id: "bandyta", count: 1 }, { id: "upior_zwiadowca", count: 1 }] });
  assert.equal(combat.enemies[0].morale, 60);
  const r = doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, mkRng([100]));
  assert.deepEqual(r.events.find((e) => e.type === "strach_bronia"), { type: "strach_bronia", fear: 20 });
  assert.equal(combat.enemies[0].morale, 40);
  assert.equal(combat.enemies[1].morale, null);
});

test("hałas: posiłki z reinforcements dołączają jako Bandyta 3 na dystansie, na końcu kolejki", () => {
  const state = mkState();
  const combat = mkCombat(state, { reinforcements: [{ id: "bandyta", count: 1 }] });
  const orderBefore = [...combat.order];
  const events = fireWeapon(state, data, combat, pistol, combat.enemies[0], mkRng([50, 100, 3, 100]));
  assert.deepEqual(events.find((e) => e.type === "posilki"), { type: "posilki", enemies: ["bandyta#3"] });
  const e3 = combat.enemies.find((e) => e.uid === "bandyta#3");
  assert.equal(e3.name, "Bandyta 3");
  assert.equal(e3.band, "far");
  assert.equal(e3.hp, e3.hpMax);
  assert.deepEqual(combat.order, [...orderBefore, "bandyta#3"]);
  assert.equal(combat.reinforced, true);
});

test("hałas drugi raz: brak kolejnych posiłków (Review Focus 5)", () => {
  const state = mkState();
  const combat = mkCombat(state, { reinforcements: [{ id: "bandyta", count: 1 }] });
  fireWeapon(state, data, combat, pistol, combat.enemies[0], mkRng([50, 100, 3, 100]));
  state.inventory.loaded.pistolet_skalkowy = 1;
  const again = fireWeapon(state, data, combat, pistol, combat.enemies[1], mkRng([50, 100, 3, 100]));
  assert.equal(again.some((e) => e.type === "posilki"), false);
  assert.equal(combat.enemies.length, 3);
  assert.deepEqual(addReinforcements(state, data, combat, fixed(1)), []);
});

test("hałas bez reinforcements w scenie: nic i flaga nietknięta", () => {
  const state = mkState();
  const combat = mkCombat(state);
  const events = fireWeapon(state, data, combat, pistol, combat.enemies[0], mkRng([50, 100, 3, 100]));
  assert.equal(events.some((e) => e.type === "posilki"), false);
  assert.equal(combat.enemies.length, 2);
  assert.equal(combat.reinforced, false);
});

test("posiłki pojedynczego wroga: istniejący dostaje numer 1, nowy numer 2", () => {
  const state = mkState();
  const combat = mkCombat(state, { enemies: [{ id: "bandyta", count: 1 }], reinforcements: [{ id: "bandyta", count: 1 }] });
  assert.equal(combat.enemies[0].name, "Bandyta");
  addReinforcements(state, data, combat, fixed(1));
  assert.deepEqual(combat.enemies.map((e) => e.name), ["Bandyta 1", "Bandyta 2"]);
});

test("dym: strzał daje zadymienie na polu walki, niewypał nie", () => {
  const state = mkState();
  const combat = mkCombat(state);
  const events = fireWeapon(state, data, combat, pistol, combat.enemies[0], mkRng([50, 100, 100, 100]));
  assert.deepEqual(events.find((e) => e.type === "dym"), { type: "dym", id: "zadymienie" });
  assert.equal(combat.battlefield.some((e) => e.id === "zadymienie"), true);
  state.inventory.loaded.pistolet_skalkowy = 1;
  const calm = mkCombat(state);
  const none = fireWeapon(state, data, calm, pistol, calm.enemies[0], mkRng([8, 100]));
  assert.equal(none.some((e) => e.type === "dym"), false);
  assert.equal(calm.battlefield.length, 0);
});

test("walka kończy się wygraną dopiero po pokonaniu posiłków", () => {
  const state = mkState();
  const combat = mkCombat(state, { enemies: [{ id: "bandyta", count: 1 }], reinforcements: [{ id: "bandyta", count: 1 }] });
  combat.enemies[0].dead = true;
  addReinforcements(state, data, combat, fixed(1));
  assert.equal(outcomeOf(state, combat), null);
  assert.equal(livingEnemies(combat).length, 1);
  combat.enemies[1].dead = true;
  assert.equal(outcomeOf(state, combat), "win");
});
