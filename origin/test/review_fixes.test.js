import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { runActions } from "../src/systems/actions.js";
import { addItem } from "../src/systems/inventory.js";
import { repairQuestState } from "../src/systems/quests.js";
import { revealPlace } from "../src/systems/places.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const data = await loadData();
const strip = (s) => stripVTControlCharacters(s).replace(/\s+/g, " ");
const MAP = { id: "mapa", type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Zamknij dzień", goto: "x" } };
const pick = (...labels) => labels.map((l) => ({ pick: l }));

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function hub(flags = {}) {
  const state = createNewState({ seed: 1, startScene: "mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 9 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  Object.assign(state.flags, flags);
  return state;
}
async function visit(state, tokens, rng = createRng(5)) {
  const io = createAdaptiveIO(tokens);
  await assert.rejects(defaultHandlers.map({ state, data, io, rng, debug: false, notices: [] }, MAP), InputExhaustedError);
  return strip(io.text());
}

test("C1: ziela zebrane przed podjęciem zlecenia – podjęcie i oddanie w jednej rozmowie kończy zlecenie", async () => {
  const state = hub({ ziola_zebrane: true });
  revealPlace(state, data, "wilczy_las");
  addItem(state, data, "ziola_dla_wrzoska", 1);
  await visit(state, pick("Karczma", "Potrzebujesz", "Zobaczę", "Mam ziela", "Bywaj."));
  assert.equal(state.quests.lek_dla_wrzoska.status, "done");
});

test("C1: startQuest z tablicy z ziołami w torbie od razu zalicza pierwszy cel", () => {
  const state = hub();
  revealPlace(state, data, "wilczy_las");
  addItem(state, data, "ziola_dla_wrzoska", 1);
  runActions(state, data, [{ startQuest: "lek_dla_wrzoska" }], { int: () => 1 });
  assert.deepEqual(state.quests.lek_dla_wrzoska.done, ["ziola"]);
});

test("I1: zapis w drodze powrotnej do huba nie jest naprawiany", () => {
  const state = hub();
  state.world.location = "wilczy_las";
  state.world.map = { hub: "wilczy_brod", phase: "walk", quest: null, questScene: null, spot: null, spotScene: null,
    walk: { to: "wilczy_brod", legs: [20], events: [], step: 0, eventScene: null } };
  repairQuestState(state, data);
  assert.equal(state.world.map.phase, "walk");
  assert.equal(state.world.map.walk.to, "wilczy_brod");
});

test("I2: nieudany rzut Wymowy u Wrzoska nie zamyka drogi do lasu", async () => {
  const state = hub();
  await visit(state, pick("Karczma", "[Wymowa", "Dobra."), { int: () => 100 });
  assert.equal(state.world.discovered.includes("wilczy_las"), true);
});

test("I3: ziela ze zlecenia z tablicy można oddać Wrzoskowi bez ponownego „Potrzebujesz czegoś?”", async () => {
  const state = hub();
  revealPlace(state, data, "wilczy_las");
  runActions(state, data, [{ startQuest: "lek_dla_wrzoska" }], { int: () => 1 });
  addItem(state, data, "ziola_dla_wrzoska", 1);
  const text = await visit(state, pick("Karczma"));
  assert.match(text, /Mam ziela z polany/);
});

test("I4: po ucieczce z Wilczej Nory komendant nie odsyła do wąwozu", async () => {
  const state = hub({ komendant_byl: true, nora_zgoda: true });
  state.quests = { wilcza_nora: { status: "failed", acceptedAt: 0, deadline: null, departed: false } };
  const text = await visit(state, pick("Komendant Wszebor"));
  assert.doesNotMatch(text, /Ty jeszcze tutaj/);
});
