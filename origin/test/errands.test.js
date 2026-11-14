import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState } from "./helpers.js";
import { validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { addItem, removeItem } from "../src/systems/inventory.js";
import { revealPlace } from "../src/systems/places.js";
import {
  startQuest, errandProgress, advanceErrands, canStartQuest, currentObjectives, mapOptions, abandonHub, repairQuestState, tripQuests, questById,
} from "../src/systems/quests.js";
import { defaultAfterScene } from "../src/scenes/after.js";
import { createSceneList, runScenes } from "../src/engine/loop.js";
import { renderJournal } from "../src/ui/journal_screen.js";
import { createAdaptiveIO } from "./helpers.js";
import { createRng } from "../src/engine/dice.js";

const strip = (s) => stripVTControlCharacters(s);
const fixed = (k) => ({ int: () => k });

const ERRAND = {
  id: "list_dla_kowala", kind: "errand", name: "List dla kowala", hub: "wilczy_brod", description: "Zanieś list.", deadlineDays: null,
  requires: { known: "las" },
  objectives: [
    { id: "odbierz", text: "Odbierz prowiant.", at: "wilczy_brod", done: { item: "prowiant" } },
    { id: "oddaj", text: "Oddaj go.", at: "las.polana", done: { flag: "oddano" } },
  ],
  onComplete: [{ giveMoney: 8 }, { xp: 10 }],
};
function world(edit = () => {}) {
  const data = structuredClone(minimalData());
  data.travel.locations.push({ id: "las", name: "Las", short: "Las", region: "pogorze", secret: true, near: { minutes: 40 }, spots: [{ id: "polana", name: "Polana", type: "rest" }] });
  data.maps = { ...data.maps, pogorze: "{wilczy_brod} {las} {wilczy_las} {stary_mlyn} {trakt_kupiecki} {lesniczowka} {ruiny_straznicy}" };
  data.quests.push(structuredClone(ERRAND));
  edit(data);
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  removeItem(state, data, "prowiant", 99);
  return { data, state };
}
const errs = (edit) => validateData(world(edit).data);
const has = (list, re) => assert.ok(list.some((m) => re.test(m)), `brak ${re}\n${list.join("\n")}`);
const mine = (d) => d.quests.find((x) => x.id === ERRAND.id);

test("walidacja errand: cel bez at, at nieznane, done zły, powtórzone id, pusta lista, onComplete zły, pola wyprawy", () => {
  assert.deepEqual(errs(), []);
  has(errs((d) => { delete mine(d).objectives[0].at; }), /list_dla_kowala.*at/);
  has(errs((d) => { mine(d).objectives[0].at = "nigdzie"; }), /at.*nieznane miejsce/);
  has(errs((d) => { mine(d).objectives[0].done = { zly: 1 }; }), /nieznany warunek/);
  has(errs((d) => { mine(d).objectives[1].id = "odbierz"; }), /zduplikowane id celu/);
  has(errs((d) => { mine(d).objectives = []; }), /objectives/);
  has(errs((d) => { mine(d).onComplete = [{ nic: 1 }]; }), /nieznana akcja/);
  has(errs((d) => { mine(d).route = "x"; }), /route/);
  has(errs((d) => { mine(d).requires = { known: "nic" }; }), /nieznane miejsce/);
});

test("errandProgress i zatrzask: cel zaliczony zostaje po utracie przedmiotu", () => {
  const { data, state } = world();
  startQuest(state, data, ERRAND.id);
  const quest = questById(data, ERRAND.id);
  assert.equal(errandProgress(state, data, quest).current.id, "odbierz");
  addItem(state, data, "prowiant", 1);
  advanceErrands(state, data, fixed(1));
  assert.deepEqual(state.quests[ERRAND.id].done, ["odbierz"]);
  removeItem(state, data, "prowiant", 1);
  advanceErrands(state, data, fixed(1));
  const p = errandProgress(state, data, quest);
  assert.deepEqual(p.objectives.map((o) => o.done), [true, false]);
  assert.equal(p.current.id, "oddaj");
  assert.deepEqual(currentObjectives(state, data).map((c) => [c.quest.id, c.objective.at]), [[ERRAND.id, "las.polana"]]);
});

test("cel „z góry” i ukończenie w jednym kroku: onComplete raz, drugi przebieg nic nie zmienia", () => {
  const { data, state } = world();
  addItem(state, data, "prowiant", 1);
  state.flags.oddano = true;
  startQuest(state, data, ERRAND.id);
  const money = state.character.money;
  const events = advanceErrands(state, data, fixed(1));
  assert.equal(state.quests[ERRAND.id].status, "done");
  assert.equal(state.character.money, money + 8);
  assert.ok(events.some((e) => e.type === "zadanie_wykonane"));
  assert.deepEqual(advanceErrands(state, data, fixed(1)), []);
  assert.equal(state.character.money, money + 8);
});

test("łańcuch: onComplete startuje następne zlecenie, którego cel jest spełniony", () => {
  const { data, state } = world((d) => {
    mine(d).onComplete = [{ startQuest: "drugie" }];
    d.quests.push({ ...structuredClone(ERRAND), id: "drugie", name: "Drugie", requires: undefined, objectives: [{ id: "x", text: "x", at: "wilczy_brod", done: { flag: "oddano" } }], onComplete: [] });
    delete d.quests.at(-1).requires;
  });
  addItem(state, data, "prowiant", 1);
  state.flags.oddano = true;
  startQuest(state, data, ERRAND.id);
  advanceErrands(state, data, fixed(1));
  assert.equal(state.quests[ERRAND.id].status, "done");
  assert.equal(state.quests.drugie.status, "done");
});

test("canStartQuest: requires, limit i powtórne podjęcie", () => {
  const { data, state } = world();
  assert.equal(canStartQuest(state, data, ERRAND.id), false);
  revealPlace(state, data, "las");
  assert.equal(canStartQuest(state, data, ERRAND.id), true);
  startQuest(state, data, ERRAND.id);
  assert.equal(canStartQuest(state, data, ERRAND.id), false);
  const full = world((d) => { d.rules.quests.maxActive = 1; });
  revealPlace(full.state, full.data, "las");
  startQuest(full.state, full.data, "wilcza_nora");
  assert.equal(canStartQuest(full.state, full.data, ERRAND.id), false);
});

test("errand nie jest wyprawą: mapOptions i abandonHub go pomijają", () => {
  const { data, state } = world();
  startQuest(state, data, ERRAND.id);
  assert.deepEqual(mapOptions(state, data, "wilczy_brod"), []);
  assert.deepEqual(tripQuests(state, data, "wilczy_brod"), []);
  assert.deepEqual(abandonHub(state, data, "wilczy_brod"), []);
  assert.equal(state.quests[ERRAND.id].status, "active");
});

test("hook po scenie kończy zlecenie, gdy scena ustawi flagę", async () => {
  const { data, state } = world();
  addItem(state, data, "prowiant", 1);
  startQuest(state, data, ERRAND.id);
  assert.ok(defaultAfterScene.length >= 2);
  const ctx = { state, data, io: createAdaptiveIO([""]), rng: createRng(1), debug: false, notices: [] };
  await runScenes(ctx, createSceneList([{ id: "s", type: "flag", set: { oddano: true } }]), "s");
  assert.equal(state.quests[ERRAND.id].status, "done");
});

test("dziennik pokazuje cele: ✓ wykonany, → bieżący z miejscem, · dalszy", () => {
  const { data, state } = world();
  addItem(state, data, "prowiant", 1);
  startQuest(state, data, ERRAND.id);
  advanceErrands(state, data, fixed(1));
  const text = renderJournal(state, data).map(strip).join("\n");
  assert.match(text, /List dla kowala/);
  assert.match(text, /✓ Odbierz prowiant\./);
  assert.match(text, /→ Oddaj go\. · Las – Polana/);
  const pending = world();
  startQuest(pending.state, pending.data, ERRAND.id);
  assert.match(renderJournal(pending.state, pending.data).map(strip).join("\n"), /· Oddaj go\./);
});

test("naprawa zapisu: nieznane id celu znika z done", () => {
  const { data, state } = world();
  startQuest(state, data, ERRAND.id);
  state.quests[ERRAND.id].done = ["odbierz", "duch"];
  repairQuestState(state, data);
  assert.deepEqual(state.quests[ERRAND.id].done, ["odbierz"]);
});
