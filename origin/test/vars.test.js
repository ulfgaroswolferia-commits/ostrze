import { test } from "node:test";
import assert from "node:assert/strict";
import { addVar } from "../src/systems/vars.js";

test("addVar", () => {
  const s = {}; addVar(s, { wola: 1 }); addVar(s, { wola: 2, dlug: -1 });
  assert.deepEqual(s.vars, { wola: 3, dlug: -1 });
});
