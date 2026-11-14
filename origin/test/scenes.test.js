import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { writeFile, rm } from "node:fs/promises";
import { defaultHandlers } from "../src/scenes/index.js";
import { SCENE_TYPES } from "../src/scenes/schemas.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { loadGame } from "../src/engine/save.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { getStats } from "../src/systems/stats.js";
import { createCharacter, creatorStartAttributes } from "../src/systems/character.js";
import { minimalData, tmpDir } from "./helpers.js";

let savedHome;
beforeEach(async () => { savedHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => {
  if (savedHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = savedHome;
});

function ctxZ(inputs) {
  const data = minimalData();
  const io = createScriptedIO(inputs);
  const state = createNewState({ seed: 1, startScene: "a", rules: { startHour: 6 } });
  return { state, data, io, rng: createRng(1), debug: false };
}

test("narration wypisuje pasek stanu, tytuł i tekst, czeka na Enter", async () => {
  const ctx = ctxZ([""]);
  const result = await defaultHandlers.narration(ctx, { id: "a", type: "narration", title: "Prolog", text: "Świt." });
  const out = ctx.io.text();
  assert.equal(result, undefined);
  assert.match(out, /Dzień 1, 06:00/);
  assert.match(out, /Prolog/);
  assert.match(out, /Świt\./);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});

test("narration bez tytułu działa", async () => {
  const ctx = ctxZ([""]);
  await defaultHandlers.narration(ctx, { id: "a", type: "narration", text: "Świt." });
  assert.match(ctx.io.text(), /Świt\./);
});

test("flag ustawia flagi bez wejścia", async () => {
  const ctx = ctxZ([]);
  await defaultHandlers.flag(ctx, { id: "f", type: "flag", set: { x: true, y: false } });
  assert.deepEqual(ctx.state.flags, { x: true, y: false });
  assert.equal(ctx.io.text(), "");
});

test("save_point zapisuje slot auto i informuje", async () => {
  const ctx = ctxZ([]);
  await defaultHandlers.save_point(ctx, { id: "s", type: "save_point" });
  assert.equal((await loadGame("auto", ctx.data)).scene.id, ctx.state.scene.id);
  assert.deepEqual(ctx.notices, ["Zapisano."]);
});

test("notatka z save_point pojawia się na następnym ekranie po pasku stanu i jest opróżniana", async () => {
  const ctx = ctxZ(["", ""]);
  await defaultHandlers.save_point(ctx, { id: "s", type: "save_point" });
  await defaultHandlers.narration(ctx, { id: "a", type: "narration", text: "Świt." });
  const lines = ctx.io.text().split("\n");
  assert.equal(lines[0], "Dzień 1, 06:00 · świt");
  assert.equal(lines[1], "Zapisano.");
  assert.deepEqual(ctx.notices, []);
  await defaultHandlers.narration(ctx, { id: "a", type: "narration", text: "Świt." });
  assert.equal((ctx.io.text().match(/Zapisano\./g) ?? []).length, 1);
});

test("save_point przy błędzie zapisu informuje i nie rzuca", async () => {
  const ctx = ctxZ([]);
  process.env.OSTRZE_HOME = path.join(await tmpDir(), "plik");
  await writeFile(process.env.OSTRZE_HOME, "x");
  await defaultHandlers.save_point(ctx, { id: "s", type: "save_point" });
  assert.equal(ctx.io.text(), "");
  assert.match(ctx.notices[0], /Nie udało się zapisać/);
});

test("ending zwraca end", async () => {
  const result = await defaultHandlers.ending(ctxZ([""]), { id: "k", type: "ending", text: "Koniec." });
  assert.deepEqual(result, { end: true });
});

test("rejestr pokrywa wszystkie typy z SCENE_TYPES", () =>
  assert.deepEqual(Object.keys(defaultHandlers).sort(), Object.keys(SCENE_TYPES).sort()));

test("scena var zmienia zmienne bez wejścia", async () => {
  const ctx = ctxZ([]);
  await defaultHandlers.var(ctx, { id: "v", type: "var", add: { dlug: 1 } });
  assert.equal(ctx.state.vars.dlug, 1);
  assert.equal(ctx.io.text(), "");
});

test("narration z postacią: [P] otwiera ekran postaci i wraca do sceny", async () => {
  const ctx = ctxZ(["p", "", ""]);
  ctx.state.character = createCharacter({
    name: "Thorgniew", classId: "miecz", attributes: { ...creatorStartAttributes(ctx.data), sila: 7, krzepa: 7, zrecznosc: 6 }, tagged: ["sieczna", "wrecz", "wymowa"],
  }, ctx.data);
  await defaultHandlers.narration(ctx, { id: "a", type: "narration", title: "Prolog", text: "Świt." });
  const out = ctx.io.text();
  assert.match(out, /Atrybuty/);
  assert.equal((out.match(/Świt\./g) ?? []).length, 2);
  assert.match(out, /Thorgniew, poz\. 1/);
});

// --- kreator i reward ---
const { MissingCharacterError } = await import("../src/scenes/errors.js");
const makeCtx = (io) => ({
  state: createNewState({ seed: 1, startScene: "k", rules: { startHour: 6 } }),
  data: minimalData(), io, rng: createRng(1), debug: false,
});
const expectHero = (state) => {
  const c = state.character;
  assert.equal(c.name, "Thorgniew"); assert.equal(c.classId, "miecz");
  assert.deepEqual(c.attributes, { sila: 7, zrecznosc: 6, krzepa: 7, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 });
  assert.deepEqual([...c.tagged].sort(), ["medycyna", "sieczna", "wymowa"]); assert.equal(state.flags.klasa_miecz, true);
};
test("kreator w trybie TTY (strzałki)", async () => {
  const keys = ["Thorgniew", "<enter>",
    "<right>", "<right>", "<down>", "<right>", "<down>", "<right>", "<right>",
    "<down>", "<down>", "<down>", "<down>", "<down>", "<enter>",
    "7", "9", "<down>", "<down>", "<down>", "<enter>",
    // the summary (character sheet) is paged in the frame: Enter for each page, then "Zatwierdź"
    "<enter>", "<enter>", "<enter>"];
  const ctx = makeCtx(createScriptedIO(keys, { tty: true }));
  await defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" }); expectHero(ctx.state);
  // Hints of the tagged-skill step are the untagged base for every skill, also the class's own (Ruling 16).
  const attributes = { sila: 7, zrecznosc: 6, krzepa: 7, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 };
  const preview = { character: { attributes, skillPoints: {}, tagged: [], perks: [], level: 1, hp: 0 }, time: { minutes: 360 } };
  const base = getStats(preview, ctx.data, { permanentOnly: true }).skills.sieczna;
  const name = ctx.data.skills.find((x) => x.id === "sieczna").name;
  assert.ok(ctx.io.text().includes(`[x] ${name} ${base}`), "wskazówka wiodącej = baza bez bonusu");
});
test("kreator bez TTY (skróty)", async () => {
  const ctx = makeCtx(createScriptedIO(["Thorgniew", "1", "1++", "2+", "3++", "8", "7", "9", "12", "1"]));
  await defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" }); expectHero(ctx.state);
});
test("kreator: 'Zacznij od nowa' wraca do imienia; puste imię = domyślne", async () => {
  const ctx = makeCtx(createScriptedIO(["Pierwszy", "1", "1++", "2+", "3++", "8", "7", "9", "12", "2",
    "Drugi", "1", "1++", "2+", "3++", "8", "7", "9", "12", "1"]));
  await defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" });
  assert.equal(ctx.state.character.name, "Drugi");
  const ctx2 = makeCtx(createScriptedIO(["", "1", "1++", "2+", "3++", "8", "7", "9", "12", "1"]));
  await defaultHandlers.character_creation(ctx2, { id: "k", type: "character_creation" });
  assert.equal(ctx2.state.character.name, "Bezimienny");
});
test("reward: XP, awans, MissingCharacterError", async () => {
  const ctx = makeCtx(createScriptedIO(["", ""]));
  await assert.rejects(defaultHandlers.reward(ctx, { id: "r", type: "reward", xp: 10 }), MissingCharacterError);
  ctx.state.character = createCharacter({ name: "Ala", classId: "miecz", attributes: { ...creatorStartAttributes(ctx.data), sila: 7, zrecznosc: 6, krzepa: 7 }, tagged: ["sieczna", "medycyna", "wymowa"] }, ctx.data);
  await defaultHandlers.reward(ctx, { id: "r", type: "reward", xp: 150 });
  assert.equal(ctx.state.character.level, 2);
  assert.deepEqual(ctx.state.character.pendingLevelUp, { skillPoints: 6, perks: 1 });
  assert.match(ctx.io.text(), /Zdobywasz 150 PD\./);
  assert.match(ctx.io.text(), /Awans! Poziom 2\./);
});
test("kreator: błąd createCharacter pokazuje komunikat po nagłówku kroku 1 i zaczyna od nowa", async () => {
  const ctx = makeCtx(createScriptedIO(["Thorgniew", "1", "1++", "2+", "3++", "8", "7", "9", "12",
    "Thorgniew", "1", "1++", "2+", "3++", "8", "7", "9", "12", "1"], { tty: false }));
  // nameMax: the first read (textInput bounds) allows the name, the second (createCharacter validation) rejects it.
  const creator = { ...ctx.data.rules.creator };
  let reads = 0;
  Object.defineProperty(creator, "nameMax", { get: () => (++reads === 2 ? 3 : 20) });
  ctx.data.rules = { ...ctx.data.rules, creator };
  await defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" });
  expectHero(ctx.state);
  const out = ctx.io.text();
  const msg = out.indexOf("imię musi mieć od");
  assert.ok(msg > 0);
  const lastHeader = out.lastIndexOf("Tworzenie postaci – Imię");
  assert.ok(lastHeader > 0 && msg < lastHeader && msg > out.lastIndexOf("Dzień 1", lastHeader));
});

// --- awans po scenie i odpoczynek ---
const { levelUpHook, errandHook, defaultAfterScene } = await import("../src/scenes/after.js");
const { addXp } = await import("../src/systems/character.js");
const hero = (ctx, tagged = ["sieczna", "medycyna", "wymowa"], krzepa = 7) => createCharacter({
  name: "Ala", classId: "miecz", attributes: { ...creatorStartAttributes(ctx.data), sila: 7 + (7 - krzepa), zrecznosc: 6, krzepa }, tagged,
}, ctx.data);

test("awans po scenie: punkty z krokiem 2 dla wiodącej, perk, leczenie", async () => {
  const ctx = makeCtx(createScriptedIO(["1+++", "2+++", "12", "5"]));
  ctx.state.character = hero(ctx, ["sieczna", "medycyna", "wymowa"]);
  addXp(ctx.state.character, 150, ctx.data);
  ctx.state.character.hp = 1;
  await levelUpHook(ctx);
  const c = ctx.state.character;
  assert.deepEqual(c.skillPoints, { sieczna: 3, drzewcowa: 3 });
  assert.deepEqual(c.perks, ["twarda_skora"]);
  assert.equal(c.pendingLevelUp, null);
  assert.equal(c.hp, getStats(ctx.state, ctx.data).derived.hpMax);
  assert.match(ctx.notices.at(-1), /Jesteś silniejszy\. Poziom 2\./);
  assert.match(ctx.io.text(), /Awans na poziom 2/);
});

test("awans na 3. poziom: najpierw atrybut (punkt co 2 poziomy), potem umiejętności i perk", async () => {
  const ctx = makeCtx(createScriptedIO(["1+", "8", "1++++++", "2++++++", "12", "5"]));
  ctx.state.character = hero(ctx, ["sieczna", "medycyna", "wymowa"]);
  const sila = ctx.state.character.attributes.sila;
  addXp(ctx.state.character, 450, ctx.data);
  assert.equal(ctx.state.character.pendingLevelUp.attributePoints, 1);
  await levelUpHook(ctx);
  const c = ctx.state.character;
  assert.equal(c.attributes.sila, sila + 1);
  assert.equal(c.pendingLevelUp, null);
  assert.match(ctx.io.text(), /Atrybuty: rozdziel punkt awansu/);
});

test("awans bez dostępnych perków: komunikat, że punkt czeka na następny awans", async () => {
  const ctx = makeCtx(createScriptedIO(["1+++", "2+++", "12"]));
  ctx.data = minimalData();
  ctx.data.perks = [{ id: "odlegly", name: "Odległy", description: "x", requires: { level: 10 } }];
  ctx.state.character = hero(ctx);
  addXp(ctx.state.character, 150, ctx.data);
  await levelUpHook(ctx);
  assert.ok(ctx.notices.some((n) => n.includes("Żaden talent nie jest dla ciebie dostępny. Punkt czeka na następny awans.")));
  assert.equal(ctx.state.character.pendingLevelUp, null);
  assert.deepEqual(ctx.state.character.perks, []);
});

test("awans bez oczekującego awansu nic nie robi; defaultAfterScene = [levelUpHook, errandHook]", async () => {
  const ctx = makeCtx(createScriptedIO([]));
  await levelUpHook(ctx);
  ctx.state.character = hero(ctx);
  await levelUpHook(ctx);
  assert.deepEqual(defaultAfterScene, [levelUpHook, errandHook]);
  assert.equal(ctx.io.text(), "");
});

test("awans: dwa perki – drugi wybór nie oferuje pierwszego; niedostępne mają opis braków", async () => {
  const ctx = makeCtx(createScriptedIO(["1+++", "2+++", "12", "5", "3"]));
  ctx.state.character = hero(ctx);
  ctx.state.character.pendingLevelUp = { skillPoints: 6, perks: 2 };
  await levelUpHook(ctx);
  assert.deepEqual(ctx.state.character.perks, ["twarda_skora", "twarda_reka"]);
  const out = ctx.io.text();
  assert.match(out, /Nieugięty wymaga poziomu 4/);
  assert.match(out, /Twarda skóra masz już/);
});

test("awans: dwa perki – drugi wybór nie oferuje perku zależnego od pierwszego (gadane → kupiecka żyłka)", async () => {
  const ctx = makeCtx(createScriptedIO(["12", "12", "13", "3"]));
  ctx.state.character = createCharacter({
    name: "Ala", classId: "miecz", attributes: { ...creatorStartAttributes(ctx.data), oglada: 6, sila: 8, zrecznosc: 6 }, tagged: ["sieczna", "medycyna", "wymowa"],
  }, ctx.data);
  ctx.state.character.skillPoints.handel = 17;
  const handel = getStats(ctx.state, ctx.data, { permanentOnly: true }).skills.handel;
  assert.ok(handel < 40 && handel + 10 >= 40, `przygotowanie: handel ${handel}`);
  ctx.state.character.pendingLevelUp = { skillPoints: 0, perks: 2 };
  await levelUpHook(ctx);
  assert.deepEqual(ctx.state.character.perks, ["gadane", "twarda_reka"]);
  assert.equal(ctx.state.character.pendingLevelUp, null);
  assert.match(ctx.io.text(), /Kupiecka żyłka .*niedostępne/);
});

test("awans: drugi perk bez dostępnych → komunikat noPerk", async () => {
  const ctx = makeCtx(createScriptedIO(["1+++", "2+++", "12", "1"]));
  ctx.data = minimalData();
  ctx.data.perks = [{ id: "jedyny", name: "Jedyny", description: "x" }];
  ctx.state.character = hero(ctx);
  ctx.state.character.pendingLevelUp = { skillPoints: 6, perks: 2 };
  await levelUpHook(ctx);
  assert.deepEqual(ctx.state.character.perks, ["jedyny"]);
  assert.ok(ctx.notices.some((n) => n.includes("Punkt czeka na następny awans")));
});

test("rest: MissingCharacterError bez postaci", async () => {
  await assert.rejects(defaultHandlers.rest(makeCtx(createScriptedIO([])), { id: "r", type: "rest" }), MissingCharacterError);
});

test("rest: 3 godziny od 17:30 leczy i zgłasza zmierzch", async () => {
  const ctx = makeCtx(createScriptedIO(["1++", "2", ""]));
  ctx.state.character = hero(ctx, undefined, 5);
  const hpMax = getStats(ctx.state, ctx.data).derived.hpMax;
  ctx.state.character.hp = hpMax - 15;
  ctx.state.time.minutes = 17 * 60 + 30;
  await defaultHandlers.rest(ctx, { id: "r", type: "rest" });
  assert.equal(ctx.state.character.hp, hpMax - 15 + 9);
  assert.equal(ctx.state.time.minutes, 17 * 60 + 30 + 180);
  const out = ctx.io.text();
  assert.match(out, /Zapada zmierzch\./);
  assert.match(out, /Odpoczywasz 3 godz\. Odzyskujesz 9 HP\./);
});

test("rest: leczenie nie przekracza hpMax", async () => {
  const ctx = makeCtx(createScriptedIO(["1+++++++", "2", ""]));
  ctx.state.character = hero(ctx);
  const hpMax = getStats(ctx.state, ctx.data).derived.hpMax;
  ctx.state.character.hp = hpMax - 1;
  await defaultHandlers.rest(ctx, { id: "r", type: "rest" });
  assert.equal(ctx.state.character.hp, hpMax);
  assert.match(ctx.io.text(), /Odzyskujesz 1 HP\./);
});
test("kreator: krok umiejętności wiodących mówi, ile wybrać i którą daje klasa", async () => {
  const ctx = makeCtx(createScriptedIO(["Thorgniew", "1", "1++", "2+", "3++", "8", "7", "9", "12", "1"]));
  await defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" });
  const cls = ctx.data.skills.find((x) => x.id === "sieczna").name;
  assert.ok(ctx.io.text().includes(`Wybierz 2 umiejętności wiodące – trzecią (${cls}) daje klasa.`), ctx.io.text());
});

// --- menu obozowe ---
const { QuitToMenuError } = await import("../src/scenes/errors.js");
const { runApp } = await import("../src/app.js");
const { readFile } = await import("node:fs/promises");
const campCtx = (inputs, opts) => {
  const ctx = ctxZ(inputs);
  if (opts) ctx.io = createScriptedIO(inputs, opts);
  ctx.state.character = createCharacter({
    name: "Thorgniew", classId: "miecz", attributes: { ...creatorStartAttributes(ctx.data), sila: 7, krzepa: 7, zrecznosc: 6 }, tagged: ["sieczna", "wrecz", "wymowa"],
  }, ctx.data);
  return ctx;
};
const NARR = { id: "a", type: "narration", title: "Prolog", text: "Świt." };
const slotPath = (slot) => path.join(process.env.OSTRZE_HOME, "saves", `${slot}.json`);

test("obóz: pusty Enter kończy scenę, lista obozu widoczna", async () => {
  const ctx = campCtx([""]);
  await defaultHandlers.narration(ctx, NARR);
  assert.match(ctx.io.text(), /Dalej/);
  assert.match(ctx.io.text(), /Zapisz grę/);
});

test("obóz: p, Enter otwiera kartę i kończy scenę; numer 2 działa tak samo", async () => {
  for (const pick of ["p", "2"]) {
    const ctx = campCtx([pick, "", ""]);
    await defaultHandlers.narration(ctx, NARR);
    assert.match(ctx.io.text(), /Atrybuty/);
  }
});

test("obóz: z, 1 zapisuje slot 1", async () => {
  const ctx = campCtx(["z", "1", ""]);
  await defaultHandlers.narration(ctx, NARR);
  assert.equal((await loadGame("1", ctx.data)).scene.id, "a");
  assert.match(ctx.io.text(), /Zapisano\./);
});

const drained = (ctx) => assert.rejects(ctx.io.ask("?"), InputExhaustedError);
const saveSlot1 = async () => {
  const ctx = campCtx(["z", "1", ""]);
  await defaultHandlers.narration(ctx, NARR);
  await drained(ctx);
  await new Promise((r) => setTimeout(r, 5));
  return readFile(slotPath("1"), "utf8");
};

test("obóz: nadpisanie zajętego slotu – n wraca do listy slotów bez zmiany", async () => {
  const first = await saveSlot1();
  const ctx = campCtx(["z", "1", "n", "4", ""]);
  await defaultHandlers.narration(ctx, NARR);
  await drained(ctx);
  assert.equal(await readFile(slotPath("1"), "utf8"), first);
  assert.match(ctx.io.text(), /Nadpisać zapis 1\? \[t\/n\]/);
});

test("obóz: nadpisanie po t zapisuje", async () => {
  const first = await saveSlot1();
  const ctx = campCtx(["z", "1", "t", ""]);
  await defaultHandlers.narration(ctx, NARR);
  await drained(ctx);
  assert.notEqual(await readFile(slotPath("1"), "utf8"), first);
  assert.equal((await loadGame("1", ctx.data)).scene.id, "a");
});

test("obóz: m, t rzuca QuitToMenuError i zapisuje auto; m, n tylko rzuca", async () => {
  const yes = campCtx(["m", "t"]);
  await assert.rejects(defaultHandlers.narration(yes, NARR), QuitToMenuError);
  assert.equal((await loadGame("auto", yes.data)).scene.id, "a");
  await rm(slotPath("auto"), { force: true });
  const no = campCtx(["m", "n"]);
  await assert.rejects(defaultHandlers.narration(no, NARR), QuitToMenuError);
  await assert.rejects(readFile(slotPath("auto")), { code: "ENOENT" });
});

test("obóz: narracja bez postaci – Enter kończy, bez listy obozu", async () => {
  const ctx = ctxZ([""]);
  await defaultHandlers.narration(ctx, NARR);
  assert.doesNotMatch(ctx.io.text(), /Zapisz grę/);
});

test("obóz: e otwiera ekran ekwipunku, Wróć wraca do obozu", async () => {
  const ctx = campCtx(["e", "1", ""]);
  await defaultHandlers.narration(ctx, NARR);
  await drained(ctx);
  assert.match(ctx.io.text(), /Ekwipunek · Waga 0\/\d+ kg · 0 gr/);
  assert.doesNotMatch(ctx.io.text(), /Ekwipunek \(niedostępne\)/);
});

test("obóz TTY: [P] z kolumny poleceń otwiera kartę", async () => {
  const ctx = campCtx(["p", "<enter>", "<enter>", "<enter>"], { tty: true });
  await defaultHandlers.narration(ctx, NARR);
  assert.match(ctx.io.text(), /Atrybuty/);
});

test("runApp: wyjście z obozu do menu głównego, bez zapisu crash", async () => {
  const data = minimalData({ start: "n", scenes: [
    { id: "n", type: "narration", text: "Świt." },
    { id: "k", type: "ending", text: "x" },
  ] });
  data.story.scenes.unshift({ id: "c", type: "character_creation" });
  data.story.start = "c";
  // Character creation needs a long script; seed a character via a custom handler instead.
  const handlers = { ...defaultHandlers, character_creation: async (ctx) => {
    ctx.state.character = createCharacter({
      name: "Tor", classId: "miecz", attributes: { ...creatorStartAttributes(ctx.data), sila: 7, krzepa: 7, zrecznosc: 6 }, tagged: ["sieczna", "wrecz", "wymowa"],
    }, ctx.data);
    return { goto: "n" };
  } };
  const io = createScriptedIO(["1", "m", "n", "4"]);
  await runApp({ data, io, options: { seed: 1, handlers } });
  assert.equal((io.text().match(/VOIDED: NA PRZEKÓR GWIAZDOM/g) ?? []).length, 2);
  await assert.rejects(readFile(slotPath("crash")), { code: "ENOENT" });
});

// --- reward: przedmioty, pieniądze, odbiór jednokrotny, zestaw startowy (Task 10) ---
const { saveGame } = await import("../src/engine/save.js");
const { carriedWeight } = await import("../src/systems/inventory.js");
const REW = { id: "r", type: "reward", xp: 0, money: 20, items: ["kaptur_mysliwego", { id: "strzala", qty: 10 }] };
// A boulder heavy enough to block any reward (weight far above the hard limit minus the reward).
const withGlaz = (data) => ({ ...data, items: [...data.items, { id: "test_glaz", name: "Głaz", type: "ammo", weight: 400, value: 0 }] });
const qtyOf = (state, id) => state.inventory.items.find((s) => s.id === id)?.qty ?? 0;

test("reward: pieniądze i przedmioty, podsumowanie, scena zaliczona", async () => {
  const ctx = campCtx([""]);
  const money = ctx.state.character.money;
  await defaultHandlers.reward(ctx, REW);
  await drained(ctx);
  assert.equal(ctx.state.character.money, money + 20);
  assert.equal(qtyOf(ctx.state, "kaptur_mysliwego"), 1);
  assert.equal(qtyOf(ctx.state, "strzala"), 10);
  assert.match(ctx.io.text(), /\+20 gr/);
  assert.match(ctx.io.text(), /Strzała ×10/);
  assert.doesNotMatch(ctx.io.text(), /\+0 PD/);
  assert.deepEqual(ctx.state.world.claimedRewards, ["r"]);
});

test("reward: druga egzekucja tej samej sceny nic nie zmienia", async () => {
  const ctx = campCtx(["", ""]);
  await defaultHandlers.reward(ctx, REW);
  const before = structuredClone(ctx.state);
  await defaultHandlers.reward(ctx, REW);
  await drained(ctx);
  assert.deepEqual(ctx.state, before);
  assert.match(ctx.io.text(), /już odebrana/);
});

test("reward: zapis w obozie i wczytanie nie powtarza nagrody", async () => {
  const ctx = campCtx(["z", "1", ""]);
  ctx.data.story.scenes.push({ id: "r", type: "reward", money: 1 });
  ctx.state.scene = { id: "r" };
  await defaultHandlers.reward(ctx, REW);
  await drained(ctx);
  const loaded = await loadGame("1", ctx.data);
  const money = loaded.character.money;
  const again = { ...ctx, state: loaded, io: createScriptedIO([""]) };
  await defaultHandlers.reward(again, REW);
  await drained(again);
  assert.equal(loaded.character.money, money);
  assert.equal(qtyOf(loaded, "strzala"), 10);
  assert.match(again.io.text(), /już odebrana/);
});

test("reward: przeciążenie – Zostaw pomija przedmiot, scena zaliczona", async () => {
  const ctx = campCtx(["2", ""]);
  ctx.data = withGlaz(ctx.data);
  ctx.state.inventory.items.push({ id: "test_glaz", qty: 1 });
  await defaultHandlers.reward(ctx, { id: "r", type: "reward", items: ["kolczuga"] });
  await drained(ctx);
  assert.equal(qtyOf(ctx.state, "kolczuga"), 0);
  assert.match(ctx.io.text(), /Kolczuga się nie mieści\./);
  assert.deepEqual(ctx.state.world.claimedRewards, ["r"]);
});

test("reward: przeciążenie – Wyrzuć coś, potem przedmiot wchodzi", async () => {
  const ctx = campCtx(["1", "1", "1", "t", "w", ""]);
  ctx.data = withGlaz(ctx.data);
  ctx.state.inventory.items.push({ id: "test_glaz", qty: 1 });
  await defaultHandlers.reward(ctx, { id: "r", type: "reward", items: ["kolczuga"] });
  await drained(ctx);
  assert.equal(qtyOf(ctx.state, "test_glaz"), 0);
  assert.equal(qtyOf(ctx.state, "kolczuga"), 1);
  assert.match(ctx.io.text(), /Kolczuga się nie mieści\./);
  assert.deepEqual(ctx.state.world.claimedRewards, ["r"]);
});

test("kreator: wydaje zestaw startowy klasy", async () => {
  const ctx = makeCtx(createScriptedIO(["Thorgniew", "2", "1++", "2+", "3++", "8", "7", "9", "12", "1"]));
  await defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" });
  assert.equal(ctx.state.character.classId, "wlocznia");
  assert.equal(ctx.state.inventory.equipped.bron, "para_wloczni");
  assert.equal(ctx.state.character.money, 30);
});

// --- sklep (Task 11) ---
const { shopStock, buyPrice, sellable } = await import("../src/systems/shop.js");
const { addItem: addInv } = await import("../src/systems/inventory.js");
const SHOP = { id: "s", type: "shop", shop: "kramarz_szkolny" };

test("sklep: kupno 2 opatrunków – pieniądze, torba, zapas, nagłówek", async () => {
  const ctx = campCtx(["1", "1", "1+", "2", "t", "3"]);
  ctx.state.character.money = 500;
  const money = ctx.state.character.money;
  const price = buyPrice(ctx.data, ctx.data.items.find((i) => i.id === "opatrunek"), getStats(ctx.state, ctx.data).skills.handel);
  const before = qtyOf(ctx.state, "opatrunek");
  const stock = shopStock(ctx.state, ctx.data, "kramarz_szkolny").find((e) => e.id === "opatrunek").qty;
  await defaultHandlers.shop(ctx, SHOP);
  await drained(ctx);
  assert.equal(ctx.state.character.money, money - 2 * price);
  assert.equal(qtyOf(ctx.state, "opatrunek"), before + 2);
  assert.equal(shopStock(ctx.state, ctx.data, "kramarz_szkolny").find((e) => e.id === "opatrunek").qty, stock - 2);
  const out = ctx.io.text();
  assert.match(out, /Kram kwatermistrza · Twoje pieniądze: \d+ gr · Waga/);
  assert.match(out, /Kupić Opatrunek ×2 za \d+ gr\? \[t\/n\]/);
  assert.match(out, /Kupiono: Opatrunek ×2/);
  assert.match(out, new RegExp(`= ${2 * price} gr`));
});

test("sklep: odmowa potwierdzenia nic nie zmienia", async () => {
  const ctx = campCtx(["1", "1", "1+", "2", "n", "3"]);
  ctx.state.character.money = 500;
  const money = ctx.state.character.money;
  await defaultHandlers.shop(ctx, SHOP);
  await drained(ctx);
  assert.equal(ctx.state.character.money, money);
  assert.equal(ctx.state.world.shops?.kramarz_szkolny, undefined);
});

test("sklep: za drogi przedmiot wyszarzony z powodem, wybór go nie przepuszcza", async () => {
  const ctx = campCtx(["1", "1", "2", "13", "3"]);
  ctx.state.character.money = 0;
  await defaultHandlers.shop(ctx, SHOP);
  await drained(ctx);
  assert.match(ctx.io.text(), /\[1\] Opatrunek · \d+ gr · ×4 Nie stać cię\. \(niedostępne\)/);
  assert.equal(ctx.state.character.money, 0);
});

test("sklep: sprzedaż wolnego miecza – pieniądze rosną, miecz u kupca", async () => {
  const ctx = campCtx([]);
  addInv(ctx.state, ctx.data, "miecz_krotki", 1);
  const list = sellable(ctx.state, ctx.data, "kramarz_szkolny");
  const idx = list.findIndex((e) => e.id === "miecz_krotki");
  assert.ok(idx >= 0);
  ctx.io = createScriptedIO(["2", String(idx + 1), "t", "3"]);
  const money = ctx.state.character.money;
  const had = qtyOf(ctx.state, "miecz_krotki");
  await defaultHandlers.shop(ctx, SHOP);
  await drained(ctx);
  assert.equal(ctx.state.character.money, money + list[idx].price);
  assert.equal(qtyOf(ctx.state, "miecz_krotki"), had - 1);
  assert.equal(ctx.state.world.shops.kramarz_szkolny.find((e) => e.id === "miecz_krotki").qty, 1);
  assert.match(ctx.io.text(), /Sprzedano: Krótki miecz ×1/);
});

test("sklep: pusta sprzedaż – Nic tu dla ciebie, powrót do menu", async () => {
  const ctx = campCtx(["2", "3"]);
  ctx.state.inventory.items = [];
  ctx.state.inventory.equipped = {};
  ctx.state.inventory.quickSlots = [];
  await defaultHandlers.shop(ctx, SHOP);
  await drained(ctx);
  assert.match(ctx.io.text(), /Nic tu dla ciebie\./);
});

test("sklep: Odejdź kończy scenę bez zmian; brak postaci", async () => {
  const ctx = campCtx(["3"]);
  const snap = structuredClone(ctx.state);
  assert.equal(await defaultHandlers.shop(ctx, SHOP), undefined);
  await drained(ctx);
  assert.deepEqual(ctx.state.character, snap.character);
  assert.deepEqual(ctx.state.inventory, snap.inventory);
  await assert.rejects(defaultHandlers.shop(ctxZ([]), SHOP), MissingCharacterError);
});

test("sliders: note jako funkcja liczy podgląd na żywo", async () => {
  const { sliders } = await import("../src/ui/menu.js");
  const ctx = ctxZ(["1+", "2"]);
  const out = await sliders(ctx.io, ctx.data.ui, { rows: [{ label: "X", value: 1, min: 1, max: 3, note: (v) => `=${v * 10}` }] });
  assert.deepEqual(out, [2]);
  assert.match(ctx.io.text(), /X 1 =10/);
  assert.match(ctx.io.text(), /X 2 =20/);
});

// --- poprawki po przeglądzie gałęzi (B2 final) ---
test("reward: przerwa na pytaniu o ciężar (auto-zapis) nie powtarza XP ani pieniędzy po wczytaniu", async () => {
  const ctx = campCtx([]); // input runs out at the too-heavy prompt
  ctx.data = withGlaz(ctx.data);
  ctx.state.inventory.items.push({ id: "test_glaz", qty: 1 });
  ctx.data.story.scenes.push({ id: "r", type: "reward", money: 1 });
  ctx.state.scene = { id: "r" };
  const scene = { id: "r", type: "reward", xp: 5, money: 20, items: ["kolczuga"] };
  const money = ctx.state.character.money;
  const xp = ctx.state.character.xp;
  await assert.rejects(defaultHandlers.reward(ctx, scene), InputExhaustedError);
  await saveGame("auto", ctx.state, ctx.rng);
  const loaded = await loadGame("auto", ctx.data);
  assert.equal(loaded.character.money, money + 20);
  assert.deepEqual(loaded.world.claimedRewards, ["r"]);
  const again = { ...ctx, state: loaded, io: createScriptedIO([""]) };
  await defaultHandlers.reward(again, scene);
  await drained(again);
  assert.equal(loaded.character.money, money + 20);
  assert.equal(loaded.character.xp, xp + 5);
  assert.equal(qtyOf(loaded, "kolczuga"), 0);
  assert.match(again.io.text(), /już odebrana/);
});

test("sklep: wpis z zerową ilością (ręcznie edytowany zapis) nie trafia do oferty", async () => {
  const ctx = campCtx([]);
  ctx.state.world.shops = { kramarz_szkolny: [{ id: "opatrunek", qty: 0 }, { id: "napar_ziol", qty: 2 }] };
  assert.deepEqual(shopStock(ctx.state, ctx.data, "kramarz_szkolny"), [{ id: "napar_ziol", qty: 2 }]);
});

test("sklep: waluta pochodzi z currency.short (bez zaszytego „gr”)", async () => {
  const ctx = campCtx(["1", "1", "1", "2", "t", "2", "1", "2", "t", "3"]);
  ctx.data = { ...ctx.data, ui: { ...ctx.data.ui, "currency.short": "zł" } };
  ctx.state.character.money = 500;
  await defaultHandlers.shop(ctx, SHOP);
  await drained(ctx);
  const out = ctx.io.text();
  assert.match(out, /zł/);
  assert.doesNotMatch(out, /gr/);
});

test("zapis: odmowa nadpisania w TTY czyści ekran – lista slotów nie dubluje się", async () => {
  const ctx = campCtx(["<enter>", "n", "<down>", "<down>", "<down>", "<enter>"], { tty: true });
  await saveGame("1", ctx.state, ctx.rng);
  const { saveToSlot } = await import("../src/ui/save_screen.js");
  await saveToSlot(ctx);
  await drained(ctx);
  const screens = ctx.io.output.join("").split("[2J");
  const last = screens[screens.length - 1];
  assert.ok(screens.length >= 2, "brak czyszczenia po odmowie");
  assert.equal((last.match(/Zapisz grę/g) ?? []).length, 1);
});

// --- scena effect i sen zdejmujący zmęczenie (C1 Task 9) ---
const effectCtx = (inputs = []) => {
  const ctx = campCtx(inputs);
  ctx.notices = [];
  return ctx;
};
const activeIds = (ctx) => ctx.state.character.effects.map((e) => e.id);

test("effect: add nakłada efekt, komunikat na następnym ekranie, bez czekania", async () => {
  const ctx = effectCtx([""]);
  await defaultHandlers.effect(ctx, { id: "e", type: "effect", add: ["zmeczenie"] });
  assert.deepEqual(activeIds(ctx), ["zmeczenie"]);
  assert.equal(ctx.io.text(), "");
  await defaultHandlers.narration(ctx, { id: "n", type: "narration", text: "Dalej." });
  assert.match(ctx.io.text(), /Jesteś teraz: Zmęczony\./);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});

test("effect: remove zdejmuje efekt i zgłasza koniec; brak efektu jest cichy", async () => {
  const ctx = effectCtx([""]);
  ctx.state.character.effects = [{ id: "zmeczenie", remaining: 5, stacks: 1 }];
  await defaultHandlers.effect(ctx, { id: "e", type: "effect", remove: ["zmeczenie", "trucizna"] });
  assert.deepEqual(activeIds(ctx), []);
  assert.deepEqual(ctx.notices.map((n) => n.replace(/\x1b\[[0-9;]*m/g, "")), ["Mija: Zmęczony."]);
  await defaultHandlers.narration(ctx, { id: "n", type: "narration", text: "Dalej." });
  assert.match(ctx.io.text(), /Mija: Zmęczony\./);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});

test("effect: remove działa przed add (odświeżenie tego samego efektu)", async () => {
  const ctx = effectCtx();
  ctx.state.character.effects = [{ id: "zmeczenie", remaining: 2, stacks: 1 }];
  await defaultHandlers.effect(ctx, { id: "e", type: "effect", remove: ["zmeczenie"], add: ["zmeczenie"] });
  assert.deepEqual(ctx.state.character.effects, [{ id: "zmeczenie", remaining: 12, stacks: 1 }]);
});

test("effect: force pomija test odporności, bez force odporność działa", async () => {
  const win = { int: () => 1 }; // always below the resist threshold
  const ctx = effectCtx();
  ctx.rng = win;
  await defaultHandlers.effect(ctx, { id: "e", type: "effect", add: ["trucizna"] });
  assert.deepEqual(activeIds(ctx), []);
  assert.ok(ctx.notices.some((n) => n.includes("Opierasz się: Zatruty.")));
  ctx.notices.length = 0;
  await defaultHandlers.effect(ctx, { id: "e", type: "effect", add: ["trucizna"], force: true });
  assert.deepEqual(activeIds(ctx), ["trucizna"]);
  assert.ok(ctx.notices.some((n) => n.includes("Jesteś teraz: Zatruty.")));
});

test("effect: MissingCharacterError bez postaci", async () => {
  await assert.rejects(defaultHandlers.effect(makeCtx(createScriptedIO([])), { id: "e", type: "effect", add: ["zmeczenie"] }), MissingCharacterError);
});

test("rest: 6 godzin zdejmuje zmęczenie i zgłasza koniec", async () => {
  const ctx = effectCtx(["1+++++", "2", ""]);
  ctx.state.character.effects = [{ id: "zmeczenie", remaining: 12, stacks: 1 }];
  await defaultHandlers.rest(ctx, { id: "r", type: "rest" });
  assert.deepEqual(activeIds(ctx), []);
  assert.match(ctx.io.text(), /Mija: Zmęczony\./);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});

test("rest: 5 godzin nie zdejmuje zmęczenia", async () => {
  const ctx = effectCtx(["1++++", "2", ""]);
  ctx.state.character.effects = [{ id: "zmeczenie", remaining: 12, stacks: 1 }];
  await defaultHandlers.rest(ctx, { id: "r", type: "rest" });
  assert.deepEqual(activeIds(ctx), ["zmeczenie"]);
  assert.doesNotMatch(ctx.io.text(), /Mija: Zmęczony/);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});

test("rest: 8 godzin z trucizną ×3 przy HP 4 – HP ≥ 1, efekt mija po 4 h", async () => {
  const ctx = effectCtx(["1+++++++", "2", ""]);
  ctx.state.character.hp = 4;
  ctx.state.character.effects = [{ id: "trucizna", remaining: 4, stacks: 3 }];
  await defaultHandlers.rest(ctx, { id: "r", type: "rest" });
  assert.ok(ctx.state.character.hp >= 1);
  assert.deepEqual(activeIds(ctx), []);
  assert.match(ctx.io.text(), /Mija: Zatruty\./);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});

test("rest: długi sen z tykającym efektem – jedno wywołanie, 8 komunikatów + „…i N więcej.”", async () => {
  const ctx = effectCtx(["1+++++++", "2", ""]); // 8 h
  ctx.data.effects.push({ id: "jad", name: "Jad", description: "x", unit: "hour", duration: 20, tick: { damage: [1, 1] }, stack: "refresh" });
  ctx.data.effects.push({ id: "zar", name: "Żar", description: "x", unit: "hour", duration: 20, tick: { damage: [1, 1] }, stack: "refresh" });
  ctx.state.character.effects = [{ id: "jad", remaining: 20, stacks: 1 }, { id: "zar", remaining: 20, stacks: 1 }];
  ctx.state.character.hp = getStats(ctx.state, ctx.data).derived.hpMax;
  ctx.state.time.minutes = 10 * 60;
  const seen = [];
  ctx.notices.push = (...a) => { seen.push(...a); return Array.prototype.push.apply(ctx.notices, a); };
  await defaultHandlers.rest(ctx, { id: "r", type: "rest" });
  const plain = seen.map((n) => n.replace(/\x1b\[[0-9;]*m/g, ""));
  assert.equal(plain.length, 9, plain.join("\n"));
  assert.equal(plain.slice(0, 8).every((n) => /^(Jad|Żar): −1 HP\.$|^(Zapada|Nastaje|Wstaje|Zaczyna)/.test(n)), true, plain.join("\n"));
  assert.equal(plain[8], "…i 9 więcej.", plain.join("\n"));
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});

// --- scena dialogue (C1 Task 10) ---
const TALK = {
  id: "test", file: "test.json", start: "start",
  nodes: {
    start: { speaker: "Handlarz Bogdan", text: "Witaj, wędrowcze.", options: [
      { id: "targ", text: "Potargujmy", check: { skill: "handel", difficulty: 35 }, success: "dalej", failure: "start" },
      { text: "Pokaż sakwę", requires: { money: 9999 }, showLocked: true, goto: "dalej" },
      { text: "Szepnij hasło", requires: { flag: "haslo" }, showLocked: true, goto: "dalej" },
      { text: "Przejdź dalej", goto: "dalej" },
    ] },
    dalej: { speaker: "Handlarz Bogdan", text: "Zapłać za wejście.", actions: [{ takeMoney: 2 }], options: [{ text: "Płacę", goto: "koniec" }] },
    koniec: { speaker: "Handlarz Bogdan", text: "Do zobaczenia." },
  },
};
const TALK_SCENE = { id: "rozmowa", type: "dialogue", dialogue: "test" };
const fixedRng = (roll) => {
  const r = createRng(1);
  const int = r.int;
  r.int = (lo, hi) => (lo === 1 && hi === 100 ? roll : int(lo, hi));
  return r;
};
const dlgCtx = (inputs, { roll = 1, ...opts } = {}) => {
  const ctx = campCtx(inputs, opts.tty ? opts : undefined);
  ctx.data = { ...ctx.data, dialogues: [TALK] };
  ctx.state.character.money = 10;
  ctx.rng = fixedRng(roll);
  return ctx;
};

test("dialogue: wybór numerem przechodzi między węzłami, koniec ustawia flagę i oznacza rozmowę", async () => {
  const ctx = dlgCtx(["1", "1", "", ""]);
  await defaultHandlers.dialogue(ctx, TALK_SCENE);
  await drained(ctx);
  const out = ctx.io.text();
  assert.match(out, /Handlarz Bogdan/);
  assert.match(out, /Witaj, wędrowcze\./);
  assert.match(out, /\[Handel 35\] Potargujmy/);
  assert.match(out, /Udało się\./);
  assert.match(out, /Zapłać za wejście\./);
  assert.match(out, /Do zobaczenia\./);
  assert.equal(ctx.state.flags.dialog_test_end, true);
  assert.deepEqual(ctx.state.world.finishedDialogues, ["rozmowa"]);
  assert.equal(ctx.state.character.money, 8);
});

test("dialogue: nieudany test – opcja wyszarzona z powodem, zamknięte opcje z wymaganiem", async () => {
  const ctx = dlgCtx(["1", "4", "1", "", ""], { roll: 100 });
  await defaultHandlers.dialogue(ctx, TALK_SCENE);
  await drained(ctx);
  const out = ctx.io.text();
  assert.match(out, /Nie udało się\./);
  assert.match(out, /Potargujmy \(próba nieudana\)/);
  assert.match(out, /Pokaż sakwę \(wymaga: 9999 gr\)/);
  assert.match(out, /Szepnij hasło \(niedostępne\)/);
  assert.equal(ctx.state.flags.dialog_test_end, true);
});

test("dialogue: [P] w środku rozmowy nie powtarza akcji węzła (jedno takeMoney)", async () => {
  const ctx = dlgCtx(["4", "p", "", "1", "", ""]);
  await defaultHandlers.dialogue(ctx, TALK_SCENE);
  await drained(ctx);
  assert.match(ctx.io.text(), /Atrybuty/);
  assert.equal(ctx.state.character.money, 8);
  assert.equal((ctx.io.text().match(/Zapłać za wejście\./g) ?? []).length, 2);
});

test("dialogue: zapis w obozie po rozmowie i wczytanie – akcje nie działają drugi raz", async () => {
  const ctx = dlgCtx(["4", "1", "", "z", "1", ""]);
  await defaultHandlers.dialogue(ctx, TALK_SCENE);
  await drained(ctx);
  const loaded = await loadGame("1", ctx.data);
  assert.deepEqual(loaded.world.finishedDialogues, ["rozmowa"]);
  assert.equal(loaded.character.money, 8);
  const again = { ...ctx, state: loaded, io: createScriptedIO([""]) };
  await defaultHandlers.dialogue(again, TALK_SCENE);
  await drained(again);
  assert.match(again.io.text(), /Ta rozmowa już się odbyła\./);
  assert.equal(loaded.character.money, 8);
  assert.deepEqual(loaded.world.finishedDialogues, ["rozmowa"]);
});

test("dialogue: --debug pokazuje szansę w etykiecie testu", async () => {
  const ctx = dlgCtx(["4", "1", "", ""]);
  ctx.debug = true;
  await defaultHandlers.dialogue(ctx, TALK_SCENE);
  await drained(ctx);
  assert.match(ctx.io.text(), /\[Handel 35 · \d+%\] Potargujmy/);
});

test("dialogue: bez --debug etykieta nie ma szansy", async () => {
  const ctx = dlgCtx(["4", "1", "", ""]);
  await defaultHandlers.dialogue(ctx, TALK_SCENE);
  await drained(ctx);
  assert.doesNotMatch(ctx.io.text(), /%\]/);
});

test("dialogue: TTY – strzałka w dół i Enter wybierają kolejną dostępną opcję", async () => {
  const ctx = dlgCtx(["<down>", "<enter>", "<enter>", "<enter>", "<enter>"], { tty: true });
  await defaultHandlers.dialogue(ctx, TALK_SCENE);
  await drained(ctx);
  assert.match(ctx.io.text(), /Zapłać za wejście\./);
  assert.equal(ctx.state.flags.dialog_test_end, true);
});

test("dialogue: wynik walka – komunikat tylko przy --debug", async () => {
  const fight = structuredClone(TALK);
  fight.nodes.start.options[3] = { text: "Do broni", actions: [{ startCombat: { enemies: ["x"] } }], goto: "dalej" };
  for (const debug of [false, true]) {
    const ctx = dlgCtx(["4", ""]);
    ctx.data = { ...ctx.data, dialogues: [fight] };
    ctx.debug = debug;
    await defaultHandlers.dialogue(ctx, TALK_SCENE);
    await drained(ctx);
    assert.equal(/walka – w cyklu C2/.test(ctx.io.text()), debug);
  }
});

test("dialogue: bez postaci rzuca MissingCharacterError", async () => {
  await assert.rejects(defaultHandlers.dialogue(ctxZ([]), TALK_SCENE), MissingCharacterError);
});

// --- przerwanie w środku rozmowy: pozycja jest zapisywana (poprawki po przeglądzie C1) ---
const TALK_RESUME = {
  id: "test", file: "test.json", start: "start",
  nodes: {
    start: { speaker: "Handlarz Bogdan", text: "Witaj.", options: [
      { id: "targ", text: "Potargujmy", check: { skill: "handel", difficulty: 35 }, success: "b", failure: "start" },
      { text: "Dalej", goto: "b" },
    ] },
    b: { speaker: "Handlarz Bogdan", text: "Masz tu napiwek.", actions: [{ giveMoney: 5 }], options: [{ text: "Koniec", goto: "koniec" }] },
    koniec: { speaker: "Handlarz Bogdan", text: "Do zobaczenia." },
  },
};
const resumeCtx = (inputs, opts) => {
  const ctx = dlgCtx(inputs, opts);
  ctx.data = { ...ctx.data, dialogues: [TALK_RESUME] };
  ctx.data.story.scenes.push(TALK_SCENE);
  ctx.state.scene = { id: TALK_SCENE.id };
  return ctx;
};

test("dialogue: przerwa w węźle z akcją wejścia (auto-zapis) nie powtarza akcji po wczytaniu", async () => {
  const ctx = resumeCtx(["2"]); // input runs out at node b, after its giveMoney
  await assert.rejects(defaultHandlers.dialogue(ctx, TALK_SCENE), InputExhaustedError);
  assert.equal(ctx.state.character.money, 15);
  assert.deepEqual(ctx.state.world.dialogueProgress, { rozmowa: "b" });
  await saveGame("auto", ctx.state, ctx.rng);
  const loaded = await loadGame("auto", ctx.data);
  assert.deepEqual(loaded.world.dialogueProgress, { rozmowa: "b" });
  const again = { ...ctx, state: loaded, io: createScriptedIO(["1", "", ""]) };
  await defaultHandlers.dialogue(again, TALK_SCENE);
  await drained(again);
  assert.equal(loaded.character.money, 15);
  assert.match(again.io.text(), /Masz tu napiwek\./);
  assert.deepEqual(loaded.world.finishedDialogues, ["rozmowa"]);
  assert.deepEqual(loaded.world.dialogueProgress, {});
  assert.equal(loaded.flags.dialog_test_end, true);
});

test("dialogue: nieudany test pozostaje nieudany po przerwie i wznowieniu", async () => {
  const ctx = resumeCtx(["1"], { roll: 100 }); // check fails, back at start, input runs out
  await assert.rejects(defaultHandlers.dialogue(ctx, TALK_SCENE), InputExhaustedError);
  await saveGame("auto", ctx.state, ctx.rng);
  const loaded = await loadGame("auto", ctx.data);
  assert.deepEqual(loaded.world.dialogueProgress, { rozmowa: "start" });
  const again = { ...ctx, state: loaded, io: createScriptedIO(["2", "1", "", ""]) };
  await defaultHandlers.dialogue(again, TALK_SCENE);
  await drained(again);
  assert.match(again.io.text(), /Potargujmy \(próba nieudana\)/);
  assert.equal(loaded.character.money, 15);
});

test("D1: scena phenomenon wymusza start zjawiska bez czekania", async () => {
  const ctx = effectCtx([]);
  ctx.state.world.phenomenon = null;
  await defaultHandlers.phenomenon(ctx, { id: "z", type: "phenomenon", phenomenon: "mgla_ciszy", goto: "b" });
  assert.equal(ctx.state.world.phenomenon.id, "mgla_ciszy");
  assert.equal(ctx.state.world.phenomenon.started, true);
  assert.equal(ctx.state.world.phenomenon.startsAt, ctx.state.time.minutes);
});
