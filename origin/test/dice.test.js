import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/engine/dice.js";

test("to samo ziarno daje ten sam ciąg", () => {
  const a = createRng(42), b = createRng(42);
  const xs = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(xs, Array.from({ length: 20 }, () => b.next()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});
test("różne ziarna dają różne ciągi", () => {
  assert.notEqual(createRng(1).next(), createRng(2).next());
});
test("getState/setState kontynuuje ciąg identycznie", () => {
  const a = createRng(7); a.next(); a.next();
  const b = createRng(999); b.setState(a.getState());
  assert.deepEqual([a.next(), a.int(1, 6)], [b.next(), b.int(1, 6)]);
});
test("int mieści się w zakresie włącznie i trafia w oba końce", () => {
  const r = createRng(3); const seen = new Set();
  for (let i = 0; i < 2000; i++) { const v = r.int(2, 4); assert.ok(v >= 2 && v <= 4); seen.add(v); }
  assert.deepEqual([...seen].sort(), [2, 3, 4]);
});
test("percent: 0 nigdy, 100 zawsze, roll 1–100", () => {
  const r = createRng(5);
  for (let i = 0; i < 500; i++) {
    const z = r.percent(0), s = r.percent(100);
    assert.equal(z.success, false); assert.equal(s.success, true);
    assert.ok(z.roll >= 1 && z.roll <= 100);
  }
});
