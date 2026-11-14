import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData } from "./helpers.js";
import { grantStartKit, addItem, unassignQuick, assignQuick, countOf } from "../src/systems/inventory.js";
import { createCombat } from "../src/systems/combat/state.js";
import { playerHitChance } from "../src/systems/combat/formulas.js";
import { itemById } from "../src/systems/items.js";
import {
  ACTION_IDS, playerActions, attackTargets, useOptions, doAction, resolveEnemyAttack, swapCost,
} from "../src/systems/combat/actions.js";

const data = minimalData();
const fixed = (k) => ({ int: () => k });
/** Returns the listed values in order, then keeps repeating the last one. */
const seq = (values) => { let i = 0; return { int: () => values[Math.min(i++, values.length - 1)] }; };

function mkState() {
  const state = {
    character: {
      name: "T", classId: "miecz", level: 1, xp: 0,
      attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 },
      skillPoints: {}, tagged: ["sieczna"], perks: [], pendingLevelUp: null, hp: 35, effects: [],
    },
    time: { minutes: 12 * 60 },
    inventory: { items: [], equipped: {}, quickSlots: [], loaded: {} },
  };
  grantStartKit(state, data, "miecz");
  return state;
}
function mk(state, { enemies = [{ id: "bandyta", count: 1 }], start = "far", canFlee = true, ap = 6 } = {}) {
  const combat = createCombat(state, data, { enemies, start, canFlee }, fixed(1));
  combat.playerAp = ap;
  return combat;
}
const act = (state, combat, id) => playerActions(state, data, combat).find((a) => a.id === id);
const types = (events) => events.map((e) => e.type);

test("lista akcji ma stałe identyfikatory", () => {
  assert.deepEqual(ACTION_IDS, ["attack", "reload", "use", "swap", "move", "defend", "flee", "end", "log", "techniques"]);
  const state = mkState();
  assert.deepEqual(playerActions(state, data, mk(state)).map((a) => a.id), ACTION_IDS);
});

test("atak mieczem: tylko cele w zwarciu, koszt 3, trafienie i pudło wg szansy", () => {
  const state = mkState();
  const combat = mk(state);
  assert.deepEqual(attackTargets(state, data, combat), []);
  assert.equal(act(state, combat, "attack").disabled, true);
  assert.equal(act(state, combat, "attack").reason, "combat.noTarget");
  assert.deepEqual(doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, fixed(1)), { ok: false, reason: "combat.noTarget" });

  combat.enemies[0].band = "melee";
  assert.deepEqual(attackTargets(state, data, combat), ["bandyta#1"]);
  assert.equal(act(state, combat, "attack").apCost, 3);
  const chance = playerHitChance(state, data, combat, itemById(data, "miecz_krotki"), combat.enemies[0]);

  const hit = doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, fixed(1));
  assert.equal(hit.ok, true);
  assert.equal(hit.endTurn, false);
  assert.equal(combat.playerAp, 3);
  const ev = hit.events.find((e) => e.type === "atak");
  assert.equal(ev.hit, true);
  assert.equal(ev.chance, chance);
  assert.equal(ev.attacker, "player");
  assert.equal(ev.target, "bandyta#1");
  assert.equal(combat.enemies[0].hp, 22 - ev.damage);
  assert.ok(ev.damage >= 1);

  const hpBefore = combat.enemies[0].hp;
  const miss = doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, fixed(100));
  assert.equal(miss.events.find((e) => e.type === "atak").hit, false);
  assert.equal(combat.enemies[0].hp, hpBefore);
  assert.equal(combat.playerAp, 0);
});

test("zabicie wroga: wrog_pokonany i spadek morale pozostałych", () => {
  const state = mkState();
  const combat = mk(state, { enemies: [{ id: "bandyta", count: 2 }] });
  combat.enemies[0].band = "melee";
  combat.enemies[0].hp = 1;
  const r = doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, fixed(1));
  assert.ok(types(r.events).includes("wrog_pokonany"));
  assert.equal(combat.enemies[0].dead, true);
  assert.equal(combat.enemies[1].morale, 60 - data.rules.combat.moraleOnAllyDeath);
});

