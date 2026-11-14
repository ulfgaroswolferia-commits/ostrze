import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState, createAdaptiveIO, tmpDir } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { rollLocalEvents, passKey } from "../src/systems/travel.js";
import { walk } from "../src/scenes/walk.js";
import { saveGame, loadGame } from "../src/engine/save.js";

const fixed = (k) => ({ int: () => k });
let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

const ev = (id, text) => ({ id, kind: "encounter", weight: 1, scenes: [{ id: `${id}_1`, type: "narration", text, time: 10, goto: "koniec" }] });
const SZMER = ev("szmer", "Coś szeleści w krzakach.");
const SZELEST = ev("szelest", "Ktoś gwiżdże za wzgórzem.");

function world(edit = () => {}) {
  const data = structuredClone(minimalData());
  data.travel.locations.push({ id: "dal", name: "Dal", short: "Dal", region: "pogorze", near: { minutes: 300 }, danger: 1 });
  data.travel.locations.push({ id: "las", name: "Las", short: "Las", region: "pogorze", near: { minutes: 60 }, danger: 1 });
  data.maps = { ...data.maps, pogorze: "{wilczy_brod} {dal} {las} {wilczy_las} {stary_mlyn} {trakt_kupiecki} {lesniczowka} {ruiny_straznicy}" };
  data.story = { start: "mapa", scenes: [{ id: "mapa", type: "narration", text: "x" }] };
  data.travel.events = [SZMER, SZELEST];
  data.rules.travel.localEventChance = 100;
  edit(data);
  const state = createNewState({ seed: 1, startScene: "mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 8 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  state.world.map = { hub: "wilczy_brod", phase: "walk", quest: null, questScene: null, spot: null, walk: null };
  return { data, state };
}
const ctxOf = (state, data, io, seed = 3) => ({ state, data, io, rng: createRng(seed), debug: false, notices: [] });
const count = (text, needle) => (text.match(new RegExp(needle, "g")) ?? []).length;

test("rollLocalEvents: spacer 300 min próbuje dwa razy, 60 min raz, nigdy więcej niż walkMaxEvents", () => {
  const { data, state } = world();
  assert.deepEqual(rollLocalEvents(state, data, fixed(1), 1, 300, "k"), ["szmer", "szelest"]);
  assert.equal(rollLocalEvents(state, data, fixed(1), 1, 60, "k").length, 1);
  assert.equal(rollLocalEvents(state, data, fixed(1), 1, 119, "k").length, 1);
  data.travel.events = [SZMER, SZELEST, ev("trzeci", "Trzeci."), ev("czwarty", "Czwarty.")];
  assert.equal(rollLocalEvents(state, data, fixed(1), 1, 2000, "k").length, 3);
});

test("rollLocalEvents: szansa maleje z przejściami tej trasy, ale zostaje próg", () => {
  const { data, state } = world((d) => { d.rules.travel.localEventChance = 25; });
  assert.equal(rollLocalEvents(state, data, fixed(25), 1, 60, "k").length, 1); // 25 ≤ 25
  state.world.passes = { k: 1 };
  assert.equal(rollLocalEvents(state, data, fixed(25), 1, 60, "k").length, 0); // 20
  state.world.passes = { k: 40 };
  assert.equal(rollLocalEvents(state, data, fixed(15), 1, 60, "k").length, 1); // próg 15%
  assert.equal(rollLocalEvents(state, data, fixed(16), 1, 60, "k").length, 0);
});

test("walk 300 min: dwa zdarzenia, czas = marsz + sceny, licznik przejść", async () => {
  const { data, state } = world();
  const before = state.time.minutes;
  const io = createAdaptiveIO(["", ""]);
  await walk(ctxOf(state, data, io), "dal");
  assert.equal(state.time.minutes - before, 320);
  assert.equal(state.world.location, "dal");
  assert.equal(count(io.text(), "szeleści"), 1);
  assert.equal(count(io.text(), "gwiżdże"), 1);
  assert.equal(state.world.map.walk, null);
  assert.equal(state.world.passes[passKey("wilczy_brod", "dal")], 1);
});

test("zapis w drugim zdarzeniu wznawia walk bez ponownego losowania i bez podwójnego czasu", async () => {
  const { data, state } = world();
  const before = state.time.minutes;
  const first = createAdaptiveIO(["", "^C"]);
  await assert.rejects(walk(ctxOf(state, data, first), "dal"));
  const w = state.world.map.walk;
  assert.deepEqual(w.events, ["szmer", "szelest"]);
  assert.equal(w.step, 3);
  await saveGame("1", state, createRng(1));
  const back = await loadGame("1", data);
  const io = createAdaptiveIO([""]);
  await walk(ctxOf(back, data, io), "dal");
  assert.equal(back.time.minutes - before, 320);
  assert.equal(back.world.location, "dal");
  assert.equal(count(io.text(), "szeleści"), 0);
  assert.equal(count(io.text(), "gwiżdże"), 1);
});

test("walk bez zdarzeń nadal zajmuje czas trasy i liczy przejście", async () => {
  const { data, state } = world((d) => { d.rules.travel.localEventChance = 0; });
  const before = state.time.minutes;
  await walk(ctxOf(state, data, createAdaptiveIO([])), "las");
  await walk(ctxOf(state, data, createAdaptiveIO([])), "wilczy_brod").catch(() => {});
  assert.ok(state.time.minutes - before >= 60);
  assert.ok(state.world.passes[passKey("wilczy_brod", "las")] >= 1);
});
