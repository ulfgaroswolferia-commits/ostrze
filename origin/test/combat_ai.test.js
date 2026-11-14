import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData } from "./helpers.js";
import { createCombat } from "../src/systems/combat/state.js";
import { enemyTurn, onAllyDeath } from "../src/systems/combat/ai.js";
import { enemyHitChance } from "../src/systems/combat/formulas.js";
import { applyToEnemy } from "../src/systems/combat/effects.js";

const fixed = (k) => ({ int: () => k });
const types = (events) => events.map((e) => e.type);

function mkData(attacks, ai = "aggressive") {
  const data = minimalData();
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, ai, attacks } : e));
  return data;
}
function mkState() {
  return {
    character: {
      name: "T", classId: "miecz", level: 1, xp: 0,
      attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 },
      skillPoints: {}, tagged: [], perks: [], pendingLevelUp: null, hp: 35, effects: [],
    },
    time: { minutes: 12 * 60 },
    inventory: { items: [], equipped: {}, quickSlots: [], loaded: {} },
  };
}
const club = { name: "Palka", damage: [2, 5], damageType: "obuchowe", apCost: 3, hit: 55 };
const sling = { name: "Proca", damage: [1, 3], damageType: "obuchowe", apCost: 2, hit: 50, range: "far" };
function mk(data, { band = "far", count = 1, ap = 6 } = {}) {
  const state = mkState();
  const combat = createCombat(state, data, { enemies: [{ id: "bandyta", count }], start: band, canFlee: true }, fixed(1));
  for (const e of combat.enemies) e.ap = ap;
  return { state, combat };
}

test("aggressive na dystansie: ruch (2 PA), potem atak w zwarciu (3 PA), reszta PA nie wystarcza", () => {
  const data = mkData([club]);
  const { state, combat } = mk(data);
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(100));
  assert.deepEqual(types(events), ["ruch", "atak"]);
  assert.equal(events[0].band, "melee");
  assert.equal(events[0].mover, "bandyta#1");
  assert.equal(events[1].attacker, "bandyta#1");
  assert.equal(combat.enemies[0].band, "melee");
  assert.equal(combat.enemies[0].ap, 1);
});

test("ranged w zwarciu odskakuje bez darmowego ataku, potem strzela", () => {
  const data = mkData([sling], "ranged");
  const { state, combat } = mk(data, { band: "melee" });
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(100));
  assert.deepEqual(types(events), ["ruch", "atak", "atak"]);
  assert.equal(events[0].band, "far");
  assert.equal(combat.enemies[0].band, "far");
  assert.equal(state.character.hp, 35);
});

test("cautious ucieka przy niskim HP albo morale, a przy zdrowym walczy", () => {
  const data = mkData([club], "cautious");
  const low = mk(data, { band: "melee" });
  low.combat.enemies[0].hp = 5;
  const events = enemyTurn(low.state, data, low.combat, "bandyta#1", fixed(100));
  assert.deepEqual(events, [{ type: "wrog_ucieka", target: "bandyta#1" }]);
  assert.equal(low.combat.enemies[0].fled, true);

  const scared = mk(data, { band: "melee" });
  scared.combat.enemies[0].morale = 20;
  assert.equal(types(enemyTurn(scared.state, data, scared.combat, "bandyta#1", fixed(100)))[0], "wrog_ucieka");

  const ok = mk(data, { band: "melee" });
  assert.equal(types(enemyTurn(ok.state, data, ok.combat, "bandyta#1", fixed(100)))[0], "atak");
  assert.equal(ok.combat.enemies[0].fled, false);
});

test("onAllyDeath obniza morale pozostalych o 20", () => {
  const data = mkData([club]);
  const { combat } = mk(data, { count: 2 });
  combat.enemies[0].dead = true;
  onAllyDeath(data, combat);
  assert.equal(combat.enemies[1].morale, 40);
  assert.equal(combat.enemies[0].morale, 60);
  onAllyDeath(data, combat);
  onAllyDeath(data, combat);
  onAllyDeath(data, combat);
  assert.equal(combat.enemies[1].morale, 0);
});

test("wybor ataku wg wagi 3:1", () => {
  const a = { ...club, name: "A", weight: 3 };
  const b = { ...club, name: "B", weight: 1 };
  const data = mkData([a, b]);
  const pick = (k) => {
    const { state, combat } = mk(data, { band: "melee", ap: 3 });
    const events = enemyTurn(state, data, combat, "bandyta#1", { int: (lo, hi) => (hi === 4 ? k : 100) });
    return events[0].attack;
  };
  assert.deepEqual([1, 2, 3, 4].map(pick), ["A", "A", "A", "B"]);
});

