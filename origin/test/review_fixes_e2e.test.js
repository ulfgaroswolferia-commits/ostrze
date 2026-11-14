import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState, createAdaptiveIO, tmpDir } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { loadData, validateData } from "../src/engine/data.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { startQuest, boardQuests, repairQuestState } from "../src/systems/quests.js";
import { walk } from "../src/scenes/walk.js";
import { passKey } from "../src/systems/travel.js";
import { runActions } from "../src/systems/actions.js";

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

const real = await loadData();
const hero = (data) => {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character; state.inventory = cs.inventory;
  state.time.minutes = 12 * 60;
  state.world.phenomenonRolledDay = 99;
  return state;
};
const lowRng = { int: (lo) => lo, setState() {}, getState: () => 0 };

test("M2: zapis ze środka huba bez wątku głównego dostaje go po wczytaniu mapy", async () => {
  const state = hero(real);
  state.world.location = "wilczy_brod";
  state.world.map = { hub: "wilczy_brod", phase: "place", quest: null, questScene: null, spot: null, spotScene: null, walk: null, visitor: null, far: null };
  assert.equal(state.quests.watek_wilczy_brod, undefined);
  const scene = real.story.scenes.find((s) => s.id === "demo_mapa");
  await assert.rejects(defaultHandlers.map({ state, data: real, io: createAdaptiveIO([]), rng: lowRng, debug: false, notices: [] }, scene), InputExhaustedError);
  assert.equal(state.quests.watek_wilczy_brod.status, "active");
});

test("M2: porzucony albo ukończony wątek nie startuje drugi raz", async () => {
  const state = hero(real);
  state.world.location = "wilczy_brod";
  state.quests.watek_wilczy_brod = { status: "failed", acceptedAt: 0, deadline: null, departed: true, done: [] };
  const scene = real.story.scenes.find((s) => s.id === "demo_mapa");
  await assert.rejects(defaultHandlers.map({ state, data: real, io: createAdaptiveIO([]), rng: lowRng, debug: false, notices: [] }, scene), InputExhaustedError);
  assert.equal(state.quests.watek_wilczy_brod.status, "failed");
});

test("M3: tablica ogłoszeń nie liczy wątku głównego do limitu zleceń", () => {
  const data = structuredClone(real);
  data.rules.quests.maxActive = 3;
  const state = hero(data);
  data.quests.push({ id: "tablica_test", kind: "errand", name: "Zlecenie z tablicy", hub: "wilczy_brod", description: "Probne.", board: true, objectives: [{ id: "o", text: "Zrób.", at: "wilczy_brod", done: { flag: "tablica_test_zrobione" } }], onComplete: [{ xp: 5 }] });
  startQuest(state, data, "watek_wilczy_brod");
  const others = data.quests.filter((q) => q.kind === "errand" && !q.main && !q.board).slice(0, 2);
  assert.equal(boardQuests(state, data, "wilczy_brod").length, 1, "tablica pokazuje zlecenie przy pustym dzienniku");
  for (const q of others) startQuest(state, data, q.id);
  assert.ok(boardQuests(state, data, "wilczy_brod").length >= 1, "wątek zajął miejsce na tablicy");
});

test("M4: exitWhen w trakcie dalekiej podróży czyści trasę, a naprawa fazy far czyści ją też", async () => {
  const data = structuredClone(minimalData());
  data.story = { start: "mapa", scenes: [
    { id: "mapa", type: "map", hub: "wilczy_brod", title: "Brod", main: { label: "Dalej", goto: "koniec_gry" }, exitWhen: { if: { flag: "koniec_aktu" }, goto: "koniec_gry" } },
    { id: "koniec_gry", type: "ending", text: "Koniec." },
  ] };
  const state = hero(data);
  state.world.location = "wilczy_brod";
  state.world.travel = { route: "brzezina_wilczy_brod", day: 2, daysTotal: 2, phase: "camp", event: null, eventHour: null, eventScene: null, hoursWalked: 0, slowHours: 0, slowBy: null, dangerous: false, delayed: false, foraged: false, reverse: false, quest: null, turnBack: false };
  state.world.map = { hub: "wilczy_brod", phase: "far", quest: null, questScene: null, spot: null, spotScene: null, walk: null, visitor: null, far: { route: "brzezina_wilczy_brod", reverse: false } };
  state.flags.koniec_aktu = true;
  await defaultHandlers.map({ state, data, io: createAdaptiveIO([]), rng: lowRng, debug: false, notices: [] }, data.story.scenes[0]);
  assert.equal(state.world.travel, null, "exitWhen nie zostawia starej trasy");

  const broken = hero(data);
  broken.world.travel = { route: "wilczy_brod_nora", day: 1, daysTotal: 1, phase: "depart" };
  broken.world.map = { hub: "wilczy_brod", phase: "far", quest: null, questScene: null, spot: null, spotScene: null, walk: null, visitor: null, far: { route: "nie_ma", reverse: false } };
  repairQuestState(broken, data);
  assert.equal(broken.world.map.phase, "choose");
  assert.equal(broken.world.travel, null, "naprawa fazy far nie zostawia trasy");
});

