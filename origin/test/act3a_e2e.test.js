import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createSceneList, runStory } from "../src/engine/loop.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const real = await loadData();
// No random road events: the three-day trip to Głuszca is scripted stage by stage.
const data = structuredClone(real);
data.rules.travel.eventChance = 0;
data.rules.travel.dangerousEventChance = 0;
const SLEEP = ["1+++", "2", ""];
const STAGE = ["", "", "", ...SLEEP];
const TRIP_TO_GLUSZEC = ["", "", "", ""]; // three quiet days: the departure, then "Idź dalej" each evening
const pick = (...labels) => labels.map((l) => ({ pick: l }));

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

/** A player at the end of act II: the Pass behind them, the act's flag set. */
function atTheEndOfActII(classId, flags = {}, world = {}) {
  const state = createNewState({ seed: 1, startScene: "akt3_droga", rules: data.rules });
  const cs = combatState(data, classId);
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 60;
  state.time.minutes = 8 * 60;
  state.world.location = "wilczy_brod";
  state.world.phenomenonRolledDay = 99;
  state.flags.akt2_koniec = true;
  Object.assign(state.flags, flags);
  Object.assign(state.world, world);
  return state;
}
/** A rng that always rolls the lowest value, so a visitor roll always hits. */
const lowRng = { int: (lo) => lo, setState() {}, getState: () => 0 };

async function play(state, plan) {
  const io = createAdaptiveIO(plan);
  const ctx = { state, data, io, rng: lowRng, debug: false, story: createSceneList(data.story.scenes), notices: [] };
  await assert.rejects(runStory(ctx), InputExhaustedError);
  return stripVTControlCharacters(io.text()).replace(/\s+/g, " ");
}

for (const classId of ["miecz", "wlocznia"]) {
  test(`akt III A (${classId}): z końca aktu II do Głuszca – zlecenie wprowadzające rusza, gracz stoi w osadzie`, async () => {
    const state = atTheEndOfActII(classId);
    const text = await play(state, [...TRIP_TO_GLUSZEC, ""]);
    assert.match(text, /Za przełęczą droga rozłazi się w ścieżkę/);
    assert.match(text, /Nowe zadanie: Swój w osadzie/);
    assert.equal(state.world.location, "gluszec");
    assert.equal(state.quests.przyjecie_w_osadzie.status, "active");
    assert.ok(state.time.minutes >= 8 * 60 + 2 * 24 * 60, "droga trwa trzy dni");
    assert.equal(state.scene.id, "akt3_mapa");
  });

  test(`akt III A (${classId}): obława przy poszukiwaniach 90 pojawia się sama (bez wybierania z menu) – ucieczka kończy odsłonę zakończeniem obławy`, async () => {
    const state = atTheEndOfActII(classId, {}, { search: 100 });
    const text = await play(state, [...TRIP_TO_GLUSZEC, "", ...pick("Uciekaj przez piwnicę", "Biegnę dalej")]);
    assert.equal(state.flags.akt3a_koniec, true);
    assert.equal(state.flags.oblawa_ucieczka, true);
    assert.match(text, /Obława spada na Głuszec/);
    assert.equal(state.scene.id, "akt3a_koniec_oblawa");
  });
}