test("wybor ataku pomija zbyt drogie", () => {
  const data = mkData([{ ...club, apCost: 5, weight: 100 }, { ...club, name: "Tani", apCost: 2, weight: 1 }]);
  const { state, combat } = mk(data, { band: "melee", ap: 3 });
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(100));
  assert.deepEqual(events.map((e) => e.attack), ["Tani"]);
});

test("zamroczony wrog trafia o 20 gorzej i ma mniejsza szanse na efekt", () => {
  const fx = { ...club, hit: 90, effects: [{ id: "oslepienie", chance: 50 }] };
  const data = mkData([fx]);
  const roll40 = { int: (lo, hi) => (hi === 100 ? 40 : lo) };
  const run = (dazed) => {
    const { state, combat } = mk(data, { band: "melee", ap: 3 });
    if (dazed) applyToEnemy(data, combat, combat.enemies[0], "zamroczenie", fixed(100));
    const clean = enemyHitChance(state, data, combat, { ...combat.enemies[0], effects: [] }, fx);
    return { events: enemyTurn(state, data, combat, "bandyta#1", roll40), clean };
  };
  const plain = run(false);
  assert.equal(plain.events[0].chance, plain.clean);
  assert.ok(plain.events.some((e) => e.type === "efekt_nalozony" && e.id === "oslepienie"));
  const dazed = run(true);
  assert.equal(dazed.events[0].chance, dazed.clean - 20 - 10); // dazedPenalty plus the zamroczenie hitChance modifier
  assert.equal(dazed.events[0].hit, true);
  assert.ok(!dazed.events.some((e) => e.id === "oslepienie")); // 40 > 50 - 20
});

test("wrog bez ataku w zasiegu i bez ruchu konczy ture bez petli", () => {
  const data = mkData([club]); // aggressive with only a melee attack, far and short on AP for the move
  const { state, combat } = mk(data, { band: "far", ap: 1 });
  assert.deepEqual(enemyTurn(state, data, combat, "bandyta#1", fixed(100)), []);
  const poor = mk(mkData([club]), { band: "far", ap: 1 });
  assert.deepEqual(enemyTurn(poor.state, mkData([club]), poor.combat, "bandyta#1", fixed(100)), []);
});

// --- C2b Task 5: reach, leap, spowolnienie, strzał z bliska ---
import { combatState } from "./helpers.js";
import { addItem, equip } from "../src/systems/inventory.js";

const mkSpear = (data, classId = "wlocznia") => {
  const state = combatState(data, classId);
  state.character.hp = 999;
  return state;
};
function mkFight(data, state, { band = "far", ap = 6, hp = 1000 } = {}) {
  const combat = createCombat(state, data, { enemies: [{ id: "bandyta", count: 1 }], start: band, canFlee: true }, fixed(1));
  combat.enemies[0].ap = ap;
  combat.enemies[0].hp = hp;
  return combat;
}
const slowed = (turns = 2) => ({ id: "spowolnienie", remaining: turns, stacks: 1 });

test("leap: upiór na dystansie wchodzi w zwarcie za 0 PA, raz na turę, i atakuje", () => {
  const data = mkData([club]);
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, leap: true } : e));
  const state = mkState();
  const combat = createCombat(state, data, { enemies: [{ id: "bandyta", count: 1 }], start: "far", canFlee: true }, fixed(1));
  combat.enemies[0].ap = 3;
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(100));
  assert.deepEqual(types(events), ["ruch", "atak"]);
  assert.equal(events[0].leap, true);
  assert.equal(events[0].mover, "bandyta#1");
  assert.equal(events[0].band, "melee");
  assert.equal(combat.enemies[0].ap, 0);
});

test("leap: wróg ranged nie skacze w zwarcie", () => {
  const data = mkData([sling, club], "ranged");
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, leap: true } : e));
  const { state, combat } = mk(data, { band: "far", ap: 6 });
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(100));
  assert.equal(events.filter((e) => e.leap).length, 0); // ranged never leaps in
});

test("spowolniony wróg nie podchodzi i nie skacze", () => {
  const data = mkData([club]);
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, leap: true } : e));
  const { state, combat } = mk(data, { band: "far", ap: 6 });
  combat.enemies[0].effects.push(slowed());
  assert.deepEqual(enemyTurn(state, data, combat, "bandyta#1", fixed(100)), []);
  assert.equal(combat.enemies[0].band, "far");
  const plain = mkData([club]);
  const b = mk(plain, { band: "far", ap: 6 });
  b.combat.enemies[0].effects.push(slowed());
  assert.deepEqual(enemyTurn(b.state, plain, b.combat, "bandyta#1", fixed(100)), []);
});

