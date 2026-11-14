import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData } from "./helpers.js";
import { createRng } from "../src/engine/dice.js";
import { itemById } from "../src/systems/items.js";
import { createCombat, livingEnemies, enemyByUid, isOver } from "../src/systems/combat/state.js";
import {
  playerHitChance, enemyHitChance, rollDamage, mitigate, fleeChance, dealDamage,
} from "../src/systems/combat/formulas.js";

const data = minimalData();
const rules = data.rules.combat;
const fixed = (k) => ({ int: () => k });

function mkState(over = {}, minutes = 12 * 60) {
  return {
    character: {
      name: "T", classId: "miecz", level: 1, xp: 0,
      attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5, ...over.attributes },
      skillPoints: {}, tagged: ["sieczna"], perks: [], pendingLevelUp: null, hp: 35, ...over.character,
    },
    time: { minutes },
    inventory: { items: [], equipped: {}, quickSlots: [], loaded: {} },
  };
}
const scene = (over = {}) => ({ enemies: [{ id: "bandyta", count: 1 }], start: "far", ...over });
const mk = (state, over) => createCombat(state, data, scene(over), fixed(1));
const miecz = itemById(data, "miecz_krotki");

test("trafienie gracza: umiejętność 35, obrona 10 -> 55", () => {
  const s = mkState();
  const c = mk(s, { start: "melee" });
  assert.equal(playerHitChance(s, data, c, miecz, c.enemies[0]), 30 + 35 - 10);
});
test("trafienie gracza: minStrength, far w zwarciu, noc, obcięcie górne", () => {
  const c0 = mk(mkState());
  const e = c0.enemies[0];
  const weak = mkState({ attributes: { sila: 3 } });
  const base = playerHitChance(weak, data, c0, { ...miecz, minStrength: 0 }, e);
  assert.equal(playerHitChance(weak, data, c0, { ...miecz, minStrength: 4 }, e), base - 10);
  const bow = itemById(data, "luk_mysliwski");
  const s = mkState();
  const far = playerHitChance(s, data, c0, bow, e);
  e.band = "melee";
  assert.equal(playerHitChance(s, data, c0, bow, e), far - 20);
  e.band = "far";
  // noc: rangedHitChance -15 plus -15 to skills built on bystrosc (strzelecka)
  assert.equal(playerHitChance(mkState({}, 23 * 60), data, c0, bow, e), far - 15 - 15);
  assert.equal(playerHitChance(mkState({}, 23 * 60), data, c0, miecz, e), playerHitChance(s, data, c0, miecz, e));
  const sharp = mkState({ character: { skillPoints: { sieczna: 100 } } });
  assert.equal(playerHitChance(sharp, data, c0, miecz, e), 95);
});
test("trafienie gracza: obrona wroga z efektów, dolne obcięcie do 5", () => {
  const s = mkState();
  const d = structuredClone(data);
  d.effects.push({ id: "tarcza_t", name: "T", unit: "turn", duration: 2, modifiers: { defense: 100 }, stack: "refresh" });
  const c = createCombat(s, d, scene(), fixed(1));
  c.enemies[0].effects.push({ id: "tarcza_t", remaining: 2, stacks: 1 });
  assert.equal(playerHitChance(s, d, c, miecz, c.enemies[0]), 5);
});
test("trafienie wroga: bazowe, dazed, morale, defendBonus, obcięcie", () => {
  const s = mkState();
  const c = mk(s);
  const e = c.enemies[0];
  const atk = { hit: 55 };
  assert.equal(enemyHitChance(s, data, c, e, atk), 55 - 10);
  const d = structuredClone(data);
  d.effects.push({ id: "otepienie_t", name: "O", unit: "turn", duration: 2, dazed: true, stack: "refresh" });
  e.effects.push({ id: "otepienie_t", remaining: 2, stacks: 1 });
  assert.equal(enemyHitChance(s, d, c, e, atk), 45 - 20);
  e.effects.length = 0;
  e.effects.push({ id: "zamroczenie", remaining: 2, stacks: 1 }); // hitChance -10 and dazed -20
  assert.equal(enemyHitChance(s, data, c, e, atk), 45 - 10 - 20);
  e.effects.length = 0;
  e.morale = 20;
  assert.equal(enemyHitChance(s, data, c, e, atk), 45 - 10);
  e.morale = 25;
  assert.equal(enemyHitChance(s, data, c, e, atk), 45);
  e.morale = null;
  c.defendBonus = 10;
  assert.equal(enemyHitChance(s, data, c, e, atk), 35);
  assert.equal(enemyHitChance(s, data, c, e, { hit: 5 }), 5);
  assert.equal(enemyHitChance(s, data, c, e, { hit: 95 }), 75);
  c.defendBonus = -200;
  assert.equal(enemyHitChance(s, data, c, e, { hit: 95 }), 95);
});
test("obrażenia: kusza 8-14 przebicie 3 vs pancerz 6, damageTaken klute 0.5 -> 3", () => {
  const kusza = itemById(data, "kusza_lekka");
  const { raw, crit } = rollDamage(fixed(10), { damage: kusza.damage, damageType: "klute", melee: false, sila: 5, critChance: 0, rules });
  assert.deepEqual([raw, crit], [10, false]);
  assert.equal(mitigate({ raw, crit, armor: 6, armorPierce: kusza.armorPierce, reductionPercent: 0, taken: 0.5 }), 3);
});
test("obrażenia: krytyk x1.5 pomija pancerz", () => {
  const r = rollDamage(fixed(10), { damage: [8, 14], damageType: "klute", melee: false, sila: 5, critChance: 100, rules });
  assert.deepEqual(r, { raw: 15, crit: true });
  assert.equal(mitigate({ ...r, armor: 6, armorPierce: 0, reductionPercent: 0, taken: 1 }), 15);
});
test("obrażenia: redukcja obcięta do 75, minimum 1, damageTaken 0", () => {
  assert.equal(mitigate({ raw: 100, armor: 0, reductionPercent: 90 }), 25);
  assert.equal(mitigate({ raw: 2, armor: 10, reductionPercent: 0 }), 1);
  assert.equal(mitigate({ raw: 10, armor: 0, reductionPercent: 0, taken: 0 }), 0);
  assert.equal(mitigate({ raw: 5, armor: 0, reductionPercent: 75, taken: 0.1 }), 1);
});
test("obrażenia: bonus siły w zwarciu max(0, sila - 5) i modyfikator damage", () => {
  const melee = (sila, bonus) => rollDamage(fixed(4), { damage: [4, 8], damageType: "sieczne", melee: true, sila, bonus, critChance: 0, rules }).raw;
  assert.equal(melee(8, 0), 4 + 3);
  assert.equal(melee(3, 0), 4);
  assert.equal(melee(5, 2), 6);
  assert.equal(rollDamage(fixed(4), { damage: [4, 8], damageType: "klute", melee: false, sila: 9, critChance: 0, rules }).raw, 4);
  assert.throws(() => rollDamage(fixed(4), { damage: [1, 2], melee: true, sila: 5 }));
});
test("ucieczka: 30 + 3*5 - 5*1 = 40, obcięcie 5-95", () => {
  const s = mkState();
  const c = mk(s, { start: "melee" });
  assert.equal(fleeChance(s, data, c), 40);
  c.enemies[0].band = "far";
  assert.equal(fleeChance(s, data, c), 45);
  const many = createCombat(s, data, scene({ start: "melee", enemies: [{ id: "bandyta", count: 8 }] }), fixed(1));
  assert.equal(fleeChance(s, data, many), 5);
  assert.equal(fleeChance(mkState({ attributes: { zrecznosc: 30 } }), data, c), 95);
});
test("walka bez zasadzki: gracz zawsze otwiera, nawet gdy wrogowie wygrali inicjatywę", () => {
  const s = mkState();
  const run = (extra) => createCombat(s, data, { ...scene({ enemies: [{ id: "bandyta", count: 2 }] }), ...extra }, { int: (() => { const seq = [1, 10, 10]; return () => seq.shift(); })() }).order;
  assert.deepEqual(run({}), ["player", "bandyta#1", "bandyta#2"]);
  assert.deepEqual(run({ ambush: true }), ["bandyta#1", "bandyta#2", "player"], "zasadzka: decyduje inicjatywa");
});
test("inicjatywa (zasadzka): remis -> gracz pierwszy, malejąco, kolejność wrogów", () => {
  const s = mkState(); // 5 + 5 = 10 + k10; bandyta 4 + k10
  const run = (seq) => createCombat(s, data, scene({ enemies: [{ id: "bandyta", count: 2 }], ambush: true }), { int: () => seq.shift() }).order;
  assert.deepEqual(run([10, 4, 4]), ["player", "bandyta#1", "bandyta#2"]); // 20 vs 8: player, then list order
  assert.deepEqual(run([4, 10, 10]), ["player", "bandyta#1", "bandyta#2"]); // 14 = 14 = 14, tie -> player first
  assert.deepEqual(run([1, 10, 10]), ["bandyta#1", "bandyta#2", "player"]); // 11 vs 14
  assert.deepEqual(run([1, 5, 10]), ["bandyta#2", "player", "bandyta#1"]); // 14, 11, 9
});
test("createCombat: nazwy, pasmo, pola początkowe", () => {
  const s = mkState();
  const c = createCombat(s, data, scene({ enemies: [{ id: "bandyta", count: 2 }, { id: "instruktor" }], start: "melee", training: true }), createRng(1));
  assert.deepEqual(c.enemies.map((e) => e.name), ["Bandyta 1", "Bandyta 2", "Instruktor Radogost"]);
  assert.deepEqual(c.enemies.map((e) => e.uid), ["bandyta#1", "bandyta#2", "instruktor#1"]);
  assert.ok(c.enemies.every((e) => e.band === "melee" && e.hp === e.hpMax && !e.dead && !e.fled && e.ap === 0 && e.effects.length === 0));
  assert.deepEqual(c.enemies.map((e) => e.morale), [60, 60, null]);
  assert.equal(mk(s).enemies[0].band, "far");
  assert.equal(mk(s).enemies[0].name, "Bandyta");
  assert.deepEqual([c.turn, c.round, c.playerAp, c.defendBonus, c.outcome, c.training, c.log, c.battlefield], [0, 1, 0, 0, null, true, [], []]);
  assert.equal(c.order.length, 4);
  assert.equal(mk(s).training, false);
  assert.equal(enemyByUid(c, "bandyta#2").name, "Bandyta 2");
  assert.throws(() => createCombat(s, data, scene({ enemies: [{ id: "nie_ma" }] }), fixed(1)));
});
test("createCombat: ten sam wróg z osobnych wpisów dostaje numery po łącznej liczbie", () => {
  const c = createCombat(mkState(), data, scene({ enemies: [{ id: "bandyta", count: 1 }, { id: "instruktor" }, { id: "bandyta", count: 1 }] }), fixed(1));
  assert.deepEqual(c.enemies.map((e) => e.name), ["Bandyta 1", "Instruktor Radogost", "Bandyta 2"]);
  assert.deepEqual(c.enemies.map((e) => e.uid), ["bandyta#1", "instruktor#1", "bandyta#2"]);
});
test("livingEnemies / isOver", () => {
  const s = mkState();
  const c = createCombat(s, data, scene({ enemies: [{ id: "bandyta", count: 2 }] }), fixed(1));
  assert.equal(isOver(c, s), null);
  c.enemies[0].dead = true;
  assert.equal(livingEnemies(c).length, 1);
  c.enemies[1].fled = true;
  assert.equal(isOver(c, s), "win");
  s.character.hp = 0;
  assert.equal(isOver(c, s), "defeat");
  s.character.hp = 5;
  c.outcome = "fled";
  assert.equal(isOver(c, s), "fled");
});
test("dealDamage: HP nie poniżej 0, wróg dead, training min 1", () => {
  const s = mkState();
  const c = mk(s);
  assert.equal(dealDamage(c, s.character, 10), 10);
  assert.equal(s.character.hp, 25);
  dealDamage(c, s.character, 100);
  assert.equal(s.character.hp, 0);
  const e = c.enemies[0];
  dealDamage(c, e, 5);
  assert.equal(e.hp, 17); assert.equal(e.dead, false);
  dealDamage(c, e, 50);
  assert.equal(e.hp, 0); assert.equal(e.dead, true);
  const t = createCombat(s, data, scene({ training: true }), fixed(1));
  s.character.hp = 3;
  dealDamage(t, s.character, 50);
  assert.equal(s.character.hp, 1);
  dealDamage(t, t.enemies[0], 500);
  assert.equal(t.enemies[0].hp, 1); assert.equal(t.enemies[0].dead, false);
});

test("pole walki: dym obniza trafienia dystansowe gracza i wroga oraz podnosi szanse ucieczki", () => {
  const s = mkState();
  const c = mk(s);
  const e = c.enemies[0];
  const bow = itemById(data, "luk_mysliwski");
  const far = { name: "Proca", hit: 95, apCost: 3, range: "far" };
  const near = { name: "Palka", hit: 95, apCost: 3 };
  const before = {
    bow: playerHitChance(s, data, c, bow, e), sword: playerHitChance(s, data, c, miecz, e),
    far: enemyHitChance(s, data, c, e, far), near: enemyHitChance(s, data, c, e, near), flee: fleeChance(s, data, c),
  };
  c.battlefield.push({ id: "zadymienie", remaining: 3, stacks: 1 });
  assert.equal(playerHitChance(s, data, c, bow, e), Math.max(rules.hitMin, before.bow - 35));
  assert.equal(playerHitChance(s, data, c, miecz, e), before.sword);
  assert.equal(enemyHitChance(s, data, c, e, far), before.far - 35);
  assert.equal(enemyHitChance(s, data, c, e, near), before.near);
  assert.equal(fleeChance(s, data, c), Math.min(95, before.flee + 20));
});
