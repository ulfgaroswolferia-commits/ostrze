import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";
import { isKnown } from "../src/systems/places.js";
import { countOf } from "../src/systems/inventory.js";

const data = await loadData();
const strip = (s) => stripVTControlCharacters(s);
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
/** Plays the map scene on `tokens` until they run out; returns the screen text. */
async function visit(state, tokens) {
  const io = createAdaptiveIO(tokens);
  await assert.rejects(defaultHandlers.map({ state, data, io, rng: createRng(5), debug: false, notices: [] }, MAP), InputExhaustedError);
  return strip(io.text()).replace(/\s+/g, " ");
}

test("dane przechodzą walidację; hub ma komendanta, karczmę, izbę, kramik, tablicę i dwóch gadatliwych", () => {
  assert.deepEqual(validateData(data), []);
  const spots = data.travel.locations.find((l) => l.id === "wilczy_brod").spots.map((s) => s.id);
  assert.deepEqual(spots, ["komendant", "karczma", "izba", "kramik", "szkarad", "tablica", "woz_ostromira", "straznik", "gospodyni", "kowal", "zona_borka", "corka", "ulepszenia", "szkarad_ulepszenia"]);
});

test("komendant: najpierw wypytuje (trzy wymiany), dopiero potem zleca; zgoda podejmuje zadanie", async () => {
  const state = hub();
  const text = await visit(state, pick("Komendant Wszebor", "Wędrowiec.", "Szedłem ze szkołą", "Słucham.", "Biorę to.", "Bywaj."));
  assert.match(text, /Kim ty, kurwa, jesteś/);
  assert.match(text, /Skąd idziesz i dokąd/);
  assert.match(text, /Wataha z wąwozu/);
  assert.equal(state.quests.wilcza_nora.status, "active");
});

test("komendant: po odmowie pyta, czy się namyśliłeś; po przyjęciu burczy, czemu jeszcze nie wyruszyłeś", async () => {
  const declined = hub({ komendant_byl: true });
  assert.match(await visit(declined, pick("Komendant Wszebor")), /Namyśliłeś się\?/);
  const taken = hub({ komendant_byl: true, nora_zgoda: true });
  taken.quests = { wilcza_nora: { status: "active", acceptedAt: 0, deadline: null, departed: false } };
  assert.match(await visit(taken, pick("Komendant Wszebor")), /Ty jeszcze tutaj\?/);
});

test("gadatliwy wartownik reaguje inaczej przy kolejnych wizytach", async () => {
  const state = hub();
  const text = await visit(state, [...pick("Wartownik przy palisadzie", "Dalej", "Wartownik przy palisadzie", "Dalej", "Wartownik przy palisadzie")]);
  assert.match(text, /Szron na pikach/);
  assert.match(text, /Znów ty/);
  assert.match(text, /Na warcie nie rozmawiam/);
});

test("Lek dla Wrzoska: plotka odkrywa las, prośba podejmuje zadanie, ziela z polany i oddanie kończą je z nagrodą", async () => {
  const state = hub();
  const quiet = structuredClone(data); // no local events on the walk
  quiet.rules.travel.localEventChance = 0;
  const rng = { int: () => 1 };
  const io = createAdaptiveIO([...pick("Karczma", "[Wymowa", "Dobra.", "Potrzebujesz czegoś?", "Zobaczę", "Bywaj.", "Wróć na mapę", "! Las Rubieży", "! Polana ziół", "Dalej", "Dalej", "Polana ziół", "Dalej", "Wróć na mapę", "! Strażnica", "! Karczma", "Mam ziela", "Bywaj.")]);
  await assert.rejects(defaultHandlers.map({ state, data: quiet, io, rng, debug: false, notices: [] }, MAP), (e) => { if (!(e instanceof InputExhaustedError)) console.log(strip(io.text()).slice(-1500)); return e instanceof InputExhaustedError; });
  assert.equal(isKnown(state, data, "wilczy_las"), true);
  assert.equal(countOf(state, "ziola_dla_wrzoska"), 0);
  assert.equal(state.flags.ziola_zebrane, true);
  assert.equal(state.quests.lek_dla_wrzoska.status, "done");
  assert.match(strip(io.text()), /Zadanie wykonane: Lek dla Wrzoska/);
});

test("mapa: gdy wątek główny huba jest ukończony, ostatnia pozycja mówi, że to ruszanie dalej", async () => {
  const map = { ...MAP, main: { label: "Prześpij noc", doneLabel: "Wyrusz do Głuszca", goto: "x" } };
  const play = async (state) => {
    state.world.map = { hub: "wilczy_brod", phase: "choose", quest: null, questScene: null, spot: null, spotScene: null, walk: null, visitor: null, far: null };
    const io = createAdaptiveIO([]);
    await assert.rejects(defaultHandlers.map({ state, data, io, rng: createRng(5), debug: false, notices: [] }, map), InputExhaustedError);
    return strip(io.text()).replace(/\s+/g, " ");
  };
  const open = await play(hub());
  assert.match(open, /Prześpij noc/);
  assert.doesNotMatch(open, /Wyrusz do Głuszca/);
  const done = hub();
  for (const q of data.quests.filter((q) => q.main && q.hub === "wilczy_brod")) done.quests[q.id] = { status: "done", done: q.objectives.map((o) => o.id) };
  assert.match(await play(done), /Wyrusz do Głuszca/);
});

test("pożegnanie Ostromira: nazywa dalekie miejsca, odsłania je na mapie i odsyła do Brodu po przygotowania", () => {
  const talk = data.dialogues.find((d) => d.id === "ostromir_pozegnanie");
  const node = talk.nodes.szlaki;
  for (const name of ["Głuszec", "Ostoja zbójców", "Twierdza graniczna", "Wilczego Brodu"]) assert.ok(node.text.includes(name), name);
  assert.deepEqual(node.actions.map((a) => a.reveal), ["ostoja_zbojcow", "twierdza_graniczna"]);
  assert.ok(data.quests.find((q) => q.id === "eskorta_ostromira").scenes.some((s) => s.dialogue === "ostromir_pozegnanie"));
});

test("mapy hubów: etykieta ruszania dalej nazywa cel, bez „Zamknij dzień” i „ruszaj dalej”", () => {
  for (const scene of data.story.scenes.filter((s) => s.type === "map")) {
    assert.doesNotMatch(`${scene.main.label} ${scene.main.doneLabel ?? ""}`, /zamknij dzie|ruszaj dalej|dalszą drogę/i, scene.id);
  }
});

test("zapowiedzi: rozmowy i sceny przed wyjściem z huba nazywają następne miejsce", () => {
  const node = (dialogue, id) => data.dialogues.find((d) => d.id === dialogue).nodes[id].text;
  assert.match(node("halina", "q12_halina"), /Obserwatorium na Szklanym Wzgórzu/);
  assert.match(node("hieronim", "q10_start"), /Obozu na Wroniej Górze/);
  const scene = (id) => data.story.scenes.find((s) => s.id === id).text;
  assert.match(scene("akt3b_przejscie"), /Obozu na Wroniej Górze/);
  assert.match(scene("akt4c_przejscie"), /Przystani Jarnowo/);
});
