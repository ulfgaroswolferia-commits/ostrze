import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, equip, countOf } from "../src/systems/inventory.js";
import { createCombat } from "../src/systems/combat/state.js";
import { doAction } from "../src/systems/combat/actions.js";
import { techniqueActions, techniqueTargets } from "../src/systems/combat/techniques.js";
import { retreatShotOption } from "../src/systems/combat/retreat_shot.js";
import { beginTurn, endTurn, runEnemyTurns } from "../src/systems/combat/turn.js";
import { playerHitChance } from "../src/systems/combat/formulas.js";
import { applyToEnemy } from "../src/systems/combat/effects.js";
import { itemById } from "../src/systems/items.js";
import { createRng } from "../src/engine/dice.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { createNewState } from "../src/engine/state.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { setColorsEnabled } from "../src/ui/colors.js";

const data = minimalData();
const fixed = (k) => ({ int: () => k });
/** Every call (any range) takes the next value; the last one repeats. */
const seq = (values) => {
  let i = 0;
  return { int: () => values[Math.min(i++, values.length - 1)] };
};
const low = { int: (lo) => lo };

/** Class `classId` with `spare` loaded in the spare slot, `count` bandits in melee, `ap` AP, plenty of HP. */
function setup({ classId = "miecz", spare = "pistolet_skalkowy", count = 2, ap = 7 } = {}) {
  const state = combatState(data, classId);
  state.character.hp = 100;
  addItem(state, data, spare, 1);
  assert.equal(equip(state, data, spare, "bron_zapas").ok, true);
  state.inventory.loaded = { [spare]: 1 };
  const combat = createCombat(state, data, { id: "walka_t", enemies: [{ id: "bandyta", count }], start: "melee", canFlee: true }, fixed(1));
  combat.playerAp = ap;
  return { state, combat, enemy: combat.enemies[0] };
}
const odskok = (state, combat, rng, target = "bandyta#1") => doAction(state, data, combat, { id: "odskok", target }, rng);
const types = (events) => events.map((e) => e.type);

test("pełny przebieg: 5 PA, wróg na dystansie, miecz w ręku, pistolet pusty", () => {
  const { state, combat, enemy } = setup();
  const r = odskok(state, combat, fixed(100));
  assert.equal(r.ok, true);
  assert.equal(r.endTurn, false);
  assert.equal(combat.playerAp, 2);
  assert.equal(enemy.band, "far");
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(state.inventory.equipped.bron_zapas, "pistolet_skalkowy");
  assert.equal(state.inventory.loaded.pistolet_skalkowy, 0);
  // free attack, step back, shot, fear, smoke (pistol smoke 100%); no weapon swap events
  assert.deepEqual(types(r.events), ["atak", "ruch", "atak", "strach_bronia", "dym"]);
  assert.equal(r.events[0].attacker, "bandyta#1");
  assert.deepEqual(r.events[1], { type: "ruch", mover: "player", target: "bandyta#1", band: "far" });
  assert.equal(r.events[2].weapon, "pistolet_skalkowy");
});

test("rusznica kosztuje 6 PA", () => {
  const { state, combat } = setup({ spare: "rusznica" });
  assert.equal(techniqueActions(state, data, combat).find((a) => a.id === "odskok").apCost, 6);
  const r = odskok(state, combat, fixed(100));
  assert.equal(r.ok, true);
  assert.equal(combat.playerAp, 1);
});

test("darmowy atak: atakuje tylko wskazany, ogłuszony nie atakuje", () => {
  const { state, combat } = setup();
  const r = odskok(state, combat, fixed(100));
  assert.deepEqual(r.events.filter((e) => e.type === "atak" && e.attacker !== "player").map((e) => e.attacker), ["bandyta#1"]);

  const stunned = setup();
  applyToEnemy(data, stunned.combat, stunned.enemy, "ogluszenie", fixed(1));
  assert.ok(stunned.enemy.effects.some((e) => e.id === "ogluszenie"));
  const r2 = odskok(stunned.state, stunned.combat, fixed(100));
  assert.equal(r2.ok, true);
  assert.equal(types(r2.events)[0], "ruch");
  assert.equal(r2.events.filter((e) => e.type === "atak" && e.attacker !== "player").length, 0);
  assert.equal(r2.events.filter((e) => e.type === "atak" && e.attacker === "player").length, 1);
});

