import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createScriptedIO } from "../src/ui/io.js";
import { select, multiSelect, sliders, textInput } from "../src/ui/menu.js";
import { setColorsEnabled } from "../src/ui/colors.js";

setColorsEnabled(false);
const UI = JSON.parse(readFileSync(new URL("../data/ui.json", import.meta.url), "utf8"));
const tty = (keys) => createScriptedIO(keys, { tty: true });
const items = [{ label: "A" }, { label: "B", disabled: true }, { label: "C" }];
test("select: ↓ przeskakuje wyszarzone, zawija, Enter", async () => {
  assert.equal(await select(tty(["<down>", "<enter>"]), UI, { items }), 2);
  assert.equal(await select(tty(["<down>", "<down>", "<enter>"]), UI, { items }), 0);
  assert.equal(await select(tty(["<up>", "<enter>"]), UI, { items }), 2);
});
test("select: cyfra jako skrót, wyszarzona cyfra ignorowana", async () =>
  assert.equal(await select(tty(["2", "3"]), UI, { items }), 2));
test("select bez TTY: numer, zły numer, wyszarzony", async () => {
  const io = createScriptedIO(["9", "2", "3"]);
  assert.equal(await select(io, UI, { items }), 2);
  assert.match(io.text(), /Wpisz liczbę od 1 do 3\./); assert.match(io.text(), /\(niedostępne\)/);
});
test("select przycina długie etykiety do szerokości", async () => {
  const io = tty(["<enter>"]); io.columns = 20;
  await select(io, UI, { items: [{ label: "x".repeat(50) }] });
  assert.ok(io.text().split("\n").every((l) => [...l].length <= 20));
});
test("select: initial, opis, przerysowanie", async () => {
  const io = tty(["<up>", "<enter>"]);
  assert.equal(await select(io, UI, { items: [{ label: "A", description: "opis A" }, { label: "B" }], initial: 1 }), 0);
  assert.match(io.output.join(""), /\r\x1b\[2A\x1b\[0J/);
  assert.match(io.text(), /opis A/);
});
test("select: brak aktywnych pozycji rzuca błąd", async () =>
  assert.rejects(select(tty([]), UI, { items: [{ label: "A", disabled: true }] }), /brak aktywnych/));
test("multiSelect: zablokowana, przełączanie, Gotowe dopiero przy count", async () => {
  const its = [{ label: "Sieczna", locked: true, checked: true }, { label: "Wymowa" }, { label: "Medycyna" }, { label: "Handel" }];
  assert.deepEqual(await multiSelect(tty(["2", "3", "4", "4", "5"]), UI, { items: its, count: 3 }), [0, 1, 2]);
});
test("multiSelect: Gotowe nieaktywne ignorowane, Enter przełącza", async () => {
  const its = [{ label: "A" }, { label: "B" }];
  assert.deepEqual(await multiSelect(tty(["3", "<enter>", "<down>", "<enter>", "<down>", "<enter>"]), UI, { items: its, count: 2 }), [0, 1]);
});
test("multiSelect bez TTY", async () => {
  const its = [{ label: "A" }, { label: "B", locked: true, checked: true }];
  const io = createScriptedIO(["7", "3", "1", "3"]);
  assert.deepEqual(await multiSelect(io, UI, { items: its, count: 2 }), [0, 1]);
  assert.match(io.text(), /\[x\] B/);
});
test("sliders: budżet, granice, Gotowe", async () => {
  const rows = [{ label: "Siła", value: 5, min: 2, max: 10 }, { label: "Fart", value: 5, min: 2, max: 10 }];
  const v = await sliders(tty(["<right>", "<right>", "<down>", "<left>", "<right>", "<right>", "<down>", "<enter>"]), UI, { rows, budget: 2 });
  assert.deepEqual(v, [7, 5]);
});
test("sliders: step 2 i Gotowe, gdy nic nie może wzrosnąć", async () => {
  const v = await sliders(tty(["<right>", "<down>", "<enter>"]), UI, { rows: [{ label: "S", value: 98, min: 98, max: 100, step: 2 }], budget: 3 });
  assert.deepEqual(v, [100]);
});
test("sliders bez TTY: 1++, 2-, Gotowe", async () => {
  const rows = [{ label: "Siła", value: 5, min: 2, max: 10 }, { label: "Fart", value: 5, min: 2, max: 10 }];
  assert.deepEqual(await sliders(createScriptedIO(["1++", "2-", "1+", "3"]), UI, { rows, budget: 2 }), [8, 4]);
});
test("sliders bez TTY: niedozwolone Gotowe i śmieci -> pomoc", async () => {
  const io = createScriptedIO(["2", "x", "1+", "2"]);
  assert.deepEqual(await sliders(io, UI, { rows: [{ label: "S", value: 5, min: 2, max: 10 }], budget: 1 }), [6]);
  assert.equal((io.text().match(/Wpisz numer i \+ lub −/g) ?? []).length, 2);
});
test("textInput: domyślna, walidacja, polskie litery", async () => {
  const opts = { prompt: "Imię: ", min: 2, max: 20, pattern: /^[\p{L}][\p{L} -]*$/u, defaultValue: "Bezimienny" };
  assert.equal(await textInput(createScriptedIO([""]), UI, opts), "Bezimienny");
  assert.equal(await textInput(createScriptedIO(["R2D2", " Żelisław "]), UI, opts), "Żelisław");
});
test("multiSelect: licznik zaznaczonych odświeżany przy przełączaniu (TTY)", async () => {
  const its = [{ label: "Sieczna", locked: true, checked: true }, { label: "Wymowa" }, { label: "Medycyna" }];
  const io = tty(["2", "3", "4"]);
  await multiSelect(io, UI, { items: its, count: 3 });
  const out = io.text();
  const i1 = out.indexOf("Wybrane: 1/3"), i2 = out.indexOf("Wybrane: 2/3"), i3 = out.indexOf("Wybrane: 3/3");
  assert.ok(i1 >= 0 && i2 > i1 && i3 > i2, out);
});
test("multiSelect bez TTY: licznik zaznaczonych", async () => {
  const its = [{ label: "A" }, { label: "B" }];
  const io = createScriptedIO(["1", "2", "3"]);
  await multiSelect(io, UI, { items: its, count: 2 });
  assert.match(io.text(), /Wybrane: 0\/2[\s\S]*Wybrane: 1\/2[\s\S]*Wybrane: 2\/2/);
});

// --- Task 7: skróty literowe, pusty Enter, przewijanie ---
const blocksOf = (io) => io.output.filter((c) => !c.startsWith("\r\x1b["));
const longItems = (n) => Array.from({ length: n }, (_, i) => ({ label: `Pozycja ${i + 1}` }));
test("select: skrót literowy w trybie klawiszy, bez względu na wielkość", async () => {
  const io = tty(["P"]);
  const hot = [{ label: "Dalej" }, { label: "Postać", hotkey: "p" }];
  assert.equal(await select(io, UI, { items: hot }), 1);
  assert.match(io.text(), /\[P\] Postać/);
});
test("select: wyszarzony skrót ignorowany", async () => {
  const hot = [{ label: "Dalej" }, { label: "Postać", hotkey: "p", disabled: true }];
  assert.equal(await select(tty(["p", "<enter>"]), UI, { items: hot }), 0);
});
test("select bez TTY: litera, pusty Enter z emptyPicksInitial, bez opcji komunikat", async () => {
  const hot = [{ label: "Dalej" }, { label: "Postać", hotkey: "p" }];
  assert.equal(await select(createScriptedIO(["p"]), UI, { items: hot }), 1);
  assert.equal(await select(createScriptedIO([""]), UI, { items: hot, emptyPicksInitial: true }), 0);
  assert.equal(await select(createScriptedIO([""]), UI, { items: hot, emptyPicksInitial: true, initial: 1 }), 1);
  const io = createScriptedIO(["", "1"]);
  assert.equal(await select(io, UI, { items: hot }), 0);
  assert.match(io.text(), /Wpisz liczbę od 1 do 2\./);
});
test("select: przewijanie długiej listy zachowuje wysokość i kursor widoczny", async () => {
  const io = tty([...Array(15).fill("<down>"), "<enter>"]); io.rows = 14;
  assert.equal(await select(io, UI, { items: longItems(40) }), 15);
  const blocks = blocksOf(io);
  for (const b of blocks) assert.ok(b.trimEnd().split("\n").length <= 12);
  const last = blocks.at(-1);
  assert.match(last, /Pozycja 16/); assert.doesNotMatch(last, /Pozycja 1(\s|$)/);
  assert.match(last, /↑ …/); assert.match(last, /↓ …/);
});
test("multiSelect: przewijanie, kursor na Gotowe widoczny", async () => {
  const io2 = tty(["<up>", "<enter>"]); io2.rows = 14;
  assert.deepEqual(await multiSelect(io2, UI, { items: longItems(40), count: 0 }), []);
  const blocks = blocksOf(io2);
  for (const b of blocks) assert.ok(b.trimEnd().split("\n").length <= 13);
  const last = blocks.at(-1);
  assert.match(last, /▶ Gotowe/); assert.match(last, /↑ …/); assert.doesNotMatch(last, /↓ …/);
});
test("sliders: przewijanie, kursor na Gotowe widoczny", async () => {
  const rows = Array.from({ length: 40 }, (_, i) => ({ label: `Wiersz ${i + 1}`, value: 0, min: 0, max: 3 }));
  const io = tty(["<up>", "<enter>"]); io.rows = 14;
  assert.equal((await sliders(io, UI, { rows })).length, 40);
  const blocks = blocksOf(io);
  for (const b of blocks) assert.ok(b.trimEnd().split("\n").length <= 13);
  const last = blocks.at(-1);
  assert.match(last, /▶ Gotowe/); assert.match(last, /↑ …/); assert.doesNotMatch(last, /↓ …/);
});