test("łuk: naładowanie, przeładowanie, strzał zużywa ładunek, brak strzał", () => {
  const state = mkState();
  state.inventory.equipped.bron = "luk_mysliwski";
  addItem(state, data, "luk_mysliwski", 1);
  const combat = mk(state);
  assert.equal(act(state, combat, "attack").reason, "combat.notLoaded");
  assert.equal(act(state, combat, "reload").reason, "combat.noAmmo");
  assert.deepEqual(doAction(state, data, combat, { id: "reload" }, fixed(1)), { ok: false, reason: "combat.noAmmo" });

  addItem(state, data, "strzala", 3);
  assert.equal(act(state, combat, "reload").disabled, false);
  const r = doAction(state, data, combat, { id: "reload" }, fixed(1));
  assert.equal(r.ok, true);
  assert.deepEqual(r.events, [{ type: "przeladowanie", weapon: "luk_mysliwski" }]);
  assert.equal(combat.playerAp, 5);
  assert.equal(state.inventory.loaded.luk_mysliwski, 1);
  assert.equal(countOf(state, "strzala"), 2);
  assert.equal(act(state, combat, "reload").reason, "combat.alreadyLoaded");
  assert.deepEqual(attackTargets(state, data, combat), ["bandyta#1"]);

  const shot = doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, fixed(1));
  assert.equal(shot.ok, true);
  assert.equal(state.inventory.loaded.luk_mysliwski, 0);
  assert.equal(combat.playerAp, 1);
  assert.equal(act(state, combat, "attack").reason, "combat.noAp");
});

test("użycie opatrunku: pas 3 PA, torba 5 PA, leczenie bez upływu czasu", () => {
  const state = mkState();
  state.character.hp = 20;
  const combat = mk(state);
  assert.deepEqual(useOptions(state, data, combat), [{ itemId: "opatrunek", from: "belt", apCost: 3, needsTarget: false }]);
  const minutes = state.time.minutes;
  const r = doAction(state, data, combat, { id: "use", itemId: "opatrunek" }, fixed(4));
  assert.equal(r.ok, true);
  assert.equal(combat.playerAp, 3);
  assert.equal(state.time.minutes, minutes);
  assert.ok(state.character.hp > 20);
  assert.equal(countOf(state, "opatrunek"), 1);
  assert.deepEqual(types(r.events).slice(0, 2), ["uzycie", "leczenie"]);
  assert.equal(r.events[1].amount, state.character.hp - 20);

  unassignQuick(state, "opatrunek");
  assert.deepEqual(useOptions(state, data, combat), [{ itemId: "opatrunek", from: "bag", apCost: 5, needsTarget: false }]);
  assert.deepEqual(doAction(state, data, combat, { id: "use", itemId: "opatrunek" }, fixed(4)), { ok: false, reason: "combat.noAp" });
  combat.playerAp = 5;
  assert.equal(doAction(state, data, combat, { id: "use", itemId: "opatrunek" }, fixed(4)).ok, true);
  assert.equal(combat.playerAp, 0);
  assert.equal(act(state, combat, "use").reason, "combat.nothingToUse");
});

test("użycie bez przedmiotów: nothingToUse; za mało PA: noAp", () => {
  const state = mkState();
  const combat = mk(state, { ap: 2 });
  assert.equal(act(state, combat, "use").reason, "combat.noAp");
  state.inventory.items = state.inventory.items.filter((s) => s.id !== "opatrunek");
  state.inventory.quickSlots = [];
  assert.equal(act(state, combat, "use").reason, "combat.nothingToUse");
});

function withThrowable(state, id) {
  addItem(state, data, id, 1);
  assignQuick(state, data, id);
}

