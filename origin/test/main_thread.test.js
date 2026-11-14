import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { validateData, loadData } from "../src/engine/data.js";
import { evaluate } from "../src/engine/conditions.js";
import { startQuest, advanceErrands, currentObjectives, activeQuests } from "../src/systems/quests.js";

const data = minimalData();
const real = await loadData();
const THREADS = { wilczy_brod: "watek_wilczy_brod", gluszec: "watek_gluszec", obserwatorium: "watek_obserwatorium" };
const END_FLAG = { wilczy_brod: "akt2_koniec", gluszec: "akt3a_koniec", obserwatorium: "akt3b_koniec" };

function fresh() {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character; state.inventory = cs.inventory;
  state.time.minutes = 12 * 60;
  return state;
}
const setStatus = (state, id, status) => { state.quests[id] = { status, acceptedAt: 0, deadline: null, departed: true, done: [] }; };
/** Texts of the thread's current objectives (the journal line that says what to do now). */
const texts = (state, thread) => currentObjectives(state, data).filter((c) => c.quest.id === thread).map((c) => c.objective.text);
const visitor = (hub, id) => data.travel.locations.find((l) => l.id === hub).visitors.find((v) => v.id === id);

/** Makes `cond` true the simplest way: flags, quest statuses (done / active), or the first branch of any / all. */
function forceCondition(state, cond) {
  if (cond.flag) state.flags[cond.flag] = true;
  if (cond.questStatus) setStatus(state, cond.questStatus.id, cond.questStatus.is === "none" ? "done" : cond.questStatus.is);
  for (const c of cond.all ?? []) forceCondition(state, c);
  if (cond.any) forceCondition(state, cond.any[0]);
}

test("wątek główny: trzy zlecenia, dane przechodzą walidację, startują z map hubów", () => {
  assert.deepEqual(validateData(data), []);
  for (const [hub, id] of Object.entries(THREADS)) {
    const q = data.quests.find((x) => x.id === id);
    assert.ok(q && q.kind === "errand" && q.main === true && q.hub === hub, id);
    assert.ok(q.onComplete.length > 0, `${id}: nagroda`);
  }
  const maps = real.story.scenes.filter((s) => s.type === "map");
  for (const [hub, id] of Object.entries(THREADS)) assert.ok(maps.some((m) => m.hub === hub && (m.starts ?? []).includes(id)), `${hub}: mapa nie startuje wątku`);
});

test("wątek główny: w każdym hubie dziennik w każdym kroku wskazuje dokładnie jedną rzecz do zrobienia, a koniec aktu kończy wątek", () => {
  for (const [hub, id] of Object.entries(THREADS)) {
    const state = fresh();
    startQuest(state, data, id);
    assert.equal(state.quests[id].status, "active");
    const q = data.quests.find((x) => x.id === id);
    assert.ok(q.objectives.length >= 2, `${id}: za mało kroków`);
    for (const objective of q.objectives) {
      assert.deepEqual(texts(state, id), [objective.text], `${id}: dziennik nie wskazuje kroku „${objective.id}”`);
      forceCondition(state, objective.done);
      advanceErrands(state, data, createRng(1));
    }
    assert.equal(state.quests[id].status, "done", `${id}: wątek nie zakończył się po ostatnim kroku`);
    assert.equal(q.objectives.at(-1).done.flag, END_FLAG[hub], `${id}: ostatni krok to koniec aktu`);
  }
});

