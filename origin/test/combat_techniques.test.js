import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, equip, countOf } from "../src/systems/inventory.js";
import { createCombat } from "../src/systems/combat/state.js";
import { finishCombat } from "../src/systems/combat/turn.js";
import { playerHitChance } from "../src/systems/combat/formulas.js";
import { playerActions, doAction } from "../src/systems/combat/actions.js";
import { TECHNIQUE_IDS, dualState, techniqueActions, zoneActions, doTechnique } from "../src/systems/combat/techniques.js";
import { itemById } from "../src/systems/items.js";
import { zoneItems } from "../src/ui/combat_screen.js";
import { createRng } from "../src/engine/dice.js";

const data = minimalData();
const fixed = (k) => ({ int: () => k });
/** Percent rolls (1–100) come from `rolls` (the last repeats); every other range gives its low (or high) end. */
const mkRng = (rolls, mode = "lo") => {
  let i = 0;
  return { int: (lo, hi) => (lo === 1 && hi === 100 ? rolls[Math.min(i++, rolls.length - 1)] : mode === "lo" ? lo : hi) };
};
const it = (id) => itemById(data, id);

/** Level-1 state of `classId` with lots of HP; `extra` items are added, `[slot, id]` pairs equipped. */
function mkState(classId, equipped = []) {
  const state = combatState(data, classId);
  state.character.hp = 999;
  for (const [slot, id] of equipped) {
    addItem(state, data, id, 1);
    const r = equip(state, data, id, slot);
    assert.equal(r.ok, true, `${id} -> ${slot}`);
  }
  return state;
}
function mkCombat(state, { enemies = [{ id: "bandyta", count: 1 }], start = "melee", ap = 8, d = data, ...def } = {}) {
  const combat = createCombat(state, d, { id: "walka_t", enemies, start, canFlee: true, ...def }, fixed(1));
  combat.playerAp = ap;
  return combat;
}
const tech = (state, combat, id, d = data) => techniqueActions(state, d, combat).find((a) => a.id === id);
const zone = (state, combat, id, d = data) => zoneActions(state, d, combat).find((a) => a.id === id);
const attacks = (events) => events.filter((e) => e.type === "atak");

test("TECHNIQUE_IDS i combat.thrown w nowej walce", () => {
  assert.deepEqual(TECHNIQUE_IDS, ["aimed", "dual", "guard", "throw", "pickup", "ready", "odskok"]);
  const state = mkState("miecz");
  assert.equal(mkCombat(state).thrown, null);
});

test("dualState: para i miecz+sztylet aktywne; łuk+sztylet i sam miecz nie", () => {
  const pair = mkState("wlocznia");
  const d1 = dualState(pair, data, mkCombat(pair));
  assert.equal(d1.active, true);
  assert.equal(d1.main.id, "para_wloczni");
  assert.equal(d1.second.id, "para_wloczni");
  assert.equal(d1.thrownOut, false);

  const dagger = mkState("miecz", [["bron_druga", "sztylet"]]);
  const d2 = dualState(dagger, data, mkCombat(dagger));
  assert.equal(d2.active, true);
  assert.equal(d2.main.id, "miecz_krotki");
  assert.equal(d2.second.id, "sztylet");

  const bow = mkState("miecz", [["bron", "luk_mysliwski"], ["bron_druga", "sztylet"]]);
  assert.equal(dualState(bow, data, mkCombat(bow)).active, false);

  const alone = mkState("miecz");
  const d4 = dualState(alone, data, mkCombat(alone));
  assert.equal(d4.active, false);
  assert.equal(d4.second, null);
});

test("Atak obiema przy parze: 5 PA, dwa ciosy, drugi z karą 10", () => {
  const state = mkState("wlocznia");
  const combat = mkCombat(state);
  assert.equal(tech(state, combat, "dual").apCost, 5);
  assert.equal(tech(state, combat, "dual").disabled, false);
  const r = doTechnique(state, data, combat, { id: "dual", target: "bandyta#1" }, mkRng([10]));
  assert.equal(r.ok, true);
  assert.equal(r.endTurn, false);
  assert.equal(combat.playerAp, 3);
  const [a, b] = attacks(r.events);
  assert.equal(attacks(r.events).length, 2);
  assert.equal(a.weapon, "para_wloczni");
  assert.equal(b.weapon, "para_wloczni");
  assert.equal(a.chance - b.chance, 10);
  assert.equal(a.chance, playerHitChance(state, data, combat, it("para_wloczni"), combat.enemies[0]));
});

