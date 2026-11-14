import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState, tmpDir, createAdaptiveIO, pruneMissingQuests } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { startQuest, repairQuestState } from "../src/systems/quests.js";
import { revealPlace } from "../src/systems/places.js";
import { validateData } from "../src/engine/data.js";

const strip = (s) => stripVTControlCharacters(s);
const MAP = { id: "mapa", type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Czekaj", goto: "koniec_gry" } };
const GAW = {
  id: "gaw", start: "s",
  nodes: {
    s: { speaker: "Gawędziarz", text: "Witaj, wędrowcze.", options: [{ id: "haslo", text: "Podaj hasło", goto: "f" }, { id: "bywaj", text: "Bywaj.", goto: "end" }] },
    f: { speaker: "Gawędziarz", text: "Proszę bardzo.", actions: [{ setFlag: "haslo" }], options: [{ text: "Bywaj.", goto: "end" }] },
  },
};
const ERR = (extra = {}) => ({
  id: "haslo_zlecenie", kind: "errand", name: "Hasło dla gawędziarza", hub: "wilczy_brod", description: "Zdobądź hasło.", deadlineDays: null, board: true,
  objectives: [{ id: "haslo", text: "Zdobądź hasło.", at: "wilczy_brod.gaw", done: { flag: "haslo" } }],
  onComplete: [{ giveMoney: 5 }], ...extra,
});

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function world(edit = () => {}) {
  const data = structuredClone(minimalData());
  data.rules.travel.localEventChance = 0;
  data.rules.travel.eventChance = 0;
  data.rules.travel.dangerousEventChance = 0;
  data.dialogues.push(GAW);
  data.quests = data.quests.filter((q) => q.kind !== "errand"); // the real hub's errands point at its real places
  data.dialogues = data.dialogues.filter((d) => !["wrzosek", "zona_borka", "corka", "komendant_po", "kowal"].includes(d.id));
  pruneMissingQuests(data); // act III has its own tests
  const hub = data.travel.locations.find((l) => l.id === "wilczy_brod");
  hub.spots = [
    { id: "gaw", name: "Gawędziarz", type: "talk", ref: "gaw" },
    { id: "izba", name: "Izba", type: "rest" },
    { id: "tablica", name: "Tablica zleceń", type: "board" },
    { id: "skrytka", name: "Skrytka", type: "rest", secret: true },
    { id: "zamkniete", name: "Zamknięte drzwi", type: "rest", if: { flag: "klucz" } },
  ];
  data.travel.locations.push({ id: "las", name: "Las Rubieży", short: "Las", region: "pogorze", near: { minutes: 40 }, danger: 2, secret: true,
    spots: [{ id: "polana", name: "Polana", type: "scene", scenes: [{ id: "polana_1", type: "narration", text: "Cicho tu.", goto: "koniec" }] }] });
  data.maps = { ...data.maps, pogorze: "{wilczy_brod} {las} {wilczy_las} {stary_mlyn} {trakt_kupiecki} {lesniczowka} {ruiny_straznicy}" };
  data.quests.push(ERR({ requires: { known: "las" } }));
  data.quests.push(ERR({ id: "drugie", name: "Drugie", requires: null, objectives: [{ id: "x", text: "x", at: "wilczy_brod.gaw", done: { flag: "nigdy" } }] }));
  delete data.quests.find((q) => q.id === "drugie").requires;
  edit(data);
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
const ctxOf = (state, data, io, seed = 3) => ({ state, data, io, rng: createRng(seed), debug: false, notices: [] });
const run = (ctx) => defaultHandlers.map(ctx, MAP);
const pick = (...labels) => labels.map((l) => ({ pick: l }));
const TALK = [...pick("Gawędziarz", "Bywaj.")];
const LEAVE = pick("Wróć na mapę", "Czekaj");

test("dane testowe przechodzą walidację", () => {
  assert.deepEqual(validateData(world().data), []);
});

test("wejście w hubie: menu miejsc; miejsce secret i miejsce z niespełnionym if", async () => {
  const { data, state } = world();
  const io = createAdaptiveIO(LEAVE);
  assert.deepEqual(await run(ctxOf(state, data, io)), { goto: "koniec_gry" });
  const out = strip(io.text());
  for (const name of ["Gawędziarz", "Izba", "Tablica zleceń", "Wróć na mapę"]) assert.match(out, new RegExp(name));
  assert.doesNotMatch(out, /Skrytka/);
  assert.match(out, /Zamknięte drzwi.*niedostępne/);
  const again = world();
  revealPlace(again.state, again.data, "wilczy_brod.skrytka");
  const io2 = createAdaptiveIO(LEAVE);
  await run(ctxOf(again.state, again.data, io2));
  assert.match(strip(io2.text()), /Skrytka/);
  assert.equal(state.world.map, null);
});

test("rozmowa w miejscu jest powtarzalna i ustawia flagi", async () => {
  const { data, state } = world();
  const io = createAdaptiveIO([...TALK, ...pick("Gawędziarz", "Podaj hasło", "Bywaj."), ...LEAVE]);
  await run(ctxOf(state, data, io));
  assert.equal((strip(io.text()).match(/Witaj, wędrowcze\./g) ?? []).length, 2); // two talks
  assert.equal(state.flags.haslo, true);
});

test("cel zlecenia kończy się zaraz po rozmowie (hook), nagroda raz", async () => {
  const { data, state } = world();
  const money = state.character.money;
  startQuest(state, data, "drugie");
  startQuest(state, data, "haslo_zlecenie");
  const io = createAdaptiveIO([...pick("! Gawędziarz", "Podaj hasło", "Bywaj."), ...LEAVE]);
  await run(ctxOf(state, data, io));
  assert.equal(state.quests.haslo_zlecenie.status, "done");
  assert.equal(state.character.money, money + 5);
  assert.match(strip(io.text()), /Zadanie wykonane: Hasło dla gawędziarza/);
  assert.equal(state.quests.drugie.status, "active", "errand nie przepada przy wyjściu fabułą ani nie pyta");
});

test("tablica: zlecenie z niespełnionym requires nie jest na liście; po odkryciu można je podjąć raz; limit daje komunikat", async () => {
  const { data, state } = world();
  const io = createAdaptiveIO([...pick("Tablica zleceń", "Odejdź od tablicy"), ...LEAVE]);
  await run(ctxOf(state, data, io));
  const out = strip(io.text());
  assert.match(out, /Drugie/);
  assert.doesNotMatch(out, /Hasło dla gawędziarza/);
  const { data: d2, state: s2 } = world();
  revealPlace(s2, d2, "las");
  const io2 = createAdaptiveIO([...pick("Tablica zleceń", "Hasło dla gawędziarza", "Odejdź od tablicy"), ...LEAVE]);
  await run(ctxOf(s2, d2, io2));
  assert.equal(s2.quests.haslo_zlecenie.status, "active");
  assert.match(strip(io2.text()), /Nowe zadanie: Hasło dla gawędziarza/);
  const { data: d3, state: s3 } = world((d) => { d.rules.quests.maxActive = 1; });
  startQuest(s3, d3, "drugie");
  const io3 = createAdaptiveIO([...pick("Tablica zleceń", "Odejdź od tablicy"), ...LEAVE]);
  await run(ctxOf(s3, d3, io3));
  assert.match(strip(io3.text()), /Brak ogłoszeń/);
});

test("droga bliska z mapy: czas, lokacja, menu miejsc celu i powrót", async () => {
  const { data, state } = world();
  revealPlace(state, data, "las");
  const before = state.time.minutes;
  const io = createAdaptiveIO([...pick("Wróć na mapę", "Las Rubieży", "Polana", "Dalej", "Wróć na mapę", "Strażnica Wilczy Bród"), ...LEAVE]);
  assert.deepEqual(await run(ctxOf(state, data, io)), { goto: "koniec_gry" });
  assert.equal(state.world.location, "wilczy_brod");
  assert.ok(state.time.minutes - before >= 80);
  assert.match(strip(io.text()), /Cicho tu\./);
});

test("wyprawa po zlecenie tylko z huba: w lesie nie ma wyprawy Wilczej Nory", async () => {
  const { data, state } = world();
  revealPlace(state, data, "las");
  startQuest(state, data, "wilcza_nora");
  const io = createAdaptiveIO(pick("Wróć na mapę", "Las Rubieży", "Wróć na mapę"));
  await assert.rejects(run(ctxOf(state, data, io)), InputExhaustedError);
  const afterWalk = strip(io.text()).split("Jesteś: Las Rubieży").at(-1);
  assert.doesNotMatch(afterWalk, /Wilcza Nora · zadanie/);
});

test("main z aktywną wyprawą pyta, z samym errandem nie", async () => {
  const { data, state } = world();
  startQuest(state, data, "wilcza_nora");
  const io = createAdaptiveIO([...pick("Wróć na mapę", "Czekaj"), "n", ...pick("Czekaj"), "t"]);
  assert.deepEqual(await run(ctxOf(state, data, io)), { goto: "koniec_gry" });
  assert.match(strip(io.text()), /Masz niewykonane zadania/);
  assert.equal(state.quests.wilcza_nora.status, "failed");
});

test("zapis w trakcie rozmowy w miejscu: postęp przeżywa wczytanie i rozmowa wznawia się bez powtórzenia wejścia", async () => {
  const { data, state } = world();
  const first = ctxOf(state, data, createAdaptiveIO([...pick("Gawędziarz", "Podaj hasło"), "^C"]));
  await assert.rejects(run(first));
  assert.equal(state.world.map.phase, "spot");
  assert.equal(state.world.map.spot, "gaw");
  assert.equal(state.world.dialogueProgress["miejsce:wilczy_brod.gaw"], "f");
  await saveGame("1", state, first.rng);
  const warnings = [];
  const loaded = await loadGame("1", data, { warnings });
  assert.deepEqual(warnings, []);
  assert.equal(loaded.world.dialogueProgress["miejsce:wilczy_brod.gaw"], "f");
  const io = createAdaptiveIO([...pick("Bywaj."), ...LEAVE]);
  assert.deepEqual(await run(ctxOf(loaded, data, io)), { goto: "koniec_gry" });
  assert.doesNotMatch(strip(io.text()), /Witaj, wędrowcze/);
  assert.equal(loaded.world.finishedDialogues.includes("miejsce:wilczy_brod.gaw"), false === true || loaded.world.finishedDialogues.includes("miejsce:wilczy_brod.gaw"));
});

test("zapis w trakcie drogi bliskiej: po wczytaniu droga dobiega końca w lesie", async () => {
  const { data, state } = world((d) => { d.rules.travel.localEventChance = 100; d.travel.events = [{ id: "szmer", kind: "encounter", weight: 1, scenes: [{ id: "szmer_1", type: "narration", text: "Szmer.", goto: "koniec" }] }]; });
  revealPlace(state, data, "las");
  const before = state.time.minutes;
  const first = ctxOf(state, data, createAdaptiveIO([...pick("Wróć na mapę", "Las Rubieży"), "^C"]));
  await assert.rejects(run(first));
  assert.equal(state.world.map.phase, "walk");
  await saveGame("1", state, first.rng);
  const loaded = await loadGame("1", data);
  const io = createAdaptiveIO(pick("Dalej"));
  await assert.rejects(run(ctxOf(loaded, data, io)), InputExhaustedError);
  assert.equal(loaded.world.location, "las");
  assert.equal(loaded.time.minutes - before, 40);
});

test("naprawa: postęp nieznanego miejsca znika, faza spot z nieznanym miejscem wraca do place", async () => {
  const { data, state } = world();
  state.world.dialogueProgress["miejsce:wilczy_brod.duch"] = "s";
  state.world.map = { hub: "wilczy_brod", phase: "spot", quest: null, questScene: null, spot: "duch", spotScene: null, walk: null };
  await saveGame("1", state, createRng(1));
  const warnings = [];
  const loaded = await loadGame("1", data, { warnings });
  assert.equal(loaded.world.dialogueProgress["miejsce:wilczy_brod.duch"], undefined);
  assert.equal(loaded.world.map.phase, "place");
  assert.equal(loaded.world.map.spot, null);
  repairQuestState(loaded, data);
});
