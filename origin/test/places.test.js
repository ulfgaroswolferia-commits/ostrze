import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { placeIds, placeById, isKnown, revealPlace, hintPlace, repairPlaces } from "../src/systems/places.js";
import { evaluate, validateCondition, conditionOpts } from "../src/engine/conditions.js";
import { validateActions, runActions } from "../src/systems/actions.js";

/** Real data plus a secret forest with a hidden spot and an open spot in the hub. */
function world() {
  const data = structuredClone(minimalData());
  data.travel.locations.push({ id: "las", name: "Las Rubieży", short: "Las", region: "pogorze", secret: true, hint: "nieznana ścieżka",
    spots: [{ id: "polana", name: "Polana", type: "rest" }, { id: "ziemianka", name: "Ziemianka", type: "rest", secret: true }] });
  data.travel.locations.find((l) => l.id === "wilczy_brod").spots = [{ id: "karczma", name: "Karczma", type: "rest" }];
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  return { data, state };
}

test("placeIds i placeById: lokacje i miejsca", () => {
  const { data } = world();
  assert.ok(placeIds(data).includes("las") && placeIds(data).includes("las.polana") && placeIds(data).includes("wilczy_brod.karczma"));
  assert.equal(placeById(data, "las.polana").spot.name, "Polana");
  assert.equal(placeById(data, "las").spot, null);
  assert.equal(placeById(data, "nic"), undefined);
});

test("isKnown: lokacja bez secret znana od razu, secret po reveal; miejsce zależy od lokacji i własnego secret", () => {
  const { data, state } = world();
  assert.equal(isKnown(state, data, "wilczy_brod"), true);
  assert.equal(isKnown(state, data, "wilczy_brod.karczma"), true);
  assert.equal(isKnown(state, data, "las"), false);
  assert.equal(isKnown(state, data, "las.polana"), false);
  revealPlace(state, data, "las");
  assert.equal(isKnown(state, data, "las"), true);
  assert.equal(isKnown(state, data, "las.polana"), true);
  assert.equal(isKnown(state, data, "las.ziemianka"), false);
  revealPlace(state, data, "las.ziemianka");
  assert.equal(isKnown(state, data, "las.ziemianka"), true);
});

test("revealPlace i hintPlace: komunikat tylko raz; zapowiedź znanego pomijana", () => {
  const { data, state } = world();
  assert.deepEqual(hintPlace(state, data, "las"), [{ type: "zapowiedz_miejsca", id: "las" }]);
  assert.deepEqual(hintPlace(state, data, "las"), []);
  assert.deepEqual(revealPlace(state, data, "las"), [{ type: "odkryto", id: "las" }]);
  assert.deepEqual(revealPlace(state, data, "las"), []);
  assert.deepEqual(hintPlace(state, data, "wilczy_brod"), []);
});

test("warunek known: false → true po reveal; nieznane id odrzuca walidator", () => {
  const { data, state } = world();
  assert.equal(evaluate({ known: "las" }, state, data), false);
  revealPlace(state, data, "las");
  assert.equal(evaluate({ known: "las" }, state, data), true);
  assert.deepEqual(validateCondition({ known: "las" }, "c", conditionOpts(data)), []);
  assert.match(validateCondition({ known: "nieistnieje" }, "c", conditionOpts(data))[0], /nieznane miejsce/);
});

test("akcje reveal / hint / startQuest: wykonanie i walidacja", () => {
  const { data, state } = world();
  const rng = { int: () => 1 };
  const out = runActions(state, data, [{ hint: "las" }, { reveal: "las" }, { startQuest: "wilcza_nora" }], rng).events;
  assert.deepEqual(out.map((e) => e.type), ["zapowiedz_miejsca", "odkryto", "zadanie_start"]);
  assert.deepEqual(validateActions([{ reveal: "las" }, { hint: "las.polana" }, { startQuest: "wilcza_nora" }], "a", data), []);
  assert.match(validateActions([{ reveal: "nic" }], "a", data)[0], /nieznane miejsce/);
  assert.match(validateActions([{ startQuest: "nic" }], "a", data)[0], /nieznane zadanie/);
});

test("repairPlaces: nieznane id znika z discovered i hinted", () => {
  const { data, state } = world();
  state.world.discovered = ["las", "duch"];
  state.world.hinted = ["duch2"];
  assert.deepEqual(repairPlaces(state, data).sort(), ["duch", "duch2"]);
  assert.deepEqual(state.world.discovered, ["las"]);
  assert.deepEqual(state.world.hinted, []);
});

test("nowy stan: discovered i hinted puste", () => {
  const { state } = world();
  assert.deepEqual(state.world.discovered, []);
  assert.deepEqual(state.world.hinted, []);
});
