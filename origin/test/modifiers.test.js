import { test } from "node:test";
import assert from "node:assert/strict";
import { isModifierKey, validateModifiers, emptyTotals, addModifiers } from "../src/systems/modifiers.js";
import { minimalData } from "./helpers.js";

const data = minimalData();

test("isModifierKey", () => {
  for (const k of ["sila", "sieczna", "ap", "resist_strach", "effectDuration_strach", "extraDamage", "damageTaken"])
    assert.equal(isModifierKey(k, data), true, k);
  for (const k of ["bystrsoc", "resist_", "Ap"]) assert.equal(isModifierKey(k, data), false, k);
});
test("validateModifiers", () => {
  assert.deepEqual(validateModifiers({ ap: 1, extraDamage: { type: "ogien", amount: [2, 4] }, damageTaken: { sieczne: 0.5 } }, "m", data), []);
  assert.deepEqual(validateModifiers({ bystrsoc: 1 }, "m", data), ["m.bystrsoc: nieznany modyfikator"]);
  assert.deepEqual(validateModifiers({ ap: "1" }, "m", data), ["m.ap: oczekiwano liczby"]);
  assert.ok(validateModifiers({ extraDamage: { type: "lod", amount: [4, 2] } }, "m", data).length >= 2);
});
test("validateModifiers: dokładne komunikaty extraDamage i damageTaken", () => {
  assert.deepEqual(validateModifiers({ extraDamage: { type: "lod", amount: [4, 2] } }, "m", data),
    ['m.extraDamage.type: nieznany typ obrażeń "lod"', "m.extraDamage.amount: oczekiwano [min, max] liczb całkowitych"]);
  assert.deepEqual(validateModifiers({ damageTaken: { x: 1, sieczne: -1, klute: "a" } }, "m", data),
    ['m.damageTaken.x: nieznany typ obrażeń "x"', "m.damageTaken.sieczne: wartość mniejsza niż 0", "m.damageTaken.klute: oczekiwano liczby"]);
  assert.deepEqual(validateModifiers({ ap: Infinity }, "m", data), ["m.ap: oczekiwano liczby"]);
});
test("addModifiers sumuje liczby, mnoży damageTaken, zbiera extraDamage", () => {
  let t = addModifiers(emptyTotals(), { ap: 1, damageTaken: { sieczne: 0.5 }, extraDamage: { type: "ogien", amount: [1, 2] } });
  t = addModifiers(t, { ap: 2, damageTaken: { sieczne: 0.5 } });
  assert.equal(t.numbers.ap, 3); assert.equal(t.damageTaken.sieczne, 0.25); assert.equal(t.extraDamage.length, 1);
});
