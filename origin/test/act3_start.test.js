import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { evaluate } from "../src/engine/conditions.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const data = await loadData();
const scenes = data.story.scenes;
const sceneIdx = (id) => scenes.findIndex((s) => s.id === id);

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

test("koniec aktu II nie kończy gry: narracja prowadzi do wejścia w akt III", () => {
  const end2 = scenes[sceneIdx("akt2_koniec_scena")];
  assert.equal(end2.type, "narration");
  assert.ok(sceneIdx("akt3_wejscie") > sceneIdx("akt2_koniec_scena"));
  assert.equal(scenes[sceneIdx("akt3_wejscie") + 1].id, "akt3_mapa");
  assert.deepEqual(scenes[sceneIdx("akt3_mapa")].starts, ["przyjecie_w_osadzie", "watek_gluszec"], "zlecenie wejściowe i wątek główny ruszają dopiero po porzuceniu starych");
});

test("akt3_mapa przenosi gracza do Głuszca i otwiera hub", async () => {
  const state = createNewState({ seed: 1, startScene: "akt3_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.flags.akt2_koniec = true;
  state.world.location = "kamienna_przelecz";
  const scene = scenes[sceneIdx("akt3_mapa")];
  const io = createAdaptiveIO([]);
  await assert.rejects(defaultHandlers.map({ state, data, io, rng: createRng(3), debug: false, notices: [] }, scene), InputExhaustedError);
  assert.equal(state.world.location, "gluszec");
});

test("dzień w Głuszcu wraca na mapę dopóki nie ma akt3a_koniec; potem kończy odsłonę", () => {
  const next = scenes[sceneIdx("akt3_dalej")];
  assert.equal(next.goto, "akt3_mapa");
  const state = { flags: {}, world: {} };
  assert.equal(evaluate(next.if, state, data), true);
  state.flags.akt3a_koniec = true;
  assert.equal(evaluate(next.if, state, data), false);
  assert.equal(evaluate(scenes[sceneIdx("akt3a_koniec_scena")].if, state, data), true);
  state.flags.oblawa_ucieczka = true;
  assert.equal(evaluate(scenes[sceneIdx("akt3a_koniec_scena")].if, state, data), false, "po obławie jest osobne zakończenie");
  assert.equal(evaluate(scenes[sceneIdx("akt3a_koniec_oblawa")].if, state, data), true);
});

test("map.exitWhen: walidacja celu i warunku", async () => {
  const { validateData } = await import("../src/engine/data.js");
  const bad = structuredClone(data);
  bad.story.scenes.find((s) => s.id === "akt3_mapa").exitWhen = { if: { flag: "x" }, goto: "nie_ma_sceny" };
  assert.ok(validateData(bad).some((m) => /exitWhen\.goto/.test(m)));
  const badIf = structuredClone(data);
  badIf.story.scenes.find((s) => s.id === "akt3_mapa").exitWhen = { if: { nieznany: 1 }, goto: "akt3_zapis" };
  assert.ok(validateData(badIf).some((m) => /exitWhen\.if/.test(m)));
});