test("garnek huku: ogłusza cel i wrogów w tym samym paśmie, nie inne pasmo", () => {
  const state = mkState();
  withThrowable(state, "garnek_huku");
  const combat = mk(state, { enemies: [{ id: "bandyta", count: 3 }] });
  combat.enemies[2].band = "melee";
  const opt = useOptions(state, data, combat).find((o) => o.itemId === "garnek_huku");
  assert.equal(opt.needsTarget, true);
  assert.deepEqual(doAction(state, data, combat, { id: "use", itemId: "garnek_huku" }, fixed(1)), { ok: false, reason: "combat.noTarget" });
  const r = doAction(state, data, combat, { id: "use", itemId: "garnek_huku", target: "bandyta#1" }, fixed(1));
  assert.equal(r.ok, true);
  assert.equal(combat.playerAp, 3);
  assert.equal(countOf(state, "garnek_huku"), 0);
  assert.equal(state.inventory.quickSlots.includes("garnek_huku"), false);
  assert.equal(combat.enemies[0].effects[0].id, "ogluszenie");
  assert.equal(combat.enemies[1].effects[0].id, "ogluszenie");
  assert.equal(combat.enemies[2].effects.length, 0);
  assert.equal(r.events.filter((e) => e.type === "efekt_nalozony").length, 2);
});

test("rzut chybiony: szansa efektu x0.5, czas -1; wybuch garnka ogłusza też po chybieniu", () => {
  const state = mkState();
  withThrowable(state, "garniec_wapno");
  withThrowable(state, "garnek_huku");
  const combat = mk(state);
  // hit roll 98 misses (not a fumble); effect roll 60 > 90 * 0.5
  const r = doAction(state, data, combat, { id: "use", itemId: "garniec_wapno", target: "bandyta#1" }, seq([98, 60]));
  assert.equal(r.ok, true);
  assert.equal(combat.enemies[0].effects.length, 0);
  // effect roll 40 <= 45: lands with duration 2 - 1
  combat.playerAp = 6;
  addItem(state, data, "garniec_wapno", 1);
  assignQuick(state, data, "garniec_wapno");
  doAction(state, data, combat, { id: "use", itemId: "garniec_wapno", target: "bandyta#1" }, seq([98, 40]));
  assert.equal(combat.enemies[0].effects[0].id, "oslepienie");
  assert.equal(combat.enemies[0].effects[0].remaining, 1);
  // the pot explodes: a miss still stuns at half the chance (70 * 0.5 = 35), for the one turn the stun lasts
  combat.playerAp = 6;
  doAction(state, data, combat, { id: "use", itemId: "garnek_huku", target: "bandyta#1" }, seq([98, 36]));
  assert.equal(combat.enemies[0].effects.some((e) => e.id === "ogluszenie"), false);
  combat.playerAp = 6;
  addItem(state, data, "garnek_huku", 1);
  assignQuick(state, data, "garnek_huku");
  doAction(state, data, combat, { id: "use", itemId: "garnek_huku", target: "bandyta#1" }, seq([98, 35]));
  assert.equal(combat.enemies[0].effects.find((e) => e.id === "ogluszenie").remaining, 1);
});

test("rzut 99 to wpadka: efekty na gracza", () => {
  const state = mkState();
  withThrowable(state, "garnek_huku");
  const combat = mk(state);
  const r = doAction(state, data, combat, { id: "use", itemId: "garnek_huku", target: "bandyta#1" }, fixed(99));
  assert.equal(r.ok, true);
  assert.equal(state.character.effects.some((e) => e.id === "ogluszenie"), true);
  assert.equal(combat.enemies[0].effects.length, 0);
  assert.ok(r.events.some((e) => e.type === "efekt_nalozony" && e.target === "player"));
});

