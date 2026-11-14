import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { validateData } from "../src/engine/data.js";
import { visibleSpots, isHuntReady, recordHunt, spotScenes } from "../src/systems/spots.js";

const DAY = 24 * 60;
const HUNT = {
  id: "legowisko", name: "Legowisko", type: "hunt", clearedBy: "hunt_walka", cooldownDays: 3,
  scenes: [
    { id: "hunt_wstep", type: "narration", text: "Śmierdzi sierścią." },
    { id: "hunt_walka", type: "combat", enemies: [{ id: "wilk", count: 1 }], start: "far", canFlee: true, onFlee: "hunt_uciekasz" },
    { id: "hunt_po", type: "narration", text: "Cisza.", goto: "koniec" },
    { id: "hunt_uciekasz", type: "narration", text: "Zwiałeś.", goto: "koniec" },
  ],
};

function world(edit = () => {}) {
  const data = structuredClone(minimalData());
  data.travel.locations.find((l) => l.id === "wilczy_brod").spots.push(structuredClone(HUNT));
  edit(data);
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 5 * DAY + 9 * 60;
  state.world.location = "wilczy_brod";
  return { data, state };
}
const spotOf = (data) => data.travel.locations.find((l) => l.id === "wilczy_brod").spots.find((s) => s.id === "legowisko");
const availability = (state, data) => visibleSpots(state, data, "wilczy_brod").find((v) => v.spot.id === "legowisko").available;

test("hunt: dane przechodzą walidację, sceny spotu to jego sceny", () => {
  const { data } = world();
  assert.deepEqual(validateData(data), []);
  assert.equal(spotScenes(data, "wilczy_brod", "legowisko").length, 4);
});

test("hunt: walidacja – clearedBy musi wskazywać walkę w scenach, brak ref, cooldownDays ≥ 1", () => {
  assert.ok(validateData(world((d) => { spotOf(d).clearedBy = "hunt_wstep"; }).data).some((m) => /clearedBy/.test(m)));
  assert.ok(validateData(world((d) => { delete spotOf(d).clearedBy; }).data).some((m) => /clearedBy/.test(m)));
  assert.ok(validateData(world((d) => { spotOf(d).cooldownDays = 0; }).data).some((m) => /cooldownDays/.test(m)));
  assert.ok(validateData(world((d) => { spotOf(d).ref = "x"; }).data).some((m) => /ref/.test(m)));
  assert.ok(validateData(world((d) => { delete spotOf(d).scenes; }).data).some((m) => /scenes/.test(m)));
});

test("hunt: pole walki jest dostępne na początku; wygrana zapisuje dzień, kasuje flagę i blokuje na cooldown", () => {
  const { data, state } = world();
  assert.equal(availability(state, data), true);
  state.flags.combat_hunt_walka_wygrana = true;
  assert.equal(recordHunt(state, data, "wilczy_brod", spotOf(data)), true);
  assert.equal(state.flags.combat_hunt_walka_wygrana, undefined);
  assert.equal(state.world.hunts["wilczy_brod.legowisko"], 6);
  assert.equal(availability(state, data), false);
  state.time.minutes += 2 * DAY; // dzień 7: jeszcze nie
  assert.equal(isHuntReady(state, data, "wilczy_brod", spotOf(data)), false);
  state.time.minutes += 1 * DAY; // dzień 8: wolno
  assert.equal(isHuntReady(state, data, "wilczy_brod", spotOf(data)), true);
  assert.equal(availability(state, data), true);
});

test("hunt: ucieczka albo porażka nie włącza cooldownu", () => {
  const { data, state } = world();
  state.flags.combat_hunt_walka_ucieczka = true;
  assert.equal(recordHunt(state, data, "wilczy_brod", spotOf(data)), false);
  assert.equal(state.world.hunts["wilczy_brod.legowisko"], undefined);
  assert.equal(availability(state, data), true);
});

test("hunt: domyślny cooldown z rules.travel.huntCooldownDays", () => {
  const { data, state } = world((d) => { delete spotOf(d).cooldownDays; d.rules.travel.huntCooldownDays = 5; });
  state.flags.combat_hunt_walka_wygrana = true;
  recordHunt(state, data, "wilczy_brod", spotOf(data));
  state.time.minutes += 4 * DAY;
  assert.equal(isHuntReady(state, data, "wilczy_brod", spotOf(data)), false);
  state.time.minutes += DAY;
  assert.equal(isHuntReady(state, data, "wilczy_brod", spotOf(data)), true);
});

// --- through the map scene: a real visit, a won fight, the ground rests ---
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { createAdaptiveIO } from "./helpers.js";

const MAP = { id: "mapa", type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Dalej", goto: "koniec_gry" } };

test("hunt przez scenę map: wygrana walka zamyka pole na cooldown, ucieczka nie", async () => {
  for (const [fight, closed] of [["win", true], ["flee", false]]) {
    const { data, state } = world((d) => {
      d.travel.locations.find((l) => l.id === "wilczy_brod").spots = [structuredClone(HUNT)];
      d.enemies = d.enemies.map((e) => (e.id === "wilk" ? { ...e, hp: 1 } : e));
      d.story = { start: "mapa", scenes: [MAP, { id: "koniec_gry", type: "ending", text: "Koniec." }] };
    });
    state.world.phenomenonRolledDay = 99;
    const ctx = { state, data, io: createAdaptiveIO(["1", "", { fight }, ""]), rng: createRng(3), debug: false, notices: [] };
    await assert.rejects(defaultHandlers.map(ctx, MAP), InputExhaustedError);
    assert.equal(state.world.hunts["wilczy_brod.legowisko"] !== undefined, closed, fight);
    assert.equal(availability(state, data), !closed, fight);
  }
});
