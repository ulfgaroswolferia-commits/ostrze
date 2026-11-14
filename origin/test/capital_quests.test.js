import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { evaluate } from "../src/engine/conditions.js";
import { combatState } from "./helpers.js";
import { runActions } from "../src/systems/actions.js";
import { startQuest, advanceErrands, boardQuests, currentObjectives } from "../src/systems/quests.js";
import { isKnown } from "../src/systems/places.js";

const data = await loadData();
const HUB = "ulfgrod";
const QUESTS = {
  kto_pali_w_zaulku: "zaulek_szklarzy.pracownia_alchemika",
  zaginiony_skarbnik: "dom_ciszy.krypta_ciszy",
  wino_dla_koszar: "koszary.plac_apelowy",
  dlug_przekupki: "targ_pod_murem.plotki",
  cmentarz_bez_nazwisk: "cmentarz_zbiorowy.grabarz",
  list_dla_marszalka: "port_rzeczny.nabrzeze",
  przemyt_z_portu: "ulfgrod.fontanna",
  smyk_i_klucz: "stare_wodociagi.kanal_glowny",
};
const dialogue = (id) => data.dialogues.find((d) => d.id === id);
const pisarz = dialogue("pisarz");
const actionsOf = (node) => node.actions ?? [];

function hero() {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 100;
  state.time.minutes = 12 * 60;
  return state;
}
const outcomes = (q) => Object.entries(dialogue(`rozstrzygniecie_${q}`).nodes).filter(([, n]) => actionsOf(n).some((a) => a.setFlag?.startsWith("stolica_")));
const flagOf = (node) => actionsOf(node).find((a) => a.setFlag?.startsWith("stolica_")).setFlag;
const reportOption = (flag) => pisarz.nodes[pisarz.start].options.find((o) => JSON.stringify(o.requires ?? {}).includes(`"${flag}"`));

test("stolica: osiem zleceń na tablicy, każde z dwoma celami (miejsce i biuro pisarza), dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  for (const [id, place] of Object.entries(QUESTS)) {
    const q = data.quests.find((x) => x.id === id);
    assert.ok(q && q.kind === "errand" && q.hub === HUB && q.board === true, id);
    assert.equal(q.objectives.length, 2, id);
    assert.equal(q.objectives[0].at, place);
    assert.equal(q.objectives[1].at, `${HUB}.biuro_pisarza`);
    assert.ok(q.onStart.some((a) => a.reveal), `${id}: reveal celu`);
  }
  assert.equal(boardQuests(hero(), data, HUB).filter((q) => q.id in QUESTS).length, 8);
});

for (const q of Object.keys(QUESTS)) {
  test(`zlecenie „${q}”: każde rozstrzygnięcie kończy zlecenie z rozliczeniem u pisarza i ustawia dokładnie jedną flagę`, () => {
    const outs = outcomes(q);
    assert.ok(outs.length >= 2, `${q}: za mało rozstrzygnięć`);
    const flags = new Set(outs.map(([, n]) => flagOf(n)));
    for (const [nodeId, node] of outs) {
      const state = hero();
      startQuest(state, data, q);
      runActions(state, data, actionsOf(node), createRng(1));
      assert.equal(state.flags[`${q}_zrobione`], true, `${q}/${nodeId}`);
      assert.equal([...flags].filter((f) => state.flags[f]).length, 1);
      const option = reportOption(flagOf(node));
      assert.ok(option && evaluate(option.requires, state, data), `${q}/${nodeId}: opcja rozliczenia`);
      runActions(state, data, actionsOf(pisarz.nodes[option.goto]), createRng(1));
      advanceErrands(state, data, createRng(1));
      assert.equal(state.quests[q].status, "done", `${q}/${nodeId}`);
      assert.equal(state.vars.zlecenia_stolicy, 1);
    }
  });
}

test("zlecenia stolicy: każde ma co najmniej dwa rozstrzygnięcia bez warunku i bez rzutu", () => {
  for (const q of Object.keys(QUESTS)) {
    const d = dialogue(`rozstrzygniecie_${q}`);
    assert.ok(d.nodes[d.start].options.filter((o) => !o.requires && !o.check).length >= 2, q);
  }
});

test("zlecenia stolicy: dowolna kolejność, wszystkie osiem daje zlecenia_stolicy = 8", () => {
  const state = hero();
  for (const q of Object.keys(QUESTS).reverse()) {
    startQuest(state, data, q);
    const [, node] = outcomes(q)[0];
    runActions(state, data, actionsOf(node), createRng(1));
    const option = reportOption(flagOf(node));
    runActions(state, data, actionsOf(pisarz.nodes[option.goto]), createRng(1));
    advanceErrands(state, data, createRng(1));
  }
  assert.equal(state.vars.zlecenia_stolicy, 8);
  assert.ok(Object.keys(QUESTS).every((q) => state.quests[q].status === "done"));
});

