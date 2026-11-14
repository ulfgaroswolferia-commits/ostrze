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
const data = structuredClone(real);
data.rules.travel.eventChance = 0;
data.rules.travel.dangerousEventChance = 0;
const SLEEP = ["1+++", "2", ""];
const STAGE = ["", "", "", ...SLEEP];
const TRIP = [...STAGE, ...STAGE, ...STAGE];
const lowRng = { int: (lo) => lo, setState() {}, getState: () => 0 };

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function atTheCamp(classId, sceneId = "akt4a_przejscie") {
  const state = createNewState({ seed: 1, startScene: sceneId, rules: data.rules });
  const cs = combatState(data, classId);
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 60;
  state.time.minutes = 8 * 60;
  state.world.location = "oboz_wronia";
  state.world.phenomenonRolledDay = 99;
  state.flags.akt4a_koniec = true;
  return state;
}
async function play(state, plan, { ends = false } = {}) {
  const io = createAdaptiveIO(plan);
  const ctx = { state, data, io, rng: lowRng, debug: false, story: createSceneList(data.story.scenes), notices: [] };
  if (ends) await runStory(ctx);
  else await assert.rejects(runStory(ctx), InputExhaustedError);
  return stripVTControlCharacters(io.text()).replace(/\s+/g, " ");
}

test("fabuła stolicy: porządek scen i parametry mapy", () => {
  const ids = data.story.scenes.map((s) => s.id);
  const order = ["akt4a_przejscie", "akt4_stolica_droga", "akt4_stolica_wejscie", "akt4_stolica_mapa", "akt4_stolica_odpoczynek", "akt4_stolica_zapis", "akt4_stolica_dalej", "akt4b_przejscie"];
  assert.ok(order.map((id) => ids.indexOf(id)).every((i, k, a) => i >= 0 && (k === 0 || i > a[k - 1])));
  const map = data.story.scenes.find((s) => s.id === "akt4_stolica_mapa");
  assert.deepEqual([map.hub, map.arriveAt, map.leaves, map.starts, map.exitWhen.goto, map.exitWhen.if], ["ulfgrod", "ulfgrod", "oboz_wronia", ["watek_ulfgrod"], "akt4b_przejscie", { flag: "akt4b_koniec" }]);
  assert.equal(data.story.scenes.find((s) => s.id === "akt4_stolica_droga").route, "oboz_wronia_ulfgrod");
  assert.deepEqual(validateData(data), []);
});

for (const classId of ["miecz", "wlocznia"]) {
  test(`fabuła stolicy (${classId}): z obozu trzy dni do Ulfgrodu – wątek stolicy rusza, gracz stoi w mieście`, async () => {
    const state = atTheCamp(classId);
    const text = await play(state, ["", ...TRIP, ""]);
    assert.match(text, /Ulfgród w stanie wojennym/);
    assert.equal(state.world.location, "ulfgrod");
    assert.equal(state.quests.watek_ulfgrod.status, "active");
    assert.ok(state.time.minutes >= 8 * 60 + 2 * 24 * 60, "droga trwa trzy dni");
    assert.equal(state.scene.id, "akt4_stolica_mapa");
  });
}

test("fabuła stolicy: akt4b_koniec w mieście prowadzi schodami w dół do lochu pod pałacem", async () => {
  const state = atTheCamp("miecz", "akt4_stolica_mapa");
  state.world.location = "ulfgrod";
  state.flags.akt4b_koniec = true;
  assert.match(await play(state, [""]), /Cesarz nie żyje/);
  assert.equal(state.scene.id, "schody_1_wstep", "najpierw schody z upiorami");
  state.scene.id = "akt4c_loch_mapa";
  await play(state, []);
  assert.equal(state.world.location, "loch_pod_palacem");
  assert.equal(state.quests.watek_loch.status, "active");
});

