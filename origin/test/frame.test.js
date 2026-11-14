import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { composeFrame, sceneWidth, scenePad, frameWidth, visibleWidth, fitWidth } from "../src/ui/frame.js";
import { paint, setColorsEnabled } from "../src/ui/colors.js";
import { readFrame } from "./frame_read.js";

const strip = (s) => stripVTControlCharacters(s);
const HERO = { left: "Thorgniew · poz. 2 · Klasa miecza", right: "Dzień 2, 14:00 · dzień", lines: ["HP ████████░░ 41/46   XP 190/450", "Broń: Krótki miecz"] };
const COMMANDS = [{ key: "P", label: "Postać" }, { key: "E", label: "Ekwipunek" }, { key: "D", label: "Dziennik" }, { key: "Z", label: "Zapisz" }, { key: "M", label: "Menu" }];
const base = (over = {}) => ({ cols: 80, rows: 24, hero: HERO, title: "Zasadzka", body: ["Tekst sceny."], commands: COMMANDS, notices: [], choices: ["[1] Dalej"], ...over });
/** Plain lines of the frame. */
const plain = (spec) => composeFrame(spec).lines.map(strip);

function assertClosed(lines, cols) {
  for (const l of lines) assert.equal(visibleWidth(l), cols, `szerokość ${visibleWidth(l)}: ${l}`);
  assert.ok(lines[0].startsWith("█▀") && lines[0].endsWith("▀█"), lines[0]);
  assert.ok(/^█▄+█$/.test(lines.at(-1)), lines.at(-1));
  for (const l of lines.slice(1, -1)) {
    assert.ok(/^[▌█]/.test(l), `lewa krawędź: ${l}`);
    assert.ok(/[▐█]$/.test(l), `prawa krawędź: ${l}`);
  }
}

test("80×24: 23 wiersze po 80 kolumn, ramka domknięta, geometria wg spec", () => {
  const r = composeFrame(base());
  const lines = r.lines.map(strip);
  assert.equal(lines.length, 23);
  assertClosed(lines, 80);
  assert.equal(r.choiceWidth, 30);
  assert.equal(r.sceneRows, 16);
  assert.equal(r.choiceRows, 16);
  assert.match(lines[0], /^█▀ Thorgniew · poz\. 2 · Klasa miecza ▀+ Dzień 2, 14:00 · dzień ▀█$/);
  assert.match(lines[1], /^▌ HP ████████░░ 41\/46 {3}XP 190\/450 +▐$/);
  assert.match(lines[3], /^█[░▒]+ Zasadzka [░▒]+▓[░▒]+█$/);
  assert.equal(lines[3].indexOf("▓"), sceneWidth(80) + 3);
});

test("szerokości: scena 43, prawy panel 30 przy 80 kolumnach; 120 → 36; 220×50 ograniczone do 200", () => {
  assert.equal(sceneWidth(80), 43);
  const mid = composeFrame(base({ cols: 120, rows: 40 }));
  assert.equal(mid.choiceWidth, 36);
  assert.equal(mid.lines.length, 39);
  const wide = composeFrame(base({ cols: 220, rows: 50 }));
  assert.equal(frameWidth(220), 200);
  assert.equal(wide.choiceWidth, 42);
  assert.equal(wide.lines.length, 49);
  for (const l of wide.lines) assert.ok(visibleWidth(l) <= 200, l);
  assertClosed(wide.lines.map(strip), 200);
});

test("pola: tytuł wyboru w wierszu tytułu, lista w prawym panelu, scena w lewym", () => {
  const f = readFrame(composeFrame(base({ choiceTitle: "Co robisz?", choices: ["[1] Dalej", "[2] Wróć"], body: ["x".repeat(43)] })).lines);
  assert.equal(f.title, "Zasadzka");
  assert.equal(f.choiceTitle, "Co robisz?");
  assert.equal(f.scene[0], "x".repeat(43));
  assert.deepEqual(f.choices.slice(0, 2), ["[1] Dalej", "[2] Wróć"]);
  assert.equal(f.menu, "[P] Postać  [E] Ekwipunek  [D] Dziennik  [Z] Zapisz  [M] Menu");
});