test("Atak obiema miecz+sztylet: drugi cios obrażeniami sztyletu (2–4) i typem kłute", () => {
  const state = mkState("miecz", [["bron_druga", "sztylet"]]);
  state.character.attributes.sila = 5; // no strength bonus
  state.character.mastery.miecz = 0; // no mastery damage bonus
  for (const [mode, expected] of [["lo", 2], ["hi", 4]]) {
    const combat = mkCombat(state);
    assert.equal(tech(state, combat, "dual").apCost, 5);
    const r = doTechnique(state, data, combat, { id: "dual", target: "bandyta#1" }, mkRng([10], mode));
    const [a, b] = attacks(r.events);
    assert.equal(a.weapon, "miecz_krotki");
    assert.equal(b.weapon, "sztylet");
    assert.equal(b.damage, expected);
  }
  // A foe immune to piercing: the dagger blow (klute) does nothing, the sword (sieczne) still cuts.
  const d = structuredClone(data);
  d.enemies.find((e) => e.id === "bandyta").damageTaken = { klute: 0 };
  const combat = mkCombat(state, { d });
  const r = doTechnique(state, d, combat, { id: "dual", target: "bandyta#1" }, mkRng([10]));
  const [a, b] = attacks(r.events);
  assert.ok(a.damage > 0);
  assert.equal(b.hit, true);
  assert.equal(b.damage, 0);
});

test("Atak obiema tylko w zwarciu; drugi cios pominięty, gdy pierwszy zabił", () => {
  const state = mkState("wlocznia");
  const far = mkCombat(state, { start: "far" });
  assert.equal(tech(state, far, "dual").reason, "combat.noTarget");
  const combat = mkCombat(state);
  combat.enemies[0].hp = 1;
  const r = doTechnique(state, data, combat, { id: "dual", target: "bandyta#1" }, mkRng([10]));
  assert.equal(attacks(r.events).length, 1);
  assert.ok(r.events.some((e) => e.type === "wrog_pokonany"));
  assert.equal(combat.playerAp, 3);
});

test("Uderz i zasłoń: 4 PA, defendBonus = max(…, 10)", () => {
  const state = mkState("miecz", [["bron_druga", "sztylet"]]);
  const combat = mkCombat(state);
  assert.equal(tech(state, combat, "guard").apCost, 4);
  const r = doTechnique(state, data, combat, { id: "guard", target: "bandyta#1" }, mkRng([10]));
  assert.equal(r.ok, true);
  assert.equal(combat.playerAp, 4);
  assert.equal(attacks(r.events).length, 1);
  assert.equal(attacks(r.events)[0].weapon, "miecz_krotki");
  assert.equal(combat.defendBonus, 10);
  assert.ok(r.events.some((e) => e.type === "obrona" && e.bonus === 10));
  combat.defendBonus = 15;
  doTechnique(state, data, combat, { id: "guard", target: "bandyta#1" }, mkRng([10]));
  assert.equal(combat.defendBonus, 15);
});

test("Rzut włócznią z dystansu (drzewcowa, rzucana), potem dual nieaktywne i zwykły atak z karą 10", () => {
  const state = mkState("wlocznia");
  state.character.mastery.rzucana = 40;
  const combat = mkCombat(state, { enemies: [{ id: "bandyta", count: 2 }], start: "far" });
  combat.enemies[1].band = "melee";
  const spear = it("para_wloczni");
  const before = playerHitChance(state, data, combat, spear, combat.enemies[1]);
  const t = tech(state, combat, "throw");
  assert.equal(t.disabled, false);
  assert.equal(t.apCost, 3);
  assert.equal(t.label, "Włócznia");
  const expected = playerHitChance(state, data, combat, { ...spear, skill: "drzewcowa", range: "far" }, combat.enemies[0], { masteryType: "rzucana" });
  const r = doTechnique(state, data, combat, { id: "throw", target: "bandyta#1" }, mkRng([10]));
  assert.equal(r.ok, true);
  assert.equal(combat.playerAp, 5);
  const [ev] = attacks(r.events);
  assert.equal(ev.thrown, true);
  assert.equal(ev.chance, expected);
  assert.deepEqual(combat.thrown, { uid: "bandyta#1", itemId: "para_wloczni" });
  assert.equal(countOf(state, "para_wloczni"), 1);

  const ds = dualState(state, data, combat);
  assert.equal(ds.active, false);
  assert.equal(ds.thrownOut, true);
  assert.equal(tech(state, combat, "dual").reason, "combat.secondThrown");
  assert.equal(tech(state, combat, "throw").reason, "combat.secondThrown");

  assert.equal(playerHitChance(state, data, combat, spear, combat.enemies[1]), before - 10);
  const hit = doAction(state, data, combat, { id: "attack", target: "bandyta#2" }, mkRng([10]));
  assert.equal(attacks(hit.events)[0].chance, before - 10);
});

