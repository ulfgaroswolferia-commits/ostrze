import { test } from "node:test";
import assert from "node:assert/strict";
import { checkChance, nodeView, enterNode, chooseOption, finishDialogue, optionKey, failedKey } from "../src/systems/dialogue.js";
import { createCharacter } from "../src/systems/character.js";
import { addItem } from "../src/systems/inventory.js";
import { hasEffect } from "../src/systems/effects.js";
import { getStats } from "../src/systems/stats.js";
import { minimalData } from "./helpers.js";
import { loadData } from "../src/engine/data.js";

const TEST_DIALOGUE = {
  id: "test",
  start: "start",
  minutes: 20,
  nodes: {
    start: {
      speaker: "Ktos",
      text: "Witaj.",
      actions: [{ giveMoney: 1 }],
      options: [
        { text: "Bogaty", requires: { money: 99 }, goto: "dalej" },
        { text: "Z kluczem", requires: { item: "opatrunek" }, showLocked: true, goto: "dalej" },
        { id: "targ", text: "Targ", check: { skill: "handel", difficulty: 35 }, success: "dalej", failure: "start" },
        { id: "urok", text: "Urok", check: { attribute: "oglada", difficulty: 40 }, success: "end:zgoda", failure: "start" },
        { id: "lyk", text: "Lyk", requires: { money: 2 }, actions: [{ takeMoney: 2 }, { addEffect: "podchmielenie" }], goto: "dalej" },
        { text: "Dalej", goto: "dalej" },
        { text: "Zgoda", goto: "end:zgoda" },
      ],
    },
    dalej: { speaker: "Ktos", text: "Koniec.", options: [{ text: "Bywaj", goto: "end" }] },
  },
};

function fresh() {
  const data = minimalData();
  data.dialogues = [TEST_DIALOGUE];
  const rules = data.rules.creator;
  const attributes = Object.fromEntries(data.attributes.map((a) => [a.id, rules.attributeStart + (rules.gifts[a.id] ?? 0)]));
  let pool = rules.points;
  for (const a of data.attributes) while (pool > 0 && attributes[a.id] < rules.attributeMax) { attributes[a.id]++; pool--; }
  const tagged = ["sieczna", "wymowa", "medycyna"];
  const character = createCharacter({ name: "Test", classId: "miecz", attributes, tagged }, data);
  character.money = 10;
  const state = {
    character, time: { minutes: 12 * 60 }, flags: {}, vars: {}, world: { failedChecks: [] },
    inventory: { items: [], equipped: {}, quickSlots: [] },
  };
  return { data, state };
}

const fixed = (k) => ({ int: () => k });
const byKey = (view, key) => view.options.find((o) => o.key === key);

test("optionKey i failedKey", () => {
  assert.equal(optionKey({ id: "a" }, 3), "a");
  assert.equal(optionKey({}, 3), "3");
  assert.equal(failedKey("d", "n", "k"), "d:n:k");
});

test("checkChance: wartosci ze specyfikacji", () => {
  const { data, state } = fresh();
  for (const a of data.attributes) state.character.attributes[a.id] = 5;
  assert.equal(checkChance(state, data, { attribute: "oglada", difficulty: 40 }), 60);
  assert.equal(getStats(state, data).skills.drzewcowa, 15);
  assert.equal(checkChance(state, data, { skill: "drzewcowa", difficulty: 35 }), 30);
});

test("checkChance: obciecie do 5-95", () => {
  const { data, state } = fresh();
  for (const a of data.attributes) state.character.attributes[a.id] = 5;
  state.character.skillPoints.drzewcowa = 85; // 15 + 85 = 100
  assert.equal(getStats(state, data).skills.drzewcowa, 100);
  assert.equal(checkChance(state, data, { skill: "drzewcowa", difficulty: 0 }), 95);
  assert.equal(checkChance(state, data, { skill: "drzewcowa", difficulty: 150 }), 5);
});

