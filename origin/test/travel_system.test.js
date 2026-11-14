import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import {
  startTravel, rollStageEvent, marchHour, finishStage, forageChance, forage, markEventSeen, endTravel, nextDay, currentRegion,
} from "../src/systems/travel.js";
import { countOf } from "../src/systems/inventory.js";
import { evaluate } from "../src/engine/conditions.js";

const H = 60;
const data = minimalData();

/** Rng answering `int` from `values` in order; throws when asked for more (so "no rolls" is checked too). */
function scripted(values = []) {
  const queue = [...values];
  return { int(min, max) {
    if (queue.length === 0) throw new Error(`rng: nieoczekiwany rzut int(${min}, ${max})`);
    return queue.shift();
  }, left: () => queue.length };
}
function traveller({ hour = 6, bystrosc = 5 } = {}) {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.character.attributes.bystrosc = bystrosc;
  s.time.minutes = hour * H;
  s.world.phenomenonRolledDay = 99;
  return s;
}
const rain = (s, hours) => { s.world.phenomenon = { id: "ulewa", startsAt: s.time.minutes, endsAt: s.time.minutes + hours * H, omenAt: 0, omenShown: true, started: true }; };

test("nowy stan – lokacja startowa, brak podróży; startTravel z innej lokacji rzuca", () => {
  const s = traveller();
  assert.equal(s.world.location, "brzezina");
  assert.equal(s.world.travel, null);
  assert.deepEqual(s.world.eventsSeen, []);
  startTravel(s, data, "brzezina_wilczy_brod");
  assert.deepEqual(s.world.travel, {
    route: "brzezina_wilczy_brod", day: 1, daysTotal: 2, phase: "depart", event: null, eventHour: null, eventScene: null,
    hoursWalked: 0, slowHours: 0, slowBy: null, dangerous: false, delayed: false, foraged: false, reverse: false, quest: null, turnBack: false,
  });
  const other = traveller();
  other.world.location = "wilczy_brod";
  assert.throws(() => startTravel(other, data, "brzezina_wilczy_brod"), /wilczy_brod/);
});

test("rollStageEvent – dzień 1 stałe zdarzenie (tylko rzut godziny), dzień 2 rzut szansy i wybór ważony", () => {
  const s = traveller();
  const noFixed2 = structuredClone(data); // day 2 of the real route is the fixed night event; these tests check the random pool
  delete noFixed2.travel.routes.find((r) => r.id === "brzezina_wilczy_brod").fixed["2"];
  startTravel(s, noFixed2, "brzezina_wilczy_brod");
  const r1 = scripted([5]);
  assert.deepEqual(rollStageEvent(s, noFixed2, r1), { id: "bandyci_na_trakcie", hour: 5 });
  assert.equal(r1.left(), 0);
  s.world.travel.day = 2;
  assert.equal(rollStageEvent(s, noFixed2, scripted([56])), null);
  // weights in file order: pielgrzym 1–3, glodny 4–5, kupiec 6–7, wilki 8–9, ulewa 10–11, cisza 12–15
  for (const [roll, id] of [[1, "pielgrzym"], [3, "pielgrzym"], [4, "glodny_wedrowiec"], [9, "wilki"], [10, "ulewa_nadciaga"], [15, "cisza"]]) {
    const rng = scripted([40, roll, 2]);
    assert.deepEqual(rollStageEvent(s, noFixed2, rng), { id, hour: 2 }, `rzut ${roll}`);
    assert.equal(rng.left(), 0);
  }
});

