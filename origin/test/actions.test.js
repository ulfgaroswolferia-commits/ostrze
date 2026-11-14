import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTION_KEYS, validateActions, runActions } from "../src/systems/actions.js";
import { createCharacter } from "../src/systems/character.js";
import { addItem, countOf, equip } from "../src/systems/inventory.js";
import { applyEffect, hasEffect } from "../src/systems/effects.js";
import { getStats } from "../src/systems/stats.js";
import { minimalData } from "./helpers.js";

const fixed = (k) => ({ int: () => k });

function fresh() {
  const data = minimalData();
  const rules = data.rules.creator;
  const attributes = Object.fromEntries(data.attributes.map((a) => [a.id, rules.attributeStart + (rules.gifts[a.id] ?? 0)]));
  let pool = rules.points;
  for (const a of data.attributes) while (pool > 0 && attributes[a.id] < rules.attributeMax) { attributes[a.id]++; pool--; }
  const cls = data.classes.find((c) => c.id === "miecz");
  const tagged = [...new Set([cls.taggedSkill, "wymowa", "medycyna"])].slice(0, rules.taggedCount);
  const character = createCharacter({ name: "Test", classId: "miecz", attributes, tagged }, data);
  const state = { character, time: { minutes: 12 * 60 }, flags: {}, vars: {}, inventory: { items: [], equipped: {}, quickSlots: [] } };
  character.money = 30;
  return { data, state };
}

const msgs = (actions) => validateActions(actions, "d.json › a", fresh().data);

test("ACTION_KEYS: pelna lista", () => {
  assert.equal(ACTION_KEYS.length, 21);
});

test("validateActions: poprawne akcje", () => {
  assert.deepEqual(msgs([
    { giveItem: "opatrunek" }, { takeItem: { id: "opatrunek", qty: 2 } }, { giveMoney: 5 }, { takeMoney: 5 },
    { setFlag: "a" }, { clearFlag: "a" }, { addVar: { wola: 1, dlug: -2 } }, { xp: 10 }, { time: 60 },
    { addEffect: "trucizna" }, { removeEffect: "trucizna" }, { startCombat: { enemies: [] } },
  ]), []);
});

test("validateActions: komunikaty", () => {
  assert.deepEqual(msgs("x"), ["d.json › a: oczekiwano tablicy"]);
  assert.deepEqual(msgs([{}]), ["d.json › a[0]: oczekiwano jednej akcji"]);
  assert.deepEqual(msgs([{ xp: 1, time: 1 }]), ["d.json › a[0]: oczekiwano jednej akcji"]);
  assert.deepEqual(msgs([{ foo: 1 }]), ["d.json › a[0].foo: nieznana akcja"]);
  assert.deepEqual(msgs([{ giveItem: "nie_ma" }]), ['d.json › a[0].giveItem: nieznany przedmiot "nie_ma"']);
  assert.deepEqual(msgs([{ giveItem: "piesci" }]), ["d.json › a[0].giveItem: przedmiot ukryty"]);
  assert.deepEqual(msgs([{ takeItem: { id: "opatrunek", qty: 0 } }]), ["d.json › a[0].takeItem.qty: oczekiwano liczby całkowitej ≥ 1"]);
  assert.deepEqual(msgs([{ giveItem: { id: "opatrunek" } }]), ["d.json › a[0].giveItem.qty: brak wymaganego pola"]);
  assert.deepEqual(msgs([{ takeItem: { id: "opatrunek" } }]), ["d.json › a[0].takeItem.qty: brak wymaganego pola"]);
  assert.deepEqual(msgs([{ takeItem: 5 }]), ["d.json › a[0].takeItem: oczekiwano id lub { id, qty }"]);
  for (const key of ["giveMoney", "takeMoney", "xp", "time"]) {
    assert.deepEqual(msgs([{ [key]: 0 }]), [`d.json › a[0].${key}: oczekiwano liczby całkowitej ≥ 1`]);
  }
  assert.deepEqual(msgs([{ setFlag: 3 }]), ["d.json › a[0].setFlag: oczekiwano tekstu"]);
  assert.deepEqual(msgs([{ clearFlag: 3 }]), ["d.json › a[0].clearFlag: oczekiwano tekstu"]);
  assert.deepEqual(msgs([{ addVar: 1 }]), ["d.json › a[0].addVar: oczekiwano obiektu zmiennych"]);
  assert.deepEqual(msgs([{ addVar: { x: 1 } }]), ["d.json › a[0].addVar.x: nieznana zmienna"]);
  assert.deepEqual(msgs([{ addVar: { wola: 1.5 } }]), ["d.json › a[0].addVar.wola: oczekiwano liczby całkowitej"]);
  assert.deepEqual(msgs([{ addEffect: "nie_ma" }]), ['d.json › a[0].addEffect: nieznany efekt "nie_ma"']);
  assert.deepEqual(msgs([{ removeEffect: "nie_ma" }]), ['d.json › a[0].removeEffect: nieznany efekt "nie_ma"']);
  assert.deepEqual(msgs([{ startCombat: 1 }]), ["d.json › a[0].startCombat: oczekiwano obiektu"]);
  const { data } = fresh();
  data.effects.push({ id: "tura", name: "T", description: "d", unit: "turn", duration: 2, stack: "refresh" });
  assert.deepEqual(validateActions([{ addEffect: "tura" }], "p", data), ["p[0].addEffect: dozwolone tylko efekty godzinowe"]);
});

