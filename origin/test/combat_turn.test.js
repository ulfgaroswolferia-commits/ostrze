import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState, playFight } from "./helpers.js";
import { createCombat, isOver } from "../src/systems/combat/state.js";
import { beginTurn, endTurn, runEnemyTurns, outcomeOf, finishCombat } from "../src/systems/combat/turn.js";
import { attackTargets } from "../src/systems/combat/actions.js";
import { applyToEnemy, applyToPlayer } from "../src/systems/combat/effects.js";
import { getStats } from "../src/systems/stats.js";

// Player always hits for max damage (the 1..100 rolls give 1, damage rolls give the maximum).
const lucky = { int: (lo, hi) => (lo === 1 && hi === 100 ? 1 : hi) };
const fixed = (k) => ({ int: () => k });
const attackFirst = (state, data, combat) => {
  const ts = attackTargets(state, data, combat);
  if (ts.length) return { id: "attack", target: ts[0] };
  const far = combat.enemies.find((e) => !e.dead && !e.fled);
  return { id: "move", target: far.uid };
};

function setup({ enemies = [{ id: "bandyta", count: 2 }], def = {}, rng = lucky } = {}) {
  const data = minimalData();
  const state = combatState(data, "miecz");
  state.character.hp = 999;
  const combat = createCombat(state, data, { enemies, start: "far", canFlee: true, id: "walka_a", ...def }, rng);
  return { data, state, combat };
}

test("pelna walka: wygrana, PD za pokonanych, lup, czas i flaga", () => {
  const { data, state, combat } = setup();
  const money = state.character.money;
  const result = playFight(state, data, combat, lucky, attackFirst);
  assert.equal(result.outcome, "win");
  assert.equal(result.xp, 80);
  assert.equal(state.character.xp, 80);
  assert.equal(state.character.money, money + 8);
  assert.equal(state.time.minutes, 12 * 60 + 10);
  assert.equal(state.flags.combat_walka_a_wygrana, true);
  assert.ok(result.events.some((e) => e.type === "pieniadze"));
});

test("uciekajacy wrog daje polowe PD i nie zostawia lupu", () => {
  const { data, state, combat } = setup();
  combat.enemies[0].dead = true;
  combat.enemies[1].fled = true;
  const money = state.character.money;
  const result = finishCombat(state, data, combat, lucky);
  assert.equal(result.outcome, "win");
  assert.equal(result.xp, 40 + 20);
  assert.equal(state.character.money, money + 4);
});

test("porazka: brak PD i lupu, flaga porazki, efekty tury znikaja", () => {
  const { data, state, combat } = setup();
  applyToPlayer(state, data, "ogluszenie", fixed(1));
  state.character.hp = 0;
  const result = finishCombat(state, data, combat, lucky);
  assert.equal(result.outcome, "defeat");
  assert.equal(result.xp, 0);
  assert.equal(state.character.xp, 0);
  assert.equal(state.flags.combat_walka_a_porazka, true);
  assert.ok(!state.character.effects.some((e) => e.id === "ogluszenie"));
});

test("ucieczka gracza i remis ustawiaja flage ucieczki, bez PD", () => {
  for (const outcome of ["fled", "draw"]) {
    const { data, state, combat } = setup();
    combat.outcome = outcome;
    const result = finishCombat(state, data, combat, lucky);
    assert.equal(result.outcome, outcome);
    assert.equal(result.xp, 0);
    assert.equal(state.flags.combat_walka_a_ucieczka, true);
  }
});

test("czas walki z def.minutes", () => {
  const { data, state, combat } = setup({ def: { minutes: 25 } });
  combat.outcome = "fled";
  finishCombat(state, data, combat, lucky);
  assert.equal(state.time.minutes, 12 * 60 + 25);
});

test("wrog niezdolny do dzialania: po 200 rundach remis, bez wyjatku", () => {
  const { data, state, combat } = setup({ enemies: [{ id: "bandyta" }] });
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, attacks: [{ ...e.attacks[0], apCost: 99 }] } : e));
  const result = playFight(state, data, combat, lucky, () => null);
  assert.equal(result.outcome, "draw");
  assert.equal(combat.round, 201);
  assert.equal(state.character.hp, 999);
});

test("ogluszony wrog jest pomijany w runEnemyTurns i traci dokladnie jedna ture", () => {
  const { data, state, combat } = setup({ enemies: [{ id: "bandyta" }], rng: fixed(1) });
  const enemy = combat.enemies[0];
  enemy.band = "melee";
  applyToEnemy(data, combat, enemy, "ogluszenie", fixed(100));
  combat.order = ["player", enemy.uid];
  combat.turn = 1;
  const hp = state.character.hp;
  const events = runEnemyTurns(state, data, combat, fixed(100));
  assert.ok(events.some((e) => e.type === "tura_przepada" && e.target === enemy.uid));
  assert.ok(!events.some((e) => e.type === "atak"));
  assert.equal(state.character.hp, hp);
  assert.ok(!enemy.effects.some((e) => e.id === "ogluszenie"), "ogluszenie wygasa po pominietej turze");
  assert.equal(combat.order[combat.turn], "player");
  combat.turn = 1; // the next enemy turn is a normal one
  const next = runEnemyTurns(state, data, combat, fixed(100));
  assert.ok(next.some((e) => e.type === "atak"));
});