test("wątek stolicy: pięć kroków; dowód i pałac dopiero po trzech zleceniach; pałac zamknięty do rozmowy ze Smykiem", () => {
  const t = data.quests.find((q) => q.id === "watek_ulfgrod");
  assert.ok(t && t.main === true && t.hub === HUB && t.objectives.length === 5);
  const state = hero();
  startQuest(state, data, "watek_ulfgrod");
  const texts = () => currentObjectives(state, data).filter((c) => c.quest.id === "watek_ulfgrod").map((c) => c.objective.text);
  assert.equal(texts().length, 1);
  assert.match(texts()[0], /Hjalmar/);
  state.flags.hjalmar_poznany = state.flags.smyk_poznany = true;
  advanceErrands(state, data, createRng(1));
  assert.match(texts()[0], /trzy sprawy/);
  state.vars.zlecenia_stolicy = 3;
  advanceErrands(state, data, createRng(1));
  assert.match(texts()[0], /dowód/i);
  // the proof: both ways give it, neither before three jobs
  for (const [id, node, key] of [["siostra_domu_ciszy", "cisza", "dowod"], ["kwatermistrz_koszar", "kwit", "falsz"]]) {
    const option = dialogue(id).nodes[node].options.find((o) => o.id === key);
    const fresh = hero();
    assert.equal(evaluate(option.requires, fresh, data), false, `${id}: przed trzema zleceniami`);
    fresh.vars.zlecenia_stolicy = 3;
    assert.equal(evaluate(option.requires, fresh, data), true, `${id}: po trzech`);
  }
  const smyk = dialogue("smyk");
  const open = smyk.nodes.ulica.options.find((o) => o.id === "otwiera");
  assert.equal(evaluate(open.requires, state, data), false, "bez dowodu Smyk nie otwiera");
  assert.equal(isKnown(state, data, "palac"), false, "pałac jest ukryty");
  state.flags.dowod_zywego = true;
  assert.equal(evaluate(open.requires, state, data), true);
  runActions(state, data, actionsOf(smyk.nodes.otwiera), createRng(1));
  assert.equal(state.flags.palac_otwarty, true);
  assert.equal(isKnown(state, data, "palac"), true);
});

test("pałac: wejścia z zewnątrz nie ma – tylko rozmowa ze Smykiem ujawnia lokację (reveal)", () => {
  const holders = [];
  const walk = (o, path) => { if (o && typeof o === "object") { if (o.reveal === "palac") holders.push(path); for (const [k, v] of Object.entries(o)) walk(v, `${path}/${k}`); } };
  walk({ d: data.dialogues, q: data.quests, t: data.travel, s: data.story }, "");
  assert.equal(holders.length, 1, holders.join("\n"));
});

test("Smyk sam zaczepia po trzech zleceniach (gość), jeśli pałac jeszcze nie jest otwarty", () => {
  const v = data.travel.locations.find((l) => l.id === HUB).visitors.find((x) => x.id === "smyk_wola");
  assert.ok(v && !v.forced);
  const state = hero();
  assert.equal(evaluate(v.if, state, data), false);
  state.vars.zlecenia_stolicy = 3;
  assert.equal(evaluate(v.if, state, data), true);
  state.flags.palac_otwarty = true;
  assert.equal(evaluate(v.if, state, data), false);
});

test("wątek stolicy: ostatni krok wskazuje komnatę tronową po otwarciu pałacu przez Smyka", () => {
  const t = data.quests.find((q) => q.id === "watek_ulfgrod");
  assert.equal(t.objectives.at(-2).at, `${HUB}.smyk_ulica`);
  assert.deepEqual(t.objectives.at(-2).done, { flag: "palac_otwarty" });
  assert.equal(t.objectives.at(-1).at, "palac.komnata_tronowa");
  assert.deepEqual(t.objectives.at(-1).done, { flag: "akt4b_koniec" });
  const state = hero();
  startQuest(state, data, "watek_ulfgrod");
  Object.assign(state.flags, { hjalmar_poznany: true, smyk_poznany: true, dowod_zywego: true, palac_otwarty: true });
  state.vars.zlecenia_stolicy = 3;
  advanceErrands(state, data, createRng(1));
  const cur = currentObjectives(state, data).find((c) => c.quest.id === "watek_ulfgrod");
  assert.equal(cur.objective.at, "palac.komnata_tronowa");
});

test("Smyk (gość) nie każe zdobywać papieru temu, kto już ma dowód", () => {
  const v = data.travel.locations.find((l) => l.id === HUB).visitors.find((x) => x.id === "smyk_wola");
  const playedText = (st) => v.scenes.filter((s) => s.type === "narration" && (!s.if || evaluate(s.if, st, data))).map((s) => s.text).join(" ");
  const st = hero();
  assert.match(playedText(st), /zdobądź papier/);
  st.flags.dowod_zywego = true;
  assert.doesNotMatch(playedText(st), /zdobądź papier/);
  assert.match(playedText(st), /ma pan już papier/);
});
