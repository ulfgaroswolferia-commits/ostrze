import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";
import { createScriptedIO } from "../src/ui/io.js";
import { choose, confirm, pressEnter } from "../src/ui/prompt.js";
import { statusBar, clear, textWidth, sceneHeader } from "../src/ui/screen.js";
import { t } from "../src/ui/strings.js";
import { minimalData } from "./helpers.js";
import { createCharacter, creatorStartAttributes } from "../src/systems/character.js";
import { getStats } from "../src/systems/stats.js";
import { renderCharacter } from "../src/ui/character_screen.js";
import { paint, setColorsEnabled } from "../src/ui/colors.js";

const UI = JSON.parse(readFileSync(new URL("../data/ui.json", import.meta.url), "utf8"));

test("choose akceptuje ' 2\r', odrzuca 0/abc/puste/za duże", async () => {
  const io = createScriptedIO(["0", "abc", "", "4", " 2\r"]);
  assert.equal(await choose(io, UI, ["A", "B", "C"]), 1);
  assert.equal((io.text().match(/Wpisz liczbę od 1 do 3\./g) ?? []).length, 4);
  assert.match(io.text(), /\[1\] A\n\[2\] B\n\[3\] C/);
});
test("confirm", async () => {
  assert.equal(await confirm(createScriptedIO(["TAK"]), UI, "?"), true);
  assert.equal(await confirm(createScriptedIO(["x", "n"]), UI, "?"), false);
});
test("pressEnter przyjmuje dowolną odpowiedź", async () => {
  const io = createScriptedIO(["cokolwiek"]);
  await pressEnter(io, UI);
  assert.match(io.text(), /\[Enter\] dalej/);
});
const data = minimalData();
const strip = stripVTControlCharacters;
const makeCharacter = () => createCharacter({
  name: "Thorgniew", classId: "miecz", attributes: { ...creatorStartAttributes(data), sila: 7, krzepa: 7, zrecznosc: 6 }, tagged: ["sieczna", "wrecz", "wymowa"],
}, data);
test("statusBar: czas, pora, postać, debug", () => {
  const s = { time: { minutes: 6 * 60 + 30 }, character: null, vars: { wola: 1 } };
  assert.equal(strip(statusBar(s, data)), "Dzień 1, 06:30 · świt");
  const ch = makeCharacter();
  const withChar = { ...s, character: ch };
  const hpMax = getStats(withChar, data).derived.hpMax;
  assert.equal(strip(statusBar(withChar, data, { debug: true })), `Dzień 1, 06:30 · świt · Thorgniew, poz. 1 · HP ${ch.hp}/${hpMax} [wola 1 · dług 0]`);
});
test("renderCharacter: wartości, rozbicie i XP", () => {
  const character = makeCharacter();
  character.perks.push("szczesciarz");
  const state = { time: { minutes: 12 * 60 }, character, vars: { wola: 3, dlug: 2 } };
  const out = strip(renderCharacter(state, data));
  assert.match(out, /Fart\s+6/); assert.match(out, /Szczęściarz/); assert.match(out, /XP: \d+\/150/);
  assert.match(out, /\(baza 5; \+1 Szczęściarz\)/);
  assert.match(out, /\*Broń sieczna/);
  assert.doesNotMatch(out, /wola|dług/i);
});
test("pressEnter: p pokazuje postać, potem Enter kończy (TTY i bez TTY)", async () => {
  let n = 0; const onCharacter = async () => { n++; };
  await pressEnter(createScriptedIO(["p", "<enter>"], { tty: true }), UI, { onCharacter });
  await pressEnter(createScriptedIO(["P", ""]), UI, { onCharacter });
  assert.equal(n, 2);
  const io = createScriptedIO(["x", "<enter>"], { tty: true });
  await pressEnter(io, UI, { onCharacter });
  assert.equal(n, 2); assert.match(io.text(), /\[P\] postać/);
});
test("pressEnter (klawisze): ignorowane klawisze nie powtarzają monitu", async () => {
  const io = createScriptedIO(["<down>", "<enter>"], { tty: true });
  await pressEnter(io, UI, { onCharacter: async () => {} });
  assert.equal((io.text().match(/\[P\] postać/g) ?? []).length, 1);
  const io2 = createScriptedIO(["p", "<enter>"], { tty: true });
  await pressEnter(io2, UI, { onCharacter: async () => {} });
  assert.equal((io2.text().match(/\[P\] postać/g) ?? []).length, 2);
});
test("t podstawia zmienne i zwraca [[klucz]] dla braku", () => {
  assert.equal(t({ a: "x {n}" }, "a", { n: 3 }), "x 3"); assert.equal(t({}, "b"), "[[b]]");
});
test("screen: clear, textWidth, sceneHeader", () => {
  const io = createScriptedIO([]);
  clear(io);
  assert.deepEqual(io.output, []);
  io.isTTY = true;
  clear(io);
  assert.deepEqual(io.output, ["\x1b[2J\x1b[3J\x1b[H"]);
  assert.equal(textWidth(io), 80);
  assert.equal(textWidth({ columns: 200 }), 100);
  assert.equal(stripVTControlCharacters(sceneHeader("Tytuł")), "Tytuł");
});
test("paint: włączone dodaje kody, wyłączone zwraca tekst", () => {
  setColorsEnabled(true);
  assert.notEqual(paint("damage", "x"), "x");
  assert.equal(stripVTControlCharacters(paint("warn", "x")), "x");
  setColorsEnabled(false);
  assert.equal(paint("damage", "x"), "x");
});
test("renderCharacter: sprzęt – źródło, pancerz, redukcja i broń", () => {
  const character = makeCharacter();
  const base = { time: { minutes: 12 * 60 }, character, vars: {} };
  const plain = strip(renderCharacter(base, data));
  assert.match(plain, /Pancerz: 0 · redukcja: brak/); assert.match(plain, /Broń: Pięści/);
  const state = { ...base, inventory: { items: [{ id: "kolczuga", qty: 1 }, { id: "miecz_krotki", qty: 1 }],
    equipped: { tulow: "kolczuga", bron: "miecz_krotki" }, quickSlots: [] } };
  const out = strip(renderCharacter(state, data));
  assert.match(out, /Pancerz: 2 · redukcja: sieczne 30%, kłute 10%/); assert.match(out, /Broń: Krótki miecz/);
  assert.match(out, /-1 Kolczuga/);
});
test("renderCharacter: sekcja Biegłość pokazuje rodzaje > 0", () => {
  const character = makeCharacter();
  character.mastery.miecz = 16.4;
  const out = strip(renderCharacter({ time: { minutes: 12 * 60 }, character, vars: {} }, data));
  assert.match(out, /Biegłość\n─+\nMiecz +16\.4/);
  assert.doesNotMatch(out, /Łuk \d/);
});

test("dalej: w ramce Enter i „1” są równoważne (pressEnter i przejście strony)", async () => {
  const { createScriptedIO } = await import("../src/ui/io.js");
  for (const key of ["", "1"]) {
    const io = createScriptedIO([key], { tty: true });
    io.frame = { commands: [], notices: [], lastChoices: [], hero: null, title: null, body: [], page: 0, choiceTitle: null, choiceInfo: null, side: [], art: null };
    await pressEnter(io, { "prompt.enter": "x", "frame.next": "dalej" });
  }
});
