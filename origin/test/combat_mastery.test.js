import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState, playFight } from "./helpers.js";
import { masteryTypeOf, masteryGain, masteryBonuses } from "../src/systems/combat/mastery.js";
import { createCharacter } from "../src/systems/character.js";
import { createCombat } from "../src/systems/combat/state.js";
import { finishCombat } from "../src/systems/combat/turn.js";
import { doAction, attackTargets } from "../src/systems/combat/actions.js";
import { playerHitChance, enemyHitChance, rollDamage } from "../src/systems/combat/formulas.js";
import { itemById } from "../src/systems/items.js";
import { createRng } from "../src/engine/dice.js";

const data = minimalData();
const lucky = { int: (lo, hi) => (lo === 1 && hi === 100 ? 1 : hi) };
const attackFirst = (state, d, combat) => {
  const ts = attackTargets(state, d, combat);
  if (ts.length) return { id: "attack", target: ts[0] };
  return { id: "move", target: combat.enemies.find((e) => !e.dead && !e.fled).uid };
};
const mk = (def = {}) => {
  const state = combatState(data, "miecz");
  state.character.hp = 999;
  const combat = createCombat(state, data, { enemies: [{ id: "bandyta", count: 2 }], start: "far", canFlee: true, id: "walka_m", ...def }, lucky);
  return { state, combat };
};

test("masteryTypeOf: rodzaj broni, rzut, piesci", () => {
  assert.equal(masteryTypeOf(itemById(data, "miecz_krotki")), "miecz");
  assert.equal(masteryTypeOf(itemById(data, "para_wloczni")), "wlocznie");
  assert.equal(masteryTypeOf(itemById(data, "para_wloczni"), { thrown: true }), "rzucana");
  assert.equal(masteryTypeOf(itemById(data, "piesci")), null);
  assert.equal(masteryTypeOf(undefined), null);
  const throwable = data.items.find((i) => i.type === "throwable");
  assert.equal(masteryTypeOf(throwable), "rzucana");
});

test("masteryGain: malejacy przyrost, zaokraglenie, limit", () => {
  assert.equal(masteryGain(15, 40, data.rules.combat.mastery), 16.4);
  assert.equal(masteryGain(80, 40, data.rules.combat.mastery), 80.1);
  assert.ok(masteryGain(99.9, 1000, data.rules.combat.mastery) <= 100);
  assert.equal(masteryGain(100, 1000, data.rules.combat.mastery), 100);
});

test("masteryGain: trafia w limit (max z reguł), nie przekracza go", () => {
  assert.equal(masteryGain(0, 5000, data.rules.combat.mastery), 100);
  assert.equal(masteryGain(50, 100000, { ...data.rules.combat.mastery, max: 60 }), 60);
});

test("masteryBonuses: przy 50 hit 7, obrazenia 10, obrona 5", () => {
  const { state } = mk();
  state.character.mastery.miecz = 50;
  assert.deepEqual(masteryBonuses(state, data, "miecz"), { hit: 7, damagePercent: 10, defense: 5 });
  assert.deepEqual(masteryBonuses(state, data, "luk"), { hit: 0, damagePercent: 0, defense: 0 });
  assert.deepEqual(masteryBonuses(state, data, null), { hit: 0, damagePercent: 0, defense: 0 });
});

test("createCharacter: miecz zaczyna z 15 w mieczu, wlocznia we wloczniach", () => {
  const { state } = mk();
  assert.deepEqual(state.character.mastery, { miecz: 15, wlocznie: 0, luk: 0, kusza: 0, palna: 0, rzucana: 0 });
  const spear = combatState(data, "wlocznia");
  assert.equal(spear.character.mastery.wlocznie, 15);
  assert.equal(spear.character.mastery.miecz, 0);
});

