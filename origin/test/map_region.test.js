import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { destinationEntries, undiscoveredLines } from "../src/ui/map_screen.js";

// Real data: a hub lists only the places of its own region (the Głuszec panel once offered the Pogórze woods).
const data = minimalData();
const idsOf = (region) => data.travel.locations.filter((l) => l.region === region).map((l) => l.id);

function stateAt(location) {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.world.location = location;
  state.world.discovered = data.travel.locations.map((l) => l.id);
  return state;
}

for (const [hub, region] of [["wilczy_brod", "pogorze"], ["gluszec", "glusz"], ["obserwatorium", "gwiazdy"]]) {
  test(`mapa: panel celów huba ${hub} zawiera tylko lokacje regionu ${region}`, () => {
    const entries = destinationEntries(stateAt(hub), data, hub);
    assert.ok(entries.length > 0);
    for (const e of entries.filter((x) => x.kind === "near")) {
      assert.equal(e.location.region, region, `${e.id} nie należy do ${region}`);
    }
  });
}

test("mapa: Głuszec nie oferuje lokacji Pogórza", () => {
  const ids = destinationEntries(stateAt("gluszec"), data, "gluszec").map((e) => e.id);
  for (const id of idsOf("pogorze")) assert.ok(!ids.includes(id), `${id} z Pogórza w panelu Głuszca`);
});

test("mapa: „Nieodkryte” nie pokazuje podpowiedzi z innego regionu", () => {
  const state = stateAt("gluszec");
  state.world.discovered = [];
  const pogorzeSecret = data.travel.locations.find((l) => l.region === "pogorze" && l.secret);
  state.world.hinted = [pogorzeSecret.id];
  assert.deepEqual(undiscoveredLines(state, data, "gluszec"), []);
});

test("mapa: każdy wpis panelu ma marker {id} na mapie regionu", () => {
  for (const [hub, region] of [["wilczy_brod", "pogorze"], ["gluszec", "glusz"], ["obserwatorium", "gwiazdy"]]) {
    const tokens = new Set([...data.maps[region].matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]));
    for (const e of destinationEntries(stateAt(hub), data, hub).filter((x) => x.kind === "near")) {
      assert.ok(tokens.has(e.id), `${e.id} bez markera w maps/${region}.txt`);
    }
  }
});
