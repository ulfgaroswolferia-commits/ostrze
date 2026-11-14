import { renderPixels } from "../src/ui/pixels.js";
import { setColorsEnabled, setRich256 } from "../src/ui/colors.js";
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { readdirSync } from "node:fs";
import { readFile, writeFile, rm } from "node:fs/promises";
import { defaultHandlers } from "../src/scenes/index.js";
import { DefeatError } from "../src/scenes/errors.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { availablePerks } from "../src/systems/character.js";
import { runApp } from "../src/app.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { minimalData, combatState, tmpDir } from "./helpers.js";
import { countOf } from "../src/systems/inventory.js";

let savedHome;
beforeEach(async () => {
  savedHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
  setColorsEnabled(false);
});
afterEach(() => {
  if (savedHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = savedHome;
});

/** rng that always rolls the minimum: every hit lands, damage is the minimum. */
const low = () => ({ int: (lo) => lo });

/** Data with a tunable "bandyta" (player always leads: initiative 0 vs the player's 1 + positive derived). */
function dataWith(enemy = {}) {
  const data = minimalData();
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, initiative: 0, ...enemy } : e));
  return data;
}

function ctxFor(inputs, { data = dataWith({ hp: 1 }), tty = false, hp } = {}) {
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  if (hp !== undefined) state.character.hp = hp;
  return { state, data, io: createScriptedIO(inputs, { tty }), rng: low(), debug: false, notices: [] };
}
const FIGHT = { id: "x", type: "combat", enemies: [{ id: "bandyta" }], start: "melee" };
const drained = (ctx) => assert.rejects(ctx.io.ask("?"), InputExhaustedError);

test("combat: walka do wygranej – flaga, PD, łup, podsumowanie", async () => {
  const ctx = ctxFor(["a", ""]);
  const { xp, money } = ctx.state.character;
  const result = await defaultHandlers.combat(ctx, FIGHT);
  await drained(ctx);
  assert.equal(result?.goto, undefined);
  assert.equal(ctx.state.flags.combat_x_wygrana, true);
  assert.equal(ctx.state.character.xp, xp + 40);
  assert.equal(ctx.state.character.money, money + 4);
  assert.match(ctx.io.text(), /Zwycięstwo\. \+40 PD\./);
  assert.match(ctx.io.text(), /Trafiasz Bandytę za /);
});

test("combat: udana ucieczka prowadzi do onFlee, bez PD i łupu", async () => {
  const ctx = ctxFor(["c", ""]);
  const { xp, money } = ctx.state.character;
  const result = await defaultHandlers.combat(ctx, { ...FIGHT, start: "far", onFlee: "uciekl" });
  await drained(ctx);
  assert.deepEqual(result, { goto: "uciekl" });
  assert.equal(ctx.state.flags.combat_x_ucieczka, true);
  assert.equal(ctx.state.character.xp, xp);
  assert.equal(ctx.state.character.money, money);
  assert.match(ctx.io.text(), /Wycofujesz się/);
});

test("combat: porażka bez onDefeat rzuca DefeatError po pokazaniu ciosu kończącego", async () => {
  const ctx = ctxFor(["k", ""], { data: dataWith({ hp: 50 }), hp: 1 });
  await assert.rejects(defaultHandlers.combat(ctx, FIGHT), DefeatError);
  await drained(ctx);
});

test("combat: porażka z onDefeat – HP 1 i przejście", async () => {
  const ctx = ctxFor(["k", ""], { data: dataWith({ hp: 50 }), hp: 3 });
  const result = await defaultHandlers.combat(ctx, { ...FIGHT, onDefeat: "pobity" });
  await drained(ctx);
  assert.deepEqual(result, { goto: "pobity" });
  assert.equal(ctx.state.character.hp, 1);
  assert.equal(ctx.state.flags.combat_x_porazka, true);
  assert.match(ctx.io.text(), /Przegrywasz/);
});

test("sparing: porażka (training, nonLethal) – gra idzie dalej, HP wraca do stanu sprzed walki, bez DefeatError", async () => {
  const ctx = ctxFor(["k", ""], { data: dataWith({ hp: 50 }), hp: 3 });
  const result = await defaultHandlers.combat(ctx, { ...FIGHT, training: true, nonLethal: true, canFlee: false });
  await drained(ctx);
  assert.equal(result?.goto, undefined);
  assert.equal(ctx.state.character.hp, 3);
  assert.equal(ctx.state.flags.combat_x_porazka, true);
});

test("sparing: wygrana – instruktor na 1 HP (nie ginie), PD, bez łupu", async () => {
  const data = minimalData();
  data.enemies = data.enemies.map((e) => (e.id === "instruktor" ? { ...e, hp: 3, initiative: 0 } : e));
  const ctx = ctxFor(["a", ""], { data });
  const { xp, money } = ctx.state.character;
  await defaultHandlers.combat(ctx, { id: "x", type: "combat", enemies: [{ id: "instruktor" }], start: "melee", training: true, nonLethal: true, canFlee: false });
  await drained(ctx);
  assert.equal(ctx.state.flags.combat_x_wygrana, true);
  assert.equal(ctx.state.character.xp, xp + 30);
  assert.equal(ctx.state.character.money, money);
  assert.match(ctx.io.text(), /Instruktor Radogost\s+33%/); // 1 of 3 HP left, still standing
  assert.ok(ctx.state.character.hp >= 1);
});

