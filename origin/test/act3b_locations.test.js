import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { evaluate } from "../src/engine/conditions.js";
import { walkMinutes } from "../src/systems/travel.js";
import { isKnown } from "../src/systems/places.js";

const data = await loadData();
const AROUND = ["pole_szkla", "krater_gwiazdy", "menhiry", "wrak_maszyny", "zapadlisko_ciszy", "ostatnia_strazica"];
const loc = (id) => data.travel.locations.find((l) => l.id === id);

test("Szklane Wzgórza: sześć ukrytych lokacji z mapą, 2–4 miejscami i pogadanką o 4 stanach", () => {
  const s = createNewState({ seed: 1, startScene: "akt3b_mapa", rules: data.rules });
  for (const id of AROUND) {
    const l = loc(id);
    assert.equal(l.region, "gwiazdy");
    assert.ok(l.spots.length >= 2 && l.spots.length <= 6, id);
    assert.ok(l.hint && l.secret, id);
    assert.equal(isKnown(s, data, id), false, id);
    assert.ok(data.maps.gwiazdy.includes(`{${id}}`), id);
    assert.ok(l.spots.some((sp) => (sp.scenes ?? []).length >= 4), `${id}: brak pogadanki`);
  }
});

test("czasy marszu zgodne z mapą Szklanych Wzgórz", () => {
  assert.equal(walkMinutes(data, "pole_szkla", "krater_gwiazdy"), 180);
  assert.equal(data.travel.routes.find((r) => r.id === "obserwatorium_ostatnia_strazica").days, 2, "Ostatnia Strażnica to dwa dni drogi");
  assert.equal(walkMinutes(data, "menhiry", "wrak_maszyny"), 90);
  assert.equal(walkMinutes(data, "menhiry", "zapadlisko_ciszy"), 150);
  assert.equal(walkMinutes(data, "obserwatorium", "zapadlisko_ciszy"), 120 + 150);
});

test("zjawiska miejsc zagrywają się raz, potem zostaje opis; Wrak męczy raz", () => {
  for (const [id, spot, ph] of [["krater_gwiazdy", "krater", "burza_iskier"], ["zapadlisko_ciszy", "zapadlisko", "mgla_ciszy"]]) {
    const scenes = loc(id).spots.find((x) => x.id === spot).scenes;
    const state = { flags: {}, world: {} };
    const first = scenes.filter((sc) => !sc.if || evaluate(sc.if, state, data));
    assert.ok(first.some((sc) => sc.type === "phenomenon" && sc.phenomenon === ph), id);
    state.flags[`${spot}_zjawisko`] = true;
    const later = scenes.filter((sc) => !sc.if || evaluate(sc.if, state, data));
    assert.deepEqual(later.map((sc) => sc.type), ["narration"], `${id}: po pierwszym razie tylko opis, zawsze jest wyjście`);
  }
  const wrak = loc("wrak_maszyny").spots.find((x) => x.id === "wrak").scenes;
  assert.ok(wrak.some((sc) => sc.type === "effect" && sc.add.includes("zmeczenie")));
});
