import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { evaluate } from "../src/engine/conditions.js";
import { startQuest, failQuest, expireQuests, advanceErrands, currentObjectives, questById } from "../src/systems/quests.js";
import { visibleSpots } from "../src/systems/spots.js";
import { pushEventNotices } from "../src/ui/events.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { createAdaptiveIO, combatState } from "./helpers.js";
import { InputExhaustedError } from "../src/ui/io.js";

const data = await loadData();
const ID = "eskorta_ostromira";
let prevHome;
beforeEach(() => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "ostrze-escort-")); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function hub() {
  const cs = combatState(data, "miecz");
  const s = createNewState({ seed: 1, startScene: "demo_mapa", rules: data.rules });
  Object.assign(s, { character: cs.character, inventory: cs.inventory });
  s.world.location = "wilczy_brod";
  s.world.phenomenonRolledDay = 99;
  s.flags.dlug_oddany = true;
  startQuest(s, data, "watek_wilczy_brod");
  return s;
}
const gate = (s) => visibleSpots(s, data, "wilczy_brod").find(({ spot }) => spot.id === "woz_ostromira");

/** The real hub: picks by label until the script runs out. */
async function play(state, picks) {
  const scene = data.story.scenes.find((s) => s.id === "demo_mapa");
  const io = createAdaptiveIO(picks.map((pick) => ({ pick })));
  const ctx = { state, data, io, rng: createRng(3), debug: false, notices: [] };
  await assert.rejects(defaultHandlers.map(ctx, scene), InputExhaustedError);
  return stripVTControlCharacters(io.text());
}
function lostInAmbush(s) {
  startQuest(s, data, ID);
  advanceErrands(s, data, createRng(1));
  s.flags.ostromir_ograbiony = true; // set by the ambush's own scenes (checked below)
  failQuest(s, data, ID);
  advanceErrands(s, data, createRng(1));
}

test("porażka w napadzie: wóz stoi przy bramie, wątek główny tam prowadzi", () => {
  const s = hub();
  lostInAmbush(s);
  assert.equal(s.quests[ID].status, "failed");
  assert.equal(gate(s)?.available, true);
  assert.deepEqual(currentObjectives(s, data).filter((c) => c.quest.id === "watek_wilczy_brod").map((c) => c.objective.at), ["wilczy_brod.woz_ostromira"]);
});

test("minęły 3 dni: wóz też stoi przy bramie", () => {
  const s = hub();
  startQuest(s, data, ID);
  advanceErrands(s, data, createRng(1));
  s.time.minutes = s.quests[ID].deadline + 1;
  expireQuests(s, data);
  assert.equal(gate(s)?.available, true);
});

test("wzięta albo wykonana eskorta: przy bramie nic nie stoi", () => {
  const s = hub();
  startQuest(s, data, ID);
  assert.equal(gate(s), undefined);
  s.quests[ID].status = "done";
  assert.equal(gate(s), undefined);
});

test("prawdziwy hub po napadzie: rozmowa przy bramie wznawia zadanie bez wycieczki na Trakt", async () => {
  const s = hub();
  lostInAmbush(s);
  const text = await play(s, ["! Wóz Ostromira", "Dalej", "Jedziemy", "Bywaj"]);
  assert.match(text, /cudze buty/);
  assert.doesNotMatch(text, /Dług oddany, słowo dotrzymane/, "bez powitania z pierwszej rozmowy");
  assert.equal(s.quests[ID].status, "active");
  assert.ok(s.quests[ID].deadline > s.time.minutes, "nowy termin");
  assert.equal(s.flags.ostromir_ograbiony, false);
});

test("prawdziwy hub po upływie terminu: kupiec mówi o terminie, nie o napadzie", async () => {
  const s = hub();
  startQuest(s, data, ID);
  advanceErrands(s, data, createRng(1));
  s.time.minutes = s.quests[ID].deadline + 1;
  expireQuests(s, data);
  const text = await play(s, ["! Wóz Ostromira", "Dalej", "Jedziemy", "Bywaj"]);
  assert.match(text, /Trzy dni czekałem/);
  assert.doesNotMatch(text, /cudze buty/);
  assert.equal(s.quests[ID].status, "active");
});

test("odmowa przy bramie nie startuje zadania, mimo starej zgody z pierwszego razu; wóz czeka dalej", async () => {
  const s = hub();
  s.flags.ostromir_zgoda = true;
  lostInAmbush(s);
  await play(s, ["! Wóz Ostromira", "Dalej", "Jeszcze nie", "Bywaj"]);
  assert.equal(s.quests[ID].status, "failed");
  assert.equal(gate(s)?.available, true);
});

