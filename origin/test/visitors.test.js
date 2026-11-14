import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState, createAdaptiveIO, tmpDir, pruneMissingQuests } from "./helpers.js";
import { validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { rollVisitor } from "../src/systems/spots.js";

const strip = (s) => stripVTControlCharacters(s).replace(/\s+/g, " ");
const MAP = { id: "mapa", type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Czekaj", goto: "koniec_gry" } };
const VISITOR = { id: "pielgrzym", chance: 100, if: { notFlag: "pielgrzym_byl" },
  scenes: [{ id: "gosc_pielgrzym_1", type: "narration", text: "Pielgrzym mamrocze pod nosem.", goto: "gosc_pielgrzym_2" },
    { id: "gosc_pielgrzym_2", type: "flag", set: { pielgrzym_byl: true }, goto: "koniec" }] };

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function world(edit = () => {}) {
  const data = structuredClone(minimalData());
  const hub = data.travel.locations.find((l) => l.id === "wilczy_brod");
  data.quests = data.quests.filter((q) => q.kind !== "errand"); // the hub's real places are replaced below
  data.dialogues = data.dialogues.filter((d) => !["wrzosek", "zona_borka", "corka", "komendant_po", "kowal"].includes(d.id));
  pruneMissingQuests(data); // act III has its own tests
  hub.spots = [{ id: "izba", name: "Izba", type: "rest" }];
  hub.visitors = [structuredClone(VISITOR)];
  edit(data, hub);
  data.story = { start: "mapa", scenes: [MAP, { id: "koniec_gry", type: "ending", text: "Koniec." }] };
  const state = createNewState({ seed: 1, startScene: "mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 9 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  return { data, state };
}
const pick = (...labels) => labels.map((l) => ({ pick: l }));
const ctxOf = (state, data, io) => ({ state, data, io, rng: createRng(3), debug: false, notices: [] });
const run = (ctx) => defaultHandlers.map(ctx, MAP);

test("walidacja gości: poprawny; chance 0/101, brak scen, nieznany if, powtórzone id", () => {
  assert.deepEqual(validateData(world().data), []);
  const errs = (edit) => validateData(world(edit).data);
  assert.ok(errs((d, h) => { h.visitors[0].chance = 0; }).some((m) => /chance/.test(m)));
  assert.ok(errs((d, h) => { h.visitors[0].chance = 101; }).some((m) => /chance/.test(m)));
  assert.ok(errs((d, h) => { delete h.visitors[0].scenes; }).some((m) => /scenes/.test(m)));
  assert.ok(errs((d, h) => { h.visitors[0].if = { zly: 1 }; }).some((m) => /nieznany warunek/.test(m)));
  assert.ok(errs((d, h) => { h.visitors.push(structuredClone(h.visitors[0])); }).some((m) => /zduplikowane|już zajęte/.test(m)));
});

test("rollVisitor: chance 100 i rng 1 → gość; if niespełniony → null; chance niskie i rng 100 → null", () => {
  const { data, state } = world();
  assert.equal(rollVisitor(state, data, "wilczy_brod", { int: () => 1 }), "pielgrzym");
  assert.equal(rollVisitor(state, data, "wilczy_brod", { int: () => 100 }), "pielgrzym", "chance 100");
  data.travel.locations[1].visitors[0].chance = 10;
  assert.equal(rollVisitor(state, data, "wilczy_brod", { int: () => 100 }), null);
  state.flags.pielgrzym_byl = true;
  assert.equal(rollVisitor(state, data, "wilczy_brod", { int: () => 1 }), null);
});

test("gość pojawia się w menu miejsc, jego scena gra się raz, potem znika", async () => {
  const { data, state } = world();
  const io = createAdaptiveIO([...pick("Ktoś się kręci", "Dalej"), ...pick("Wróć na mapę", "Czekaj")]);
  assert.deepEqual(await run(ctxOf(state, data, io)), { goto: "koniec_gry" });
  assert.match(strip(io.text()), /Pielgrzym mamrocze/);
  assert.equal(state.flags.pielgrzym_byl, true);
  assert.equal(state.world.map, null);
});

test("zapis w menu miejsc zachowuje wylosowanego gościa", async () => {
  const { data, state } = world();
  const ctx = ctxOf(state, data, createAdaptiveIO([]));
  await assert.rejects(run(ctx), InputExhaustedError);
  assert.equal(state.world.map.visitor, "pielgrzym");
  await saveGame("1", state, ctx.rng);
  const loaded = await loadGame("1", data);
  assert.equal(loaded.world.map.visitor, "pielgrzym");
  const io = createAdaptiveIO(pick("Wróć na mapę", "Czekaj"));
  await run(ctxOf(loaded, data, io));
  assert.match(strip(io.text()), /Ktoś się kręci/);
});