test("pozostali wrogowie zostają w zwarciu", () => {
  const { state, combat } = setup({ count: 3 });
  odskok(state, combat, fixed(100), "bandyta#2");
  assert.deepEqual(combat.enemies.map((e) => e.band), ["melee", "far", "melee"]);
});

test("cel tylko z wrogów w zwarciu", () => {
  const { state, combat } = setup();
  combat.enemies[1].band = "far";
  assert.deepEqual(techniqueTargets(state, data, combat, "odskok"), ["bandyta#1"]);
  assert.deepEqual(odskok(state, combat, fixed(100), "bandyta#2"), { ok: false, reason: "combat.noTarget" });
  assert.equal(combat.playerAp, 7);
});

test("modyfikatory broni z zapasu działają przy strzale", () => {
  const chances = {};
  for (const id of ["pistolet_skalkowy", "pistolet_skalkowy_u1"]) {
    const { state, combat } = setup({ spare: id });
    const r = odskok(state, combat, fixed(100));
    assert.equal(r.ok, true);
    chances[id] = r.events.find((e) => e.type === "atak" && e.attacker === "player").chance;
  }
  assert.equal(chances.pistolet_skalkowy_u1, chances.pistolet_skalkowy + 5);
});

test("lekka kusza używa bliskiej premii mimo dystansu", () => {
  const { state, combat, enemy } = setup({ spare: "kusza_lekka" });
  const kusza = itemById(data, "kusza_lekka");
  const r = odskok(state, combat, fixed(100));
  assert.equal(r.ok, true);
  const shot = r.events.find((e) => e.type === "atak" && e.attacker === "player");
  const close = playerHitChance(state, data, combat, kusza, enemy, { pointBlank: true });
  const far = playerHitChance(state, data, combat, kusza, enemy);
  assert.equal(close, far + kusza.hitClose - kusza.hitFar);
  assert.equal(enemy.band, "far");
  assert.equal(shot.chance, close);
  assert.equal(state.inventory.loaded.kusza_lekka, 0);
});

test("gracz ginie od darmowego ataku: brak strzału, pistolet dalej załadowany", () => {
  const { state, combat, enemy } = setup();
  state.character.hp = 1;
  const r = odskok(state, combat, low);
  assert.equal(r.ok, true);
  assert.equal(state.character.hp <= 0, true);
  assert.equal(combat.playerAp, 2, "akcja kosztuje PA także wtedy");
  assert.equal(enemy.band, "melee");
  assert.equal(r.events.filter((e) => e.type === "atak" && e.attacker === "player").length, 0);
  assert.equal(state.inventory.loaded.pistolet_skalkowy, 1);
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(state.inventory.equipped.bron_zapas, "pistolet_skalkowy");
});

test("rozerwanie lufy: w ręku miecz, zapas pusty, pistoletu nie ma", () => {
  const { state, combat } = setup();
  const r = odskok(state, combat, seq([100, 1, 1, 1])); // enemy misses, misfire, burst, burst damage
  assert.deepEqual(types(r.events), ["atak", "ruch", "niewypal", "rozerwanie"]);
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(state.inventory.equipped.bron_zapas, undefined);
  assert.equal(countOf(state, "pistolet_skalkowy"), 0);
});

