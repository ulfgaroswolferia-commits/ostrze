import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { evaluate } from "../src/engine/conditions.js";
import { advanceTime } from "../src/engine/time.js";
import { combatState } from "./helpers.js";
import { nodeView, enterNode, chooseOption, finishDialogue } from "../src/systems/dialogue.js";
import { startQuest, advanceErrands, boardQuests, abandonQuestsOf, finishQuest } from "../src/systems/quests.js";
import { visibleSpots, spotScenes, rollVisitor } from "../src/systems/spots.js";
import { runActions } from "../src/systems/actions.js";

// "Małpa": losowy gracz przechodzi akt IIIa i IIIb na prawdziwym silniku dialogów, scen miejsc, tablic, gości i zleceń.
// Nie ma strategii, więc każdy ślepy zaułek, który wymaga konkretnej kolejności, wyjdzie jako przypadek, który się nie kończy.
const data = await loadData();
const RUNS = 80;
const MAX_DAYS = 400;

function makeRng(seed) {
  let x = (seed * 2654435761) >>> 0 || 1;
  const next = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
  return { int: (lo, hi) => (hi === undefined ? lo : lo + (next() % (hi - lo + 1))), pick: (list) => list[next() % list.length], chance: (p) => next() % 100 < p, setState() {}, getState: () => 0 };
}

function playDialogue(state, id, rng) {
  const d = data.dialogues.find((x) => x.id === id);
  if (!d) return;
  let node = d.start;
  enterNode(state, data, id, node, rng);
  for (let step = 0; step < 30; step++) {
    const view = nodeView(state, data, id, node);
    const open = view.options.filter((o) => !o.disabled);
    if (open.length === 0) { finishDialogue(state, data, id, "koniec", rng); return; }
    const choice = rng.pick(open);
    const res = chooseOption(state, data, id, node, choice.key, rng);
    if (res.end !== undefined) { finishDialogue(state, data, id, res.end, rng); return; }
    node = res.next;
    enterNode(state, data, id, node, rng);
  }
}

function playScenes(state, scenes, rng) {
  for (const s of scenes ?? []) {
    if (s.if && !evaluate(s.if, state, data)) continue;
    if (s.type === "flag") { Object.assign(state.flags, s.set); if (s.goto === "koniec") return; }
    else if (s.type === "dialogue") playDialogue(state, s.dialogue, rng);
    else if (s.type === "quest") { if (s.start) startQuest(state, data, s.start); if (s.complete) finishQuest(state, data, s.complete, rng); }
    else if (s.type === "reward") runActions(state, data, (s.items ?? []).map((i) => ({ giveItem: i })), rng);
    else if (s.type === "effect") continue;
    if (s.goto === "koniec") return;
  }
}

/** Places of the hub and its known near locations (the bot goes anywhere it knows, far ones too). */
function places(state, hub) {
  const out = [];
  for (const l of data.travel.locations) {
    if (l.id !== hub && !((l.near || l.far) && state.world.discovered.includes(l.id))) continue;
    for (const { spot, available } of visibleSpots(state, data, l.id)) if (available) out.push({ loc: l.id, spot });
  }
  return out;
}

function playDay(state, hub, rng, endFlag) {
  state.world.location = hub;
  if (rng.chance(35)) advanceTime(state, ((22 * 60 - (state.time.minutes % (24 * 60))) + 24 * 60) % (24 * 60), data, rng); // a night owl: the day starts at dusk
  const visitor = rollVisitor(state, data, hub, rng);
  const v = visitor && data.travel.locations.find((l) => l.id === hub).visitors.find((x) => x.id === visitor);
  if (v && (v.forced || rng.chance(70))) playScenes(state, v.scenes, rng);
  for (let k = rng.int(4, 9); k > 0 && !state.flags[endFlag]; k--) {
    const choices = places(state, hub);
    if (choices.length === 0) break;
    const { loc, spot } = rng.pick(choices);
    if (spot.type === "board") {
      const q = boardQuests(state, data, hub);
      if (q.length) startQuest(state, data, rng.pick(q).id);
    } else {
      const old = state.world.location;
      state.world.location = loc;
      playScenes(state, spotScenes(data, loc, spot.id), rng);
      state.world.location = old;
    }
    advanceErrands(state, data, rng);
    advanceTime(state, rng.int(30, 150), data, rng);
  }
  advanceErrands(state, data, rng);
  // the day is closed: rest to the next morning
  const toMorning = (24 * 60 - (state.time.minutes % (24 * 60))) + 7 * 60;
  advanceTime(state, toMorning, data, rng);
}

