import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, equip, countOf, loadWorn } from "../src/systems/inventory.js";
import { createCombat } from "../src/systems/combat/state.js";
import { finishCombat } from "../src/systems/combat/turn.js";

const data = minimalData();
const mk = () => ({ inventory: { items: [], equipped: {}, quickSlots: [], loaded: {} } });

test("założenie kuszy z bełtem ładuje ją i zużywa bełt", () => {
  const state = mk();
  addItem(state, data, "kusza_lekka", 1); addItem(state, data, "belt", 3);
  equip(state, data, "kusza_lekka", "bron_zapas");
  assert.equal(state.inventory.loaded.kusza_lekka, 1);
  assert.equal(countOf(state, "belt"), 2);
});
test("założenie bez amunicji zostawia broń pustą", () => {
  const state = mk();
  addItem(state, data, "kusza_lekka", 1);
  equip(state, data, "kusza_lekka", "bron");
  assert.equal(state.inventory.loaded.kusza_lekka ?? 0, 0);
});
test("założenie załadowanej broni nie zużywa amunicji", () => {
  const state = mk();
  addItem(state, data, "kusza_lekka", 1); addItem(state, data, "belt", 3);
  state.inventory.loaded.kusza_lekka = 1;
  equip(state, data, "kusza_lekka", "bron");
  assert.equal(countOf(state, "belt"), 3);
});

// Fight helpers: a finished fight with the given outcome and optional scene loot.
const lucky = { int: (lo, hi) => (lo === 1 && hi === 100 ? 1 : hi) };
function fight(outcome, { def = {}, prep } = {}) {
  const state = combatState(data, "miecz");
  state.character.hp = 999;
  addItem(state, data, "kusza_lekka", 1);
  prep?.(state);
  const combat = createCombat(state, data, { enemies: [{ id: "bandyta" }], start: "far", canFlee: true, id: "walka_a", ...def }, lucky);
  if (outcome === "win") for (const e of combat.enemies) e.dead = true;
  else combat.outcome = outcome;
  return { state, combat };
}
const wear = (slot) => (state) => {
  addItem(state, data, "belt", 2);
  state.inventory.equipped[slot] = "kusza_lekka";
  state.inventory.loaded.kusza_lekka = 0;
};

test("po wygranej broń w ręku i zapasie jest załadowana", () => {
  for (const slot of ["bron", "bron_zapas"]) {
    const { state, combat } = fight("win", { prep: wear(slot) });
    finishCombat(state, data, combat, lucky);
    assert.equal(state.inventory.loaded.kusza_lekka, 1, slot);
    assert.equal(countOf(state, "belt"), 1, slot);
  }
});
test("po ucieczce też", () => {
  const { state, combat } = fight("fled", { prep: wear("bron") });
  finishCombat(state, data, combat, lucky);
  assert.equal(state.inventory.loaded.kusza_lekka, 1);
  assert.equal(countOf(state, "belt"), 1);
});
test("bez amunicji broń zostaje pusta, a walka kończy się normalnie", () => {
  const { state, combat } = fight("win", { prep: (s) => { s.inventory.equipped.bron = "kusza_lekka"; s.inventory.loaded.kusza_lekka = 0; } });
  const result = finishCombat(state, data, combat, lucky);
  assert.equal(result.outcome, "win");
  assert.equal(state.inventory.loaded.kusza_lekka ?? 0, 0);
});
test("stary zapis: pusta kusza i bełty ładują się po następnej walce", () => {
  const { state, combat } = fight("fled", { prep: (s) => { addItem(s, data, "belt", 2); s.inventory.equipped.bron = "kusza_lekka"; delete s.inventory.loaded.kusza_lekka; } });
  assert.equal("kusza_lekka" in state.inventory.loaded, false);
  finishCombat(state, data, combat, lucky);
  assert.equal(state.inventory.loaded.kusza_lekka, 1);
});
test("bełt z łupu ładuje broń jeszcze po tej samej walce", () => {
  const { state, combat } = fight("win", {
    def: { loot: [{ chance: 100, giveItem: "belt" }] },
    prep: (s) => { s.inventory.equipped.bron = "kusza_lekka"; s.inventory.loaded.kusza_lekka = 0; },
  });
  assert.equal(countOf(state, "belt"), 0);
  finishCombat(state, data, combat, lucky);
  assert.equal(state.inventory.loaded.kusza_lekka, 1);
  assert.equal(countOf(state, "belt"), 0);
});

test("loadWorn ładuje broń w ręku i w zapasie", () => {
  const state = mk();
  addItem(state, data, "kusza_lekka", 1); addItem(state, data, "belt", 4);
  state.inventory.equipped.bron = "kusza_lekka";
  loadWorn(state, data);
  assert.equal(state.inventory.loaded.kusza_lekka, 1);
  assert.equal(countOf(state, "belt"), 3);
});
test("loadWorn: dwie różne bronie dystansowe, obie dostają amunicję", () => {
  const state = mk();
  addItem(state, data, "kusza_lekka", 1); addItem(state, data, "luk_mysliwski", 1);
  addItem(state, data, "belt", 2); addItem(state, data, "strzala", 2);
  state.inventory.equipped.bron = "kusza_lekka"; state.inventory.equipped.bron_zapas = "luk_mysliwski";
  loadWorn(state, data);
  assert.equal(state.inventory.loaded.kusza_lekka, 1);
  assert.equal(state.inventory.loaded.luk_mysliwski, 1);
  assert.equal(countOf(state, "belt"), 1);
  assert.equal(countOf(state, "strzala"), 1);
});
test("loadWorn: broń z pojemnością większą niż amunicja bierze tyle, ile jest", () => {
  const big = { ...data, items: data.items.map((i) => (i.id === "kusza_lekka" ? { ...i, reload: { ...i.reload, capacity: 3 } } : i)) };
  const state = mk();
  addItem(state, big, "kusza_lekka", 1); addItem(state, big, "belt", 2);
  state.inventory.equipped.bron = "kusza_lekka";
  loadWorn(state, big);
  assert.equal(state.inventory.loaded.kusza_lekka, 2);
  assert.equal(countOf(state, "belt"), 0);
});