test("rollStageEvent – once, if, niebezpieczne zjawisko (60% i ataki ×2), pusta pula", () => {
  const s = traveller();
  const noFixed2 = structuredClone(data); // day 2 of the real route is the fixed night event; these tests check the random pool
  delete noFixed2.travel.routes.find((r) => r.id === "brzezina_wilczy_brod").fixed["2"];
  startTravel(s, noFixed2, "brzezina_wilczy_brod");
  s.world.travel.day = 2;
  for (const id of ["pielgrzym", "glodny_wedrowiec", "kupiec_wedrowny"]) markEventSeen(s, noFixed2, id);
  markEventSeen(s, noFixed2, "wilki"); // not `once`: stays in the pool
  assert.deepEqual(s.world.eventsSeen, ["pielgrzym", "glodny_wedrowiec", "kupiec_wedrowny"]);
  // pool: wilki 1–2, ulewa 3–4, cisza 5–8
  assert.equal(rollStageEvent(s, noFixed2, scripted([40, 3, 2])).id, "ulewa_nadciaga");
  s.time.minutes = 22 * H; // night: the rain's `if` (dawn/day) fails; attacks ×3 in the dark → wilki 1–6, cisza 7–10
  assert.equal(rollStageEvent(s, noFixed2, scripted([40, 3, 2])).id, "wilki");
  assert.equal(rollStageEvent(s, noFixed2, scripted([40, 7, 2])).id, "cisza");
  assert.equal(rollStageEvent(s, noFixed2, scripted([75, 7, 2])).id, "cisza", "w nocy szansa 55 + 20");
  assert.equal(rollStageEvent(s, noFixed2, scripted([76])), null);
  s.time.minutes = 6 * H;
  s.world.phenomenon = { id: "burza_iskier", startsAt: 0, endsAt: 20 * H, omenAt: 0, omenShown: true, started: true };
  assert.equal(rollStageEvent(s, noFixed2, scripted([60, 4, 2])).id, "wilki", "60 ≤ 60, wilki ×2 = 1–4");
  assert.equal(s.world.travel.dangerous, true);
  assert.equal(rollStageEvent(s, noFixed2, scripted([61])), null);
  const empty = structuredClone(noFixed2);
  empty.travel.events = empty.travel.events.map((e) => (e.id === "bandyci_na_trakcie" ? e : { ...e, weight: 0 }));
  s.world.phenomenon = null;
  const rng = scripted([1]);
  assert.equal(rollStageEvent(s, empty, rng), null);
  assert.equal(rng.left(), 0);
});

test("marsz w ulewie – 1 h bez opóźnienia, 2 h → +1 dzień, tylko raz na etap; nextDay zeruje etap", () => {
  const s = traveller();
  startTravel(s, data, "brzezina_wilczy_brod");
  rain(s, 1);
  for (let h = 0; h < 10; h++) marchHour(s, data, { int: (a) => a });
  assert.equal(s.world.travel.hoursWalked, 10);
  assert.equal(s.world.travel.slowHours, 1);
  assert.deepEqual(finishStage(s, data), { delayed: false });
  assert.equal(s.world.travel.daysTotal, 2);
  s.world.travel.foraged = true;
  nextDay(s);
  assert.equal(s.world.travel.day, 2);
  assert.equal(s.world.travel.phase, "depart");
  assert.equal(s.world.travel.hoursWalked, 0);
  assert.equal(s.world.travel.foraged, false);
  rain(s, 5);
  for (let h = 0; h < 10; h++) marchHour(s, data, { int: (a) => a });
  assert.deepEqual(finishStage(s, data), { delayed: true, by: "ulewa" });
  assert.equal(s.world.travel.daysTotal, 3);
  assert.deepEqual(finishStage(s, data), { delayed: false }, "drugi raz w tym etapie – bez zmian");
  assert.equal(s.world.travel.daysTotal, 3);
  endTravel(s, data);
  assert.equal(s.world.location, "wilczy_brod");
  assert.equal(s.world.travel, null);
});

test("szansa na pożywienie – Bystrość, noc, ulewa, limit", () => {
  assert.equal(forageChance(traveller({ hour: 18 }), data), 60);
  assert.equal(forageChance(traveller({ hour: 22 }), data), 40);
  const wet = traveller({ hour: 17 });
  rain(wet, 3);
  assert.equal(forageChance(wet, data), 50);
  assert.equal(forageChance(traveller({ hour: 12, bystrosc: 12 }), data), 90);
  assert.equal(forageChance(traveller({ hour: 23, bystrosc: 0 }), data), 10);
});