test("Rzut przy chybieniu też zostawia broń przy celu; killedBy = rzucana przy zabiciu", () => {
  const state = mkState("wlocznia");
  const combat = mkCombat(state, { start: "far" });
  const miss = doTechnique(state, data, combat, { id: "throw", target: "bandyta#1" }, mkRng([100]));
  assert.equal(attacks(miss.events)[0].hit, false);
  assert.deepEqual(combat.thrown, { uid: "bandyta#1", itemId: "para_wloczni" });

  const s2 = mkState("miecz", [["bron_druga", "sztylet"]]);
  const c2 = mkCombat(s2, { start: "far" });
  c2.enemies[0].hp = 1;
  doTechnique(s2, data, c2, { id: "throw", target: "bandyta#1" }, mkRng([10]));
  assert.equal(c2.enemies[0].dead, true);
  assert.equal(c2.enemies[0].killedBy, "rzucana");
  assert.deepEqual(c2.thrown, { uid: "bandyta#1", itemId: "sztylet" });
});

test("Podnieś: 2 PA tylko w zwarciu z celem rzutu albo po jego śmierci", () => {
  const state = mkState("wlocznia");
  const combat = mkCombat(state, { start: "far" });
  assert.equal(tech(state, combat, "pickup").reason, "combat.notThrown");
  doTechnique(state, data, combat, { id: "throw", target: "bandyta#1" }, mkRng([100]));
  assert.equal(tech(state, combat, "pickup").reason, "combat.pickUpFar");
  assert.deepEqual(doTechnique(state, data, combat, { id: "pickup" }, mkRng([10])), { ok: false, reason: "combat.pickUpFar" });
  combat.enemies[0].band = "melee";
  assert.equal(tech(state, combat, "pickup").apCost, 2);
  const ap = combat.playerAp;
  const r = doTechnique(state, data, combat, { id: "pickup" }, mkRng([10]));
  assert.equal(r.ok, true);
  assert.equal(combat.playerAp, ap - 2);
  assert.equal(combat.thrown, null);
  assert.equal(dualState(state, data, combat).active, true);

  const c2 = mkCombat(state, { start: "far", enemies: [{ id: "bandyta", count: 2 }] });
  c2.enemies[0].hp = 1;
  doTechnique(state, data, c2, { id: "throw", target: "bandyta#1" }, mkRng([10]));
  assert.equal(c2.enemies[0].dead, true);
  assert.equal(doTechnique(state, data, c2, { id: "pickup" }, mkRng([10])).ok, true);
  assert.equal(c2.thrown, null);
});

test("po walce thrown = null, a włócznie dalej w torbie (wygrana, ucieczka, porażka nonLethal)", () => {
  for (const outcome of ["win", "fled", "defeat"]) {
    const state = mkState("wlocznia");
    const combat = mkCombat(state, { start: "far", nonLethal: true });
    doTechnique(state, data, combat, { id: "throw", target: "bandyta#1" }, mkRng([100]));
    assert.ok(combat.thrown);
    if (outcome === "win") combat.enemies[0].dead = true;
    if (outcome === "fled") combat.outcome = "fled";
    if (outcome === "defeat") state.character.hp = 0;
    const r = finishCombat(state, data, combat, createRng(1));
    assert.equal(r.outcome, outcome);
    assert.equal(combat.thrown, null);
    assert.equal(countOf(state, "para_wloczni"), 1, outcome);
    assert.equal(state.inventory.equipped.bron, "para_wloczni");
  }
});

