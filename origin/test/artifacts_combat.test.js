import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, equip, countOf } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { artifactState, abilityOptions, useAbility } from "../src/systems/artifacts.js";
import { createCombat } from "../src/systems/combat/state.js";
import { strike } from "../src/systems/combat/strike.js";
import { resolveEnemyAttack, playerActions, doAction } from "../src/systems/combat/actions.js";
import { techniqueActions, zoneActions, doTechnique } from "../src/systems/combat/techniques.js";
import { enemyHitChance, mitigate } from "../src/systems/combat/formulas.js";
import { finishCombat } from "../src/systems/combat/turn.js";
import { enemyById } from "../src/systems/combat/data.js";

const data = minimalData();
// Kamień Zmierzchu ładuje się w grze tylko wystawiony; testy matematyki ładowania liczą go jak noszony artefakt bez tego wymogu.
data.items.find((i) => i.id === "kamien_zmierzchu").regen.requiresExposure = false;
const H = 60;

/** First 1–100 roll → `first` (a hit), later 1–100 rolls → 100 (no crit, no effect); ranges → min (or max with `high`). */
function rngStub({ high = false, first = 1 } = {}) {
  let rolled = false;
  return { int(min, max) {
    if (min === 1 && max === 100) {
      if (!rolled) { rolled = true; return first; }
      return 100;
    }
    return high ? max : min;
  } };
}
const always = (v) => ({ int: (min, max) => Math.min(max, Math.max(min, v)) });

function setup({ charge = 60, enemy = "bandyta", worn = true, item = "kamien_zmierzchu", slot = "talizman" } = {}) {
  const state = combatState(data, "miecz");
  state.world = { phenomenon: null, phenomenonRolledDay: 99 };
  addItem(state, data, item, 1);
  if (worn) equip(state, data, item, slot);
  if (charge !== undefined) state.artifacts[item].charge = charge;
  const combat = createCombat(state, data, { id: "w", enemies: [{ id: enemy, count: 1 }], start: "melee" }, always(5));
  combat.playerAp = 10;
  return { state, combat, foe: combat.enemies[0] };
}
const option = (s, c, id) => abilityOptions(s, data, c).find((o) => o.id === id);
const hasEffect = (s, id) => (s.character.effects ?? []).some((e) => e.id === id);

