import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { evaluate } from "../src/engine/conditions.js";
import { combatState } from "./helpers.js";
import { runActions } from "../src/systems/actions.js";
import { startQuest, advanceErrands, boardQuests, currentObjectives } from "../src/systems/quests.js";
import { countOf } from "../src/systems/inventory.js";

const data = await loadData();
const HUB = "oboz_wronia";
const QUESTS = {
  zold_dla_garnizonu: "ruiny_fortu.brama_fortu",
  most_bez_straznika: "przeprawa_szarej.most",
  furman_z_beczkami: "przeprawa_szarej.straznik_mostu",
  studnia_pod_skjeldowem: "spalona_wies.studnia",
  rannych_sie_nie_liczy: "pole_bitwy.pole",
  dwoch_dezerterow: "oboz_cesarski_przedni.namiot_oficera",
};
const dialogue = (id) => data.dialogues.find((d) => d.id === id);
const kapitan = dialogue("kapitan");

function hero() {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 12 * 60;
  return state;
}
const actionsOf = (node) => node.actions ?? [];
/** Outcome nodes of a quest's deciding dialogue: those that set a wojna_* flag. */
const outcomes = (q) => Object.entries(dialogue(`rozstrzygniecie_${q}`).nodes).filter(([, n]) => actionsOf(n).some((a) => a.setFlag?.startsWith("wojna_")));
const reportOption = (flag) => kapitan.nodes[kapitan.start].options.find((o) => JSON.stringify(o.requires ?? {}).includes(`"${flag}"`) && JSON.stringify(o.requires).includes("_zrobione") === false && o.goto.startsWith("meldunek"));

test("front: sześć zleceń „liść” na tablicy sztabu, każde z dwoma celami, dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  for (const [id, place] of Object.entries(QUESTS)) {
    const q = data.quests.find((x) => x.id === id);
    assert.ok(q && q.kind === "errand" && q.hub === HUB && q.board === true, id);
    assert.equal(q.objectives.length, 2, id);
    assert.equal(q.objectives[0].at, place);
    assert.equal(q.objectives[1].at, `${HUB}.namiot_sztabu`);
  }
  const state = hero();
  assert.equal(boardQuests(state, data, HUB).filter((q) => q.id in QUESTS).length, 6);
});

for (const [q] of Object.entries(QUESTS)) {
  test(`zlecenie „${q}”: każde rozstrzygnięcie kończy zlecenie z meldunkiem i ustawia dokładnie jedną flagę wojny z zestawu`, () => {
    const outs = outcomes(q);
    assert.ok(outs.length >= 2, `${q}: za mało rozstrzygnięć`);
    const questDef = data.quests.find((x) => x.id === q);
    const flags = new Set(outs.flatMap(([, n]) => actionsOf(n).filter((a) => a.setFlag?.startsWith("wojna_")).map((a) => a.setFlag)));
    for (const [nodeId, node] of outs) {
      const state = hero();
      startQuest(state, data, q);
      state.vars.zlecenia_frontu = 0;
      runActions(state, data, actionsOf(node), createRng(1));
      assert.equal(state.flags[`${q}_zrobione`], true, `${q}/${nodeId}: flaga zrobione`);
      assert.equal([...flags].filter((f) => state.flags[f]).length, 1, `${q}/${nodeId}: dokładnie jedna flaga wojny`);
      const mine = [...flags].find((f) => state.flags[f]);
      // the report: the captain has a node for this outcome
      const option = kapitan.nodes[kapitan.start].options.find((o) => JSON.stringify(o.requires ?? {}).includes(`"${mine}"`));
      assert.ok(option, `${q}/${nodeId}: kapitan nie reaguje na ${mine}`);
      assert.ok(evaluate(option.requires, state, data), `${q}/${nodeId}: opcja meldunku dostępna`);
      runActions(state, data, actionsOf(kapitan.nodes[option.goto]), createRng(1));
      advanceErrands(state, data, createRng(1));
      assert.equal(state.quests[q].status, "done", `${q}/${nodeId}: zlecenie zakończone`);
      assert.equal(state.vars.zlecenia_frontu, 1);
      assert.ok(questDef.onComplete.length > 0);
    }
  });
}

