import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePix, PixError, ART_LIMITS } from "../src/engine/pix.js";

const OK = "# Bandyta\r\npaleta: a=236 b=94\r\n\r\n.ab.\r\nab..\r\n\r\n";

test("parsePix: komentarz, CRLF i puste linie – w, h, paleta, wiersze", () => {
  assert.deepEqual(parsePix(OK), { w: 4, h: 2, palette: { a: 236, b: 94 }, rows: [".ab.", "ab.."] });
});

test("ART_LIMITS: scena 96×48, portret 48×48, wróg 64×48", () => {
  assert.deepEqual(ART_LIMITS, { scene: { w: 96, h: 48 }, portrait: { w: 48, h: 48 }, enemy: { w: 64, h: 48 } });
});

const bad = (text, pattern) => assert.throws(() => parsePix(text), (e) => e instanceof PixError && pattern.test(e.message), text);

test("parsePix: błędy z numerem wiersza", () => {
  bad("ab\nab\n", /brak linii „paleta:”/);
  bad("paleta: a=1\n.z\n..\n", /wiersz 2: nieznana litera „z”/);
  bad("paleta: .=1\n..\n..\n", /wiersz 1: .*„\.”/);
  bad("paleta: _=1\n..\n..\n", /wiersz 1: .*„_”/);
  bad("paleta: a=256\n..\n..\n", /wiersz 1: numer koloru 256 poza 0–255/);
  bad("paleta: a=1\n..\n...\n", /wiersz 3: wiersz ma 3 znaki, oczekiwano 2/);
  bad("paleta: a=1\n..\n..\n..\n", /nieparzysta liczba wierszy \(3\)/);
  bad("# nic\npaleta: a=1\n\n", /pusta siatka/);
});

test("parsePix: paleta może używać liter a–z, A–Z i 0–9 (62 kolory)", () => {
  const img = parsePix("paleta: a=1 Z=2 9=3\naZ9.\n9Za.\n");
  assert.deepEqual(img.palette, { a: 1, Z: 2, 9: 3 });
  assert.deepEqual(img.rows, ["aZ9.", "9Za."]);
  bad("paleta: a=1\n.Z\n..\n", /wiersz 2: nieznana litera „Z”/);
});

test("parsePix: powtórzona litera palety to błąd", () => {
  bad("paleta: a=1 a=2\n..\n..\n", /wiersz 1: litera palety „a” powtórzona/);
});
