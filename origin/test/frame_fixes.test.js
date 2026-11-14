import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState, tmpDir } from "./helpers.js";
import { loadData } from "../src/engine/data.js";
import { runApp } from "../src/app.js";
import { createNewState } from "../src/engine/state.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { showScreen } from "../src/ui/screen.js";
import { select, multiSelect, sliders } from "../src/ui/menu.js";
import { pressEnter } from "../src/ui/prompt.js";
import { showInventory } from "../src/ui/inventory_screen.js";
import { composeFrame, visibleWidth } from "../src/ui/frame.js";
import { paint, setColorsEnabled } from "../src/ui/colors.js";
import { startQuest } from "../src/systems/quests.js";
import { addXp } from "../src/systems/character.js";
import { levelUpHook } from "../src/scenes/after.js";

const data = minimalData();
const strip = (s) => stripVTControlCharacters(s);

let prevHome;
beforeEach(async () => {
  prevHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
});
afterEach(() => {
  setColorsEnabled(false);
  if (prevHome === undefined) delete process.env.OSTRZE_HOME;
  else process.env.OSTRZE_HOME = prevHome;
});

function hero(d = data) {
  const s = createNewState({ seed: 1, startScene: "a", rules: d.rules });
  const cs = combatState(d, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 12 * 60;
  s.world.phenomenonRolledDay = 99;
  return s;
}
const ctxOf = (inputs, { d = data, notices = [] } = {}) =>
  ({ state: hero(d), data: d, io: createScriptedIO(inputs, { tty: true }), rng: { int: (a) => a }, debug: false, notices: [...notices] });
/** Every frame drawn (split at screen clears), as the lines of the box only – text written below it does not count. */
const framed = (io) => io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1)
  .map((f) => strip(f).split("\n").filter((l) => /^[█▌]/.test(l))).filter((f) => f[0]?.startsWith("█▀"));
const last = (io) => framed(io).at(-1);
/** Frames followed by extra written lines: the newline count of a chunk must be exactly the frame's 23 lines. */
function strayChunks(io) {
  return io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1)
    .filter((c) => strip(c).startsWith("█▀"))
    .map((c) => ({ newlines: (c.match(/\n/g) ?? []).length, head: strip(c).split("\n").slice(-4).join(" | ") }))
    .filter((c) => c.newlines !== 23);
}

test("C1: multiSelect z 12 pozycjami – kursor na „Gotowe” jest widoczny", async () => {
  const ctx = ctxOf(Array(12).fill("<down>"));
  await showScreen(ctx, { lines: ["Umiejętności"], wide: true });
  const items = Array.from({ length: 12 }, (_, i) => ({ label: `Umiejętność ${i + 1}` }));
  await assert.rejects(multiSelect(ctx.io, data.ui, { items, count: 3 }), InputExhaustedError);
  const f = last(ctx.io);
  assert.equal(f.length, 23);
  assert.ok(f.some((l) => l.includes("▶ Gotowe")), f.join("\n"));
});

test("C1: suwaki z budżetem i 7 wierszami – kursor na „Gotowe” jest widoczny", async () => {
  const ctx = ctxOf(Array(7).fill("<down>"));
  await showScreen(ctx, { lines: ["Atrybuty"], wide: true });
  const rows = Array.from({ length: 7 }, (_, i) => ({ label: `Atrybut ${i + 1}`, value: 5, min: 5, max: 10 }));
  await assert.rejects(sliders(ctx.io, data.ui, { rows, budget: 5 }), InputExhaustedError);
  const f = last(ctx.io);
  assert.equal(f.length, 23);
  assert.ok(f.some((l) => l.includes("▶ Gotowe")), f.join("\n"));
});

test("C1: opis pozycji pod pełną listą nie ginie", async () => {
  const ctx = ctxOf(Array(9).fill("<down>"));
  await showScreen(ctx, { lines: ["Kram"], wide: true });
  const items = Array.from({ length: 10 }, (_, i) => ({ label: `Towar ${i + 1}`, description: `Opis towaru ${i + 1}.` }));
  await assert.rejects(select(ctx.io, data.ui, { items }), InputExhaustedError);
  const f = last(ctx.io);
  assert.ok(f.some((l) => l.includes("▶ [10] Towar 10")), f.join("\n"));
  assert.ok(f.some((l) => l.includes("Opis towaru 10.")), f.join("\n"));
});

test("I1: ukryte komunikaty na ekranie z Enter – [L] pokazuje wszystkie", async () => {
  const ctx = ctxOf(["l", "<enter>", ""], { notices: ["Pierwszy.", "Drugi.", "Trzeci.", "Czwarty.", "Piąty."] });
  await showScreen(ctx, { text: "Podsumowanie." });
  await pressEnter(ctx.io, data.ui);
  const all = framed(ctx.io);
  assert.ok(all.some((f) => ["Pierwszy.", "Drugi.", "Trzeci.", "Czwarty.", "Piąty."].every((n) => f.some((l) => l.includes(n)))), "pełna lista komunikatów");
});

test("I2: „Brak zapisów.” zostaje na ekranie menu głównego", async () => {
  const d = await loadData();
  const io = createScriptedIO(["2", "5"], { tty: true });
  await runApp({ data: d, io, options: { debug: false, seed: 1 } });
  const withMessage = framed(io).filter((f) => f.some((l) => l.includes(d.ui["menu.noSaves"])));
  assert.ok(withMessage.length > 0, "komunikat zniknął");
  assert.deepEqual(strayChunks(io), []);
});

