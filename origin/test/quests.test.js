import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData, validateData } from "../src/engine/data.js";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { eventById, locationById, routeById } from "../src/systems/travel.js";
import { questById, startQuest, completeQuest, failQuest, activeQuests, expireQuests, abandonHub, mapOptions, repairQuestState } from "../src/systems/quests.js";
import { defaultHandlers } from "../src/scenes/index.js";

const data = minimalData();
const expectErr = (errs, msg) => assert.ok(errs.some((e) => e.includes(msg)), `brak: ${msg}\n${errs.join("\n")}`);
const withQuests = (fn) => {
  const d = structuredClone(minimalData());
  fn(d.quests, d);
  return validateData(d);
};
const q = (list, id) => list.find((x) => x.id === id);
function hero() {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 10 * 60;
  return s;
}

test("prawdziwe dane: dwa zadania, lokacje tymczasowe, trasy, kupiec w drodze", async () => {
  const d = await loadData();
  assert.deepEqual(validateData(d), []);
  assert.deepEqual(d.quests.filter((x) => x.kind !== "errand").map((x) => [x.id, x.kind, x.hub, x.location, x.route, x.deadlineDays]), [
    ["wilcza_nora", "quest", "wilczy_brod", "wilcza_nora", "wilczy_brod_nora", null],
    ["eskorta_ostromira", "escort", "wilczy_brod", "kamienna_przelecz", "wilczy_brod_przelecz", 3],
  ]);
  const e = questById(d, "eskorta_ostromira");
  assert.equal(e.client, "Kupiec Ostromir");
  assert.equal(e.clientGen, "kupca Ostromira");
  assert.equal(e.eventChance, 50);
  assert.equal(locationById(d, "wilcza_nora").temporary, true);
  assert.equal(locationById(d, "kamienna_przelecz").temporary, true);
  assert.equal(routeById(d, "wilczy_brod_nora").days, 1);
  assert.equal(routeById(d, "wilczy_brod_przelecz").days, 1);
  const k = eventById(d, "kupiec_ostromir");
  assert.equal(k.once, true);
  assert.equal(k.weight, 2);
  assert.equal(eventById(d, "napad_na_woz").weight, 3, "zdarzenie zadania przez eventById (R1)");
  assert.equal(d.rules.quests.maxActive, 10);
});

test("walidacja quests.json", () => {
  expectErr(withQuests((l) => { q(l, "wilcza_nora").location = "brzezina"; }), "quests.json › wilcza_nora › location: lokacja nie jest tymczasowa");
  expectErr(withQuests((l) => { q(l, "wilcza_nora").route = "brzezina_wilczy_brod"; }), "quests.json › wilcza_nora › route: trasa nie łączy wilczy_brod z wilcza_nora");
  expectErr(withQuests((l) => { q(l, "wilcza_nora").route = "smocza"; }), 'quests.json › wilcza_nora › route: nieznana trasa "smocza"');
  expectErr(withQuests((l) => { q(l, "wilcza_nora").client = "Ktoś"; }), "quests.json › wilcza_nora › client: dozwolone tylko dla eskorty");
  expectErr(withQuests((l) => { delete q(l, "eskorta_ostromira").client; }), "quests.json › eskorta_ostromira › client: wymagane dla eskorty");
  expectErr(withQuests((l) => { delete q(l, "eskorta_ostromira").clientGen; }), "quests.json › eskorta_ostromira › clientGen: wymagane dla eskorty");
  expectErr(withQuests((l) => { q(l, "eskorta_ostromira").deadlineDays = 0; }), "quests.json › eskorta_ostromira › deadlineDays: wartość mniejsza niż 1");
  expectErr(withQuests((l) => { q(l, "eskorta_ostromira").eventChance = 101; }), "quests.json › eskorta_ostromira › eventChance: wartość poza zakresem 0–100");
  expectErr(withQuests((l) => { q(l, "wilcza_nora").hub = "kamienna_przelecz"; }), "quests.json › wilcza_nora › hub: lokacja tymczasowa nie może być punktem postoju");
  expectErr(withQuests((l) => { q(l, "wilcza_nora").hub = "rzym"; }), 'quests.json › wilcza_nora › hub: nieznana lokacja "rzym"');
  expectErr(withQuests((l) => { q(l, "wilcza_nora").kind = "przygoda"; }), "quests.json › wilcza_nora › kind: dozwolone wartości");
  expectErr(withQuests((l) => { q(l, "wilcza_nora").scenes = []; }), "quests.json › wilcza_nora › scenes: pusta lista scen");
  expectErr(withQuests((l) => { l.push(structuredClone(q(l, "wilcza_nora"))); }), "quests.json › wilcza_nora: zduplikowane id");
  const first = (l) => q(l, "wilcza_nora").scenes[0];
  expectErr(withQuests((l) => { first(l).id = "a"; }), 'quests.json › wilcza_nora › a: id sceny "a" już zajęte');
  expectErr(withQuests((l) => { q(l, "wilcza_nora").scenes.push({ id: "nora_koniec", type: "ending", text: "x" }); }),
    "quests.json › wilcza_nora › nora_koniec › type: scena niedozwolona w zdarzeniu");
  expectErr(withQuests((l) => { q(l, "eskorta_ostromira").events[0].scenes[0].id = "a"; }), 'quests.json › eskorta_ostromira › events › napad_na_woz › a: id sceny "a" już zajęte');
  expectErr(withQuests((l, d) => { d.travel.events.push({ ...structuredClone(q(l, "eskorta_ostromira").events[0]), scenes: [{ id: "zz", type: "narration", text: "x" }] }); }),
    "quests.json › eskorta_ostromira › events › napad_na_woz: id zdarzenia już zajęte");
});