test("strzał zabija cel: wróg pokonany na dystansie, miecz wraca do ręki, kusza pusta", () => {
  const { state, combat, enemy } = setup({ spare: "kusza_lekka" });
  enemy.hp = 1;
  const r = odskok(state, combat, low); // free attack hits (hp 100), the bolt hits for its low end
  assert.equal(r.ok, true);
  assert.equal(enemy.dead, true);
  assert.equal(enemy.band, "far");
  assert.ok(r.events.some((e) => e.type === "wrog_pokonany" && e.target === enemy.uid));
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(state.inventory.equipped.bron_zapas, "kusza_lekka");
  assert.equal(state.inventory.loaded.kusza_lekka, 0);
  assert.equal(combat.playerAp, 7 - itemById(data, "kusza_lekka").retreatShotAp);
  assert.ok(state.character.hp > 0);
});

test("rozerwanie lufy przy odskoku zabija bohatera: pistoletu nie ma, miecz w ręku", () => {
  const { state, combat } = setup();
  state.character.hp = 1;
  const r = odskok(state, combat, seq([100, 1, 1, 1])); // enemy misses, misfire, burst, burst damage
  assert.equal(r.ok, true);
  assert.deepEqual(types(r.events), ["atak", "ruch", "niewypal", "rozerwanie"]);
  assert.ok(state.character.hp <= 0);
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(state.inventory.equipped.bron_zapas, undefined);
  assert.equal(countOf(state, "pistolet_skalkowy"), 0);
  assert.equal("pistolet_skalkowy" in state.inventory.loaded, false, "ładunek rozerwanego pistoletu znika");
});

test("pięści: bron pusta przed i po, pistolet w zapasie", () => {
  const { state, combat } = setup();
  delete state.inventory.equipped.bron;
  const r = odskok(state, combat, fixed(100));
  assert.equal(r.ok, true);
  assert.equal(state.inventory.equipped.bron, undefined);
  assert.equal(state.inventory.equipped.bron_zapas, "pistolet_skalkowy");
  assert.equal(state.inventory.loaded.pistolet_skalkowy, 0);
});

