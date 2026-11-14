import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, createAdaptiveIO, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { endLines } from "../src/ui/end_screen.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { visibleWidth } from "../src/ui/frame.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { setColorsEnabled } from "../src/ui/colors.js";

const data = minimalData();
const strip = (s) => stripVTControlCharacters(s);
function hero() {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  return state;
}
const ENDING = { id: "koniec", type: "ending", text: "Wszystko się kiedyś kończy." };

test("endLines: dokładnie height wierszy o szerokości width dla kilku rozmiarów okna", () => {
  for (const [width, height] of [[80, 22], [120, 30], [200, 50]]) {
    const lines = endLines({ width, height, tick: 3, color: true });
    assert.equal(lines.length, height);
    for (const l of lines) assert.equal(visibleWidth(l), width, `${width}x${height}`);
  }
});

test("endLines: ta sama klatka dla tego samego tick, a gwiazdy się ruszają między klatkami", () => {
  const a = endLines({ width: 120, height: 30, tick: 5, color: true });
  const b = endLines({ width: 120, height: 30, tick: 5, color: true });
  assert.deepEqual(a, b);
  const c = endLines({ width: 120, height: 30, tick: 14, color: true });
  assert.notDeepEqual(a, c);
  // the falling stars change many rows, not just a pixel
  assert.ok(a.filter((l, i) => l !== c[i]).length >= 3);
});

test("endLines: kolorowa klatka składa się z półbloków i kodów 256 kolorów, napis THE END jest jasny i zajmuje środek", () => {
  const lines = endLines({ width: 120, height: 30, tick: 0, color: true });
  const joined = lines.join("\n");
  assert.match(joined, /▀/);
  assert.match(joined, /\x1b\[38;5;\d+m/);
  // the lettering: bright (>= 244) pixels on the middle rows are present in a band, not scattered like stars only
  const bright = (l) => (l.match(/\x1b\[38;5;(24[4-9]|25\d)m/g) ?? []).length;
  const middle = lines.slice(Math.floor(30 * 0.2), Math.floor(30 * 0.6));
  assert.ok(middle.filter((l) => bright(l) >= 6).length >= 5, "napis THE END w pasie");
});

test("endLines: bez koloru albo w zbyt małym oknie to czysty tekst z THE END, bez sekwencji ESC", () => {
  for (const spec of [{ width: 80, height: 22, color: false }, { width: 38, height: 10, color: true }]) {
    const lines = endLines({ ...spec, tick: 0 });
    assert.equal(lines.length, spec.height);
    const text = lines.join("\n");
    assert.doesNotMatch(text, /\x1b/);
    assert.match(text, /T H E {3}E N D/);
    for (const l of lines) assert.equal(visibleWidth(l), spec.width);
  }
});

test("scena ending w trybie liniowym: tekst, potem T H E   E N D, bez dodatkowego wejścia", async () => {
  const io = createAdaptiveIO([{ pick: "Dalej" }]);
  const ctx = { state: hero(), data, io, rng: null, debug: false, notices: [] };
  const result = await defaultHandlers.ending(ctx, ENDING);
  assert.deepEqual(result, { end: true });
  const text = strip(io.text());
  assert.match(text, /Wszystko się kiedyś kończy/);
  assert.match(text, /T H E {3}E N D/);
});

test("scena ending w ramce (TTY 80×24): ekran końcowy czeka na Enter, klatka jest domknięta i mieści się w oknie, animacja zmienia klatki", async () => {
  setColorsEnabled(true);
  try {
    const io = createAdaptiveIO([""], { tty: true }) // Enter on the closing text; the end screen then waits for the next key;
    const ctx = { state: hero(), data, io, rng: null, debug: false, notices: [] };
    await assert.rejects(defaultHandlers.ending(ctx, ENDING), InputExhaustedError); // waits for the key on the end screen
    const raw = io.output.join("");
    const frames = raw.split("\x1b[2J\x1b[3J\x1b[H").slice(1);
    const last = frames.at(-1).split("\n").filter((l) => l.length);
    assert.ok(last.length <= 24, `klatka ma ${last.length} wierszy`);
    for (const l of last) assert.ok(visibleWidth(l) <= 80);
    assert.match(raw, /▀/, "gwiazdy i napis rysowane półblokami");
  } finally {
    setColorsEnabled(false);
  }
});