test("fabuła stolicy: zapis w środku drogi do Ulfgrodu wczytuje się i droga dobiega końca", async () => {
  const state = atTheCamp("miecz");
  const first = createAdaptiveIO(["", ...STAGE, "^C"]);
  await assert.rejects(runStory({ state, data, io: first, rng: lowRng, debug: false, story: createSceneList(data.story.scenes), notices: [] }));
  await saveGame("1", state, createRng(1));
  const loaded = await loadGame("1", data, { warnings: [] });
  const text = await play(loaded, [...STAGE, ...STAGE, ""]);
  assert.equal(loaded.world.location, "ulfgrod");
  assert.match(text, /Ulfgród/);
});

test("bilans stolicy: trzy najtańsze zlecenia nie wystarczą na półpancerz ze Składu Pod Murem, osiem tak; xp zleceń to co najmniej dwa poziomy", () => {
  const QS = ["kto_pali_w_zaulku", "zaginiony_skarbnik", "wino_dla_koszar", "dlug_przekupki", "cmentarz_bez_nazwisk", "list_dla_marszalka", "przemyt_z_portu", "smyk_i_klucz"];
  const reward = (q, key) => data.quests.find((x) => x.id === q).onComplete.filter((a) => a[key]).reduce((s, a) => s + a[key], 0);
  const money = QS.map((q) => reward(q, "giveMoney")).sort((a, b) => a - b);
  const price = Math.round(data.items.find((i) => i.id === "polpancerz").value * data.rules.shop.buyBase);
  assert.ok(money.slice(0, 3).reduce((a, b) => a + b) < price, `trzy zlecenia ${money.slice(0, 3)} vs ${price}`);
  assert.ok(money.reduce((a, b) => a + b) >= price, `osiem zleceń ${money} vs ${price}`);
  assert.ok(QS.map((q) => reward(q, "xp")).reduce((a, b) => a + b) >= 2 * data.rules.leveling.xpStep);
});

test("fabuła lochu: po pokonaniu Pełnomocnika Cisza po cesarzu i Dług spłacony prowadzą do przepustki na wyspę", async () => {
  const state = atTheCamp("miecz", "akt4c_loch_mapa");
  state.world.location = "loch_pod_palacem";
  Object.assign(state.flags, { akt4b_koniec: true, pelnomocnik_pokonany: true, noc_bunt: true });
  state.vars.wola = 4;
  const text = await play(state, ["", "", "", "", "1", "1", "1", ""]);
  assert.match(text, /Cisza po cesarzu|Marszałek Wsiewłod/);
  assert.match(text, /Tomasz/);
  assert.match(text, /nie wrócicie tam, skąd przylecieliście/);
  assert.equal(state.flags.dlug_splacony, true);
  assert.equal(state.flags.istota_wyrok, true);
  assert.ok(["akt4c_przejscie", "akt5_droga"].includes(state.scene.id), state.scene.id);
  assert.match(text, /przepustk/);
});

test("stary zapis na akt4b_przejscie (dawniej zakończenie) wczytuje się i prowadzi do lochu", async () => {
  const state = atTheCamp("miecz", "akt4b_przejscie");
  state.world.location = "ulfgrod";
  Object.assign(state.flags, { akt4b_koniec: true });
  await saveGame("1", state, createRng(1));
  const loaded = await loadGame("1", data, { warnings: [] });
  assert.equal(loaded.scene.id, "akt4b_przejscie");
  assert.match(await play(loaded, [""]), /Cesarz nie żyje/);
  assert.equal(loaded.scene.id, "schody_1_wstep");
  loaded.scene.id = "akt4c_loch_mapa";
  await play(loaded, []);
  assert.equal(loaded.world.location, "loch_pod_palacem");
});

test("wejście do Ulfgrodu pokazuje mury stolicy, a wejście do Głuszca wieś (obrazki nie są zamienione)", () => {
  const art = (id) => data.story.scenes.find((s) => s.id === id).art;
  assert.equal(art("akt4_stolica_wejscie"), "ulfgrod");
  assert.equal(art("akt3_wejscie"), "gluszec");
  assert.ok(data.art.ulfgrod && data.art.gluszec);
});
