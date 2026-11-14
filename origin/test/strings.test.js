import { test } from "node:test";
import assert from "node:assert/strict";
import { t } from "../src/ui/strings.js";
import { daysText, deadlineText } from "../src/ui/map_screen.js";
import { loadData } from "../src/engine/data.js";

for (const [n, pl, en] of [[0, "bełtów", "bolts"], [1, "bełt", "bolt"], [2, "bełty", "bolts"], [5, "bełtów", "bolts"], [12, "bełtów", "bolts"], [21, "bełtów", "bolts"], [22, "bełty", "bolts"]])
  test(`liczba mnoga ${n}`, () => {
    assert.equal(t({ k: "{n|bełt|bełty|bełtów}" }, "k", { n }), pl);
    assert.equal(t({ k: "{n|bolt|bolts}" }, "k", { n }), en);
  });

test("liczba mnoga: brak zmiennej, nie liczba i zła liczba form zostają bez zmian", () => {
  assert.equal(t({ k: "{n|a|b}" }, "k", {}), "{n|a|b}");
  assert.equal(t({ k: "{n|a|b}" }, "k", { n: "x" }), "{n|a|b}");
  assert.equal(t({ k: "{n|a}" }, "k", { n: 1 }), "{n|a}");
  assert.equal(t({ k: "{n|a|b|c|d}" }, "k", { n: 1 }), "{n|a|b|c|d}");
  assert.equal(t({ k: "{n} {n|dzień|dni|dni}" }, "k", { n: 3 }), "3 dni");
});

test("dni na mapie jak dotąd", async () => {
  const { ui } = await loadData();
  assert.equal(daysText(ui, 1), "1 dzień");
  assert.equal(daysText(ui, 2), "2 dni");
  assert.equal(daysText(ui, 5), "5 dni");
  assert.equal(deadlineText(ui, 1), "został 1 dzień");
  assert.equal(deadlineText(ui, 3), "zostały 3 dni");
  assert.equal(deadlineText(ui, 5), "zostało 5 dni");
  assert.equal(deadlineText(ui, 12), "zostało 12 dni");
  assert.equal(deadlineText(ui, 22), "zostały 22 dni");
});