test("trafienie, obrazenia i obrona korzystaja z biegloscí", () => {
  const { state, combat } = mk();
  const weapon = itemById(data, "miecz_krotki");
  const enemy = combat.enemies[0];
  const base = playerHitChance(state, data, combat, weapon, enemy);
  state.character.mastery.miecz = 100;
  assert.equal(playerHitChance(state, data, combat, weapon, enemy), Math.min(data.rules.combat.hitMax, base + 15 - Math.floor(15 * 15 / 100)));
  const attack = { hit: 60, range: "melee" };
  const e0 = enemyHitChance(state, data, combat, enemy, attack);
  state.character.mastery.miecz = 0;
  assert.equal(e0, enemyHitChance(state, data, combat, enemy, attack) - 10);
  const r = rollDamage({ int: (lo) => lo }, { damage: [10, 10], melee: false, sila: 0, bonusPercent: 20, rules: data.rules.combat });
  assert.equal(r.raw, 12);
});

test("obrona z biegloscia tylko gdy glowna bron jest wrecz", () => {
  const { state, combat } = mk();
  state.character.mastery.miecz = 100;
  const attack = { hit: 60, range: "melee" };
  const withSword = enemyHitChance(state, data, combat, combat.enemies[0], attack);
  state.inventory.equipped.bron = "luk_mysliwski";
  state.character.mastery.luk = 100;
  const withBow = enemyHitChance(state, data, combat, combat.enemies[0], attack);
  assert.equal(withBow, withSword + 10);
});

test("finishCombat: wygrana z 2 bandytami zabitymi mieczem podnosi bieglosc kolejno", () => {
  const { state, combat } = mk();
  const result = playFight(state, data, combat, lucky, attackFirst);
  assert.equal(result.outcome, "win");
  assert.ok(combat.enemies.every((e) => e.killedBy === "miecz"));
  const ev = result.events.filter((e) => e.type === "bieglosc");
  assert.deepEqual(ev, [
    { type: "bieglosc", masteryType: "miecz", before: 15, after: 16.4 },
    { type: "bieglosc", masteryType: "miecz", before: 16.4, after: 17.8 },
  ]);
  assert.equal(state.character.mastery.miecz, 17.8);
});

test("ucieczka i porazka nie zmieniaja biegloscí", () => {
  for (const outcome of ["fled", "defeat"]) {
    const { state, combat } = mk();
    combat.enemies[0].dead = true; combat.enemies[0].killedBy = "miecz";
    if (outcome === "fled") combat.outcome = "fled"; else state.character.hp = 0;
    const r = finishCombat(state, data, combat, lucky);
    assert.equal(state.character.mastery.miecz, 15);
    assert.ok(!r.events.some((e) => e.type === "bieglosc"));
  }
});

test("wrog zabity efektem (bez killedBy) nie daje przyrostu", () => {
  const { state, combat } = mk();
  for (const e of combat.enemies) e.dead = true;
  const r = finishCombat(state, data, combat, lucky);
  assert.equal(r.outcome, "win");
  assert.equal(state.character.mastery.miecz, 15);
  assert.ok(!r.events.some((e) => e.type === "bieglosc"));
});

test("piesci nie ustawiaja killedBy", () => {
  const { state, combat } = mk({ enemies: [{ id: "bandyta" }] });
  delete state.inventory.equipped.bron;
  combat.enemies[0].hp = 1;
  combat.band = "melee"; combat.enemies[0].band = "melee";
  combat.playerAp = 10;
  const r = doAction(state, data, combat, { id: "attack", target: combat.enemies[0].uid }, lucky);
  assert.ok(r.ok);
  assert.equal(combat.enemies[0].dead, true);
  assert.equal(combat.enemies[0].killedBy ?? null, null);
});

test("wygrany trening (sparing) tez uczy", () => {
  const { state, combat } = mk({ enemies: [{ id: "bandyta" }], training: true });
  const result = playFight(state, data, combat, lucky, attackFirst);
  assert.equal(result.outcome, "win");
  assert.ok(state.character.mastery.miecz > 15);
  assert.ok(result.events.some((e) => e.type === "bieglosc"));
});

test("bieglosc nigdy nie przekracza 100", () => {
  const { state, combat } = mk();
  state.character.mastery.miecz = 99.9;
  for (const e of combat.enemies) { e.dead = true; e.killedBy = "miecz"; }
  finishCombat(state, data, combat, createRng(1));
  assert.ok(state.character.mastery.miecz <= 100);
});