test("giveItem / takeItem", () => {
  const { data, state } = fresh();
  let r = runActions(state, data, [{ giveItem: { id: "opatrunek", qty: 2 } }], fixed(1));
  assert.deepEqual(r.events, [{ type: "otrzymano", id: "opatrunek", qty: 2 }]);
  assert.equal(countOf(state, "opatrunek"), 2);
  r = runActions(state, data, [{ takeItem: { id: "opatrunek", qty: 3 } }], fixed(1));
  assert.deepEqual(r.events, [{ type: "oddano", id: "opatrunek", qty: 2 }]);
  assert.equal(countOf(state, "opatrunek"), 0);
});

test("takeItem: zalozona sztuka zostaje", () => {
  const { data, state } = fresh();
  addItem(state, data, "miecz_krotki", 1);
  equip(state, data, "miecz_krotki", "bron");
  const r = runActions(state, data, [{ takeItem: "miecz_krotki" }], fixed(1));
  assert.deepEqual(r.events, []);
  assert.equal(countOf(state, "miecz_krotki"), 1);
});

test("takeItem: z dwoch jedna zalozona, oddana jedna", () => {
  const { data, state } = fresh();
  addItem(state, data, "miecz_krotki", 2);
  equip(state, data, "miecz_krotki", "bron");
  const r = runActions(state, data, [{ takeItem: { id: "miecz_krotki", qty: 2 } }], fixed(1));
  assert.deepEqual(r.events, [{ type: "oddano", id: "miecz_krotki", qty: 1 }]);
  assert.equal(countOf(state, "miecz_krotki"), 1);
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
});

test("takeMoney przy zerze pieniędzy nie zgłasza zdarzenia", () => {
  const { data, state } = fresh();
  state.character.money = 0;
  const r = runActions(state, data, [{ takeMoney: 5 }], fixed(1));
  assert.deepEqual(r.events, []);
  assert.equal(state.character.money, 0);
});

test("giveMoney / takeMoney do zera", () => {
  const { data, state } = fresh();
  let r = runActions(state, data, [{ giveMoney: 20 }], fixed(1));
  assert.deepEqual(r.events, [{ type: "pieniadze", delta: 20 }]);
  assert.equal(state.character.money, 50);
  state.character.money = 30;
  r = runActions(state, data, [{ takeMoney: 50 }], fixed(1));
  assert.deepEqual(r.events, [{ type: "pieniadze", delta: -30 }]);
  assert.equal(state.character.money, 0);
});

test("setFlag / clearFlag / addVar", () => {
  const { data, state } = fresh();
  const r = runActions(state, data, [{ setFlag: "f" }, { clearFlag: "g" }, { addVar: { wola: 2 } }], fixed(1));
  assert.deepEqual(r.events, [
    { type: "flaga", id: "f", value: true }, { type: "flaga", id: "g", value: false }, { type: "zmienna", changes: { wola: 2 } },
  ]);
  assert.deepEqual(state.flags, { f: true, g: false });
  assert.equal(state.vars.wola, 2);
});