test("wątek główny: Głuszec – kolejność kroków prowadzi do cmentarza po zmroku i do Haliny", () => {
  const state = fresh();
  startQuest(state, data, "watek_gluszec");
  assert.match(texts(state, "watek_gluszec")[0], /sołtys|osadzie/i);
  setStatus(state, "przyjecie_w_osadzie", "done");
  advanceErrands(state, data, createRng(1));
  assert.match(texts(state, "watek_gluszec")[0], /ślad|wzgórz|ocalał/i);
  setStatus(state, "zwiad_na_wzgorzu", "done");
  advanceErrands(state, data, createRng(1));
  assert.match(texts(state, "watek_gluszec")[0], /cmentarz/i);
  assert.match(texts(state, "watek_gluszec")[0], /zmrok/i, "wskazówka o porze");
  state.flags.echo_slyszal = true;
  advanceErrands(state, data, createRng(1));
  assert.match(texts(state, "watek_gluszec")[0], /Halin/i);
  state.flags.akt3a_koniec = true;
  advanceErrands(state, data, createRng(1));
  assert.equal(state.quests.watek_gluszec.status, "done");
});

test("wątek główny: Wilczy Bród – po długu kupca dziennik wskazuje Ostromira, a po eskorcie kończy akt II", () => {
  const state = fresh();
  startQuest(state, data, "watek_wilczy_brod");
  state.flags.dlug_oddany = true;
  advanceErrands(state, data, createRng(1));
  assert.match(texts(state, "watek_wilczy_brod")[0], /Ostromir/);
  state.flags.akt2_koniec = true;
  setStatus(state, "eskorta_ostromira", "done");
  advanceErrands(state, data, createRng(1));
  assert.equal(state.quests.watek_wilczy_brod.status, "done");
});

test("popchnięcie: wóz Ostromira stoi przy bramie od razu po oddaniu długu, bez zamykania dnia, i wątek wskazuje to miejsce", () => {
  const spot = data.travel.locations.find((l) => l.id === "wilczy_brod").spots.find((s) => s.id === "woz_ostromira");
  assert.ok(spot && spot.type === "scene");
  const state = fresh();
  assert.equal(evaluate(spot.if, state, data), false);
  state.flags.dlug_oddany = true;
  assert.equal(evaluate(spot.if, state, data), true);
  setStatus(state, "eskorta_ostromira", "active");
  assert.equal(evaluate(spot.if, state, data), false);
  assert.equal(spot.scenes.find((s) => s.type === "quest").start, "eskorta_ostromira");
  assert.ok(spot.scenes.some((s) => s.type === "dialogue" && s.dialogue === "ostromir_brama"));

  const thread = data.quests.find((q) => q.id === "watek_wilczy_brod");
  assert.equal(thread.objectives.find((o) => o.id === "ostromir").at, "wilczy_brod.woz_ostromira");
  assert.equal(data.travel.locations.find((l) => l.id === "wilczy_brod").visitors.some((v) => v.id === "ostromir_u_bramy"), false);
});

test("wątek Wilczego Brodu: dług prowadzi karczma → weksel na Trakcie → pokwitowanie w karczmie → wóz przy bramie → Przełęcz", () => {
  const thread = data.quests.find((q) => q.id === "watek_wilczy_brod");
  assert.deepEqual(thread.objectives.map((o) => o.id), ["wrzosek", "ostap", "dlug", "weksel", "zwrot", "ostromir", "przelecz"]);
  const state = fresh();
  startQuest(state, data, "watek_wilczy_brod");
  const at = () => currentObjectives(state, data).filter((c) => c.quest.id === "watek_wilczy_brod").map((c) => c.objective.at);
  const step = (flags) => { Object.assign(state.flags, flags); advanceErrands(state, data, createRng(1)); };
  step({ wrzosek_ziola_oddane: true });
  assert.deepEqual(at(), ["stary_mlyn.mlynarz"]);
  step({ ostap_zboze: true });
  assert.deepEqual(at(), ["wilczy_brod.karczma"]);
  setStatus(state, "dlug_kupca", "active");
  step({});
  assert.deepEqual(at(), ["trakt_kupiecki.ostromir"]);
  step({ ostromir_dlug: true });
  assert.deepEqual(at(), ["wilczy_brod.karczma"]);
  step({ dlug_oddany: true });
  assert.deepEqual(at(), ["wilczy_brod.woz_ostromira"]);
  setStatus(state, "eskorta_ostromira", "active");
  step({});
  assert.deepEqual(at(), ["wilczy_brod.woz_ostromira"]);
});