test("sparing: 200 ziaren, bierny i bojowy gracz – nigdy DefeatError, HP ≥ 1", async () => {
  const data = minimalData();
  const def = { id: "x", type: "combat", enemies: [{ id: "instruktor" }], start: "melee", training: true, nonLethal: true, canFlee: false };
  const strategies = [Array(150).fill("k"), Array.from({ length: 150 }, (_, i) => (i % 4 === 3 ? "k" : "a"))];
  for (let seed = 1; seed <= 200; seed++) {
    for (const inputs of strategies) {
      const ctx = ctxFor(inputs, { data });
      ctx.rng = createRng(seed);
      await defaultHandlers.combat(ctx, def);
      assert.ok(ctx.state.character.hp >= 1, `seed ${seed}`);
      assert.ok(ctx.state.flags.combat_x_wygrana || ctx.state.flags.combat_x_porazka, `seed ${seed}`);
    }
  }
});

test("combat: [L] pokazuje dziennik, Wróć wraca bez utraty PA", async () => {
  const ctx = ctxFor(["l", "w", "a", ""]);
  await defaultHandlers.combat(ctx, FIGHT);
  await drained(ctx);
  const out = ctx.io.text();
  assert.match(out, /Dziennik walki/);
  const aps = [...out.matchAll(/PA [●○]+ \((\d+)\/(\d+)\)/g)].map((m) => m[1]);
  assert.ok(aps.length >= 2);
  assert.equal(aps[0], aps[1]);
  assert.equal(aps[0], [...out.matchAll(/PA [●○]+ \(\d+\/(\d+)\)/g)][0][1]);
});

test("combat: dwóch wrogów – wybór celu z menu, Wróć cofa do akcji", async () => {
  const ctx = ctxFor(["a", "w", "a", "2", "a", ""], { data: dataWith({ hp: 1 }) });
  await defaultHandlers.combat(ctx, { ...FIGHT, enemies: [{ id: "bandyta", count: 2 }] });
  await drained(ctx);
  assert.match(ctx.io.text(), /Trafiasz Bandytę 2 za /);
  assert.match(ctx.io.text(), /Trafiasz Bandytę 1 za /);
  assert.equal(ctx.state.flags.combat_x_wygrana, true);
});

test("combat: TTY – <down> + <enter> wybiera drugą dostępną akcję (Użyj), lista przedmiotów, Enter", async () => {
  const ctx = ctxFor([...Array(6).fill("<down>"), "<enter>", "<enter>", "a", "<enter>"], { tty: true }); // Atak, 4 ciosy celowane, Gotowość, (Przeładuj wyszarzone), Użyj
  await defaultHandlers.combat(ctx, FIGHT);
  await drained(ctx);
  assert.match(ctx.io.text(), /Używasz: Opatrunek\./);
  assert.equal(ctx.state.flags.combat_x_wygrana, true);
});

test("combat: bez postaci rzuca MissingCharacterError", async () => {
  const ctx = ctxFor([]);
  ctx.state.character = null;
  await assert.rejects(defaultHandlers.combat(ctx, FIGHT), { name: "MissingCharacterError" });
});

