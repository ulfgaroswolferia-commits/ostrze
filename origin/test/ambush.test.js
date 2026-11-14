import { loadData } from "../src/engine/data.js";
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState, tmpDir, createAdaptiveIO, pruneMissingQuests } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { validateData } from "../src/engine/data.js";
import { rollAmbush } from "../src/systems/spots.js";

const strip = (s) => stripVTControlCharacters(s);
const MAP = { id: "mapa", type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Czekaj", goto: "koniec_gry" } };
const GAW = { id: "gaw", start: "s", nodes: { s: { speaker: "Gawędziarz", text: "Witaj, wędrowcze.", options: [{ id: "bywaj", text: "Bywaj.", goto: "end" }] } } };
const AMBUSH = (extra = {}) => ({ chance: 100, scenes: [{ id: "amb_1", type: "narration", text: "Zza węgła wyskakuje kieszonkowiec." }, { id: "amb_2", type: "narration", text: "Kieszonkowiec zmyka z pustymi rękami.", time: 5 }], ...extra });

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function world(ambush = AMBUSH(), edit = () => {}) {
  const data = structuredClone(minimalData());
  data.rules.travel.localEventChance = 0;
  data.dialogues.push(GAW);
  data.quests = data.quests.filter((q) => q.kind !== "errand");
  data.dialogues = data.dialogues.filter((d) => !["wrzosek", "zona_borka", "corka", "komendant_po", "kowal"].includes(d.id));
  pruneMissingQuests(data);
  const hub = data.travel.locations.find((l) => l.id === "wilczy_brod");
  hub.spots = [{ id: "gaw", name: "Gawędziarz", type: "talk", ref: "gaw", ...(ambush ? { ambush } : {}) }];
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
const AMBUSHED = pick("Gawędziarz", "Dalej", "Dalej", "Bywaj.");
const PLAIN = pick("Gawędziarz", "Bywaj.");
const LEAVE = pick("Wróć na mapę", "Czekaj");

test("zasadzka: dane przechodzą walidację; zła szansa, brak scen, board i hunt z zasadzką to błąd", () => {
  assert.deepEqual(validateData(world().data), []);
  assert.ok(validateData(world(AMBUSH({ chance: 0 })).data).some((e) => /ambush\.chance/.test(e)));
  assert.ok(validateData(world(AMBUSH({ chance: 101 })).data).some((e) => /ambush\.chance/.test(e)));
  assert.ok(validateData(world(AMBUSH({ scenes: [] })).data).some((e) => /ambush\.scenes/.test(e)));
  const board = world(null, (d) => d.travel.locations.find((l) => l.id === "wilczy_brod").spots.push({ id: "tablica", name: "Tablica", type: "board", ambush: AMBUSH({ scenes: [{ id: "x1", type: "narration", text: "x" }] }) }));
  assert.ok(validateData(board.data).some((e) => /ambush: niedozwolone dla board/.test(e)));
});

test("zasadzka: gra się przed sceną miejsca, raz na dobę, a następnego dnia znów", async () => {
  const { data, state } = world();
  const io = createAdaptiveIO([...AMBUSHED, ...PLAIN, ...LEAVE]);
  await run(ctxOf(state, data, io));
  const text = strip(io.text());
  assert.equal(text.split("Zza węgła wyskakuje kieszonkowiec").length - 1, 1, "tylko raz tego dnia");
  assert.ok(text.indexOf("Zza węgła") < text.indexOf("Witaj, wędrowcze"));
  assert.equal(text.split("Witaj, wędrowcze").length - 1, 2, "scena miejsca gra się za każdym razem");
  state.time.minutes += 24 * 60;
  const io2 = createAdaptiveIO([...AMBUSHED, ...LEAVE]);
  await run(ctxOf(state, data, io2));
  assert.match(strip(io2.text()), /Zza węgła/);
});

test("zasadzka: niespełnione `if` albo szansa nie dają zasadzki; rollAmbush respektuje cooldown", () => {
  const { data, state } = world(AMBUSH({ if: { flag: "niema" } }));
  const spot = data.travel.locations.find((l) => l.id === "wilczy_brod").spots[0];
  assert.equal(rollAmbush(state, data, "wilczy_brod", spot, createRng(1)), false);
  state.flags.niema = true;
  assert.equal(rollAmbush(state, data, "wilczy_brod", spot, createRng(1)), true);
  assert.equal(rollAmbush(state, data, "wilczy_brod", spot, createRng(1)), false, "drugi raz tego dnia");
  const low = world(AMBUSH({ chance: 1 }));
  const never = { int: () => 100 };
  assert.equal(rollAmbush(low.state, low.data, "wilczy_brod", low.data.travel.locations.find((l) => l.id === "wilczy_brod").spots[0], never), false);
});

test("zasadzka: zapis w jej środku wraca do tej samej listy scen, bez ponownego losowania", async () => {
  const { data, state } = world();
  const first = ctxOf(state, data, createAdaptiveIO([...pick("Gawędziarz", "Dalej"), "^C"]));
  await assert.rejects(run(first));
  assert.equal(state.world.map.ambush, true);
  assert.equal(state.world.map.spotScene, "amb_2");
  await saveGame("1", state, first.rng);
  const loaded = await loadGame("1", data, { warnings: [] });
  assert.equal(loaded.world.map.ambush, true);
  const io = createAdaptiveIO([...pick("Dalej", "Bywaj."), ...LEAVE]);
  assert.deepEqual(await run(ctxOf(loaded, data, io, 99)), { goto: "koniec_gry" });
  assert.match(strip(io.text()), /Witaj, wędrowcze/);
  assert.doesNotMatch(strip(io.text()), /Zza węgła/, "pierwsza scena zasadzki nie gra się drugi raz");
});

test("zasadzka: miejsca bez `ambush` zachowują się jak dawniej", async () => {
  const { data, state } = world(null);
  const io = createAdaptiveIO([...PLAIN, ...LEAVE]);
  await run(ctxOf(state, data, io));
  assert.doesNotMatch(strip(io.text()), /Zza węgła/);
});


test("zasadzka: stary zapis w środku miejsca (bez zapisanej decyzji) nie losuje zasadzki przy wznowieniu i nie wpisuje cooldownu", async () => {
  const { data, state } = world(null);
  const first = ctxOf(state, data, createAdaptiveIO([...pick("Gawędziarz"), "^C"]));
  await assert.rejects(run(first));
  assert.ok(state.world.map.spotScene, "gracz jest w scenie miejsca");
  data.travel.locations.find((l) => l.id === "wilczy_brod").spots[0].ambush = AMBUSH();
  delete state.world.map.ambush;
  state.world.ambushes = {};
  const io = createAdaptiveIO([...pick("Bywaj."), ...LEAVE]);
  await run(ctxOf(state, data, io, 5));
  assert.doesNotMatch(strip(io.text()), /Zza węgła/);
  assert.deepEqual(state.world.ambushes ?? {}, {}, "żadnego wpisu cooldownu");
});

test("zasadzka: naprawa zapisu z nieznanym miejscem zeruje też decyzję o zasadzce", async () => {
  const { repairQuestState } = await import("../src/systems/quests.js");
  const { data, state } = world();
  Object.assign(state.world, { map: { hub: "wilczy_brod", phase: "spot", spot: "nie_ma_takiego", spotScene: "x", ambush: true, walk: null, far: null, visitor: null } });
  repairQuestState(state, data);
  assert.equal(state.world.map.ambush ?? null, null);
});

test("zasadzka z firstVisit: pierwsze wejście pewne i bez rzutu (przywitanie w karczmie Ulfgrodu), potem zwykła szansa raz na dobę", () => {
  const spot = { id: "karczma", ambush: { chance: 35, firstVisit: true, scenes: [] } };
  const state = { time: { minutes: 12 * 60 }, world: {}, flags: {} };
  const never = { int: () => { throw new Error("pierwsze wejście bez rzutu"); } };
  assert.equal(rollAmbush(state, {}, "ulfgrod", spot, never), true);
  assert.equal(rollAmbush(state, {}, "ulfgrod", spot, never), false, "tego samego dnia już nie");
  state.time.minutes += 24 * 60;
  assert.equal(rollAmbush(state, {}, "ulfgrod", spot, { int: () => 36 }), false, "kolejne wejścia losują");
  assert.equal(rollAmbush(state, {}, "ulfgrod", spot, { int: () => 35 }), true);
});

test("zasadzka: karczma w Ulfgrodzie wita kieszonkowcami przy pierwszym wejściu", async () => {
  const real = await loadData();
  const karczma = real.travel.locations.find((l) => l.id === "ulfgrod").spots.find((s) => s.id === "karczma");
  assert.equal(karczma.ambush.firstVisit, true);
  assert.equal(karczma.ambush.chance, 35);
});
