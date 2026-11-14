import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { evaluate } from "../src/engine/conditions.js";
import { advanceTime } from "../src/engine/time.js";
import { runActions } from "../src/systems/actions.js";
import { addSearch, searchLevel, decaySearch } from "../src/systems/search.js";
import { saveGame, loadGame, migrations } from "../src/engine/save.js";
import { SAVE_FORMAT_VERSION } from "../src/config.js";
import { tmpDir } from "./helpers.js";

const data = await loadData();
const fresh = () => createNewState({ seed: 1, startScene: "demo_mapa", rules: data.rules });

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

test("nowy stan ma poszukiwania 0; addSearch trzyma 0–100", () => {
  const state = fresh();
  assert.equal(state.world.search, 0);
  assert.equal(addSearch(state, data, 30), 30);
  assert.equal(addSearch(state, data, 200), 100);
  assert.equal(addSearch(state, data, -500), 0);
});

test("searchLevel na progach 24/25/49/50/74/75", () => {
  const state = fresh();
  const at = (n) => { state.world.search = n; return searchLevel(state, data); };
  assert.deepEqual([0, 24, 25, 49, 50, 74, 75, 100].map(at), ["spokoj", "spokoj", "czujnosc", "czujnosc", "poscig", "poscig", "oblawa", "oblawa"]);
});

test("warunek search {min,max}", () => {
  const state = fresh();
  state.world.search = 40;
  assert.equal(evaluate({ search: { min: 25 } }, state, data), true);
  assert.equal(evaluate({ search: { min: 50 } }, state, data), false);
  assert.equal(evaluate({ search: { max: 30 } }, state, data), false);
  assert.equal(evaluate({ search: { min: 25, max: 50 } }, state, data), true);
});

test("akcja search zmienia poziom w widełkach", () => {
  const state = fresh();
  runActions(state, data, [{ search: 30 }], createRng(1));
  assert.equal(state.world.search, 30);
  runActions(state, data, [{ search: -50 }], createRng(1));
  assert.equal(state.world.search, 0);
});

test("poszukiwania maleją o decayPerDay na początku nowego dnia", () => {
  const state = fresh();
  state.world.search = 40;
  state.time.minutes = 23 * 60;
  advanceTime(state, 2 * 60, data, createRng(1)); // przez północ
  assert.equal(state.world.search, 40 - data.rules.search.decayPerDay);
  decaySearch(state, data, 100);
  assert.equal(state.world.search, 0);
});

test("zapis i wczytanie zachowują poszukiwania; migracja z v10 daje 0", async () => {
  assert.equal(SAVE_FORMAT_VERSION, 13);
  const state = fresh();
  state.world.search = 66;
  await saveGame("auto", state, createRng(1));
  const loaded = { state: await loadGame("auto", data) };
  assert.equal(loaded.state.world.search, 66);
  const old = { version: 10, world: { discovered: [] } };
  const migrated = migrations[10](old);
  assert.equal(migrated.version, 11);
  assert.equal(migrated.world.search, 0);
});

test("walidacja: akcja search 0 i warunek search bez min/max są błędem; dane prawdziwe czyste", () => {
  assert.deepEqual(validateData(data), []);
  const d = structuredClone(data);
  d.dialogues[0].nodes[Object.keys(d.dialogues[0].nodes)[0]].actions = [{ search: 0 }];
  assert.ok(validateData(d).some((m) => /search/.test(m)));
  const e = structuredClone(data);
  e.dialogues[0].nodes[Object.keys(e.dialogues[0].nodes)[0]].options[0].requires = { search: {} };
  assert.ok(validateData(e).some((m) => /search/.test(m)));
});