test("giveItem przy przeciazeniu: za_ciezko, przedmiot przepada", () => {
  const { data, state } = fresh();
  data.items.find((i) => i.id === "kolczuga").weight = 10000;
  const r = runActions(state, data, [{ giveItem: "kolczuga" }], fixed(1));
  assert.deepEqual(r.events, [{ type: "za_ciezko", id: "kolczuga", qty: 1 }]);
  assert.equal(countOf(state, "kolczuga"), 0);
});

test("xp 160: awans jak w nagrodzie", () => {
  const { data, state } = fresh();
  const r = runActions(state, data, [{ xp: 160 }], fixed(1));
  assert.deepEqual(r.events, [{ type: "xp", amount: 160 }]);
  assert.equal(state.character.xp, 160);
  assert.equal(state.character.level, 2);
  assert.ok(state.character.pendingLevelUp);
});

test("time 120: zegar i tykniecia trucizny", () => {
  const { data, state } = fresh();
  applyEffect(state, data, "trucizna", fixed(100), { force: true });
  const before = state.time.minutes;
  const { events } = runActions(state, data, [{ time: 120 }], fixed(1));
  assert.equal(state.time.minutes, before + 120);
  assert.ok(events.some((e) => e.type === "efekt_obrazenia"));
});

test("addEffect: nalozony, potem removeEffect tylko raz", () => {
  const { data, state } = fresh();
  let r = runActions(state, data, [{ addEffect: "trucizna" }], fixed(100));
  assert.deepEqual(r.events, [{ type: "efekt_nalozony", id: "trucizna" }]);
  assert.equal(hasEffect(state, "trucizna"), true);
  r = runActions(state, data, [{ removeEffect: "trucizna" }, { removeEffect: "trucizna" }], fixed(1));
  assert.deepEqual(r.events, [{ type: "efekt_koniec", id: "trucizna" }]);
  assert.equal(hasEffect(state, "trucizna"), false);
});

test("addEffect: odparty przy trafionym rzucie", () => {
  const { data, state } = fresh();
  const r = runActions(state, data, [{ addEffect: "trucizna" }], fixed(1));
  assert.deepEqual(r.events, [{ type: "efekt_odparty", id: "trucizna" }]);
});

test("startCombat przerywa kolejne akcje", () => {
  const { data, state } = fresh();
  const combat = { enemies: ["x"] };
  const r = runActions(state, data, [{ giveMoney: 1 }, { startCombat: combat }, { giveMoney: 100 }], fixed(1));
  assert.equal(r.combat, combat);
  assert.equal(state.character.money, 31);
  assert.deepEqual(r.events, [{ type: "pieniadze", delta: 1 }]);
});

test("healFull: HP = max, wszystkie efekty zdjęte, zdarzenie leczenie", () => {
  const { data, state } = fresh();
  const hpMax = getStats(state, data).derived.hpMax;
  state.character.hp = 1;
  applyEffect(state, data, "trucizna", fixed(1));
  applyEffect(state, data, "glod", fixed(1));
  assert.ok(state.character.effects.length >= 1);
  const { events } = runActions(state, data, [{ healFull: true }], fixed(1));
  assert.equal(state.character.hp, hpMax);
  assert.equal(state.character.effects.length, 0);
  assert.deepEqual(events.filter((e) => e.type === "leczenie"), [{ type: "leczenie", amount: hpMax - 1 }]);
});

test("healFull: pełne HP – bez zdarzenia leczenie, efekty i tak zdjęte", () => {
  const { data, state } = fresh();
  state.character.hp = getStats(state, data).derived.hpMax;
  applyEffect(state, data, "glod", fixed(1));
  const { events } = runActions(state, data, [{ healFull: true }], fixed(1));
  assert.ok(!events.some((e) => e.type === "leczenie"));
  assert.equal(state.character.effects.length, 0);
});

test("validateActions: healFull tylko true", () => {
  assert.deepEqual(msgs([{ healFull: true }]), []);
  assert.deepEqual(msgs([{ healFull: false }]), ["d.json › a[0].healFull: oczekiwano true"]);
  assert.deepEqual(msgs([{ healFull: 1 }]), ["d.json › a[0].healFull: oczekiwano true"]);
});
