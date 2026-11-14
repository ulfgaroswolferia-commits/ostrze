import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState, tmpDir, createAdaptiveIO } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { runTrip } from "../src/scenes/trip.js";
import { startTravel, rollStageEvent, endTravel } from "../src/systems/travel.js";
import { startQuest } from "../src/systems/quests.js";
import { renderDeparture } from "../src/ui/travel_screen.js";

const strip = (s) => stripVTControlCharacters(s);
const SLEEP = ["1+++", "2", ""];
let prevHome;
beforeEach(async () => {
  prevHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
});
afterEach(() => {
  if (prevHome === undefined) delete process.env.OSTRZE_HOME;
  else process.env.OSTRZE_HOME = prevHome;
});

/** Rng answering `int` from `values` in order; throws when asked for more. */
function scripted(values = []) {
  const queue = [...values];
  return { int(min, max) {
    if (queue.length === 0) throw new Error(`rng: nieoczekiwany rzut int(${min}, ${max})`);
    return queue.shift();
  }, left: () => queue.length };
}
function quietData(patch = () => {}) {
  const d = structuredClone(minimalData());
  d.rules.travel.eventChance = 0;
  d.rules.travel.dangerousEventChance = 0;
  patch(d);
  return d;
}
function hero(data, location) {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 9 * 60;
  s.world.phenomenonRolledDay = 99;
  s.world.location = location;
  return s;
}
const ctxOf = (state, data, io) => ({ state, data, io, rng: createRng(5), debug: false, notices: [] });

test("runTrip w odwrotnym kierunku: start w celu trasy, koniec na jej początku; ekran odwrócony", async () => {
  const data = quietData();
  const state = hero(data, "wilcza_nora");
  startTravel(state, data, "wilczy_brod_nora", { reverse: true });
  const dep = renderDeparture(state, data).map(strip);
  assert.ok(dep.includes("Droga: Wilcza Nora → Strażnica Wilczy Bród"), dep.join("\n"));
  assert.ok(dep.includes("Wilcza Nora ──●── Wilczy Bród"), dep.join("\n"));
  state.world.travel = null;
  const ctx = ctxOf(state, data, createScriptedIO(["", ""]));
  await runTrip(ctx, { route: "wilczy_brod_nora", reverse: true });
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  assert.equal(state.world.location, "wilczy_brod");
  assert.equal(state.world.travel, null);
});

test("startTravel: kierunek i zadanie zapisane; zły punkt startu rzuca", () => {
  const data = minimalData();
  const s = hero(data, "wilczy_brod");
  startTravel(s, data, "wilczy_brod_przelecz", { quest: "eskorta_ostromira" });
  assert.equal(s.world.travel.reverse, false);
  assert.equal(s.world.travel.quest, "eskorta_ostromira");
  assert.equal(s.world.travel.turnBack, false);
  endTravel(s, data);
  assert.equal(s.world.location, "kamienna_przelecz");
  assert.throws(() => startTravel(s, data, "wilczy_brod_przelecz"), /kamienna_przelecz/);
  startTravel(s, data, "wilczy_brod_przelecz", { reverse: true, quest: "eskorta_ostromira" });
  endTravel(s, data);
  assert.equal(s.world.location, "wilczy_brod");
});

test("rollStageEvent w wyprawie: bez zdarzeń stałych, szansa i pula zadania; w powrocie zwykła pula", () => {
  const data = minimalData();
  const s = hero(data, "wilczy_brod");
  startQuest(s, data, "eskorta_ostromira");
  startTravel(s, data, "wilczy_brod_przelecz", { quest: "eskorta_ostromira" });
  assert.deepEqual(rollStageEvent(s, data, scripted([50, 3, 4])), { id: "napad_na_woz", hour: 4 }, "szansa 50, pula tylko napad (waga 3)");
  assert.equal(rollStageEvent(s, data, scripted([51])), null);
  s.world.travel.reverse = true;
  const r = rollStageEvent(s, data, scripted([40, 15, 2]));
  assert.notEqual(r.id, "napad_na_woz");
  const plain = hero(data, "brzezina");
  startTravel(plain, data, "brzezina_wilczy_brod", { quest: "wilcza_nora" });
  assert.equal(rollStageEvent(plain, data, scripted([56])), null, "brak zdarzenia stałego bandytów w wyprawie");
});