test("info: pole opisu zmniejsza listę o 5 wierszy, null nie; opis zawijany i ucinany „…”", () => {
  const without = composeFrame(base({ info: null }));
  const empty = composeFrame(base({ info: "" }));
  assert.equal(empty.choiceRows, without.choiceRows - 5);
  assert.equal(empty.lines.length, 23);
  const long = readFrame(composeFrame(base({ info: "słowo ".repeat(60) })).lines);
  assert.equal(long.info.length, 4);
  assert.ok(long.info[3].endsWith("…"), long.info.join("|"));
  assertClosed(composeFrame(base({ info: "Krótki opis." })).lines.map(strip), 80);
});

test("menu: przy ciasnocie etykiety od końca skracane do [X]", () => {
  const many = ["P", "E", "D", "Z", "M", "L", "K", "J"].map((key) => ({ key, label: `Polecenie ${key}` }));
  const f = readFrame(composeFrame(base({ commands: many })).lines);
  assert.ok(f.menu.length <= 76, f.menu);
  assert.ok(f.menu.includes("[J]") && !f.menu.includes("Polecenie J"), f.menu);
  assert.ok(f.menu.startsWith("[P] Polecenie P"), f.menu);
});

test("wysokości: komunikaty i menu razem – nadal rows − 1 wierszy; sceneRows maleje", () => {
  assert.equal(composeFrame(base()).sceneRows, 16);
  assert.equal(composeFrame(base({ notices: ["Jeden."] })).sceneRows, 14);
  assert.equal(composeFrame(base({ notices: ["Jeden.", "Dwa."] })).sceneRows, 13);
  const lines = plain(base({ notices: ["a", "b", "c", "d", "e"] }));
  assert.ok(lines.some((l) => l.startsWith("▌ e ")), lines.join("\n"));
  assert.ok(lines.some((l) => l.includes("…i 4 więcej [L]")), lines.join("\n"));
  assert.equal(lines.length, 23);
  assert.equal(plain(base({ commands: [] })).length, 23);
});

test("komunikaty i menu: komunikaty nad separatorem, menu pod nim", () => {
  const f = readFrame(composeFrame(base({ notices: ["Nowe zadanie: Wilcza Nora."] })).lines);
  assert.deepEqual(f.notices, ["Nowe zadanie: Wilcza Nora."]);
  assert.ok(f.menu.startsWith("[P] Postać"));
});

test("strony tekstu zależą tylko od sceneRows (nie od długości listy)", () => {
  const body = Array.from({ length: 60 }, (_, i) => `wiersz ${i + 1}`);
  const a = composeFrame(base({ body, choices: ["[1] x"] }));
  const b = composeFrame(base({ body, choices: Array(40).fill("[n] x") }));
  assert.ok(a.pages > 1);
  assert.equal(a.pages, b.pages);
  assert.ok(a.lines.map(strip).some((l) => l.includes("▼ dalej (Enter)")));
  const last = plain(base({ body, page: a.pages - 1 }));
  assert.ok(last.some((l) => l.includes("wiersz 60")));
  assert.ok(!last.some((l) => l.includes("▼ dalej")));
  assertClosed(last, 80);
});

test("zawijanie zwykłego tekstu, ucinanie za długich linii z kolorem, ⚡ liczone podwójnie", () => {
  const long = "słowo ".repeat(30).trim();
  const lines = plain(base({ body: [long] }));
  assert.ok(lines.filter((l) => l.includes("słowo")).length >= 3);
  assertClosed(lines, 80);
  setColorsEnabled(true);
  try {
    const painted = plain(base({ body: ["x " + paint("warn", "z".repeat(100))] }));
    assert.ok(painted[4].includes("…"), painted[4]);
    assertClosed(painted, 80);
  } finally {
    setColorsEnabled(false);
  }
  const storm = plain(base({ hero: { ...HERO, lines: ["HP 41/46 · ⚡ Burza iskier", "x"] } }));
  assertClosed(storm, 80);
});

test("kolory: ramki pomalowane, szerokość widoczna bez zmian", () => {
  setColorsEnabled(true);
  try {
    const { lines } = composeFrame(base({ notices: ["a"] }));
    assert.ok(lines[0].includes("\x1b["), "ramka bez koloru");
    for (const l of lines) assert.equal(visibleWidth(l), 80);
    assert.equal(visibleWidth(fitWidth(paint("warn", "abcdef"), 4)), 4);
  } finally {
    setColorsEnabled(false);
  }
});