test("nodeView: ukryte, wyszarzone, etykieta testu, debug", () => {
  const { data, state } = fresh();
  const view = nodeView(state, data, "test", "start");
  assert.equal(view.speaker, "Ktos");
  assert.equal(view.text, "Witaj.");
  assert.equal(view.isEnd, false);
  assert.equal(view.options.find((o) => o.label === "Bogaty"), undefined);
  const locked = view.options.find((o) => o.label === "Z kluczem");
  assert.equal(locked.disabled, true);
  assert.equal(locked.reason, "dialogue.locked");
  const targ = byKey(view, "targ");
  assert.equal(targ.label, "Targ");
  assert.deepEqual(targ.check, { name: "Handel", difficulty: 35 });
  assert.equal(targ.disabled, false);
  assert.equal(byKey(nodeView(state, data, "test", "start", { debug: true }), "targ").check.chance,
    checkChance(state, data, { skill: "handel", difficulty: 35 }));
  assert.equal(nodeView(state, data, "test", "dalej").isEnd, false);
});

test("nodeView: wezel bez opcji konczy rozmowe", () => {
  const { data, state } = fresh();
  data.dialogues = [{ id: "t2", start: "a", nodes: { a: { speaker: "x", text: "y" } } }];
  assert.equal(nodeView(state, data, "t2", "a").isEnd, true);
});

test("chooseOption: sukces, porazka, zapis i wyszarzenie", () => {
  const { data, state } = fresh();
  const chance = checkChance(state, data, { skill: "handel", difficulty: 35 });
  const ok = chooseOption(state, data, "test", "start", "targ", fixed(chance));
  assert.equal(ok.next, "dalej");
  assert.deepEqual(ok.check, { success: true, chance, roll: chance });
  assert.deepEqual(state.world.failedChecks, []);
  const bad = chooseOption(state, data, "test", "start", "targ", fixed(chance + 1));
  assert.equal(bad.next, "start");
  assert.equal(bad.check.success, false);
  assert.deepEqual(state.world.failedChecks, ["test:start:targ"]);
  const again = byKey(nodeView(state, data, "test", "start"), "targ");
  assert.equal(again.disabled, true);
  assert.equal(again.reason, "dialogue.failed");
  assert.throws(() => chooseOption(state, data, "test", "start", "targ", fixed(1)));
});

test("chooseOption: zablokowana, ukryta lub nieznana rzuca", () => {
  const { data, state } = fresh();
  assert.throws(() => chooseOption(state, data, "test", "start", "0", fixed(1)));
  assert.throws(() => chooseOption(state, data, "test", "start", "1", fixed(1)));
  assert.throws(() => chooseOption(state, data, "test", "start", "nie_ma", fixed(1)));
});

test("chooseOption: end i end:wynik", () => {
  const { data, state } = fresh();
  assert.equal(chooseOption(state, data, "test", "start", "6", fixed(1)).end, "zgoda");
  assert.equal(chooseOption(state, data, "test", "dalej", "0", fixed(1)).end, "end");
  assert.equal(chooseOption(state, data, "test", "start", "urok", fixed(1)).end, "zgoda");
});

test("chooseOption: akcje opcji wykonane; akcje wezla tylko w enterNode", () => {
  const { data, state } = fresh();
  const r = chooseOption(state, data, "test", "start", "lyk", fixed(1));
  assert.equal(r.next, "dalej");
  assert.equal(state.character.money, 8);
  assert.ok(hasEffect(state, "podchmielenie"));
  assert.ok(r.events.some((e) => e.type === "pieniadze" && e.delta === -2));
  assert.ok(r.events.some((e) => e.type === "efekt_nalozony"));
  const before = state.character.money;
  const e = enterNode(state, data, "test", "start", fixed(1));
  assert.equal(state.character.money, before + 1);
  assert.deepEqual(e.events, [{ type: "pieniadze", delta: 1 }]);
  assert.deepEqual(enterNode(state, data, "test", "dalej", fixed(1)), { events: [] });
});

