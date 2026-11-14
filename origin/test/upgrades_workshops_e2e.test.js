import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";
import { addItem, equip, countOf } from "../src/systems/inventory.js";
import { createCombat } from "../src/systems/combat/state.js";
import { doAction } from "../src/systems/combat/actions.js";

const data = await loadData();
const MAP = { id: "mapa", type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Zamknij dzień", goto: "x" } };
const pick = (...labels) => labels.map((l) => ({ pick: l }));
const fixed100 = { int: (lo, hi) => (lo === 1 && hi === 100 ? 50 : lo) };

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

/** Plays the map scene on `tokens` until they run out; returns the screen text. */
async function visit(state, tokens) {
  const io = createAdaptiveIO(tokens);
  await assert.rejects(defaultHandlers.map({ state, data, io, rng: createRng(5), debug: false, notices: [] }, MAP), InputExhaustedError);
  return stripVTControlCharacters(io.text()).replace(/\s+/g, " ");
}
const hitChance = (state) => {
  const combat = createCombat(state, data, { id: "walka_t", enemies: [{ id: "bandyta", count: 1 }], start: "melee", canFlee: true }, { int: (lo) => lo });
  combat.playerAp = 10;
  const r = doAction(state, data, combat, { id: "attack", target: combat.enemies[0].uid }, fixed100);
  assert.equal(r.ok, true);
  return r.events.find((e) => e.type === "atak" && e.attacker === "player").chance;
};

test("kuźnia Zbycha przez scenę mapy: rozmowa odsłania spot, wymiana w dialogu, założenie, walka +5 do trafienia", async () => {
  const state = createNewState({ seed: 1, startScene: "mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = { items: [], equipped: {}, quickSlots: [], loaded: {} };
  addItem(state, data, "miecz_krotki", 1);
  assert.equal(equip(state, data, "miecz_krotki", "bron").ok, true);
  state.character.money = 100;
  state.time.minutes = 9 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  const before = hitChance(state);

  await visit(state, pick("Kuźnia", "Bywaj."));
  assert.equal(state.flags.dialog_met_kowal, true);

  const text = await visit(state, pick("Kuźnia Zbycha: ulepszenia", "Krótki miecz: uchwyt", "Dobra.", "Innym razem."));
  assert.match(text, /Tylko weź to do ręki, zanim ktoś ci da w łeb/);
  assert.equal(state.character.money, 80);
  assert.equal(countOf(state, "miecz_krotki"), 0);
  assert.equal(countOf(state, "miecz_krotki_u1"), 1);
  assert.equal(state.inventory.equipped.bron, undefined);

  assert.equal(equip(state, data, "miecz_krotki_u1", "bron").ok, true);
  assert.equal(state.inventory.equipped.bron, "miecz_krotki_u1");
  assert.equal(hitChance(state), before + 5);
});
