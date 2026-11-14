import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { createSceneList, runScenes } from "../src/engine/loop.js";
import { revealPlace, hintPlace } from "../src/systems/places.js";
import { startQuest, repairQuestState } from "../src/systems/quests.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";
import { InputExhaustedError } from "../src/ui/io.js";

const data = await loadData();
const strip = (s) => stripVTControlCharacters(s).replace(/\s+/g, " ");

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function hub(flags = {}) {
  const state = createNewState({ seed: 1, startScene: "demo_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 9 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  Object.assign(state.flags, flags);
  return state;
}

test("M1: runScenes z resume nie ocenia if sceny startowej", async () => {
  const state = hub({ a: true });
  const scenes = [{ id: "s1", type: "narration", text: "Pierwsza.", if: { notFlag: "a" }, goto: "koniec" }, { id: "s2", type: "narration", text: "Druga." }];
  const io = createAdaptiveIO(["", ""]);
  await runScenes({ state, data, io, rng: createRng(1), notices: [] }, createSceneList(scenes), "s1", { resume: true, endId: "koniec" });
  assert.match(strip(io.text()), /Pierwsza\./);
});

test("M2: zapis ze sceną usuniętą z fabuły wczytuje się na demo_mapa z ostrzeżeniem", async () => {
  const state = hub();
  state.scene.id = "demo_komendant";
  await saveGame("1", state, createRng(1));
  const warnings = [];
  const loaded = await loadGame("1", data, { warnings });
  assert.equal(loaded.scene.id, "demo_mapa");
  assert.ok(warnings.some((w) => /demo_komendant/.test(w)), warnings.join("|"));
});

test("M4: reveal spotu w ukrytej lokacji nie daje komunikatu i nie dubluje; hint spotu zapowiada lokację", () => {
  const state = hub();
  assert.deepEqual(revealPlace(state, data, "wilczy_las.polana"), []);
  assert.deepEqual(revealPlace(state, data, "wilczy_las.polana"), []);
  assert.equal(state.world.discovered.filter((id) => id === "wilczy_las.polana").length <= 1, true);
  assert.deepEqual(hintPlace(state, data, "wilczy_las.polana").map((e) => e.id), ["wilczy_las"]);
});

test("M5: nieistniejące spotScene / walk.event znikają przy naprawie bez wyjątku", () => {
  const state = hub();
  state.world.map = { hub: "wilczy_brod", phase: "spot", quest: null, questScene: null, spot: "komendant", spotScene: "duch", walk: null, visitor: null };
  repairQuestState(state, data);
  assert.equal(state.world.map.spotScene, null);
  state.world.location = "wilczy_las";
  state.world.map = { hub: "wilczy_brod", phase: "walk", quest: null, questScene: null, spot: null, spotScene: null, visitor: null,
    walk: { to: "wilczy_brod", step: 1, left: 10, event: "duch", eventScene: null } };
  repairQuestState(state, data);
  assert.equal(state.world.map.walk, null);
  assert.equal(state.world.map.phase, "choose");
});

test("tablica: podjęcie Leku dla Wrzoska startuje zlecenie z tablicy", () => {
  const state = hub();
  revealPlace(state, data, "wilczy_las");
  startQuest(state, data, "lek_dla_wrzoska");
  assert.equal(state.quests.lek_dla_wrzoska.status, "active");
});

test("M1 w scenie map: wznowienie rozmowy z komendantem po zapisie nie przeskakuje do innej sceny", async () => {
  const state = hub();
  const MAP = { id: "demo_mapa", type: "map", hub: "wilczy_brod", title: "x", main: { label: "Zamknij dzień", goto: "x" } };
  const first = { state, data, io: createAdaptiveIO([{ pick: "Komendant Wszebor" }, { pick: "Wędrowiec." }, { pick: "Szedłem" }, { pick: "Słucham." }, "^C"]), rng: createRng(2), debug: false, notices: [] };
  await assert.rejects(defaultHandlers.map(first, MAP));
  assert.equal(state.flags.komendant_byl, true);
  await saveGame("1", state, first.rng);
  const loaded = await loadGame("1", data);
  const io = createAdaptiveIO([{ pick: "Biorę to." }]);
  await assert.rejects(defaultHandlers.map({ state: loaded, data, io, rng: createRng(2), debug: false, notices: [] }, MAP), InputExhaustedError);
  assert.match(strip(io.text()), /Wataha z wąwozu/);
  assert.doesNotMatch(strip(io.text()), /Namyśliłeś się/);
});