// Belt bandage (changes the inventory), end turn, the bandit hits (changes HP), then the input runs out mid-fight.
const MID_FIGHT = ["3", "1", "k"];
/** The bandit's hit really landed (its journal line may sit behind the skipped-entries marker): the HP shown dropped. */
const hpDropped = (out) => {
  const hp = [...out.matchAll(/Ty: HP (\d+)\//g)].map((m) => Number(m[1]));
  return hp.length > 1 && hp.at(-1) < hp[0];
};

test("combat: przerwa w środku walki cofa stan sprzed walki (HP, pas, czas, PD, pieniądze)", async () => {
  const ctx = ctxFor(MID_FIGHT, { data: dataWith({ hp: 100 }) });
  const before = structuredClone(ctx.state);
  await assert.rejects(defaultHandlers.combat(ctx, FIGHT), InputExhaustedError);
  assert.ok(hpDropped(ctx.io.text())); // the state really changed before the interruption
  assert.deepEqual(ctx.state, before);
  assert.equal(ctx.state.character.hp, before.character.hp);
  assert.equal(ctx.state.time.minutes, before.time.minutes);
});

// --- rozmowa z walką ---
const TALK = {
  id: "gadka", file: "gadka.json", start: "start",
  nodes: { start: { speaker: "Zbir", text: "Płać.", options: [{ text: "Nie", goto: "end:walka" }] } },
};
const TALK_SCENE = { id: "rozmowa", type: "dialogue", dialogue: "gadka", onCombat: { enemies: [{ id: "bandyta" }], start: "melee", onFlee: "uciekl" } };
const talkCtx = (inputs, opts) => {
  const ctx = ctxFor(inputs, opts);
  ctx.data = { ...ctx.data, dialogues: [TALK] };
  return ctx;
};

test("dialogue: end:walka + onCombat uruchamia walkę, flagi rozmowy i walki", async () => {
  const ctx = talkCtx(["1", "a", "", ""]);
  const result = await defaultHandlers.dialogue(ctx, TALK_SCENE);
  await drained(ctx);
  assert.equal(result, undefined);
  assert.equal(ctx.state.flags.dialog_gadka_walka, true);
  assert.equal(ctx.state.flags.combat_rozmowa_wygrana, true);
  assert.deepEqual(ctx.state.world.finishedDialogues, ["rozmowa"]);
  assert.doesNotMatch(ctx.io.text(), /w cyklu C2/);
});

test("dialogue: walka z rozmowy – ucieczka idzie do onFlee, bez menu obozu", async () => {
  const ctx = talkCtx(["1", "c", ""]);
  ctx.data.dialogues = [TALK];
  const result = await defaultHandlers.dialogue(ctx, { ...TALK_SCENE, onCombat: { ...TALK_SCENE.onCombat, start: "far" } });
  await drained(ctx);
  assert.deepEqual(result, { goto: "uciekl" });
  assert.equal(ctx.state.flags.combat_rozmowa_ucieczka, true);
  assert.deepEqual(ctx.state.world.finishedDialogues, ["rozmowa"]);
});

test("dialogue: przerwa w walce z rozmowy cofa do wyboru opcji (bez zaliczenia rozmowy)", async () => {
  const ctx = talkCtx(["1", ...MID_FIGHT], { data: dataWith({ hp: 100 }) });
  const before = structuredClone(ctx.state);
  await assert.rejects(defaultHandlers.dialogue(ctx, TALK_SCENE), InputExhaustedError);
  assert.ok(hpDropped(ctx.io.text()));
  assert.deepEqual(ctx.state.world.finishedDialogues, []);
  assert.deepEqual(ctx.state.flags, {});
  assert.deepEqual(ctx.state.inventory, before.inventory);
  assert.equal(ctx.state.character.hp, before.character.hp);
  assert.deepEqual(ctx.state.world.dialogueProgress, { rozmowa: "start" });
});

const TALK_CHECK = {
  id: "gadka", file: "gadka.json", start: "start",
  nodes: { start: { speaker: "Zbir", text: "Płać.", options: [
    { id: "targ", text: "Potargujmy", check: { skill: "handel", difficulty: 35 }, success: "start", failure: "end:walka" },
    { text: "Odejdź", goto: "end" },
  ] } },
};

test("dialogue: nieudany test, walka, przerwa – opcja nadal wyszarzona (bez ponownej próby)", async () => {
  const ctx = talkCtx(["1", ...MID_FIGHT], { data: dataWith({ hp: 100 }) });
  ctx.data = { ...ctx.data, dialogues: [TALK_CHECK] };
  ctx.rng = { int: (lo, hi) => (lo === 1 && hi === 100 ? 100 : lo) }; // the check fails; the bandit's rolls of 100 miss
  await assert.rejects(defaultHandlers.dialogue(ctx, TALK_SCENE), InputExhaustedError);
  assert.equal(ctx.state.world.failedChecks.length, 1);
  assert.deepEqual(ctx.state.world.finishedDialogues, []);
  const again = { ...ctx, io: createScriptedIO(["1", "2", ""]) }; // "1" is greyed out, "2" leaves
  await defaultHandlers.dialogue(again, TALK_SCENE);
  await drained(again);
  assert.match(again.io.text(), /Potargujmy \(próba nieudana\)/);
  assert.equal(again.state.flags.combat_rozmowa_wygrana, undefined);
});

// --- cała aplikacja: porażka i przerwanie ---
function appData(enemy) {
  const data = dataWith(enemy);
  data.story = { start: "c", scenes: [
    { id: "c", type: "character_creation" },
    { id: "walka", type: "combat", enemies: [{ id: "bandyta" }], start: "melee" },
    { id: "z", type: "ending", text: "Koniec drogi." },
  ] };
  return data;
}
// The fight runs on the always-minimum rng so hits are certain (the app's own rng is not injectable).
const appHandlers = (hp) => ({ ...defaultHandlers, combat: (ctx, scene) => defaultHandlers.combat({ ...ctx, rng: low() }, scene), character_creation: async (ctx) => {
  const cs = combatState(ctx.data, "miecz");
  ctx.state.character = cs.character;
  ctx.state.inventory = cs.inventory;
  if (hp !== undefined) ctx.state.character.hp = hp;
} });

/** Writes a save of a state standing on `sceneId` with a fixed `savedAt`. */
async function writeSave(data, slot, sceneId, savedAt, { hp } = {}) {
  const state = createNewState({ seed: 1, startScene: sceneId, rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  if (hp !== undefined) state.character.hp = hp;
  await saveGame(slot, state, createRng(1));
  const file = path.join(process.env.OSTRZE_HOME, "saves", `${slot}.json`);
  const json = JSON.parse(await readFile(file, "utf8"));
  json.savedAt = savedAt;
  await writeFile(file, JSON.stringify(json));
}

test("runApp: porażka – ekran, wczytanie najnowszego zapisu, bez crash", async () => {
  const data = appData({ hp: 50 });
  await writeSave(data, "1", "walka", "2026-01-01T10:00:00.000Z", { hp: 1 });
  await writeSave(data, "2", "z", "2026-06-01T10:00:00.000Z");
  await writeSave(data, "3", "c", "2026-03-01T10:00:00.000Z");
  // menu: load -> slot 1 (fight, HP 1) -> end turn -> dead -> Enter -> newest save (slot 2, ending) -> menu exit
  const io = createScriptedIO(["2", "1", "k", "", "", "", "4"]);
  const { lastState } = await runApp({ data, io, options: { handlers: appHandlers(), seed: 1 } });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assert.match(io.text(), /Padasz\. Ciemność\./);
  assert.ok(io.text().indexOf("Bandyta trafia cię za") < io.text().indexOf("Padasz."), "the killing blow comes before the defeat screen");
  assert.match(io.text(), /Koniec drogi\./);
  assert.equal(lastState.scene.id, "z");
  await assert.rejects(readFile(path.join(process.env.OSTRZE_HOME, "saves", "crash.json")), { code: "ENOENT" });
});

test("runApp: porażka bez żadnego zapisu wraca do menu głównego", async () => {
  const data = appData({ hp: 50 });
  const base = appHandlers(1);
  // the new game's first auto save is removed, so no save is left to load
  const handlers = { ...base, character_creation: async (ctx) => {
    await rm(path.join(process.env.OSTRZE_HOME, "saves"), { recursive: true, force: true });
    return base.character_creation(ctx);
  } };
  const io = createScriptedIO(["1", "k", "", "", "4"]);
  await runApp({ data, io, options: { handlers, seed: 1 } });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assert.match(io.text(), /Padasz\. Ciemność\./);
  assert.equal((io.text().match(/VOIDED: NA PRZEKÓR GWIAZDOM/g) ?? []).length, 2);
});

test("runApp: przerwa w walce (koniec wejścia) – auto-zapis na scenie walki sprzed walki, po wczytaniu walka od nowa", async () => {
  const data = appData({ hp: 100 });
  const handlers = appHandlers();
  const io = createScriptedIO(["1", ...MID_FIGHT, "^D"]);
  await runApp({ data, io, options: { handlers, seed: 1 } });
  const saved = await loadGame("auto", data);
  assert.equal(saved.scene.id, "walka");
  const fresh = combatState(data, "miecz").character;
  assert.equal(saved.character.xp, fresh.xp);
  assert.equal(saved.character.money, fresh.money);
  assert.equal(saved.character.hp, fresh.hp);
  assert.deepEqual(saved.inventory, combatState(data, "miecz").inventory);
  assert.equal(saved.time.minutes, createNewState({ seed: 1, startScene: "c", rules: data.rules }).time.minutes);
  assert.deepEqual(saved.flags, {});

  // the fight starts over; this time the bandit is weak, so one blow wins, paid exactly once
  const easy = appData({ hp: 1 });
  const io2 = createScriptedIO(["2", "1", "a", "", "", "4"]);
  const { lastState } = await runApp({ data: easy, io: io2, options: { handlers, seed: 1 } });
  await assert.rejects(io2.ask("?"), InputExhaustedError);
  assert.equal(lastState.scene.id, "z");
  assert.equal(lastState.character.xp, fresh.xp + 40);
  assert.equal(lastState.character.money, fresh.money + 4);
  assert.equal(lastState.flags.combat_walka_wygrana, true);
});

// --- poprawki po przeglądzie gałęzi ---
const leveled = () => appData({ hp: 1, xp: 200 });
/** Line-mode answers for the level-up screen: all points into the first skill, the first available perk (if any). */
function levelUpInputs(saved, data) {
  const pending = saved.character.pendingLevelUp;
  const inputs = ["1" + "+".repeat(pending.skillPoints), String(data.skills.length + 1)];
  const perk = availablePerks(saved, data).findIndex((p) => p.ok);
  if (pending.perks > 0 && perk >= 0) inputs.push(String(perk + 1));
  return inputs;
}

test("runApp: przerwa na ekranie awansu po walce nie wypłaca nagrody drugi raz po wczytaniu", async () => {
  const data = leveled();
  const handlers = appHandlers();
  const fresh = combatState(data, "miecz").character;
  const io = createScriptedIO(["1", "a", "", "^D"]); // new game, win, summary, level-up screen: input closed
  await runApp({ data, io, options: { handlers, seed: 1 } });
  const saved = await loadGame("auto", data);
  assert.equal(saved.scene.id, "walka");
  assert.equal(saved.character.xp, fresh.xp + 200);
  assert.deepEqual(saved.world.finishedCombats, { walka: "win" });

  // loaded: the level-up screen comes first, then the finished fight is skipped (no second payment, no summary)
  const io2 = createScriptedIO(["2", "1", ...levelUpInputs(saved, data), "", "4"]);
  const { lastState } = await runApp({ data, io: io2, options: { handlers, seed: 1 } });
  await assert.rejects(io2.ask("?"), InputExhaustedError);
  assert.equal(lastState.scene.id, "z");
  assert.equal(lastState.character.xp, fresh.xp + 200);
  assert.equal(lastState.character.money, fresh.money + 4);
  assert.doesNotMatch(io2.text(), /Zwycięstwo/);
});

test("combat: scena z zapisanym wynikiem pomija walkę (bez ekranów i nagród)", async () => {
  const ctx = ctxFor([]);
  ctx.state.world.finishedCombats = { x: "fled" };
  const { xp } = ctx.state.character;
  assert.deepEqual(await defaultHandlers.combat(ctx, { ...FIGHT, onFlee: "uciekl" }), { goto: "uciekl" });
  assert.equal(ctx.state.character.xp, xp);
  assert.equal(ctx.io.text(), "");
});

test("combat: wynik walki trafia do world.finishedCombats; przerwa na podsumowaniu go wycofuje", async () => {
  const ok = ctxFor(["a", ""]);
  await defaultHandlers.combat(ok, FIGHT);
  assert.deepEqual(ok.state.world.finishedCombats, { x: "win" });
  const cut = ctxFor(["a"]);
  await assert.rejects(defaultHandlers.combat(cut, FIGHT), InputExhaustedError);
  assert.deepEqual(cut.state.world.finishedCombats, {});
});

test("sparing zaczęty z 1 HP nie jest natychmiastową porażką; HP wraca do 1", async () => {
  const ctx = ctxFor(["a", "k", ""], { data: dataWith({ hp: 50 }), hp: 1 });
  await defaultHandlers.combat(ctx, { ...FIGHT, training: true, nonLethal: true, canFlee: false });
  await drained(ctx);
  assert.match(ctx.io.text(), /Trafiasz Bandytę/);
  assert.equal(ctx.state.character.hp, 1);
});

/** The screen frame (from the last clear before `marker` to the end of its "Wróć" row) of a TTY run. */
function pickerFrame(io, marker) {
  const out = io.output.join("");
  const at = out.indexOf(marker);
  // since E1 the picker is a whole frame: from the screen clear before the marker to the next one
  const from = out.lastIndexOf("\u001b[2J", at);
  const next = out.indexOf("\u001b[2J", at);
  return stripVTControlCharacters(out.slice(from, next < 0 ? undefined : next)).replace(/^\[2J\[3J\[H/, "");
}

test("wybór celu i przedmiotu: ekran walki + sam wybór, bez listy akcji, ramka ≤ 23 wiersze", async () => {
  const target = ctxFor(["a", "<enter>", "a", "<enter>"], { data: dataWith({ hp: 1 }), tty: true });
  await defaultHandlers.combat(target, { ...FIGHT, enemies: [{ id: "bandyta", count: 2 }] });
  await drained(target);
  const t1 = pickerFrame(target.io, "Wybierz cel");
  assert.ok(t1.split("\n").length - 1 <= 23, t1);
  assert.match(t1, /PA /);
  assert.doesNotMatch(t1, /Koniec tury/);

  const item = ctxFor(["u", "<enter>", "a", "<enter>"], { tty: true });
  await defaultHandlers.combat(item, FIGHT);
  await drained(item);
  const t2 = pickerFrame(item.io, "Użyj czego?");
  assert.ok(t2.split("\n").length - 1 <= 23, t2);
  assert.match(t2, /PA /);
  assert.doesNotMatch(t2, /Koniec tury/);
});

test("tryb liniowy nie pokazuje grafiki, TTY – tak", async (t) => {
  setColorsEnabled(true);
  setRich256(true);
  t.after(() => { setColorsEnabled(false); setRich256(null); });
  const data = dataWith({ hp: 1 });
  const artRow = renderPixels(data.art.bandyta, { color: true }).find((l) => /[▀▄]/.test(l));
  const hasArt = (ctx) => ctx.io.output.join("").includes(artRow);
  const line = ctxFor(["a", ""], { data });
  await defaultHandlers.combat(line, FIGHT);
  assert.ok(!hasArt(line), "line mode");
  const small = ctxFor(["a", "<enter>"], { data, tty: true });
  await defaultHandlers.combat(small, FIGHT);
  assert.ok(!hasArt(small), "tty 80×24: the scene panel is too narrow for the art");
  const tty = ctxFor(["a", "<enter>"], { data, tty: true });
  tty.io.columns = 200;
  tty.io.rows = 55;
  await defaultHandlers.combat(tty, FIGHT);
  assert.ok(hasArt(tty), "tty 200×55");
});

test("sparing przegrany ma własny tekst podsumowania", async () => {
  const ctx = ctxFor(["k", ""], { data: dataWith({ hp: 50 }), hp: 3 });
  await defaultHandlers.combat(ctx, { ...FIGHT, training: true, nonLethal: true, canFlee: false });
  await drained(ctx);
  assert.match(ctx.io.text(), /Przegrywasz walkę ćwiczebną/);
  assert.doesNotMatch(ctx.io.text(), /ledwo trzymasz/);
});

test("remis ma własny tekst podsumowania", async () => {
  const data = dataWith({ hp: 50 });
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, attacks: [{ ...e.attacks[0], apCost: 99 }] } : e));
  const ctx = ctxFor([...Array(200).fill("k"), ""], { data });
  await defaultHandlers.combat(ctx, FIGHT);
  await drained(ctx);
  assert.match(ctx.io.text(), /Walka się rozmywa – obie strony odchodzą\./);
  assert.doesNotMatch(ctx.io.text(), /Wycofujesz się/);
});

test("runApp: porażka – gdy najnowszy zapis się nie wczyta, próbuje następnego", async () => {
  const data = appData({ hp: 50 });
  await writeSave(data, "1", "walka", "2026-01-01T10:00:00.000Z", { hp: 1 });
  await writeSave(data, "2", "z", "2026-06-01T10:00:00.000Z");
  await writeSave(data, "3", "z", "2026-03-01T10:00:00.000Z");
  // After the defeat screen the listing loads every save once; the load right after it (the newest, slot 2) fails.
  const classes = [...data.classes];
  let armed = false;
  let calls = 0;
  let limit = 0;
  classes.some = (...args) => {
    if (!armed) return Array.prototype.some.apply(classes, args);
    calls += 1;
    return calls === limit + 1 ? false : Array.prototype.some.apply(classes, args);
  };
  data.classes = classes;
  const io = createScriptedIO(["2", "1", "k", "", "", "", "4"]);
  const write = io.write;
  io.write = (text) => {
    if (String(text).includes("Padasz")) { armed = true; limit = readdirSync(path.join(process.env.OSTRZE_HOME, "saves")).length; }
    write(text);
  };
  const { lastState } = await runApp({ data, io, options: { handlers: appHandlers(), seed: 1 } });
  await assert.rejects(io.ask("?"), InputExhaustedError);
  assert.match(io.text(), /nieznana klasa/);
  assert.match(io.text(), /Koniec drogi\./);
  assert.equal(lastState.scene.id, "z");
  assert.equal(lastState.savedAt, "2026-03-01T10:00:00.000Z");
});

// --- C2b: techniki, pełny dziennik, znacznik pominiętych ---
/** A bandit with many HP and one plain attack (no effects): `attack` overrides the attack's fields. */
function sturdy(enemy = {}, attack = {}) {
  const data = dataWith({ hp: 100, ...enemy });
  data.enemies = data.enemies.map((e) => (e.id === "bandyta" ? { ...e, attacks: [{ ...e.attacks[0], effects: [], ...attack }] } : e));
  return data;
}
const apReadings = (out) => [...out.matchAll(/PA [●○]+ \((\d+)\/\d+\)/g)].map((m) => Number(m[1]));

test("combat: [G] Cios w głowę – cel, koszt o 1 PA wyższy niż zwykły atak (4 PA); Wróć z wyboru celu nic nie wydaje", async () => {
  const ctx = ctxFor(["g", "w", "g", "1"], { data: sturdy({}, { damage: [1, 1] }) });
  await assert.rejects(defaultHandlers.combat(ctx, { ...FIGHT, enemies: [{ id: "bandyta", count: 2 }] }), InputExhaustedError);
  const out = ctx.io.text();
  assert.match(out, /\[2\] \[G\] Cios w głowę \(4 PA\)/);
  assert.match(out, /\[5\] \[S\] Ogłusz \(3 PA\)/);
  assert.match(out, /Wybierz cel/);
  assert.doesNotMatch(out, /Celuj w/);
  assert.match(out, /Bandyt[ęy]? 1/);
  const aps = apReadings(out);
  // every screen before the blow shows full AP (Wróć spends nothing); after it: miecz 3 + 1 for the aim
  assert.equal(aps.length, 5);
  assert.ok(aps.slice(0, -1).every((ap) => ap === aps[0]), aps.join(","));
  assert.equal(aps.at(-1), aps[0] - 4);
});

test("combat: znacznik (+2 wcześniej – [L]) po turze wrogów – dziennik ma 5 wpisów, 4 nowe od ostatniego ekranu", async () => {
  const ctx = ctxFor(["a", "1", "k"], { data: sturdy({}, { damage: [1, 1], damageType: "sieczne" }) });
  await assert.rejects(defaultHandlers.combat(ctx, { ...FIGHT, enemies: [{ id: "bandyta", count: 2 }] }), InputExhaustedError);
  const out = ctx.io.text();
  const last = out.slice(out.lastIndexOf("BANDYTA"));
  assert.match(last, /\(\+2 wcześniej – \[L\]\)/);
  assert.equal((out.match(/wcześniej/g) ?? []).length, 1);
  assert.match(last, /· Bandyta 2 trafia cię za 1\.\n· Bandyta 2 trafia cię za 1\./);
});

test("combat TTY: 45 wpisów – pełny dziennik [L] i podmenu Technik mieszczą się w 24 wierszach", async () => {
  const data = sturdy({ initiative: 99, ap: 15 }, { apCost: 1 });
  const ctx = ctxFor(["l", "<enter>", "t", "w"], { data, tty: true });
  const pair = combatState(data, "wlocznia"); // "Techniki" open only with two weapons
  ctx.state.character = pair.character;
  ctx.state.inventory = pair.inventory;
  ctx.rng = { int: (lo, hi) => hi }; // enemies lead; every roll of 100 misses
  await assert.rejects(defaultHandlers.combat(ctx, { ...FIGHT, ambush: true, enemies: [{ id: "bandyta", count: 3 }] }), InputExhaustedError);
  assert.match(ctx.io.text(), /\(\+\d+ wcześniej – \[L\]\)/);
  const log = pickerFrame(ctx.io, "Dziennik walki");
  assert.ok(log.split("\n").length - 1 <= 24, log);
  // since E1b the journal fills the scene panel (newest at the bottom); the choice panel holds the scroll hint and "Wróć"
  assert.match(log, /▶ \[W\] Wróć/);
  assert.match(log, /↑\/↓/);
  assert.equal((log.match(/· Bandyta 3 chybia\./g) ?? []).length >= 12, true, log);
  const tech = pickerFrame(ctx.io, "Wybierz technikę");
  assert.ok(tech.split("\n").length - 1 <= 23, tech);
  assert.match(tech, /PA /);
  assert.match(tech, /Atak obiema/);
  assert.doesNotMatch(tech, /Koniec tury/);
});

test("combat: pełny dziennik w trybie liniowym – wszystkie wpisy i Wróć, nic nie kosztuje", async () => {
  const data = sturdy({ initiative: 99, ap: 15 }, { apCost: 1 });
  const ctx = ctxFor(["l", "w"], { data });
  ctx.rng = { int: (lo, hi) => hi };
  await assert.rejects(defaultHandlers.combat(ctx, { ...FIGHT, ambush: true, enemies: [{ id: "bandyta", count: 3 }] }), InputExhaustedError);
  const out = ctx.io.text();
  const log = out.slice(out.indexOf("Dziennik walki"));
  assert.match(log, /\[1\] · Bandyta 1 chybia\./);
  assert.match(log, /\[45\] · Bandyta 3 chybia\./);
  assert.match(log, /\[46\] \[W\] Wróć/);
  const aps = apReadings(out);
  assert.equal(aps[0], aps[1]);
});

test("combat: rzut włócznią (para) i przerwa – para zostaje w torbie, combat.thrown nie trafia do stanu, stan wraca sprzed walki", async () => {
  const data = sturdy({}, { damage: [1, 1] });
  const ctx = ctxFor(["t", "3"], { data });
  const cs = combatState(data, "wlocznia");
  ctx.state.character = cs.character;
  ctx.state.inventory = cs.inventory;
  ctx.state.character.hp = 999;
  const before = structuredClone(ctx.state);
  const midStates = [];
  const ask = ctx.io.ask.bind(ctx.io);
  ctx.io.ask = (...args) => { midStates.push(structuredClone(ctx.state)); return ask(...args); };
  await assert.rejects(defaultHandlers.combat(ctx, { ...FIGHT, start: "far" }), InputExhaustedError);
  assert.match(ctx.io.text(), /Rzucasz: Włócznia/);
  const mid = midStates.at(-1); // state at the prompt right after the throw, before the interruption
  assert.equal(countOf(mid, "para_wloczni"), 1);
  assert.equal(JSON.stringify(mid).includes("thrown"), false);
  assert.equal(countOf(ctx.state, "para_wloczni"), 1);
  assert.deepEqual(ctx.state, before);
});

test("combat: klasa włóczni widzi w głównym menu „Rzuć: Włócznia” i „Atak obiema”, bez wchodzenia w Techniki", async () => {
  const data = sturdy({}, { damage: [1, 1] });
  const ctx = ctxFor([], { data });
  const cs = combatState(data, "wlocznia");
  ctx.state.character = cs.character;
  ctx.state.inventory = cs.inventory;
  await assert.rejects(defaultHandlers.combat(ctx, { ...FIGHT, start: "far" }), InputExhaustedError);
  const text = ctx.io.text();
  assert.match(text, /Rzuć: Włócznia/);
  assert.match(text, /Atak obiema/);
});

test("combat: po rzucie główne menu ma „Podnieś: Włócznia”, a martwego „Rzuć” już nie", async () => {
  const data = sturdy({}, { damage: [1, 1] });
  const ctx = ctxFor(["t", "3"], { data });
  const cs = combatState(data, "wlocznia");
  ctx.state.character = cs.character;
  ctx.state.inventory = cs.inventory;
  ctx.state.character.hp = 999;
  await assert.rejects(defaultHandlers.combat(ctx, { ...FIGHT, start: "far" }), InputExhaustedError);
  const out = ctx.io.text();
  const afterThrow = out.slice(out.indexOf("Rzucasz: Włócznia"));
  assert.match(afterThrow, /Podnieś: Włócznia/);
  assert.doesNotMatch(afterThrow, /Rzuć: Włócznia/);
});

test("combat: po turze wrogów z wieloma zdarzeniami (kilku wrogów naraz) jest przebieg tury, nic nie dzieje się niewidocznie", async () => {
  const data = sturdy({}, { damage: [1, 1] });
  const ctx = ctxFor(["k"], { data });
  const cs = combatState(data, "wlocznia");
  ctx.state.character = cs.character;
  ctx.state.inventory = cs.inventory;
  ctx.state.character.hp = 999;
  ctx.rng = { int: (lo, hi) => (lo === 1 && hi === 100 ? 1 : lo) };
  await assert.rejects(defaultHandlers.combat(ctx, { ...FIGHT, enemies: [{ id: "bandyta", count: 4 }], start: "far" }), InputExhaustedError);
  const text = ctx.io.text();
  assert.match(text, /Przebieg tury wrogów \(\d+ zdarze(?:nie|nia|ń)\)/);
});

// --- E1b: walka w dwóch panelach ---
import { readFrame } from "./frame_read.js";
const strip = (s) => stripVTControlCharacters(s);
const lastFrameOf = (io) => {
  const out = io.output.join("");
  const lines = strip(out.slice(out.lastIndexOf("\x1b[2J") + 11)).split("\n");
  return lines.slice(0, lines.findIndex((l) => /^█▄+█$/.test(l)) + 1);
};
function logFight(inputs, { cols = 80, rows = 24 } = {}) {
  const ctx = ctxFor(inputs, { data: sturdy({ initiative: 99, ap: 15 }, { apCost: 1 }), tty: true });
  ctx.io.columns = cols;
  ctx.io.rows = rows;
  ctx.rng = { int: (lo, hi) => hi }; // enemies lead; every roll of 100 misses
  return ctx;
}
const THREE = { ...FIGHT, ambush: true, enemies: [{ id: "bandyta", count: 3 }] };

test("E1b walka: lewy panel to blok wrogów i najnowsze wpisy dziennika (80×24: ≥ 3, 160×45: ≥ 10), ramka rows − 1", async () => {
  for (const [cols, rows, min] of [[80, 24, 3], [160, 45, 10]]) {
    const ctx = logFight([], { cols, rows });
    await assert.rejects(defaultHandlers.combat(ctx, THREE), InputExhaustedError);
    const lines = lastFrameOf(ctx.io);
    const f = readFrame(lines);
    assert.equal(lines.length, rows - 1);
    assert.ok(lines.every((l) => [...l].length <= 200), "≤ 200 kolumn");
    assert.ok(f.scene.some((l) => l.includes("BANDYTA")), f.scene.join("\n"));
    assert.ok(f.scene.filter((l) => l.trimStart().startsWith("· Bandyta")).length >= min, f.scene.join("\n"));
    assert.ok(f.choices.some((l) => l.includes("[A] Atak")) && f.choices.some((l) => l.includes("[G] Cios w głowę")), f.choices.join("\n"));
  }
});

test("E1b walka: [L] przewija pełny dziennik strzałkami w lewym panelu na całą wysokość", async () => {
  const ctx = logFight(["l", ...Array(30).fill("<up>"), "<enter>"]);
  await assert.rejects(defaultHandlers.combat(ctx, THREE), InputExhaustedError);
  const frames = ctx.io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1).filter((c) => c.startsWith("█▀")).map((c) => readFrame(strip(c).split("\n").slice(0, 23)));
  const logs = frames.filter((f) => f.title === "Dziennik walki");
  assert.ok(logs.length > 20, "dziennik przerysowany przy każdym przewinięciu");
  assert.equal(logs[0].scene.filter((l) => l.startsWith("·")).length, 16);
  assert.ok(logs.at(-1).scene.some((l) => l.includes("· Bandyta 1 chybia.")), logs.at(-1).scene.join("\n"));
  assert.ok(logs[0].choices.some((l) => l.includes("▶ [W] Wróć")));
});

test("E1b walka: długie etykiety (powód niedostępności) obcięte „…” w wąskim panelu; kursor zawsze widoczny", async () => {
  const ctx = ctxFor([], { data: sturdy({}), tty: true });
  await assert.rejects(defaultHandlers.combat(ctx, FIGHT), InputExhaustedError);
  const f = readFrame(lastFrameOf(ctx.io));
  assert.ok(f.choices.some((l) => l.startsWith("▶ [A]")), f.choices.join("\n"));
  assert.ok(f.choices.some((l) => l.includes("…")), f.choices.join("\n"));
});

// --- E2a: noc upiorów ---
test("upior_nocy: 200 ziaren, miecz i włócznia – zawsze porażka przez onDefeat, HP = 1, nigdy DefeatError", async () => {
  const data = minimalData();
  const def = { id: "noc", type: "combat", enemies: [{ id: "upior_nocy", count: 2 }], start: "melee", canFlee: false, onDefeat: "omdlenie" };
  const inputs = Array.from({ length: 150 }, (_, i) => ["a", "1", "a", "1", "k"][i % 5]);
  for (const classId of ["miecz", "wlocznia"]) {
    for (let seed = 1; seed <= 200; seed++) {
      const ctx = ctxFor([...inputs], { data });
      const cs = combatState(data, classId);
      ctx.state.character = cs.character;
      ctx.state.inventory = cs.inventory;
      ctx.rng = createRng(seed);
      const next = await defaultHandlers.combat(ctx, def);
      assert.deepEqual(next, { goto: "omdlenie" }, `${classId} seed ${seed}`);
      assert.equal(ctx.state.character.hp, 1, `${classId} seed ${seed}`);
    }
  }
});
