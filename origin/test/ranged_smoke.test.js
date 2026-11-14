import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { createCombat } from "../src/systems/combat/state.js";
import { enemyTurn } from "../src/systems/combat/ai.js";
import { enemyHitChance, fleeChance } from "../src/systems/combat/formulas.js";
import { fireWeapon } from "../src/systems/combat/firearm.js";
import { itemById } from "../src/systems/items.js";

const data = minimalData();
const fixed = (k) => ({ int: () => k });
/** Percent rolls (1-100) come from `rolls` (the last repeats); every other range gives its low end. */
const mkRng = (rolls) => {
  let i = 0;
  return { int: (lo, hi) => (lo === 1 && hi === 100 ? rolls[Math.min(i++, rolls.length - 1)] : lo) };
};
const club = { name: "Palka", damage: [2, 5], damageType: "obuchowe", apCost: 3, hit: 55 };
const sling = { name: "Proca", damage: [1, 3], damageType: "obuchowe", apCost: 2, hit: 50, range: "far" };
const withAttacks = (attacks) => {
  const d = minimalData();
  d.enemies = d.enemies.map((e) => (e.id === "bandyta" ? { ...e, ai: "aggressive", attacks } : e));
  return d;
};
function mkFire() {
  const state = combatState(data, "miecz");
  state.character.hp = 100;
  state.character.attributes.fart = 5;
  state.character.skillPoints.proch = (state.character.skillPoints.proch ?? 0) + 20 - getStats(state, data).skills.proch;
  addItem(state, data, "pistolet_skalkowy", 1);
  assert.equal(equip(state, data, "pistolet_skalkowy", "bron").ok, true);
  state.inventory.loaded = { pistolet_skalkowy: 1 };
  const combat = createCombat(state, data, { id: "walka_t", enemies: [{ id: "bandyta", count: 2 }], start: "far", canFlee: true }, fixed(1));
  combat.playerAp = 10;
  return { state, combat };
}
function mkEnemy(d, { band, smoke, attacks = [club], ap = 3 }) {
  const state = {
    character: {
      name: "T", classId: "miecz", level: 1, xp: 0,
      attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 },
      skillPoints: {}, tagged: [], perks: [], pendingLevelUp: null, hp: 35, effects: [],
    },
    time: { minutes: 12 * 60 },
    inventory: { items: [], equipped: {}, quickSlots: [], loaded: {} },
  };
  const combat = createCombat(state, d, { enemies: [{ id: "bandyta", count: 1 }], start: band, canFlee: true }, fixed(1));
  combat.enemies[0].ap = ap;
  if (smoke) combat.battlefield.push({ id: "zadymienie", remaining: 3, stacks: 1 });
  return { state, combat };
}
const SMOKE_PENALTY = 15;

test("strzał zawsze daje dym, niewypał nie", () => {
  for (const id of ["pistolet_skalkowy", "pistolet_wojskowy", "rusznica", "pistolet_skalkowy_u1", "rusznica_u2"]) {
    assert.equal(itemById(data, id).smoke, 100, id);
  }
  const { state, combat } = mkFire();
  const pistol = itemById(data, "pistolet_skalkowy");
  const events = fireWeapon(state, data, combat, pistol, combat.enemies[0], mkRng([50, 100, 100, 100]));
  assert.ok(events.some((e) => e.type === "dym"));
  assert.equal(combat.battlefield.some((e) => e.id === "zadymienie"), true);
  const misfire = mkFire();
  const evs = fireWeapon(misfire.state, data, misfire.combat, pistol, misfire.combat.enemies[0], mkRng([1, 100]));
  assert.equal(evs.some((e) => e.type === "dym"), false);
  assert.equal(misfire.combat.battlefield.length, 0);
});

test("wróg wchodzący przez dym ma −15 w tej turze", () => {
  const d = withAttacks([club]);
  const { state, combat } = mkEnemy(d, { band: "far", smoke: true, ap: 5 });
  const base = enemyHitChance(state, d, combat, { ...combat.enemies[0], band: "melee", effects: [] }, club);
  const events = enemyTurn(state, d, combat, "bandyta#1", fixed(100));
  const atak = events.find((e) => e.type === "atak");
  assert.equal(atak.chance, base - SMOKE_PENALTY);
});

test("wróg stojący już w zwarciu bije normalnie", () => {
  const d = withAttacks([club]);
  const { state, combat } = mkEnemy(d, { band: "melee", smoke: true });
  const base = enemyHitChance(state, d, combat, { ...combat.enemies[0], effects: [] }, club);
  const events = enemyTurn(state, d, combat, "bandyta#1", fixed(100));
  assert.equal(events.find((e) => e.type === "atak").chance, base);
});

test("kara znika po turze wroga", () => {
  const d = withAttacks([club]);
  const { state, combat } = mkEnemy(d, { band: "far", smoke: true, ap: 5 });
  enemyTurn(state, d, combat, "bandyta#1", fixed(100));
  assert.ok(!combat.enemies[0].enteredSmoke);
  const enemy = combat.enemies[0];
  assert.equal(enemyHitChance(state, d, combat, enemy, club), enemyHitChance(state, d, combat, { ...enemy, enteredSmoke: false }, club));
});

test("bez dymu wejście nie ma kary", () => {
  const d = withAttacks([club]);
  const { state, combat } = mkEnemy(d, { band: "far", smoke: false, ap: 5 });
  const base = enemyHitChance(state, d, combat, { ...combat.enemies[0], band: "melee", effects: [] }, club);
  const events = enemyTurn(state, d, combat, "bandyta#1", fixed(100));
  assert.equal(events.find((e) => e.type === "atak").chance, base);
});

test("strzał wroga z dystansu dalej ma −35", () => {
  const d = withAttacks([sling]);
  const { state, combat } = mkEnemy(d, { band: "far", smoke: false });
  const e = combat.enemies[0];
  const before = enemyHitChance(state, d, combat, e, sling);
  combat.battlefield.push({ id: "zadymienie", remaining: 3, stacks: 1 });
  assert.equal(enemyHitChance(state, d, combat, e, sling), before - 35);
});

test("ucieczka w dymie ma +20", () => {
  const { state, combat } = mkEnemy(withAttacks([club]), { band: "far", smoke: false });
  const before = fleeChance(state, data, combat);
  combat.battlefield.push({ id: "zadymienie", remaining: 3, stacks: 1 });
  assert.equal(fleeChance(state, data, combat), Math.min(95, before + 20));
});
