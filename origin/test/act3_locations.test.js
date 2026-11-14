import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { combatState } from "./helpers.js";
import { enterNode } from "../src/systems/dialogue.js";
import { startQuest, advanceErrands } from "../src/systems/quests.js";
import { isKnown } from "../src/systems/places.js";
import { walkMinutes } from "../src/systems/travel.js";

const data = await loadData();
const fixed = { int: () => 1 };
const ids = ["bor_klusownikow", "stary_trakt", "kapliczka_rozstaje", "kamieniolom", "bagna_szarej_wody", "wzgorze_wartownicze"];

function fresh() {
  const state = createNewState({ seed: 1, startScene: "akt3_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 50;
  state.world.location = "gluszec";
  return state;
}

test("sześć lokacji okolicy Głuszca: ukryte na starcie, wszystkie na mapie, czasy marszu z mapy", () => {
  const state = fresh();
  for (const id of ids) {
    const loc = data.travel.locations.find((l) => l.id === id);
    assert.equal(loc.region, "glusz");
    assert.ok(loc.spots.length >= 2 && loc.spots.length <= 6, id);
    assert.ok(loc.hint, id);
    assert.equal(isKnown(state, data, id), false, id);
    assert.ok(data.maps.glusz.includes(`{${id}}`), id);
  }
  assert.equal(walkMinutes(data, "gluszec", "wzgorze_wartownicze"), 30 + 20);
  assert.equal(walkMinutes(data, "kapliczka_rozstaje", "wzgorze_wartownicze"), 20);
});

test("Swój w osadzie: sołtys pyta w 3 wymianach, nocleg u Mruka, potwierdzenie – nagroda i odkryte miejsca", () => {
  const state = fresh();
  startQuest(state, data, "przyjecie_w_osadzie");
  const money = state.character.money;
  const go = (d, n) => { enterNode(state, data, d, n, fixed); advanceErrands(state, data, fixed); };
  go("soltys", "p1");
  go("soltys", "p2");
  go("soltys", "p3");
  assert.equal(state.flags.soltys_przyjal, undefined, "przyjęcie dopiero po odpowiedzi na trzecie pytanie");
  go("soltys", "przyjety");
  assert.equal(state.flags.soltys_przyjal, true);
  assert.equal(isKnown(state, data, "bor_klusownikow"), true);
  assert.equal(isKnown(state, data, "stary_trakt"), true);
  assert.equal(isKnown(state, data, "kapliczka_rozstaje"), false, "tylko wskazówka");
  assert.ok(state.world.hinted.includes("kapliczka_rozstaje"));
  assert.equal(state.quests.przyjecie_w_osadzie.status, "active");
  go("karczmarz_kogut", "nocleg_ok");
  assert.equal(state.character.money, money - 3);
  assert.equal(state.quests.przyjecie_w_osadzie.status, "active", "jeszcze raport u sołtysa");
  go("soltys", "potwierdz");
  assert.equal(state.quests.przyjecie_w_osadzie.status, "done");
  assert.equal(state.character.money, money - 3 + 10);
});

test("Swój w osadzie: ścieżka bez rzutu i bez pieniędzy też przechodzi; start z akt3_przyjecie", () => {
  const scene = data.story.scenes.find((s) => s.id === "akt3_mapa");
  assert.deepEqual(scene.starts, ["przyjecie_w_osadzie", "watek_gluszec"]);
  const nodes = data.dialogues.find((d) => d.id === "soltys").nodes;
  for (const n of ["p1", "p2", "p3"]) assert.ok(nodes[n].options.some((o) => !o.requires && !o.check), `${n}: opcja bez warunków`);
});