test("świeca dymna: efekt na polu walki bez testu trafienia", () => {
  const state = mkState();
  withThrowable(state, "swieca_dymna");
  const combat = mk(state);
  const opt = useOptions(state, data, combat).find((o) => o.itemId === "swieca_dymna");
  assert.equal(opt.needsTarget, false);
  const r = doAction(state, data, combat, { id: "use", itemId: "swieca_dymna" }, fixed(100));
  assert.equal(r.ok, true);
  assert.equal(combat.battlefield[0].id, "zadymienie");
  assert.equal(combat.battlefield[0].remaining, 3);
  assert.equal(state.character.effects.length, 0);
});

test("obuch pięściami: krytyk ogłusza (<= 50), zwykłe trafienie zamroczenie", () => {
  const state = mkState();
  delete state.inventory.equipped.bron;
  const combat = mk(state, { start: "melee" });
  assert.equal(act(state, combat, "attack").apCost, 2);
  // hit 1, damage 1, crit roll 1 (crit), stun roll 40
  doAction(state, data, combat, { id: "attack", target: "bandyta#1" }, seq([1, 1, 1, 40]));
  assert.equal(combat.enemies[0].effects.some((e) => e.id === "ogluszenie"), true);
  assert.equal(combat.enemies[0].effects.some((e) => e.id === "zamroczenie"), false);

  const other = mk(state, { start: "melee" });
  // hit 1, damage 1, crit roll 100 (none), daze roll 10 <= 15
  doAction(state, data, other, { id: "attack", target: "bandyta#1" }, seq([1, 1, 100, 10]));
  assert.equal(other.enemies[0].effects.some((e) => e.id === "zamroczenie"), true);
  assert.equal(other.enemies[0].effects.some((e) => e.id === "ogluszenie"), false);
  const third = mk(state, { start: "melee" });
  doAction(state, data, third, { id: "attack", target: "bandyta#1" }, seq([1, 1, 100, 90]));
  assert.equal(third.enemies[0].effects.length, 0);
});

test("zmiana broni: swapAp i swapWeapons", () => {
  const state = mkState();
  state.inventory.equipped.bron_zapas = "luk_mysliwski";
  addItem(state, data, "luk_mysliwski", 1);
  const combat = mk(state);
  const r = doAction(state, data, combat, { id: "swap" }, fixed(1));
  assert.equal(r.ok, true);
  assert.deepEqual(r.events, [{ type: "zmiana_broni" }]);
  assert.equal(state.inventory.equipped.bron, "luk_mysliwski");
  assert.equal(combat.playerAp, 5);
});

test("zmiana z bronią dystansową kosztuje 1 PA, w obie strony", () => {
  const state = mkState();
  state.inventory.equipped.bron_zapas = "kusza_lekka";
  addItem(state, data, "kusza_lekka", 1);
  const combat = mk(state);
  assert.equal(data.rules.combat.swapRangedAp, 1);
  assert.equal(swapCost(state, data), 1);
  assert.equal(act(state, combat, "swap").apCost, 1);
  assert.equal(doAction(state, data, combat, { id: "swap" }, fixed(1)).ok, true);
  assert.equal(state.inventory.equipped.bron, "kusza_lekka");
  assert.equal(combat.playerAp, 5);
  assert.equal(act(state, combat, "swap").apCost, 1);
  assert.equal(doAction(state, data, combat, { id: "swap" }, fixed(1)).ok, true);
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(combat.playerAp, 4);
});

test("zmiana dwóch broni białych kosztuje 2 PA", () => {
  const state = mkState();
  state.inventory.equipped.bron_zapas = "para_wloczni";
  addItem(state, data, "para_wloczni", 1);
  const combat = mk(state);
  assert.equal(swapCost(state, data), 2);
  assert.equal(act(state, combat, "swap").apCost, 2);
  assert.equal(doAction(state, data, combat, { id: "swap" }, fixed(1)).ok, true);
  assert.equal(combat.playerAp, 4);
});