test("Cios w głowę: koszt zwykłego ataku + 1 PA, kara 20, krytyk +20, obrażenia +50%, bez ogłuszenia", () => {
  const state = mkState("miecz");
  state.character.mastery.miecz = 0;
  const combat = mkCombat(state);
  const t = zone(state, combat, "glowa");
  assert.equal(t.disabled, false);
  assert.equal(t.apCost, it("miecz_krotki").apCost + 1);
  const normal = playerHitChance(state, data, combat, it("miecz_krotki"), combat.enemies[0]);
  // hit 10, crit roll 20 (≤ 5 + 20)
  const r = doTechnique(state, data, combat, { id: "aimed", target: "bandyta#1", zone: "glowa" }, mkRng([10, 20], "hi"));
  assert.equal(r.ok, true);
  assert.equal(combat.playerAp, 8 - it("miecz_krotki").apCost - 1);
  const [ev] = attacks(r.events);
  assert.equal(ev.chance, normal - 20);
  assert.equal(ev.crit, true);
  assert.ok(!r.events.some((e) => e.type === "efekt_nalozony"));

  const c1 = mkCombat(state);
  const plain = doAction(state, data, c1, { id: "attack", target: "bandyta#1" }, mkRng([10, 50], "hi"));
  const c2 = mkCombat(state);
  const head = doTechnique(state, data, c2, { id: "aimed", target: "bandyta#1", zone: "glowa" }, mkRng([10, 50], "hi"));
  assert.equal(attacks(head.events)[0].crit, false);
  assert.ok(attacks(head.events)[0].damage > attacks(plain.events)[0].damage);
});

test("Cios w głowę: każde 25 pkt mistrzostwa broni zdejmuje 5 z kary; opis (zoneActions) podaje aktualną karę", () => {
  const state = mkState("miecz");
  const combat = mkCombat(state);
  const penaltyAt = (m) => { state.character.mastery.miecz = m; return zone(state, combat, "glowa").penalty; };
  assert.equal(penaltyAt(0), 20);
  assert.equal(penaltyAt(24), 20);
  assert.equal(penaltyAt(50), 10);
  assert.equal(penaltyAt(100), 0);
  assert.match(zoneItems(data, zoneActions(state, data, combat))[0].description, /Trafienie ±0/, "bez kary nie ma „−0”");
  state.character.mastery.miecz = 50;
  const base = playerHitChance(state, data, combat, it("miecz_krotki"), combat.enemies[0]);
  const r = doTechnique(state, data, combat, { id: "aimed", target: "bandyta#1", zone: "glowa" }, mkRng([10, 50], "hi"));
  assert.equal(attacks(r.events)[0].chance, base - 10);
  assert.equal(zone(state, combat, "tulow").penalty, -10, "strefy bez masteryRelief bez zmian");
});

test("Para włóczni: rzut z dystansu jedną włócznią (nazwa, umiejętność drzewcowa), podniesienie, potem combo", () => {
  const state = mkState("wlocznia");
  state.character.mastery.rzucana = 0;
  const combat = mkCombat(state, { start: "far" });
  const throwEntry = tech(state, combat, "throw");
  assert.equal(throwEntry.disabled, false);
  assert.equal(throwEntry.label, "Włócznia", "rzucasz jedną włócznią, nie całą parą");
  assert.equal(tech(state, combat, "dual").reason, "combat.noTarget", "combo dopiero w zwarciu");
  const asSpear = playerHitChance(state, data, combat, { id: "x", range: "far", skill: "drzewcowa", minStrength: 0 }, combat.enemies[0], { masteryType: "rzucana" });
  const r = doTechnique(state, data, combat, { id: "throw", target: "bandyta#1" }, mkRng([1]));
  assert.equal(r.ok, true);
  assert.equal(attacks(r.events)[0].thrown, true);
  assert.equal(attacks(r.events)[0].chance, asSpear, "szansa liczona z drzewcowej, nie z miotania");
  assert.equal(combat.thrown.itemId, "para_wloczni");
  assert.equal(tech(state, combat, "pickup").label, "Włócznia");
  combat.enemies[0].band = "melee";
  assert.equal(doTechnique(state, data, combat, { id: "pickup" }, fixed(1)).ok, true);
  assert.equal(combat.thrown, null);
  combat.playerAp = 8;
  const combo = doTechnique(state, data, combat, { id: "dual", target: "bandyta#1" }, mkRng([1]));
  assert.equal(combo.ok, true);
  assert.equal(attacks(combo.events).length, 2, "combo: dwa ciosy w jednej akcji");
});

