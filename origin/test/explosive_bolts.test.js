import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { itemById } from "../src/systems/items.js";
import { createCombat } from "../src/systems/combat/state.js";
import { strike } from "../src/systems/combat/strike.js";
import { explode } from "../src/systems/combat/explosive.js";
import { applyMasteryGrowth } from "../src/systems/combat/mastery.js";
import { doRetreatShot } from "../src/systems/combat/retreat_shot.js";
import { combatEventText } from "../src/ui/events.js";

const data = minimalData();
const kusza = itemById(data, "kusza_lekka");
const fixed = (k) => ({ int: () => k });

/** Percent rolls (1–100) come from `rolls`, then `rest`; every other range gives its low end (bolt 8, fragment 4, self 4). */
const mkRng = (rolls, rest = 100) => {
  let i = 0;
  return { int: (lo, hi) => (lo === 1 && hi === 100 ? (i < rolls.length ? rolls[i++] : rest) : lo) };
};

/** Hero with a light crossbow in hand, loaded with one `ammo` bolt; `enemies` are the combat groups, all on `far`. */
function setup(ammo, enemies = [{ id: "bandyta", count: 3 }]) {
  const state = combatState(data, "miecz");
  addItem(state, data, "kusza_lekka", 1);
  assert.equal(equip(state, data, "kusza_lekka", "bron").ok, true);
  state.character.hp = 100;
  state.inventory.loaded = { kusza_lekka: 1 };
  state.inventory.loadedAmmo = { kusza_lekka: ammo };
  const combat = createCombat(state, data, { id: "walka_t", enemies, start: "far", canFlee: true }, fixed(1));
  combat.playerAp = 10;
  return { state, combat, e: combat.enemies };
}
const shoot = (s, target, rng) => strike(s.state, data, s.combat, { weapon: kusza, target, rng });
const boom = (events) => events.find((ev) => ev.type === "wybuch");

test("wzmocniony: +1 do obrażeń", () => {
  const plain = setup("belt");
  const strong = setup("belt_wzmocniony");
  const a = shoot(plain, plain.e[0], mkRng([1]))[0];
  const b = shoot(strong, strong.e[0], mkRng([1]))[0];
  assert.equal(a.hit, true);
  assert.equal(b.damage, a.damage + 1);
  assert.deepEqual(strong.e.slice(1).map((e) => e.hp), [22, 22], "wzmocniony nie wybucha");
});

test("trafienie wybuchowym rani wrogów w tej samej strefie i nie rani odległych", () => {
  const s = setup("belt_wybuchowy");
  const [target, near, away] = s.e;
  away.band = "melee";
  const plain = setup("belt");
  const events = shoot(s, target, mkRng([1]));
  const hit = events[0];
  assert.equal(hit.damage, shoot(plain, plain.e[0], mkRng([1]))[0].damage + 1, "wybuchowy zachowuje +1");
  assert.equal(target.hp, 22 - hit.damage, "cel nie dostaje odłamka po trafieniu");
  assert.equal(near.hp, 22 - 4);
  assert.equal(away.hp, 22);
  assert.deepEqual(boom(events), { type: "wybuch", hit: true, victims: [{ target: near.uid, damage: 4 }], selfDamage: 0 });
  assert.equal(s.state.character.hp, 100);
});

test("odłamki liczą pancerz i mogą spowolnić", () => {
  const s = setup("belt_wybuchowy", [{ id: "bandyta", count: 1 }, { id: "dzik", count: 1 }]);
  const [target, dzik] = s.e;
  const events = explode(s.state, data, s.combat, target, { hit: true, weapon: kusza }, mkRng([], 1));
  assert.equal(dzik.hp, 30 - 2, "4 odłamka − pancerz 2");
  assert.ok(dzik.effects.some((fx) => fx.id === "spowolnienie"));
  assert.ok(events.some((ev) => ev.type === "efekt_nalozony" && ev.id === "spowolnienie" && ev.target === dzik.uid));
  // slow roll 31 > slowChance 30: no slow
  const t = setup("belt_wybuchowy", [{ id: "bandyta", count: 2 }]);
  explode(t.state, data, t.combat, t.e[0], { hit: true, weapon: kusza }, mkRng([31]));
  assert.equal(t.e[1].effects.length, 0);
  assert.equal(data.rules.combat.explosive.slowChance, 30);
});

test("pudło: połowa szans, same odłamki, sam cel też obrywa odłamkiem", () => {
  // miss (100), burst roll 50 <= 50
  const s = setup("belt_wybuchowy");
  const [target, near, away] = s.e;
  away.band = "melee";
  const events = shoot(s, target, mkRng([100, 50]));
  assert.equal(events[0].hit, false);
  assert.equal(target.hp, 22 - 4);
  assert.equal(near.hp, 22 - 4);
  assert.equal(away.hp, 22);
  assert.deepEqual(boom(events).victims.map((v) => v.target), [target.uid, near.uid]);
  assert.equal(boom(events).hit, false);
  // miss, burst roll 51: the bolt does not go off
  const t = setup("belt_wybuchowy");
  const quiet = shoot(t, t.e[0], mkRng([100, 51]));
  assert.equal(boom(quiet), undefined);
  assert.deepEqual(t.e.map((e) => e.hp), [22, 22, 22]);
});