test("zbliżenie i odskok; odskok od wroga w zwarciu daje darmowy atak", () => {
  const state = mkState();
  const combat = mk(state);
  const near = doAction(state, data, combat, { id: "move", target: "bandyta#1" }, fixed(1));
  assert.deepEqual(near.events, [{ type: "ruch", mover: "player", target: "bandyta#1", band: "melee" }]);
  assert.equal(combat.enemies[0].band, "melee");
  assert.equal(combat.playerAp, 4);

  const hp = state.character.hp;
  const back = doAction(state, data, combat, { id: "move", target: "bandyta#1" }, fixed(1));
  assert.equal(back.ok, true);
  const atak = back.events.find((e) => e.type === "atak");
  assert.equal(atak.attacker, "bandyta#1");
  assert.equal(atak.target, "player");
  assert.equal(atak.hit, true);
  assert.ok(state.character.hp < hp);
  assert.equal(combat.enemies[0].band, "far");
  assert.ok(back.events.some((e) => e.type === "ruch" && e.band === "far" && e.mover === "player"));
  assert.equal(combat.playerAp, 2);
});

test("obrona nie obniża już wyższej gardy (np. po Uderz i zasłoń)", () => {
  const state = mkState();
  const combat = mk(state, { ap: 4 });
  combat.defendBonus = 35; // e.g. from the guard technique (rules copy: guardBonus above defendPerAp × AP)
  const r = doAction(state, data, combat, { id: "defend" }, fixed(1));
  assert.equal(r.ok, true);
  assert.equal(combat.defendBonus, 35);
  assert.deepEqual(r.events, [{ type: "obrona", bonus: 35 }]);
  const c2 = mk(state, { ap: 4 });
  c2.defendBonus = 5;
  doAction(state, data, c2, { id: "defend" }, fixed(1));
  assert.equal(c2.defendBonus, 20);
});

test("obrona z 4 PA: defendBonus 20, koniec tury", () => {
  const state = mkState();
  const combat = mk(state, { ap: 4 });
  assert.equal(act(state, combat, "defend").apCost, 4);
  const r = doAction(state, data, combat, { id: "defend" }, fixed(1));
  assert.equal(r.ok, true);
  assert.equal(r.endTurn, true);
  assert.equal(combat.defendBonus, 20);
  assert.equal(combat.playerAp, 0);
  assert.deepEqual(r.events, [{ type: "obrona", bonus: 20 }]);
  combat.playerAp = 1;
  assert.equal(act(state, combat, "defend").disabled, false);
  assert.equal(act(state, combat, "defend").apCost, 1);
  combat.playerAp = 0;
  assert.equal(act(state, combat, "defend").reason, "combat.noAp");
});

test("ucieczka: canFlee false wyszarzone; sukces i porażka", () => {
  const state = mkState();
  const locked = mk(state, { canFlee: false });
  assert.equal(act(state, locked, "flee").reason, "combat.noFlee");
  assert.deepEqual(doAction(state, data, locked, { id: "flee" }, fixed(1)), { ok: false, reason: "combat.noFlee" });

  const combat = mk(state);
  assert.equal(act(state, combat, "flee").apCost, 4);
  const fail = doAction(state, data, combat, { id: "flee" }, fixed(100));
  assert.deepEqual([fail.ok, fail.endTurn, combat.outcome], [true, true, null]);
  assert.deepEqual(fail.events, [{ type: "ucieczka", success: false }]);
  const combat2 = mk(state);
  const ok = doAction(state, data, combat2, { id: "flee" }, fixed(1));
  assert.equal(combat2.outcome, "fled");
  assert.deepEqual(ok.events, [{ type: "ucieczka", success: true }]);
});

test("koniec tury i dziennik", () => {
  const state = mkState();
  const combat = mk(state);
  assert.deepEqual(doAction(state, data, combat, { id: "end" }, fixed(1)), { ok: true, events: [], endTurn: true });
  assert.deepEqual(doAction(state, data, combat, { id: "log" }, fixed(1)), { ok: true, events: [], endTurn: false });
  assert.equal(combat.playerAp, 6);
});

