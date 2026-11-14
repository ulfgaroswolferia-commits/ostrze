import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData } from "./helpers.js";
import { applyEffect, tickHour } from "../src/systems/effects.js";
import { getStats } from "../src/systems/stats.js";
import { createCombat } from "../src/systems/combat/state.js";
import {
  applyToEnemy, applyToPlayer, startTurnEffects, endTurnEffects, endRoundBattlefield, isDazed, clearTurnEffects,
} from "../src/systems/combat/effects.js";

const data = minimalData();
// tests mutate enemy data; each file gets its own copy from minimalData()
const fixed = (k) => ({ int: () => k });

function mkState() {
  return {
    character: {
      name: "T", classId: "miecz", level: 1, xp: 0,
      attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 },
      skillPoints: {}, tagged: ["sieczna"], perks: [], pendingLevelUp: null, hp: 35,
    },
    time: { minutes: 12 * 60 },
    inventory: { items: [], equipped: {}, quickSlots: [], loaded: {} },
  };
}
const mk = (state, enemies = [{ id: "bandyta", count: 1 }]) => createCombat(state, data, { enemies, start: "far" }, fixed(1));

test("applyToPlayer w walce działa, applyEffect bez inCombat nadal rzuca", () => {
  const state = mkState();
  assert.throws(() => applyEffect(state, data, "oslepienie", fixed(100)));
  const r = applyToPlayer(state, data, "oslepienie", fixed(100));
  assert.equal(r.resisted, false);
  assert.equal(state.character.effects[0].id, "oslepienie");
});

test("odporność, resist i strach na wrogu", () => {
  const state = mkState();
  const combat = mk(state);
  const e = combat.enemies[0];
  const base = data.enemies.find((x) => x.id === e.id);
  base.immune = ["oslepienie"];
  assert.deepEqual(applyToEnemy(data, combat, e, "oslepienie", fixed(1)), { applied: false, resisted: false, immune: true });
  assert.equal(e.effects.length, 0);
  base.immune = [];
  base.effectResist = { strach: 100 };
  assert.deepEqual(applyToEnemy(data, combat, e, "strach", fixed(100)), { applied: false, resisted: true, immune: false });
  assert.equal(e.effects.length, 0);
  base.effectResist = {};
  assert.equal(e.morale, 60);
  assert.equal(applyToEnemy(data, combat, e, "strach", fixed(50)).applied, true);
  assert.equal(e.morale, 40);
  assert.equal(e.effects[0].id, "strach");
});

test("ogłuszenie z tury wroga: gracz traci dokładnie jedną turę", () => {
  const state = mkState();
  const combat = mk(state);
  applyToPlayer(state, data, "ogluszenie", fixed(100));
  assert.equal(startTurnEffects(state, data, combat, "player", fixed(1)).skip, true);
  const ev = endTurnEffects(state, data, combat, "player");
  assert.deepEqual(ev.map((e) => e.type), ["efekt_koniec"]);
  assert.equal(state.character.effects.length, 0);
  assert.equal(startTurnEffects(state, data, combat, "player", fixed(1)).skip, false);
});

test("ogłuszenie nałożone w własnej turze nie znika przed utraconą turą", () => {
  const state = mkState();
  const combat = mk(state);
  startTurnEffects(state, data, combat, "player", fixed(1));
  applyToPlayer(state, data, "ogluszenie", fixed(100));
  endTurnEffects(state, data, combat, "player");
  assert.equal(startTurnEffects(state, data, combat, "player", fixed(1)).skip, true);
  endTurnEffects(state, data, combat, "player");
  assert.equal(startTurnEffects(state, data, combat, "player", fixed(1)).skip, false);
});

test("ogłuszony w turze gracza wróg traci najbliższą turę", () => {
  const state = mkState();
  const combat = mk(state);
  const e = combat.enemies[0];
  applyToEnemy(data, combat, e, "ogluszenie", fixed(100));
  assert.equal(startTurnEffects(state, data, combat, e.uid, fixed(1)).skip, true);
  endTurnEffects(state, data, combat, e.uid);
  assert.equal(startTurnEffects(state, data, combat, e.uid, fixed(1)).skip, false);
});