test("M5: dalekie miejsce musi mieć trasę z huba sceny mapy, nie z dowolnego miejsca bez near", () => {
  const data = structuredClone(real);
  const far = data.travel.locations.find((l) => l.id === "ostoja_zbojcow");
  const route = data.travel.routes.find((r) => r.id === far.far.route);
  route.from = "wilcza_nora"; // a place without near/far, but no hub of any map scene
  assert.ok(validateData(data).some((m) => /far\.route/.test(m) && /hub/.test(m)));
  route.from = "wilczy_brod";
  assert.deepEqual(validateData(data), []);
});

test("M6: szansa zdarzenia na spacerze jest ta sama w obie strony (liczy się groźniejszy koniec)", async () => {
  const data = structuredClone(minimalData());
  data.rules.travel.localEventChance = 0;
  data.rules.travel.localDangerBonus = 100; // danger ≥ 3 at either end makes the event certain
  data.travel.locations.push({ id: "mroczna", name: "Mroczna", short: "Mroczna", region: "pogorze", near: { minutes: 30 }, danger: 4 });
  data.maps = { ...data.maps, pogorze: `${data.maps.pogorze}\n{mroczna}` };
  data.travel.events = [{ id: "szmer", kind: "encounter", weight: 1, scenes: [{ id: "szmer_1", type: "narration", text: "Szmer.", time: 5, goto: "koniec" }] }];
  data.story = { start: "mapa", scenes: [{ id: "mapa", type: "narration", text: "x" }] };
  for (const [from, to] of [["wilczy_brod", "mroczna"], ["mroczna", "wilczy_brod"]]) {
    const state = hero(data);
    state.world.location = from;
    state.world.map = { hub: "wilczy_brod", phase: "walk", quest: null, questScene: null, spot: null, walk: null };
    const io = createAdaptiveIO([""]);
    await walk({ state, data, io, rng: createRng(5), debug: false, notices: [] }, to);
    assert.match(io.text(), /Szmer/, `${from}→${to}: zdarzenie powinno się zdarzyć`);
    assert.equal(state.world.passes[passKey(from, to)], 1);
  }
});

test("M7: jednorazowe znalezisko, którego nie dało się unieść, nie przepada na zawsze", async () => {
  const data = structuredClone(real);
  data.loot.tables.push({ id: "ciezar_test", entries: [{ item: "polpancerz", qty: 1, weight: 1 }] });
  const ev = { id: "znaleziona_zbroja", kind: "encounter", weight: 1, once: true, scenes: [{ id: "zz_dlg", type: "dialogue", dialogue: "znal_zbroja", goto: "koniec" }] };
  data.dialogues.push({ id: "znal_zbroja", start: "s", nodes: { s: { speaker: "Droga", text: "Leży tu zbroja, i to niemała.", options: [{ id: "ok", text: "Zabierz.", goto: "end" }], actions: [{ giveRandom: "ciezar_test" }] } } });
  data.travel.events = [ev];
  data.rules.travel.localEventChance = 100;
  data.story = { start: "mapa", scenes: [{ id: "mapa", type: "narration", text: "x" }] };
  const heavy = hero(data);
  heavy.world.location = "wilczy_brod";
  heavy.world.map = { hub: "wilczy_brod", phase: "walk", quest: null, questScene: null, spot: null, walk: null };
  heavy.inventory.items.push({ id: "kolczuga", qty: 40 });
  await walk({ state: heavy, data, io: createAdaptiveIO([{ pick: "Zabierz" }, ""]), rng: lowRng, debug: false, notices: [] }, "stary_mlyn").catch(() => {});
  assert.equal(heavy.world.eventsSeen.includes("znaleziona_zbroja"), false, "znalezisko wraca, gdy gracz zrobi miejsce");

  const light = hero(data);
  light.world.location = "wilczy_brod";
  light.world.map = { hub: "wilczy_brod", phase: "walk", quest: null, questScene: null, spot: null, walk: null };
  await walk({ state: light, data, io: createAdaptiveIO([{ pick: "Zabierz" }, ""]), rng: lowRng, debug: false, notices: [] }, "stary_mlyn").catch(() => {});
  assert.equal(light.world.eventsSeen.includes("znaleziona_zbroja"), true, "unesione znalezisko zużywa zdarzenie");
  void runActions;
});
