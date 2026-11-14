import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { evaluate } from "../src/engine/conditions.js";

const data = await loadData();
const spot = data.travel.locations.find((l) => l.id === "wilczy_brod").spots.find((s) => s.id === "zona_borka");

/** One visit as the runner plays it: scenes in order whose `if` holds; a flag scene with goto "koniec" ends the visit. */
function visit(state) {
  const out = [];
  for (const scene of spot.scenes) {
    if (scene.if && !evaluate(scene.if, state, data)) continue;
    if (scene.type === "dialogue") { out.push(`dialog:${scene.dialogue}`); break; }
    if (scene.type === "narration") out.push(scene.text);
    if (scene.type === "flag") { Object.assign(state.flags, scene.set); break; }
  }
  return out.join(" ");
}

test("żona Borka: przed zleceniem prosi o pomoc (dialog), po zakończeniu już nie szuka męża", () => {
  const before = { flags: {}, world: {} };
  assert.equal(visit(before), "dialog:zona_borka");
  const after = { flags: { zona_poinformowana: true, borek_znaleziony: true }, world: {} };
  const seen = [1, 2, 3, 4, 5].map(() => visit(after));
  for (const text of seen) {
    assert.ok(text.length > 40);
    assert.doesNotMatch(text, /dialog:|Pomożesz|poszedł z owcami|trzy dni temu/);
  }
  assert.equal(new Set(seen.slice(0, 4)).size, 4, "cztery różne reakcje");
  assert.equal(seen[4], seen[3]);
});

test("żona Borka: pierwsza rozmowa po powrocie zależy od stanu Borka (kulawy / cały)", () => {
  const lame = visit({ flags: { zona_poinformowana: true, borek_kulawy: true }, world: {} });
  const whole = visit({ flags: { zona_poinformowana: true }, world: {} });
  assert.match(lame, /Kulawy/);
  assert.match(whole, /cały/);
});
