import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData, validateData } from "../src/engine/data.js";
import { evaluate } from "../src/engine/conditions.js";
import { createNewState } from "../src/engine/state.js";
import { createSceneList, runStory } from "../src/engine/loop.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { createRng } from "../src/engine/dice.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const real = await loadData();
const data = structuredClone(real);
data.rules.travel.eventChance = 0;
data.rules.travel.dangerousEventChance = 0;
const scenes = data.story.scenes;
const byId = (id) => scenes.find((s) => s.id === id);
const dlg = (id) => data.dialogues.find((d) => d.id === id);
const SLEEP = ["1+++", "2", ""];
const STAGE = ["", "", "", ...SLEEP];
const TRIP = [...STAGE, ...STAGE, ...STAGE];
const lowRng = { int: (lo) => lo, setState() {}, getState: () => 0 };

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function hero(sceneId = "akt4c_przejscie", flags = {}) {
  const state = createNewState({ seed: 1, startScene: sceneId, rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 60;
  state.time.minutes = 8 * 60;
  state.world.location = "loch_pod_palacem";
  state.world.phenomenonRolledDay = 99;
  Object.assign(state.flags, { dlug_splacony: true, palac_otwarty: true }, flags);
  return state;
}
async function play(state, plan, { ends = false } = {}) {
  const io = createAdaptiveIO(plan);
  const ctx = { state, data, io, rng: lowRng, debug: false, story: createSceneList(data.story.scenes), notices: [] };
  if (ends) await runStory(ctx);
  else await assert.rejects(runStory(ctx), InputExhaustedError);
  return stripVTControlCharacters(io.text()).replace(/\s+/g, " ");
}

test("fabuła wyspy: porządek scen i parametry mapy; akt4c_przejscie przestaje być zakończeniem, akt5a_przejscie prowadzi do Wiru", () => {
  assert.deepEqual(validateData(data), []);
  const ids = scenes.map((s) => s.id);
  const order = ["akt4c_przejscie", "akt5_droga", "akt5_wejscie", "akt5_mapa", "akt5_odpoczynek", "akt5_zapis", "akt5_dalej", "akt5a_przejscie"];
  assert.ok(order.map((id) => ids.indexOf(id)).every((i, k, a) => i >= 0 && (k === 0 || i > a[k - 1])), "porządek scen");
  assert.equal(byId("akt4c_przejscie").type, "narration");
  assert.doesNotMatch(byId("akt4c_przejscie").text, /TO JESZCZE NIE KONIEC/);
  assert.equal(byId("akt5a_przejscie").type, "narration");
  const map = byId("akt5_mapa");
  assert.deepEqual([map.hub, map.arriveAt, map.leaves, map.starts], ["przystan_jarnowo", "przystan_jarnowo", "loch_pod_palacem", ["watek_jarnowo"]]);
  assert.deepEqual(map.exitWhen.if, { any: [{ flag: "portal_rozbrojony" }, { flag: "portal_sprawny" }] });
  assert.equal(map.exitWhen.goto, "akt5a_przejscie");
  assert.equal(byId("akt5_droga").route, "loch_jarnowo");
});

test("fabuła wyspy: po Długu spłaconym przeprawa trwa trzy dni i gracz staje w Przystani z aktywnym wątkiem", async () => {
  const state = hero();
  const text = await play(state, ["", ...TRIP, ""]);
  assert.match(text, /Jarnowo/);
  assert.equal(state.world.location, "przystan_jarnowo");
  assert.equal(state.quests.watek_jarnowo.status, "active");
  assert.equal(state.scene.id, "akt5_mapa");
});

// --- Brama z wiru ---
const brama = () => dlg("brama_z_wiru");
const run = (flags, picks) => {
  const d = brama();
  const st = hero("akt5_mapa", flags);
  let node = d.start;
  const seen = [];
  for (const pick of picks) {
    const n = d.nodes[node];
    const opt = n.options.find((o) => o.id === pick && (!o.requires || evaluate(o.requires, st, data)));
    assert.ok(opt, `${node}: brak opcji ${pick}`);
    for (const a of n.actions ?? []) if (a.setFlag) st.flags[a.setFlag] = true;
    seen.push(node);
    node = opt.goto;
    if (node === "end") break;
  }
  if (node !== "end") for (const a of d.nodes[node].actions ?? []) if (a.setFlag) st.flags[a.setFlag] = true;
  return st;
};

test("Brama z wiru: rozbrojenie ustawia dokładnie portal_rozbrojony, zostawienie – portal_sprawny, po potwierdzeniu", () => {
  const a = run({}, ["rozbroj", "potwierdz"]);
  assert.equal(a.flags.portal_rozbrojony, true);
  assert.equal(a.flags.portal_sprawny, undefined);
  const b = run({}, ["zostaw", "potwierdz"]);
  assert.equal(b.flags.portal_sprawny, true);
  assert.equal(b.flags.portal_rozbrojony, undefined);
});

test("Brama z wiru: „jeszcze nie teraz” i cofnięcie z potwierdzenia nie ustawiają flagi", () => {
  for (const picks of [["odloz"], ["rozbroj", "cofnij"], ["zostaw", "cofnij"]]) {
    const st = run({}, picks);
    assert.equal(st.flags.portal_rozbrojony, undefined, picks.join());
    assert.equal(st.flags.portal_sprawny, undefined, picks.join());
  }
});

test("Brama z wiru: po decyzji opcje wyboru znikają (nie da się jej powtórzyć ani zmienić)", () => {
  const d = brama();
  for (const flag of ["portal_rozbrojony", "portal_sprawny"]) {
    const st = hero("akt5_mapa", { [flag]: true });
    const ids = d.nodes[d.start].options.filter((o) => !o.requires || evaluate(o.requires, st, data)).map((o) => o.id);
    assert.ok(!ids.includes("rozbroj") && !ids.includes("zostaw") && !ids.includes("rozbroj_wyrok"), flag);
  }
  const spot = data.travel.locations.find((l) => l.id === "lysa_skala").spots.find((s) => s.id === "brama");
  assert.ok(spot.scenes.some((s) => s.type === "dialogue" && s.dialogue === "brama_z_wiru"));
});

test("Brama z wiru: pod istota_wyrok bohater mówi wprost, po co rozbraja; potwierdzenie ostrzega o otwartych zleceniach", () => {
  const d = brama();
  const opts = d.nodes[d.start].options;
  const wyrok = opts.find((o) => o.id === "rozbroj_wyrok");
  assert.ok(wyrok && JSON.stringify(wyrok.requires).includes("istota_wyrok"));
  assert.equal(wyrok.goto, opts.find((o) => o.id === "rozbroj").goto);
  assert.match(JSON.stringify(d.nodes[wyrok.goto]), /zleceni/i);
  const st = hero("akt5_mapa", { istota_wyrok: true });
  assert.ok(!opts.find((o) => o.id === "rozbroj").requires || !evaluate(opts.find((o) => o.id === "rozbroj").requires, st, data));
});

test("stary zapis na akt4c_przejscie (dawniej zakończenie) wczytuje się i prowadzi na wyspę", async () => {
  const state = hero("akt4c_przejscie");
  await saveGame("1", state, createRng(1));
  const loaded = await loadGame("1", data, { warnings: [] });
  assert.equal(loaded.scene.id, "akt4c_przejscie");
  const text = await play(loaded, ["", ...TRIP, ""]);
  assert.match(text, /Jarnowo/);
  assert.equal(loaded.world.location, "przystan_jarnowo");
});

test("po wyspie gracz ma poziom co najmniej 6 przy zrobieniu zleceń i pól walki (docelowy poziom przed Wirem)", () => {
  const quests = ["lodz_bez_zalogi", "kowal_i_rusznice", "wiesci_z_ladu", "przejscie_smyka", "rozpoznanie_urzadzenia"].map((id) => data.quests.find((q) => q.id === id));
  const xp = quests.flatMap((q) => q.onComplete ?? []).reduce((s, a) => s + (a.xp ?? 0), 0);
  assert.ok(xp >= 200, `xp ze zleceń: ${xp}`);
});

test("po wyspie gracz jest o ≥ poziom wyżej, niż na wejściu: PD ze zleceń, wątku i pól walki starczają na różnicę poziomów 5 → 6", async () => {
  const { xpToReach } = await import("../src/systems/character.js");
  const quests = ["lodz_bez_zalogi", "kowal_i_rusznice", "wiesci_z_ladu", "przejscie_smyka", "rozpoznanie_urzadzenia", "watek_jarnowo"].map((id) => data.quests.find((q) => q.id === id));
  const questXp = quests.flatMap((q) => q.onComplete ?? []).reduce((s, a) => s + (a.xp ?? 0), 0);
  const enemyXp = (id) => data.enemies.find((e) => e.id === id).xp;
  const hunts = data.travel.locations.filter((l) => l.region === "jarnowo").flatMap((l) => (l.spots ?? []).filter((s) => s.type === "hunt"));
  const huntXp = hunts.reduce((sum, h) => sum + h.scenes.find((s) => s.id === h.clearedBy).enemies.reduce((x, e) => x + enemyXp(e.id) * e.count, 0), 0);
  const gap = xpToReach(6, data.rules) - xpToReach(5, data.rules);
  assert.ok(questXp + huntXp >= gap, `PD z wyspy ${questXp + huntXp} < ${gap}`);
});
