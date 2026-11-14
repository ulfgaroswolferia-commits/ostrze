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
const HUB = "przystan_jarnowo";
const QUESTS = {
  lodz_bez_zalogi: "cmentarz_lodzi.lodzie_na_piasku",
  kowal_i_rusznice: "kuznie.zar_paleniska",
  wiesci_z_ladu: "stocznia.szkielet_lodzi",
  przejscie_smyka: "oboz_hetmana.plac_obozowy",
  rozpoznanie_urzadzenia: "przystan_jarnowo.stol_kreslarski",
};
const dialogue = (id) => data.dialogues.find((d) => d.id === id);
const kapitan = dialogue("kapitan_przystani");
const actionsOf = (node) => node.actions ?? [];

function hero(flags = {}) {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.character.money = 100;
  state.time.minutes = 12 * 60;
  Object.assign(state.flags, flags);
  return state;
}
const rozstr = (q) => dialogue(`rozstrzygniecie_${q}`);
const outcomes = (q) => Object.entries(rozstr(q).nodes).filter(([, n]) => actionsOf(n).some((a) => a.setFlag?.startsWith("jarnowo_")));
const flagOf = (node) => actionsOf(node).find((a) => a.setFlag?.startsWith("jarnowo_")).setFlag;
const reportOption = (flag) => kapitan.nodes[kapitan.start].options.find((o) => JSON.stringify(o.requires ?? {}).includes(`"${flag}"`));

test("Jarnowo: pięć zleceń na tablicy, każde z dwoma celami (miejsce i biuro kapitana), dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  for (const [id, place] of Object.entries(QUESTS)) {
    const q = data.quests.find((x) => x.id === id);
    assert.ok(q && q.kind === "errand" && q.hub === HUB && q.board === true, id);
    assert.equal(q.objectives.length, 2, id);
    assert.equal(q.objectives[0].at, place);
    assert.equal(q.objectives[1].at, `${HUB}.biuro_kapitana`);
  }
});

for (const q of Object.keys(QUESTS)) {
  test(`zlecenie „${q}”: każde rozstrzygnięcie ustawia dokładnie jedną flagę, kończy zlecenie z rozliczeniem u kapitana i liczy się do zlecenia_jarnowa`, () => {
    const outs = outcomes(q);
    assert.ok(outs.length >= 2, `${q}: za mało rozstrzygnięć`);
    const flags = new Set(outs.map(([, n]) => flagOf(n)));
    for (const [nodeId, node] of outs) {
      const state = hero({ palac_otwarty: true });
      startQuest(state, data, q);
      runActions(state, data, actionsOf(node), createRng(1));
      assert.equal(state.flags[`${q}_zrobione`], true, `${q}/${nodeId}`);
      assert.equal([...flags].filter((f) => state.flags[f]).length, 1);
      const option = reportOption(flagOf(node));
      assert.ok(option && evaluate(option.requires, state, data), `${q}/${nodeId}: opcja rozliczenia`);
      runActions(state, data, actionsOf(kapitan.nodes[option.goto]), createRng(1));
      advanceErrands(state, data, createRng(1));
      assert.equal(state.quests[q].status, "done", `${q}/${nodeId}`);
      assert.equal(state.vars.zlecenia_jarnowa, 1);
    }
  });
}

test("zlecenia wyspy: ≥2 rozstrzygnięcia bez warunku i bez rzutu (poza wariantami sojuszników)", () => {
  for (const q of Object.keys(QUESTS)) {
    const d = rozstr(q);
    const options = Object.values(d.nodes).flatMap((n) => n.options ?? []).filter((o) => o.goto?.startsWith("wynik"));
    assert.ok(new Set(options.filter((o) => !o.requires && !o.check).map((o) => o.goto)).size >= 2, q);
  }
});

test("zlecenia wyspy: gracz bez żadnego sojusznika ma co najmniej trzy dostępne zlecenia (wątek nie utyka)", () => {
  const state = hero();
  const available = boardQuests(state, data, HUB).filter((q) => q.id in QUESTS);
  assert.ok(available.length >= 3, available.map((q) => q.id).join());
  assert.ok(!available.some((q) => q.id === "przejscie_smyka"), "Smyk dopiero po otwarciu pałacu");
  state.flags.palac_otwarty = true;
  assert.equal(boardQuests(state, data, HUB).filter((q) => q.id in QUESTS).length, 5);
});

test("zlecenia wyspy: dowolna kolejność, wszystkie pięć daje zlecenia_jarnowa = 5", () => {
  const state = hero({ palac_otwarty: true });
  for (const q of Object.keys(QUESTS).reverse()) {
    startQuest(state, data, q);
    const [, node] = outcomes(q)[0];
    runActions(state, data, actionsOf(node), createRng(1));
    const option = reportOption(flagOf(node));
    runActions(state, data, actionsOf(kapitan.nodes[option.goto]), createRng(1));
    advanceErrands(state, data, createRng(1));
  }
  assert.equal(state.vars.zlecenia_jarnowa, 5);
});

