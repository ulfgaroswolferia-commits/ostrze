import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState, tmpDir, createAdaptiveIO } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { validateData } from "../src/engine/data.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { destinationEntries } from "../src/ui/map_screen.js";
import { revealPlace } from "../src/systems/places.js";
import { startQuest } from "../src/systems/quests.js";
import { farTrip } from "../src/systems/travel.js";

const H = 60;
const DAY = 24 * H;
const SLEEP = ["1+++", "2", ""];
/** One quiet stage: departure, summary, pitch camp, sleep. */
const STAGE = ["", ""]; // a quiet first day: the departure and "Idź dalej"
const NEXT_DAY = [""]; // a quiet next day: no departure screen, only "Idź dalej"
const MAP = { id: "mapa", type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Dalej", goto: "koniec_gry" } };

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

const OSTOJA = { id: "ostoja_t", name: "Ostoja zbójców", short: "Ostoja", region: "pogorze", far: { route: "wilczy_brod_ostoja_t" }, danger: 3 };
const ROUTE = { id: "wilczy_brod_ostoja_t", from: "wilczy_brod", to: "ostoja_t", days: 2, region: "pogorze" };

function farData(edit = () => {}) {
  const d = structuredClone(minimalData());
  d.rules.travel.eventChance = 0;
  d.rules.travel.dangerousEventChance = 0;
  d.travel.locations.push(structuredClone(OSTOJA));
  d.travel.routes.push(structuredClone(ROUTE));
  d.maps = { ...d.maps, pogorze: `${d.maps.pogorze}\n{ostoja_t}` };
  d.story = { start: "mapa", scenes: [MAP, { id: "koniec_gry", type: "ending", text: "Koniec." }] };
  edit(d);
  return d;
}
/** The same world for the map-scene tests: the hub has no spots, so the scene opens on the destinations. */
function gameData() {
  return farData((d) => { delete d.travel.locations.find((l) => l.id === "wilczy_brod").spots; });
}
function hubState(data) {
  const s = createNewState({ seed: 1, startScene: "mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 9 * H;
  s.world.phenomenonRolledDay = 99;
  s.world.location = "wilczy_brod";
  return s;
}
const ctxOf = (state, data, io, seed = 3) => ({ state, data, io, rng: createRng(seed), debug: false, notices: [] });
const run = (ctx) => defaultHandlers.map(ctx, MAP);

test("far: dane przechodzą walidację", () => {
  assert.deepEqual(validateData(farData()), []);
  assert.deepEqual(farTrip(farData(), "ostoja_t"), { route: "wilczy_brod_ostoja_t", days: 2 });
});

test("far: walidacja – wyklucza się z near, trasa musi pasować, limit dni, start w hubie", () => {
  const err = (edit) => validateData(farData(edit)).join("\n");
  assert.match(err((d) => { d.travel.locations.find((l) => l.id === "ostoja_t").near = { minutes: 30 }; }), /far/);
  assert.match(err((d) => { d.travel.routes.find((r) => r.id === "wilczy_brod_ostoja_t").to = "wilcza_nora"; }), /far\.route/);
  assert.match(err((d) => { d.travel.locations.find((l) => l.id === "ostoja_t").far.route = "nie_ma"; }), /nie_ma/);
  assert.match(err((d) => { d.travel.routes.find((r) => r.id === "wilczy_brod_ostoja_t").days = 5; }), /dni/);
  assert.match(err((d) => { d.travel.routes.find((r) => r.id === "wilczy_brod_ostoja_t").from = "stary_mlyn"; }), /far\.route/);
  assert.match(err((d) => { d.travel.routes.find((r) => r.id === "wilczy_brod_ostoja_t").region = "glusz"; }), /far\.route/);
});

test("far: z huba widać dalekie miejsce z liczbą dni; sekretne dopiero po ujawnieniu", () => {
  const data = farData((d) => { Object.assign(d.travel.locations.find((l) => l.id === "ostoja_t"), { secret: true, hint: "dym za lasem" }); });
  const state = hubState(data);
  assert.equal(destinationEntries(state, data, "wilczy_brod").some((e) => e.id === "ostoja_t"), false);
  revealPlace(state, data, "ostoja_t");
  const entry = destinationEntries(state, data, "wilczy_brod").find((e) => e.id === "ostoja_t");
  assert.equal(entry.kind, "far");
  assert.equal(entry.days, 2);
  assert.equal(entry.reverse, false);
  assert.match(entry.label, /2 dni/);
});

test("far: w dalekim miejscu, gdy innych dalekich się nie zna, jedyny cel to powrót do huba", () => {
  const data = farData();
  const state = hubState(data);
  state.world.location = "ostoja_t";
  const entries = destinationEntries(state, data, "wilczy_brod");
  assert.equal(entries.length, 1);
  assert.deepEqual([entries[0].kind, entries[0].id, entries[0].reverse, entries[0].days], ["far", "wilczy_brod", true, 2]);
});

test("far: wyprawa tam i z powrotem – dwa dni w każdą stronę, zlecenia huba zostają", async () => {
  const data = gameData();
  const state = hubState(data);
  startQuest(state, data, "wilcza_nora");
  const before = state.time.minutes;
  const there = createAdaptiveIO(["1", ...STAGE, ...NEXT_DAY]);
  await assert.rejects(run(ctxOf(state, data, there)), InputExhaustedError);
  assert.equal(state.world.location, "ostoja_t");
  assert.equal(state.world.travel, null);
  assert.ok(state.time.minutes - before >= 2 * DAY - 9 * H + 6 * H, "dwa dni drogi");
  assert.equal(state.world.map.phase, "choose");
  const back = createAdaptiveIO(["1", ...STAGE, ...NEXT_DAY]);
  await assert.rejects(run(ctxOf(state, data, back)), InputExhaustedError);
  assert.equal(state.world.location, "wilczy_brod");
  assert.equal(state.quests.wilcza_nora.status, "active");
});

test("far: zapis w środku podróży wznawia się bez utraty dnia", async () => {
  const data = gameData();
  const state = hubState(data);
  const first = createAdaptiveIO(["1", ...STAGE, "^C"]); // interrupted in the evening of day 2
  await assert.rejects(run(ctxOf(state, data, first)));
  assert.equal(state.world.map.phase, "far");
  assert.equal(state.world.travel.day, 2);
  await saveGame("1", state, createRng(1));
  const back = await loadGame("1", data);
  assert.equal(back.world.map.phase, "far");
  const rest = createAdaptiveIO(NEXT_DAY);
  await assert.rejects(run(ctxOf(back, data, rest)), InputExhaustedError);
  assert.equal(back.world.location, "ostoja_t");
});

test("far: ze zwykłego miejsca huba też widać dalekie szlaki – najpierw droga do huba, potem wyprawa", async () => {
  const data = gameData();
  const state = hubState(data);
  state.world.location = "stary_mlyn";
  const entries = destinationEntries(state, data, "wilczy_brod");
  const index = entries.findIndex((e) => e.id === "ostoja_t");
  assert.ok(index >= 0, entries.map((e) => e.label).join("|"));
  assert.equal(entries[index].kind, "far");
  assert.equal(entries[index].viaHub, true);
  assert.match(entries[index].label, /2 dni/);
  const before = state.time.minutes;
  const io = createAdaptiveIO([String(index + 1), ...STAGE, ...NEXT_DAY]);
  await assert.rejects(run(ctxOf(state, data, io)), InputExhaustedError);
  assert.equal(state.world.location, "ostoja_t");
  assert.ok(state.time.minutes - before >= 35 + 2 * DAY - 9 * H, "dojście do huba i dwa dni drogi");
});

test("far: z dalekiego miejsca nadal tylko powrót; w hubie wyprawa bez dojścia", () => {
  const data = farData();
  const state = hubState(data);
  assert.equal(destinationEntries(state, data, "wilczy_brod").find((e) => e.id === "ostoja_t").viaHub, undefined);
  state.world.location = "ostoja_t";
  assert.equal(destinationEntries(state, data, "wilczy_brod").length, 1);
});