function newGame(seed, rng) {
  const state = createNewState({ seed, startScene: "akt3_mapa", rules: data.rules });
  const cs = combatState(data, rng.pick(["miecz", "wlocznia"]));
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = rng.int(20, 80);
  state.inventory.items.push({ id: "prowiant", qty: 3 });
  state.time.minutes = 9 * 60;
  state.world.phenomenonRolledDay = 999;
  state.flags.akt2_koniec = true;
  for (const f of ["kurier_pytal", "odrzucil_stolice", "waha_sie", "towarzysze_zgineli", "towarzysze_zaufanie", "technologia_wiedza", "dlug_istoty", "ukryte_insygnia", "komendant_wie_o_szkole", "amulet_oddany", "amulet_zatrzymany", "papiery_falszywe_x"]) {
    if (rng.chance(45)) state.flags[f] = true;
  }
  if (state.flags.amulet_oddany && state.flags.amulet_zatrzymany) delete state.flags.amulet_zatrzymany;
  if (state.flags.amulet_oddany || state.flags.amulet_zatrzymany) runActions(state, data, [{ reveal: "gluszec.wdowa" }], rng); // the daughter in act II points to her mother
  state.vars.wola = rng.int(0, 1);
  state.vars.dlug = rng.int(0, 1);
  return state;
}

const result = { reachedA: 0, reachedB: 0, opor: 0, completed: {}, stuckA: [], stuckB: [], runs: 0 };
for (let seed = 1; seed <= RUNS; seed++) {
  const rng = makeRng(seed);
  const state = newGame(seed, rng);
  result.runs++;
  // IIIa in Głuszec
  state.world.location = "gluszec";
  startQuest(state, data, "przyjecie_w_osadzie");
  let days = 0;
  while (!state.flags.akt3a_koniec && days++ < MAX_DAYS) playDay(state, "gluszec", rng, "akt3a_koniec");
  if (!state.flags.akt3a_koniec) { result.stuckA.push(seed); continue; }
  result.reachedA++;
  // IIIb in the Observatory: the old quests are lost, the new opening quest starts
  abandonQuestsOf(state, data, "gluszec");
  state.world.location = "obserwatorium";
  startQuest(state, data, "przyjecie_w_obserwatorium");
  days = 0;
  while (!state.flags.akt3b_koniec && days++ < MAX_DAYS) playDay(state, "obserwatorium", rng, "akt3b_koniec");
  if (!state.flags.akt3b_koniec) { result.stuckB.push(seed); continue; }
  result.reachedB++;
  if ((state.vars.wola ?? 0) >= 2) result.opor++; // a player of strong will (kept as a statistic for the acts after III)
  for (const [id, q] of Object.entries(state.quests)) if (q.status === "done") result.completed[id] = (result.completed[id] ?? 0) + 1;
}

test("małpa: losowy gracz zawsze kończy akt IIIa (flaga akt3a_koniec) w rozsądnym czasie", (t) => {
  t.diagnostic(`IIIa: ${result.reachedA}/${result.runs}, utknięte: ${result.stuckA.join(",") || "brak"}`);
  assert.deepEqual(result.stuckA, [], "losowe rozgrywki, które nie doszły do końca IIIa");
});

test("małpa: losowy gracz zawsze kończy akt IIIb i staje przed finałem z dostępną drogą", (t) => {
  t.diagnostic(`IIIb: ${result.reachedB}/${result.reachedA}, utknięte: ${result.stuckB.join(",") || "brak"}; opór dostępny w ${result.opor}`);
  assert.deepEqual(result.stuckB, [], "losowe rozgrywki, które nie doszły do końca IIIb");
});

test("małpa: każde zlecenie IIIb zostaje wykonane w części rozgrywek (żadne nie jest martwe w praktyce)", (t) => {
  // the road errands start from random road events, which a hub-bound random player does not roll
  const ids = data.quests.filter((q) => q.hub === "obserwatorium" && !q.onStart && !q.main).map((q) => q.id);
  t.diagnostic(ids.map((id) => `${id}:${result.completed[id] ?? 0}`).join(" "));
  const never = ids.filter((id) => !result.completed[id]);
  assert.deepEqual(never, []);
  assert.ok(result.opor > 0, "gracz o silnej woli (wola ≥ 2) zdarza się w losowych rozgrywkach");
});
