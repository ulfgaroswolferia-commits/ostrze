import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { showScreen } from "../src/ui/screen.js";
import { select } from "../src/ui/menu.js";
import { composeFrame, visibleWidth, sceneWidth } from "../src/ui/frame.js";
import { wrap } from "../src/ui/text.js";
import { readFrame } from "./frame_read.js";
import { setColorsEnabled, setRich256 } from "../src/ui/colors.js";

const data = minimalData();
const strip = (s) => stripVTControlCharacters(s);
const TEXT = "Za zakrętem traktu z przydrożnych krzaków wyłażą dwa osiłki z kijami, śmierdzące jak stary kożuch w deszczu. „Kiesę daj, paniczu!”";

function hero() {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 12 * 60;
  s.world.phenomenonRolledDay = 99;
  return s;
}
const ctxOf = (inputs, { tty = true, notices = [] } = {}) =>
  ({ state: hero(), data, io: createScriptedIO(inputs, { tty }), rng: { int: (a) => a }, debug: false, notices: [...notices] });
/** Lines of the last frame drawn (after the last screen clear), without colours. */
function lastFrame(io) {
  const out = io.output.join("");
  return strip(out.slice(out.lastIndexOf("\x1b[2J") + "\x1b[2J\x1b[3J\x1b[H".length)).split("\n").filter((l, i, all) => i < all.length - 1 || l !== "");
}
function assertFrame(lines) {
  const box = lines.slice(0, 23);
  assert.equal(box.length, 23, lines.join("\n"));
  assert.ok(box[0].startsWith("█▀") && /^█▄+█$/.test(box[22]), lines.join("\n"));
  for (const l of box) assert.equal(visibleWidth(l), 80, l);
}
const narration = (ctx, text = TEXT) => defaultHandlers.narration(ctx, { id: "n", type: "narration", title: "Zasadzka", text });

test("narracja w TTY 80×24: ramka, menu poleceń u dołu, „[1] Dalej” w prawym panelu", async () => {
  const ctx = ctxOf(["1"]);
  await narration(ctx);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  const frame = lastFrame(ctx.io);
  assertFrame(frame);
  const text = frame.join("\n");
  assert.match(text, / Zasadzka /);
  for (const cmd of ["[P] Postać", "[E] Ekwipunek", "[D] Dziennik", "[Z] Zapisz", "[M] Menu"]) assert.ok(text.includes(cmd), cmd);
  const read = readFrame(frame.slice(0, 23));
  assert.equal(read.choices[0], "▶ [1] Dalej");
  assert.match(read.menu, /^\[P\] Postać  \[E\] Ekwipunek/);
  assert.match(frame[0], /Test · poz\. 1 · Klasa miecza/);
  assert.match(text, /Za zakrętem traktu/);
});

test("[P] w ramce otwiera kartę postaci i wraca do tej samej ramki", async () => {
  const ctx = ctxOf(["p", "<enter>", "<enter>", "1"]);
  await narration(ctx);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  assert.match(strip(ctx.io.output.join("")), /Atrybuty/);
  assert.match(lastFrame(ctx.io).join("\n"), /Za zakrętem traktu/);
});

test("długi tekst: kolejne strony po Enter, potem menu", async () => {
  const long = Array.from({ length: 60 }, (_, i) => `Zdanie numer ${i + 1} opowieści.`).join(" ");
  const body = wrap(long, sceneWidth(80)).split("\n");
  const { pages } = composeFrame({ cols: 80, rows: 24, hero: { left: "", right: "", lines: ["", ""] }, title: "Zasadzka", body, commands: [{ key: "P", label: "x" }], notices: [], choices: ["x"] });
  assert.ok(pages > 1);
  const ctx = ctxOf(Array(pages).fill("<enter>"));
  await narration(ctx, long);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  const out = strip(ctx.io.output.join(""));
  assert.match(out, /▼ dalej \(Enter\)/);
  assert.match(out, /Zdanie numer 60 opowieści\./);
});

test("komunikat sceny bez ekranu (zjawisko) trafia do strefy komunikatów następnej ramki", async () => {
  const ctx = ctxOf(["1"]);
  await defaultHandlers.phenomenon(ctx, { id: "z", type: "phenomenon", phenomenon: "burza_iskier" });
  await narration(ctx);
  const frame = lastFrame(ctx.io);
  assertFrame(frame);
  assert.ok(frame.some((l) => /^▌ Zaczyna się: Burza iskier\./.test(l)), frame.join("\n"));
});