test("para włóczni wraca do ręki, a drugiej ręki to nie rusza", () => {
  const spears = setup({ classId: "wlocznia" });
  assert.equal(odskok(spears.state, spears.combat, fixed(100)).ok, true);
  assert.equal(spears.state.inventory.equipped.bron, "para_wloczni");
  assert.equal(spears.state.inventory.equipped.bron_zapas, "pistolet_skalkowy");
  assert.equal(spears.state.inventory.equipped.bron_druga, undefined);

  const sword = setup();
  addItem(sword.state, data, "sztylet", 1);
  assert.equal(equip(sword.state, data, "sztylet", "bron_druga").ok, true);
  assert.equal(odskok(sword.state, sword.combat, fixed(100)).ok, true);
  assert.equal(sword.state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(sword.state.inventory.equipped.bron_druga, "sztylet");
});

test("rzucona broń nie blokuje akcji", () => {
  const { state, combat } = setup();
  combat.thrown = { uid: "bandyta#2", itemId: "sztylet" };
  assert.equal(odskok(state, combat, fixed(100)).ok, true);
});

test("wrogowie wracają przez gotowość: darmowy cios przy wejściu", () => {
  const { state, combat } = setup({ count: 1 });
  state.character.hp = 999;
  beginTurn(state, data, combat, fixed(1));
  combat.playerAp = 7;
  assert.equal(odskok(state, combat, fixed(100)).ok, true);
  assert.equal(combat.enemies[0].band, "far");
  assert.equal(doAction(state, data, combat, { id: "ready" }, fixed(1)).ok, true);
  endTurn(state, data, combat);
  const events = runEnemyTurns(state, data, combat, createRng(5));
  const reaction = events.filter((e) => e.type === "atak" && e.attacker === "player");
  assert.equal(reaction.length, 1);
  assert.equal(reaction[0].reaction, true);
  assert.equal(reaction[0].weapon, "miecz_krotki");
});

test("brak dostępu z powodu", () => {
  const reasonOf = (s) => retreatShotOption(s.state, data, s.combat)?.reason;
  const refused = (s, reason) => {
    assert.deepEqual(odskok(s.state, s.combat, fixed(100)), { ok: false, reason });
    assert.equal(s.combat.playerAp, s.ap ?? 7, "nic nie wydano");
  };
  const ok = setup();
  assert.deepEqual(retreatShotOption(ok.state, data, ok.combat), { apCost: 5 });

  const empty = setup();
  empty.state.inventory.loaded.pistolet_skalkowy = 0;
  assert.equal(reasonOf(empty), "combat.notLoaded");
  refused(empty, "combat.notLoaded");

  const bow = setup({ spare: "luk_mysliwski" });
  assert.equal(retreatShotOption(bow.state, data, bow.combat), null);
  assert.equal(techniqueActions(bow.state, data, bow.combat).some((a) => a.id === "odskok"), false);

  const far = setup();
  far.combat.enemies.forEach((e) => { e.band = "far"; });
  assert.equal(reasonOf(far), "combat.noTarget");

  const slowed = setup();
  slowed.state.character.effects = [{ id: "spowolnienie", remaining: 2 }];
  assert.equal(reasonOf(slowed), "combat.slowed");
  refused(slowed, "combat.slowed");

  const poor = setup({ ap: 4 });
  assert.equal(reasonOf(poor), "combat.noAp");
  refused({ ...poor, ap: 4 }, "combat.noAp");
  assert.equal(reasonOf(setup({ spare: "rusznica", ap: 5 })), "combat.noAp");

  const blocked = setup();
  blocked.state.world = { phenomenon: { id: "mgla_ciszy", started: true } };
  assert.equal(reasonOf(blocked), "combat.blockedByPhenomenon");
  refused(blocked, "combat.blockedByPhenomenon");
});

test("prawdziwy ekran walki: menu technik z kosztem, wybór celu, dziennik, a potem wrogowie i gotowość", async () => {
  setColorsEnabled(false);
  const sturdy = minimalData();
  sturdy.enemies = sturdy.enemies.map((e) => (e.id === "bandyta" ? { ...e, hp: 100, initiative: 0, attacks: [{ ...e.attacks[0], effects: [], damage: [1, 1] }] } : e));
  const state = createNewState({ seed: 1, startScene: "x", rules: sturdy.rules });
  const cs = combatState(sturdy, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  addItem(state, sturdy, "pistolet_skalkowy", 1);
  equip(state, sturdy, "pistolet_skalkowy", "bron_zapas");
  state.inventory.loaded = { pistolet_skalkowy: 1 };
  // "t" opens the techniques, "6" is the retreat shot (after dual, guard, throw, pickup, ready), "1" the first of two foes in melee, "l" the journal with the whole sequence
  const io = createScriptedIO(["t", "6", "1", "l"], { tty: false });
  const ctx = { state, data: sturdy, io, rng: fixed(100), debug: false, notices: [] };
  await assert.rejects(defaultHandlers.combat(ctx, { id: "x", type: "combat", enemies: [{ id: "bandyta", count: 2 }], start: "melee" }), InputExhaustedError);
  const out = io.text();
  assert.match(out, /Odskok ze strzałem \(5 PA\)/);
  assert.match(out, /Wybierz cel/);
  assert.match(out, /Odskakujesz, trzymając Bandyt[ęy]? 1 na dystans\./);
  // the journal: free attack, step, shot, bang
  assert.match(out, /Bandyta 1 chybia\.\n.*Odskakujesz.*\n.*Chybiasz\.\n.*Huk wystrzału/);
  assert.match(out, /Huk wystrzału płoszy wrogów/);
  const aps = [...out.matchAll(/PA [●○]+ \((\d+)\/\d+\)/g)].map((m) => Number(m[1]));
  assert.equal(aps.at(-1), aps[0] - 5, aps.join(","));
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(state.inventory.equipped.bron_zapas, "pistolet_skalkowy");
});
