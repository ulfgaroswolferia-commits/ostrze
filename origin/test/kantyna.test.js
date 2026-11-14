import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { combatState, tmpDir } from "./helpers.js";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { addItem, countOf } from "../src/systems/inventory.js";
import { runActions } from "../src/systems/actions.js";
import { applyEffect } from "../src/systems/effects.js";
import { dialogueOffersQuest } from "../src/systems/dialogue.js";
import { advanceErrands } from "../src/systems/quests.js";
import { evaluate } from "../src/engine/conditions.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { setColorsEnabled } from "../src/ui/colors.js";

const data = await loadData();
const statusIs = (state, id, is) => evaluate({ questStatus: { id, is } }, state, data);
const places = (loc) => data.travel.locations.find((l) => l.id === loc).spots;
const spot = (loc, id) => places(loc).find((s) => s.id === id);

let home;
beforeEach(async () => {
  home = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
  setColorsEnabled(false);
});
afterEach(() => {
  if (home === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = home;
});

function game(money = 200) {
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  Object.assign(state, combatState(data, "miecz"));
  state.character.money = money;
  state.character.hp = 20;
  state.world.location = "oboz_wronia";
  return state;
}

/** Runs the scenes of a spot, one after another, like the map does: `if` skips a scene, `goto` and combat routes jump. */
async function visit(state, locId, spotId, inputs) {
  const { runScenes, createSceneList } = await import("../src/engine/loop.js");
  state.world.dialogueProgress ??= {};
  const scenes = spot(locId, spotId).scenes;
  const io = createScriptedIO(inputs, { tty: true });
  Object.assign(io, { columns: 120, rows: 40 });
  const ctx = { state, data, io, rng: createRng(7), debug: false, notices: [] };
  state.world.finishedDialogues = state.world.finishedDialogues.filter((id) => !scenes.some((s) => s.id === id));
  await runScenes(ctx, createSceneList(scenes), scenes[0].id, { endId: "koniec" })
    .catch((e) => { if (!(e instanceof InputExhaustedError)) throw e; });
  return { ctx, text: strip(io.output.join("")) };
}

test("kantyna: dane przechodzą walidację, jest rozmową ze sklepem, a nie samym sklepem", () => {
  assert.deepEqual(validateData(data), []);
  const k = spot("oboz_wronia", "kantyna");
  assert.equal(k.type, "scene");
  assert.notEqual(k.type, spot("oboz_wronia", "kuznia_polowa").type);
  for (const portrait of ["portret_kantynierka", "portret_zegota", "portret_ziemowit"]) assert.ok(data.art[portrait], portrait);
});

test("kantyna: przy wejściu widać kantynierkę, strawę, wojaków, podróżnego i oba zlecenia z gwiazdką", async () => {
  const state = game();
  assert.equal(dialogueOffersQuest(state, data, "kantyna"), true);
  const { text } = await visit(state, "oboz_wronia", "kantyna", []);
  for (const line of ["Bronka", "sprzedaż", "Miska zupy", "Kapral cię woła", "Dosiadam się do wojaków", "Dziad szuka muła"]) assert.ok(text.includes(line), line);
});

test("kantyna: „Pokaż, co masz” otwiera ten sam sklep co dawniej, a kolejna wizyta zaczyna się od rozmowy", async () => {
  const state = game();
  const { text } = await visit(state, "oboz_wronia", "kantyna", ["1"]);
  assert.match(text, /Opatrunek/);
  assert.equal(state.flags.kantyna_kupuje, true, "w trakcie zakupów");
  const again = await visit(state, "oboz_wronia", "kantyna", ["<esc>", "w", "<enter>"]);
  assert.match(again.text, /Bronka/);
});

test("ciepła strawa: kosztuje, zjada głód i apetyt, leczy, zajmuje czas; bez 8 groszy niedostępna", async () => {
  const state = game();
  applyEffect(state, data, "glod", createRng(1));
  state.character.lastMeal = state.time.minutes - 40 * 60;
  const before = { money: state.character.money, hp: state.character.hp, minutes: state.time.minutes };
  const { text } = await visit(state, "oboz_wronia", "kantyna", ["2"]);
  assert.match(text, /głód z głowy, \+15 HP/);
  assert.equal(state.character.money, before.money - 8);
  assert.equal(state.character.hp, before.hp + 15);
  assert.equal(state.time.minutes, before.minutes + 30);
  assert.equal(state.character.effects.some((e) => e.id === "glod"), false);
  assert.equal(state.character.lastMeal, state.time.minutes, "apetyt liczy się od posiłku");

  const poor = game(5);
  const { text: broke } = await visit(poor, "oboz_wronia", "kantyna", ["2"]);
  assert.equal(poor.character.money, 5, "nic nie pobrano");
  assert.match(broke, /Bronka/);
});

test("akcja meal: HP nie przekracza maksimum", () => {
  const state = game();
  state.character.hp = 1e6;
  const { events } = runActions(state, data, [{ meal: 15 }], createRng(1));
  assert.equal(events[0].type, "goraca_strawa");
  assert.ok(events[0].hp <= 0, "syty i zdrowy nie zyskuje HP");
});

async function startedQuest(id) {
  const state = game();
  runActions(state, data, [{ startQuest: id }], createRng(1));
  assert.equal(statusIs(state, id, "active"), true);
  return state;
}

test("Żołd przegrany w kości: gadka u szulera oddaje mieszek, cały i uczciwy zwrot nagradza, zlecenie się kończy", async () => {
  const state = await startedQuest("zold_w_kosciach");
  runActions(state, data, [{ giveItem: "mieszek_zoldu" }, { setFlag: "zold_odzyskany" }], createRng(1));
  const money = state.character.money;
  const xp = state.character.xp;
  const { text } = await visit(state, "oboz_wronia", "kantyna", []);
  assert.match(text, /mam mieszek/);
  runActions(state, data, data.dialogues.find((d) => d.id === "kantyna").nodes.zegota_oddane.actions, createRng(1));
  advanceErrands(state, data, createRng(1));
  assert.equal(countOf(state, "mieszek_zoldu"), 0);
  assert.equal(state.character.money, money + 25);
  assert.equal(statusIs(state, "zold_w_kosciach", "active"), false);
  assert.equal(statusIs(state, "zold_w_kosciach", "none"), false);
  assert.ok(state.character.xp >= xp + 60);
});

test("Żołd przegrany w kości: kłamstwo daje 60 groszy, ale wojacy już cię nie wpuszczają do stołu", () => {
  const nodes = data.dialogues.find((d) => d.id === "kantyna").nodes;
  const actions = nodes.zegota_klamstwo.actions;
  assert.ok(actions.some((a) => a.giveMoney === 60));
  assert.ok(actions.some((a) => a.setFlag === "zold_oszukany"));
  const options = nodes.powitanie.options;
  assert.equal(options.find((o) => o.id === "stol").requires.notFlag, "zold_oszukany");
  assert.equal(options.find((o) => o.id === "stol_zimno").requires.flag, "zold_oszukany");
});

test("Żołd przegrany w kości: walka przy wozie – wygrana daje mieszek, ucieczka zostawia zadanie otwarte, wóz po wszystkim znika", async () => {
  const state = await startedQuest("zold_w_kosciach");
  state.character.hp = 5000;
  // [3] grozi walką, [enter] potwierdza, potem atak aż do wygranej i odbiór mieszka.
  const { text } = await visit(state, "pole_bitwy", "woz_szulera", ["3", "<enter>", ...Array(150).fill("<enter>")]);
  assert.equal(state.flags.zold_odzyskany, true, text.slice(-800));
  assert.equal(countOf(state, "mieszek_zoldu"), 1);
  assert.equal(state.flags.woz_szulera_walka, false);
  const later = await visit(state, "pole_bitwy", "woz_szulera", []);
  assert.match(later.text, /Wozu już nie ma/);
});

test("Muł imieniem Cesarz: kupno i powrót do druciarza kończą zlecenie z nagrodą", async () => {
  const state = await startedQuest("mul_imieniem_cesarz");
  const money = state.character.money;
  const { text } = await visit(state, "spalona_wies", "mul_na_zgliszczach", ["2", "<enter>"]);
  assert.match(text, /gryzie każdą monetę/);
  assert.equal(state.flags.mul_odzyskany, true);
  assert.equal(state.character.money, money - 15);

  const camp = await visit(state, "oboz_wronia", "kantyna", []);
  assert.match(camp.text, /Cesarz wrócił/);
  runActions(state, data, data.dialogues.find((d) => d.id === "kantyna").nodes.mul_zwrot.actions, createRng(1));
  advanceErrands(state, data, createRng(1));
  assert.equal(statusIs(state, "mul_imieniem_cesarz", "active"), false);
  assert.equal(statusIs(state, "mul_imieniem_cesarz", "none"), false);
  assert.equal(state.character.money, money - 15 + 30);
});

test("Muł: walka z maruderami też odzyskuje muła", async () => {
  const state = await startedQuest("mul_imieniem_cesarz");
  state.character.hp = 5000;
  await visit(state, "spalona_wies", "mul_na_zgliszczach", ["3", "<enter>", ...Array(150).fill("<enter>")]);
  assert.equal(state.flags.mul_odzyskany, true);
  assert.equal(state.flags.mul_cesarz_walka, false);
});
