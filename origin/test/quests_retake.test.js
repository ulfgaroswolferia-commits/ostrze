import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { minimalData, combatState } from "./helpers.js";
import { startQuest, failQuest, boardQuests, canStartQuest } from "../src/systems/quests.js";

test("przepadłe zlecenie wraca na tablicę i można je wziąć od nowa; wykonane i aktywne – nie", async () => {
  const data = await loadData();
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(minimalData(), "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.world.discovered.push("stary_mlyn");
  const onBoard = () => boardQuests(s, data, "wilczy_brod").map((q) => q.id);
  assert.ok(onBoard().includes("zboze_dla_mlyna"));
  startQuest(s, data, "zboze_dla_mlyna");
  assert.ok(!onBoard().includes("zboze_dla_mlyna"), "aktywne – nie na tablicy");
  failQuest(s, data, "zboze_dla_mlyna");
  assert.ok(onBoard().includes("zboze_dla_mlyna"), "przepadłe – znowu do wzięcia");
  startQuest(s, data, "zboze_dla_mlyna");
  assert.equal(s.quests.zboze_dla_mlyna.status, "active");
  assert.deepEqual(s.quests.zboze_dla_mlyna.done, []);
  s.quests.zboze_dla_mlyna.status = "done";
  assert.equal(canStartQuest(s, data, "zboze_dla_mlyna"), false, "wykonane – nie wraca");
  assert.equal(startQuest(s, data, "zboze_dla_mlyna").length, 0);
});
