import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { enterNode, chooseOption, nodeView } from "../src/systems/dialogue.js";
import { isKnown } from "../src/systems/places.js";
import { startQuest, failQuest } from "../src/systems/quests.js";
import { rollLocalEvent } from "../src/systems/travel.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const data = await loadData();
const strip = (s) => stripVTControlCharacters(s).replace(/\s+/g, " ");
const MAP = { id: "demo_mapa", type: "map", hub: "wilczy_brod", title: "x", main: { label: "Zamknij dzień", goto: "x" } };
const pick = (...labels) => labels.map((l) => ({ pick: l }));
const fixed = (k) => ({ int: () => k });

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function start(flags = {}, d = data) {
  const state = createNewState({ seed: 1, startScene: "demo_mapa", rules: d.rules });
  const cs = combatState(d, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 10 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  Object.assign(state.flags, flags);
  return state;
}
const keys = (state, dialogue, node) => nodeView(state, data, dialogue, node).options.filter((o) => !o.disabled).map((o) => o.key);

test("C1: żona Borka odsłania Las Rubieży i Ruiny, więc cele Borka i amuletu są osiągalne", () => {
  const state = start();
  enterNode(state, data, "zona_borka", "prosba", fixed(1));
  assert.equal(isKnown(state, data, "wilczy_las"), true);
  assert.equal(isKnown(state, data, "ruiny_straznicy"), true);
  assert.equal(state.quests.zaginiony_pasterz_borek.status, "active");
});

test("C2: Ostromir z traktu nie trafia się na spacerze, dopóki dług nie jest oddany; przegraną eskortę można podjąć znowu", () => {
  const d = structuredClone(data);
  d.rules.travel.localEventChance = 100;
  d.travel.events = d.travel.events.filter((e) => e.id === "kupiec_ostromir");
  const state = start({}, d);
  assert.equal(rollLocalEvent(state, d, fixed(1), 1), null);
  state.flags.dlug_oddany = true;
  assert.equal(rollLocalEvent(state, d, fixed(1), 1), "kupiec_ostromir");
  startQuest(state, data, "eskorta_ostromira");
  failQuest(state, data, "eskorta_ostromira");
  assert.equal(startQuest(state, data, "eskorta_ostromira").some((e) => e.type === "zadanie_start"), true);
  assert.equal(state.quests.eskorta_ostromira.status, "active");
});

test("I1: odmowa startQuest (limit) nie zamyka opcji – dług do podjęcia nadal na liście", () => {
  const d = structuredClone(data);
  d.rules.quests.maxActive = 1;
  const state = start({ wrzosek_wiadomosc: true }, d);
  startQuest(state, d, "wilcza_nora");
  const view = (st) => nodeView(st, d, "wrzosek", "powitanie").options.find((o) => o.key === "dlug");
  assert.equal(view(state).disabled, false);
  chooseOption(state, d, "wrzosek", "powitanie", "dlug", fixed(1));
  enterNode(state, d, "wrzosek", "dlug", fixed(1));
  assert.equal(state.quests.dlug_kupca, undefined, "limit: zlecenie nie ruszyło");
  assert.equal(view(state).disabled, false, "opcja wciąż dostępna po odmowie");
});

test("I2: kowal przyjmuje odłamek tylko przy aktywnym zleceniu; zioła Wrzoska tak samo", () => {
  const state = start({});
  state.inventory.items.push({ id: "odlamek_szkla", qty: 1 }, { id: "ziola_dla_wrzoska", qty: 1 });
  assert.equal(keys(state, "kowal", "kuznia").includes("odlamek"), false);
  assert.equal(keys(state, "wrzosek", "powitanie").includes("ziola"), false);
  startQuest(state, data, "swiatlo_w_mlynie");
  assert.equal(keys(state, "kowal", "kuznia").includes("odlamek"), true);
});

test("I3: zwiadowców można wysłuchać cierpliwie bez rzutu; komendant rozmawia po przepadłej norze", async () => {
  const state = start();
  enterNode(state, data, "zwiadowcy", "cierpliwie", fixed(1));
  assert.equal(state.flags.zwiadowcy_slysza, true);
  const s2 = start({ komendant_byl: true, nora_zgoda: true });
  s2.quests = { wilcza_nora: { status: "failed", acceptedAt: 0, deadline: null, departed: false } };
  const io = createAdaptiveIO(pick("Komendant Wszebor"));
  await assert.rejects(defaultHandlers.map({ state: s2, data, io, rng: createRng(5), debug: false, notices: [] }, MAP), InputExhaustedError);
  assert.match(strip(io.text()), /A, to ty\. Czego\?/);
});

test("I4: gość wylosowany przed zapisem nie jest losowany od nowa przy wznowieniu sceny", async () => {
  const state = start();
  state.world.map = { hub: "wilczy_brod", phase: "place", quest: null, questScene: null, spot: null, spotScene: null, walk: null, visitor: "zebrak" };
  const io = createAdaptiveIO([]);
  await assert.rejects(defaultHandlers.map({ state, data, io, rng: { int: () => 100 }, debug: false, notices: [] }, MAP), InputExhaustedError);
  assert.equal(state.world.map.visitor, "zebrak");
});

test("M5: córka nie pozwala wybrać i oddania, i zatrzymania amuletu", () => {
  const state = start({ amulet_pasuje: true, amulet_oddany: true });
  state.inventory.items.push({ id: "amulet_strazniczy", qty: 1 });
  assert.equal(keys(state, "corka", "corka").includes("zatrzymaj"), false);
});
