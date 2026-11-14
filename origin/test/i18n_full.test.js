import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import { tmpDir, combatState } from "./helpers.js";
import { dataDir } from "../src/config.js";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { setColorsEnabled } from "../src/ui/colors.js";
import { choiceWidthOf, visibleWidth } from "../src/ui/frame.js";
import { createSceneList, runStory } from "../src/engine/loop.js";

const E = "<enter>";
const POLISH_LETTERS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const polishWords = (s) => s.match(/\p{L}*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\p{L}*/gu) ?? [];

/** Words with a Polish letter that the glossary's EN column keeps (names such as Głuszec, Ulfgród): allowed on English screens. */
function glossaryKeptWords() {
  const rows = readFileSync(new URL("../docs/i18n/slownik-en.md", import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("|"));
  const words = new Set();
  for (const row of rows) {
    // split on unescaped pipes: the columns are PL, EN, pattern, notes
    const cols = row.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
    if (cols.length >= 2) polishWords(cols[1]).forEach((w) => words.add(w));
  }
  // personal names stay Polish (the rules above the tables name them: Bratosław, Captain Bratosław): capitalised words of the prose lines
  for (const line of readFileSync(new URL("../docs/i18n/slownik-en.md", import.meta.url), "utf8").split("\n").filter((l) => !l.startsWith("|"))) {
    for (const w of polishWords(line)) if (/^\p{Lu}/u.test(w)) words.add(w);
  }
  return words;
}

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

test("--validate --lang en --strict: cała gra bez ostrzeżeń i błędów", () => {
  const r = spawnSync(process.execPath, ["bin/game.js", "--validate", "--lang", "en", "--strict"], { cwd: new URL("..", import.meta.url), encoding: "utf8", env: { ...process.env, OSTRZE_HOME: process.env.OSTRZE_HOME } });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.doesNotMatch(`${r.stdout}\n${r.stderr}`, /brak [1-9]|nieaktualne [1-9]|ostrzeż/i, `${r.stdout}\n${r.stderr}`);
});

// --- the start of every act, in English, at 80×24 ---

function heroState(d, scene, location, region, day) {
  const state = createNewState({ seed: 7, startScene: scene, rules: d.rules });
  const kit = combatState(d, "miecz");
  Object.assign(state, { character: kit.character, inventory: kit.inventory });
  state.character.name = "Thorgniew";
  state.world.phenomenonRolledDay = 99;
  if (location) state.world.location = location;
  if (region) state.world.discovered = d.travel.locations.filter((l) => l.region === region).map((l) => l.id);
  state.time.minutes = day * 1440 + 14 * 60;
  return state;
}
const startRun = (scene, location, region, day) => async (d, io) => {
  const state = heroState(d, scene, location, region, day);
  await runStory({ state, data: d, io, rng: createRng(5), debug: false, story: createSceneList(d.story.scenes), notices: [] });
};

const ACT_STARTS = [
  ["prolog / akt I", "prolog_wstep", null, null, 0, 6],
  ["akt II", "akt2_koniec_scena", "wilczy_brod", "pogorze", 5, 4],
  ["akt III", "akt3_wejscie", "gluszec", "glusz", 6, 3],
  ["akt IV", "akt4_wejscie", "oboz_wronia", "front", 9, 3],
  ["akt V", "akt5_wejscie", "przystan_jarnowo", "jarnowo", 11, 3],
  ["finał (Wir)", "akt6_wir_mapa", null, null, 14, 3],
  ["finał (wojna i epilog)", "akt6_wojna_wstep", null, null, 15, 6],
];

for (const [label, scene, location, region, day, presses] of ACT_STARTS) {
  test(`80×24 po angielsku: początek (${label}) bez polskich liter poza nazwami ze słownika`, async () => {
    const io = createScriptedIO(Array(presses).fill(E), { tty: true });
    // the script may outlast a short chain of screens (then the run just ends)
    await startRun(scene, location, region, day)(data.en, io).catch((e) => { if (!(e instanceof InputExhaustedError)) throw e; });
    const text = stripVTControlCharacters(io.output.join(""));
    assert.ok(text.length > 200, "ekran niepusty");
    assert.doesNotMatch(text, /\[\[/, "brak klucza ui");
    const kept = glossaryKeptWords();
    const stray = [...new Set(polishWords(text))].filter((w) => !kept.has(w));
    assert.deepEqual(stray, [], `polskie słowa na ekranie (scena ${scene})`);
  });
}

// --- dialogue options: an English option must not be cut where the Polish one is not ---

/** The widest the option row may be at 80 columns: the choice panel less the 2-column cursor. */
const LIMIT = choiceWidthOf(80, false) - 2;
const LIMIT_WIDE = choiceWidthOf(80, true) - 2;

/** The text of a dialogue option row as the menu draws it, "[n] " numbering and the check or job prefix included. */
function rowText(d, dialogue, option, index) {
  const ui = d.ui;
  let label = option.text;
  const starts = option.job !== undefined || (option.actions ?? []).some((a) => a.startQuest);
  if (starts) label = ui["dialogue.offer"].replace("{text}", label);
  else if (option.check) {
    const name = (option.check.skill !== undefined ? d.skills : d.attributes).find((x) => x.id === (option.check.skill ?? option.check.attribute))?.name ?? "";
    label = ui["dialogue.checkLabel"].replace("{name}", name).replace("{difficulty}", String(option.check.difficulty)).replace("{text}", label);
  }
  return `[${index + 1}] ${label}`;
}

/** Every option row that English cuts at 80 columns while the Polish one fits. */
function cutOptions() {
  const out = [];
  for (const pl of data.pl.dialogues) {
    const en = data.en.dialogues.find((x) => x.id === pl.id);
    const limit = pl.wideList ? LIMIT_WIDE : LIMIT;
    for (const [nodeId, node] of Object.entries(pl.nodes)) {
      (node.options ?? []).forEach((option, i) => {
        const enOption = en?.nodes?.[nodeId]?.options?.[i];
        if (!enOption || enOption.text === option.text) return;
        if (visibleWidth(rowText(data.pl, pl, option, i)) <= limit && visibleWidth(rowText(data.en, en, enOption, i)) > limit) {
          out.push({ file: `data/dialogues/${pl.file}`, path: `nodes.${nodeId}.options[${i}].text`, pl: option.text, en: enOption.text, limit });
        }
      });
    }
  }
  return out;
}

test("opcje dialogów: angielska opcja nie jest ucięta przy 80 kolumnach, gdy polska się mieści", () => {
  const cut = cutOptions();
  if (process.env.OPCJE_UCIETE_JSON) {
    mkdirSync(dirname(process.env.OPCJE_UCIETE_JSON), { recursive: true });
    writeFileSync(process.env.OPCJE_UCIETE_JSON, JSON.stringify(cut, null, 2));
  }
  assert.deepEqual(cut, [], `${cut.length} opcji ucięto po angielsku:\n${cut.map((c) => `${c.file} ${c.path} (limit ${c.limit}): ${c.en}`).join("\n")}`);
});
