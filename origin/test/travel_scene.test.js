import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState, tmpDir, createAdaptiveIO } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { DefeatError } from "../src/scenes/errors.js";
import { loadGame } from "../src/engine/save.js";
import { countOf, removeItem, addItem, equip } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { renderDeparture, renderStageSummary, renderCampHeader } from "../src/ui/travel_screen.js";
import { startTravel } from "../src/systems/travel.js";

const H = 60;
const strip = (s) => stripVTControlCharacters(s);
const SCENE = { id: "podroz", type: "travel", route: "brzezina_wilczy_brod" };
/** Rest inputs: 4 hours on the slider, "Gotowe", then "Dalej" in the rest's camp menu. */
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

/** Real data with the route's fixed events replaced (`fixed`: day → event id) and no random events. */
function tripData(fixed, patch = () => {}) {
  const d = structuredClone(minimalData());
  d.travel.routes[0].fixed = fixed;
  d.rules.travel.eventChance = 0;
  d.rules.travel.dangerousEventChance = 0;
  d.story = { start: "podroz", scenes: [SCENE, { id: "koniec_gry", type: "ending", text: "Koniec." }] };
  patch(d);
  return d;
}
function tripState(data, { food = true } = {}) {
  const s = createNewState({ seed: 1, startScene: "podroz", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 9 * H;
  s.world.phenomenonRolledDay = 99; // no daily phenomenon rolls
  if (!food) removeItem(s, data, "prowiant", 2);
  return s;
}
const ctxOf = (state, data, io, seed = 3) => ({ state, data, io, rng: createRng(seed), debug: false, notices: [] });
const run = (ctx) => defaultHandlers.travel(ctx, SCENE);
const drained = async (ctx) => assert.rejects(ctx.io.ask("?"), InputExhaustedError);

test("pełna podróż 2 dni: wymarsz, zdarzenia, obóz z szukaniem pożywienia, posiłek, sen, dotarcie", async () => {
  const data = tripData({ 1: "cisza", 2: "pielgrzym" });
  const state = tripState(data);
  // day 1: depart, cisza, the evening (forage, then on); day 2: pielgrzym (narration, reward), the evening
  const ctx = ctxOf(state, data, createScriptedIO(["", "", "2", "", "", "", ""]));
  const result = await run(ctx);
  await drained(ctx);
  assert.equal(result, undefined);
  assert.equal(state.world.location, "wilczy_brod");
  assert.equal(state.world.travel, null);
  const out = strip(ctx.io.text());
  assert.match(out, /Droga: Wieś Brzezina → Strażnica Wilczy Bród/);
  assert.match(out, /Dzień 1 z 2/);
  assert.match(out, /Obóz – dzień 2 z 2/);
  assert.match(out, /Trakt wije się między brzozami/);
  assert.match(out, /stary pielgrzym/);
  assert.match(out, /Znajdujesz: .+ ×\d+\.|Nic jadalnego w okolicy\./);
  assert.match(out, /Zjadasz: /);
  assert.deepEqual(state.world.claimedRewards, ["pielgrzym_chleb"]);
  assert.deepEqual(state.world.eventsSeen, ["pielgrzym"]);
  // start 9:00 on day 1 → stages on days 2 and 3 → arrival at dawn of day 4
  assert.equal(state.time.minutes, 3 * 24 * H + 6 * H);
  // the auto slot holds the departure of day 2
  const saved = await loadGame("auto", data);
  assert.equal(saved.world.travel.day, 2);
  assert.equal(saved.world.travel.phase, "depart");
  assert.equal(saved.scene.id, "podroz");
});

test("ulewa ze zdarzenia → marsz wolniejszy, podróż trwa 3 dni", async () => {
  const data = tripData({ 1: "ulewa_nadciaga" });
  const state = tripState(data);
  // depart and the evening; the next days only their evenings (the rain is over by then)
  const ctx = ctxOf(state, data, createScriptedIO(["", "", "", ""]));
  await run(ctx);
  await drained(ctx);
  const out = strip(ctx.io.text());
  assert.match(out, /Ulewa – zaszedłeś tylko pół drogi\. Do celu dzień dłużej\./);
  assert.match(out, /Obóz – dzień 3 z 3/);
  assert.equal(state.world.location, "wilczy_brod");
});

test("bez jedzenia: w drodze głód rośnie, komunikat wypisuje skutki", async () => {
  const data = tripData({});
  const state = tripState(data, { food: false });
  const ctx = ctxOf(state, data, createScriptedIO(["", "", ""])); // the departure, then "Idź dalej" each evening
  await run(ctx);
  const out = strip(ctx.io.text());
  const said = [out, ...ctx.notices.map(strip)].join("\n");
  assert.match(said, /Głodny: Siła -1, Krzepa -1/);
  assert.ok(state.character.effects.some((e) => e.id === "glod"));
});

test("wilki: ucieczka → narracja ucieczki i dalszy marsz; zdarzenie nie-once może wrócić", async () => {
  const data = tripData({ 1: "wilki", 2: "wilki" });
  const state = tripState(data);
  const day = (fight) => ["", { fight }, "", ""]; // wolves narration, fight, after-fight narration, the evening
  const io = createAdaptiveIO(["", ...day("flee"), ...day("flee")]); // only the first day has a departure screen
  const ctx = ctxOf(state, data, io);
  await run(ctx);
  const out = strip(io.text());
  assert.equal(out.match(/Wdrapujesz się na zwalony pień/g)?.length, 2, "dwa razy uciekł przed wilkami");
  assert.equal(state.world.location, "wilczy_brod");
});

test("przegrana z wilkami bez onDefeat → koniec gry (DefeatError)", async () => {
  const data = tripData({ 1: "wilki" }, (d) => {
    d.enemies = d.enemies.map((e) => (e.id === "wilk" ? { ...e, attacks: [{ ...e.attacks[0], damage: [40, 40], hit: 100 }], initiative: 99 } : e));
  });
  const state = tripState(data);
  const ctx = ctxOf(state, data, createAdaptiveIO(["", "", { fight: "lose" }]));
  await assert.rejects(run(ctx), DefeatError);
});

test("wznowienie: w środku spotkania po nagrodzie – chleb tylko raz; w obozie po szukaniu – bez drugiego szukania", async () => {
  const data = tripData({ 1: "pielgrzym" });
  data.rules.appetite.fullHours = 10000; // nobody eats here: the count of bread is about the reward
  const state = tripState(data);
  // depart, pilgrim narration, then the reward's camp menu runs out of answers (the reward is already paid)
  const first = ctxOf(state, data, createScriptedIO(["", ""]));
  await assert.rejects(run(first), InputExhaustedError);
  assert.equal(state.world.travel.phase, "event");
  assert.equal(state.world.travel.eventScene, "pielgrzym_chleb");
  assert.equal(countOf(state, "prowiant"), 3);
  const loaded = structuredClone(state);
  // resume: reward camp menu, the evening: forage, then the answers run out in the camp menu
  const second = ctxOf(loaded, data, createScriptedIO(["", "2"]), 9);
  await assert.rejects(run(second), InputExhaustedError);
  assert.equal(countOf(loaded, "prowiant"), 3, "nagroda nie wypłacona drugi raz");
  assert.equal(loaded.world.travel.phase, "camp");
  assert.equal(loaded.world.travel.foraged, true);
  const again = structuredClone(loaded);
  const third = ctxOf(again, data, createScriptedIO(["", ""]), 11); // on from this evening; the evening of day 2
  await run(third);
  await drained(third);
  const firstCamp = strip(third.io.text()).split("Idź dalej")[0];
  assert.match(firstCamp, /Obóz – dzień 1 z 2/);
  assert.doesNotMatch(strip(third.io.text()).split("Obóz – dzień 2")[0], /Poszukaj pożywienia/, "szukanie już było tego wieczoru");
  assert.equal(again.world.location, "wilczy_brod");
});

test("wznowienie: w marszu (po zdarzeniu) zachowuje godziny i ulewę – opóźnienie tylko raz", async () => {
  const data = tripData({ 1: "ulewa_nadciaga" });
  const state = tripState(data);
  const first = ctxOf(state, data, createScriptedIO([""])); // depart; then the summary screen runs out of answers
  await assert.rejects(run(first), InputExhaustedError);
  assert.equal(state.world.travel.phase, "camp");
  assert.equal(state.world.travel.daysTotal, 3);
  const loaded = structuredClone(state);
  // this evening and the two after it
  const second = ctxOf(loaded, data, createScriptedIO(["", "", ""]), 5);
  await run(second);
  await drained(second);
  assert.equal(loaded.world.location, "wilczy_brod");
  assert.doesNotMatch(strip(second.io.text()), /Dzień 4 z/);
});

test("ekrany podróży mieszczą się w 80 kolumnach i kilku wierszach", () => {
  const data = tripData({});
  const state = tripState(data);
  state.character.name = "Bardzo Długie Imię Wojownika i Jego Konia Bojowego";
  startTravel(state, data, "brzezina_wilczy_brod");
  state.world.phenomenon = { id: "burza_iskier", startsAt: 0, endsAt: 30 * H, omenAt: 0, omenShown: true, started: true };
  const dep = renderDeparture(state, data).map(strip);
  assert.ok(dep.length <= 10, dep.join("\n"));
  assert.ok(dep.every((l) => [...l].length <= 80), dep.join("\n"));
  assert.ok(dep.some((l) => l.includes("Brzezina") && l.includes("●") && l.includes("○") && l.includes("Wilczy Bród")), dep.join("\n"));
  assert.ok(dep.some((l) => /Burza iskier – na trakcie niebezpiecznie/.test(l)), dep.join("\n"));
  const sum = renderStageSummary(state, data, { delayed: true, by: "ulewa" }).map(strip);
  assert.ok(sum.every((l) => [...l].length <= 80));
  assert.match(strip(renderCampHeader(state, data)), /Obóz – dzień 1 z 2/);
});

test("tryb TTY: ekran wymarszu z menu ≤ 23 wiersze", async () => {
  const data = tripData({});
  const state = tripState(data);
  const ctx = ctxOf(state, data, createScriptedIO([], { tty: true }));
  await assert.rejects(run(ctx), InputExhaustedError);
  const out = ctx.io.output.join("");
  const frame = strip(out.slice(out.lastIndexOf("\u001b[2J")));
  const rows = frame.split("\n").filter((l) => l !== "");
  assert.ok(rows.length <= 23, frame);
  assert.ok(rows.every((l) => [...l].length <= 80), frame);
  assert.match(frame, /Ruszaj w drogę/);
});

test("final: sterownik { trip } nie zapętla się – nieznany ekran po awarii kończy test błędem", async () => {
  const io = createAdaptiveIO([{ trip: { fight: "win" } }]);
  io.write(minimalData().ui["error.crash"]);
  io.write("[1] Nowa gra");
  let answers = 0;
  await assert.rejects(async () => { for (;;) { await io.ask("> "); answers++; io.write("Tworzenie postaci – Imię"); } }, /driver: podróż/);
  assert.ok(answers < 600, String(answers));
});

// --- spokojne dni: jeden ekran zamiast pięciu ---
const HP_MAX = (state, data) => getStats(state, data).derived.hpMax;

test("spokojna podróż: każdy dzień to jeden ekran, „Idź dalej” jest pierwszą opcją, bez suwaka snu i wymarszu; czas i posiłki jak dawniej", async () => {
  const data = tripData({});
  const state = tripState(data);
  state.character.hp = HP_MAX(state, data);
  const food = countOf(state, "prowiant");
  const ctx = ctxOf(state, data, createScriptedIO(["", "", ""])); // first departure, then one key an evening
  await run(ctx);
  await drained(ctx);
  const out = strip(ctx.io.text());
  assert.equal((out.match(/Zakładasz obóz, żeby odpocząć/g) ?? []).length, 2, out);
  assert.match(out, /Obóz – dzień 1 z 2/);
  assert.match(out, /Obóz – dzień 2 z 2/);
  assert.equal((out.match(/Ruszaj w drogę/g) ?? []).length, 1, "tylko pierwszy wymarsz");
  assert.doesNotMatch(out, /Ile godzin|Rozbij obóz|Koniec dnia drogi/);
  assert.match(out, /Idź dalej/);
  assert.equal(countOf(state, "prowiant"), food - 2, "dwa wieczory, dwa posiłki");
  assert.equal(state.time.minutes, 3 * 24 * H + 6 * H, "dotarcie o tym samym świcie co bez skrótu");
  assert.equal(state.world.location, "wilczy_brod");
});

test("spokojny wieczór: druga opcja szuka jedzenia raz, potem zostaje samo „Idź dalej”", async () => {
  const data = tripData({});
  const state = tripState(data);
  state.character.hp = HP_MAX(state, data);
  const ctx = ctxOf(state, data, createScriptedIO(["", "2", "", ""]));
  await run(ctx);
  await drained(ctx);
  assert.match(strip(ctx.io.text()), /Znajdujesz: .+ ×\d+\.|Nic jadalnego w okolicy\./);
});

test("po zdarzeniu i przy ranach wieczór to też jeden ekran; sen sam leczy i mówi ile; suwak tylko przy artefakcie do ładowania", async () => {
  const evening = async (data, change, inputs = ["", ""]) => {
    const state = tripState(data);
    state.character.hp = HP_MAX(state, data);
    change(state);
    const ctx = ctxOf(state, data, createScriptedIO(inputs));
    await assert.rejects(run(ctx), InputExhaustedError);
    return { state, ctx, text: strip(ctx.io.text()) };
  };
  const afterEvent = await evening(tripData({ 1: "cisza" }), () => {}, ["", "", ""]);
  assert.match(afterEvent.text, /Zakładasz obóz, żeby odpocząć/);
  assert.doesNotMatch(afterEvent.text.split("Obóz – dzień 2")[0], /Spokojny dzień|Koniec dnia drogi|Ile godzin/);

  const wounded = await evening(tripData({}), (state) => { state.character.hp = 5; });
  assert.doesNotMatch(wounded.text, /Ile godzin|Koniec dnia drogi/);
  assert.ok(wounded.state.character.hp > 5, "sen leczy");
  assert.match(strip(wounded.ctx.io.text()), /Odpoczywasz \d+ godz\. Odzyskujesz \d+ HP\./);

  const data = tripData({});
  const uncharged = await evening(data, (state) => {
    addItem(state, data, "kamien_zmierzchu", 1);
    equip(state, data, "kamien_zmierzchu", "talizman");
    state.artifacts.kamien_zmierzchu.charge = 5;
  });
  assert.match(uncharged.text, /Rozbij obóz/);
  assert.match(uncharged.text, /Wystawić artefakt/);
});

test("późny obóz: sen nie przesypia świtu, podróż nie traci przez to dnia", async () => {
  const data = tripData({});
  const state = tripState(data);
  state.character.hp = HP_MAX(state, data);
  const ctx = ctxOf(state, data, createScriptedIO(["", ""]));
  await assert.rejects(run(ctx), InputExhaustedError); // the evening of day 2
  const evening = state.time.minutes;
  state.time.minutes = evening + (23 * H - (evening % (24 * H))); // a road event dragged the day out till 23:00
  const next = ctxOf(state, data, createScriptedIO([""]), 4);
  await run(next);
  assert.equal(state.world.location, "wilczy_brod");
  const hours = (state.time.minutes - (evening + (23 * H - (evening % (24 * H))))) / H;
  assert.equal(hours, 7, "z 23:00 do 6:00");
});

test("spokojny wieczór z jedynej strony: ostrzeżenie o pogodzie wraca na ekran wymarszu, a przerwanie i wczytanie zaczyna od wymarszu", async () => {
  const data = tripData({});
  const state = tripState(data);
  state.character.hp = HP_MAX(state, data);
  const first = ctxOf(state, data, createScriptedIO(["", ""]));
  await assert.rejects(run(first), InputExhaustedError);
  assert.equal(state.world.travel.day, 2);
  assert.equal(state.world.travel.phase, "camp", "dzień 2 przeszedł bez pytań aż do wieczoru");
  const saved = await loadGame("auto", data);
  assert.equal(saved.world.travel.day, 2);
  assert.equal(saved.world.travel.phase, "depart");
  const resumed = ctxOf(saved, data, createScriptedIO(["", ""]), 4);
  await run(resumed);
  assert.match(strip(resumed.io.text()), /Ruszaj w drogę/, "po wczytaniu gracz widzi, gdzie jest");
  assert.equal(saved.world.location, "wilczy_brod");
});