test("popchnięcie: w Głuszcu wskazówka o cmentarzu, gdy trop znaleziony, a głos jeszcze nie usłyszany; w Obserwatorium Hieronim wzywa przed wyprawą", () => {
  const state = fresh();
  const cmentarz = visitor("gluszec", "szept_o_cmentarzu");
  assert.equal(evaluate(cmentarz.if, state, data), false);
  setStatus(state, "przyjecie_w_osadzie", "done");
  setStatus(state, "zwiad_na_wzgorzu", "done");
  assert.equal(evaluate(cmentarz.if, state, data), true);
  state.flags.echo_slyszal = true;
  assert.equal(evaluate(cmentarz.if, state, data), false);
  const hieronim = visitor("obserwatorium", "hieronim_wola");
  assert.equal(evaluate(hieronim.if, state, data), false);
  setStatus(state, "dlug_istoty_zlecenie", "done");
  assert.equal(evaluate(hieronim.if, state, data), true);
  setStatus(state, "przygotowania", "active");
  assert.equal(evaluate(hieronim.if, state, data), false);
});

test("wątek główny: nie wchodzi w limit zleceń aktywnych", () => {
  const full = fresh();
  for (const q of data.quests.filter((x) => x.kind === "errand" && !x.main).slice(0, data.rules.quests.maxActive)) startQuest(full, data, q.id);
  assert.equal(activeQuests(full, data).length, data.rules.quests.maxActive);
  const events = startQuest(full, data, "watek_gluszec");
  assert.ok(events.some((e) => e.type === "zadanie_start"), "wątek startuje mimo pełnego limitu");
  assert.equal(full.quests.watek_gluszec.status, "active");
});

test("cmentarz w Głuszcu: opis w dzień zdradza porę, w której kamienie ożywają", () => {
  const spot = data.travel.locations.find((l) => l.id === "gluszec").spots.find((s) => s.id === "cmentarz");
  assert.match(spot.scenes.find((s) => s.id === "cmentarz_scena").text, /zmroku|nocą|po nocy/i);
});

// --- through the real hub: the visitor really offers the escort, whatever the road rolls ---
import { defaultHandlers } from "../src/scenes/index.js";
import { createAdaptiveIO } from "./helpers.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { stripVTControlCharacters } from "node:util";

test("popchnięcie przez prawdziwy hub: Ostromir przy bramie daje eskortę, a wątek główny wskazuje drogę", async () => {
  const state = fresh();
  state.world.location = "wilczy_brod";
  state.world.phenomenonRolledDay = 99;
  state.flags.dlug_oddany = true;
  const scene = real.story.scenes.find((s) => s.id === "demo_mapa");
  const io = createAdaptiveIO([{ pick: "! Wóz Ostromira" }, { pick: "Dalej" }, { pick: "Biorę to" }, { pick: "Bywaj" }]);
  const ctx = { state, data: real, io, rng: { int: (lo) => lo, setState() {}, getState: () => 0 }, debug: false, notices: [] };
  await assert.rejects(defaultHandlers.map(ctx, scene), InputExhaustedError);
  const text = stripVTControlCharacters(io.text());
  assert.match(text, /Dług oddany, słowo dotrzymane/);
  assert.equal(state.quests.eskorta_ostromira.status, "active");
  assert.equal(state.quests.watek_wilczy_brod.status, "active");
});

test("wątek główny (recenzja): koniec aktu zamyka wątek, nawet gdy gracz ominął pośrednie kroki (np. obława w Głuszcu)", () => {
  for (const [hub, id] of Object.entries(THREADS)) {
    const state = fresh();
    startQuest(state, data, id);
    state.flags[END_FLAG[hub]] = true;
    advanceErrands(state, data, createRng(1));
    assert.equal(state.quests[id].status, "done", `${id}: wątek nie zamknął się po końcu aktu`);
  }
});