test("porażka eskorty w drodze tam (ostatni dzień) – zawrócenie, powrót do punktu postoju, bez dotarcia do celu", async () => {
  const data = quietData((d) => { d.quests.find((q) => q.id === "eskorta_ostromira").eventChance = 100; });
  const state = hero(data, "wilczy_brod");
  startQuest(state, data, "eskorta_ostromira");
  // depart, ambush narration, the fight (flee), loss narration, Ostromir's word about going back, the evening
  const io = createAdaptiveIO(["", "", { fight: "flee" }, "", "", ""]);
  const ctx = ctxOf(state, data, io);
  await runTrip(ctx, { route: "wilczy_brod_przelecz", quest: "eskorta_ostromira" });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  const out = strip(io.text());
  assert.match(out, /Bez kupca Ostromira nie ma po co iść dalej – zawracasz\./);
  assert.equal(state.quests.eskorta_ostromira.status, "failed");
  assert.equal(state.world.location, "wilczy_brod");
  assert.equal(state.world.travel, null);
  assert.doesNotMatch(out, /Docierasz do: Kamienna Przełęcz/);
});

// --- E2a: endsTrip ---
function endData() {
  const d = quietData();
  d.travel.events.push({ id: "koniec_nocy", kind: "story", weight: 0, endsTrip: true, scenes: [{ id: "koniec_nocy_1", type: "narration", text: "Noc spada na szlak." }] });
  Object.assign(d.travel.routes.find((r) => r.id === "brzezina_wilczy_brod"), { fixed: { 2: "koniec_nocy" } });
  return d;
}

test("endsTrip: zdarzenie dnia 2 kończy podróż w celu, o świcie, bez obozu i podsumowania tego dnia", async () => {
  const data = endData();
  const state = hero(data, "brzezina");
  const ctx = ctxOf(state, data, createScriptedIO(["", "", "", "", "", "", ""]));
  await runTrip(ctx, { route: "brzezina_wilczy_brod" });
  assert.equal(state.world.location, "wilczy_brod");
  assert.equal(state.world.travel, null);
  assert.equal(state.time.minutes % 1440, data.rules.travel.departHour * 60);
  const out = strip(ctx.io.text());
  assert.match(out, /Noc spada na szlak\./);
  assert.ok(ctx.notices.some((n) => strip(n).includes("Docierasz do: Strażnica Wilczy Bród.")), ctx.notices.join("|")); // shown on the next screen
  assert.equal((out.match(new RegExp(data.ui["travel.goOn"], "g")) ?? []).length, 1, "obóz tylko pierwszego dnia");
});

test("endsTrip: ulewa na dniu 1 (daysTotal 3) – zdarzenie nadal kończy podróż w dniu 2", async () => {
  const data = endData();
  const state = hero(data, "brzezina");
  startTravel(state, data, "brzezina_wilczy_brod");
  state.world.travel.daysTotal = 3;
  const ctx = ctxOf(state, data, createScriptedIO(["", "", "", ...SLEEP, "", "", "", "", "", ""]));
  await runTrip(ctx, { route: "brzezina_wilczy_brod" });
  assert.equal(state.world.location, "wilczy_brod");
  assert.equal(state.world.travel, null);
});

test("endsTrip: wznowienie zapisu w trakcie zdarzenia (eventScene ustawione) też kończy podróż", async () => {
  const data = endData();
  const state = hero(data, "brzezina");
  startTravel(state, data, "brzezina_wilczy_brod");
  Object.assign(state.world.travel, { day: 2, phase: "event", event: "koniec_nocy", eventHour: 3, hoursWalked: 3, eventScene: "koniec_nocy_1" });
  const ctx = ctxOf(state, data, createScriptedIO(["", "", ""]));
  await runTrip(ctx, { route: "brzezina_wilczy_brod" });
  assert.equal(state.world.location, "wilczy_brod");
  assert.equal(state.world.travel, null);
});
