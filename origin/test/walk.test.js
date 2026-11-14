import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState, createAdaptiveIO, tmpDir } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { validateData } from "../src/engine/data.js";
import { walkMinutes, rollLocalEvent } from "../src/systems/travel.js";
import { walk } from "../src/scenes/walk.js";
import { repairQuestState } from "../src/systems/quests.js";
import { saveGame, loadGame } from "../src/engine/save.js";

const fixed = (k) => ({ int: () => k });
let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

const SZMER = { id: "szmer", kind: "encounter", weight: 1, scenes: [{ id: "szmer_1", type: "narration", text: "Coś szeleści w krzakach.", time: 10, goto: "koniec" }] };

function world(edit = () => {}) {
  const data = structuredClone(minimalData());
  data.travel.locations.push({ id: "las", name: "Las", short: "Las", region: "pogorze", near: { minutes: 40 }, danger: 2 });
  data.travel.locations.push({ id: "jar", name: "Jar", short: "Jar", region: "pogorze", near: { minutes: 30 }, danger: 3 });
  data.maps = { ...data.maps, pogorze: "{wilczy_brod} {las} {jar} {wilczy_las} {stary_mlyn} {trakt_kupiecki} {lesniczowka} {ruiny_straznicy}" };
  data.story = { start: "mapa", scenes: [{ id: "mapa", type: "narration", text: "x" }] };
  data.travel.events = [SZMER];
  data.rules.travel.localEventChance = 0;
  data.rules.travel.localDangerBonus = 20;
  edit(data);
  const state = createNewState({ seed: 1, startScene: "mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 9 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  state.world.map = { hub: "wilczy_brod", phase: "walk", quest: null, questScene: null, spot: null, walk: null };
  return { data, state };
}
const ctxOf = (state, data, io, seed = 3) => ({ state, data, io, rng: createRng(seed), debug: false, notices: [] });

test("walkMinutes: hub↔bliska, bliska↔bliska, bez ruchu", () => {
  const { data } = world();
  assert.equal(walkMinutes(data, "wilczy_brod", "las"), 40);
  assert.equal(walkMinutes(data, "las", "wilczy_brod"), 40);
  assert.equal(walkMinutes(data, "las", "jar"), 70);
  assert.equal(walkMinutes(data, "las", "las"), 0);
});

test("rollLocalEvent: szansa 0 → null, 100 → zdarzenie; tylko encounter/attack bez endsTrip; danger ≥ 3 podnosi szansę; once pomijane", () => {
  const { data, state } = world();
  assert.equal(rollLocalEvent(state, data, fixed(1), 1), null);
  data.rules.travel.localEventChance = 100;
  assert.equal(rollLocalEvent(state, data, fixed(1), 1), "szmer");
  data.travel.events = [{ ...SZMER, kind: "story" }, { ...SZMER, id: "k", kind: "weather", phenomenon: "x" }, { ...SZMER, id: "e", endsTrip: true }];
  assert.equal(rollLocalEvent(state, data, fixed(1), 1), null);
  data.travel.events = [SZMER];
  data.rules.travel.localEventChance = 10;
  assert.equal(rollLocalEvent(state, data, fixed(25), 2), null);
  assert.equal(rollLocalEvent(state, data, fixed(25), 3), "szmer");
  data.rules.travel.localEventChance = 100;
  data.travel.events = [{ ...SZMER, once: true }];
  state.world.eventsSeen.push("szmer");
  assert.equal(rollLocalEvent(state, data, fixed(1), 1), null);
});

test("walk bez zdarzenia: czas = walkMinutes, lokacja = cel, brak podróży", async () => {
  const { data, state } = world();
  const before = state.time.minutes;
  await walk(ctxOf(state, data, createAdaptiveIO([])), "las");
  assert.equal(state.time.minutes - before, 40);
  assert.equal(state.world.location, "las");
  assert.equal(state.world.travel, null);
  assert.equal(state.world.map.walk, null);
});

test("walk ze zdarzeniem: minuty + czas sceny, zdarzenie raz", async () => {
  const { data, state } = world((d) => { d.rules.travel.localEventChance = 100; });
  const before = state.time.minutes;
  const io = createAdaptiveIO([""]);
  await walk(ctxOf(state, data, io), "las");
  assert.equal(state.time.minutes - before, 50);
  assert.equal(state.world.location, "las");
  assert.equal((io.text().match(/szeleści/g) ?? []).length, 1);
});

test("zapis w trakcie zdarzenia wznawia walk bez liczenia pierwszej połowy drugi raz", async () => {
  const { data, state } = world((d) => { d.rules.travel.localEventChance = 100; });
  const before = state.time.minutes;
  const first = createAdaptiveIO(["^C"]); // interrupted at the event scene
  await assert.rejects(walk(ctxOf(state, data, first), "las"));
  assert.equal(state.world.map.walk.step, 1);
  await saveGame("1", state, createRng(1));
  const back = await loadGame("1", data);
  await walk(ctxOf(back, data, createAdaptiveIO([""])), "las");
  assert.equal(back.time.minutes - before, 50);
  assert.equal(back.world.location, "las");
});

test("repairQuestState: walk do nieznanej lokacji znika, faza wraca do choose", () => {
  const { data, state } = world();
  state.world.map.walk = { to: "duch", step: 0, left: 0, event: null, eventScene: null };
  repairQuestState(state, data);
  assert.equal(state.world.map.walk, null);
  assert.equal(state.world.map.phase, "choose");
});

test("rules.json: localEventChance 101 to błąd walidacji", () => {
  const { data } = world((d) => { d.rules.travel.localEventChance = 101; });
  assert.ok(validateData(data).some((m) => /localEventChance/.test(m)));
});
