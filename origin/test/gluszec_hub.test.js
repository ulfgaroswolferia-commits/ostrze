import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { evaluate } from "../src/engine/conditions.js";
import { spotScenes, visibleSpots } from "../src/systems/spots.js";
import { createNewState } from "../src/engine/state.js";

const data = await loadData();
const hub = data.travel.locations.find((l) => l.id === "gluszec");
const state = () => createNewState({ seed: 1, startScene: "akt3_mapa", rules: data.rules });

/** One visit to a scene spot: the scenes run in list order, each whose `if` holds; flags are set as the runner would. */
function visit(spot, s) {
  const texts = [];
  for (const scene of spot.scenes) {
    if (scene.if && !evaluate(scene.if, s, data)) continue;
    if (scene.type === "narration") texts.push(scene.text);
    if (scene.type === "flag") { Object.assign(s.flags, scene.set); if (scene.goto === "koniec") break; }
  }
  return texts;
}

test("Głuszec: hub ma ≥10 miejsc, każde ma sceny do odegrania, kryjówka jest ukryta do odkrycia", () => {
  assert.ok(hub.spots.length >= 10);
  for (const spot of hub.spots.filter((x) => x.type !== "board")) assert.ok(spotScenes(data, "gluszec", spot.id), `${spot.id}: brak scen`);
  const s = state();
  s.world.location = "gluszec";
  const shown = visibleSpots(s, data, "gluszec").map((x) => x.spot.id);
  assert.ok(!shown.includes("piwnica"));
  assert.ok(shown.includes("karczma_kogut") && shown.includes("soltys"));
});

test("Głuszec: pogadanki mają 4 różne reakcje przy kolejnych odwiedzinach i nie milkną potem", () => {
  for (const id of ["stara_baba", "chlopiec", "pijak"]) {
    const spot = hub.spots.find((x) => x.id === id);
    const s = state();
    const seen = [1, 2, 3, 4, 5].map(() => visit(spot, s).join(" "));
    assert.equal(new Set(seen.slice(0, 4)).size, 4, `${id}: cztery różne stany`);
    assert.ok(seen.every((t) => t.length > 40), `${id}: każda wizyta coś mówi`);
    assert.equal(seen[4], seen[3], `${id}: po czwartej reakcji powtarza ostatnią`);
  }
  assert.match(visit(hub.spots.find((x) => x.id === "stara_baba"), state()).join(""), /Mora tu po nocach/);
});

test("Głuszec: dialogi hubowe są dostępne i żaden węzeł nie jest ślepy (≥1 opcja)", () => {
  for (const id of ["karczmarz_kogut", "soltys", "znachorka", "kowal_gluszec"]) {
    const d = data.dialogues.find((x) => x.id === id);
    assert.ok(d, id);
    for (const [nid, node] of Object.entries(d.nodes)) assert.ok((node.options ?? []).length >= 1, `${id}/${nid}`);
  }
});
