import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { renderPixels, luminance } from "../src/ui/pixels.js";

const img = (rows, palette = { a: 15, b: 0, c: 9 }) => ({ w: rows[0].length, h: rows.length, palette, rows });

test("kolor: wzory komórek", () => {
  const [row] = renderPixels(img(["a.a.", "b.c."]), { color: true });
  // cell 0: top 15 bottom 0; cell 1: nothing; cell 2: top 15 bottom 9; cell 3: nothing
  assert.equal(row, "\x1b[38;5;15m\x1b[48;5;0m▀\x1b[0m \x1b[38;5;15m\x1b[48;5;9m▀\x1b[0m ");
  const [top] = renderPixels(img(["a.", ".."]), { color: true });
  assert.equal(top, "\x1b[38;5;15m▀\x1b[0m ");
  const [bottom] = renderPixels(img(["..", ".c"]), { color: true });
  assert.equal(bottom, " \x1b[38;5;9m▄\x1b[0m");
});

test("kolor: całkiem przezroczysty wiersz to same spacje, bez sekwencji", () => {
  assert.deepEqual(renderPixels(img(["..", ".."]), { color: true }), ["  "]);
});

test("ASCII: biały → @, czarny → spacja, przezroczysta komórka → spacja; bez ANSI", () => {
  const [row] = renderPixels(img(["a.b", "a.b"]), { color: false });
  assert.equal(row, "@  ");
  assert.equal(stripVTControlCharacters(row), row);
});

test("ASCII: komórka z jednym pikselem liczy tylko ten piksel", () => {
  const [row] = renderPixels(img(["a", "."]), { color: false });
  assert.equal(row, "@");
});

test("renderPixels: h/2 wierszy po w kolumn", () => {
  const rows = renderPixels(img(["aaaa", "bbbb", "cccc", "...."]), { color: true });
  assert.equal(rows.length, 2);
  for (const r of rows) assert.equal(stripVTControlCharacters(r).length, 4);
});

test("luminance: biały > szary > czarny, szarości 232+ rosną", () => {
  assert.ok(luminance(15) > luminance(8) && luminance(8) > luminance(0));
  assert.ok(luminance(255) > luminance(232));
  assert.equal(luminance(15), 255);
});
