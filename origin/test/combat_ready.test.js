import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { createCombat } from "../src/systems/combat/state.js";
import { beginTurn, endTurn, runEnemyTurns } from "../src/systems/combat/turn.js";
import { doAction } from "../src/systems/combat/actions.js";
import { techniqueActions, doTechnique, TECHNIQUE_IDS } from "../src/systems/combat/techniques.js";
import { combatEventText } from "../src/ui/events.js";
import { createRng } from "../src/engine/dice.js";
import { addItem } from "../src/systems/inventory.js";

const data = minimalData();
const fixed = { int: () => 1 };

function wolves(classId = "wlocznia", count = 3) {
  const state = combatState(data, classId);
  state.character.hp = 999;
  const combat = createCombat(state, data, { id: "t", enemies: [{ id: "wilk", count }], start: "far", canFlee: true }, fixed);
  return { state, combat };
}
const blows = (events) => events.filter((e) => e.type === "atak" && e.attacker === "player");

test("włócznia bez gotowości: wilki wchodzą w zwarcie, a gracz nie dostaje darmowych ciosów (nic nie dzieje się bez jego wyboru)", () => {
  const { state, combat } = wolves();
  beginTurn(state, data, combat, fixed);
  doAction(state, data, combat, { id: "defend" }, fixed);
  endTurn(state, data, combat);
  const events = runEnemyTurns(state, data, combat, createRng(5));
  assert.equal(blows(events).length, 0, "brak automatycznych ciosów gracza");
  assert.ok(combat.enemies.every((e) => e.hp === e.hpMax), "wilki nietknięte");
});

test("Gotowość do ciosu: kosztuje PA, jest jawną techniką i działa na wrogów wchodzących w zwarcie do następnej tury gracza", () => {
  assert.ok(TECHNIQUE_IDS.includes("ready"));
  const { state, combat } = wolves();
  beginTurn(state, data, combat, fixed);
  const ready = techniqueActions(state, data, combat).find((a) => a.id === "ready");
  assert.equal(ready.disabled, false);
  assert.equal(ready.apCost, data.rules.combat.reachReadyAp);
  const before = combat.playerAp;
  const r = doTechnique(state, data, combat, { id: "ready" }, fixed);
  assert.equal(r.ok, true);
  assert.equal(combat.playerAp, before - ready.apCost);
  assert.equal(combat.ready, true);
  assert.equal(r.events[0].type, "gotowosc");
  assert.match(combatEventText(data.ui, data, combat, r.events[0]), /Gotowość/);
  assert.equal(techniqueActions(state, data, combat).find((a) => a.id === "ready").reason, "combat.alreadyReady");
  endTurn(state, data, combat);
  const events = runEnemyTurns(state, data, combat, createRng(5));
  assert.ok(blows(events).length >= 1, "wchodzący w zwarcie wróg dostaje cios z gotowości");
  assert.ok(blows(events).every((e) => e.reaction === true));
  // the stance ends with the next player turn
  beginTurn(state, data, combat, fixed);
  assert.equal(combat.ready, false);
});

test("gotowość działa też z mieczem: wchodzący w zwarcie wróg dostaje cios", () => {
  const { state, combat } = wolves("miecz");
  beginTurn(state, data, combat, fixed);
  const ready = techniqueActions(state, data, combat).find((a) => a.id === "ready");
  assert.equal(ready.disabled, false);
  assert.equal(doTechnique(state, data, combat, { id: "ready" }, fixed).ok, true);
  endTurn(state, data, combat);
  const events = runEnemyTurns(state, data, combat, createRng(5));
  assert.ok(blows(events).length >= 1);
  assert.ok(blows(events).every((e) => e.reaction === true && e.weapon === state.inventory.equipped.bron));
});

test("gotowości nie ma gołymi rękami ani z bronią dystansową: jest powód", () => {
  const { state, combat } = wolves("miecz");
  beginTurn(state, data, combat, fixed);
  state.inventory.equipped.bron = null;
  const ready = techniqueActions(state, data, combat).find((a) => a.id === "ready");
  assert.equal(ready.disabled, true);
  assert.equal(ready.reason, "combat.noReach");
  assert.equal(doTechnique(state, data, combat, { id: "ready" }, fixed).ok, false);
  const bow = data.items.find((i) => i.range && i.range !== "melee");
  addItem(state, data, bow.id, 1);
  state.inventory.equipped.bron = bow.id;
  assert.equal(techniqueActions(state, data, combat).find((a) => a.id === "ready").reason, "combat.noReach");
});
