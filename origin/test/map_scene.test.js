import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState, tmpDir, createAdaptiveIO } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { startQuest, finishQuest } from "../src/systems/quests.js";

const strip = (s) => stripVTControlCharacters(s);
const H = 60;
const DAY = 24 * H;
const SLEEP = ["1+++", "2", ""];
/** One quiet stage: departure, summary, pitch camp, sleep. */
const STAGE = ["", ""]; // a quiet one-day trip: the departure and "Idź dalej" in the evening
const MAP = { id: "mapa", type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Czekaj na kuriera", goto: "koniec_gry" } };

let prevHome;
beforeEach(async () => {
  prevHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
});
afterEach(() => {
  if (prevHome === undefined) delete process.env.OSTRZE_HOME;
  else process.env.OSTRZE_HOME = prevHome;
});

/** Real data, no random road events, weak wolves, and a story holding the map scene (so saves load). */
function mapData() {
  const d = structuredClone(minimalData());
  d.rules.travel.eventChance = 0;
  d.rules.travel.dangerousEventChance = 0;
  d.quests.find((q) => q.id === "eskorta_ostromira").eventChance = 0;
  d.enemies = d.enemies.map((e) => (e.id === "wilk" ? { ...e, hp: 1, attacks: [{ ...e.attacks[0], hit: 0 }] } : e));
  delete d.travel.locations.find((l) => l.id === "wilczy_brod").spots; // these tests are about the quest outings, not the hub's places
  d.story = { start: "mapa", scenes: [MAP, { id: "koniec_gry", type: "ending", text: "Koniec." }] };
  return d;
}
function hubState(data, quests = ["wilcza_nora"]) {
  const s = createNewState({ seed: 1, startScene: "mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 9 * H;
  s.world.phenomenonRolledDay = 99;
  s.world.location = "wilczy_brod";
  for (const id of quests) startQuest(s, data, id);
  return s;
}
const ctxOf = (state, data, io, seed = 3) => ({ state, data, io, rng: createRng(seed), debug: false, notices: [] });
const run = (ctx) => defaultHandlers.map(ctx, MAP);
/** Nora on site: narration, the fight, the after-fight narration (the quest is only reported; the commander pays). */
const NORA = ["", { fight: "win" }, ""];

test("pełny cykl: nora – tam, walka, nagroda, powrót, mapa bez nory, „dalej fabułą” bez pytania", async () => {
  const data = mapData();
  const state = hubState(data);
  const money = state.character.money;
  const io = createAdaptiveIO(["1", ...STAGE, ...NORA, ...STAGE, "1"]);
  const result = await run(ctxOf(state, data, io));
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assert.deepEqual(result, { goto: "koniec_gry" });
  assert.equal(state.quests.wilcza_nora.status, "active");
  assert.equal(state.quests.wilcza_nora.reported, true);
  assert.equal(state.character.money, money);
  finishQuest(state, data, "wilcza_nora", createRng(1));
  assert.equal(state.quests.wilcza_nora.status, "done");
  assert.equal(state.character.money, money + 25);
  assert.equal(state.world.map, null);
  assert.equal(state.world.location, "wilczy_brod");
  const out = strip(io.text());
  assert.match(out, /Dokąd iść?\?/);
  assert.match(out, /\[1\] ! Wilcza Nora · zadanie „Wilcza Nora” · 1 dzień/);
  assert.doesNotMatch(out, /Masz niewykonane zadania/);
});

test("wyjście fabułą z aktywną eskortą: „n” wraca do mapy, „t” – zadanie przepada", async () => {
  const data = mapData();
  const state = hubState(data, ["eskorta_ostromira"]);
  const ctx = ctxOf(state, data, createScriptedIO(["2", "n", "2", "t"]));
  assert.deepEqual(await run(ctx), { goto: "koniec_gry" });
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  const out = strip(ctx.io.text());
  assert.match(out, /\[1\] ! Kamienna Przełęcz · eskorta „Eskorta kupca Ostromira” · 1 dzień · termin: zostały 3 dni/);
  assert.equal(out.match(/Masz niewykonane zadania – przepadną\. Ruszać\?/g).length, 2);
  assert.equal(state.quests.eskorta_ostromira.status, "failed");
});

test("eskorta przepada z terminu podczas wyprawy do nory – po powrocie komunikat i brak opcji", async () => {
  const data = mapData();
  const state = hubState(data, ["wilcza_nora", "eskorta_ostromira"]);
  state.quests.eskorta_ostromira.deadline = state.time.minutes + DAY;
  const io = createAdaptiveIO(["1", ...STAGE, ...NORA, ...STAGE, "1"]);
  await run(ctxOf(state, data, io));
  await assert.rejects(io.ask("?"), InputExhaustedError);
  const out = strip(io.text());
  assert.match(out, /Kupiec Ostromir nie doczekał – zadanie przepadło\./);
  assert.equal(state.quests.eskorta_ostromira.status, "failed");
  assert.equal(state.quests.wilcza_nora.status, "active");
});

test("wznowienie przez zapis i wczytanie: na mapie, w drodze tam, na miejscu po nagrodzie, w powrocie – nagroda raz", async () => {
  const data = mapData();
  const state = hubState(data);
  const money = state.character.money;
  const all = ["1", ...STAGE, ...NORA, ...STAGE, "1"];
  // stop points (number of answers given before the input runs out): on the map, on the way there, on site after the reward, on the way back
  const cuts = [0, 2, 1 + STAGE.length + NORA.length, 1 + STAGE.length + NORA.length + 1];
  let current = state;
  let given = 0;
  for (const cut of [...cuts, all.length]) {
    const io = createAdaptiveIO(all.slice(given, cut));
    const ctx = ctxOf(current, data, io, 11 + cut);
    if (cut < all.length) {
      await assert.rejects(run(ctx), InputExhaustedError);
      await saveGame("1", current, ctx.rng);
      current = await loadGame("1", data);
    } else {
      assert.deepEqual(await run(ctx), { goto: "koniec_gry" });
    }
    given = cut;
  }
  assert.equal(current.quests.wilcza_nora.reported, true);
  assert.equal(current.character.money, money, "nagrodę wypłaca dopiero komendant");
  assert.equal(current.world.map, null);
});

test("ekran mapy w TTY: ≤ 23 wiersze, ≤ 80 kolumn", async () => {
  const data = mapData();
  const state = hubState(data, ["wilcza_nora", "eskorta_ostromira"]);
  const ctx = ctxOf(state, data, createScriptedIO([], { tty: true }));
  await assert.rejects(run(ctx), InputExhaustedError);
  const out = ctx.io.output.join("");
  const frame = strip(out.slice(out.lastIndexOf("\u001b[2J")));
  const rows = frame.split("\n").filter((l) => l !== "");
  assert.ok(rows.length <= 23, frame);
  assert.ok(rows.every((l) => [...l].length <= 80), frame);
  assert.match(frame, /Czekaj na kuriera/);
});

test("final: Enter na mapie nie wysyła na wyprawę – kursor stoi na „dalej fabułą” (z pytaniem)", async () => {
  const data = mapData();
  const state = hubState(data, ["wilcza_nora"]);
  const ctx = ctxOf(state, data, createScriptedIO(["", "n"]));
  await assert.rejects(run(ctx), InputExhaustedError);
  assert.equal(state.quests.wilcza_nora.departed, false);
  assert.match(strip(ctx.io.text()), /Masz niewykonane zadania/);
});

test("final: zapis na miejscu zadania po nagrodzie i wczytanie – nagroda raz, faza onsite", async () => {
  const data = mapData();
  const state = hubState(data);
  const money = state.character.money;
  const all = ["1", ...STAGE, ...NORA, ...STAGE, "1"];
  const cut = 1 + STAGE.length + NORA.length - 1; // the after-fight narration's camp menu runs out of answers
  const first = ctxOf(state, data, createAdaptiveIO(all.slice(0, cut)), 21);
  await assert.rejects(run(first), InputExhaustedError);
  assert.equal(state.world.map.phase, "onsite");
  assert.equal(state.world.map.questScene, "nora_po_walce");
  await saveGame("1", state, first.rng);
  const loaded = await loadGame("1", data);
  assert.deepEqual(await run(ctxOf(loaded, data, createAdaptiveIO(all.slice(cut)), 22)), { goto: "koniec_gry" });
  assert.equal(loaded.character.money, money);
  assert.equal(loaded.quests.wilcza_nora.reported, true);
});

test("„Prześpij noc” przy niedokończonym wątku huba: bez pytania, zadania zostają; dopiero wyjście z hubu je kosztuje", async () => {
  const data = mapData();
  const sleep = { ...MAP, main: { label: "Prześpij noc", doneLabel: "Ruszaj dalej", goto: "koniec_gry" } };
  const state = hubState(data, ["wilcza_nora"]);
  const ctx = ctxOf(state, data, createScriptedIO(["2"]));
  assert.deepEqual(await defaultHandlers.map(ctx, sleep), { goto: "koniec_gry" });
  assert.equal(state.quests.wilcza_nora.status, "active");
  assert.doesNotMatch(strip(ctx.io.text()), /przepadną/);
});

// --- koniec rozdziału wywołany flagą: pytanie zamiast cichego wyjścia ---
const EXIT_MAP = { ...MAP, main: { label: "Prześpij noc", doneLabel: "Ruszaj dalej", goto: "koniec_gry" }, exitWhen: { if: { flag: "koniec_rozdzialu" }, goto: "po_rozdziale", warn: true, forced: { flag: "wygnanie" } } };
const runExit = (ctx) => defaultHandlers.map(ctx, EXIT_MAP);

test("exitWhen z otwartymi zleceniami: ostrzeżenie; „nie” zostawia w hubie, a „Ruszaj dalej” wychodzi po potwierdzeniu", async () => {
  const data = mapData();
  const state = hubState(data, ["wilcza_nora"]);
  state.flags.koniec_rozdzialu = true;
  // "n" to the warning, then the map: "Ruszaj dalej" (last item), confirm "t"
  const io = createAdaptiveIO(["n", "99"]);
  const ctx = ctxOf(state, data, io);
  await assert.rejects(runExit(ctx));
  assert.equal(state.world.map.exitHeld, true, "zostajesz w hubie");
  assert.equal(state.quests.wilcza_nora.status, "active");
  assert.match(strip(io.output.join("")), /nie wrócisz/);
});

test("exitWhen bez otwartych zleceń wychodzi od razu, bez pytania", async () => {
  const data = mapData();
  const state = hubState(data, []);
  state.flags.koniec_rozdzialu = true;
  assert.deepEqual(await runExit(ctxOf(state, data, createAdaptiveIO([]))), { goto: "po_rozdziale" });
});

test("exitWhen z otwartymi zleceniami: „tak” w ostrzeżeniu wychodzi", async () => {
  const data = mapData();
  const state = hubState(data, ["wilcza_nora"]);
  state.flags.koniec_rozdzialu = true;
  assert.deepEqual(await runExit(ctxOf(state, data, createAdaptiveIO(["t"]))), { goto: "po_rozdziale" });
});

test("exitWhen.forced: wyrzucenie przez fabułę wychodzi bez pytania mimo otwartych zleceń", async () => {
  const data = mapData();
  const state = hubState(data, ["wilcza_nora"]);
  Object.assign(state.flags, { koniec_rozdzialu: true, wygnanie: true });
  assert.deepEqual(await runExit(ctxOf(state, data, createAdaptiveIO([]))), { goto: "po_rozdziale" });
});