test("forage – godzina mija, sukces daje przedmiot z runa, porażka nic", () => {
  const s = traveller({ hour: 17 });
  startTravel(s, data, "brzezina_wilczy_brod");
  const t0 = s.time.minutes;
  // 18:00 after the hour: chance 60; pick: jagody 1–4, grzyby 5–7, orzechy 8–9, ziola 10
  const r = forage(s, data, scripted([60, 6, 2]));
  assert.deepEqual(r.found, { id: "grzyby", qty: 2 });
  assert.equal(countOf(s, "grzyby"), 2);
  assert.equal(s.time.minutes, t0 + 60);
  const miss = forage(s, data, scripted([61]));
  assert.equal(miss.found, null);
  assert.equal(countOf(s, "grzyby"), 2);
});

test("warunki region / location / travelDay w podróży i poza nią", () => {
  const s = traveller();
  assert.equal(currentRegion(s, data), "pogorze");
  assert.equal(evaluate({ location: "brzezina" }, s, data), true);
  assert.equal(evaluate({ region: "pogorze" }, s, data), true);
  assert.equal(evaluate({ travelDay: { gte: 1 } }, s, data), false, "poza podróżą");
  startTravel(s, data, "brzezina_wilczy_brod");
  s.world.travel.day = 2;
  assert.equal(evaluate({ travelDay: { gte: 2 } }, s, data), true);
  assert.equal(evaluate({ travelDay: { lte: 1 } }, s, data), false);
  assert.equal(evaluate({ travelDay: { gte: 1, lte: 2 } }, s, data), true);
  assert.equal(evaluate({ region: "pogorze" }, s, data), true);
});

test("stageArtId: wpis etapu; aktywne zjawisko z wpisem wygrywa na marszu i w obozie, nie przy wymarszu", async () => {
  const { stageArtId } = await import("../src/systems/travel.js");
  const d = structuredClone(data);
  d.travel.stageArt = { depart: "a1", march: "a2", camp: "a3", ulewa: "a4" };
  const s = createNewState({ seed: 1, startScene: "a", rules: d.rules });
  assert.equal(stageArtId(s, d, "depart"), "a1");
  assert.equal(stageArtId(s, d, "march"), "a2");
  assert.equal(stageArtId(s, d, "camp"), "a3");
  rain(s, 3);
  assert.equal(stageArtId(s, d, "march"), "a4");
  assert.equal(stageArtId(s, d, "camp"), "a4");
  assert.equal(stageArtId(s, d, "depart"), "a1");
  assert.equal(stageArtId(s, { ...d, travel: { ...d.travel, stageArt: undefined } }, "march"), null);
});

// --- E2a: endsTrip ---
import { validateData } from "../src/engine/data.js";

function withEndEvent(patch = {}, route = {}) {
  const d = structuredClone(data);
  d.travel.events.push({ id: "koniec_nocy", kind: "story", weight: 0, endsTrip: true, scenes: [{ id: "koniec_nocy_1", type: "narration", text: "Noc." }], ...patch });
  Object.assign(d.travel.routes.find((r) => r.id === "brzezina_wilczy_brod"), { fixed: { 1: "bandyci_na_trakcie", 2: "koniec_nocy" }, ...route });
  return d;
}
const errs = (d) => validateData(d).filter((e) => e.includes("koniec_nocy"));

test("endsTrip: poprawne zdarzenie (weight 0, wskazane w fixed) przechodzi walidację", () => {
  assert.deepEqual(errs(withEndEvent()), []);
});

test("endsTrip: weight > 0, brak w fixed i zdarzenie pogodowe są błędami", () => {
  assert.ok(errs(withEndEvent({ weight: 1 })).some((e) => e.includes("endsTrip: wymaga weight 0")), errs(withEndEvent({ weight: 1 })).join("\n"));
  const noFixed = errs(withEndEvent({}, { fixed: { 1: "bandyci_na_trakcie" } }));
  assert.ok(noFixed.some((e) => e.includes("endsTrip: zdarzenie nie jest wskazane w fixed żadnej trasy")), noFixed.join("\n"));
  const weather = errs(withEndEvent({ kind: "weather", scenes: undefined, phenomenon: "ulewa" }));
  assert.ok(weather.some((e) => e.includes("endsTrip: dozwolone tylko dla scenes")), weather.join("\n"));
});

test("zdarzenie kind story: losowanie go pomija (weight 0)", () => {
  const d = withEndEvent();
  assert.ok(d.travel.events.some((e) => e.kind === "story"));
});