test("nieudane akcje nie zmieniają stanu", () => {
  const state = mkState();
  state.inventory.equipped.bron = "luk_mysliwski";
  addItem(state, data, "luk_mysliwski", 1);
  withThrowable(state, "garnek_huku");
  const check = (combat, attempts) => {
    for (const a of attempts) {
      const before = structuredClone({ state, combat });
      const r = doAction(state, data, combat, a, fixed(1));
      assert.equal(r.ok, false, JSON.stringify(a));
      assert.equal(typeof r.reason, "string");
      assert.deepEqual({ state, combat }, before, JSON.stringify(a));
    }
  };
  // low AP: every cost check fails
  check(mk(state, { canFlee: false, ap: 1 }), [
    { id: "attack", target: "bandyta#1" }, { id: "reload" }, { id: "use", itemId: "garnek_huku", target: "bandyta#1" },
    { id: "use", itemId: "opatrunek" }, { id: "move", target: "bandyta#1" }, { id: "flee" },
  ]);
  check(mk(state, { canFlee: false, ap: 0 }), [{ id: "defend" }, { id: "swap" }]);
  // full AP: failures come from the post-listing checks (targets, items), not from the AP check
  check(mk(state, { canFlee: false, ap: 6 }), [
    { id: "attack", target: "bandyta#1" }, // unloaded bow
    { id: "reload" }, // no ammo
    { id: "move", target: "nikt#9" },
    { id: "move" },
    { id: "use", itemId: "garnek_huku" }, // throwable without a target
    { id: "use", itemId: "garnek_huku", target: "nikt#9" },
    { id: "use", itemId: "nie_ma" },
    { id: "flee" },
  ]);
  state.inventory.loaded.luk_mysliwski = 1;
  check(mk(state, { ap: 6 }), [{ id: "attack", target: "nikt#9" }]);
  assert.throws(() => doAction(state, data, mk(state), { id: "bogus" }, fixed(1)), /nieznana akcja/);
});

test("odskok od ogłuszonego wroga nie daje darmowego ataku", () => {
  const state = mkState();
  const combat = mk(state, { start: "melee" });
  combat.enemies[0].effects.push({ id: "ogluszenie", remaining: 1, stacks: 1 });
  const hp = state.character.hp;
  const r = doAction(state, data, combat, { id: "move", target: "bandyta#1" }, fixed(1));
  assert.equal(r.ok, true);
  assert.deepEqual(types(r.events), ["ruch"]);
  assert.equal(state.character.hp, hp);
});

test("rzucany all_enemies: bez celu, trafia każdego wroga", () => {
  const local = minimalData();
  local.items.push({ ...local.items.find((i) => i.id === "garniec_wapno"), id: "wielki_garniec", target: "all_enemies" });
  const state = mkState();
  addItem(state, local, "wielki_garniec", 1);
  assignQuick(state, local, "wielki_garniec");
  const combat = createCombat(state, local, { enemies: [{ id: "bandyta", count: 2 }], start: "far" }, fixed(1));
  combat.playerAp = 6;
  assert.equal(useOptions(state, local, combat).find((o) => o.itemId === "wielki_garniec").needsTarget, false);
  const r = doAction(state, local, combat, { id: "use", itemId: "wielki_garniec" }, fixed(1));
  assert.equal(r.ok, true);
  assert.ok(combat.enemies.every((e) => e.effects.some((x) => x.id === "oslepienie")));
});

test("rzut chybiony nie skraca efektu, który wróg już miał", () => {
  const state = mkState();
  withThrowable(state, "garniec_wapno");
  const combat = mk(state);
  combat.enemies[0].effects.push({ id: "oslepienie", remaining: 2, stacks: 1 });
  doAction(state, data, combat, { id: "use", itemId: "garniec_wapno", target: "bandyta#1" }, seq([98, 40]));
  assert.equal(combat.enemies[0].effects[0].remaining, 2);
});