test("menu z 13 pozycjami w panelu wyboru: 6 wierszy, przewijanie, kursor widoczny", async () => {
  const ctx = ctxOf([...Array(8).fill("<down>"), "<enter>"]);
  showScreen(ctx, { title: "Kram", text: "Towary." });
  const pick = await select(ctx.io, data.ui, { items: Array.from({ length: 13 }, (_, i) => ({ label: `Pozycja ${i + 1}` })) });
  assert.equal(pick, 8);
  const frame = lastFrame(ctx.io);
  assertFrame(frame);
  assert.ok(frame.some((l) => l.includes("▶ [9] Pozycja 9")), frame.join("\n"));
});

test("tryb liniowy narracji – wyjście bez zmian", async () => {
  const ctx = ctxOf(["1"], { tty: false, notices: ["Komunikat."] });
  await narration(ctx);
  assert.equal(ctx.io.output.join(""),
    "Dzień 1, 12:00 · dzień · Brzezina · Test, poz. 1 · HP 38/38\nKomunikat.\n\nZasadzka\nZa zakrętem traktu z przydrożnych krzaków wyłażą dwa osiłki z kijami, śmierdzące\njak stary kożuch w deszczu. „Kiesę daj, paniczu!”\n[1] Dalej\n[2] [P] Postać\n[3] [E] Ekwipunek\n[4] [D] Dziennik\n[5] [Z] Zapisz grę\n[6] [M] Menu główne\n> ");
});

// --- Task 4: pozostałe ekrany w ramkach ---
/** Every frame drawn so far (split at screen clears), as plain line lists. */
function frames(io) {
  return io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1).map((f) => strip(f).split("\n").filter((l) => l !== ""));
}
const framed = (io) => frames(io).filter((f) => f[0]?.startsWith("█▀"));

test("dialog w ramce: mówca w tytule, w kolumnie tylko [P] Postać", async () => {
  const ctx = ctxOf(["4", "1"]);
  await defaultHandlers.dialogue(ctx, { id: "dk", type: "dialogue", dialogue: "komendant" });
  const f = framed(ctx.io).find((x) => x.some((l) => l.includes("[4] Bywaj.")));
  assertFrame(f);
  assert.match(f[3], / Komendant Wszebor /);
  const text = f.join("\n");
  assert.ok(text.includes("[P] Postać"));
  assert.ok(!text.includes("[E] Ekwipunek"));
  assert.ok(f.some((l) => l.includes("[4] Bywaj.")));
});

test("mapa i odpoczynek w ramce: polecenia obozu, suwak godzin w panelu wyboru", async () => {
  const ctx = ctxOf(["1", "<right>", "<right>", "<down>", "<enter>", "1"]);
  ctx.state.world.location = "wilczy_brod";
  ctx.data = structuredClone(ctx.data);
  delete ctx.data.travel.locations.find((l) => l.id === "wilczy_brod").spots; // straight to the destinations screen
  await defaultHandlers.map(ctx, { id: "m", type: "map", hub: "wilczy_brod", main: { label: "Czekaj", goto: "x" } });
  const map = framed(ctx.io).at(-1);
  assertFrame(map);
  assert.ok(map.some((l) => l.includes("Dokąd iść?")));
  assert.ok(map.join("\n").includes("[Z] Zapisz"));
  await defaultHandlers.rest(ctx, { id: "r", type: "rest" });
  const all = framed(ctx.io);
  const slider = all.find((f) => f.some((l) => l.includes("Ile godzin odpoczywasz? 3")));
  assert.ok(slider, all.map((f) => f.join("\n")).join("\n---\n"));
  assertFrame(slider);
});