test("beginTurn gracza: odnawia PA, zeruje obrone; ogluszony gracz traci ture i efekt wygasa", () => {
  const { data, state, combat } = setup({ enemies: [{ id: "bandyta" }] });
  combat.order = ["player", "bandyta#1"];
  combat.turn = 0;
  combat.defendBonus = 15;
  combat.playerAp = 0;
  const b = beginTurn(state, data, combat, lucky);
  assert.equal(b.who, "player");
  assert.equal(b.skip, false);
  assert.equal(combat.playerAp, getStats(state, data).derived.ap);
  assert.equal(combat.defendBonus, 0);
  applyToPlayer(state, data, "ogluszenie", fixed(100));
  const b2 = beginTurn(state, data, combat, lucky);
  assert.equal(b2.skip, true);
  assert.ok(b2.events.some((e) => e.type === "tura_przepada"));
  endTurn(state, data, combat);
  assert.ok(!state.character.effects.some((e) => e.id === "ogluszenie"));
});

test("endTurn: pomija martwych, na koncu rundy rosnie round i odlicza battlefield", () => {
  const { data, state, combat } = setup({ enemies: [{ id: "bandyta", count: 2 }] });
  combat.order = ["player", "bandyta#1", "bandyta#2"];
  combat.turn = 0;
  combat.enemies[0].dead = true;
  combat.battlefield.push({ id: "zadymienie", remaining: 1, stacks: 1 });
  endTurn(state, data, combat);
  assert.equal(combat.order[combat.turn], "bandyta#2");
  const events = endTurn(state, data, combat);
  assert.equal(combat.order[combat.turn], "player");
  assert.equal(combat.round, 2);
  assert.ok(events.some((e) => e.type === "efekt_koniec" && e.target === "battlefield"));
});

test("smierc wroga od efektu na poczatku tury: wrog_pokonany raz i spadek morale innych", () => {
  const { data, state, combat } = setup({ enemies: [{ id: "bandyta", count: 2 }] });
  const [a, b] = combat.enemies;
  combat.order = ["player", a.uid, b.uid];
  combat.turn = 1;
  a.hp = 1;
  a.effects.push({ id: "krwawienie", remaining: 3, stacks: 1 });
  const moraleBefore = b.morale;
  const begun = beginTurn(state, data, combat, fixed(3));
  assert.equal(a.dead, true);
  assert.equal(begun.events.filter((e) => e.type === "wrog_pokonany").length, 1);
  assert.equal(b.morale, moraleBefore - data.rules.combat.moraleOnAllyDeath);
});

test("outcomeOf: win, defeat, draw z combat.outcome, w toku null", () => {
  const { state, combat } = setup({ enemies: [{ id: "bandyta" }] });
  assert.equal(outcomeOf(state, combat), null);
  combat.enemies[0].fled = true;
  assert.equal(outcomeOf(state, combat), "win");
  combat.enemies[0].fled = false;
  state.character.hp = 0;
  assert.equal(outcomeOf(state, combat), "defeat");
  state.character.hp = 5;
  combat.outcome = "draw";
  assert.equal(outcomeOf(state, combat), "draw");
});

test("trening: HP gracza 1 -> porazka, wszyscy wrogowie HP 1 -> wygrana; isOver zgodne z outcomeOf", () => {
  const { state, combat } = setup({ enemies: [{ id: "instruktor" }], def: { training: true, nonLethal: true } });
  assert.equal(outcomeOf(state, combat), null);
  combat.enemies[0].hp = 1;
  assert.equal(outcomeOf(state, combat), "win");
  assert.equal(isOver(combat, state), "win");
  state.character.hp = 1;
  assert.equal(outcomeOf(state, combat), "defeat");
  assert.equal(isOver(combat, state), "defeat");
});

test("sparing: wygrana daje PD za wroga zostawionego z 1 HP", () => {
  const { data, state, combat } = setup({ enemies: [{ id: "instruktor" }], def: { training: true, nonLethal: true } });
  combat.enemies[0].hp = 1;
  const result = finishCombat(state, data, combat, lucky);
  assert.equal(result.outcome, "win");
  assert.equal(result.xp, 30);
});

test("trening: HP gracza nigdy nizej niz 1 w calym przebiegu", () => {
  const { data, state, combat } = setup({ enemies: [{ id: "instruktor" }], def: { training: true, nonLethal: true } });
  state.character.hp = 20;
  const result = playFight(state, data, combat, lucky, () => null);
  assert.equal(result.outcome, "defeat");
  assert.equal(state.character.hp, 1);
});

test("endTurn po rundzie 200 zglasza remis zdarzeniem", () => {
  const { data, state, combat } = setup({ enemies: [{ id: "bandyta" }] });
  combat.order = ["player", "bandyta#1"];
  combat.turn = 1;
  combat.round = 200;
  const events = endTurn(state, data, combat);
  assert.equal(combat.outcome, "draw");
  assert.ok(events.some((e) => e.type === "remis"));
});

test("wrog zabity przez efekt nie zglasza dodatkowo tura_przepada", () => {
  const { data, state, combat } = setup({ enemies: [{ id: "bandyta" }] });
  const a = combat.enemies[0];
  combat.order = ["player", a.uid];
  combat.turn = 1;
  a.hp = 1;
  a.effects.push({ id: "krwawienie", remaining: 3, stacks: 1 }, { id: "ogluszenie", remaining: 1, stacks: 1 });
  const begun = beginTurn(state, data, combat, fixed(3));
  assert.equal(a.dead, true);
  assert.ok(!begun.events.some((e) => e.type === "tura_przepada"));
});
