import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { evaluate } from "../src/engine/conditions.js";
import { combatState, playFight } from "./helpers.js";
import { enterNode, nodeView } from "../src/systems/dialogue.js";
import { rollVisitor } from "../src/systems/spots.js";
import { rollLocalEvent } from "../src/systems/travel.js";
import { createCombat } from "../src/systems/combat/state.js";
import { attackTargets, playerActions } from "../src/systems/combat/actions.js";
import { getStats } from "../src/systems/stats.js";

const data = await loadData();
const fixed = { int: () => 1 };

function start(flags = {}, search = 30) {
  const state = createNewState({ seed: 1, startScene: "akt3_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 40;
  Object.assign(state.flags, flags);
  state.world.location = "gluszec";
  state.world.search = search;
  return state;
}
const enter = (state, d, n) => enterNode(state, data, d, n, fixed);
const keys = (state, d, n) => nodeView(state, data, d, n).options.filter((o) => !o.disabled).map((o) => o.key);

test("kontrola zwiadowców: zawsze jest wyjście bez rzutu i bez pieniędzy, a każdy wynik trzyma poszukiwania w 0–100", () => {
  const bare = start({}, 30);
  const options = keys(bare, "kontrola", "kontrola");
  assert.ok(options.includes("gadka") && options.includes("stoj"), "bez papierów, pieniędzy i piwnicy zostaje gadka i obszukanie");
  bare.character.money = 0;
  assert.ok(keys(bare, "kontrola", "kontrola").includes("stoj"));
  for (const node of ["papiery", "gadka_ok", "gadka_zle", "lapowka", "schowaj", "obszukaj_ok", "obszukaj_zle"]) {
    for (const search of [0, 5, 30, 90, 100]) {
      const s = start({}, search);
      enter(s, "kontrola", node);
      assert.ok(s.world.search >= 0 && s.world.search <= 100, `${node}@${search}`);
    }
  }
});

test("kontrola: papiery od kowala i piwnica otwierają dodatkowe wyjścia; insygnia w plecaku zmieniają obszukanie", () => {
  const s = start({ papiery_falszywe: true }, 30);
  assert.ok(keys(s, "kontrola", "kontrola").includes("papiery"));
  enter(s, "kontrola", "kontrola");
  assert.equal(s.world.discovered.includes("gluszec.piwnica"), true, "pierwsza kontrola pokazuje piwnicę");
  assert.ok(keys(s, "kontrola", "kontrola").includes("schowaj"));
  assert.equal(keys(s, "kontrola", "kontrola").includes("stoj_zle"), false);
  const withInsignia = start({ ukryte_insygnia: true }, 30);
  const k = keys(withInsignia, "kontrola", "kontrola");
  assert.ok(k.includes("stoj_zle") && !k.includes("stoj"));
  enter(withInsignia, "kontrola", "obszukaj_zle");
  assert.equal(withInsignia.world.search, 55);
  assert.equal(withInsignia.flags.insygnia_odkryte, true);
});

test("gość „kontrola” w Głuszcu przy czujności, „obława” od 75; bez poszukiwań żaden się nie trafia", () => {
  const rng = { int: () => 1 };
  assert.notEqual(rollVisitor(start({}, 0), data, "gluszec", rng), "zwiadowcy_kontrola");
  assert.equal(rollVisitor(start({}, 30), data, "gluszec", rng), "zwiadowcy_kontrola");
  assert.equal(rollVisitor(start({}, 80), data, "gluszec", rng), "oblawa");
  assert.notEqual(rollVisitor(start({ akt3a_koniec: true }, 80), data, "gluszec", rng), "oblawa", "po końcu odsłony obławy już nie ma");
});

test("obława: ucieczka kończy odsłonę osobnym zakończeniem; zagadanie obniża poszukiwania; z insygniami zagadanie odpada", () => {
  const s = start({}, 90);
  assert.ok(keys(s, "oblawa", "oblawa").includes("zostan"));
  enter(s, "oblawa", "ucieczka");
  assert.equal(s.flags.akt3a_koniec, true);
  assert.equal(s.flags.oblawa_ucieczka, true);
  const ok = start({}, 90);
  enter(ok, "oblawa", "zostan_ok");
  assert.equal(ok.world.search, 60);
  assert.equal(keys(start({ insygnia_odkryte: true }, 90), "oblawa", "oblawa").includes("zostan"), false);
  assert.ok(keys(start({ insygnia_odkryte: true }, 90), "oblawa", "oblawa").includes("uciekaj"));
});

test("zdarzenia na drodze: kontrola od 25, patrol od 50 tylko w okolicy Głuszca; kłusownicy tylko przy zleceniu gajowego", () => {
  const d = structuredClone(data);
  d.rules.travel.localEventChance = 100;
  const pool = (state) => {
    const seen = new Set();
    for (let i = 1; i <= 60; i++) seen.add(rollLocalEvent(state, d, { int: (lo, hi) => (lo === 1 && hi === 100 ? 1 : (i % (hi - lo + 1)) + lo) }, 2));
    return seen;
  };
  const near = (search, quest) => { const s = start({}, search); if (quest) s.quests.klusownik_i_gajowy = { status: "active" }; return s; };
  assert.equal(pool(near(10)).has("kontrola_zwiadowcow"), false);
  assert.equal(pool(near(30)).has("kontrola_zwiadowcow"), true);
  assert.equal(pool(near(30)).has("patrol_zwiadowcow"), false);
  assert.equal(pool(near(60)).has("patrol_zwiadowcow"), true);
  assert.equal(pool(near(10)).has("klusownicy_w_boru"), false);
  assert.equal(pool(near(10, true)).has("klusownicy_w_boru"), true);
  const away = near(60);
  away.world.location = "wilczy_brod";
  assert.equal(pool(away).has("patrol_zwiadowcow"), false, "w Brodzie patroli z Głuszca nie ma");
});

test("po walce ze zwiadowcami poszukiwania rosną o 15", () => {
  const s = start({}, 20);
  enter(s, "po_zwiadowcach", "wynik");
  assert.equal(s.world.search, 35);
});

// Simple fighter: heal low, attack, close in.
function strategy(state, d, combat) {
  const actions = playerActions(state, d, combat);
  const can = (id) => !actions.find((a) => a.id === id).disabled;
  if (state.character.hp < 0.4 * getStats(state, d).derived.hpMax && can("use")) return { id: "use", itemId: "opatrunek" };
  if (can("attack")) return { id: "attack", target: attackTargets(state, d, combat)[0] };
  const far = combat.enemies.find((e) => !e.dead && !e.fled && e.band === "far");
  if (far && can("move")) return { id: "move", target: far.uid };
  return null;
}

for (const classId of ["miecz", "wlocznia"]) {
  test(`symulacja (prawdziwe dane): ${classId} vs patrol dwóch zwiadowców i dwóch kłusowników, 200 ziaren – wynik w widełkach`, (t) => {
    for (const [enemy, minWins, minLoss] of [["zwiadowca_cesarski", 60, 0.15], ["klusownik", 120, 0.1]]) {
      let wins = 0, loss = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const rng = createRng(seed);
        const state = combatState(data, classId);
        const combat = createCombat(state, data, { enemies: [{ id: enemy, count: 2 }], start: "far", canFlee: true, id: "sim", ambush: true }, rng);
        const hpMax = getStats(state, data).derived.hpMax;
        const { outcome } = playFight(state, data, combat, rng, strategy);
        if (outcome === "win") wins++;
        loss += (hpMax - Math.max(0, state.character.hp)) / hpMax;
      }
      t.diagnostic(`${classId} vs 2× ${enemy}: wygrane ${wins}/200, średnia utrata HP ${(loss / 2).toFixed(1)}%`);
      assert.ok(wins >= minWins, `${classId} vs ${enemy}: wygrane ${wins}/200 < ${minWins}`);
      assert.ok(loss / 200 >= minLoss, `${classId} vs ${enemy}: za łatwo (${(loss / 2).toFixed(1)}% utraty)`);
    }
  });
}

void evaluate;