test("bez bohatera – tytuł gry w górnej ramce", () => {
  const menu = plain(base({ hero: null, title: null, commands: [] }));
  assert.match(menu[0], /^█▀ VOIDED: NA PRZEKÓR GWIAZDOM ▀+█$/);
  assertClosed(menu, 80);
  assert.equal(menu.length, 23);
});

// --- E3a: ilustracje ---
const ART = (rows = 10, width = 48) => ({ lines: Array.from({ length: rows }, (_, i) => String(i % 10).repeat(width)), width });
const artBase = (over = {}) => base({ art: ART(), ...over });

test("ilustracja: 80×24 z bohaterem – brak, ramka identyczna jak bez art", () => {
  const without = composeFrame(base({ body: ["Tekst sceny."] }));
  const withArt = composeFrame(artBase({ body: ["Tekst sceny."] }));
  assert.equal(withArt.artMode, "none");
  assert.deepEqual(withArt.lines, without.lines);
  assert.equal(withArt.pages, without.pages);
});

test("ilustracja: 132×40 – nad tekstem, obraz w pierwszych 10 wierszach sceny", () => {
  const f = composeFrame(artBase({ cols: 132, rows: 40 }));
  assert.equal(f.artMode, "top");
  const scene = readFrame(f.lines.map(strip)).scene;
  const pad = scenePad(132);
  assert.equal(scene[0].trim(), "", "wolny wiersz nad tekstem w wysokim oknie");
  assert.ok(scene.slice(1, 11).every((l, k) => l.slice(pad).startsWith(String(k % 10).repeat(48))), scene.slice(0, 12).join(String.fromCharCode(10)));
  assert.equal(scene[11].trim(), "Tekst sceny.");
});

test("ilustracja: 200×50 – obok tekstu, wiersz tekstu w linii obrazu, zawijanie do L − 50", () => {
  const long = "słowo ".repeat(60).trim();
  const f = composeFrame(artBase({ cols: 200, rows: 50, body: [long] }));
  assert.equal(f.artMode, "side");
  const scene = readFrame(f.lines.map(strip)).scene;
  const pad = scenePad(200);
  assert.ok(scene[1].slice(pad).startsWith("0".repeat(48) + "  słowo"), scene[1]);
  const textWidth = sceneWidth(200) - 48 - 2;
  for (const l of scene.slice(1)) assert.ok(visibleWidth(l.slice(pad + 50).trimEnd()) <= textWidth, l);
  assert.equal(f.lines.length, 49);
});

test("ilustracja: tekst dłuższy niż strona w trybie nad – obraz tylko na stronie 0, pojemność M − 10", () => {
  const body = Array.from({ length: 40 }, (_, i) => `Wiersz ${i + 1}`);
  const first = composeFrame(artBase({ cols: 132, rows: 40, body, page: 0 }));
  const none = composeFrame(base({ cols: 132, rows: 40, body }));
  assert.ok(first.pages > none.pages - 1 && first.pages >= none.pages);
  const second = composeFrame(artBase({ cols: 132, rows: 40, body, page: 1 }));
  const scene2 = readFrame(second.lines.map(strip)).scene;
  assert.ok(!scene2.some((l) => /^0{48}/.test(l)), "bez obrazu");
  assert.match(readFrame(first.lines.map(strip)).scene.at(-1), /▼ dalej/);
  const lastShown = composeFrame(artBase({ cols: 132, rows: 40, body, page: 99 }));
  assert.equal(readFrame(lastShown.lines.map(strip)).scene.some((l) => l.includes("Wiersz 40")), true);
});

test("ilustracja: 220×50 z 2 komunikatami i menu – rows − 1 wierszy, ≤ 200 kolumn", () => {
  const f = composeFrame(artBase({ cols: 220, rows: 50, notices: ["Raz.", "Dwa."] }));
  assert.equal(f.lines.length, 49);
  for (const l of f.lines) assert.ok(visibleWidth(l) <= 200, l);
});

test("ilustracja: wąski lewy panel (80×30) – obraz szerszy niż panel nie jest ucinany, tylko pomijany", () => {
  const f = composeFrame(artBase({ cols: 80, rows: 30 }));
  assert.equal(f.artMode, "none");
  assert.ok(!f.lines.map(strip).some((l) => l.includes("…")), "bez ucinania obrazu");
  const narrow = composeFrame(artBase({ cols: 80, rows: 30, art: ART(10, 40) }));
  assert.equal(narrow.artMode, "top", "obraz mieszczący się w panelu (40 ≤ 43) nadal jest pokazany");
});
