import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { runTrip } from "../src/scenes/trip.js";
import { startTravel } from "../src/systems/travel.js";
import { enterNode, chooseOption, nodeView } from "../src/systems/dialogue.js";
import { getStats } from "../src/systems/stats.js";
import { applyEffect } from "../src/systems/effects.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const data = await loadData();
const fixed = (k) => ({ int: () => k });
let savedHome;
beforeEach(async () => {
  savedHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
});
afterEach(() => {
  if (savedHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = savedHome;
});

function hero(classId = "miecz") {
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  const cs = combatState(data, classId);
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 9 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "brzezina";
  return state;
}
const pick = (state, dialogue, node, key, roll = 1) => {
  enterNode(state, data, dialogue, node, fixed(roll));
  return chooseOption(state, data, dialogue, node, key, fixed(roll));
};
const event = (id) => data.travel.events.find((e) => e.id === id);

test("dane aktu I przechodzą walidację; noc_upiorow: story, weight 0, endsTrip, fixed dnia 2", () => {
  assert.deepEqual(validateData(data), []);
  const e = event("noc_upiorow");
  assert.equal(e.kind, "story");
  assert.equal(e.weight, 0);
  assert.equal(e.endsTrip, true);
  assert.equal(data.travel.routes.find((r) => r.id === "brzezina_wilczy_brod").fixed["2"], "noc_upiorow");
  assert.equal(data.travel.routes.find((r) => r.id === "brzezina_wilczy_brod").fixed["1"], "bandyci_na_trakcie");
});

test("noc upiorów: kolejność scen i walka nie do wygrania z onDefeat", () => {
  const ids = event("noc_upiorow").scenes.map((s) => s.id);
  const order = ["noc_zmierzch", "noc_burza", "noc_atak", "noc_walka", "noc_omdlenie", "noc_zaglada", "noc_flaga", "noc_przebudzenie", "noc_swit", "noc_flaga_insygnia", "noc_pobojowisko", "noc_rozdroze", "noc_bezdroza"];
  assert.deepEqual(ids, order);
  const fight = event("noc_upiorow").scenes.find((s) => s.id === "noc_walka");
  assert.deepEqual(fight.enemies, [{ id: "upior_nocy", count: 2 }]);
  assert.equal(fight.canFlee, false);
  assert.equal(fight.onDefeat, "noc_omdlenie");
});

/** Plays day 2 of the route from the departure screen: the night event ends the trip. */
async function playNight(state, io) {
  startTravel(state, data, "brzezina_wilczy_brod");
  Object.assign(state.world.travel, { day: 2, phase: "depart", daysTotal: 2 });
  const ctx = { state, data, io, rng: createRng(5), debug: false, notices: [] };
  await runTrip(ctx, { route: "brzezina_wilczy_brod" });
  return ctx;
}

for (const classId of ["miecz", "wlocznia"]) {
  test(`noc upiorów (${classId}): porażka w walce → zagłada, Istota leczy, podróż kończy się świtem w Wilczym Brodzie`, async () => {
    const state = hero(classId);
    state.character.hp = 3;
    applyEffect(state, data, "glod", fixed(1));
    state.flags.rozkaz_danina = true;
    await playNight(state, createAdaptiveIO([{ trip: { fight: "lose" } }]));
    assert.equal(state.flags.towarzysze_zgineli, true);
    assert.equal(state.flags.dlug_istoty, true);
    assert.equal(state.flags.ukryte_insygnia, true);
    assert.equal(state.character.hp, getStats(state, data).derived.hpMax);
    assert.deepEqual((state.character.effects ?? []).map((e) => e.id).filter((id) => !id.startsWith("glod")), []); // hunger follows the gauge
    assert.equal(state.world.location, "wilczy_brod");
    assert.equal(state.world.travel, null);
    assert.equal(state.time.minutes % 1440, data.rules.travel.departHour * 60);
  });
}

test("noc upiorów: zapis w środku zdarzenia (eventScene = noc_zaglada) wznawia i kończy podróż", async () => {
  const state = hero();
  startTravel(state, data, "brzezina_wilczy_brod");
  Object.assign(state.world.travel, { day: 2, phase: "event", event: "noc_upiorow", eventHour: 0, hoursWalked: 0, eventScene: "noc_zaglada" });
  const ctx = { state, data, io: createAdaptiveIO([{ trip: { fight: "lose" } }]), rng: createRng(5), debug: false, notices: [] };
  await runTrip(ctx, { route: "brzezina_wilczy_brod" });
  assert.equal(state.flags.towarzysze_zgineli, true);
  assert.equal(state.flags.dlug_istoty, true);
  assert.equal(state.world.location, "wilczy_brod");
  assert.equal(state.world.travel, null);
});

test("istota: wejście leczy i ustawia dlug_istoty; „Rozkaz cesarza…” tylko z rozkaz_danina", () => {
  const plain = hero();
  plain.character.hp = 2;
  enterNode(plain, data, "istota", "nadejscie", fixed(1));
  assert.equal(plain.character.hp, getStats(plain, data).derived.hpMax);
  assert.equal(plain.flags.dlug_istoty, true);
  assert.deepEqual(nodeView(plain, data, "istota", "nadejscie").options.map((o) => o.key), ["dalej"]);

  const withOrder = hero();
  withOrder.flags.rozkaz_danina = true;
  const keys = nodeView(withOrder, data, "istota", "nadejscie").options.map((o) => o.key);
  assert.deepEqual(keys, ["cesarz", "dalej"]);
  const node = data.dialogues.find((d) => d.id === "istota").nodes;
  assert.match(node[chooseOption(withOrder, data, "istota", "nadejscie", "cesarz", fixed(1)).next].text, /Rozkaz cesarza nie był poselstwem\./);
});

test("istota: pokora +1 dług, buntownicza +1 wola, pytająca ustawia pytanie_o_dlug", () => {
  const a = hero();
  pick(a, "istota", "wybor", "pokora");
  assert.equal(a.vars.dlug, 1);
  const b = hero();
  pick(b, "istota", "wybor", "bunt");
  assert.equal(b.vars.wola, 1);
  const c = hero();
  pick(c, "istota", "wybor", "pytanie");
  assert.equal(c.vars.dlug ?? 0, 0);
  assert.equal(c.vars.wola ?? 0, 0);
});

test("istota: dialog zawiera słowa z koncepcji", () => {
  const text = JSON.stringify(data.dialogues.find((d) => d.id === "istota"));
  assert.match(text, /Tkanka zrośnięta\. Rdzeń sprawny\. Dług zaciągnięty\. Zniszcz to, co zbudowano na tej ziemi\./);
});

test("ognisko: Wojmir – ciepło ustawia towarzysze_zaufanie i +1 dług; Ragnosława – posłuch +1 dług, sprawdzanie +1 wola", () => {
  const a = hero();
  let r = pick(a, "ognisko", "ogien", "wojmir");
  r = pick(a, "ognisko", r.next, "cieplo");
  enterNode(a, data, "ognisko", r.next, fixed(1));
  assert.equal(a.flags.towarzysze_zaufanie, true);
  assert.equal(a.vars.dlug, 1);

  const b = hero();
  r = pick(b, "ognisko", "ogien", "ragnoslawa");
  pick(b, "ognisko", r.next, "posluch");
  assert.equal(b.vars.dlug, 1);

  const c = hero();
  r = pick(c, "ognisko", "ogien", "ragnoslawa");
  pick(c, "ognisko", r.next, "sprawdz");
  assert.equal(c.vars.wola, 1);
});

test("zdarzenie bandytów: po walce i po ucieczce wracają przy ognisku (dialog ognisko), potem koniec zdarzenia", () => {
  const scenes = event("bandyci_na_trakcie").scenes;
  assert.equal(scenes.find((s) => s.id === "bandyci_po_walce").goto, "bandyci_ognisko");
  assert.equal(scenes.find((s) => s.id === "bandyci_ucieczka").goto, "bandyci_ognisko");
  const camp = scenes.find((s) => s.id === "bandyci_ognisko");
  assert.equal(camp.type, "dialogue");
  assert.equal(camp.dialogue, "ognisko");
  assert.equal(camp.goto, "koniec");
});

test("demo_kurier: strażnica przyjmuje półżywego ocalałego (wzmianka o insygniach)", () => {
  const k = data.story.scenes.find((s) => s.id === "demo_kurier");
  assert.match(k.text, /insygni/i);
  assert.doesNotMatch(k.text, /ma być u bram/);
});

// --- zegar zgodny z narracją (po recenzji) ---
test("noc upiorów: zmierzch o 18:00, atak o 21:00, przebudzenie o 2:00, „Świt” o 5:00 – bez względu na godzinę zdarzenia", async () => {
  for (const eventHour of [2, 5, 8]) {
    const state = hero();
    startTravel(state, data, "brzezina_wilczy_brod");
    Object.assign(state.world.travel, { day: 2, phase: "march", event: "noc_upiorow", eventHour, hoursWalked: eventHour });
    state.time.minutes = 2 * 1440 + (6 + eventHour) * 60;
    const io = createAdaptiveIO([{ trip: { fight: "lose" } }]);
    const ctx = { state, data, io, rng: createRng(5), debug: false, notices: [] };
    await runTrip(ctx, { route: "brzezina_wilczy_brod" });
    const text = io.text();
    // the status line (with the hour) shows up a few lines above the scene's title
    const hourOf = (title) => new RegExp(`Dzień \\d+, (\\d\\d):\\d\\d[^\\n]*\\n(?:[^\\n]*\\n){0,6}?${title}\\n`).exec(text)?.[1];
    assert.equal(hourOf("Zmierzch"), "18", `zmierzch (godzina zdarzenia ${eventHour})`);
    assert.equal(hourOf("Noc upiorów"), "21", `atak (${eventHour})`);
    assert.equal(hourOf("Istota"), "02", `przebudzenie w środku nocy (${eventHour})`);
    assert.equal(hourOf("Świt"), "05", `świt (${eventHour})`);
  }
});
