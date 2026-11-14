import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { renderJournal } from "../src/ui/journal_screen.js";
import { campMenu } from "../src/ui/camp.js";
import { statusBar } from "../src/ui/screen.js";
import { startQuest, completeQuest, failQuest } from "../src/systems/quests.js";
import { startTravel, turnBack } from "../src/systems/travel.js";
import { defaultHandlers } from "../src/scenes/index.js";

const data = minimalData();
const strip = (s) => stripVTControlCharacters(s);
const DAY = 24 * 60;
function hero() {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  s.time.minutes = 9 * 60;
  return s;
}

test("dziennik: aktywne z celem, terminem i opisem; zakończone ✓/✗ – najwyżej 5; ≤ 80 kolumn", () => {
  const s = hero();
  assert.match(renderJournal(s, data).map(strip).join("\n"), /Brak aktywnych zadań\./);
  startQuest(s, data, "wilcza_nora");
  startQuest(s, data, "eskorta_ostromira");
  s.time.minutes += DAY / 2;
  const lines = renderJournal(s, data).map(strip);
  const text = lines.join("\n");
  assert.match(text, /Wilcza Nora – Wilcza Nora · bez terminu/);
  assert.match(text, /Eskorta kupca Ostromira – Kamienna Przełęcz · termin: zostały 3 dni/);
  assert.match(text, /Komendant płaci dwadzieścia pięć groszy/);
  assert.ok(lines.every((l) => [...l].length <= 80), text);
  completeQuest(s, data, "wilcza_nora");
  failQuest(s, data, "eskorta_ostromira");
  const done = renderJournal(s, data).map(strip).join("\n");
  assert.match(done, /✓ Wilcza Nora/);
  assert.match(done, /✗ Eskorta kupca Ostromira/);
  const many = structuredClone(data);
  for (let i = 0; i < 7; i++) many.quests.push({ ...structuredClone(many.quests[0]), id: `z${i}`, name: `Zadanie ${i}` });
  const t = hero();
  for (let i = 0; i < 7; i++) { t.quests[`z${i}`] = { status: "done", acceptedAt: 0, deadline: null, departed: true }; }
  const listed = renderJournal(t, many).map(strip).filter((l) => l.startsWith("✓"));
  assert.deepEqual(listed, ["✓ Zadanie 2", "✓ Zadanie 3", "✓ Zadanie 4", "✓ Zadanie 5", "✓ Zadanie 6"]);
});

test("zadanie z drogi widać w dzienniku od razu, zanim gracz dotrze do punktu postoju", async () => {
  const s = hero();
  s.world.location = "brzezina";
  const ctx = { state: s, data, notices: [] };
  await defaultHandlers.quest(ctx, { id: "q", type: "quest", start: "eskorta_ostromira" });
  assert.match(renderJournal(s, data).map(strip).join("\n"), /Eskorta kupca Ostromira/);
});

test("[D] w menu obozu otwiera dziennik i wraca do menu", async () => {
  const s = hero();
  startQuest(s, data, "wilcza_nora");
  const io = createScriptedIO(["d", "", "1"]);
  const ctx = { state: s, data, io, rng: createRng(1), notices: [] };
  await campMenu(ctx, () => {});
  await assert.rejects(io.ask("?"), InputExhaustedError);
  const out = strip(io.text());
  assert.match(out, /\[D\] Dziennik/);
  assert.match(out, /Dziennik zadań/);
  assert.match(out, /Wilcza Nora – Wilcza Nora/);
});

test("pasek stanu: w drodze do zadania „Do: {cel} d/n”, w powrocie „Powrót d/n”", () => {
  const s = hero();
  s.world.location = "wilczy_brod";
  startTravel(s, data, "wilczy_brod_nora", { quest: "wilcza_nora" });
  assert.match(strip(statusBar(s, data, { width: 120 })), /· Do: Wilcza Nora 1\/1 ·/);
  turnBack(s);
  assert.match(strip(statusBar(s, data, { width: 120 })), /· Powrót 1\/1 ·/);
  s.world.travel = null;
  s.world.location = "wilcza_nora";
  startTravel(s, data, "wilczy_brod_nora", { reverse: true, quest: "wilcza_nora" });
  assert.match(strip(statusBar(s, data, { width: 120 })), /· Powrót 1\/1 ·/);
});

test("final: dziennik nie pokazuje „został 1 dzień” po upływie terminu", () => {
  const s = hero();
  startQuest(s, data, "eskorta_ostromira");
  s.time.minutes += 4 * DAY;
  const text = renderJournal(s, data).map(strip).join("\n");
  assert.match(text, /Eskorta kupca Ostromira – Kamienna Przełęcz · termin minął/);
});
