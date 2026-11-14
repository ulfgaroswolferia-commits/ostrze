import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { renderJournal } from "../src/ui/journal_screen.js";
import { searchLine } from "../src/ui/map_screen.js";

const data = await loadData();
const strip = (lines) => stripVTControlCharacters(lines.join(" "));
const state = (location = "gluszec") => { const s = createNewState({ seed: 1, startScene: "demo_mapa", rules: data.rules }); s.world.location = location; return s; };

test("searchLine: brak przy 0, słowny poziom od progu czujności, bez liczby", () => {
  const s = state();
  assert.equal(searchLine(s, data), null);
  s.world.search = 10;
  assert.equal(searchLine(s, data), null, "poniżej progu czujności nic nie pokazujemy");
  s.world.search = 30;
  assert.match(stripVTControlCharacters(searchLine(s, data)), /^Poszukiwania: czujność$/);
  s.world.search = 80;
  assert.match(stripVTControlCharacters(searchLine(s, data)), /obława/);
  assert.doesNotMatch(stripVTControlCharacters(searchLine(s, data)), /\d/);
});

test("dziennik pokazuje poziom poszukiwań od progu czujności; brak „[[…]]”", () => {
  const s = state();
  s.world.search = 55;
  const text = strip(renderJournal(s, data));
  assert.match(text, /Poszukiwania: pościg/);
  assert.doesNotMatch(text, /\[\[/);
  s.world.search = 0;
  assert.doesNotMatch(strip(renderJournal(s, data)), /Poszukiwania/);
});

test("poziom poszukiwań jest widoczny tylko tam, gdzie od niego coś zależy (Głuszec i okolice), nie w Brodzie ani w Obserwatorium", () => {
  for (const place of ["wilczy_brod", "obserwatorium", "krater_gwiazdy"]) {
    const s = state(place);
    s.world.search = 90;
    assert.equal(searchLine(s, data), null, place);
  }
  for (const place of ["gluszec", "bor_klusownikow", "wzgorze_wartownicze"]) {
    const s = state(place);
    s.world.search = 90;
    assert.match(stripVTControlCharacters(searchLine(s, data)), /obława/, place);
  }
});