test("Ogłusz: bez obrażeń, ogłuszenie 40% (+20 bronią obuchową), działa też bez broni; nie z dystansu", () => {
  const state = mkState("miecz");
  const c1 = mkCombat(state);
  assert.equal(zone(state, c1, "ogluszenie").apCost, it("miecz_krotki").apCost);
  const hit = doTechnique(state, data, c1, { id: "aimed", target: "bandyta#1", zone: "ogluszenie" }, mkRng([10, 40]));
  assert.equal(attacks(hit.events)[0].damage, 0);
  assert.equal(c1.enemies[0].hp, c1.enemies[0].hpMax);
  assert.ok(c1.enemies[0].effects.some((e) => e.id === "ogluszenie"));
  const c2 = mkCombat(state);
  doTechnique(state, data, c2, { id: "aimed", target: "bandyta#1", zone: "ogluszenie" }, mkRng([10, 41]));
  assert.ok(!c2.enemies[0].effects.some((e) => e.id === "ogluszenie"));

  const fists = mkState("miecz");
  delete fists.inventory.equipped.bron;
  const c3 = mkCombat(fists);
  assert.deepEqual(zoneActions(fists, data, c3).map((a) => a.id), ["ogluszenie"]);
  doTechnique(fists, data, c3, { id: "aimed", target: "bandyta#1", zone: "ogluszenie" }, mkRng([10, 60]));
  assert.ok(c3.enemies[0].effects.some((e) => e.id === "ogluszenie"), "pięści są obuchowe: 40 + 20");

  const bow = mkState("miecz");
  addItem(bow, data, "luk_mysliwski", 1);
  equip(bow, data, "luk_mysliwski", "bron");
  const ranged = zoneActions(bow, data, mkCombat(bow, { start: "far" })).map((a) => a.id);
  assert.ok(ranged.includes("glowa") && !ranged.includes("ogluszenie"));
});

test("Cios w tułów: obrażenia −15% przed pancerzem, trafienie +10", () => {
  const state = mkState("miecz");
  state.character.mastery.miecz = 0;
  const c1 = mkCombat(state);
  const plain = doAction(state, data, c1, { id: "attack", target: "bandyta#1" }, mkRng([10, 50], "hi"));
  const c2 = mkCombat(state);
  const aimed = doTechnique(state, data, c2, { id: "aimed", target: "bandyta#1", zone: "tulow" }, mkRng([10, 50], "hi"));
  const base = attacks(plain.events)[0].damage;
  assert.equal(attacks(aimed.events)[0].damage, Math.floor(base * 0.85));
  assert.equal(attacks(aimed.events)[0].chance, attacks(plain.events)[0].chance + 10);
});

test("Cios w nogi: spowolnienie 40%; upiór z immune – brak efektu", () => {
  const state = mkState("miecz");
  const c1 = mkCombat(state);
  const r1 = doTechnique(state, data, c1, { id: "aimed", target: "bandyta#1", zone: "nogi" }, mkRng([10, 50, 40]));
  assert.equal(attacks(r1.events)[0].chance, playerHitChance(state, data, c1, it("miecz_krotki"), c1.enemies[0]) - 15);
  assert.ok(c1.enemies[0].effects.some((e) => e.id === "spowolnienie"));
  const c2 = mkCombat(state);
  doTechnique(state, data, c2, { id: "aimed", target: "bandyta#1", zone: "nogi" }, mkRng([10, 50, 41]));
  assert.ok(!c2.enemies[0].effects.some((e) => e.id === "spowolnienie"));

  const d = structuredClone(data);
  d.enemies.find((e) => e.id === "upior_zwiadowca").immune.push("spowolnienie");
  const c3 = mkCombat(state, { d, enemies: [{ id: "upior_zwiadowca", count: 1 }] });
  const r3 = doTechnique(state, d, c3, { id: "aimed", target: "upior_zwiadowca#1", zone: "nogi" }, mkRng([1, 50, 1]));
  assert.equal(attacks(r3.events)[0].hit, true);
  assert.ok(r3.events.some((e) => e.type === "efekt_odporny" && e.id === "spowolnienie"));
  assert.ok(!c3.enemies[0].effects.some((e) => e.id === "spowolnienie"));
});