test("scena quest: walidacja w fabule", () => {
  const scenes = (s) => minimalData({ scenes: [{ id: "a", type: "quest", ...s }, { id: "b", type: "ending", text: "y" }] });
  assert.deepEqual(validateData(scenes({ start: "wilcza_nora" })), []);
  expectErr(validateData(scenes({ start: "x" })), 'story.json › a › start: nieznane zadanie "x"');
  expectErr(validateData(scenes({})), "story.json › a › quest: wymagane dokładnie jedno z start / complete / fail");
  expectErr(validateData(scenes({ start: "wilcza_nora", fail: "wilcza_nora" })), "story.json › a › quest: wymagane dokładnie jedno z start / complete / fail");
});

test("startQuest: aktywne, termin eskorty 3 dni, nora bez terminu; drugi start bez zmian", () => {
  const s = hero();
  assert.deepEqual(startQuest(s, data, "eskorta_ostromira"), [{ type: "zadanie_start", id: "eskorta_ostromira" }]);
  assert.deepEqual(s.quests.eskorta_ostromira, { status: "active", acceptedAt: 600, deadline: 600 + 3 * 1440, departed: false });
  startQuest(s, data, "wilcza_nora");
  assert.equal(s.quests.wilcza_nora.deadline, null);
  s.time.minutes += 100;
  assert.deepEqual(startQuest(s, data, "wilcza_nora"), []);
  assert.equal(s.quests.wilcza_nora.acceptedAt, 600);
  assert.deepEqual(activeQuests(s, data).map((x) => x.id), ["wilcza_nora", "eskorta_ostromira"]);
  assert.deepEqual(activeQuests(s, data, "brzezina"), []);
});

test("complete / fail tylko z active; limit aktywnych", () => {
  const s = hero();
  assert.deepEqual(completeQuest(s, data, "wilcza_nora"), []);
  startQuest(s, data, "wilcza_nora");
  assert.deepEqual(completeQuest(s, data, "wilcza_nora"), [{ type: "zadanie_wykonane", id: "wilcza_nora" }]);
  assert.equal(s.quests.wilcza_nora.status, "done");
  assert.deepEqual(failQuest(s, data, "wilcza_nora"), []);
  startQuest(s, data, "eskorta_ostromira");
  assert.deepEqual(failQuest(s, data, "eskorta_ostromira"), [{ type: "zadanie_przepadlo", id: "eskorta_ostromira" }]);
  const d = structuredClone(data);
  d.rules.quests.maxActive = 1;
  const t = hero();
  startQuest(t, d, "wilcza_nora");
  assert.deepEqual(startQuest(t, d, "eskorta_ostromira"), [{ type: "zadanie_limit", id: "eskorta_ostromira" }]);
  assert.equal(t.quests.eskorta_ostromira, undefined);
});

test("scena quest: start i komunikat", async () => {
  const s = hero();
  const ctx = { state: s, data, notices: [] };
  await defaultHandlers.quest(ctx, { id: "q", type: "quest", start: "wilcza_nora" });
  assert.equal(s.quests.wilcza_nora.status, "active");
  assert.ok(ctx.notices.map((n) => stripVTControlCharacters(n)).includes("Nowe zadanie: Wilcza Nora."), ctx.notices.join("\n"));
  await defaultHandlers.quest(ctx, { id: "q2", type: "quest", complete: "wilcza_nora" });
  assert.ok(ctx.notices.map((n) => stripVTControlCharacters(n)).includes("Zadanie wykonane: Wilcza Nora."));
});

// --- termin, przepadanie, mapa ---
const DAY = 24 * 60;