test("reach: para włóczni – wróg podchodzi, darmowy cios gracza przed atakiem wroga", () => {
  const data = mkData([club]);
  const state = mkSpear(data);
  const combat = mkFight(data, state);
  combat.ready = true; // the reach blow comes only from the stance the player took
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(1));
  assert.deepEqual(types(events).slice(0, 3), ["ruch", "atak", "atak"]);
  assert.equal(events[1].attacker, "player");
  assert.equal(events[1].reaction, true);
  assert.equal(events[1].weapon, "para_wloczni");
  assert.equal(events[2].attacker, "bandyta#1");
  assert.equal(events.filter((e) => e.reaction).length, 1);
});

test("reach: bez gotowości gracza nie ma darmowego ciosu – nic nie dzieje się bez jego wyboru", () => {
  const data = mkData([club]);
  const state = mkSpear(data);
  const combat = mkFight(data, state);
  const hpBefore = combat.enemies[0].hp;
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(1));
  assert.ok(!events.some((e) => e.reaction || e.attacker === "player"));
  assert.equal(combat.enemies[0].hp, hpBefore, "wróg nietknięty");
});

test("reach: jeśli reakcja zabija wroga, jego tura się kończy", () => {
  const data = mkData([club]);
  const state = mkSpear(data);
  const combat = mkFight(data, state, { hp: 1 });
  combat.ready = true;
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(1));
  assert.deepEqual(types(events), ["ruch", "atak", "wrog_pokonany"]);
  assert.equal(events[1].reaction, true);
  assert.equal(combat.enemies[0].dead, true);
});

test("gotowość: brak przy ogłuszonym graczu i po rzucie włóczni, miecz reaguje", () => {
  const data = mkData([club]);
  const stunned = mkSpear(data);
  stunned.character.effects.push({ id: "ogluszenie", remaining: 2, stacks: 1 });
  const c1 = mkFight(data, stunned);
  c1.ready = true;
  assert.ok(!enemyTurn(stunned, data, c1, "bandyta#1", fixed(1)).some((e) => e.reaction));

  const thrown = mkSpear(data);
  const c2 = mkFight(data, thrown);
  c2.ready = true;
  c2.thrown = { uid: "bandyta#1", itemId: "para_wloczni" };
  assert.ok(!enemyTurn(thrown, data, c2, "bandyta#1", fixed(1)).some((e) => e.reaction));

  const sword = mkSpear(data, "miecz");
  const c3 = mkFight(data, sword);
  c3.ready = true;
  assert.ok(enemyTurn(sword, data, c3, "bandyta#1", fixed(1)).some((e) => e.reaction));
});

test("gotowość: także przy leap; miecz + sztylet reaguje tylko z gotowości", () => {
  const data = mkData([club]);
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, leap: true } : e));
  const state = mkSpear(data);
  const combat = mkFight(data, state);
  combat.ready = true; // the reach blow comes only from the stance the player took
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(1));
  assert.deepEqual(types(events).slice(0, 3), ["ruch", "atak", "atak"]);
  assert.equal(events[0].leap, true);
  assert.equal(events[1].reaction, true);

  const dagger = mkSpear(data, "miecz");
  addItem(dagger, data, "sztylet", 1);
  equip(dagger, data, "sztylet", "bron_druga");
  const c2 = mkFight(data, dagger);
  assert.ok(!enemyTurn(dagger, data, c2, "bandyta#1", fixed(1)).some((e) => e.reaction));
  const c3 = mkFight(data, dagger);
  c3.ready = true;
  assert.ok(enemyTurn(dagger, data, c3, "bandyta#1", fixed(1)).some((e) => e.reaction));
});

test("wróg z atakiem far w zwarciu strzela z szansą niższą o rangedInMeleePenalty", () => {
  const data = mkData([sling]); // aggressive, only far attack
  const { state, combat } = mk(data, { band: "melee", ap: 2 });
  const enemy = combat.enemies[0];
  const far = enemyHitChance(state, data, combat, { ...enemy, band: "far" }, { ...sling, range: "far" });
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(100));
  assert.deepEqual(types(events), ["atak"]);
  assert.equal(events[0].chance, far - data.rules.combat.rangedInMeleePenalty);
});

test("ranged w zwarciu z 2 PA strzela (brak PA na odskok + strzał)", () => {
  const data = mkData([sling], "ranged");
  const { state, combat } = mk(data, { band: "melee", ap: 2 });
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(100));
  assert.deepEqual(types(events), ["atak"]);
  assert.equal(combat.enemies[0].band, "melee");
});

test("ranged spowolniony w zwarciu nie odskakuje, tylko strzela", () => {
  const data = mkData([sling], "ranged");
  const { state, combat } = mk(data, { band: "melee", ap: 6 });
  combat.enemies[0].effects.push(slowed());
  const events = enemyTurn(state, data, combat, "bandyta#1", fixed(100));
  assert.ok(!events.some((e) => e.type === "ruch"));
  assert.equal(events.filter((e) => e.type === "atak").length, 3);
});
