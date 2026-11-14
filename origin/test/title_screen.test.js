import { test } from "node:test";
import assert from "node:assert/strict";
import { titleLines } from "../src/ui/title_screen.js";

const plain = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

test("ekran startowy: dokładnie width×height w kolorze, w każdym rozmiarze okna", () => {
  for (const [w, h] of [[43, 14], [80, 24], [120, 40], [200, 60]]) {
    const lines = titleLines({ width: w, height: h, tick: 3, subtitle: "Gra fabularna" });
    assert.equal(lines.length, h);
    for (const l of lines) assert.equal([...plain(l)].length, w, `${w}×${h}`);
  }
});

test("ekran startowy: pod logo podtytuł „na przekór gwiazdom”, rozstrzelony, gdy się mieści", () => {
  assert.ok(titleLines({ width: 100, height: 30 }).map(plain).some((l) => l.includes("N A   P R Z E K Ó R   G W I A Z D O M")));
  assert.ok(titleLines({ width: 40, height: 14 }).map(plain).some((l) => l.includes("NA PRZEKÓR GWIAZDOM")));
});

test("ekran startowy: animacja zmienia klatki, ta sama klatka jest deterministyczna", () => {
  const a = titleLines({ width: 100, height: 30, tick: 1 }).join("\n");
  assert.equal(a, titleLines({ width: 100, height: 30, tick: 1 }).join("\n"));
  assert.notEqual(a, titleLines({ width: 100, height: 30, tick: 25 }).join("\n"));
});

test("ekran startowy: bez kolorów – nieruchomy napis w tym samym rozmiarze, bez sekwencji ucieczki", () => {
  const lines = titleLines({ width: 60, height: 20, tick: 5, color: false, subtitle: "Podtytuł" });
  assert.equal(lines.length, 20);
  assert.ok(lines.every((l) => l.length === 60 && !l.includes("\x1b")));
  assert.ok(lines.some((l) => l.includes("V O I D E D")));
  assert.deepEqual(lines, titleLines({ width: 60, height: 20, tick: 99, color: false, subtitle: "Podtytuł" }));
});