test("Ciosy celowane: dla pięści tylko Ogłusz; noAp przy zbyt małej liczbie PA", () => {
  const fists = mkState("miecz");
  fists.inventory.equipped.bron = undefined;
  delete fists.inventory.equipped.bron;
  const combat = mkCombat(fists);
  assert.equal(zone(fists, combat, "glowa"), undefined);
  assert.deepEqual(doTechnique(fists, data, combat, { id: "aimed", target: "bandyta#1", zone: "glowa" }, fixed(1)).ok, false);
  const pa = playerActions(fists, data, combat).find((a) => a.id === "techniques");
  assert.equal(pa.disabled, true);
  assert.equal(pa.reason, "combat.noTechnique");

  const state = mkState("miecz");
  const c2 = mkCombat(state, { ap: 2 });
  assert.equal(zone(state, c2, "glowa").reason, "combat.noAp");
  // any melee weapon has the ready stance in "Techniki" (aimed blows are top-level)
  assert.equal(playerActions(state, data, mkCombat(state)).find((a) => a.id === "techniques").disabled, false);
  const pair = mkState("wlocznia");
  assert.equal(playerActions(pair, data, mkCombat(pair)).find((a) => a.id === "techniques").disabled, false);
});

test("nieudana technika nie zmienia stanu", () => {
  const cases = [
    [mkState("miecz"), { id: "dual", target: "bandyta#1" }, {}],
    [mkState("miecz"), { id: "guard", target: "bandyta#1" }, {}],
    [mkState("miecz"), { id: "throw", target: "bandyta#1" }, {}],
    [mkState("wlocznia"), { id: "pickup" }, {}],
    [mkState("wlocznia"), { id: "dual", target: "bandyta#1" }, { ap: 4 }],
    [mkState("wlocznia"), { id: "dual", target: "bandyta#9" }, {}],
    [mkState("wlocznia"), { id: "throw", target: "nikt" }, {}],
    [mkState("miecz"), { id: "aimed", target: "bandyta#1", zone: "glowa" }, { ap: 2 }],
    [mkState("miecz"), { id: "aimed", target: "bandyta#1", zone: "nogi" }, { start: "far" }],
  ];
  for (const [state, action, opts] of cases) {
    const combat = mkCombat(state, opts);
    const s0 = structuredClone(state);
    const c0 = structuredClone(combat);
    const r = doTechnique(state, data, combat, action, mkRng([10]));
    assert.equal(r.ok, false, JSON.stringify(action));
    assert.equal(typeof r.reason, "string");
    assert.deepEqual(state, s0);
    assert.deepEqual(combat, c0);
  }
  // doAction delegates technique ids
  const state = mkState("wlocznia");
  const combat = mkCombat(state);
  const r = doAction(state, data, combat, { id: "dual", target: "bandyta#1" }, mkRng([10]));
  assert.equal(r.ok, true);
  assert.equal(attacks(r.events).length, 2);
});

test("throwItem: trafienie przedmiotem rzucanym z premią biegłości rzucana", () => {
  const state = mkState("miecz");
  addItem(state, data, "garnek_huku", 1);
  const combat = mkCombat(state, { start: "far" });
  const item = it("garnek_huku");
  const pseudo = { id: item.id, range: "far", skill: item.skill, minStrength: 0 };
  const base = playerHitChance(state, data, combat, pseudo, combat.enemies[0], { masteryType: null });
  state.character.mastery.rzucana = 100;
  const withMastery = playerHitChance(state, data, combat, pseudo, combat.enemies[0], { masteryType: "rzucana" });
  assert.equal(withMastery - base, data.rules.combat.mastery.hitAt100);
  // roll just above the plain chance: hits only thanks to the mastery bonus
  const r = doAction(state, data, combat, { id: "use", itemId: "garnek_huku", target: "bandyta#1" }, mkRng([base + 1]));
  assert.equal(r.ok, true);
  assert.equal(r.events.find((e) => e.type === "uzycie").hit, true);
});
