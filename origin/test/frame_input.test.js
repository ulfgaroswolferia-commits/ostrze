import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createScriptedIO } from "../src/ui/io.js";
import { showScreen } from "../src/ui/screen.js";
import { textInput } from "../src/ui/menu.js";
import { confirm } from "../src/ui/prompt.js";

const data = minimalData();
const strip = (s) => stripVTControlCharacters(s);
const NAME = { min: 2, max: 10, pattern: /^[\p{L}][\p{L} -]*$/u, defaultValue: "Bezimienny", label: "Imię:" };

function ctxOf(inputs) {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  return { state, data, io: createScriptedIO(inputs, { tty: true }), rng: { int: (a) => a }, debug: false, notices: [] };
}
const CLEAR = String.fromCharCode(27) + "[2J" + String.fromCharCode(27) + "[3J" + String.fromCharCode(27) + "[H";
const frames = (io) => io.output.join("").split(CLEAR).slice(1).map((f) => strip(f).split(String.fromCharCode(10)).filter((l) => l !== "")).filter((f) => f.length > 0);

test("imię w ramce: pisanie klawisz po klawiszu, Backspace, limit długości, wpis w panelu wyboru", async () => {
  const ctx = ctxOf(["A", "l", "x", "<backspace>", "<backspace>", "<backspace>", "<backspace>", "A", "l", "a", "<enter>"]);
  await showScreen(ctx, { lines: ["Imię"] });
  const name = await textInput(ctx.io, data.ui, NAME);
  assert.equal(name, "Ala");
  const text = frames(ctx.io).map((f) => f.join("\n")).join("\n");
  assert.match(text, /Imię:/);
  assert.match(text, /Alx▌/);
  for (const f of frames(ctx.io)) assert.equal(f.length, 23, "ramka rows − 1, nic pod ramką");
});

test("imię w ramce: pusty Enter daje domyślne, za długie znaki są ucinane, zły znak odrzuca", async () => {
  const empty = ctxOf([""]);
  await showScreen(empty, { lines: [] });
  assert.equal(await textInput(empty.io, data.ui, NAME), "Bezimienny");
  const long = ctxOf(["Abcdefghijklmn"]);
  await showScreen(long, { lines: [] });
  assert.equal(await textInput(long.io, data.ui, NAME), "Abcdefghij");
  const bad = ctxOf(["1", "<enter>", "<backspace>", "Ola"]);
  await showScreen(bad, { lines: [] });
  assert.equal(await textInput(bad.io, data.ui, NAME), "Ola", "cyfra odrzucona przez wzorzec, po Backspace można wpisać poprawnie");
});

test("t/n w ramce: pytanie w panelu sceny, [T] Tak / [N] Nie w panelu wyboru, nic pod ramką", async () => {
  for (const [key, expected] of [["t", true], ["n", false], ["", false]]) {
    const ctx = ctxOf([key]);
    await showScreen(ctx, { lines: ["Scena"] });
    assert.equal(await confirm(ctx.io, data.ui, "Naprawdę?"), expected, key);
    const f = frames(ctx.io).at(-1);
    assert.equal(f.length, 23);
    assert.ok(f.join("\n").includes("Naprawdę?"));
    assert.ok(f.join("\n").includes("[T] Tak"));
  }
});
