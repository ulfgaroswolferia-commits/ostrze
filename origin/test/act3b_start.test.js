import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { evaluate } from "../src/engine/conditions.js";
import { createSceneList, runStory } from "../src/engine/loop.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { spotScenes } from "../src/systems/spots.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const data = await loadData();
const scenes = data.story.scenes;
// A quiet two-day road to the Observatory: no random events, scripted stage by stage.
const quiet = structuredClone(data);
quiet.rules.travel.eventChance = 0;
quiet.rules.travel.dangerousEventChance = 0;
const STAGE = ["", "", "", "1+++", "2", ""];
const idx = (id) => scenes.findIndex((s) => s.id === id);

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

test("koniec IIIa nie kończy gry: obie wersje są narracją, po nich wejście w IIIb", () => {
  for (const id of ["akt3a_koniec_scena", "akt3a_koniec_oblawa"]) assert.equal(scenes[idx(id)].type, "narration");
  assert.ok(idx("akt3b_wejscie") > idx("akt3a_koniec_oblawa"));
  assert.equal(scenes[idx("akt3b_mapa")].leaves, "gluszec");
  assert.deepEqual(scenes[idx("akt3b_mapa")].exitWhen, { if: { flag: "akt3b_koniec" }, goto: "akt3b_final" });
});

for (const [name, flags] of [["spokojne zakończenie", {}], ["po obławie", { oblawa_ucieczka: true }]]) {
  test(`z zapisu na końcu IIIa (${name}) gra przechodzi do Obserwatorium i otwiera hub`, async () => {
    const state = createNewState({ seed: 1, startScene: "akt3a_koniec_scena", rules: data.rules });
    const cs = combatState(quiet, "miecz");
    state.character = cs.character;
    state.inventory = cs.inventory;
    state.world.location = "gluszec";
    state.world.phenomenonRolledDay = 99;
    state.time.minutes = 9 * 60;
    Object.assign(state.flags, { akt2_koniec: true, akt3a_koniec: true, ...flags });
    state.scene.id = flags.oblawa_ucieczka ? "akt3a_koniec_oblawa" : "akt3a_koniec_scena";
    const io = createAdaptiveIO(["", ...STAGE, ...STAGE, ""]);
    const ctx = { state, data: quiet, io, rng: { int: (lo) => lo, setState() {}, getState: () => 0 }, debug: false, story: createSceneList(scenes), notices: [] };
    await assert.rejects(runStory(ctx), InputExhaustedError);
    const text = stripVTControlCharacters(io.text()).replace(/\s+/g, " ");
    assert.match(text, /dawne cesarskie Obserwatorium/);
    assert.equal(state.world.location, "obserwatorium");
    assert.equal(state.scene.id, "akt3b_mapa");
  });
}

test("hub Obserwatorium: ≥9 miejsc, pogadanki z 4 stanami, dialogi bez ślepych węzłów", () => {
  const hub = data.travel.locations.find((l) => l.id === "obserwatorium");
  assert.ok(hub.spots.length >= 9);
  for (const sp of hub.spots.filter((x) => x.type !== "board")) assert.ok(spotScenes(data, "obserwatorium", sp.id), sp.id);
  const chat = hub.spots.filter((x) => (x.scenes ?? []).length >= 4);
  assert.ok(chat.length >= 3);
  for (const id of ["hieronim", "brygida"]) for (const n of Object.values(data.dialogues.find((d) => d.id === id).nodes)) assert.ok(n.options.length >= 1);
  assert.equal(evaluate({ flag: "x" }, { flags: {} }, data), false);
});
