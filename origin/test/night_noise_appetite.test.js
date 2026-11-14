import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createCombat } from "../src/systems/combat/state.js";
import { noiseOfKill } from "../src/systems/combat/strike.js";
import { appetitePercent, appetiteHour, resetAppetite } from "../src/systems/appetite.js";
import { eatItem } from "../src/systems/food.js";
import { addItem } from "../src/systems/inventory.js";
import { advanceTime } from "../src/engine/time.js";
import { rollLocalEvents } from "../src/systems/travel.js";
import { heroPanel } from "../src/ui/hero_panel.js";

const fixed = (k) => ({ int: () => k });
const H = 60;

function fight(enemies = [{ id: "bandyta", count: 2 }], def = {}) {
  const data = minimalData();
  data.rules.combat.noise.chance = 100;
  const state = combatState(data, "miecz");
  const combat = createCombat(state, data, { enemies, start: "far", id: "w", ...def }, fixed(5));
  return { data, combat };
}

test("szybkie zabicie przy żywym towarzyszu ściąga jeszcze jednego tego samego rodzaju, raz na walkę", () => {
  const { data, combat } = fight();
  combat.enemies[0].dead = true;
  const events = [];
  noiseOfKill(data, combat, combat.enemies[0], fixed(1), events);
  assert.equal(events[0].type, "posilki");
  assert.equal(combat.enemies.length, 3);
  assert.equal(combat.enemies[2].id, "bandyta");
  noiseOfKill(data, combat, combat.enemies[0], fixed(1), events);
  assert.equal(combat.enemies.length, 3, "tylko raz");
});

test("hałas milczy: późna runda, ostatni wróg, scena quiet, szkolenie, duch, rzut powyżej szansy", () => {
  const run = (setup, rng = fixed(1)) => {
    const { data, combat } = fight(...setup.args ?? []);
    setup.edit?.(combat, data);
    combat.enemies[0].dead = true;
    if (setup.last) combat.enemies.slice(1).forEach((e) => { e.dead = true; });
    noiseOfKill(data, combat, combat.enemies[0], rng, []);
    return combat.enemies.length;
  };
  assert.equal(run({ edit: (c) => { c.round = 3; } }), 2);
  assert.equal(run({ last: true }), 2);
  assert.equal(run({ args: [undefined, { quiet: true }] }), 2);
  assert.equal(run({ args: [undefined, { training: true }] }), 2);
  assert.equal(run({ args: [[{ id: "upior_zwiadowca", count: 2 }]] }), 2);
  assert.equal(run({ edit: (c, d) => { d.rules.combat.noise.chance = 50; } }, fixed(51)), 2);
});

test("wskaźnik głodu rośnie z godzinami, przy 85% bohater się odzywa raz, jedzenie zeruje", () => {
  const data = minimalData();
  const state = combatState(data, "miecz");
  state.world = { ...state.world };
  appetiteHour(state, data);
  assert.ok(appetitePercent(state, data) < 10);
  const hints = [];
  for (let h = 0; h < 20; h++) hints.push(...advanceTime(state, H, data, fixed(50)).filter((e) => e.type === "glod_pora"));
  assert.equal(hints.length, 1);
  assert.equal(appetitePercent(state, data), 87);
  addItem(state, data, "prowiant", 1);
  eatItem(state, data, "prowiant", fixed(99));
  assert.equal(appetitePercent(state, data), 0);
  resetAppetite(state);
  assert.equal(state.character.appetiteHinted, undefined);
});

test("panel bohatera pokazuje sakiewkę, głód i prowiant", () => {
  const data = minimalData();
  const state = combatState(data, "miecz");
  state.character.money = 47;
  const text = stripVTControlCharacters(heroPanel(state, data, { cols: 120 }).lines[0]);
  assert.match(text, /47 gr/);
  assert.match(text, /Głód \d+%/);
  assert.match(text, /Prowiant \d+/);
});

test("wieczorem i nocą spacer częściej kończy się spotkaniem", () => {
  const data = minimalData();
  data.travel.events = [{ id: "szmer", kind: "encounter", weight: 1, scenes: [{ id: "s1", type: "narration", text: "x", goto: "koniec" }] }];
  data.rules.travel.localEventChance = 30;
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.world.phenomenonRolledDay = 99;
  state.time.minutes = 10 * H;
  assert.equal(rollLocalEvents(state, data, fixed(40), 1, 60, "k").length, 0, "w dzień 30% nie wystarcza na 40");
  state.time.minutes = 22 * H;
  assert.equal(rollLocalEvents(state, data, fixed(40), 1, 60, "k").length, 1, "w nocy 30 + 20");
});