test("zlecenia frontu: każde ma co najmniej dwa rozstrzygnięcia bez warunku, a sojusznicy tylko dokładają opcję", () => {
  for (const q of Object.keys(QUESTS)) {
    const d = dialogue(`rozstrzygniecie_${q}`);
    const open = d.nodes[d.start].options.filter((o) => !o.requires && !o.check);
    assert.ok(open.length >= 2, `${q}: tylko ${open.length} opcji bez warunku`);
  }
});

test("zlecenia frontu: da się zrobić w dowolnej kolejności, wszystkie sześć daje zlecenia_frontu = 6", () => {
  const state = hero();
  for (const q of Object.keys(QUESTS).reverse()) {
    startQuest(state, data, q);
    const [, node] = outcomes(q)[0];
    runActions(state, data, actionsOf(node), createRng(1));
    const flag = actionsOf(node).find((a) => a.setFlag?.startsWith("wojna_")).setFlag;
    const option = kapitan.nodes[kapitan.start].options.find((o) => JSON.stringify(o.requires ?? {}).includes(`"${flag}"`));
    runActions(state, data, actionsOf(kapitan.nodes[option.goto]), createRng(1));
    advanceErrands(state, data, createRng(1));
  }
  assert.equal(state.vars.zlecenia_frontu, 6);
  assert.ok(Object.keys(QUESTS).every((q) => state.quests[q].status === "done"));
});

test("wątek główny frontu: trzy kroki, wyjście do stolicy dopiero po trzech zleceniach i koniec aktu zamyka wątek", () => {
  const t = data.quests.find((q) => q.id === "watek_front");
  assert.ok(t && t.main === true && t.hub === HUB && t.objectives.length === 3);
  const state = hero();
  startQuest(state, data, "watek_front");
  const texts = () => currentObjectives(state, data).filter((c) => c.quest.id === "watek_front").map((c) => c.objective.text);
  assert.equal(texts().length, 1);
  const go = kapitan.nodes[kapitan.start].options.find((o) => o.goto === "stolica");
  assert.ok(go, "opcja „Ruszam do stolicy”");
  assert.equal(evaluate(go.requires, state, data), false, "przed trzema zleceniami niedostępna");
  state.vars.zlecenia_frontu = 3;
  state.flags.kapitan_poznany = true;
  assert.equal(evaluate(go.requires, state, data), true);
  advanceErrands(state, data, createRng(1));
  assert.match(texts()[0], /stolic|Ulfgrod/i);
  runActions(state, data, actionsOf(kapitan.nodes.wyjazd), createRng(1));
  advanceErrands(state, data, createRng(1));
  assert.equal(state.flags.akt4a_koniec, true);
  assert.equal(state.quests.watek_front.status, "done");
});

test("zlecenie żołdu: skrzynia wraca do garnizonu albo do kieszeni – przedmiot fabularny jest zabierany w każdym wariancie", () => {
  const state = hero();
  startQuest(state, data, "zold_dla_garnizonu");
  assert.equal(countOf(state, "skrzynia_zoldu"), 1);
  for (const [, node] of outcomes("zold_dla_garnizonu")) {
    const s = hero();
    startQuest(s, data, "zold_dla_garnizonu");
    runActions(s, data, actionsOf(node), createRng(1));
    assert.equal(countOf(s, "skrzynia_zoldu"), 0);
  }
});

test("wyjazd do stolicy: pytanie z ostrzeżeniem, a skrzynia z żołdem zostaje w obozie", () => {
  assert.equal(actionsOf(kapitan.nodes.stolica).length, 0, "samo wejście w węzeł niczego nie ustawia");
  const state = hero();
  startQuest(state, data, "zold_dla_garnizonu");
  runActions(state, data, actionsOf(kapitan.nodes.wyjazd_skrzynia), createRng(1));
  assert.equal(countOf(state, "skrzynia_zoldu"), 0);
  assert.equal(state.flags.akt4a_koniec, true);
});

test("medyczka reaguje na los rannych z pola", () => {
  const med = dialogue("medyczka");
  for (const f of ["wojna_ranni_wszyscy", "wojna_ranni_swoi", "wojna_ranni_lupy"]) {
    assert.ok(med.nodes[med.start].options.some((o) => JSON.stringify(o.requires ?? {}).includes(f)), f);
  }
});
