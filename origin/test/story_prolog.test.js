import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createCharacter } from "../src/systems/character.js";
import { enterNode, chooseOption, nodeView } from "../src/systems/dialogue.js";
import { combatState } from "./helpers.js";

const data = await loadData();
const fixed = (k) => ({ int: () => k });
const words = (text) => text.trim().split(/\s+/).length;
const scene = (id) => data.story.scenes.find((s) => s.id === id);
const index = (id) => data.story.scenes.findIndex((s) => s.id === id);

function fresh() {
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  return state;
}
/** Enters `node`, then picks option `key` with a roll of `roll`; returns the result. */
const pick = (state, dialogue, node, key, roll = 1) => {
  enterNode(state, data, dialogue, node, fixed(roll));
  return chooseOption(state, data, dialogue, node, key, fixed(roll));
};

test("dane prologu przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
});

test("wstęp: gra zaczyna się od dwóch narracji (40–140 słów, z tytułem, bez czasu), potem świt w szkole", () => {
  assert.equal(data.story.start, "prolog_wstep");
  const order = data.story.scenes.map((s) => s.id);
  assert.deepEqual(order.slice(0, 3), ["prolog_wstep", "prolog_wstep_wies", "demo_swit"]);
  for (const id of ["prolog_wstep", "prolog_wstep_wies"]) {
    const s = scene(id);
    assert.equal(s.type, "narration", id);
    assert.ok(s.title, id);
    assert.equal(s.time, undefined, id);
    assert.ok(words(s.text) >= 40 && words(s.text) <= 140, `${id}: ${words(s.text)} słów`);
  }
  assert.match(scene("prolog_wstep_wies").text, /Dziś zwykły dzień\. Przynajmniej tak wygląda od rana\./);
});

test("kolejność prologu: sparing → kurier → delegacja → kram → brama → wymarsz → podróż; demo_droga usunięte", () => {
  const chain = ["demo_nagroda", "prolog_kurier_narracja", "prolog_kurier", "prolog_delegacja", "demo_kram_wstep", "demo_kram_rozmowa", "demo_kram", "prolog_brama", "prolog_wymarsz", "demo_podroz"];
  chain.forEach((id, i) => { if (i) assert.equal(index(id), index(chain[i - 1]) + 1, `${id} po ${chain[i - 1]}`); });
  assert.equal(scene("demo_droga"), undefined);
  assert.equal(scene("prolog_kurier").dialogue, "kurier");
  assert.equal(scene("prolog_delegacja").dialogue, "delegacja");
  assert.equal(scene("prolog_brama").dialogue, "towarzysze");
});

test("kurier: Wymowa – sukces ustawia rozkaz_danina, porażka nie; Skradanie ustawia rozkaz_bez_powrotu", () => {
  const ok = fresh();
  const r = pick(ok, "kurier", "przybycie", "wymowa", 1);
  assert.equal(r.check.success, true);
  enterNode(ok, data, "kurier", r.next, fixed(1));
  assert.equal(ok.flags.rozkaz_danina, true);

  const bad = fresh();
  const f = pick(bad, "kurier", "przybycie", "wymowa", 100);
  assert.equal(f.check.success, false);
  enterNode(bad, data, "kurier", f.next, fixed(1));
  assert.equal(bad.flags.rozkaz_danina, undefined);

  const sneak = fresh();
  const s = pick(sneak, "kurier", "przybycie", "podsluch", 1);
  enterNode(sneak, data, "kurier", s.next, fixed(1));
  assert.equal(sneak.flags.rozkaz_bez_powrotu, true);
});

test("kurier: postawa – pokora +1 dług, pyskówka +1 wola, „Bywaj” bez zmian; każda kończy rozmowę", () => {
  for (const [key, delta] of [["pokora", { dlug: 1 }], ["pyskowka", { wola: 1 }], ["bywaj", {}]]) {
    const state = fresh();
    const before = { dlug: state.vars.dlug ?? 0, wola: state.vars.wola ?? 0 };
    let r = pick(state, "kurier", "przybycie", key, 1);
    while (!r.end) r = pick(state, "kurier", r.next, nodeView(state, data, "kurier", r.next).options.at(-1).key, 1);
    assert.equal((state.vars.dlug ?? 0) - before.dlug, delta.dlug ?? 0, key);
    assert.equal((state.vars.wola ?? 0) - before.wola, delta.wola ?? 0, key);
  }
});

test("delegacja: Wymowa 35 – sukces ustawia delegacja_danina", () => {
  const state = fresh();
  const r = pick(state, "delegacja", "wskazanie", "dlaczego", 1);
  enterNode(state, data, "delegacja", r.next, fixed(1));
  assert.equal(state.flags.delegacja_danina, true);
  const miss = fresh();
  const f = pick(miss, "delegacja", "wskazanie", "dlaczego", 100);
  enterNode(miss, data, "delegacja", f.next, fixed(1));
  assert.equal(miss.flags.delegacja_danina, undefined);
});

test("towarzysze: pocieszenie Wojmira – towarzysze_zaufanie i +1 dług; wyzwanie Ragnosławy +1 wola", () => {
  const state = fresh();
  let r = pick(state, "towarzysze", "brama", "wojmir", 1);
  r = pick(state, "towarzysze", r.next, "pocieszenie", 1);
  enterNode(state, data, "towarzysze", r.next, fixed(1));
  assert.equal(state.flags.towarzysze_zaufanie, true);
  assert.equal(state.vars.dlug, 1);

  const other = fresh();
  let q = pick(other, "towarzysze", "brama", "ragnoslawa", 1);
  q = pick(other, "towarzysze", q.next, "wyzwanie", 1);
  assert.equal(other.vars.wola, 1);
});

test("kwatermistrz: plotka o kurierze nawiązuje do kuriera, który już był w szkole", () => {
  const node = data.dialogues.find((d) => d.id === "kwatermistrz").nodes.plotka_ok;
  assert.match(node.text, /czerwon/i);
});

test("towarzysze, delegacja i kurier: każdy węzeł osiągalny i z wyjściem (walidator)", () => {
  for (const id of ["kurier", "delegacja", "towarzysze"]) {
    const d = data.dialogues.find((x) => x.id === id);
    assert.ok(d, id);
    assert.ok(Object.values(d.nodes).some((n) => n.options?.some((o) => o.goto === "end")), `${id}: wyjście`);
  }
});
