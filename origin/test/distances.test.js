import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { minimalData, combatState, tmpDir, createAdaptiveIO } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { walkMinutes, routeById, locationById } from "../src/systems/travel.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { isKnown } from "../src/systems/places.js";

const data = await loadData();
const HUBS = { wilczy_brod: "pogorze", gluszec: "glusz", obserwatorium: "gwiazdy", oboz_wronia: "front", ulfgrod: "stolica", przystan_jarnowo: "jarnowo" };
const near = (hub) => data.travel.locations.filter((l) => l.region === HUBS[hub] && l.near).map((l) => ({ id: l.id, minutes: walkMinutes(data, hub, l.id) }));
const far = (hub) => data.travel.locations.filter((l) => l.region === HUBS[hub] && l.far);

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

test("odległości: każdy hub ma lokacje bliskie (≤ 60 min), średnie (90–480 min) i dalekie (podróż)", () => {
  for (const hub of Object.keys(HUBS)) {
    const minutes = near(hub).map((n) => n.minutes);
    assert.ok(minutes.some((m) => m <= 60), `${hub}: brak bliskiej`);
    assert.ok(minutes.filter((m) => m >= 90 && m <= 480).length >= 2, `${hub}: za mało średnich`);
    assert.ok(minutes.every((m) => m <= 60 || m >= 90), `${hub}: lokacja w szarej strefie 61–89 min`);
    assert.ok(far(hub).length >= 2, `${hub}: za mało dalekich`);
  }
});

test("odległości: najdalsze miejsce każdego huba jest o 4 dni drogi, dalekie miejsca zróżnicowane (2–4 dni)", () => {
  for (const hub of Object.keys(HUBS)) {
    const days = far(hub).map((l) => routeById(data, l.far.route).days);
    assert.equal(Math.max(...days), 4, hub);
    assert.ok(new Set(days).size >= 2, `${hub}: wszystkie dalekie w tej samej odległości`);
  }
});

test("odległości: każde dalekie miejsce ma pole walki, znalezisko i postać do pogadania (≥4 stany)", () => {
  for (const hub of Object.keys(HUBS)) {
    for (const l of far(hub)) {
      assert.ok(l.spots.some((s) => s.type === "hunt"), `${l.id}: brak pola walki`);
      assert.ok(l.spots.some((s) => s.type === "scene" && s.scenes.some((x) => x.type === "reward")), `${l.id}: brak znaleziska`);
      assert.ok(l.spots.some((s) => s.type === "scene" && s.scenes.filter((x) => x.type === "narration").length >= 4), `${l.id}: brak postaci do pogadania`);
      assert.ok(l.secret && l.hint, `${l.id}: ukryte z podpowiedzią`);
    }
  }
});

test("odległości: dwie trasy hub–hub, a historia używa ich zamiast gołych narracji", () => {
  assert.equal(routeById(data, "wilczy_brod_gluszec").days, 3);
  assert.equal(routeById(data, "gluszec_obserwatorium").days, 2);
  const travelScenes = data.story.scenes.filter((s) => s.type === "travel").map((s) => s.route);
  assert.ok(travelScenes.includes("wilczy_brod_gluszec") && travelScenes.includes("gluszec_obserwatorium"));
  for (const id of ["akt3_wejscie", "akt3b_wejscie"]) assert.equal(data.story.scenes.find((s) => s.id === id).time, undefined, `${id}: czas liczy trasa`);
});

test("odległości: pola walki w bliskich lokacjach – po dwa w hubie, wszystkie z clearedBy w swoich scenach", () => {
  const hunts = (hub) => data.travel.locations.filter((l) => l.region === HUBS[hub]).flatMap((l) => (l.spots ?? []).filter((s) => s.type === "hunt").map((s) => ({ loc: l, spot: s })));
  for (const hub of Object.keys(HUBS)) {
    assert.ok(hunts(hub).filter((h) => h.loc.near).length >= 2, `${hub}: za mało pól walki w pobliżu`);
    for (const { spot } of hunts(hub)) assert.ok(spot.scenes.some((s) => s.id === spot.clearedBy && s.type === "combat"));
  }
});

test("odległości: każda lokacja regionu ma znacznik {id} na mapie, a dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  for (const [hub, region] of Object.entries(HUBS)) {
    const tokens = new Set([...data.maps[region].matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]));
    for (const l of data.travel.locations.filter((x) => x.region === region && (x.near || x.far || x.id === hub))) assert.ok(tokens.has(l.id), `${l.id} bez znacznika na mapie ${region}`);
  }
});

test("odległości: każde dalekie miejsce da się odkryć z nowej gry (reveal w rozmowie)", () => {
  const text = JSON.stringify(data.dialogues);
  for (const l of data.travel.locations.filter((x) => x.far)) assert.ok(text.includes(`"reveal":"${l.id}"`) || text.includes(`"reveal": "${l.id}"`), `${l.id}: nikt go nie ujawnia`);
});

test("odległości: wyjście z huba fabułą (exitWhen) odsyła gracza do huba, więc podróż hub–hub zawsze ma skąd ruszyć", async () => {
  const d = structuredClone(minimalData());
  d.story = { start: "mapa", scenes: [
    { id: "mapa", type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Dalej", goto: "koniec_gry" }, exitWhen: { if: { flag: "koniec_aktu" }, goto: "koniec_gry" } },
    { id: "koniec_gry", type: "ending", text: "Koniec." },
  ] };
  const state = createNewState({ seed: 1, startScene: "mapa", rules: d.rules });
  const cs = combatState(d, "miecz");
  state.character = cs.character; state.inventory = cs.inventory;
  state.world.location = "stary_mlyn"; // the player is away from the hub when the act ends
  state.flags.koniec_aktu = true;
  const result = await defaultHandlers.map({ state, data: d, io: createAdaptiveIO([]), rng: createRng(1), debug: false, notices: [] }, d.story.scenes[0]);
  assert.deepEqual(result, { goto: "koniec_gry" });
  assert.equal(state.world.location, "wilczy_brod");
});

test("odległości: podróż trasą hub–hub (3 dni) kończy się w Głuszcu", async () => {
  const d = structuredClone(data);
  d.rules.travel.eventChance = 0;
  const state = createNewState({ seed: 1, startScene: "mapa", rules: d.rules });
  const cs = combatState(d, "miecz");
  state.character = cs.character; state.inventory = cs.inventory;
  state.time.minutes = 9 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  const SLEEP = ["1+++", "2", ""];
  const STAGE = ["", "", "", ...SLEEP];
  const io = createAdaptiveIO([...STAGE, ...STAGE, ...STAGE, ""]);
  const before = state.time.minutes;
  await defaultHandlers.travel({ state, data: d, io, rng: createRng(3), debug: false, notices: [] }, { id: "t", type: "travel", route: "wilczy_brod_gluszec" }).catch(() => {});
  assert.equal(state.world.location, "gluszec");
  assert.ok(state.time.minutes - before >= 2 * 24 * 60);
  assert.ok(isKnown(state, d, "gluszec") && locationById(d, "gluszec"));
});
