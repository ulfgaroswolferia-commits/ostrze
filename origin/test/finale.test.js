import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createSceneList, runStory } from "../src/engine/loop.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

// Koniec Aktu III (E2f): flaga akt3b_koniec prowadzi z mapy Obserwatorium do „Szkła, które pamięta”. Ścieżka Szkło → kuźnia → tymczasowy koniec
// jest w act3_close.test.js.
const data = await loadData();
let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

test("z mapy Obserwatorium flaga akt3b_koniec prowadzi prosto do Szkła, które pamięta (bez zamykania dnia)", async () => {
  const state = createNewState({ seed: 1, startScene: "akt3b_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.world.location = "obserwatorium";
  state.world.phenomenonRolledDay = 99;
  state.flags.klasa_miecz = true;
  state.flags.akt3b_koniec = true;
  const io = createAdaptiveIO([]);
  const ctx = { state, data, io, rng: { int: (lo) => lo, setState() {}, getState: () => 0 }, debug: false, story: createSceneList(data.story.scenes), notices: [] };
  await assert.rejects(runStory(ctx), InputExhaustedError);
  assert.match(stripVTControlCharacters(io.text()).replace(/\s+/g, " "), /Dwa głosy|Zapis w szkle/);
  assert.equal(state.scene.id, "akt3b_final");
});