test("I2: ostrzeżenie o zbyt ciężkiej nagrodzie stoi w ramce razem z wyborem", async () => {
  const d = structuredClone(data);
  d.items.find((i) => i.id === "prowiant").weight = 500;
  const ctx = ctxOf(["2", "1"], { d });
  await defaultHandlers.reward(ctx, { id: "r", type: "reward", items: ["prowiant"] });
  const f = framed(ctx.io).find((x) => x.some((l) => l.includes("Wyrzuć coś")));
  assert.ok(f, "brak ekranu wyboru");
  assert.ok(f.some((l) => l.includes(d.ui["reward.tooHeavy"].split("{")[0].trim())), f.join("\n"));
});

test("I2: pusty dziennik walki pokazuje tytuł i opis w ramce", async () => {
  const d = structuredClone(data);
  d.enemies = d.enemies.map((e) => (e.id === "bandyta" ? { ...e, initiative: 0, hp: 100, attacks: [{ ...e.attacks[0], effects: [] }] } : e));
  const ctx = ctxOf(["l", "w"], { d });
  await assert.rejects(defaultHandlers.combat(ctx, { id: "x", type: "combat", enemies: [{ id: "bandyta" }], start: "melee" }), InputExhaustedError);
  const f = framed(ctx.io).filter((x) => x.some((l) => l.includes(d.ui["combat.logEmpty"])));
  assert.ok(f.length > 0, "pusty dziennik bez opisu");
});

test("I3: nic nie jest dopisane pod ramką – koniec rozmowy, opis przedmiotu, błędna odpowiedź t/n", async () => {
  const talk = ctxOf(["4", "1"]);
  await defaultHandlers.dialogue(talk, { id: "dk", type: "dialogue", dialogue: "komendant" });
  assert.deepEqual(strayChunks(talk.io), [], "rozmowa");

  // "Opis" is the last action before "Wróć"; the item menu's panel scrolls, so try the numbers until the card shows up.
  let card = null;
  for (let n = 4; n <= 9 && !card; n++) {
    const ctx = ctxOf(["1", String(n), "", "w", "w"]);
    await showInventory(ctx).catch(() => {}); // a wrong number leaves the script out of step
    if (framed(ctx.io).some((f) => f.some((l) => l.includes("Waga")))) card = ctx;
  }
  assert.ok(card, "brak pozycji Opis");
  assert.deepEqual(strayChunks(card.io), [], "opis przedmiotu");

  const leave = ctxOf(["2", "x", "n", "2", "t"]);
  leave.state.world.location = "wilczy_brod";
  leave.data = structuredClone(leave.data);
  delete leave.data.travel.locations.find((l) => l.id === "wilczy_brod").spots; // straight to the destinations screen
  startQuest(leave.state, data, "wilcza_nora");
  await defaultHandlers.map(leave, { id: "m", type: "map", hub: "wilczy_brod", main: { label: "Czekaj", goto: "x" } });
  assert.deepEqual(strayChunks(leave.io), [], "błędna odpowiedź");
  assert.ok(framed(leave.io).some((f) => f.some((l) => l.includes("[T] Tak"))), "pytanie t/n jest w panelu wyboru");
});

test("I4: długa linia z kolorem jest zawijana, nie ucinana", async () => {
  setColorsEnabled(true);
  const long = "Pierwsza część zdania, druga część zdania, trzecia część zdania, czwarta część zdania, piąta część skusić.";
  const { lines } = composeFrame({ cols: 80, rows: 24, hero: null, body: [paint("title", long)], commands: [], notices: [], choices: ["x"] });
  const text = lines.map(strip).join("\n");
  assert.ok(!text.includes("…"), text);
  assert.ok(text.includes("skusić."), text);
  for (const l of lines) assert.equal(visibleWidth(l), 80);
  // and through a scene: the rest's artifact question
  const ctx = ctxOf([]);
  await showScreen(ctx, { lines: [paint("title", data.ui["rest.expose"])] });
  const scene = framed(ctx.io).at(-1).join("\n");
  assert.ok(scene.includes("skusić") && !scene.includes("…"), scene);
});

test("I5: strony tekstu liczone dla panelu wyboru – żaden wiersz długiego tekstu nie ginie przy 6 pozycjach", async () => {
  const body = Array.from({ length: 30 }, (_, i) => `LINE${i + 1}`);
  const ctx = ctxOf(Array(12).fill("<enter>"));
  await showScreen(ctx, { lines: body, wide: true });
  await select(ctx.io, data.ui, { items: Array.from({ length: 6 }, (_, i) => ({ label: `Wybór ${i + 1}` })) });
  // The frame drawn just before the widget's first one is replaced at once (no key wait), so it shows the player nothing.
  const seen = new Set();
  const shown = framed(ctx.io).filter((_, i, all) => i !== all.length - 2);
  for (const f of shown) for (const l of f) for (const m of l.matchAll(/LINE(\d+)/g)) seen.add(Number(m[1]));
  const missing = body.map((_, i) => i + 1).filter((n) => !seen.has(n));
  assert.deepEqual(missing, []);
});

test("awans: opis atrybutu pod kursorem stoi w panelu sceny w całości, nie za nazwą w wierszu listy", async () => {
  const ctx = ctxOf(["<down>", "<down>"]);
  addXp(ctx.state.character, 450, ctx.data);
  assert.ok(ctx.state.character.pendingLevelUp.attributePoints > 0);
  await assert.rejects(levelUpHook(ctx), InputExhaustedError);
  const frame = last(ctx.io).join(" ");
  const attribute = ctx.data.attributes[2];
  assert.ok(frame.includes(attribute.description.slice(0, 20)), `opis „${attribute.name}” w ramce: ${frame}`);
  const rows = last(ctx.io).filter((l) => l.includes(attribute.name));
  assert.ok(rows.every((l) => !l.includes(attribute.description.slice(0, 20)) || l.includes(`${attribute.name}:`)), "opis nie wisi w wierszu listy");
});
