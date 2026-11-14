import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { combatState } from "./helpers.js";
import { startQuest, advanceErrands, finishQuest } from "../src/systems/quests.js";

const data = await loadData();
const rng = { int: () => 1 };

function setup(onComplete) {
  const d = structuredClone(data);
  d.quests.push({
    id: "mikro", kind: "errand", name: "Drobiazg", hub: "wilczy_brod", description: "Mały drobiazg.", deadlineDays: null,
    objectives: [{ id: "a", text: "Zrób drobiazg.", at: "wilczy_brod.karczma", done: { flag: "drobiazg" } }],
    ...(onComplete ? { onComplete } : {}),
  });
  const state = createNewState({ seed: 1, startScene: "demo_mapa", rules: d.rules });
  const cs = combatState(d, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  startQuest(state, d, "mikro");
  state.flags.drobiazg = true;
  return { d, state };
}

test("mikrozadanie bez innej nagrody daje 5 PD (rules.quests.microXp)", () => {
  assert.equal(data.rules.quests.microXp, 5);
  for (const onComplete of [undefined, [{ setFlag: "x" }], [{ reveal: "wilczy_las" }]]) {
    const { d, state } = setup(onComplete);
    const xp = state.character.xp;
    advanceErrands(state, d, rng);
    assert.equal(state.quests.mikro.status, "done");
    assert.equal(state.character.xp, xp + 5, JSON.stringify(onComplete));
  }
});

test("zadanie z pieniędzmi, przedmiotem albo PD nie dostaje dodatkowych 5 PD; eskorta też nie", () => {
  for (const [onComplete, xpGain] of [[[{ giveMoney: 10 }], 0], [[{ giveItem: "opatrunek" }], 0], [[{ xp: 30 }], 30]]) {
    const { d, state } = setup(onComplete);
    const xp = state.character.xp;
    advanceErrands(state, d, rng);
    assert.equal(state.character.xp, xp + xpGain, JSON.stringify(onComplete));
  }
  const { d, state } = setup(undefined);
  d.quests.find((q) => q.id === "eskorta_ostromira").kind === "escort" && startQuest(state, d, "eskorta_ostromira");
  const xp = state.character.xp;
  finishQuest(state, d, "eskorta_ostromira", rng);
  assert.equal(state.character.xp, xp, "eskorta płaci w swoich scenach");
});