test("expireQuests: termin wymarszu – minutę przed zostaje, minutę po przepada; wyruszone nie przepadają", () => {
  const s = hero();
  startQuest(s, data, "eskorta_ostromira");
  startQuest(s, data, "wilcza_nora");
  s.time.minutes = 600 + 3 * DAY - 1;
  assert.deepEqual(expireQuests(s, data), []);
  s.time.minutes = 600 + 3 * DAY + 1;
  assert.deepEqual(expireQuests(s, data), [{ type: "zadanie_przepadlo", id: "eskorta_ostromira", expired: true }]);
  assert.equal(s.quests.eskorta_ostromira.status, "failed");
  assert.equal(s.quests.wilcza_nora.status, "active", "bez terminu");
  const t = hero();
  startQuest(t, data, "eskorta_ostromira");
  t.quests.eskorta_ostromira.departed = true;
  t.time.minutes += 10 * DAY;
  assert.deepEqual(expireQuests(t, data), []);
  assert.equal(t.quests.eskorta_ostromira.status, "active");
});

test("abandonHub: tylko aktywne zadania tego punktu postoju", () => {
  const s = hero();
  startQuest(s, data, "wilcza_nora");
  startQuest(s, data, "eskorta_ostromira");
  completeQuest(s, data, "wilcza_nora");
  assert.deepEqual(abandonHub(s, data, "brzezina"), []);
  assert.deepEqual(abandonHub(s, data, "wilczy_brod"), [{ type: "zadanie_przepadlo", id: "eskorta_ostromira" }]);
  assert.equal(s.quests.wilcza_nora.status, "done");
});

test("mapOptions: aktywne zadania punktu, kolejność z pliku, dni trasy, pozostały termin w pełnych dniach w górę", () => {
  const s = hero();
  assert.deepEqual(mapOptions(s, data, "wilczy_brod"), []);
  startQuest(s, data, "eskorta_ostromira");
  startQuest(s, data, "wilcza_nora");
  s.time.minutes += 1.5 * DAY;
  const opts = mapOptions(s, data, "wilczy_brod");
  assert.deepEqual(opts.map((o) => [o.quest.id, o.location.id, o.days, o.deadlineLeft]), [
    ["wilcza_nora", "wilcza_nora", 1, null],
    ["eskorta_ostromira", "kamienna_przelecz", 1, 2],
  ]);
  completeQuest(s, data, "wilcza_nora");
  assert.deepEqual(mapOptions(s, data, "wilczy_brod").map((o) => o.quest.id), ["eskorta_ostromira"]);
  s.time.minutes += 2 * DAY;
  assert.deepEqual(mapOptions(s, data, "wilczy_brod"), [], "po terminie nie ma opcji");
});

test("repairQuestState: nieznane zadanie usunięte; mapa z nieznanym zadaniem → wybór", () => {
  const s = hero();
  s.quests = { smok: { status: "active", acceptedAt: 0, deadline: null, departed: false }, wilcza_nora: { status: "done", acceptedAt: 0, deadline: null, departed: true } };
  s.world.map = { hub: "wilczy_brod", phase: "onsite", quest: "smok", questScene: "x" };
  assert.deepEqual(repairQuestState(s, data), ["smok", "smok"]);
  assert.deepEqual(Object.keys(s.quests), ["wilcza_nora"]);
  assert.deepEqual(s.world.map, { hub: "wilczy_brod", phase: "choose", quest: null, questScene: null, spot: null, spotScene: null, walk: null, visitor: null, far: null });
  s.world.map = { hub: "rzym", phase: "choose", quest: null, questScene: null };
  assert.deepEqual(repairQuestState(s, data), ["rzym"]);
  assert.equal(s.world.map, null);
});

test("scena map: walidacja punktu postoju i wyjścia fabułą", () => {
  const scenes = (s) => minimalData({ start: "m", scenes: [{ id: "m", type: "map", hub: "wilczy_brod", main: { label: "Dalej", goto: "b" }, ...s }, { id: "b", type: "ending", text: "y" }] });
  assert.deepEqual(validateData(scenes({})), []);
  expectErr(validateData(scenes({ hub: "rzym" })), 'story.json › m › hub: nieznana lokacja "rzym"');
  expectErr(validateData(scenes({ hub: "wilcza_nora" })), "story.json › m › hub: lokacja tymczasowa nie może być punktem postoju");
  expectErr(validateData(scenes({ main: { label: "Dalej", goto: "nie_ma" } })), 'story.json › m › main.goto: nieznana scena "nie_ma"');
  expectErr(validateData(scenes({ goto: "b" })), "story.json › m › goto:");
  expectErr(withQuests((l) => { q(l, "wilcza_nora").scenes.push({ id: "nora_mapa", type: "map", hub: "wilczy_brod", main: { label: "x", goto: "nora_wawoz" } }); }),
    "quests.json › wilcza_nora › nora_mapa › type: scena niedozwolona w zdarzeniu");
});

test("final: trasa zadania musi zaczynać się w punkcie postoju", () => {
  expectErr(withQuests((l, d) => {
    const r = d.travel.routes.find((x) => x.id === "wilczy_brod_nora");
    [r.from, r.to] = [r.to, r.from];
  }), "quests.json › wilcza_nora › route: trasa musi zaczynać się w wilczy_brod");
});