test("drugi raz stracona eskorta też wraca do bramy", async () => {
  const s = hub();
  lostInAmbush(s);
  await play(s, ["! Wóz Ostromira", "Dalej", "Jedziemy", "Bywaj"]);
  s.flags.ostromir_ograbiony = true;
  failQuest(s, data, ID);
  assert.equal(gate(s)?.available, true);
  await play(s, ["! Wóz Ostromira", "Dalej", "Jedziemy", "Bywaj"]);
  assert.equal(s.quests[ID].status, "active");
});

test("napad: przegrana i ucieczka mają własny tekst, obie zaznaczają rabunek i odsyłają do Brodu", () => {
  const scenes = questById(data, ID).events[0].scenes;
  const fight = scenes.find((x) => x.type === "combat");
  assert.notEqual(fight.onDefeat, fight.onFlee);
  assert.match(scenes.find((x) => x.id === fight.onDefeat).text, /dochodzisz do siebie/);
  assert.doesNotMatch(scenes.find((x) => x.id === fight.onFlee).text, /dochodzisz do siebie/);
  assert.equal(scenes.find((x) => x.type === "flag").set.ostromir_ograbiony, true);
  assert.ok(scenes.some((x) => /Brodu/.test(x.text ?? "")));
});

test("po oddaniu długu Ostromira nie ma już na Trakcie, a Trakt nie daje eskorty", () => {
  const before = createNewState({ seed: 1, startScene: "demo_mapa", rules: data.rules });
  before.world.discovered = ["trakt_kupiecki"];
  assert.ok(visibleSpots(before, data, "trakt_kupiecki").some(({ spot }) => spot.id === "ostromir"), "przed długiem stoi na Trakcie");
  before.flags.dlug_oddany = true;
  assert.ok(!visibleSpots(before, data, "trakt_kupiecki").some(({ spot }) => spot.id === "ostromir"));
  assert.ok(!JSON.stringify(data.dialogues.find((d) => d.id === "ostromir_trakt")).includes("startQuest"));
});

test("Ostromir z losowego spotkania nie proponuje eskorty, gdy już została wzięta lub stracona", () => {
  const event = data.travel.events.find((e) => e.id === "kupiec_ostromir");
  const s = hub();
  s.world.location = "wilczy_brod";
  const holds = () => evaluate(event.if, s, data);
  assert.equal(holds(), true);
  startQuest(s, data, ID);
  assert.equal(holds(), false);
  failQuest(s, data, ID);
  assert.equal(holds(), false);
});

test("komunikat o stracie zadania kluczowego mówi, dokąd wrócić, zamiast że przepadło", () => {
  for (const event of [{ type: "zadanie_przepadlo", id: ID }, { type: "zadanie_przepadlo", id: ID, expired: true }]) {
    const ctx = { data, notices: [], state: {} };
    pushEventNotices(ctx, [event]);
    const text = stripVTControlCharacters(ctx.notices.join(" "));
    assert.match(text, /Wóz Ostromira przy bramie/);
    assert.doesNotMatch(text, /przepadło/);
  }
});

// --- the rule for the whole game ---
const questsIn = (c) => (Array.isArray(c) ? c.flatMap(questsIn) : c && typeof c === "object" ? [...(c.questStatus ? [c.questStatus.id] : []), ...Object.values(c).flatMap(questsIn)] : []);
const failedSomewhere = (node) => (Array.isArray(node) ? node.flatMap(failedSomewhere) : node && typeof node === "object" ? [...(typeof node.fail === "string" ? [node.fail] : []), ...Object.values(node).flatMap(failedSomewhere)] : []);

test("zasada: każde zadanie, którego wymaga główny wątek, a które da się stracić, ma drogę powrotną w swoim hubie", () => {
  const needed = new Set(data.quests.filter((q) => q.main).flatMap((q) => q.objectives.flatMap((o) => questsIn(o.done))));
  const canFail = new Set(failedSomewhere([data.quests, data.story, data.travel, data.dialogues]));
  const risky = data.quests.filter((q) => needed.has(q.id) && (q.deadlineDays || canFail.has(q.id)));
  assert.deepEqual(risky.map((q) => q.id), [ID], "nowe zadanie do stracenia w głównym wątku: dodaj mu drogę powrotną");
  for (const quest of risky) {
    assert.ok(quest.retryAt, `${quest.id}: brak retryAt`);
    const [locationId, spotId] = quest.retryAt.split(".");
    const spot = data.travel.locations.find((l) => l.id === locationId).spots.find((x) => x.id === spotId);
    assert.ok(spot.scenes.some((x) => x.type === "quest" && x.start === quest.id), `${quest.id}: ${quest.retryAt} nie wznawia zadania`);
    const s = hub();
    s.quests[quest.id] = { status: "failed" };
    assert.equal(evaluate(spot.if, s, data), true, `${quest.id}: ${quest.retryAt} zamknięte po stracie`);
  }
});