test("resolveEnemyAttack: trafienie zadaje obrażenia, pudło nie, efekty z ataku", () => {
  const state = mkState();
  const combat = mk(state, { start: "melee" });
  const attack = data.enemies.find((e) => e.id === "bandyta").attacks[0];
  const hp = state.character.hp;
  const hit = resolveEnemyAttack(state, data, combat, "bandyta#1", attack, fixed(1));
  const ev = hit.find((e) => e.type === "atak");
  assert.deepEqual([ev.attacker, ev.target, ev.hit, ev.crit], ["bandyta#1", "player", true, false]);
  assert.equal(state.character.hp, hp - ev.damage);
  assert.ok(types(hit).includes("efekt_nalozony") || types(hit).includes("efekt_odparty"));
  const hp2 = state.character.hp;
  const miss = resolveEnemyAttack(state, data, combat, "bandyta#1", attack, fixed(100));
  assert.equal(miss.find((e) => e.type === "atak").hit, false);
  assert.equal(state.character.hp, hp2);
});

test("wyszarzone akcje: broń bez przeładowania i zmiana bez broni mają własne powody", () => {
  const state = mkState();
  const combat = mk(state);
  assert.equal(act(state, combat, "reload").reason, "combat.noReload");
  assert.deepEqual(doAction(state, data, combat, { id: "reload" }, fixed(1)), { ok: false, reason: "combat.noReload" });
  delete state.inventory.equipped.bron;
  delete state.inventory.equipped.bron_zapas;
  assert.equal(act(state, combat, "swap").reason, "combat.nothingToSwap");
  assert.equal(data.ui["combat.noReload"], "Ta broń się nie przeładowuje.");
  assert.equal(data.ui["combat.nothingToSwap"], "Nie masz broni na zmianę.");
});

test("rzut: zdarzenie uzycie niesie hit/fumble (chybienie, wpadka)", () => {
  const state = mkState();
  withThrowable(state, "garniec_wapno");
  const combat = mk(state);
  const miss = doAction(state, data, combat, { id: "use", itemId: "garniec_wapno", target: "bandyta#1" }, seq([98, 100]));
  assert.equal(miss.events[0].hit, false);
  assert.equal(miss.events[0].fumble, undefined);
  withThrowable(state, "garniec_wapno");
  combat.playerAp = 6;
  const fumble = doAction(state, data, combat, { id: "use", itemId: "garniec_wapno", target: "bandyta#1" }, fixed(99));
  assert.equal(fumble.events[0].fumble, true);
});

test("spowolniony gracz: ruch wyszarzony z combat.slowed i odrzucony bez zmiany stanu", () => {
  const state = mkState();
  const combat = mk(state);
  state.character.effects.push({ id: "spowolnienie", remaining: 2, stacks: 1 });
  const entry = act(state, combat, "move");
  assert.equal(entry.disabled, true);
  assert.equal(entry.reason, "combat.slowed");
  const ap = combat.playerAp;
  assert.deepEqual(doAction(state, data, combat, { id: "move", target: "bandyta#1" }, fixed(1)), { ok: false, reason: "combat.slowed" });
  assert.equal(combat.playerAp, ap);
  assert.equal(combat.enemies[0].band, "far");
  assert.ok(data.ui["combat.slowed"]);
});

test("D2a: jedzenie bez leczenia nie jest do użycia w walce; zioła leśne są", () => {
  const state = mkState();
  state.inventory.items = state.inventory.items.filter((s) => s.id !== "opatrunek");
  state.inventory.quickSlots = [];
  addItem(state, data, "jagody", 2);
  const combat = mk(state);
  assert.deepEqual(useOptions(state, data, combat), []);
  assert.equal(act(state, combat, "use").reason, "combat.nothingToUse");
  assert.deepEqual(doAction(state, data, combat, { id: "use", itemId: "jagody" }, fixed(1)), { ok: false, reason: "combat.nothingToUse" });
  addItem(state, data, "ziola_lesne", 1);
  assert.deepEqual(useOptions(state, data, combat).map((o) => o.itemId), ["ziola_lesne"]);
});