test("gulasz to posiłek z efektem: zeruje głód i daje Najedzonego, napar i łój dają swoje efekty", async () => {
  const { useConsumable: useItem } = await import("../src/systems/inventory.js");
  const data = minimalData();
  const state = combatState(data, "miecz");
  state.time = { minutes: 20 * H };
  state.character.lastMeal = 0;
  for (const id of ["gulasz", "napar_z_korzeni", "loj_do_ostrza"]) addItem(state, data, id, 1);
  assert.ok(appetitePercent(state, data) > 50);
  useItem(state, data, "gulasz", fixed(50));
  assert.equal(appetitePercent(state, data), 0);
  useItem(state, data, "napar_z_korzeni", fixed(50));
  useItem(state, data, "loj_do_ostrza", fixed(50));
  const ids = state.character.effects.map((e) => e.id);
  assert.ok(["najedzony", "mocny_napar", "natluszczone_ostrze"].every((id) => ids.includes(id)), ids.join());
});

test("słaby bohater w walce dostaje jedną wskazówkę, gdy HP spadnie do progu", async () => {
  const { lowHpHint } = await import("../src/systems/combat/turn.js");
  const { getStats } = await import("../src/systems/stats.js");
  const { data, combat } = fight();
  const state = combatState(data, "miecz");
  const max = getStats(state, data).derived.hpMax;
  state.character.hp = max;
  assert.deepEqual(lowHpHint(state, data, combat), []);
  state.character.hp = Math.floor((max * data.rules.combat.lowHpPercent) / 100);
  assert.deepEqual(lowHpHint(state, data, combat), [{ type: "slabosc" }]);
  assert.deepEqual(lowHpHint(state, data, combat), [], "tylko raz");
});

test("rozmowa, w której można wziąć zlecenie, jest oznaczona; po wzięciu znak znika", async () => {
  const { dialogueOffersQuest, nodeView } = await import("../src/systems/dialogue.js");
  const { startQuest } = await import("../src/systems/quests.js");
  const data = minimalData();
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  assert.equal(dialogueOffersQuest(state, data, "wrzosek"), true);
  assert.equal(nodeView(state, data, "wrzosek", "powitanie").options.find((o) => o.key === "robota").offer, true);
  startQuest(state, data, "lek_dla_wrzoska");
  assert.equal(dialogueOffersQuest(state, data, "wrzosek"), false);
  assert.equal(dialogueOffersQuest(state, data, "szkarad"), false, "rozmowa bez zlecenia");
});

const ROAD_ASKS = [
  ["siodlo_dla_zwiadowcow", "naprawione_siodlo", "trakt_kupiecki"], ["swiece_na_kapliczke", "swiece_woskowe", "kapliczka_rozstaje"],
  ["zwoj_dla_pustelnika", "zwoj_pustelnika", "krater_gwiazdy"], ["buty_dla_wartownika", "buty_wartownika", "przeprawa_szarej"],
  ["chleb_dla_grabarza", "bochen_dla_grabarza", "cmentarz_zbiorowy"], ["gwozdzie_dla_stoczni", "skrzynka_gwozdzi", "stocznia"],
];
for (const [id, item, dest] of ROAD_ASKS) {
  test(`prośba z drogi „${id}”: zgoda daje przesyłkę i miejsce, dostawa kończy zlecenie`, async () => {
    const { startQuest, advanceErrands } = await import("../src/systems/quests.js");
    const { runActions } = await import("../src/systems/actions.js");
    const { countOf } = await import("../src/systems/inventory.js");
    const { isKnown } = await import("../src/systems/places.js");
    const data = minimalData();
    const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
    const cs = combatState(data, "miecz");
    state.character = cs.character;
    state.inventory = cs.inventory;
    startQuest(state, data, id);
    assert.equal(countOf(state, item), 1);
    assert.equal(isKnown(state, data, dest), true);
    const delivery = data.dialogues.find((d) => d.id === `dostawa_${id}`);
    runActions(state, data, delivery.nodes.odebrane.actions, fixed(50));
    advanceErrands(state, data, fixed(50));
    assert.equal(state.quests[id].status, "done");
    assert.equal(countOf(state, item), 0);
  });
}

test("im więcej miejsc w okolicy, tym więcej dalekich i tym większa szansa na spotkanie w drodze", async () => {
  const { loadData } = await import("../src/engine/data.js");
  const { crowdBonus } = await import("../src/systems/travel.js");
  const data = await loadData();
  const places = {};
  for (const l of data.travel.locations) if (l.near || l.far) (places[l.region] ??= []).push(l);
  for (const [region, list] of Object.entries(places)) {
    if (list.length < 7) continue;
    const far = list.filter((l) => l.far).length;
    assert.ok(far >= Math.ceil(list.length * 0.35), `${region}: ${far} z ${list.length}`);
  }
  assert.ok(crowdBonus(data, "stolica") > crowdBonus(data, "jarnowo"));
  assert.equal(crowdBonus(data, "loch"), 0);
});