test("cel w zwarciu: odłamki ranią bohatera", () => {
  const s = setup("belt_wybuchowy");
  const [target, near, away] = s.e;
  target.band = "melee"; near.band = "melee";
  const events = shoot(s, target, mkRng([1]));
  assert.equal(near.hp, 22 - 4);
  assert.equal(away.hp, 22);
  assert.equal(s.state.character.hp, 100 - 4);
  assert.equal(boom(events).selfDamage, 4);
  // a miss in melee that goes off hurts the hero too
  const t = setup("belt_wybuchowy");
  t.e[0].band = "melee";
  shoot(t, t.e[0], mkRng([100, 1]));
  assert.equal(t.state.character.hp, 96);
});

test("cel na dystansie: bohater bez obrażeń", () => {
  const s = setup("belt_wybuchowy");
  s.e[2].band = "melee";
  const events = shoot(s, s.e[0], mkRng([1]));
  assert.equal(boom(events).selfDamage, 0);
  assert.equal(s.state.character.hp, 100);
  assert.equal(s.e[2].hp, 22);
});

test("po śmierci celu odłamki i tak lecą, a zabicie odłamkiem daje biegłość kuszy", () => {
  const s = setup("belt_wybuchowy");
  const [target, near, other] = s.e;
  target.hp = 1; near.hp = 3;
  const events = shoot(s, target, mkRng([1]));
  assert.equal(target.dead, true);
  assert.equal(near.dead, true);
  assert.equal(other.hp, 22 - 4);
  assert.equal(near.killedBy, "kusza");
  const downs = events.filter((ev) => ev.type === "wrog_pokonany").map((ev) => ev.target);
  assert.deepEqual(downs, [target.uid, near.uid]);
  const before = s.state.character.mastery?.kusza ?? 0;
  applyMasteryGrowth(s.state, data, [near]);
  assert.ok(s.state.character.mastery.kusza > before);
});

test("po strzale wpis loadedAmmo znika", () => {
  const s = setup("belt_wybuchowy");
  shoot(s, s.e[0], mkRng([1]));
  assert.equal(s.state.inventory.loaded.kusza_lekka, 0);
  assert.equal("kusza_lekka" in s.state.inventory.loadedAmmo, false);
  const t = setup("belt_wzmocniony");
  shoot(t, t.e[0], mkRng([100]));
  assert.equal("kusza_lekka" in t.state.inventory.loadedAmmo, false, "pudło też zużywa bełt");
});

test("odskok ze strzałem wybuchowym działa jak zwykły strzał: cel odchodzi na dystans, bohater cały", () => {
  const state = combatState(data, "miecz");
  const main = state.inventory.equipped.bron;
  const spare = Object.values(data.items).find((i) => i.retreatShotAp && i.reload?.ammo === "belt");
  assert.ok(spare, "kusza z odskokiem w danych");
  addItem(state, data, spare.id, 1);
  assert.equal(equip(state, data, spare.id, "bron_zapas").ok, true);
  state.character.hp = 100;
  state.inventory.loaded = { [spare.id]: 1 };
  state.inventory.loadedAmmo = { [spare.id]: "belt_wybuchowy" };
  const combat = createCombat(state, data, { id: "walka_t", enemies: [{ id: "bandyta", count: 3 }], start: "far", canFlee: true }, fixed(1));
  combat.playerAp = 10;
  const [target, near, away] = combat.enemies;
  target.band = "melee"; away.band = "melee";
  target.effects.push({ id: "ogluszenie", remaining: 1 }); // no free attack
  const events = doRetreatShot(state, data, combat, target.uid, mkRng([1]));
  assert.equal(target.band, "far");
  assert.equal(near.hp, 22 - 4);
  assert.equal(away.hp, 22);
  assert.equal(state.character.hp, 100);
  assert.equal(boom(events).selfDamage, 0);
  assert.equal(spare.id in state.inventory.loadedAmmo, false);
  assert.equal(state.inventory.equipped.bron, main);
});

test("zdarzenie wybuch ma tekst w dzienniku", () => {
  const s = setup("belt_wybuchowy");
  const [target, near] = s.e;
  const hit = combatEventText(data.ui, data, s.combat, { type: "wybuch", hit: true, victims: [{ target: near.uid, damage: 4 }], selfDamage: 0 });
  assert.match(hit, /Bandyt/);
  assert.match(hit, /4/);
  const miss = combatEventText(data.ui, data, s.combat, { type: "wybuch", hit: false, victims: [{ target: target.uid, damage: 4 }], selfDamage: 5 });
  assert.match(miss, /5/);
  assert.notEqual(miss, hit);
  const empty = combatEventText(data.ui, data, s.combat, { type: "wybuch", hit: false, victims: [], selfDamage: 0 });
  assert.equal(typeof empty, "string");
});

test("wybuch w dzienniku: kto dostał 0, tego nie ma; same zera to osobna linia", () => {
  const s = setup("belt_wybuchowy");
  const [, near, other] = s.e;
  const text = (victims) => combatEventText(data.ui, data, s.combat, { type: "wybuch", hit: true, victims, selfDamage: 0 });
  const some = text([{ target: near.uid, damage: 0 }, { target: other.uid, damage: 3 }]);
  assert.doesNotMatch(some, /za 0/);
  assert.match(some, /za 3/);
  const none = text([{ target: near.uid, damage: 0 }, { target: other.uid, damage: 0 }]);
  assert.doesNotMatch(none, /za 0/);
  assert.ok(none.includes(data.ui["combat.blastNoHarm"]), none);
  assert.ok(!none.includes(data.ui["combat.blastNobody"]));
  assert.ok(text([]).includes(data.ui["combat.blastNobody"]));
});
