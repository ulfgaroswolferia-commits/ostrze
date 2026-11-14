import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../src/engine/schema.js";

const S = { type: "object", required: ["id", "time"], additional: false,
  fields: { id: { type: "string", pattern: /^[a-z0-9_]+$/ }, time: { type: "integer", min: 0 },
            tags: { type: "array", items: { type: "string" } }, set: { type: "object", values: { type: "boolean" } },
            kind: { type: "string", enum: ["a", "b"] }, text: { type: "string", nonEmpty: true } } };
test("poprawny obiekt – brak błędów", () =>
  assert.deepEqual(check({ id: "x_1", time: 0, tags: ["a"], set: { f: true }, kind: "a", text: "t" }, S), []));
test("brak wymaganego pola", () => assert.deepEqual(check({ id: "x" }, S), ["time: brak wymaganego pola"]));
test("zły typ i ujemna liczba", () => {
  assert.deepEqual(check({ id: "x", time: "5" }, S), ["time: oczekiwano liczby całkowitej"]);
  assert.deepEqual(check({ id: "x", time: -1 }, S), ["time: wartość mniejsza niż 0"]);
  assert.deepEqual(check({ id: "x", time: 1.5 }, S), ["time: oczekiwano liczby całkowitej"]);
});
test("nieznane pole przy additional:false", () =>
  assert.deepEqual(check({ id: "x", time: 0, tiem: 3 }, S), ["tiem: nieznane pole"]));
test("pattern, enum, nonEmpty", () => assert.deepEqual(
  check({ id: "Zły", time: 0, kind: "c", text: "" }, S),
  ['id: niepoprawny format "Zły"', 'kind: dozwolone wartości: a, b', "text: pusty tekst"]));
test("ścieżki w tablicach i słownikach", () => assert.deepEqual(
  check({ id: "x", time: 0, tags: ["a", 3], set: { f: "tak" } }, S),
  ["tags[1]: oczekiwano tekstu", "set.f: oczekiwano wartości logicznej"]));
test("ścieżka bazowa jest doklejana", () =>
  assert.deepEqual(check(5, { type: "string" }, "root"), ["root: oczekiwano tekstu"]));
test("null i tablica to nie obiekt", () => {
  assert.deepEqual(check(null, { type: "object" }), ["oczekiwano obiektu"]);
  assert.deepEqual(check([], { type: "object" }), ["oczekiwano obiektu"]);
});
test("fields i values razem: values dotyczy kluczy spoza fields", () => {
  const schema = { type: "object", fields: { a: { type: "string" } }, values: { type: "number" } };
  assert.deepEqual(check({ a: "x", b: 1 }, schema), []);
  assert.deepEqual(check({ a: "x", b: "y" }, schema), ["b: oczekiwano liczby"]);
  assert.deepEqual(check({ a: 1 }, schema), ["a: oczekiwano tekstu"]);
});
test("max – liczba powyżej górnej granicy", () => {
  const M = { type: "integer", min: 0, max: 100 };
  assert.deepEqual(check(100, M), []);
  assert.deepEqual(check(101, M), ["wartość większa niż 100"]);
});
