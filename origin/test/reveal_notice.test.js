import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { pushEventNotices } from "../src/ui/events.js";

test("odkrycie miejsca w innym regionie: powiadomienie mówi gdzie, zamiast obiecywać mapę tu i teraz", async () => {
  const data = await loadData();
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  state.world.location = "wilczy_brod";
  const ctx = { state, data, notices: [] };
  pushEventNotices(ctx, [{ type: "odkryto", id: "gluszec.wdowa" }, { type: "odkryto", id: "wilczy_brod.karczma" }]);
  const lines = ctx.notices.map(strip);
  assert.match(lines[0], /Wdowa Jaga/);
  assert.match(lines[0], /Głuszec/);
  assert.doesNotMatch(lines[0], /Nowe miejsce na mapie/);
  assert.match(lines[1], /Nowe miejsce na mapie/, "w bieżącym regionie – jak dotąd");
});
