import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";
import { tmpDir, combatState } from "./helpers.js";
import { dataDir } from "../src/config.js";
import { loadData, translationReport } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { runApp } from "../src/app.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { setColorsEnabled } from "../src/ui/colors.js";
import { hotkey, t } from "../src/ui/strings.js";
import { startQuest } from "../src/systems/quests.js";
import { addItem } from "../src/systems/inventory.js";
import { buyPrice, shopStock } from "../src/systems/shop.js";
import { choiceWidthOf, visibleWidth } from "../src/ui/frame.js";
import { main } from "../src/cli.js";
import { createSceneList, runStory } from "../src/engine/loop.js";
import { startTravel } from "../src/systems/travel.js";
import { runTrip } from "../src/scenes/trip.js";
import { renderRegionMap } from "../src/ui/map_screen.js";
import { scopeOf, textFiles } from "../src/i18n/scope.js";
import { textEntries } from "../src/i18n/overlay.js";

const PL_UI = JSON.parse(readFileSync(new URL("../data/ui.json", import.meta.url), "utf8"));
const EN_UI = Object.fromEntries(Object.entries(JSON.parse(readFileSync(new URL("../data/lang/en/ui.json", import.meta.url), "utf8"))).map(([k, v]) => [k, v.t]));
const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
// Shown before a language is chosen, in both languages on purpose; "Polski" is the language's own name.
const BILINGUAL = new Set(["language.title", "language.pl"]);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** `text` as a whole word (no letter right before or after). */
const word = (text) => new RegExp(`(?<!\\p{L})${escape(text)}(?!\\p{L})`, "u");

