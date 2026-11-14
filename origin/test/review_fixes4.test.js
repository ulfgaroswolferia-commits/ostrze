import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { createRng } from "../src/engine/dice.js";
import { enterNode, nodeView } from "../src/systems/dialogue.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const data = await loadData();
const fixed = { int: () => 1 };

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function start(location, flags = {}) {
  const state = createNewState({ seed: 1, startScene: "akt3b_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.world.location = location;
  state.world.phenomenonRolledDay = 99;
  state.time.minutes = 9 * 60;
  Object.assign(state.flags, flags);
  return state;
}
const keys = (state, d, n) => nodeView(state, data, d, n).options.filter((o) => !o.disabled).map((o) => o.key);

for (const [sceneId, from, intro, hub] of [["akt3b_mapa", "gluszec", "przyjecie_w_obserwatorium", "gluszec"], ["akt3_mapa", "wilczy_brod", "przyjecie_w_osadzie", "wilczy_brod"]]) {
  test(`C1: ${sceneId} – przy pełnym limicie zleceń starego huba zlecenie wejściowe i tak rusza (najpierw porzucenie, potem start)`, async () => {
    const state = start(from);
    const old = data.quests.filter((q) => q.hub === hub && q.kind === "errand").slice(0, data.rules.quests.maxActive);
    for (const q of old) state.quests[q.id] = { status: "active", done: [] };
    assert.ok(Object.keys(state.quests).length >= Math.min(old.length, data.rules.quests.maxActive));
    const scene = data.story.scenes.find((s) => s.id === sceneId);
    const io = createAdaptiveIO([]);
    await assert.rejects(defaultHandlers.map({ state, data, io, rng: createRng(3), debug: false, notices: [] }, scene), InputExhaustedError);
    assert.equal(state.quests[intro]?.status, "active");
    for (const q of old) assert.equal(state.quests[q.id].status, "failed", q.id);
  });
}

test("C2: przedmiot, który się nie mieści, nie zostawia flagi „wzięty” – rdzeń i odłamki można zabrać po zwolnieniu miejsca", () => {
  const s = start("wrak_maszyny", { hieronim_potwierdzil: true });
  s.quests.wrak_maszyny = { status: "active", done: [] };
  s.inventory.items.push({ id: "prowiant", qty: 400 }); // far beyond the carrying limit
  enterNode(s, data, "panel_wraku", "wyjety", fixed);
  assert.equal(s.flags.rdzen_wziety, undefined, "bez miejsca flaga nie powstaje");
  assert.equal(s.inventory.items.some((i) => i.id === "rdzen_maszyny"), false);
  assert.ok(keys(s, "panel_wraku", "powitanie").includes("wyjmij"), "opcja zostaje");
  s.inventory.items = s.inventory.items.filter((i) => i.id !== "prowiant");
  enterNode(s, data, "panel_wraku", "wyjety", fixed);
  assert.equal(s.flags.rdzen_wziety, true);
  assert.equal(s.inventory.items.some((i) => i.id === "rdzen_maszyny"), true);
});

test("I6: zakończenie odsłony nie przychodzi, dopóki zlecenia są rozgrzebane; Hieronim ostrzega o punkcie bez powrotu", () => {
  const s = start("obserwatorium", { hieronim_straznica_ok: true });
  s.quests.dlug_istoty_zlecenie = { status: "done" };
  assert.ok(keys(s, "hieronim", "powitanie").includes("q10_start"));
  s.quests.cesarski_dezerter = { status: "active", done: [] };
  const open = keys(s, "hieronim", "powitanie");
  assert.ok(!open.includes("q10_start") && open.includes("q10_jeszcze"), "przy otwartym wątku Hieronim każe skończyć");
  s.quests.cesarski_dezerter.status = "done";
  assert.ok(keys(s, "hieronim", "powitanie").includes("q10_start"));
  assert.match(data.dialogues.find((d) => d.id === "hieronim").nodes.q10_start.text, /punkt bez powrotu/);
});

test("I1/I4: Hieronim po wydaniu Tomasza reaguje inaczej", () => {
  const s = start("obserwatorium", { dezerter_rozstrzygniete: true, dezerter_wydany: true });
  const k = keys(s, "hieronim", "powitanie");
  assert.ok(k.includes("dezerter_po_wydany") && !k.includes("dezerter_po"));
});

test("wieści z Głuszca po obławie wymagają przyjęcia przez Hieronima; Brygida nie wręcza nieistniejącego przedmiotu", () => {
  const stranger = start("obserwatorium", { oblawa_ucieczka: true });
  assert.ok(!keys(stranger, "hieronim", "powitanie").includes("q8_a"));
  const welcomed = start("obserwatorium", { oblawa_ucieczka: true, hieronim_potwierdzil: true });
  assert.ok(keys(welcomed, "hieronim", "powitanie").includes("q8_a"));
  assert.doesNotMatch(data.dialogues.find((d) => d.id === "brygida").nodes.q10_brygida.text, /Wręcza/);
});