test("kreator w ramce: bez kolumny poleceń, lista umiejętności przewija się w panelu wyboru", async () => {
  const keys = ["Thorgniew", "<enter>", "<right>", "<right>", "<down>", "<right>", "<down>", "<right>", "<right>",
    "<down>", "<down>", "<down>", "<down>", "<down>", "<enter>", ...Array(10).fill("<down>")];
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const ctx = { state: s, data, io: createScriptedIO(keys, { tty: true }), rng: { int: (a) => a }, debug: false, notices: [] };
  await assert.rejects(defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" }), InputExhaustedError);
  const tagged = framed(ctx.io).filter((f) => f.some((l) => l.includes("Umiejętności wiodące")));
  assert.ok(tagged.length > 0);
  for (const f of tagged) {
    assertFrame(f);
    assert.ok(!f.join("\n").includes("[P] Postać"));
  }
  assert.match(framed(ctx.io)[0][0], /VOIDED: NA PRZEKÓR GWIAZDOM/);
});

const CREATOR_KEYS = ["Thorgniew", "<enter>", "<right>", "<right>", "<down>", "<right>", "<down>", "<right>", "<right>",
  "<down>", "<down>", "<down>", "<down>", "<down>", "<enter>"];

test("kreator w ramce: zmiana suwaka przelicza wartości pochodne w lewym panelu", async () => {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const keys = ["Thorgniew", "<enter>", "<right>", "<right>", "<right>", "<left>", "<left>", "<left>"];
  const ctx = { state: s, data, io: createScriptedIO(keys, { tty: true }), rng: { int: (a) => a }, debug: false, notices: [] };
  await assert.rejects(defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" }), InputExhaustedError);
  const carry = framed(ctx.io).filter((f) => f.some((l) => l.includes("Atrybuty")))
    .map((f) => f.join("\n").match(/Udźwig\s+(\d+)/)?.[1]).filter(Boolean);
  assert.ok(carry.length >= 3, carry.join());
  assert.ok(new Set(carry).size > 1, `Udźwig bez zmian: ${carry.join()}`);
});

test("kreator w ramce 80×24: podsumowanie mieści kartę na jednej stronie", async () => {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const keys = [...CREATOR_KEYS, "<enter>", "<down>", "<enter>", "<down>", "<enter>", ...Array(9).fill("<down>"), "<enter>", "<enter>"];
  const ctx = { state: s, data, io: createScriptedIO(keys, { tty: true }), rng: { int: (a) => a }, debug: false, notices: [] };
  await defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" });
  const summary = framed(ctx.io).filter((f) => f.some((l) => l.includes("Podsumowanie")));
  assert.ok(summary.length > 0);
  for (const f of summary) {
    assertFrame(f);
    assert.ok(!f.join("\n").includes("▼ dalej"), f.join("\n"));
    assert.match(f.join("\n"), /Udźwig|Krytyk/);
  }
});

// --- Task 5: ekwipunek, karta postaci, komunikaty [L] ---
import { showInventory } from "../src/ui/inventory_screen.js";
import { showCharacter } from "../src/ui/character_screen.js";

test("ekwipunek w ramce: bez kolumny poleceń, nagłówek w panelu sceny, lista w panelu wyboru", async () => {
  const ctx = ctxOf(["w"]);
  await showInventory(ctx);
  const f = framed(ctx.io).at(-1);
  assertFrame(f);
  const text = f.join("\n");
  assert.match(text, /Ekwipunek · Waga/);
  assert.ok(!text.includes("[P] Postać"));
  assert.ok(f.some((l) => /▒ ▶ \[1\] Krótki miecz/.test(l)), text);
});

test("karta postaci w ramce 80×24: atrybuty obok umiejętności na pierwszej stronie, wartości pochodne i perki dalej", async () => {
  const ctx = ctxOf(["<enter>", "<enter>"]);
  await showCharacter(ctx);
  const frames = framed(ctx.io);
  const [first] = frames;
  assertFrame(first);
  assert.ok(first.some((l) => l.includes("Atrybuty") && l.includes("Umiejętności")), first.join("\n"));
  const rest = frames.slice(1).flat().join("\n");
  assert.match(rest, /Pancerz/);
  assert.match(rest, /Perki/);
});

test("komunikaty: ponad 2 – „…i N więcej [L]”, [L] pokazuje wszystkie i wraca", async () => {
  const ctx = ctxOf(["l", "<enter>", "1"], { notices: ["Pierwszy.", "Drugi.", "Trzeci.", "Czwarty.", "Piąty."] });
  await narration(ctx);
  const all = framed(ctx.io);
  const first = all.find((f) => readFrame(f).menu?.includes("[L]"));
  assert.ok(first, all.map((f) => f.join("\n")).join("\n---\n"));
  assert.ok(first.some((l) => l.includes("…i 4 więcej [L]")));
  const list = all.find((f) => ["Pierwszy.", "Drugi.", "Trzeci.", "Czwarty.", "Piąty."].every((n) => f.some((l) => l.includes(n))));
  assert.ok(list, "pełna lista komunikatów");
  assertFrame(list);
  assert.match(all.at(-1).join("\n"), /Za zakrętem traktu/);
});

// --- Task 6: walka w ramce ---
import { createAdaptiveIO } from "./helpers.js";

test("walka w ramce: panel bohatera z PA, wrogowie i dziennik w lewym panelu, akcje pionowo w prawym", async () => {
  const ctx = ctxOf([]);
  ctx.io = createAdaptiveIO([{ fight: "win" }], { tty: true });
  const scene = { id: "w", type: "combat", enemies: [{ id: "bandyta", count: 3 }], start: "melee" };
  const d = structuredClone(data);
  d.enemies = d.enemies.map((e) => (e.id === "bandyta" ? { ...e, hp: 1, attacks: [{ ...e.attacks[0], hit: 0 }] } : e));
  ctx.data = d;
  await defaultHandlers.combat(ctx, scene);
  const fight = framed(ctx.io).filter((f) => f.some((l) => /PA [●○]+ \(\d+\/\d+\)/.test(l)));
  assert.ok(fight.length > 0, "brak ramki walki");
  for (const f of fight) assertFrame(f);
  const menu = fight.find((f) => f.some((l) => l.includes("[A] Atak")));
  assert.ok(menu, fight.map((f) => f.join("\n")).join("\n---\n"));
  const read = readFrame(menu);
  assert.ok(read.choices.some((l) => l.includes("[A] Atak")) && read.choices.some((l) => l.includes("[U] Użyj")), menu.join("\n")); // the rest of the list scrolls in 80×24, its keys still work
  assert.ok(read.info.some((l) => l.trim() !== ""), "opis zaznaczonej akcji w polu opisu");
  assert.ok(menu.some((l) => l.includes("BANDYTA")), menu.join("\n"));
  assert.equal(ctx.state.flags.combat_w_wygrana, true);
});

test("zmiana rozmiaru terminala w trakcie gry: następny ekran liniowy z komunikatem, bez wyjątku", async () => {
  const ctx = ctxOf(["1"]);
  await narration(ctx);
  assert.ok(lastFrame(ctx.io)[0].startsWith("█▀"));
  const small = ctxOf(["1"]);
  small.io.columns = 70;
  small.io.rows = 20;
  await narration(small);
  const out = strip(small.io.output.join(""));
  assert.doesNotMatch(out, /█▀/);
  assert.match(out, /Powiększ okno do 80×24, aby zobaczyć panele\./);
  assert.match(out, /Za zakrętem traktu/);
});

// --- Task 4: sklep w nowym układzie ---
for (const [cols, rows] of [[80, 24], [160, 45]]) {
  test(`sklep w ramce ${cols}×${rows}: towary z cenami w prawym panelu, opis towaru w polu opisu`, async () => {
    const ctx = ctxOf(["<enter>", "<down>", "<esc>"]);
    ctx.io.columns = cols;
    ctx.io.rows = rows;
    await assert.rejects(defaultHandlers.shop(ctx, { id: "s", type: "shop", shop: "kramarz_szkolny" }), InputExhaustedError);
    const buy = framed(ctx.io).map(readFrame).filter((r) => r.choices.some((l) => /gr/.test(l)));
    assert.ok(buy.length >= 2);
    for (const r of buy) assert.ok(r.info.join(" ").trim().length > 0, JSON.stringify(r.info));
    assert.notEqual(buy[0].info.join(" "), buy[1].info.join(" "));
    for (const f of framed(ctx.io)) {
      assert.equal(f.length, rows - 1);
      for (const l of f) assert.ok(visibleWidth(l) <= 200, l);
    }
  });
}

test("showScreen w TTY odrzuca klawisze sprzed ekranu (discardInput raz na ekran)", async () => {
  const ctx = ctxOf(["<enter>"]);
  let calls = 0;
  ctx.io.discardInput = () => { calls++; };
  await showScreen(ctx, { lines: ["x"] });
  assert.equal(calls, 1);
});

// --- E3a: ilustracje w showScreen ---
const BIG = { w: 48, h: 20, palette: { a: 15 }, rows: Array(20).fill("a".repeat(48)) };
const withBigArt = (ctx) => { ctx.data = { ...ctx.data, art: { ...ctx.data.art, big: BIG } }; return ctx; };

test("showScreen z art: 200×50 – obraz obok tekstu, 80×24 – ramka jak bez art", async (t) => {
  setColorsEnabled(true);
  setRich256(true);
  t.after(() => { setColorsEnabled(false); setRich256(null); });
  const withArt = withBigArt(ctxOf(["<enter>"]));
  withArt.io.columns = 200;
  withArt.io.rows = 50;
  await showScreen(withArt, { title: "Zasadzka", text: TEXT, art: "big" });
  const scene = readFrame(lastFrame(withArt.io)).scene;
  const row = scene.find((l) => l.includes("▀".repeat(48)));
  assert.ok(row && row.trimStart().startsWith("▀".repeat(48)) && /Za zakrętem/.test(row.slice(row.indexOf("▀") + 50)), scene.join(String.fromCharCode(10)));
  const small = withBigArt(ctxOf(["<enter>"]));
  const plain = ctxOf(["<enter>"]);
  await showScreen(small, { title: "Zasadzka", text: TEXT, art: "big" });
  await showScreen(plain, { title: "Zasadzka", text: TEXT });
  assert.deepEqual(lastFrame(small.io), lastFrame(plain.io));
});

test("narracja i dialog w 200×50: scena z art pokazuje obraz, rozmowa z portretem – portret obok tekstu", async (t) => {
  setColorsEnabled(true);
  setRich256(true);
  t.after(() => { setColorsEnabled(false); setRich256(null); });
  const narr = withBigArt(ctxOf(["<enter>", "1"]));
  narr.io.columns = 200;
  narr.io.rows = 50;
  await defaultHandlers.narration(narr, { id: "n", type: "narration", text: TEXT, art: "big" });
  assert.ok(readFrame(lastFrame(narr.io)).scene.some((l) => l.trimStart().startsWith("▀".repeat(48))));

  const talk = withBigArt(ctxOf(["4", "1"]));
  talk.io.columns = 200;
  talk.io.rows = 50;
  talk.data = { ...talk.data, art: { ...talk.data.art, maly: { ...BIG, w: 20, rows: Array(20).fill("b".repeat(20)), palette: { b: 15 } } },
    dialogues: talk.data.dialogues.map((d) => (d.id === "komendant" ? { ...d, portrait: "maly" } : d)) };
  await defaultHandlers.dialogue(talk, { id: "dk", type: "dialogue", dialogue: "komendant" });
  const f = framed(talk.io).find((x) => x.some((l) => l.includes("[4] Bywaj.")));
  const scene = readFrame(f).scene;
  assert.ok(scene.some((l) => /^\s*▀{20}  \S/.test(l)), scene.join(String.fromCharCode(10))); // the 20-wide portrait, then the speaker's text
});

test("tryb liniowy: scena z art nie drukuje obrazu", async () => {
  const ctx = withBigArt(ctxOf(["1"], { tty: false }));
  await defaultHandlers.narration(ctx, { id: "n", type: "narration", text: TEXT, art: "big" });
  assert.ok(!ctx.io.text().includes("@@@@@@@@"));
});

test("czyszczenie ekranu w TTY kasuje też bufor przewijania (\x1b[3J), nie-TTY niczego nie czyści", async () => {
  const tty = ctxOf([]);
  await showScreen(tty, { lines: ["x"] });
  // Windows Terminal wypycha wyczyszczony ekran do historii przy ESC[2J, więc ESC[3J musi być PO nim ("dwa okna gry")
  assert.ok(tty.io.output.join("").includes("\x1b[2J\x1b[3J\x1b[H"));
  assert.ok(!tty.io.output.join("").includes("\x1b[3J\x1b[2J"));
  const plain = ctxOf([], { tty: false });
  await showScreen(plain, { lines: ["x"] });
  assert.ok(!plain.io.output.join("").includes("\x1b["));
});
