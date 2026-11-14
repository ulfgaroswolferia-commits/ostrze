import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { startQuest, mapOptions, abandonHub, finishQuest } from "../src/systems/quests.js";
import { renderJournal } from "../src/ui/journal_screen.js";
import { runActions } from "../src/systems/actions.js";
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
const reported = () => {
  const state = hub({ komendant_byl: true, nora_zgoda: true, nora_wykonana: true });
  startQuest(state, data, "wilcza_nora");
  state.quests.wilcza_nora.reported = true;
  return state;
};

test("dane z report/onComplete przechodzą walidację; report bez reportTo to błąd", () => {
  assert.deepEqual(validateData(data), []);
  const d = structuredClone(data);
  delete d.quests.find((q) => q.id === "wilcza_nora").reportTo;
  assert.ok(validateData(d).some((m) => /reportTo/.test(m)));
});

test("zgłoszona wyprawa nie jest celem wyprawy i nie przepada przy wyjściu fabułą", () => {
  const state = reported();
  assert.deepEqual(mapOptions(state, data, "wilczy_brod"), []);
  assert.deepEqual(abandonHub(state, data, "wilczy_brod"), []);
  assert.equal(state.quests.wilcza_nora.status, "active");
  assert.match(renderJournal(state, data).map(strip).join(" "), /Zgłoś się: Komendant Wszebor/);
});

test("completeQuest: zamyka i płaci raz", () => {
  const state = reported();
  const money = state.character.money;
  runActions(state, data, [{ completeQuest: "wilcza_nora" }, { completeQuest: "wilcza_nora" }], createRng(1));
  assert.equal(state.quests.wilcza_nora.status, "done");
  assert.equal(state.character.money, money + 25);
  assert.deepEqual(finishQuest(state, data, "wilcza_nora", createRng(1)), []);
});

test("komendant: po powrocie rozlicza wilki (nagroda, kurier), potem tylko burczy", async () => {
  const state = reported();
  const money = state.character.money;
  const io = createAdaptiveIO([...pick("Komendant Wszebor", "Dwadzieścia pięć", "Dobrze wiedzieć", "Komendant Wszebor")]);
  await assert.rejects(defaultHandlers.map({ state, data, io, rng: createRng(5), debug: false, notices: [] }, MAP), InputExhaustedError);
  const text = strip(io.text());
  assert.match(text, /czerwonym płaszczu/);
  assert.match(text, /A, to ty\. Czego\?/);
  assert.equal(state.quests.wilcza_nora.status, "done");
  assert.equal(state.character.money, money + 25);
  assert.equal(state.flags.nora_rozliczona, true);
});
