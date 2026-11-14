import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { savesDir } from "../src/config.js";
import { createRng } from "../src/engine/dice.js";
import { createNewState } from "../src/engine/state.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { tmpDir, minimalData } from "./helpers.js";

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

const fresh = () => createNewState({ seed: 1, startScene: "a", rules: { startHour: 6 } });

test("world.ambushes wraca z zapisu, a uszkodzone (nie liczby) jest odrzucane", async () => {
  const d = minimalData();
  const s = fresh();
  s.world.ambushes = { "ulfgrod.karczma": 3 };
  await saveGame("1", s, createRng(1));
  assert.deepEqual((await loadGame("1", d)).world.ambushes, { "ulfgrod.karczma": 3 });
  await mkdir(savesDir(), { recursive: true });
  const bad = JSON.parse(JSON.stringify(s));
  bad.world.ambushes = { "ulfgrod.karczma": "wczoraj" };
  await writeFile(path.join(savesDir(), "2.json"), JSON.stringify(bad));
  await assert.rejects(loadGame("2", d), { name: "LoadError" });
});

import { validateData } from "../src/engine/data.js";

const errs = (d) => validateData(d);
const has = (list, msg) => assert.ok(list.some((e) => e.includes(msg)), `brak: ${msg}\n${list.join("\n")}`);

test("walidacja: whenEmpty.costHp musi być ≥ 1 (bez darmowej zdolności)", () => {
  const d = structuredClone(minimalData());
  const item = d.items.find((i) => i.whenEmpty);
  assert.ok(item, "dane mają artefakt z whenEmpty");
  item.whenEmpty.costHp = 0;
  has(errs(d), "costHp");
});

test("walidacja: rules.dialogue.chanceMax ≤ 100", () => {
  const d = structuredClone(minimalData());
  d.rules.dialogue.chanceMax = 150;
  has(errs(d), "chanceMax");
});

test("walidacja: scena zdarzenia nie może mieć id \"koniec\"", () => {
  const d = structuredClone(minimalData());
  const event = d.travel.events.find((e) => e.scenes);
  event.scenes.push({ id: "koniec", type: "narration", text: "x" });
  has(errs(d), "koniec");
});

import { readFileSync } from "node:fs";

test("rozstrzygnięcie długu przekupki: opcja spłaty wymaga pieniędzy, które zabiera", () => {
  const dlg = JSON.parse(readFileSync(new URL("../data/dialogues/rozstrzygniecie_dlug_przekupki.json", import.meta.url), "utf8"));
  const opt = dlg.nodes.start.options.find((o) => o.id === "splac");
  const take = dlg.nodes.wynik_splac.actions.find((a) => a.takeMoney !== undefined).takeMoney;
  assert.deepEqual(opt.requires, { money: take });
});

import { startNodeOf, finishDialogue } from "../src/systems/dialogue.js";

const D = { id: "gadka", start: "powitanie", returnStart: "znowu", nodes: {} };

test("startNodeOf: pierwsza rozmowa zaczyna od start, każda następna od returnStart", () => {
  const state = createNewState({ seed: 1, startScene: "a", rules: { startHour: 6 } });
  assert.equal(startNodeOf(state, D), "powitanie");
  finishDialogue(state, { ...minimalData(), dialogues: [{ ...D, minutes: 0 }] }, "gadka", "end", { int: () => 1 });
  assert.equal(startNodeOf(state, D), "znowu");
  assert.equal(startNodeOf(state, { ...D, id: "inna" }), "powitanie", "inna rozmowa o wspólnym prefiksie nie udaje powrotu");
  assert.equal(startNodeOf(state, { ...D, returnStart: undefined }), "powitanie");
});

test("walidacja: returnStart musi wskazywać istniejący węzeł, a jego węzły są osiągalne", () => {
  const d = structuredClone(minimalData());
  const dlg = structuredClone(d.dialogues[0]);
  dlg.id = "gadka_x"; dlg.file = "gadka_x.json";
  dlg.returnStart = "nie_ma";
  d.dialogues = [...d.dialogues, dlg];
  has(validateData(d), "returnStart: nieznany węzeł");
});
