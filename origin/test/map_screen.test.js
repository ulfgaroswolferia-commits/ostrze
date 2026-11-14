import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { revealPlace, hintPlace } from "../src/systems/places.js";
import { startQuest } from "../src/systems/quests.js";
import { visibleWidth } from "../src/ui/frame.js";
import { destinationEntries, renderRegionMap, undiscoveredLines, dangerText, minutesText, askDestination } from "../src/ui/map_screen.js";

const strip = (s) => stripVTControlCharacters(s);
const MAP = [
  "   ~~~ rzeka ~~~",
  "  {wilczy_brod}----{wilczy_las}",
  "        |            |",
  "   {wilcza_nora}   {jar}",
  "",
].join("\n");

function world(edit = () => {}) {
  const data = structuredClone(minimalData());
  data.travel.locations = data.travel.locations.filter((l) => l.id !== "wilczy_las");
  data.travel.locations.push({ id: "wilczy_las", name: "Las Rubieży", short: "Las Rubieży", region: "pogorze", near: { minutes: 40 }, danger: 2, secret: true, hint: "nieznana ścieżka" });
  data.travel.locations.push({ id: "jar", name: "Jar", short: "Jar", region: "pogorze", near: { minutes: 90 }, danger: 4, secret: true, hint: "dziwny jar" });
  data.maps = { ...data.maps, pogorze: MAP };
  edit(data);
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 12 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  return { data, state };
}
const ctxOf = (state, data, inputs, { tty = true, cols = 80, rows = 24 } = {}) => {
  const io = createScriptedIO(inputs, { tty });
  io.columns = cols;
  io.rows = rows;
  return { state, data, io, rng: { int: (a) => a }, debug: false, notices: [] };
};
function lastFrame(io) {
  const out = io.output.join("");
  return strip(out.slice(out.lastIndexOf("\x1b[2J") + "\x1b[2J\x1b[3J\x1b[H".length)).split("\n");
}

test("tekst pomocniczy: zagrożenie i czas", () => {
  const { data } = world();
  assert.deepEqual([1, 2, 3, 4].map((n) => dangerText(data.ui, n)), ["Bezpiecznie", "Niskie", "Średnie", "Wysokie"]);
  assert.deepEqual([25, 60, 90, 120].map((n) => minutesText(data.ui, n)), ["~25 min", "~1 h", "~1 h 30 min", "~2 h"]);
});

test("destinationEntries: znane bliskie z czasem i zagrożeniem; ukryte nie; wyprawy tylko w hubie", () => {
  const { data, state } = world();
  assert.deepEqual(destinationEntries(state, data, "wilczy_brod").map((e) => e.id), []);
  revealPlace(state, data, "wilczy_las");
  startQuest(state, data, "wilcza_nora");
  const list = destinationEntries(state, data, "wilczy_brod");
  assert.deepEqual(list.map((e) => e.id), ["wilczy_las", "wilcza_nora"]);
  assert.match(list[0].label, /Las Rubieży · ~40 min · Niskie/);
  assert.match(list[1].label, /Wilcza Nora · zadanie „Wilcza Nora” · 1 dzień/);
  state.world.location = "wilczy_las";
  assert.deepEqual(destinationEntries(state, data, "wilczy_brod").map((e) => e.id), ["wilczy_brod"]);
});

test("renderRegionMap: nazwy tylko znanych, [?] dla zapowiedzianych, @ w bieżącym miejscu, ! przy celu zlecenia", () => {
  const { data, state } = world();
  const text = () => renderRegionMap(state, data, { hub: "wilczy_brod", width: 100, height: 20 }).map(strip).join("\n");
  assert.match(text(), /@ Wilczy Bród/);
  assert.doesNotMatch(text(), /Las Rubieży|\[\?\]/);
  hintPlace(state, data, "wilczy_las");
  assert.match(text(), /\[\?\]/);
  revealPlace(state, data, "wilczy_las");
  assert.match(text(), /\[1\] Las Rubieży/);
  assert.doesNotMatch(text(), /Jar/);
  assert.match(text(), /Jesteś tu/);
  state.world.location = "wilczy_las";
  assert.match(text(), /\[1\] Wilczy Bród/);
  assert.match(text(), /@ Las Rubieży/);
});

test("renderRegionMap: null w zbyt małym panelu; żadna linia szersza niż panel", () => {
  const { data, state } = world();
  assert.equal(renderRegionMap(state, data, { hub: "wilczy_brod", width: 59, height: 20 }), null);
  assert.equal(renderRegionMap(state, data, { hub: "wilczy_brod", width: 100, height: 13 }), null);
  for (const l of renderRegionMap(state, data, { hub: "wilczy_brod", width: 60, height: 14 })) assert.ok(visibleWidth(l) <= 60, l);
});

test("undiscoveredLines: tylko zapowiedziane i nieodkryte", () => {
  const { data, state } = world();
  assert.deepEqual(undiscoveredLines(state, data, "wilczy_brod"), []);
  hintPlace(state, data, "wilczy_las");
  assert.deepEqual(undiscoveredLines(state, data, "wilczy_brod").map(strip), ["??? · nieznana ścieżka"]);
  revealPlace(state, data, "wilczy_las");
  assert.deepEqual(undiscoveredLines(state, data, "wilczy_brod"), []);
});

test("ekran 200×50: mapa, „Dokąd iść?”, „Nieodkryte”; ramka = rows − 1 wierszy", async () => {
  const { data, state } = world();
  revealPlace(state, data, "wilczy_las");
  hintPlace(state, data, "jar");
  const ctx = ctxOf(state, data, ["1"], { cols: 200, rows: 50 });
  const entry = await askDestination(ctx, "wilczy_brod", { continueLabel: "Czekaj" });
  assert.equal(entry.id, "wilczy_las");
  const frame = lastFrame(ctx.io).filter((l, i, a) => i < a.length - 1 || l !== "");
  const text = frame.join("\n");
  assert.equal(frame.length, 49);
  assert.match(text, /Dokąd iść\?/);
  assert.match(text, /\[1\] Las Rubieży/);
  assert.match(text, /Nieodkryte/);
  assert.match(text, /\?\?\? · dziwny jar/);
  assert.match(text, /Jesteś tu/);
});

test("ekran 80×24: bez mapy, opis zaznaczonej lokacji w lewym panelu; „dalej fabułą” zwraca undefined", async () => {
  const { data, state } = world();
  revealPlace(state, data, "wilczy_las");
  const ctx = ctxOf(state, data, ["2"]);
  const entry = await askDestination(ctx, "wilczy_brod", { continueLabel: "Czekaj" });
  assert.equal(entry, undefined);
  const text = lastFrame(ctx.io).join("\n");
  assert.doesNotMatch(text, /Jesteś tu/);
  assert.match(text, /Las Rubieży/);
  assert.match(text, /~40 min/);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});

test("tryb liniowy: numerowana lista wszystkich celów i „Nieodkryte”", async () => {
  const { data, state } = world();
  revealPlace(state, data, "wilczy_las");
  hintPlace(state, data, "jar");
  const ctx = ctxOf(state, data, ["1"], { tty: false });
  await askDestination(ctx, "wilczy_brod", { continueLabel: "Czekaj" });
  const text = ctx.io.text();
  assert.match(text, /\[1\] Las Rubieży · ~40 min · Niskie/);
  assert.match(text, /\[2\] Czekaj/);
  assert.match(text, /\?\?\? · dziwny jar/);
});