let savedHome;
const data = {};
beforeEach(async () => {
  savedHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
  setColorsEnabled(false);
  data.pl ??= await loadData(dataDir());
  data.en ??= await loadData(dataDir(), { lang: "en" });
});
afterEach(() => {
  if (savedHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = savedHome;
});

/**
 * What of the Polish ui.json would show that a ui text leaked through untranslated: every piece between the `{…}` tokens
 * with 4+ letters (or a Polish letter) that differs from the English and stands nowhere in the rest of the data (story,
 * items… are still Polish until their own tasks), as a whole word.
 */
function polishUiPieces(d) {
  const { ui, ...rest } = d;
  const other = JSON.stringify(rest);
  const pieces = new Set();
  for (const [key, pl] of Object.entries(PL_UI)) {
    if (BILINGUAL.has(key) || pl === EN_UI[key]) continue;
    for (const raw of pl.split(/\{[^{}]*\}/)) {
      const piece = raw.trim().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
      if ((piece.match(/\p{L}/gu) ?? []).length < 4 && !POLISH.test(piece)) continue;
      if ((EN_UI[key] ?? "").includes(piece) || word(piece).test(other)) continue;
      pieces.add(piece);
    }
  }
  return [...pieces];
}

/** Every frame drawn (split at screen clears), as plain lines of the box. */
const frames = (io) => io.output.join("").split("\x1b[2J\x1b[3J\x1b[H").slice(1)
  .map((f) => stripVTControlCharacters(f).split("\n").filter((l) => /^[█▌]/.test(l))).filter((f) => f[0]?.startsWith("█▀"));

/** ui texts that end in "…" themselves (not cuts), in both languages. */
const ELLIPSIS_TEXTS = [...Object.values(PL_UI), ...Object.values(EN_UI)].flatMap((v) => v.split(/\{[^{}]*\}/)).map((s) => s.trim()).filter((s) => s.endsWith("…"));

/** The cut rows of one frame: a panel segment ending in "…" (the frame and the menus cut a too long line so). */
function cuts(frame) {
  const out = [];
  frame.forEach((line, row) => {
    let rest = line;
    for (const own of ELLIPSIS_TEXTS) rest = rest.split(own).join("");
    // a segment ends at a panel bar (▒ between scene and choices, ▐ at the right edge)
    rest.split(/[▒▐]/).forEach((seg, col) => { if (/…\s*$/.test(seg)) out.push(`${row}:${col}`); });
  });
  return out;
}

/**
 * Runs a scripted path in one language and returns its frames and text. The keys are built from that language's
 * hotkeys (`keys(ui)`), so the same path is walked in Polish and in English.
 */
async function walk(lang, run, keys) {
  const io = createScriptedIO(keys(data[lang].ui), { tty: true });
  await assert.rejects(run(data[lang], io), InputExhaustedError);
  return { frames: frames(io), text: stripVTControlCharacters(io.output.join("")) };
}

/** English screens: nothing cut that the Polish path does not cut too, no ui key missing, no Polish ui text. */
async function assertEnglish(label, run, keys) {
  const pl = await walk("pl", run, keys);
  const en = await walk("en", run, keys);
  assert.ok(en.frames.length > 0, `${label}: brak ramek`);
  assert.equal(en.frames.length, pl.frames.length, `${label}: inna liczba ramek po polsku i po angielsku`);
  // every English-only cut of the path, as "frame N: the cut segment", so one run lists them all
  const extra = en.frames.flatMap((f, i) => cuts(f).filter((c) => !cuts(pl.frames[i]).includes(c)).map((c) => {
    const [row, col] = c.split(":").map(Number);
    return `ramka ${i}: ${f[row].split(/[▒▐]/)[col].replace(/^[█▌] ?/, "").trim()}`;
  }));
  const first = extra.length ? Number(/ramka (\d+)/.exec(extra[0])[1]) : 0;
  assert.deepEqual(extra, [], `${label}: wiersze ucięte tylko po angielsku\n${extra.join("\n")}\n--- pierwsza taka ramka:\n${en.frames[first]?.join("\n")}\n--- po polsku:\n${pl.frames[first]?.join("\n")}`);
  assert.doesNotMatch(en.text, /\[\[/, `${label}: brak klucza ui`);
  assert.deepEqual(polishUiPieces(data.en).filter((p) => word(p).test(en.text)), [], `${label}: polskie teksty z ui.json na ekranie`);
  assert.doesNotMatch(en.text, word("PA"), `${label}: „PA” zamiast „AP”`);
  assert.doesNotMatch(en.text, word("PD"), `${label}: „PD” zamiast „XP”`);
  return en.text;
}

test("ui.json ma pełny i aktualny przekład (--validate --lang en --strict bez braków w ui.json)", async () => {
  const report = await translationReport(dataDir(), "en");
  assert.deepEqual(report.perFile["ui.json"], { missing: 0, stale: 0 });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings.filter((w) => w.startsWith("ui.json")), []);
});

test("przekład ui.json: te same zmienne, dwie formy liczby mnogiej, bez polskich liter", () => {
  const vars = (s) => [...new Set([...s.matchAll(/\{(\w+)(?:\|[^{}]*)?\}/g)].map((m) => m[1]))].sort();
  for (const [key, pl] of Object.entries(PL_UI)) {
    const en = EN_UI[key];
    assert.equal(typeof en, "string", key);
    assert.deepEqual(vars(en), vars(pl), key);
    for (const m of en.matchAll(/\{\w+((?:\|[^{}|]*)+)\}/g)) assert.equal(m[1].split("|").length - 1, 2, `${key}: ${m[0]}`);
    if (!BILINGUAL.has(key)) assert.doesNotMatch(en, POLISH, key);
  }
  assert.equal(EN_UI["menu.language"], "Language: {lang}");
  assert.equal(EN_UI["menu.language.pl"], "Polish");
  assert.equal(EN_UI["menu.language.en"], "English");
  assert.equal(EN_UI["frame.title"], "VOIDED: DEFYING THE STARS");
  assert.equal(EN_UI["title.tagline"], "DEFYING THE STARS");
});

test("--help --lang en: pomoc po angielsku, z --lang", async () => {
  const out = [];
  assert.equal(await main(["--help", "--lang", "en"], { stdout: (s) => out.push(s), stderr: (s) => out.push(s) }), 0);
  const help = out.join("\n");
  assert.match(help, /^Usage: ostrze \[options\]/);
  assert.match(help, /--lang <pl\|en>/);
  assert.doesNotMatch(help, POLISH);
});

// --- hotkeys ---
const CAMP = ["key.character", "key.inventory", "key.journal", "key.save", "key.menu", "key.notices"];
const COMBAT_ACTIONS = ["attack", "reload", "use", "swap", "move", "defend", "flee", "end", "log", "techniques"].map((a) => `combat.key.${a}`);
const ZONES = ["glowa", "tulow", "nogi", "ogluszenie"].map((z) => `combat.key.${z}`);
/** The keys that answer on one screen together (the notices key joins wherever the frame can add it). */
const SCREENS = {
  "obóz i narracja": CAMP,
  rozmowa: ["key.character", "key.notices"],
  "pytanie tak/nie": ["key.yes", "key.no", "key.notices"],
  "ekwipunek i podmenu": ["key.back", "key.notices"],
  // the notices key is left out of the combat list on purpose: menu.js adds it only when no action has the same letter
  "walka: akcje i ciosy": [...COMBAT_ACTIONS, ...ZONES],
  "walka: podmenu": ["key.back", "key.notices"],
};

for (const lang of ["pl", "en"]) {
  test(`klawisze (${lang}): jedna litera, bez kolizji na żadnym ekranie`, () => {
    const ui = lang === "pl" ? PL_UI : EN_UI;
    const all = new Set(Object.values(SCREENS).flat());
    for (const id of all) assert.match(ui[id] ?? "", /^\p{Ll}$/u, `${id}: ${ui[id]}`);
    for (const [screen, ids] of Object.entries(SCREENS)) {
      const letters = ids.map((id) => hotkey(ui, id));
      assert.equal(new Set(letters).size, letters.length, `${screen}: ${ids.map((id, i) => `${id}=${letters[i]}`).join(", ")}`);
    }
  });
}

test("klawisze po angielsku: mnemoniczne litery z orzeczenia", () => {
  const k = (id) => hotkey(EN_UI, id);
  assert.deepEqual(["key.character", "key.inventory", "key.journal", "key.save", "key.menu", "key.back", "key.yes", "key.no"].map(k), ["c", "i", "j", "s", "m", "b", "y", "n"]);
  assert.deepEqual(COMBAT_ACTIONS.map(k), ["a", "r", "u", "s", "c", "d", "f", "e", "l", "t"]);
  assert.equal(t(EN_UI, "shop.confirmSell", { name: "x", qty: 1, gain: 2, currency: "gr" }), "Sell x ×1 for 2 gr? [y/n]");
  assert.equal(t(PL_UI, "shop.confirmSell", { name: "x", qty: 1, gain: 2, currency: "gr" }), "Sprzedać x ×1 za 2 gr? [t/n]");
});

test("pytanie tak/nie w trybie liniowym: litera i całe słowo, „y” działa też po polsku", async () => {
  const { confirm } = await import("../src/ui/prompt.js");
  const ask = async (ui, answer) => confirm(createScriptedIO([answer]), ui, "?");
  for (const a of ["t", "tak", "TAK", "y"]) assert.equal(await ask(PL_UI, a), true, a);
  for (const a of ["n", "nie"]) assert.equal(await ask(PL_UI, a), false, a);
  for (const a of ["y", "yes", "Yes"]) assert.equal(await ask(EN_UI, a), true, a);
  for (const a of ["n", "no"]) assert.equal(await ask(EN_UI, a), false, a);
  const io = createScriptedIO(["x", "y"]);
  assert.equal(await confirm(io, EN_UI, "?"), true);
  assert.match(io.text(), /Answer y or n\./);
});

// --- plurals ---
test("liczba mnoga: tury efektu, zdarzenia tury wrogów, poboczne zlecenia", () => {
  const eff = (ui, n) => t(ui, "char.effect", { name: "X", remaining: n, unit: t(ui, "effect.unit.turn", { n }) });
  assert.deepEqual([1, 2, 5, 12, 22].map((n) => eff(PL_UI, n)), ["X · została 1 tura", "X · zostały 2 tury", "X · zostało 5 tur", "X · zostało 12 tur", "X · zostały 22 tury"]);
  assert.deepEqual([1, 2].map((n) => eff(EN_UI, n)), ["X · 1 turn left", "X · 2 turns left"]);
  const hour = (ui, n) => t(ui, "char.effect", { name: "X", remaining: n, unit: t(ui, "effect.unit.hour", { n }) });
  assert.deepEqual([1, 3, 5].map((n) => hour(PL_UI, n)), ["X · została 1 h", "X · zostały 3 h", "X · zostało 5 h"]);
  assert.equal(hour(EN_UI, 3), "X · 3 h left");
  assert.deepEqual([1, 2, 5].map((n) => t(PL_UI, "combat.recap", { n })), ["Przebieg tury wrogów (1 zdarzenie):", "Przebieg tury wrogów (2 zdarzenia):", "Przebieg tury wrogów (5 zdarzeń):"]);
  assert.deepEqual([1, 2].map((n) => t(EN_UI, "combat.recap", { n })), ["The enemies' turn (1 event):", "The enemies' turn (2 events):"]);
  assert.deepEqual([1, 2, 5].map((left) => t(PL_UI, "journal.side", { left, total: 7, bar: "#" })), ["Zlecenia poboczne: zostało 1 z 7 #", "Zlecenia poboczne: zostały 2 z 7 #", "Zlecenia poboczne: zostało 5 z 7 #"]);
});

// --- real screens ---
const R = "<right>", D = "<down>", E = "<enter>";

test("80×24 po angielsku: menu główne, tworzenie postaci i walka bez ucięć ponad polskie, bez polskich tekstów ui", async () => {
  // the creator path of the TTY demo in test/e2e.test.js; the sparing starts right after the summary pages
  const creator = ["Thorgniew", E, R, R, D, R, D, R, R, D, D, D, D, D, E, "7", "9", D, D, D, E, E, E];
  // the log and back, techniques and back, the belt and back, the aimed blows down the list, one attack
  const fight = (ui) => [hotkey(ui, "combat.key.log"), E, hotkey(ui, "combat.key.techniques"), hotkey(ui, "key.back"),
    hotkey(ui, "combat.key.use"), hotkey(ui, "key.back"), D, D, D, E, hotkey(ui, "combat.key.attack"), E];
  const run = (d, io) => runApp({ data: d, io, options: { debug: false, seed: 7, lang: d.lang } });
  const text = await assertEnglish("menu, postać, walka", run, (ui) => ["1", E, E, E, ...creator, ...fight(ui)]);
  for (const s of ["New game", "Character creation", "Attributes", "Tagged skills", "Combat log", "[A] Attack", "[T] Techniques", "[B] Back", "AP"]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: ekwipunek, karta przedmiotu i dziennik bez ucięć ponad polskie, bez polskich tekstów ui", async () => {
  const run = async (d, io) => {
    const state = createNewState({ seed: 1, startScene: d.story.start, rules: d.rules });
    const kit = combatState(d, "miecz");
    Object.assign(state, { character: kit.character, inventory: kit.inventory });
    state.time.minutes = 12 * 60;
    state.world.phenomenonRolledDay = 99;
    state.world.location = "wilczy_brod";
    startQuest(state, d, "wilcza_nora");
    const ctx = { state, data: d, io, rng: { int: (a) => a }, debug: false, notices: [] };
    await defaultHandlers.narration(ctx, { id: "n", type: "narration", title: "T", text: "x" });
  };
  // inventory, the gambeson's actions, its card, back twice, the journal
  const keys = (ui) => [hotkey(ui, "key.inventory"), "2", "4", E, hotkey(ui, "key.back"), hotkey(ui, "key.back"), hotkey(ui, "key.journal"), E];
  const text = await assertEnglish("ekwipunek, karta, dziennik", run, keys);
  for (const s of ["Inventory", "Weight", "Equip", "Description", "Worn on", "Reductions", "Quest journal", "no deadline", "[C] Character", "[I] Inventory", "[J] Journal", "[S] Save"]) assert.ok(text.includes(s), s);
});

/** A sword fighter with a full purse in Wolf's Ford, carrying a few items with long English texts. */
function shopState(d) {
  const state = createNewState({ seed: 1, startScene: d.story.start, rules: d.rules });
  const kit = combatState(d, "miecz");
  Object.assign(state, { character: kit.character, inventory: kit.inventory });
  state.character.money = 400;
  state.time.minutes = 12 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  for (const id of ["rusznica", "para_gwiazd_bogdana", "swiece_woskowe", "mieszek_zoldu", "miecz_mistrza_u2"]) addItem(state, d, id, 1);
  return state;
}
const sceneCtx = (d, io, state) => ({ state, data: d, io, rng: { int: (a) => a }, debug: false, notices: [] });

test("80×24 po angielsku: sklep (kupno i sprzedaż z kartami przedmiotów) bez ucięć ponad polskie", async () => {
  const run = (d, io) => defaultHandlers.shop(sceneCtx(d, io, shopState(d)), { id: "s", type: "shop", shop: "kowal_brod" });
  // buy: down the whole stock (each row shows its card), back; sell: down the list
  const keys = (ui) => [E, ...Array(16).fill(D), hotkey(ui, "key.back"), D, E, ...Array(8).fill(D)];
  const text = await assertEnglish("sklep", run, keys);
  for (const s of ["Zbych's Forge", "Purse: 400 gr", "Iron knuckles", "Plates on the shins. You", "Mail coif"]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: wymiana u kowala i karty przedmiotów w ekwipunku bez ucięć ponad polskie", async () => {
  const run = async (d, io) => {
    const ctx = sceneCtx(d, io, shopState(d));
    await defaultHandlers.dialogue(ctx, { id: "u", type: "dialogue", dialogue: "ulepszenia_zbych" });
    await defaultHandlers.narration(ctx, { id: "n", type: "narration", title: "T", text: "x" });
  };
  // the grip for the short sword, "Right.", "Another time."; then the inventory: every item's actions with its card,
  // and the paged description of the Pair of Stars (its sixth action) to the second page
  const card = (ui, n) => [String(n), hotkey(ui, "key.back")];
  const keys = (ui) => [E, E, "2", hotkey(ui, "key.inventory"), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => card(ui, n)), "6", "6", E];
  const text = await assertEnglish("wymiana, ekwipunek", run, keys);
  for (const s of ["Zbych the Smith", "Short sword: grip", "Short sword (grip)", "Pair of Stars (forged by Bogdan)", "Back to hand", "6–10 star damage", "Wax candles", "conscience"]) assert.ok(text.includes(s), s);
});

/** The sword fighter of the shop tests, without the extra items, ready for a fight. */
function fighterState(d) {
  const state = createNewState({ seed: 1, startScene: d.story.start, rules: d.rules });
  const kit = combatState(d, "miecz");
  Object.assign(state, { character: kit.character, inventory: kit.inventory });
  return state;
}

/** Three fights, each with the English texts its path must show (enemy panel, targets, combat log). */
const FIGHTS = {
  "plac ćwiczeń": [{ enemies: [{ id: "instruktor" }], training: true, nonLethal: true, canFlee: false },
    ["DRILLMASTER RADOGOST", "Drillmaster Radogost hits you for", "You hit Radogost for"]],
  "trzech bandytów": [{ enemies: [{ id: "bandyta", count: 3 }] }, ["BANDIT 1", "Bandit 2", "Bandit 3", "hits you for"]],
  upiory: [{ enemies: [{ id: "upior_zwiadowca" }, { id: "upior_nocy" }] }, ["Wraith Scout", "Night Wraith", "hits you for"]],
};

for (const [label, [fight, expected]] of Object.entries(FIGHTS)) {
  test(`80×24 po angielsku: walka (${label}) – panel wrogów, wybór celu i dziennik walki bez ucięć ponad polskie`, async () => {
    // a fight over before the keys run out leaves the rest to a camp screen, so every path ends on missing input
    const run = async (d, io) => {
      const ctx = { ...sceneCtx(d, io, fighterState(d)), rng: createRng(5) };
      await defaultHandlers.combat(ctx, { id: "w", type: "combat", start: "melee", ...fight });
      for (;;) await defaultHandlers.narration(ctx, { id: "n", type: "narration", title: "T", text: "x" });
    };
    // three rounds: attack the second target from the menu, then the first, end the turn; then the combat log
    const round = (ui) => [hotkey(ui, "combat.key.attack"), D, E, E, hotkey(ui, "combat.key.attack"), E, E, hotkey(ui, "combat.key.end")];
    const keys = (ui) => [...round(ui), ...round(ui), ...round(ui), hotkey(ui, "combat.key.log"), E];
    const text = await assertEnglish(label, run, keys);
    for (const s of expected) assert.ok(text.includes(s), s);
  });
}

// --- the prologue and act I (scope akt1) through the real screens ---

const AKT1_DIALOGUES = ["kurier", "delegacja", "kwatermistrz", "towarzysze"];
/** The akt1 scenes: from the first narration to the departure (the march after it is akt2). */
const akt1Scenes = (d) => {
  const ids = d.story.scenes.map((s) => s.id);
  return d.story.scenes.slice(ids.indexOf("prolog_wstep"), ids.indexOf("prolog_wymarsz") + 1);
};
/** The one-line akt1 texts (titles, speakers, the hero's answers) in Polish: on an English screen none may stand. */
function akt1ShortTexts(d) {
  const out = new Set(akt1Scenes(d).map((s) => s.title).filter(Boolean));
  for (const id of AKT1_DIALOGUES) {
    for (const node of Object.values(d.dialogues.find((x) => x.id === id).nodes)) {
      out.add(node.speaker);
      for (const o of node.options ?? []) out.add(o.text.replace(/[.?!]$/, ""));
    }
  }
  return [...out].filter(Boolean);
}
/** Words with Polish letters an English akt1 screen may show: personal names only. */
const AKT1_POLISH_OK = new Set(["Ragnosława"]);

test("80×24 po angielsku: prolog i akt I od nowej gry do wymarszu – bez ucięć ponad polskie, bez polskich tekstów", async () => {
  // A: the menu, both intro narrations, dawn, the creator (as in the creator test above) and the sparing's intro
  const creator = ["Thorgniew", E, R, R, D, R, D, R, R, D, D, D, D, D, E, "7", "9", D, D, D, E, E, E];
  const start = (d, io) => runApp({ data: d, io, options: { debug: false, seed: 7, lang: d.lang } });
  const a = await assertEnglish("prolog: początek", start, () => ["1", E, E, E, ...creator]);
  // B: the sparing's two endings, then the story from the courier's arrival on: every courier answer (Speech and Stealth
  // fail at this seed), the delegation (Speech passes: the tribute), the quartermaster (haggle, gossip, a swig, the hood),
  // his stall left, all three at the gate, the departure to its last page
  const fromCourier = async (d, io) => {
    const state = createNewState({ seed: 7, startScene: "prolog_kurier_narracja", rules: d.rules });
    const kit = combatState(d, "miecz");
    Object.assign(state, { character: kit.character, inventory: kit.inventory });
    Object.assign(state.character, { name: "Thorgniew", money: 15 });
    state.flags.klasa_miecz = true;
    addItem(state, d, "kaptur_mysliwego", 1);
    state.time.minutes = 10 * 60;
    const ctx = { state, data: d, io, rng: createRng(7), debug: false, story: createSceneList(d.story.scenes), notices: [] };
    for (const id of ["demo_sparing_wygrana", "demo_sparing_porazka"]) await defaultHandlers.narration(ctx, d.story.scenes.find((s) => s.id === id));
    await runStory(ctx);
  };
  const keys = () => [E, E, E,
    "1", "1", "2", "1", "4", "1", E, // courier: Speech (fails), Stealth (fails), "Nobody's asking me?", camp
    "1", "1", "1", E, // delegation: "Why us?" (the tribute), back, "I'll go and pack.", camp
    E, "1", "1", "1", "1", "1", "1", "2", "1", "3", E, "3", // stall: haggle (fails), gossip (passes), swig, hood, farewell, camp, leave the shop
    "1", "1", "1", "1", "1", "1", "1", "1", "1", "1", E, // gate: Skarimir, Ragnosława, Wojmir, "Let's move.", camp
    E]; // the departure to its last page (the march after it is akt2)
  const b = await assertEnglish("prolog: kurier do wymarszu", fromCourier, keys);
  const text = a + b;
  for (const s of ["Land Beneath the Stars", "Birchgrove is the last village", "Master Gnieworad", "Gnieworad shoves a wooden club",
    "Radogost clutches his ribs", "You lie in the mud", "Imperial Courier", "Nobody's asking me?", "Wants to be asked", "· Birchgrove", "Master Gnieworad",
    "Quartermaster Dobrogost", "Pour me a swig. (2 gr)", "piglets", "not my purse", "School Gate", "Race you. Winner buys.",
    "Wojmir the Lean", "tries to smile", "not as black as he's painted", "Wolf's Ford is two days' march"]) assert.ok(text.includes(s), s);
  const polish = [...new Set(text.match(/\p{L}*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\p{L}*/gu) ?? [])].filter((w) => !AKT1_POLISH_OK.has(w));
  assert.deepEqual(polish, [], "polskie słowa na angielskim ekranie aktu I");
  // names stay the same in both languages
  const same = new Set([...akt1ShortTexts(data.en), ...AKT1_POLISH_OK]);
  assert.deepEqual(akt1ShortTexts(data.pl).filter((s) => !same.has(s) && word(s).test(text)), [], "polskie tytuły, mówiący albo odpowiedzi aktu I");
});

// --- act II (scope akt2): the march to Wolf's Ford, the hub, its board and the journal, road events of the Foothills ---

/** Words with Polish letters an English akt2 screen may show: personal names and Kupała. */
const AKT2_POLISH_OK = new Set(["Ragnosława", "Głuszec", "Kupała"]);
/**
 * The short akt2 texts of story, quests and travel (titles, names, labels, hints) in Polish, unless the overlay keeps them
 * as they are (a name like Głuszec); a text missing from the overlay counts, since the game then shows the Polish one.
 */
function akt2ShortTexts() {
  const scopes = scopeOf(data.pl);
  const overlay = (file) => JSON.parse(readFileSync(new URL(`../data/lang/en/${file}`, import.meta.url), "utf8"));
  return textFiles(data.pl).filter((f) => ["story.json", "quests.json", "travel.json"].includes(f.file)).flatMap(({ file, json }) => {
    const en = overlay(file);
    return [...textEntries(file, json)].filter(([p, v]) => scopes.get(`${file}|${p}`) === "akt2" && /\.(?:name|title|short|label|doneLabel|hint|client|reportTo)$/.test(p) && en[p]?.t !== v).map(([, v]) => v);
  });
}
/** The text of English frames (the akt2 dialogues are translated too, so no frame is left out). */
const narrationText = (frames) => frames.map((f) => f.join("\n")).join("\n");
/** The short akt2 dialogue texts in Polish (speakers and answers) the English overlay changes. */
function akt2DialogueShortTexts() {
  const scopes = scopeOf(data.pl);
  return textFiles(data.pl).filter((f) => f.file.startsWith("dialogues/")).flatMap(({ file, json }) => {
    const entries = [...textEntries(file, json)].filter(([p]) => scopes.get(`${file}|${p}`) === "akt2" && /\.(?:speaker|options\..+\.text)$/.test(p));
    if (!entries.length) return [];
    let en = {};
    try { en = JSON.parse(readFileSync(new URL(`../data/lang/en/${file}`, import.meta.url), "utf8")); } catch { /* no overlay: every text is Polish */ }
    return entries.filter(([p, v]) => en[p]?.t !== v).map(([, v]) => v.replace(/[.?!…]$/, ""));
  });
}
/** A path in English: the checks of assertEnglish, then no Polish akt2 narration, dialogue line, speaker or answer. */
async function assertEnglishAkt2(label, run, keys) {
  const text = await assertEnglish(label, run, keys);
  const narration = narrationText((await walk("en", run, keys)).frames);
  const polish = [...new Set(narration.match(/\p{L}*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\p{L}*/gu) ?? [])].filter((w) => !AKT2_POLISH_OK.has(w));
  assert.deepEqual(polish, [], `${label}: polskie słowa na ekranie`);
  assert.deepEqual(akt2ShortTexts().filter((s) => word(s).test(narration)), [], `${label}: polskie tytuły, nazwy albo podpowiedzi aktu II`);
  assert.deepEqual([...new Set(akt2DialogueShortTexts())].filter((s) => word(s).test(narration)), [], `${label}: polscy mówiący albo odpowiedzi w dialogach aktu II`);
  return text;
}

/** The sword fighter of the shop tests, named, with the akt2 places of the Foothills known. */
function akt2State(d, scene) {
  const state = createNewState({ seed: 7, startScene: scene, rules: d.rules });
  const kit = combatState(d, "miecz");
  Object.assign(state, { character: kit.character, inventory: kit.inventory });
  state.character.name = "Thorgniew";
  state.world.phenomenonRolledDay = 99;
  return state;
}
const knowFoothills = (state, d) => { state.world.discovered = d.travel.locations.filter((l) => l.region === "pogorze").map((l) => l.id); };

test("80×24 po angielsku: marsz do Wilczego Brodu (noc upiorów, przybycie, mapa Brodu) – bez ucięć ponad polskie, bez polskiej narracji", async () => {
  // the night on the road, day 2: from dusk to the ambush (the keys end at the fight)
  const march = (eventScene, time) => async (d, io) => {
    const state = akt2State(d, "demo_podroz");
    state.world.location = "brzezina";
    startTravel(state, d, "brzezina_wilczy_brod");
    Object.assign(state.world.travel, { day: 2, phase: "event", event: "noc_upiorow", eventHour: 0, hoursWalked: 0, eventScene });
    state.time.minutes = time;
    await runStory({ state, data: d, io, rng: createRng(5), debug: false, story: createSceneList(d.story.scenes), notices: [] });
  };
  const a = await assertEnglishAkt2("marsz: zmierzch", march("noc_zmierzch", 1440 + 14 * 60), () => [E, E]);
  // after the lost fight: the dark, the Being, dawn, the battlefield, the crossroads (dialogues still Polish), the wilds,
  // the arrival in Wolf's Ford, its places, the way to the map ("Where to?") and back
  const b = await assertEnglishAkt2("marsz: po walce do Brodu", march("noc_omdlenie", 1440 + 21 * 60), () => [E, E, E, ...Array(16).fill("1"), "9", "2"]);
  const text = a + b;
  for (const s of ["Dusk", "The day is running out", "Night of Wraiths", "Darkness", "Silence", "Dawn", "Off the Road",
    "Wolf's Ford Watchtower is a palisade", "Commander Wszebor", "The Wolf's Fang Tavern", "Room for the night", "Notice board", "Farmwife with hens",
    "Get a night's sleep", "Look around Wolf's Ford", "??? · a forest path", "New quest: Where Next: Wolf's Ford."]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: tablica ogłoszeń i dziennik w Wilczym Brodzie – bez ucięć ponad polskie, bez polskiej narracji", async () => {
  const run = async (d, io) => {
    const state = akt2State(d, "demo_mapa");
    state.world.location = "wilczy_brod";
    knowFoothills(state, d);
    state.time.minutes = 3 * 1440 + 14 * 60;
    await runStory({ state, data: d, io, rng: createRng(5), debug: false, story: createSceneList(d.story.scenes), notices: [] });
  };
  // the board: down its four notices (each shows its description), take the fourth; the journal (opened from the board) through
  // its pages back to the board; step away from it; the map ("Where to?")
  const keys = (ui) => ["5", D, D, D, E, hotkey(ui, "key.journal"), E, E, E, "4", "9"];
  const text = await assertEnglishAkt2("tablica i dziennik", run, keys);
  for (const s of ["A Cure for Wrzosek", "Grain for the Mill", "Asking About Survivors", "Light in the Mill", "Step away from the board",
    "nursing a hangover", "New quest: Light in the Mill.", "Quest journal", "Find the glass shard in the mill", "Old Mill by the River",
    "Where Next: Wolf's Ford", "beyond Stone Pass", "Marchwood", "Forester's Lodge"]) assert.ok(text.includes(s), s);
});

test("mapa Pogórza po angielsku: rysuje się przy tej samej szerokości co polska, z angielskimi nazwami i znacznikami", () => {
  const draw = (d, width) => {
    const state = akt2State(d, "demo_mapa");
    state.world.location = "wilczy_brod";
    knowFoothills(state, d);
    startQuest(state, d, "list_do_lesniczego");
    return renderRegionMap(state, d, { hub: "wilczy_brod", width, height: 20 });
  };
  const minWidth = (d) => { for (let w = 40; w <= 120; w++) if (draw(d, w)) return w; return null; };
  assert.equal(minWidth(data.en), minWidth(data.pl));
  const en = draw(data.en, 80).join("\n");
  assert.equal(draw(data.en, 80).length, draw(data.pl, 80).length, "tyle samo wierszy");
  for (const s of ["River", "@ Wolf's Ford", "Old Mill", "Marchwood", "the Road", "distant trails (days away)", "! Forester's Lodge", "the Stronghold", "@ You are here"]) assert.ok(en.includes(s), s);
  assert.doesNotMatch(en, POLISH);
});

test("80×24 po angielsku: rozmowy w Wilczym Brodzie (komendant i jego zlecenie, karczmarz, kowal i jego skrzynia) – bez ucięć ponad polskie, bez polskiego tekstu", async () => {
  const run = async (d, io) => {
    const state = akt2State(d, "demo_mapa");
    state.world.location = "wilczy_brod";
    knowFoothills(state, d);
    state.character.money = 60; // a poor hero: the buy lists show the "can't afford" hint on the dearer rows
    state.time.minutes = 3 * 1440 + 14 * 60;
    await runStory({ state, data: d, io, rng: createRng(5), debug: false, story: createSceneList(d.story.scenes), notices: [] });
  };
  // the commander: "A wanderer", "I marched with the school", "I'm listening", the wolf job taken (a choice), "Take care"
  const commander = await assertEnglishAkt2("komendant", run, () => ["1", "1", "1", "1", "1", "1"]);
  for (const s of ["Commander Wszebor", "Who the fuck are you?", "A wanderer. I got lost.", "A pupil from Birchgrove.", "Take care.",
    "school's colours", "I'm listening.", "twenty-five groats", "[job] I'll take it.", "Not this time.", "New quest: Wolf's Den."]) assert.ok(commander.includes(s), s);
  // the innkeeper: Speech (fails at this seed), "All right", his job, "I'll see what I can do"
  const inn = await assertEnglishAkt2("karczmarz", run, () => ["2", "1", "1", "2", "1"]);
  for (const s of ["Wrzosek the Innkeeper", "At the Wolf's", "[Speech 35] Any news", "drunk carter", "[job] Need anything?",
    "New quest: A Cure for Wrzosek.", "I'll see what I can do."]) assert.ok(inn.includes(s), s);
  // the smith: "What are you selling?", his chest, "Let's have a look", into his shop (the buy list)
  const forge = await assertEnglishAkt2("kowal", run, () => ["8", "2", "1", "1"]);
  for (const s of ["Zbych the Smith", "Horseshoes, hooks, nails.", "How's business?", "What are you selling?", "Where can I buy powder?",
    "Heard of the brigands?", "don't drool on my steel", "Let's have a look.", "Zbych's Forge", "Too dear."]) assert.ok(forge.includes(s), s);
  // the Stall of the Ford: its buy list with the same poor purse (no buy row cut where the Polish one is not)
  const stall = await assertEnglishAkt2("kramik", run, () => ["4", "1"]);
  for (const s of ["Stall at the Ford", "Too dear."]) assert.ok(stall.includes(s), s);
});

test("80×24 po angielsku: zdarzenia na drogach Pogórza (pielgrzym, bortnik, żmije, zasadzka) – bez ucięć ponad polskie, bez polskiej narracji", async () => {
  const road = (event) => async (d, io) => {
    const state = akt2State(d, "x");
    state.world.location = "wilczy_brod";
    knowFoothills(state, d);
    startTravel(state, d, "wilczy_brod_lesniczowka");
    const first = d.travel.events.find((e) => e.id === event).scenes[0].id;
    Object.assign(state.world.travel, { day: 1, phase: "event", event, eventHour: 2, hoursWalked: 2, eventScene: first });
    state.time.minutes = 3 * 1440 + 8 * 60;
    await runTrip({ state, data: d, io, rng: createRng(5), debug: false, notices: [] }, { route: "wilczy_brod_lesniczowka" });
  };
  // the pilgrim and his bread, then the camp of the day; the others to their first screen (the fights start after it)
  const text = [await assertEnglishAkt2("pielgrzym", road("pielgrzym"), () => [E, E, E]),
    await assertEnglishAkt2("bortnik", road("spotkanie_bortnik"), () => [E]),
    await assertEnglishAkt2("żmije", road("zmije_w_trawie"), () => [E]),
    await assertEnglishAkt2("zasadzka", road("bandyci_na_trakcie"), () => [E])].join("\n");
  for (const s of ["The Pilgrim", "those who show it off", "You receive: Rations", "The Beekeeper", "Bees hear thoughts",
    "Vipers", "like a market woman", "Ambush", "young master"]) assert.ok(text.includes(s), s);
});

// --- act III (scope akt3): story, quests, maps and travel (places, spots, road events); its dialogues are a later task, still Polish ---

/** The files of act III translated so far: their akt3 entries must not show in Polish on an English screen. */
const AKT3_TRANSLATED = ["story.json", "quests.json", "travel.json"];
/** The akt3 entries of story.json, quests.json and travel.json, as [path, Polish text, English overlay text or undefined]. */
function akt3Translated() {
  const scopes = scopeOf(data.pl);
  const overlay = (file) => JSON.parse(readFileSync(new URL(`../data/lang/en/${file}`, import.meta.url), "utf8"));
  return textFiles(data.pl).filter((f) => AKT3_TRANSLATED.includes(f.file)).flatMap(({ file, json }) => {
    const en = overlay(file);
    return [...textEntries(file, json)].filter(([p]) => scopes.get(`${file}|${p}`) === "akt3").map(([p, v]) => [p, v, en[p]?.t]);
  });
}
const polishWords = (s) => s.match(/\p{L}*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\p{L}*/gu) ?? [];
/**
 * The words with a Polish letter that only the Polish akt3 story, quests and travel use: not in any other akt3 text (the
 * dialogues are still Polish on screen), not in a Polish map, and not in the English overlay (names like Głuszec,
 * Ragnosława, Chwalisław). One of them on an English screen means a story, quest or travel text the overlay does not translate.
 */
function akt3OwnPolishWords() {
  const scopes = scopeOf(data.pl);
  const others = new Set(textFiles(data.pl).filter((f) => !AKT3_TRANSLATED.includes(f.file)).flatMap(({ file, json, text }) =>
    text !== undefined ? polishWords(text) : [...textEntries(file, json)].filter(([p]) => scopes.get(`${file}|${p}`) === "akt3").flatMap(([, v]) => polishWords(v))));
  const entries = akt3Translated();
  const kept = new Set(entries.flatMap(([, , en]) => polishWords(en ?? "")));
  return new Set(entries.flatMap(([, pl, en]) => (en === pl ? [] : polishWords(pl))).filter((w) => !others.has(w) && !kept.has(w)));
}
/**
 * The short akt3 story, quest and travel texts (titles, names, labels, short names, hints) the English overlay changes, in
 * Polish: `onScreen` the ones no akt3 dialogue (still Polish) has as a whole word, `shared` the rest as entries (the screen
 * cannot tell them from the dialogue; those are checked against the overlay instead).
 */
function akt3ShortTexts() {
  const scopes = scopeOf(data.pl);
  const others = textFiles(data.pl).filter((f) => f.text === undefined && !AKT3_TRANSLATED.includes(f.file))
    .flatMap(({ file, json }) => [...textEntries(file, json)].filter(([p]) => scopes.get(`${file}|${p}`) === "akt3").map(([, v]) => v)).join("\n");
  const short = akt3Translated().filter(([p, pl, en]) => /\.(?:name|title|label|doneLabel|short|hint|client|reportTo)$/.test(p) && en !== pl);
  return { onScreen: short.filter(([, pl]) => !word(pl).test(others)).map(([, pl]) => pl), shared: short.filter(([, pl]) => word(pl).test(others)) };
}
/** A path in English: the checks of assertEnglish, then no Polish akt3 story, quest or travel text on any frame. */
async function assertEnglishAkt3(label, run, keys) {
  const text = await assertEnglish(label, run, keys);
  const own = akt3OwnPolishWords();
  assert.deepEqual([...new Set(polishWords(text))].filter((w) => own.has(w)), [], `${label}: polskie słowa fabuły, zadań albo podróży aktu III`);
  const { onScreen, shared } = akt3ShortTexts();
  assert.deepEqual(onScreen.filter((s) => word(s).test(text)), [], `${label}: polskie tytuły, nazwy albo podpowiedzi aktu III`);
  assert.deepEqual(shared.filter(([, , en]) => en === undefined).map(([p]) => p), [], `${label}: tytuły aktu III bez przekładu w nakładce`);
  return text;
}
function akt3State(d, scene, location, region) {
  const state = akt2State(d, scene);
  state.world.location = location;
  state.world.discovered = d.travel.locations.filter((l) => l.region === region).map((l) => l.id);
  state.time.minutes = 6 * 1440 + 14 * 60;
  return state;
}
const akt3Run = (scene, location, region, setup = () => {}) => async (d, io) => {
  const state = akt3State(d, scene, location, region);
  setup(state, d);
  await runStory({ state, data: d, io, rng: createRng(5), debug: false, story: createSceneList(d.story.scenes), notices: [] });
};

test("80×24 po angielsku: wejście do aktu III (Głuszec i jego mapa, Obserwatorium, ucieczka przed obławą) – bez ucięć ponad polskie, bez polskiej fabuły", async () => {
  // Głuszec: the arrival, then the hub starts its two quests and lists its places
  const gluszec = await assertEnglishAkt3("wejście do Głuszca", akt3Run("akt3_wejscie", "gluszec", "glusz"), () => [E]);
  for (const s of ["Beyond the pass the road frays", "Friendly parts, no denying it.", "New quest: A Place in the Settlement.",
    "New quest: Where Next: Głuszec."]) assert.ok(gluszec.includes(s), s);
  // Starwatch: the arrival after two days on the road
  const starwatch = await assertEnglishAkt3("wejście do Obserwatorium", akt3Run("akt3b_wejscie", "obserwatorium", "gwiazdy"), () => [E]);
  for (const s of ["░ Starwatch ░", "You trudge north for two days", "shattered telescope", "New quest: A Place at Starwatch.",
    "New quest: Where Next: Starwatch."]) assert.ok(starwatch.includes(s), s);
  // the end of Głuszec when the manhunt drove you out
  const fled = await assertEnglishAkt3("ucieczka", akt3Run("akt3a_koniec_oblawa", "gluszec", "glusz", (state) => {
    Object.assign(state.flags, { akt3a_koniec: true, oblawa_ucieczka: true });
  }), () => []);
  for (const s of ["Beyond Głuszec", "The manhunt hits Głuszec at dawn.", "the reeve, who'll swear he", "your mug on paper now"]) assert.ok(fled.includes(s), s);
});

test("80×24 po angielsku: tablica ogłoszeń i dziennik w Głuszcu – bez ucięć ponad polskie, bez polskich zadań", async () => {
  // the hub with the quests of the longest titles taken, besides its own two
  const run = akt3Run("akt3_mapa", "gluszec", "glusz", (state, d) => {
    for (const q of ["klusownik_i_gajowy", "listy_z_tamtej_strony", "rannego_nie_zostawia_sie", "kobialka_dla_zielarki"]) startQuest(state, d, q);
  });
  // the board (empty: Głuszec gives its jobs by word of mouth), the journal opened from it through all its pages back to the
  // board, stepping away from it
  const keys = (ui) => ["9", hotkey(ui, "key.journal"), E, E, E, E, E, E, "1"];
  const text = await assertEnglishAkt3("tablica i dziennik", run, keys);
  for (const s of ["Notice board", "Step away from the board", "Quest journal", "A Place in the Settlement", "The Poacher and the Gamekeeper",
    "Letters from the Other Side", "You Don't Leave the Wounded", "A Basket for the Herbalist", "Where Next: Głuszec",
    "Rent a room at the Dead Cockerel.", "Radowit the gamekeeper", "Sister Halina at the Crossroads Shrine", "Wincenty the caretaker",
    "set out for Starwatch on Glass Hill"]) assert.ok(text.includes(s), s);
});

for (const [region, hub, labels, plLabels] of [
  ["glusz", "gluszec", ["~~~~ Głuszec Backwoods ~~~~", "distant trails (days away)", "@ Głuszec", "the Wood", "the Quarry", "the Hill", "the Shrine",
    "the Marshes", "the Road", "Burnt Ground", "the Mine"], ["Okolice Głuszca", "dalekie szlaki"]],
  ["gwiazdy", "obserwatorium", ["~~~~ Glass Hills ~~~~", "distant trails (days away)", "@ Starwatch", "Glass Field", "the Crater", "the Stones",
    "the Wreck", "the Hollow", "the Boat", "the Station", "the Watchtower"], ["Szklane Wzgórza", "dalekie szlaki"]],
]) {
  test(`mapa regionu ${region} po angielsku: rysuje się przy tej samej szerokości co polska, tyle samo wierszy, z angielskimi napisami i nazwami`, () => {
    const draw = (d, width) => renderRegionMap(akt3State(d, "x", hub, region), d, { hub, width, height: 20 });
    const minWidth = (d) => { for (let w = 40; w <= 120; w++) if (draw(d, w)) return w; return null; };
    assert.equal(minWidth(data.en), minWidth(data.pl));
    assert.equal(draw(data.en, 80).length, draw(data.pl, 80).length, "tyle samo wierszy");
    const en = draw(data.en, 80).join("\n");
    for (const s of [...labels, "@ You are here"]) assert.ok(en.includes(s), s);
    for (const s of plLabels) assert.ok(!en.includes(s), s);
    assert.deepEqual(polishWords(en).filter((w) => w !== "Głuszec"), [], "polskie nazwy na mapie");
  });
}

// --- act III travel: the places of Głuszec and "Where to?", spot scenes at Starwatch, road events of both regions ---

test("80×24 po angielsku: przybycie do Głuszca, cała lista miejsc i „Where to?” – bez ucięć ponad polskie, bez polskiej podróży", async () => {
  // the arrival scene, then down the whole list of places (16 spots) to "Back to the map", and the destinations
  const text = await assertEnglishAkt3("Głuszec: miejsca", akt3Run("akt3_wejscie", "gluszec", "glusz"), () => [E, ...Array(16).fill(D), E]);
  for (const s of ["The Dead Cockerel Tavern", "Room for the night", "Traders' stalls", "Bogdan's Forge", "Bogdan: wares", "The wise woman's hut",
    "The reeve's house", "The Graveyard", "Notice board", "Old woman on a bench", "Boy with a goat", "Drunk by the fence", "Gamekeeper's lodge",
    "Jerzy the digger", "Watermill", "Bogdan: upgrades", "Back to the map", "Where to?", "You are at: Głuszec", "Poachers' Wood",
    "Crossroads Shrine", "The Quarry", "Greywater Marshes", "Sentry Hill", "Old Road", "Burnt Settlement", "Old Mine", "Look around Głuszec"]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: rozmowy w punktach Obserwatorium (pomocnik z latarnią, kot Kometa) – bez ucięć ponad polskie, bez polskiej podróży", async () => {
  // the arrival, the lad with the lantern (9) and back to the places, then down to the cat (10) and back
  const text = await assertEnglishAkt3("Obserwatorium: punkty", akt3Run("akt3b_wejscie", "obserwatorium", "gwiazdy"),
    () => [E, "9", E, ...Array(9).fill(D), E, E]);
  for (const s of ["Starwatch on Glass Hill", "Hieronim's tower", "Servants' quarters", "Brygida's Workshop", "Brygida: wares", "Note board",
    "Archive", "Tower terrace", "Lad with a lantern", "Comet the cat", "Sentry at the gate", "Brygida: upgrades", "░ The Lad ░",
    "my left shoulder, just in case.", "░ The Cat ░", "do not stroke, do not trust."]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: zdarzenia na drogach aktu III (maruderzy w Głuszy, drwal, patrol u krateru, błędnik) – bez ucięć ponad polskie, bez polskiej podróży", async () => {
  const road = (event, from, route) => async (d, io) => {
    const state = akt3State(d, "x", from, d.travel.locations.find((l) => l.id === from).region);
    startTravel(state, d, route);
    const first = d.travel.events.find((e) => e.id === event).scenes[0].id;
    Object.assign(state.world.travel, { day: 1, phase: "event", event, eventHour: 2, hoursWalked: 2, eventScene: first });
    state.time.minutes = 6 * 1440 + 8 * 60;
    await runTrip({ state, data: d, io, rng: createRng(5), debug: false, notices: [] }, { route });
  };
  // each to its first screen (the fights start after it; the woodcutter's trade is a dialogue, still Polish)
  const text = [await assertEnglishAkt3("maruderzy", road("marudery_na_drodze", "gluszec", "gluszec_obserwatorium"), () => [E]),
    await assertEnglishAkt3("drwal", road("spotkanie_drwal", "gluszec", "gluszec_obserwatorium"), () => []),
    await assertEnglishAkt3("patrol u krateru", road("patrol_u_krateru", "obserwatorium", "obserwatorium_lodz"), () => [E]),
    await assertEnglishAkt3("błędnik", road("blednik_w_szkle", "obserwatorium", "obserwatorium_lodz"), () => [E])].join("\n");
  for (const s of ["░ Marauders ░", "through us", "The Woodcutter", "Imperials were asking", "Patrol by the Crater",
    "in a ledger", "░ Wisp ░", "dances a little fire"]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: Hieronim (pełna lista pytań, wieści z Głuszca z wyborem) i wnętrze wraku – bez ucięć ponad polskie, bez polskiego tekstu", async () => {
  const talk = (dialogue) => (d, io) => {
    const state = akt3State(d, "x", "obserwatorium", "gwiazdy");
    Object.assign(state.flags, { hieronim_potwierdzil: true, oblawa_ucieczka: true });
    state.character.money = 25;
    startQuest(state, d, "wrak_maszyny"); // the wreck offers the core only while its quest runs
    return defaultHandlers.dialogue(sceneCtx(d, io, state), { id: "h", type: "dialogue", dialogue });
  };
  // Hieronim: the empty Starwatch and back, then the news from Głuszec (the manhunt) and sending the coin
  const hieronim = await assertEnglishAkt3("Hieronim", talk("hieronim"), () => ["1", "1", "7", "1", "1"]);
  const missing = (text, list) => list.filter((s) => !text.includes(s));
  assert.deepEqual(missing(hieronim, ["Hieronim the Stargazer", "Why does this place sta", "A nasty one.", "That's how it goes.",
    "Need anything", "The standing ston", "Any news coming", "Where did the first",
    "Take care.", "Grumble the innkeeper", "Wawrzyn", "Send them twenty groats.",
    "Foolish of you. But decent.", "So be it."]), []);
  // the wreck: try to take the core out, ease it out slowly (it works at this rng), the core in the bag
  const wreck = await assertEnglishAkt3("wrak", talk("panel_wraku"), () => ["1", "1", "1"]);
  assert.deepEqual(missing(wreck, ["Inside the Wreck", "sits a cylinder of copper", "Try to take the core out", "wet suck", "Got it.",
    "You get: Machine core."]), []);
  assert.doesNotMatch(hieronim + wreck, /Astronom|Wnętrze wraku|Bywaj/);
});

test("80×24 po angielsku: Brygida (poznanie, wrak, głos z rdzenia) i jej warsztat z biednym bohaterem – bez ucięć ponad polskie, bez polskiego tekstu", async () => {
  const state = (d, setup) => {
    const s = akt3State(d, "x", "obserwatorium", "gwiazdy");
    setup(s, d);
    return s;
  };
  const talk = (setup) => (d, io) => defaultHandlers.dialogue(sceneCtx(d, io, state(d, setup)), { id: "b", type: "dialogue", dialogue: "brygida" });
  const missing = (text, list) => list.filter((s) => !text.includes(s));
  // the first talk: what she works on, meeting her for Hieronim, the wreck's core, the station rumour
  const meet = await assertEnglishAkt3("Brygida", talk((s, d) => {
    s.flags.hieronim_przyjal = true;
    startQuest(s, d, "przyjecie_w_obserwatorium");
  }), () => ["1", "1", "2", "1", "2", "1", "3", "1"]);
  assert.deepEqual(missing(meet, ["Brygida the Handywoman", "each worse than the last", "machine for watching the stars",
    "isn't water, damn it", "copper and glass", "Deal.", "I'm not going.", "Take care."]), []);
  // later: the core hums, the voice from it, remembering the debt
  const core = await assertEnglishAkt3("głos z rdzenia", talk((s) => Object.assign(s.flags, { rdzen_oddany: true, dlug_istoty: true })),
    () => ["2", "1", "2", "1"]);
  assert.deepEqual(missing(core, ["Is the core", "Voice from the Machine Core", "after the slaughter", "I remember. Speak.",
    "The debt grows.", "No words for it."]), []);
  // her wares with three groats in the purse: every row of the stock, each one too dear
  const shop = await assertEnglishAkt3("warsztat Brygidy", (d, io) => defaultHandlers.shop(sceneCtx(d, io, state(d, (s) => { s.character.money = 3; })),
    { id: "s", type: "shop", shop: "warsztat_brygidy" }), (ui) => [E, ...Array(10).fill(D), hotkey(ui, "key.back")]);
  assert.deepEqual(missing(shop, ["Brygida's Workshop · Purse: 3", "Eye of the night · 198 gr Too dear.", "Shard talisman"]), []);
  assert.doesNotMatch(meet + core + shop, /Mechanik|Głos z rdzenia|Bywaj|Nie stać/);
});

test("80×24 po angielsku: rozmowy w Głuszcu (sołtys od pierwszych pytań, karczmarz Mruk z izbą i długiem, kowal Bogdan, siostra Halina) – bez ucięć ponad polskie, bez polskiego tekstu", async () => {
  const missing = (text, list) => list.filter((s) => !text.includes(s));
  // the hub: the reeve's questions (paying the five groats), back to the places; the tavern: rumours, the room, the miller's
  // debt; back to the reeve to report the room and take his quest
  const hub = await assertEnglishAkt3("Głuszec: rozmowy", akt3Run("akt3_wejscie", "gluszec", "glusz"),
    () => [E, "7", "1", "1", "1", "2", "1", "2", "1", "3", "1", "1", "1", "3", "1", "1", "4", "1", "4", "7", "1", "1", "3", "1"]);
  assert.deepEqual(missing(hub, ["Wawrzyn the Reeve", "Reeve, I'm looking for", "No idea what you mean.", "I'll pay five groats.",
    "Nowhere's a hamlet with no name", "doing honest work for a change", "Twenty hearths, thirty dogs", "Beckby",
    "Grumble the Innkeeper", "Any news in the village?", "from the Quarry", "I'll take it (3 gr).", "my mother-in-law",
    "Grumble wipes the counter.", "a poorhouse.", "you're a walking", "the Imperials who comes",
    "I'll start there."]), []);
  const talk = (dialogue, setup) => (d, io) => {
    const state = akt3State(d, "x", "gluszec", "glusz");
    setup(state, d);
    return defaultHandlers.dialogue(sceneCtx(d, io, state), { id: "g", type: "dialogue", dialogue });
  };
  // the smith: the forged papers from Halina's wax, then where his iron comes from
  const smith = await assertEnglishAkt3("kowal Bogdan", talk("kowal_gluszec", (s, d) => {
    s.flags.soltys_potwierdzil = true;
    startQuest(s, d, "falszywe_papiery");
    addItem(s, d, "wosk_pieczetny", 1);
  }), () => ["4", "1", "5", "1"]);
  assert.deepEqual(missing(smith, ["Bogdan the Smith", "Sister Halina sent seal", "Bogdan sniffs the wax", "God repay you.",
    "Where's your iron from?", "the Old Mine", "storehouse"]), []);
  // Halina: the voice from the stones (her longest line, one page as in Polish), the Burnt Settlement
  const halina = await assertEnglishAkt3("siostra Halina", talk("halina", (s, d) => {
    Object.assign(s.flags, { echo_slyszal: true, halina_przeczytala: true });
    startQuest(s, d, "co_widziala_ragnoslawa");
  }), () => ["2", "1", "2", "1"]);
  assert.deepEqual(missing(halina, ["Sister Halina", "I heard a voice from th", "Starwatch on Glass Hill", "it's him or his cat.",
    "The Burnt Settlement, two days north."]), []);
  assert.doesNotMatch(hub + smith + halina, /Sołtys|Karczmarz|Kowal Bogdan|Siostra|Bywaj|Nie wiem/);
});

test("80×24 po angielsku: znachorka Dobrawa, wdowa Jaga i dezerter Tomasz (wybór z fałszywymi papierami) – bez ucięć ponad polskie, bez polskiego tekstu", async () => {
  const missing = (text, list) => list.filter((s) => !text.includes(s));
  const talk = (dialogue, location, region, setup) => (d, io) => {
    const state = akt3State(d, "x", location, region);
    setup(state, d);
    return defaultHandlers.dialogue(sceneCtx(d, io, state), { id: "g", type: "dialogue", dialogue });
  };
  // the wise woman: the grey reed quest (her longest line), then her wares, then goodbye
  const wise = await assertEnglishAkt3("znachorka Dobrawa", talk("znachorka", "gluszec", "glusz", () => {}), () => ["3", "1", "1", "1", "3"]);
  assert.deepEqual(missing(wise, ["Dobrawa the Wise Woman", "cat piss", "Grey reed, from the marshes.",
    "the fever brew", "sells like hot cakes.", "Take care."]), []);
  // the widow when the hero kept the amulet: the quest, then the grave already found
  const widow = await assertEnglishAkt3("wdowa Jaga", talk("wdowa", "gluszec", "glusz", (s) => Object.assign(s.flags, { amulet_zatrzymany: true, grob_odwiedzony: true })),
    () => ["1", "1", "1", "1", "2"]);
  assert.deepEqual(missing(widow, ["Jaga the Widow", "It's about the amulet.", "You kept it.", "third row from the shrine.",
    "God repay you.", "As you say."]), []);
  // the deserter at Starwatch: the choice with the forged papers, then how he is getting on
  const deserter = await assertEnglishAkt3("zwiadowca Tomasz", talk("tomasz", "obserwatorium", "gwiazdy", (s) => { s.flags.papiery_falszywe = true; }),
    () => ["1", "2", "1", "1", "1", "2"]);
  assert.deepEqual(missing(deserter, ["Tomasz the Scout", "a sack of questions.",
    "Imperial seal. Near enough.", "I'll hold you to that.", "I believe the cat."]), []);
  assert.doesNotMatch(wise + widow + deserter, /Znachorka|Wdowa|Zwiadowca|Bywaj|Tak zrobię/);
});

test("80×24 po angielsku: stary żołnierz (zadanie z wyborem: prowiant), najemnik Kruk (łapówka) i ranny górnik – bez ucięć ponad polskie, bez polskiego tekstu", async () => {
  const missing = (text, list) => list.filter((s) => !text.includes(s));
  const talk = (dialogue, location, region, setup) => (d, io) => {
    const state = akt3State(d, "x", location, region);
    setup(state, d);
    return defaultHandlers.dialogue(sceneCtx(d, io, state), { id: "g", type: "dialogue", dialogue });
  };
  // the old soldier with his quest running: the choice of words, rations or Wojmir; the rations, then how the muster goes
  const soldier = await assertEnglishAkt3("stary żołnierz", talk("stary_zolnierz", "ostatnia_strazica", "gwiazdy", (s, d) => {
    startQuest(s, d, "ostatnia_strazica_zlecenie");
    addItem(s, d, "prowiant", 2);
  }), () => ["2", "1", "1", "1", "2"]);
  assert.deepEqual(missing(soldier, ["Old Soldier", "staring at nothing", "Try to talk him", "Brought you rations.",
    "hetman", "Much obliged.", "How are your men?", "gathering men", "So be it.", "Take care."]), []);
  // Raven the sellsword: the question, then the fifteen-groat bribe
  const raven = await assertEnglishAkt3("najemnik Kruk", talk("najemnik", "gluszec", "glusz", (s) => { s.character.money = 20; }),
    () => ["1", "2", "1"]);
  assert.deepEqual(missing(raven, ["Raven the Sellsword", "bearing no crest", "the Blade", "I know nothing",
    "fifteen", "Fifteen?", "counts the coins", "Take care."]), []);
  // the wounded miner: carried to the wise woman
  const miner = await assertEnglishAkt3("ranny górnik", talk("ranny", "kamieniolom", "glusz", (s, d) => startQuest(s, d, "rannego_nie_zostawia_sie")),
    () => ["1", "2", "1", "1"]);
  assert.deepEqual(missing(miner, ["Wounded Miner", "Pale as tallow", "Tend to his leg.", "So long as I walk",
    "Carry him to Dobrawa.", "half the Quarry", "On my way."]), []);
  assert.doesNotMatch(soldier + raven + miner, /Stary żołnierz|Najemnik|Ranny górnik|Bywaj|Idę/);
});

test("80×24 po angielsku: kłusownik Stach (wybór: oszczędzić), furman Sieciech (mapa i ślady karawany), dozorca Wincenty – bez ucięć ponad polskie, bez polskiego tekstu", async () => {
  const missing = (text, list) => list.filter((s) => !text.includes(s));
  const talk = (dialogue, location, region, setup) => (d, io) => {
    const state = akt3State(d, "x", location, region);
    setup(state, d);
    return defaultHandlers.dialogue(sceneCtx(d, io, state), { id: "g", type: "dialogue", dialogue });
  };
  // Stach with the gamekeeper's quest running: the choice, spare him, then what the gamekeeper knows
  const stach = await assertEnglishAkt3("kłusownik Stach", talk("stach", "bor_klusownikow", "glusz", (s, d) => startQuest(s, d, "klusownik_i_gajowy")),
    () => ["1", "2", "1", "1", "1", "2"]);
  assert.deepEqual(missing(stach, ["Stach the Poacher", "pine cones", "your snares", "let a man live?",
    "I'll say I saw nothing.", "in your debt now.", "On my way.", "Radowit knows nothing.", "never in the woods.", "Take care."]), []);
  // Sieciech with the caravan quest running: the guide's map, then the traces found
  const carter = await assertEnglishAkt3("furman Sieciech", talk("furman", "stary_trakt", "glusz", (s, d) => {
    startQuest(s, d, "zaginiona_karawana");
    addItem(s, d, "mapa_przewodnika", 1);
    s.flags.woz_znaleziony = true;
  }), () => ["1", "1", "1", "1", "1"]);
  assert.deepEqual(missing(carter, ["Sieciech the Carter", "upturned", "Might be something", "God's truth.",
    "I found your caravan.", "God repay you.", "twenty groats", "I'll take it."]), []);
  // Wincenty with the miner tended: the reward, then how the miner is
  const caretaker = await assertEnglishAkt3("dozorca Wincenty", talk("dozorca", "kamieniolom", "glusz", (s, d) => {
    startQuest(s, d, "rannego_nie_zostawia_sie");
    Object.assign(s.flags, { ranny_pomoc: true, ranny_opatrzony: true });
  }), () => ["1", "1", "1", "1", "2"]);
  assert.deepEqual(missing(caretaker, ["Wincenty the Caretaker", "d'you want?", "tended your man.",
    "eighteen groats", "the Quarry's till", "How's your miner?", "barber-surgeon", "All right, then."]), []);
  assert.doesNotMatch(stach + carter + caretaker, /Kłusownik|Furman|Dozorca|Bywaj|Idę|Tak zrobię/);
});

test("80×24 po angielsku: dostawy aktu III (żołnierz z listem i grób przy kapliczce, świecarz Tobiasz, kryjówka Wacława) – bez ucięć ponad polskie, bez polskiego tekstu", async () => {
  const missing = (text, list) => list.filter((s) => !text.includes(s));
  const talk = (dialogue, location, region, setup) => (d, io) => {
    const state = akt3State(d, "x", location, region);
    setup(state, d);
    return defaultHandlers.dialogue(sceneCtx(d, io, state), { id: "g", type: "dialogue", dialogue });
  };
  // the dying soldier: the request, taken on
  const soldier = await assertEnglishAkt3("umierający żołnierz", talk("prosba_ostatni_list_zolnierza", "kapliczka_rozstaje", "glusz", () => {}),
    () => ["1", "1"]);
  assert.deepEqual(missing(soldier, ["Dying Soldier", "shot through", "No time for the dead.", "crooked smile", "On my way."]), []);
  // the grave by the shrine with the letter in hand
  const grave = await assertEnglishAkt3("grób przy kapliczce", talk("dostawa_ostatni_list_zolnierza", "kapliczka_rozstaje", "glusz",
    (s, d) => { startQuest(s, d, "ostatni_list_zolnierza"); addItem(s, d, "list_zolnierza", 1); }), () => ["1", "1"]);
  assert.deepEqual(missing(grave, ["Grave by the Shrine", "no cross", "Lay it on the grave.", "purse", "Take care."]), []);
  // Tobiasz the chandler: refused
  const chandler = await assertEnglishAkt3("świecarz Tobiasz", talk("prosba_swiece_na_kapliczke", "kapliczka_rozstaje", "glusz", () => {}),
    () => ["2", "1"]);
  assert.deepEqual(missing(chandler, ["Tobiasz the Chandler", "first-rate wax", "No time.", "my arse", "Take care."]), []);
  // Wacław's hideout with the pouch in hand
  const hideout = await assertEnglishAkt3("kryjówka Wacława", talk("dostawa_odlamki_dla_zbieracza", "pole_szkla", "gwiazdy",
    (s, d) => { startQuest(s, d, "odlamki_dla_zbieracza"); addItem(s, d, "sakiewka_odlamkow", 1); }), () => ["1", "1"]);
  assert.deepEqual(missing(hideout, ["Wacław's Hideout", "hidey-hole", "Leave the pouch there.", "little pot", "Take care, all."]), []);
  assert.doesNotMatch(soldier + grave + chandler + hideout, /Umierający|Grób przy|Świecarz|Kryjówka|Bywaj|Idę|Zaniosę/);
});

test("80 kolumn: każdy wiersz każdego sklepu (nazwa i cena) mieści się w szerokiej kolumnie listy, po polsku i po angielsku", async () => {
  const room = choiceWidthOf(80, true);
  assert.equal(room, 42);
  assert.equal(choiceWidthOf(80), 30, "inne ekrany zostają przy zwykłej kolumnie");
  for (const lang of ["pl", "en"]) {
    const d = data[lang];
    const tooWide = d.shops.flatMap((s) => s.stock.map((e, i) => {
      const item = d.items.find((x) => x.id === e.id);
      const price = buyPrice(d, item, 0, { buyPercent: 0, sellPercent: 0 });
      // "▶ " + "[n] " + the row, as menu.js draws it
      const row = `[${i + 1}] ${t(d.ui, e.qty > 1 ? "shop.buyEntry" : "shop.buyEntryOne", { name: item.name, price, qty: e.qty, currency: t(d.ui, "currency.short") })}`;
      return visibleWidth(row) + 2 > room ? [`${s.id}: ${row}`] : [];
    }).flat());
    assert.deepEqual(tooWide, [], lang);
  }
  assert.equal(t(data.en.ui, "shop.buyEntryOne", { name: "Mace", price: 9, currency: "gr" }), "Mace · 9 gr");
});

// --- the item rows built from what the player carries: all exchanges, the sale list, the inventory list ---

/**
 * The hero carrying every upgradable item at one stage (`stage`: "" the base items, "_u1", "_u2"), so a smith offers every
 * exchange of the stage after it, and the sale and the inventory list the longest names; with the kit that makes lists of
 * 30 to 60 rows, with two-digit numbers (a three-digit list is not something a bag holds).
 */
function packedState(d, stages) {
  const state = shopState(d);
  state.character.money = 50000;
  for (const base of d.items.filter((it) => d.items.some((u) => u.id === `${it.id}_u1`))) {
    for (const stage of stages) if (!state.inventory.items.some((s) => s.id === base.id + stage)) addItem(state, d, base.id + stage, 1);
  }
  for (const id of ["opatrunek", "garnek_huku", "belt", "skora_dzika"]) addItem(state, d, id, 12);
  return state;
}

/** Cursor moves enough to pass every row of the longest list. */
const DOWN_ALL = (n) => Array(n).fill(D);

for (const smith of ["zbych", "bogdan", "brygida", "polowa", "szkarad"]) {
  test(`80×24 po angielsku: wymiana „ulepszenia_${smith}” z dwucyfrowymi numerami bez ucięć ponad polskie`, async () => {
    const run = (d, io) => defaultHandlers.dialogue(sceneCtx(d, io, packedState(d, ["", "_u1"])), { id: "u", type: "dialogue", dialogue: `ulepszenia_${smith}` });
    const text = await assertEnglish(`wymiana ${smith}`, run, () => DOWN_ALL(60));
    if (smith !== "szkarad") assert.match(text, /\[1\d\] /, "lista ma dwucyfrowe numery");
    // the row offers the one stage bought, the earlier one is on the item already
    if (["brygida", "polowa"].includes(smith)) assert.ok(text.includes("Half-plate: plates (170 gr)") && text.includes("Half-plate: leather ("), smith);
  });
}

test("80×24 po angielsku: sprzedaż (z przedmiotami ulepszonymi) bez ucięć ponad polskie", async () => {
  const run = (d, io) => defaultHandlers.shop(sceneCtx(d, io, packedState(d, ["", "_u2"])), { id: "s", type: "shop", shop: "kowal_brod" });
  const text = await assertEnglish("sprzedaż", run, () => [D, E, ...DOWN_ALL(80)]);
  // a list row names the highest stage only, the card beside it the full name
  for (const s of ["] Half-plate (plates) · ", "] Iron knuckles (reshod) · ", "] Light crossbow (limb) · ", "Half-plate (leather, plates)", "Iron knuckles (grip, reshod)"]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: sprzedaż samych ulepszonych pancerzy, numery jednocyfrowe, bez ucięć ponad polskie", async () => {
  const run = (d, io) => {
    const state = shopState(d);
    state.inventory.items = state.inventory.items.filter((st) => Object.values(state.inventory.equipped).includes(st.id));
    for (const it of d.items.filter((i) => /_u2$/.test(i.id) && i.type === "armor")) addItem(state, d, it.id, 1);
    return defaultHandlers.shop(sceneCtx(d, io, state), { id: "s", type: "shop", shop: "kowal_brod" });
  };
  const text = await assertEnglish("sprzedaż pancerzy", run, () => [D, E, ...DOWN_ALL(9)]);
  assert.match(text, /\[\d\] Half-plate \(plates\) · \d+ gr/);
});

test("80×24 po angielsku: lista ekwipunku (wszystkie przedmioty) bez ucięć ponad polskie", async () => {
  const run = (d, io) => defaultHandlers.narration(sceneCtx(d, io, packedState(d, ["_u1", "_u2"])), { id: "n", type: "narration", title: "T", text: "x" });
  const text = await assertEnglish("lista ekwipunku", run, (ui) => [hotkey(ui, "key.inventory"), ...DOWN_ALL(80)]);
  assert.ok(text.includes("] Mace (reshod)"), "wiersz: najwyższy stopień");
  assert.ok(text.includes("Mace (grip, reshod)"), "karta: pełna nazwa");
});

test("80×24: karta każdej rzeczy z półki każdego sklepu pokazuje nazwę, po polsku i po angielsku", async () => {
  for (const lang of ["pl", "en"]) {
    const d = data[lang];
    for (const shop of d.shops) {
      const state = shopState(d);
      state.character.money = 50000;
      const stock = shopStock(state, d, shop.id);
      const io = createScriptedIO([E, ...DOWN_ALL(stock.length - 1)], { tty: true });
      await assert.rejects(defaultHandlers.shop(sceneCtx(d, io, state), { id: "s", type: "shop", shop: shop.id }), InputExhaustedError);
      const seen = new Set();
      for (const f of frames(io)) {
        const at = f.map((l) => /▶ \[(\d+)\] [^▐]* gr/.exec(l)).find(Boolean); // a stock row, not "[1] Kup"
        if (!at) continue;
        const item = d.items.find((x) => x.id === stock[Number(at[1]) - 1].id);
        // the scene panel: left of the bar, rows joined (a long name wraps)
        const scene = f.map((l) => l.split("▒")[0].replace(/^[█▌] ?/, "").trim()).join(" ").replace(/\s+/g, " ");
        assert.ok(scene.includes(item.name), `${lang} ${shop.id}: ${item.name}\n${f.join("\n")}`);
        seen.add(item.id);
      }
      assert.equal(seen.size, new Set(stock.map((e) => e.id)).size, `${lang} ${shop.id}: nie każda karta obejrzana`);
    }
  }
});

/** The description box under the list of a frame: the right panel's rows below its divider, joined. */
function descriptionBox(frame) {
  const right = frame.map((l) => l.split("▒")[1] ?? "");
  const from = right.findIndex((r) => r.includes("▄▀"));
  if (from < 0) return "";
  return right.slice(from + 1).map((r) => r.replace(/[▐█▄▀]/g, "").trim()).filter(Boolean).join(" ");
}

test("80×24: skrócony wiersz ulepszonego przedmiotu, a pełna nazwa w polu pod listą (sprzedaż i ekwipunek, po polsku i po angielsku)", async () => {
  for (const lang of ["pl", "en"]) {
    const d = data[lang];
    const plate = d.items.find((i) => i.id === "polpancerz_u2");
    assert.notEqual(plate.listName, plate.name);
    const state = () => {
      const s = shopState(d);
      s.inventory.items = s.inventory.items.filter((st) => Object.values(s.inventory.equipped).includes(st.id));
      addItem(s, d, "polpancerz_u2", 1);
      return s;
    };
    const selected = (io) => frames(io).filter((f) => f.some((l) => l.includes(`▶ [`) && l.includes(plate.listName)));
    // the sale list: "Sell", then down to the half-plate
    const sale = createScriptedIO([D, E, ...DOWN_ALL(6)], { tty: true });
    await assert.rejects(defaultHandlers.shop(sceneCtx(d, sale, state()), { id: "s", type: "shop", shop: "kowal_brod" }), InputExhaustedError);
    const inSale = selected(sale);
    assert.ok(inSale.length > 0, `${lang}: wiersz „${plate.listName}” na liście sprzedaży`);
    for (const f of inSale) assert.ok(descriptionBox(f).includes(plate.name), `${lang} sprzedaż: ${plate.name}\n${f.join("\n")}`);
    // the inventory list: down to the half-plate
    const inv = createScriptedIO([hotkey(d.ui, "key.inventory"), ...DOWN_ALL(6)], { tty: true });
    await assert.rejects(defaultHandlers.narration(sceneCtx(d, inv, state()), { id: "n", type: "narration", title: "T", text: "x" }), InputExhaustedError);
    const inList = selected(inv);
    assert.ok(inList.length > 0, `${lang}: wiersz „${plate.listName}” w ekwipunku`);
    for (const f of inList) assert.ok(descriptionBox(f).includes(plate.name), `${lang} ekwipunek: ${plate.name}\n${f.join("\n")}`);
  }
});

// --- act IV (scope akt4): everything is translated (story, quests, travel, maps, dialogues), so any Polish akt4 text on a screen is a leak ---

/** The akt4 entries of every text file but the maps, as [path, Polish text, English overlay text or undefined]. */
function akt4Translated(scope = "akt4") {
  const scopes = scopeOf(data.pl);
  return textFiles(data.pl).filter((f) => f.text === undefined).flatMap(({ file, json }) => {
    let en = {};
    try { en = JSON.parse(readFileSync(new URL(`../data/lang/en/${file}`, import.meta.url), "utf8")); } catch { /* no overlay file */ }
    return [...textEntries(file, json)].filter(([p]) => scopes.get(`${file}|${p}`) === scope).map(([p, v]) => [p, v, en[p]?.t]);
  });
}
/** Words with a Polish letter in the Polish akt4 texts the overlay changes, minus those the English akt4 texts keep (names). */
function akt4OwnPolishWords(scope = "akt4") {
  const entries = akt4Translated(scope);
  const kept = new Set(entries.flatMap(([, , en]) => polishWords(en ?? "")));
  return new Set(entries.flatMap(([, pl, en]) => (en === pl ? [] : polishWords(pl))).filter((w) => !kept.has(w)));
}
/** The short akt4 texts (names, titles, labels, hints, speakers, options) the overlay changes, in Polish. */
function akt4ShortTexts(scope = "akt4") {
  const entries = akt4Translated(scope);
  const english = entries.map(([, , en]) => en ?? "").join("\n");
  // not the ones the English texts use as a word too (a Polish "Fort" is in "the Fort")
  return entries.filter(([p, pl, en]) => /\.(?:name|title|label|doneLabel|short|hint|client|reportTo|speaker)$/.test(p) && en !== pl && en !== undefined && !word(pl).test(english)).map(([, pl]) => pl);
}
/** A path in English: the checks of assertEnglish, then no Polish akt4 text of any file on any frame. */
async function assertEnglishAkt4(label, run, keys, scope = "akt4") {
  const text = await assertEnglish(label, run, keys);
  const own = akt4OwnPolishWords(scope);
  assert.deepEqual([...new Set(polishWords(text))].filter((w) => own.has(w)), [], `${label}: polskie słowa aktu ${scope}`);
  assert.deepEqual(akt4ShortTexts(scope).filter((s) => word(s).test(text)), [], `${label}: polskie tytuły, nazwy, mówiący albo podpowiedzi aktu ${scope}`);
  assert.deepEqual(akt4Translated().filter(([, , en]) => en === undefined).map(([p]) => p), [], `${label}: teksty aktu ${scope} bez przekładu w nakładce`);
  return text;
}
function akt4State(d, scene, location, region) {
  const state = akt2State(d, scene);
  state.world.location = location;
  state.world.discovered = d.travel.locations.filter((l) => l.region === region).map((l) => l.id);
  state.time.minutes = 9 * 1440 + 14 * 60;
  return state;
}
const akt4Run = (scene, location, region, setup = () => {}) => async (d, io) => {
  const state = akt4State(d, scene, location, region);
  setup(state, d);
  await runStory({ state, data: d, io, rng: createRng(5), debug: false, story: createSceneList(d.story.scenes), notices: [] });
};

for (const [region, hub] of [["front", "oboz_wronia"], ["stolica", "ulfgrod"], ["loch", "loch_pod_palacem"]]) {
  test(`mapa regionu ${region} po angielsku: rysuje się przy tej samej szerokości co polska, tyle samo wierszy, z angielskimi napisami i nazwami`, () => {
    const draw = (d, width) => renderRegionMap(akt4State(d, "x", hub, region), d, { hub, width, height: 20 });
    const minWidth = (d) => { for (let w = 40; w <= 120; w++) if (draw(d, w)) return w; return null; };
    assert.ok(minWidth(data.pl) !== null, "polska mapa się rysuje");
    assert.equal(minWidth(data.en), minWidth(data.pl));
    assert.equal(draw(data.en, 80).length, draw(data.pl, 80).length, "tyle samo wierszy");
    const en = draw(data.en, 80).join("\n");
    const pl = draw(data.pl, 80).join("\n");
    const locs = (d) => d.travel.locations.filter((l) => l.region === region);
    assert.ok(en.includes(`~~~~ ${data.en.travel.regions[region].name} ~~~~`), "nagłówek regionu");
    assert.ok(en.includes("@ You are here"));
    assert.ok(!pl.includes("@ You are here"));
    // every location on the Polish map is on the English one under its English short name
    for (const l of locs(data.pl)) {
      const enShort = locs(data.en).find((x) => x.id === l.id).short;
      if (pl.includes(l.short)) assert.ok(en.includes(enShort), `${l.short} -> ${enShort}`);
    }
    assert.ok(!en.includes("dalekie szlaki"));
    assert.deepEqual(polishWords(en).filter((w) => !["Ulfgród", "Skjeldowo"].includes(w)), [], "polskie nazwy na mapie");
  });
}

// --- act IV travel: arrival at the Crow Mountain camp and Ulfgród, their places and "Where to?"; one conversation each ---

test("80×24 po angielsku: przybycie do obozu na Wroniej Górze, lista miejsc i „Where to?” – bez ucięć ponad polskie, bez polskiego aktu IV", async () => {
  // the arrival scene, then down the whole list of places (8 spots) to "Back to the map", and the destinations
  const text = await assertEnglishAkt4("oboz_wronia: miejsca", akt4Run("akt4_wejscie", "oboz_wronia", "front"), () => [E, ...Array(8).fill(D), E]);
  for (const s of ["Under the Red Banner", "Command Tent", "Sutler's Tent", "Field Forge: upgrades", "Campfire by the Wagons", "Back to the map", "Where to?",
    "You are at: Camp on Crow Mountain", "Crossing on the Grey", "Deserters' Ravine", "New quest: Where Next: the Front."]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: przybycie do Ulfgrodu, lista miejsc i „Where to?” – bez ucięć ponad polskie, bez polskiego aktu IV", async () => {
  const text = await assertEnglishAkt4("ulfgrod: miejsca", akt4Run("akt4_stolica_wejscie", "ulfgrod", "stolica"), () => [E, ...Array(7).fill(D), E]);
  for (const s of ["Ulfgród Under Martial Law", "The Cracked Bell Tave", "Scribe's office", "Nipper in the street", "Notice board", "Back to the map", "Where to?",
    "You are at: Ulfgród", "New quest: Where Next: Ulfgród."]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: kapitan Bratosław w namiocie sztabu (poznanie, sytuacja na froncie) – bez ucięć ponad polskie, bez polskiego tekstu", async () => {
  const talk = (setup) => (d, io) => {
    const state = akt4State(d, "x", "oboz_wronia", "front");
    setup(state, d);
    return defaultHandlers.dialogue(sceneCtx(d, io, state), { id: "k", type: "dialogue", dialogue: "kapitan" });
  };
  const meet = await assertEnglishAkt4("kapitan: poznanie", talk(() => {}), () => ["1", "1", "1"]);
  const later = await assertEnglishAkt4("kapitan: sytuacja", talk((s) => { s.flags.kapitan_poznany = true; }), () => ["1", "1", "2", "1"]);
  for (const s of ["Captain Bratosław", "Keep it short.", "Report in? Wonderful", "Understood.", "What's the situation at"]) assert.ok((meet + later).includes(s), s);
});

// --- act V (scope akt5): story, quests, travel, maps and dialogues of Jarnowo Island are translated too ---

test("mapa regionu jarnowo po angielsku: rysuje się przy tej samej szerokości co polska, tyle samo wierszy, z angielskimi napisami i nazwami", () => {
  const region = "jarnowo", hub = "przystan_jarnowo";
  const draw = (d, width) => renderRegionMap(akt4State(d, "x", hub, region), d, { hub, width, height: 20 });
  const minWidth = (d) => { for (let w = 40; w <= 120; w++) if (draw(d, w)) return w; return null; };
  assert.ok(minWidth(data.pl) !== null, "polska mapa się rysuje");
  assert.equal(minWidth(data.en), minWidth(data.pl));
  assert.equal(draw(data.en, 80).length, draw(data.pl, 80).length, "tyle samo wierszy");
  const en = draw(data.en, 80).join("\n");
  const pl = draw(data.pl, 80).join("\n");
  const locs = (d) => d.travel.locations.filter((l) => l.region === region);
  assert.ok(en.includes(`~~~~ ${data.en.travel.regions[region].name} ~~~~`), "nagłówek regionu");
  assert.ok(en.includes("Jarnowo Island"), "Jarnowo Island");
  assert.ok(en.includes("@ You are here"));
  assert.ok(!pl.includes("@ You are here"));
  for (const l of locs(data.pl)) {
    const enShort = locs(data.en).find((x) => x.id === l.id).short;
    if (pl.includes(l.short)) assert.ok(en.includes(enShort), `${l.short} -> ${enShort}`);
  }
  assert.ok(!en.includes("dalekie szlaki"));
  assert.deepEqual(polishWords(en).filter((w) => !["Jarnowo"].includes(w)), [], "polskie nazwy na mapie");
});

const akt5Run = (scene, location, region, setup) => akt4Run(scene, location, region, setup);

test("80×24 po angielsku: przybycie do Przystani Jarnowo, lista miejsc i „Where to?” – bez ucięć ponad polskie, bez polskiego aktu V", async () => {
  const spots = data.pl.travel.locations.find((l) => l.id === "przystan_jarnowo").spots.length;
  const text = await assertEnglishAkt4("przystan_jarnowo: miejsca", akt5Run("akt5_wejscie", "przystan_jarnowo", "jarnowo"), () => [E, ...Array(spots).fill(D), E], "akt5");
  for (const s of ["Back to the map", "Where to?"]) assert.ok(text.includes(s), s);
});

test("80×24 po angielsku: kapitan przystani w kancelarii (poznanie) – bez ucięć ponad polskie, bez polskiego tekstu aktu V", async () => {
  const talk = (d, io) => {
    const state = akt4State(d, "x", "przystan_jarnowo", "jarnowo");
    return defaultHandlers.dialogue(sceneCtx(d, io, state), { id: "k", type: "dialogue", dialogue: "kapitan_przystani" });
  };
  const text = await assertEnglishAkt4("kapitan_przystani: poznanie", talk, () => ["1", "1", "1"], "akt5");
  assert.ok(text.includes("Captain Wars"), "mówiący");
});
