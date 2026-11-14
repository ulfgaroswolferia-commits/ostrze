import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, countOf, carriedWeight } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { nodeView } from "../src/systems/dialogue.js";
import { spotScenes } from "../src/systems/spots.js";
import { createNewState } from "../src/engine/state.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { showInventory } from "../src/ui/inventory_screen.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { setColorsEnabled } from "../src/ui/colors.js";

const low = { int: (lo) => lo }; // every roll its low end: shots hit, bolt 8, fragment 4

/** Real data, but bandits that a fragment kills (4 HP), so one explosive shot ends the fight. */
function weakBandits() {
  const data = minimalData();
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, hp: 4 } : e));
  return data;
}

/** The 1-based number of option `key` in the workshop node as the hero sees it now. */
const optionNumber = (ctx, dialogue, key) => String(nodeView(ctx.state, ctx.data, dialogue, "warsztat").options.findIndex((o) => o.key === key) + 1);

test("prawdziwa gra: wymiana paczki u Brygidy, przełącznik w ekwipunku, strzał w grupę, ładowanie po walce", async () => {
  setColorsEnabled(false);
  const data = weakBandits();
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.attributes.sila = 6; // the light crossbow needs 4
  state.character.hp = 100;
  state.character.money = 120;
  addItem(state, data, "kusza_lekka", 1);
  addItem(state, data, "belt", 10);
  const ctx = { state, data, io: null, rng: low, debug: false, notices: [] };

  // 1. Brygida's workshop: 10 plain → 10 reinforced (20 gr), then 10 reinforced → 10 explosive (100 gr).
  const scene = spotScenes(data, "obserwatorium", "ulepszenia")[0];
  assert.equal(scene.dialogue, "ulepszenia_brygida");
  const first = optionNumber(ctx, "ulepszenia_brygida", "u_belt_wzmocniony");
  ctx.io = createScriptedIO([first, "1"], { tty: false }); // exchange, "Dobra." back to the workshop, then the input ends
  await assert.rejects(defaultHandlers[scene.type](ctx, scene), InputExhaustedError);
  const second = optionNumber(ctx, "ulepszenia_brygida", "u_belt_wybuchowy");
  ctx.io = createScriptedIO([second, "1"], { tty: false });
  await assert.rejects(defaultHandlers[scene.type](ctx, scene), InputExhaustedError);
  assert.match(ctx.io.text(), /Dziesięć/);
  assert.equal(countOf(state, "belt"), 0);
  assert.equal(countOf(state, "belt_wzmocniony"), 0);
  assert.equal(countOf(state, "belt_wybuchowy"), 10);
  assert.equal(state.character.money, 0);

  // 2. Inventory: the crossbow's menu, switch explosive loading on, then put it in hand (it loads one explosive bolt).
  const list = state.inventory.items.map((s) => s.id);
  const kusza = String(list.indexOf("kusza_lekka") + 1);
  ctx.io = createScriptedIO([kusza, "5", "1", "w"], { tty: false });
  await showInventory(ctx);
  assert.ok(ctx.io.text().includes(data.ui["inv.loadExplosiveOn"]));
  assert.equal(state.inventory.loadExplosive, true);
  assert.equal(state.inventory.equipped.bron, "kusza_lekka");
  assert.equal(state.inventory.loaded.kusza_lekka, 1);
  assert.equal(state.inventory.loadedAmmo.kusza_lekka, "belt_wybuchowy");
  assert.equal(countOf(state, "belt_wybuchowy"), 9);

  // 3. A fight with three bandits at range: one shot, the bolt goes off, the fragments finish the group.
  ctx.io = createScriptedIO(["a", "1", ""], { tty: false }); // attack, the first bandit, Enter on the summary
  await defaultHandlers.combat(ctx, { id: "x", type: "combat", enemies: [{ id: "bandyta", count: 3 }], start: "far" });
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  const out = ctx.io.text();
  assert.match(out, /Bełt wybucha\. Odłamki trafiają Bandytę 2 za 4, Bandytę 3 za 4\./);
  assert.match(out, /Zwycięstwo/);

  // 4. After the fight: one bolt was spent on the shot, the crossbow took the next explosive one from the bag.
  assert.equal(state.inventory.loaded.kusza_lekka, 1);
  assert.equal(state.inventory.loadedAmmo.kusza_lekka, "belt_wybuchowy");
  assert.equal(countOf(state, "belt_wybuchowy"), 8);
});

test("prawdziwa gra: pełna torba u Brygidy, wymiana nie przechodzi, kowalka mówi o torbie, nic nie przepada", async () => {
  setColorsEnabled(false);
  const data = minimalData();
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 100;
  addItem(state, data, "belt_wzmocniony", 10);
  const room = () => (data.rules.inventory.hardLimitPercent / 100) * getStats(state, data).derived.carry - carriedWeight(state, data);
  while (room() >= 1.5) addItem(state, data, "belt", 1);
  const plain = countOf(state, "belt");
  const ctx = { state, data, io: null, rng: low, debug: false, notices: [] };
  const scene = spotScenes(data, "obserwatorium", "ulepszenia")[0];
  const nodes = data.dialogues.find((d) => d.id === "ulepszenia_brygida").nodes;
  ctx.io = createScriptedIO([optionNumber(ctx, "ulepszenia_brygida", "u_belt_wybuchowy"), "1"], { tty: false }); // exchange, then "Dobra, zrobię miejsce."
  await assert.rejects(defaultHandlers[scene.type](ctx, scene), InputExhaustedError);
  const out = ctx.io.text().replace(/\s+/g, " "); // long lines are wrapped
  assert.ok(out.includes(nodes.za_ciezko.text), out.slice(-1500));
  assert.ok(!out.includes(nodes.zrobione_belty.text));
  assert.match(out, /Dobra, zrobię miejsce\./);
  assert.equal(countOf(state, "belt_wzmocniony"), 10);
  assert.equal(countOf(state, "belt_wybuchowy"), 0);
  assert.equal(countOf(state, "belt"), plain);
  assert.equal(state.character.money, 100);
});
