import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData } from "./helpers.js";
import { pushEventNotices } from "../src/ui/events.js";

const data = minimalData();
const noticesOf = (events) => {
  const ctx = { data, notices: [] };
  pushEventNotices(ctx, events);
  return ctx.notices.map((n) => stripVTControlCharacters(n));
};

test("zerowa zmiana pieniędzy nie daje komunikatu (+0 gr / −0 gr)", () => {
  assert.deepEqual(noticesOf([{ type: "pieniadze", delta: 0 }]), []);
  assert.deepEqual(noticesOf([{ type: "zlodziej_kradnie", money: 0 }]), []);
  assert.equal(noticesOf([{ type: "pieniadze", delta: 5 }]).length, 1);
  assert.equal(noticesOf([{ type: "zlodziej_kradnie", money: 3 }]).length, 1);
});

import { createScriptedIO } from "../src/ui/io.js";
import { select } from "../src/ui/menu.js";

test("wyszarzona pozycja z podpowiedzią (niedostępne) nie ma tego napisu dwa razy (tryb liniowy)", async () => {
  const io = createScriptedIO(["2"]);
  await select(io, data.ui, { items: [{ label: "Szepnij hasło", disabled: true, hint: data.ui["dialogue.lockedOther"] }, { label: "Wyjdź" }] });
  assert.doesNotMatch(io.text(), /\(niedostępne\)\s*\(niedostępne\)/);
  assert.match(io.text(), /Szepnij hasło \(niedostępne\)/);
});

import { createNewState } from "../src/engine/state.js";
import { endStatsLine } from "../src/ui/end_screen.js";

test("ekran końcowy: linia statystyk (dzień, poziom, ukończone zlecenia)", () => {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  state.time.minutes = 3 * 24 * 60 + 600;
  state.character = { level: 4 };
  state.quests = { a: { status: "done" }, b: { status: "done" }, c: { status: "active" } };
  assert.equal(endStatsLine(state, data.ui), "Dzień 4 · Poziom 4 · Ukończone zlecenia: 2");
});

import { createScriptedIO as scripted } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { combatState } from "./helpers.js";
import { InputExhaustedError } from "../src/ui/io.js";

const TALK = {
  id: "gadka", file: "gadka.json", start: "start",
  nodes: { start: { speaker: "Szklanna", text: "Proszę.", options: [{ text: "Do dzieła", goto: "end" }] } },
};
const talkCtx = (inputs) => {
  const d = { ...minimalData(), dialogues: [TALK] };
  const state = createNewState({ seed: 1, startScene: "x", rules: d.rules });
  const cs = combatState(d, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  return { state, data: d, io: scripted(inputs, { tty: false }), rng: { int: (a) => a }, debug: false, notices: [] };
};

test("dialog z camp:false kończy się bez pustego ekranu z menu obozu (następna jest walka)", async () => {
  const ctx = talkCtx(["1"]);
  await defaultHandlers.dialogue(ctx, { id: "rozmowa", type: "dialogue", dialogue: "gadka", camp: false });
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  assert.deepEqual(ctx.state.world.finishedDialogues, ["rozmowa"]);
});

test("dialog bez camp:false nadal pokazuje menu obozu po rozmowie", async () => {
  const ctx = talkCtx(["1"]);
  await assert.rejects(defaultHandlers.dialogue(ctx, { id: "rozmowa", type: "dialogue", dialogue: "gadka" }), InputExhaustedError);
});
