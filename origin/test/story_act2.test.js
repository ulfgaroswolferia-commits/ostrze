import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { enterNode, chooseOption, nodeView } from "../src/systems/dialogue.js";
import { countOf } from "../src/systems/inventory.js";
import { isKnown } from "../src/systems/places.js";
import { combatState } from "./helpers.js";

const data = await loadData();
const fixed = (k) => ({ int: () => k });

function fresh() {
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  return state;
}
/** Enters `node`, then chooses option `key`; returns the result. */
const pick = (state, dialogue, node, key) => {
  enterNode(state, data, dialogue, node, fixed(1));
  return chooseOption(state, data, dialogue, node, key, fixed(1));
};
const keys = (state, dialogue, node) => nodeView(state, data, dialogue, node).options.map((o) => o.key);

test("dane aktu II przechodzą walidację; noc kończy się pobojowiskiem, rozdrożem i bezdrożami", () => {
  assert.deepEqual(validateData(data), []);
  const ids = data.travel.events.find((e) => e.id === "noc_upiorow").scenes.map((s) => s.id);
  assert.deepEqual(ids.slice(-4), ["noc_flaga_insygnia", "noc_pobojowisko", "noc_rozdroze", "noc_bezdroza"]);
});

test("pobojowisko: cztery przeszukania, każde raz; tobołek przewodnika daje mapę i zapowiada Las Rubieży", () => {
  const state = fresh();
  const before = countOf(state, "prowiant");
  for (const [key, node] of [["skarimir", "skarimir"], ["ragnoslawa", "ragnoslawa"], ["wojmir", "wojmir"], ["tobolek", "tobolek"]]) {
    const r = pick(state, "pobojowisko", "rozejrzenie", key);
    assert.equal(r.next, node);
    enterNode(state, data, "pobojowisko", node, fixed(1));
  }
  assert.equal(countOf(state, "sztylet") >= 1, true);
  assert.equal(countOf(state, "amulet_strazniczy"), 1);
  assert.equal(countOf(state, "mapa_przewodnika"), 1);
  assert.equal(countOf(state, "prowiant"), before + 2);
  assert.ok(state.world.hinted.includes("wilczy_las"));
  assert.equal(isKnown(state, data, "wilczy_las"), false);
  const left = nodeView(state, data, "pobojowisko", "rozejrzenie").options;
  assert.deepEqual(left.filter((o) => !o.disabled).map((o) => o.key), ["dalej"]);
});

test("pobojowisko: „Dość. Idę dalej.” jest dostępne bez przeszukiwania", () => {
  const state = fresh();
  assert.ok(keys(state, "pobojowisko", "rozejrzenie").includes("dalej"));
  assert.equal(pick(state, "pobojowisko", "rozejrzenie", "dalej").end, "end");
});

test("rozdroże: odrzucenie +1 wola i flaga, wahanie flaga, pokora +1 dług", () => {
  const a = fresh();
  enterNode(a, data, "rozdroze", pick(a, "rozdroze", "rozstaje", "odrzucam").next, fixed(1));
  assert.equal(a.vars.wola, 1);
  assert.equal(a.flags.odrzucil_stolice, true);
  const b = fresh();
  enterNode(b, data, "rozdroze", pick(b, "rozdroze", "rozstaje", "waham").next, fixed(1));
  assert.equal(b.flags.waha_sie, true);
  assert.equal(b.vars.wola ?? 0, 0);
  const c = fresh();
  enterNode(c, data, "rozdroze", pick(c, "rozdroze", "rozstaje", "pokora").next, fixed(1));
  assert.equal(c.vars.dlug, 1);
});