test("rozpoznanie urządzenia: Brygida zawsze, Hieronim tylko pod sojusz_astrolog; ujawnia Łysą Skałę", () => {
  const d = rozstr("rozpoznanie_urzadzenia");
  const start = d.nodes[d.start].options;
  const visible = (flags) => start.filter((o) => !o.requires || evaluate(o.requires, hero(flags), data)).map((o) => o.goto);
  assert.deepEqual(visible({}), ["urzadzenie"]);
  assert.deepEqual(visible({ sojusz_astrolog: true }), ["urzadzenie", "urzadzenie_h"]);
  assert.doesNotMatch(JSON.stringify(d.nodes.urzadzenie), /Hieronim/);
  assert.match(JSON.stringify(d.nodes.urzadzenie_h), /Hieronim/);
  assert.match(JSON.stringify(d.nodes), /"reveal":"lysa_skala"/);
  assert.ok(data.quests.find((x) => x.id === "rozpoznanie_urzadzenia").onStart.some((a) => a.reveal === "lysa_skala"));
});

test("wieści z lądu: nadawca zależy od sojuszników, bazowo list od komendanta Wszebora", () => {
  const d = rozstr("wiesci_z_ladu");
  const first = d.nodes[d.start].options.filter((o) => o.requires || o.id === "baza");
  const pick = (flags) => first.find((o) => !o.requires || evaluate(o.requires, hero(flags), data)).goto;
  assert.equal(pick({ sojusz_dezerter: true }), "tomasz");
  assert.equal(pick({ sojusz_wedrowcy: true }), "wedrowcy");
  assert.equal(pick({ sojusz_straznicy: true }), "straznik");
  assert.equal(pick({}), "wszebor");
  assert.match(JSON.stringify(d.nodes.wszebor), /Wszebor/);
});

test("wątek wyspy: cztery kroki; zlecenia ≥3, rozmowa z hetmanem, potem Brama; Dom z Czarnego Szkła daje dowód", () => {
  const t = data.quests.find((q) => q.id === "watek_jarnowo");
  assert.ok(t && t.main === true && t.hub === HUB && t.objectives.length === 4);
  const state = hero();
  startQuest(state, data, "watek_jarnowo");
  const texts = () => currentObjectives(state, data).filter((c) => c.quest.id === "watek_jarnowo").map((c) => c.objective.text);
  assert.equal(texts().length, 1);
  state.flags.kapitan_przystani_poznany = true;
  advanceErrands(state, data, createRng(1));
  assert.match(texts()[0], /trzy sprawy/);
  state.vars.zlecenia_jarnowa = 3;
  advanceErrands(state, data, createRng(1));
  assert.match(texts()[0], /Skjeldomir|hetman/i);
  state.flags.hetman_rozmowa = true;
  advanceErrands(state, data, createRng(1));
  assert.equal(currentObjectives(state, data).find((c) => c.quest.id === "watek_jarnowo").objective.at, "lysa_skala.brama");
  assert.equal(isKnown(state, data, "dom_czarnego_szkla"), false, "ukryty do odkrycia");
});

test("hetman: rozmowa dostępna bez dowodu; z jarnowo_dowod daje hetman_przekonany; ton ostrzejszy pod istota_wyrok", () => {
  const d = dialogue("hetman");
  const start = d.nodes[d.start].options;
  const visible = (flags) => start.filter((o) => !o.requires || evaluate(o.requires, hero(flags), data)).map((o) => o.id);
  assert.ok(visible({}).length >= 2);
  assert.ok(!visible({}).includes("dowod"));
  assert.ok(visible({ jarnowo_dowod: true }).includes("dowod"));
  assert.ok(start.some((o) => o.requires && JSON.stringify(o.requires).includes("istota_wyrok")));
  const acts = (id) => JSON.stringify(d.nodes[start.find((o) => o.id === id).goto].actions);
  assert.match(acts("dowod"), /hetman_przekonany/);
  assert.match(acts("dowod"), /hetman_rozmowa/);
});

test("przejście Smyka to skrót do namiotu hetmana bez progu zleceń", () => {
  const q = data.quests.find((x) => x.id === "przejscie_smyka");
  assert.deepEqual(q.requires, { flag: "palac_otwarty" });
  const hetman = data.travel.locations.find((l) => l.id === "oboz_hetmana").spots.find((s) => s.id === "namiot_hetmana");
  assert.ok(hetman.if);
  const st = hero({ palac_otwarty: true });
  assert.equal(evaluate(hetman.if, st, data), false);
  st.flags.jarnowo_przejscie_uzyte = true;
  assert.equal(evaluate(hetman.if, st, data), true);
  const st2 = hero();
  st2.vars.zlecenia_jarnowa = 3;
  assert.equal(evaluate(hetman.if, st2, data), true);
});

test("skrót Smyka nie zostawia wątku niedokończonego: cel „zlecenia” zalicza się też po przejściu Smyka", () => {
  const state = hero({ kapitan_przystani_poznany: true, jarnowo_przejscie_uzyte: true, hetman_rozmowa: true, portal_rozbrojony: true });
  startQuest(state, data, "watek_jarnowo");
  advanceErrands(state, data, createRng(1));
  assert.equal(state.quests.watek_jarnowo.status, "done");
});