test("chooseOption: startCombat daje end walka", () => {
  const { data, state } = fresh();
  data.dialogues = [{ id: "w", start: "a", nodes: { a: { speaker: "x", text: "y", options: [{ text: "Bij", actions: [{ startCombat: { enemies: [] } }], goto: "end" }] } } }];
  const r = chooseOption(state, data, "w", "a", "0", fixed(1));
  assert.equal(r.end, "walka");
  assert.deepEqual(r.combat, { enemies: [] });
});

test("showLocked: opcja odblokowana po spelnieniu requires", () => {
  const { data, state } = fresh();
  addItem(state, data, "opatrunek", 1);
  const o = nodeView(state, data, "test", "start").options.find((x) => x.label === "Z kluczem");
  assert.equal(o.disabled, false);
});

test("finishDialogue: flaga i czas", () => {
  const { data, state } = fresh();
  const before = state.time.minutes;
  finishDialogue(state, data, "test", "zgoda", fixed(1));
  assert.equal(state.flags.dialog_test_zgoda, true);
  assert.equal(state.time.minutes, before + 20);
  data.dialogues = [{ ...TEST_DIALOGUE, minutes: undefined }];
  const t = state.time.minutes;
  finishDialogue(state, data, "test", "end", fixed(1));
  assert.equal(state.time.minutes, t + data.rules.dialogue.minutes);
});

test("kwatermistrz: po nieudanym teście węzeł pośredni nie pozwala próbować drugi raz", async () => {
  const data = await loadData();
  const { state } = fresh();
  state.flags = {};
  state.world.failedChecks = [];
  const rng = fixed(100); // every roll fails
  chooseOption(state, data, "kwatermistrz", "powitanie", "targ", rng);
  const out = chooseOption(state, data, "kwatermistrz", "targ_zle", "0", rng);
  assert.notEqual(out.next, "powitanie"); // short hub, not the full greeting
  enterNode(state, data, "kwatermistrz", "targ_zle", rng);
  const hub = nodeView(state, data, "kwatermistrz", out.next);
  assert.ok(hub.text.length < nodeView(state, data, "kwatermistrz", "powitanie").text.length);
  assert.equal(byKey(hub, "targ"), undefined); // hidden after a failed haggle
  assert.ok(byKey(hub, "plotka"));
});

test("kwatermistrz: po 3 łykach już nie naleje", async () => {
  const data = await loadData();
  const { state } = fresh();
  state.flags = {};
  state.character.money = 30;
  const rng = fixed(100);
  for (let i = 0; i < 3; i++) {
    chooseOption(state, data, "kwatermistrz", "powitanie", "lyk", rng);
    enterNode(state, data, "kwatermistrz", "lyk", rng);
  }
  assert.equal(state.character.money, 24);
  assert.equal(state.character.effects.find((e) => e.id === "podchmielenie").stacks, 3);
  for (const node of ["powitanie", "rozmowa_dalej"]) {
    const view = nodeView(state, data, "kwatermistrz", node);
    assert.equal(byKey(view, "lyk"), undefined);
    assert.ok(byKey(view, "lyk_dosc"));
  }
  const out = chooseOption(state, data, "kwatermistrz", "rozmowa_dalej", "lyk_dosc", rng);
  enterNode(state, data, "kwatermistrz", out.next, rng);
  assert.equal(state.character.money, 24);
  assert.match(nodeView(state, data, "kwatermistrz", out.next).text, /Starczy ci/);
});

test("riposty: każda porażka testu w prawdziwych dialogach kończy się cięta odprawą (≥ 120 znaków, z cudzysłowem), nie samym komunikatem", async () => {
  const { loadData } = await import("../src/engine/data.js");
  const real = await loadData();
  const bad = [];
  for (const d of real.dialogues) {
    for (const [nid, n] of Object.entries(d.nodes)) {
      for (const o of n.options ?? []) {
        if (typeof o.failure !== "string" || o.failure === "end") continue;
        const text = d.nodes[o.failure]?.text ?? "";
        if (text.length < 120 || !text.includes("„")) bad.push(`${d.id}.${nid} → ${o.failure}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
