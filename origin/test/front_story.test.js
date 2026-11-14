import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createSceneList, runStory } from "../src/engine/loop.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { createRng } from "../src/engine/dice.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const real = await loadData();
// No random road events: the three-day march to the camp is scripted stage by stage.
const data = structuredClone(real);
data.rules.travel.eventChance = 0;
data.rules.travel.dangerousEventChance = 0;
const SLEEP = ["1+++", "2", ""];
const STAGE = ["", "", "", ...SLEEP];
const TRIP_TO_CAMP = [...STAGE, ...STAGE, ...STAGE];
const lowRng = { int: (lo) => lo, setState() {}, getState: () => 0 };

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function atTheObservatory(classId, sceneId = "akt3b_przejscie") {
  const state = createNewState({ seed: 1, startScene: sceneId, rules: data.rules });
  const cs = combatState(data, classId);
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 60;
  state.time.minutes = 8 * 60;
  state.world.location = "obserwatorium";
  state.world.phenomenonRolledDay = 99;
  state.flags.akt3b_koniec = true;
  return state;
}
async function play(state, plan, { ends = false } = {}) {
  const io = createAdaptiveIO(plan);
  const ctx = { state, data, io, rng: lowRng, debug: false, story: createSceneList(data.story.scenes), notices: [] };
  if (ends) await runStory(ctx);
  else await assert.rejects(runStory(ctx), InputExhaustedError);
  return stripVTControlCharacters(io.text()).replace(/\s+/g, " ");
}

test("fabuła: Akt III kończy się narracją bez „to jeszcze nie koniec”, a Akt IV idzie w ustalonym porządku scen", () => {
  const ids = data.story.scenes.map((s) => s.id);
  const order = ["akt3b_final", "akt3b_kuznia", "akt3b_przejscie", "akt4_droga", "akt4_wejscie", "akt4_mapa", "akt4_odpoczynek", "akt4_zapis", "akt4_dalej", "akt4a_przejscie", "akt4_stolica_droga", "akt4_stolica_wejscie", "akt4_stolica_mapa", "akt4_stolica_odpoczynek", "akt4_stolica_zapis", "akt4_stolica_dalej", "akt4b_przejscie"];
  assert.deepEqual(order.map((id) => ids.indexOf(id)).every((i, k, a) => i >= 0 && (k === 0 || i > a[k - 1])), true, "porządek scen");
  const close = data.story.scenes.find((s) => s.id === "akt3b_przejscie");
  assert.equal(close.type, "narration");
  assert.doesNotMatch(close.text, /JESZCZE NIE KONIEC/i);
  const map = data.story.scenes.find((s) => s.id === "akt4_mapa");
  assert.deepEqual([map.hub, map.arriveAt, map.leaves, map.starts, map.exitWhen.goto], ["oboz_wronia", "oboz_wronia", "obserwatorium", ["watek_front"], "akt4a_przejscie"]);
  assert.deepEqual(map.exitWhen.if, { flag: "akt4a_koniec" });
  assert.equal(data.story.scenes.find((s) => s.id === "akt4_droga").route, "obserwatorium_front");
  assert.equal(data.story.scenes.find((s) => s.id === "akt4a_przejscie").type, "narration");
  assert.equal(data.story.scenes.find((s) => s.id === "akt4b_przejscie").type, "narration");
  assert.deepEqual(validateData(data), []);
});

for (const classId of ["miecz", "wlocznia"]) {
  test(`fabuła (${classId}): z Obserwatorium trzema dniami marszu do obozu – wątek frontu rusza, gracz stoi w obozie`, async () => {
    const state = atTheObservatory(classId);
    const text = await play(state, ["", ...TRIP_TO_CAMP, ""]);
    assert.match(text, /Wronią Górą/);
    assert.equal(state.world.location, "oboz_wronia");
    assert.equal(state.quests.watek_front.status, "active");
    assert.ok(state.time.minutes >= 8 * 60 + 2 * 24 * 60, "droga trwa trzy dni");
    assert.equal(state.scene.id, "akt4_mapa");
  });
}

test("fabuła: flaga akt4a_koniec w obozie prowadzi do narracji o drodze do stolicy", async () => {
  const state = atTheObservatory("miecz", "akt4_mapa");
  state.world.location = "oboz_wronia";
  state.flags.akt4a_koniec = true;
  const text = await play(state, [""]);
  assert.equal(state.scene.id, "akt4_stolica_droga");
  assert.match(text, /droga do miasta/);
});

test("fabuła: zapis na scenie akt3b_przejscie z czasów, gdy była zakończeniem, wczytuje się i gra dalej", async () => {
  const old = atTheObservatory("miecz");
  await saveGame("1", old, createRng(1));
  const loaded = await loadGame("1", data, { warnings: [] });
  assert.equal(loaded.scene.id, "akt3b_przejscie");
  assert.equal(data.story.scenes.find((s) => s.id === loaded.scene.id).type, "narration");
});

// --- bilans frontu (Task 7) ---
test("bilans: trzy najtańsze zlecenia nie wystarczą na kolczugę z kuźni, wszystkie sześć tak; xp zleceń to co najmniej dwa poziomy", () => {
  const QS = ["zold_dla_garnizonu", "most_bez_straznika", "furman_z_beczkami", "studnia_pod_skjeldowem", "rannych_sie_nie_liczy", "dwoch_dezerterow"];
  const reward = (q, key) => data.quests.find((x) => x.id === q).onComplete.filter((a) => a[key]).reduce((s, a) => s + a[key], 0);
  const money = QS.map((q) => reward(q, "giveMoney")).sort((a, b) => a - b);
  const price = Math.round(data.items.find((i) => i.id === "kolczuga_straznicza").value * data.rules.shop.buyBase);
  assert.ok(money.slice(0, 3).reduce((a, b) => a + b) < price, `trzy zlecenia ${money.slice(0, 3)} vs ${price}`);
  assert.ok(money.reduce((a, b) => a + b) >= price, `sześć zleceń ${money} vs ${price}`);
  assert.ok(QS.map((q) => reward(q, "xp")).reduce((a, b) => a + b) >= 2 * data.rules.leveling.xpStep);
});