test("Płonące ostrze: 50% ładunku, 2 PA, ostrze_ognia 3 tury", () => {
  const { state, combat } = setup({ charge: 60 });
  assert.deepEqual(option(state, combat, "plonace_ostrze"), { id: "plonace_ostrze", name: "Płonące ostrze", apCost: 2, chargeCost: 50, disabled: false, target: "self", effect: "ostrze_ognia" });
  const r = useAbility(state, data, combat, "plonace_ostrze", undefined, always(50));
  assert.equal(r.ok, true);
  assert.equal(r.events[0].type, "zdolnosc");
  assert.equal(artifactState(state, "kamien_zmierzchu").charge, 10);
  assert.equal(combat.playerAp, 8);
  assert.equal(state.character.effects.find((e) => e.id === "ostrze_ognia").remaining, 3);
});
test("ostrze_ognia: cios bronią zadaje dodatkowe 2–4 ognia (upiór ×2)", () => {
  for (const [enemy, mult] of [["bandyta", 1], ["upior_zwiadowca", 2]]) {
    for (const high of [false, true]) {
      const plain = setup({ enemy });
      const fire = setup({ enemy });
      useAbility(fire.state, data, fire.combat, "plonace_ostrze", undefined, always(50));
      const weapon = data.items.find((i) => i.id === "miecz_krotki");
      const a = strike(plain.state, data, plain.combat, { weapon, target: plain.foe, rng: rngStub({ high }) })[0];
      const b = strike(fire.state, data, fire.combat, { weapon, target: fire.foe, rng: rngStub({ high }) })[0];
      assert.equal(a.hit && b.hit, true);
      assert.equal(b.damage - a.damage, (high ? 4 : 2) * mult, `${enemy} ${high}`);
      assert.deepEqual(b.extra, { type: "ogien", amount: (high ? 4 : 2) * mult });
    }
  }
});
test("Zasłona Zmierzchu: wymaga pełnego, zabiera cały ładunek, cios bandyty ×0.6", () => {
  const near = setup({ charge: 99 });
  assert.equal(option(near.state, near.combat, "zaslona_zmierzchu").reason, "artifact.notFull");
  const before = structuredClone({ state: near.state, combat: near.combat });
  assert.deepEqual(useAbility(near.state, data, near.combat, "zaslona_zmierzchu", undefined, always(50)), { ok: false, reason: "artifact.notFull" });
  assert.deepEqual({ state: near.state, combat: near.combat }, before, "nieudana zdolność nie zmienia stanu");
  const { state, combat, foe } = setup({ charge: 100 });
  assert.equal(useAbility(state, data, combat, "zaslona_zmierzchu", undefined, always(50)).ok, true);
  assert.equal(artifactState(state, "kamien_zmierzchu").charge, 0);
  assert.ok(hasEffect(state, "zaslona"));
  const attack = enemyById(data, "bandyta").attacks.find((a) => a.damage);
  const st = getStats(state, data);
  state.character.hp = 50;
  const ev = resolveEnemyAttack(state, data, combat, foe.uid, attack, rngStub({ high: true }))[0];
  const raw = attack.damage[1];
  assert.equal(ev.damage, mitigate({ raw, armor: st.derived.armor, reductionPercent: st.derived.reduction[attack.damageType] ?? 0, taken: 0.6 }));
});
test("pusty kamień: zdolność kosztem HP (whenEmpty), przy niskim HP wyszarzona i nigdy nie zabija", () => {
  const { state, combat } = setup({ charge: 0 });
  state.character.hp = 30;
  const o = option(state, combat, "plonace_ostrze");
  assert.equal(o.disabled, false);
  assert.equal(o.viaHp, 10);
  assert.equal(option(state, combat, "zaslona_zmierzchu").reason, "artifact.notFull");
  const r = useAbility(state, data, combat, "plonace_ostrze", undefined, always(50));
  assert.equal(r.ok, true);
  assert.equal(state.character.hp, 20);
  assert.deepEqual(r.events[0], { type: "zdolnosc", artifact: "kamien_zmierzchu", ability: "plonace_ostrze", viaHp: 10, text: "Kamień pije z ciebie." });
  assert.equal(artifactState(state, "kamien_zmierzchu").charge, 0);
  state.character.hp = 10;
  assert.equal(option(state, combat, "plonace_ostrze").reason, "artifact.noHp");
  assert.deepEqual(useAbility(state, data, combat, "plonace_ostrze", undefined, always(50)), { ok: false, reason: "artifact.noHp" });
  assert.equal(state.character.hp, 10);
});
test("zdolność 'all' przy ładunku 0 bez whenEmpty – wyszarzona", () => {
  const d = structuredClone(data);
  const k = d.items.find((i) => i.id === "kamien_zmierzchu");
  delete k.whenEmpty;
  k.abilities[1].requiresFull = false;
  const state = combatState(d, "miecz");
  addItem(state, d, "kamien_zmierzchu", 1);
  equip(state, d, "kamien_zmierzchu", "talizman");
  state.artifacts.kamien_zmierzchu.charge = 0;
  const combat = createCombat(state, d, { id: "w", enemies: [{ id: "bandyta" }], start: "melee" }, always(5));
  combat.playerAp = 10;
  const opts = abilityOptions(state, d, combat);
  assert.equal(opts.find((o) => o.id === "zaslona_zmierzchu").reason, "artifact.noCharge");
  assert.equal(opts.find((o) => o.id === "plonace_ostrze").reason, "artifact.noCharge");
});
test("brak PA → combat.noAp; Techniki: pozycje artifact:* tylko z założonym artefaktem", () => {
  const { state, combat } = setup({ charge: 100 });
  combat.playerAp = 1;
  assert.equal(option(state, combat, "plonace_ostrze").reason, "combat.noAp");
  combat.playerAp = 10;
  const tech = techniqueActions(state, data, combat).filter((t) => t.id.startsWith("artifact:"));
  assert.deepEqual(tech.map((t) => [t.id, t.apCost, t.disabled]), [["artifact:plonace_ostrze", 2, false], ["artifact:zaslona_zmierzchu", 4, false]]);
  const r = doTechnique(state, data, combat, { id: "artifact:plonace_ostrze" }, always(50));
  assert.equal(r.ok, true);
  assert.equal(r.endTurn, false);
  assert.equal(artifactState(state, "kamien_zmierzchu").charge, 50);
  assert.equal(doAction(state, data, combat, { id: "artifact:zaslona_zmierzchu" }, always(50)).reason, "artifact.notFull");
  const bag = setup({ worn: false });
  assert.equal(techniqueActions(bag.state, data, bag.combat).some((t) => t.id.startsWith("artifact:")), false);
});
test("broń-artefakt w bron: zdolność fixed 10 i atak jak broń", () => {
  const { state, combat, foe } = setup({ item: "miecz_gwiazd_test", slot: "bron", charge: 50 });
  const o = option(state, combat, "zar_ostrza");
  assert.equal(o.chargeCost, 10);
  assert.equal(o.disabled, false);
  assert.equal(useAbility(state, data, combat, "zar_ostrza", undefined, always(50)).ok, true);
  assert.equal(artifactState(state, "miecz_gwiazd_test").charge, 40);
  assert.ok(zoneActions(state, data, combat).some((z) => z.id === "glowa" && !z.disabled));
  const r = doAction(state, data, combat, { id: "attack", target: foe.uid }, rngStub());
  assert.equal(r.ok, true);
  assert.equal(r.events[0].weapon, "miecz_gwiazd_test");
});
test("Noc bez Gwiazd: upiór trafia z +10 i bije za +2", () => {
  const plain = setup({ enemy: "upior_zwiadowca" });
  const dark = setup({ enemy: "upior_zwiadowca" });
  dark.state.world.phenomenon = { id: "noc_bez_gwiazd", startsAt: 0, endsAt: 30 * H, omenAt: 0, omenShown: true, started: true };
  plain.state.time.minutes = dark.state.time.minutes = 22 * H;
  for (const s of [plain, dark]) s.combat.defendBonus = 40;
  const attack = enemyById(data, "upior_zwiadowca").attacks.find((a) => a.damage && a.hit);
  const c0 = enemyHitChance(plain.state, data, plain.combat, plain.foe, attack);
  assert.equal(enemyHitChance(dark.state, data, dark.combat, dark.foe, attack), Math.min(95, c0 + 10));
  for (const s of [plain, dark]) s.state.character.hp = 99;
  const st = getStats(dark.state, data);
  const ev = resolveEnemyAttack(dark.state, data, dark.combat, dark.foe.uid, attack, rngStub({ high: true }))[0];
  assert.equal(ev.damage, mitigate({ raw: attack.damage[1] + 2, armor: st.derived.armor, reductionPercent: st.derived.reduction[attack.damageType] ?? 0, taken: st.other.damageTaken[attack.damageType] ?? 1 }));
});
test("Mgła Ciszy blokuje proch: atak i celowany wyszarzone, bez zmiany stanu", () => {
  const { state, combat } = setup({ worn: false });
  addItem(state, data, "pistolet_skalkowy", 1);
  equip(state, data, "pistolet_skalkowy", "bron");
  state.inventory.loaded.pistolet_skalkowy = 1;
  state.world.phenomenon = { id: "mgla_ciszy", startsAt: 0, endsAt: 30 * H, omenAt: 0, omenShown: true, started: true };
  assert.equal(playerActions(state, data, combat).find((a) => a.id === "attack").reason, "combat.blockedByPhenomenon");
  assert.equal(zoneActions(state, data, combat).find((a) => a.id === "glowa").reason, "combat.blockedByPhenomenon");
  const before = structuredClone(state);
  assert.deepEqual(doAction(state, data, combat, { id: "attack" }, always(50)), { ok: false, reason: "combat.blockedByPhenomenon" });
  assert.deepEqual(state, before);
  state.world.phenomenon = null;
  assert.equal(playerActions(state, data, combat).find((a) => a.id === "attack").disabled, false);
});
test("czas walki z żywym upiorem (near:upior) nie ładuje kamienia", () => {
  const { state, combat } = setup({ enemy: "upior_zwiadowca", charge: 40 });
  combat.def = { ...combat.def, minutes: 60 };
  combat.outcome = "fled";
  finishCombat(state, data, combat, always(100));
  assert.equal(artifactState(state, "kamien_zmierzchu").charge, 40);
  const b = setup({ enemy: "bandyta", charge: 40 });
  b.combat.def = { ...b.combat.def, minutes: 60 };
  b.combat.outcome = "fled";
  finishCombat(b.state, data, b.combat, always(100));
  assert.equal(artifactState(b.state, "kamien_zmierzchu").charge, 44);
});
test("łup sceny: artefakt raz po wygranej, nie po ucieczce; już posiadany – pominięty bez błędu", () => {
  const fight = (outcome, owned) => {
    const state = combatState(data, "miecz");
    if (owned) { addItem(state, data, "kamien_zmierzchu", 1); state.artifacts.kamien_zmierzchu.charge = 77; }
    const combat = createCombat(state, data, { id: "w", enemies: [{ id: "bandyta", count: 2 }], start: "melee", loot: [{ chance: 100, giveItem: "kamien_zmierzchu" }] }, always(5));
    if (outcome === "win") combat.enemies.forEach((e) => { e.dead = true; e.hp = 0; });
    else combat.outcome = outcome;
    const r = finishCombat(state, data, combat, always(100));
    return { state, r };
  };
  const win = fight("win");
  assert.equal(countOf(win.state, "kamien_zmierzchu"), 1);
  assert.equal(win.r.events.filter((e) => e.type === "otrzymano" && e.id === "kamien_zmierzchu").length, 1);
  assert.equal(countOf(fight("fled").state, "kamien_zmierzchu"), 0);
  const again = fight("win", true);
  assert.equal(countOf(again.state, "kamien_zmierzchu"), 1);
  assert.ok(again.state.artifacts.kamien_zmierzchu.charge >= 77, "ładunek nie wraca do startu (tylko rośnie w czasie walki)");
});