test("zamroczenie: statystyki gracza i isDazed wroga", () => {
  const state = mkState();
  const before = getStats(state, data).attributes.zrecznosc;
  applyToPlayer(state, data, "zamroczenie", fixed(100));
  assert.equal(getStats(state, data).attributes.zrecznosc, before - 2);
  const combat = mk(state);
  const e = combat.enemies[0];
  assert.equal(isDazed(e), false);
  applyToEnemy(data, combat, e, "zamroczenie", fixed(100));
  assert.equal(isDazed(e), true);
});

test("krwawienie x2: tyknięcie 2x zakres na początku tury", () => {
  const state = mkState();
  const combat = mk(state);
  const e = combat.enemies[0];
  applyToEnemy(data, combat, e, "krwawienie", fixed(100));
  applyToEnemy(data, combat, e, "krwawienie", fixed(100));
  const hp = e.hp;
  const { events } = startTurnEffects(state, data, combat, e.uid, fixed(3));
  assert.deepEqual(events, [{ type: "efekt_obrazenia", id: "krwawienie", damage: 6, target: e.uid }]);
  assert.equal(e.hp, hp - 6);
});

test("efekty w walce mogą zbić HP gracza do 0", () => {
  const state = mkState();
  state.character.hp = 2;
  const combat = mk(state);
  applyToPlayer(state, data, "podpalenie", fixed(100));
  startTurnEffects(state, data, combat, "player", fixed(5));
  assert.equal(state.character.hp, 0);
});

test("rozkojarzenie odbiera PA wg szansy", () => {
  const state = mkState();
  const combat = mk(state);
  combat.playerAp = 6;
  applyToPlayer(state, data, "rozkojarzenie", fixed(100));
  const { events } = startTurnEffects(state, data, combat, "player", fixed(10));
  assert.equal(combat.playerAp, 4);
  assert.equal(events[0].type, "efekt_ap");
  startTurnEffects(state, data, combat, "player", fixed(90));
  assert.equal(combat.playerAp, 4);
});

test("zadymienie odlicza się tylko w endRoundBattlefield", () => {
  const state = mkState();
  const combat = mk(state);
  combat.battlefield.push({ id: "zadymienie", remaining: 2, stacks: 1 });
  endTurnEffects(state, data, combat, "player");
  assert.equal(combat.battlefield[0].remaining, 2);
  endRoundBattlefield(combat);
  assert.equal(combat.battlefield[0].remaining, 1);
  const ev = endRoundBattlefield(combat);
  assert.deepEqual(ev.map((e) => e.type), ["efekt_koniec"]);
  assert.equal(combat.battlefield.length, 0);
});

test("clearTurnEffects zostawia efekty hour", () => {
  const state = mkState();
  applyToPlayer(state, data, "oslepienie", fixed(100));
  applyEffect(state, data, "zmeczenie", fixed(100));
  clearTurnEffects(state, data);
  assert.deepEqual(state.character.effects.map((e) => e.id), ["zmeczenie"]);
  tickHour(state, data);
});

test("efekt nałożony graczowi w jego własnej turze (odskok) trwa pełne 2 tury", () => {
  const state = mkState();
  const combat = mk(state);
  startTurnEffects(state, data, combat, "player", fixed(1));
  applyToPlayer(state, data, "zamroczenie", fixed(100));
  assert.deepEqual(endTurnEffects(state, data, combat, "player"), []);
  assert.equal(state.character.effects[0].remaining, 2);
  startTurnEffects(state, data, combat, "player", fixed(1)); // turn 1 under the effect
  assert.deepEqual(endTurnEffects(state, data, combat, "player"), []);
  assert.equal(state.character.effects[0].remaining, 1);
  startTurnEffects(state, data, combat, "player", fixed(1)); // turn 2
  assert.deepEqual(endTurnEffects(state, data, combat, "player").map((e) => e.type), ["efekt_koniec"]);
  assert.equal(state.character.effects.length, 0);
});

test("efekt nałożony wrogowi w turze gracza odlicza się od jego tury (jak dotąd)", () => {
  const state = mkState();
  const combat = mk(state);
  const e = combat.enemies[0];
  applyToEnemy(data, combat, e, "krwawienie", fixed(100));
  const before = e.effects[0].remaining;
  startTurnEffects(state, data, combat, e.uid, fixed(1));
  endTurnEffects(state, data, combat, e.uid);
  assert.equal(e.effects[0].remaining, before - 1);
});
