import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, loadLanguage, saveLanguage, saveGraphics, loadGraphics } from "../src/config.js";
import { loadData, DataLoadError } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { hashText } from "../src/i18n/overlay.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { runApp } from "../src/app.js";
import { main } from "../src/cli.js";
import { tmpDir } from "./helpers.js";

// A small English overlay: the menu, the load menu and the title of the first scene.
const UI_EN = {
  "menu.new": "New game",
  "menu.load": "Load",
  "menu.exit": "Exit",
  "menu.language": "Language: {lang}",
  "menu.language.en": "English",
  "load.back": "Back",
  "load.entry": "{slot} · {scene} · day {day} · {date}",
};
const START_EN = "Land under the stars";

let saved;
let dir;
let plData;
beforeEach(async () => {
  saved = { OSTRZE_HOME: process.env.OSTRZE_HOME, OSTRZE_DATA: process.env.OSTRZE_DATA };
  process.env.OSTRZE_HOME = await tmpDir();
  dir = await tmpDir();
  await cp(dataDir(), dir, { recursive: true });
  const ui = JSON.parse(await readFile(path.join(dir, "ui.json"), "utf8"));
  const story = JSON.parse(await readFile(path.join(dir, "story.json"), "utf8"));
  const first = story.scenes.find((s) => s.id === story.start);
  await mkdir(path.join(dir, "lang", "en"), { recursive: true });
  await writeFile(path.join(dir, "lang", "en", "ui.json"), JSON.stringify(Object.fromEntries(Object.entries(UI_EN).map(([k, t]) => [k, { t, h: hashText(ui[k]) }]))));
  await writeFile(path.join(dir, "lang", "en", "story.json"), JSON.stringify({ [`scenes.[${first.id}].title`]: { t: START_EN, h: hashText(first.title) } }));
  plData = await loadData(dir);
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

const configFile = () => path.join(process.env.OSTRZE_HOME, "config.json");
const reloadData = (lang) => loadData(dir, { lang });
const text = (io) => io.output.join("");
/** The text after the last occurrence of `marker` (the screen drawn after that menu). */
const after = (out, marker) => out.slice(out.lastIndexOf(marker) + marker.length);
/** The Polish start scene. */
const start = () => plData.story.scenes.find((s) => s.id === plData.story.start);
/** Runs the app until the script ends; running out of input inside a game is the expected end. */
async function run(io, opts) {
  try {
    await runApp({ data: plData, io, reloadData, ...opts });
  } catch (err) {
    if (!(err instanceof InputExhaustedError)) throw err;
  }
}
async function saveSlot1() {
  const state = createNewState({ seed: 5, startScene: plData.story.start, rules: plData.rules });
  await saveGame("1", state, createRng(5));
}
const slot1File = () => {
  const saves = path.join(process.env.OSTRZE_HOME, "saves");
  return path.join(saves, fs.readdirSync(saves).find((f) => f.startsWith("1")));
};

test("pierwsze uruchomienie bez ustawienia pyta o język i zapisuje wybór", async () => {
  const io = createScriptedIO(["2", "4"]); // English, then Exit (line mode: new, load, language, exit)
  await run(io, { options: { askLanguage: true } });
  const out = text(io);
  assert.match(out, /Wybierz język \/ Choose language/);
  assert.match(out, /\[1\] Polski/);
  assert.match(out, /\[2\] English/);
  assert.equal(loadLanguage(), "en");
  const menu = out.slice(out.indexOf("Choose language"));
  assert.match(menu, /\[1\] New game/);
  assert.match(menu, /\[3\] Language: English/);
  assert.match(menu, /\[4\] Exit/);

  // the next run with the setting saved does not ask
  const again = createScriptedIO(["4"]);
  await run(again, { options: { askLanguage: true } });
  assert.doesNotMatch(text(again), /Choose language/);
});

test("w ramce: ekran wyboru, potem menu z wierszem języka nad Wyjściem", async () => {
  const io = createScriptedIO(["2", "4", "5"], { tty: true }); // English; Language → Polish; Exit
  Object.assign(io, { columns: 120, rows: 40 });
  await run(io, { options: { askLanguage: true } });
  const out = text(io).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  assert.match(out, /Wybierz język \/ Choose language/);
  const en = out.slice(out.indexOf("Choose language"));
  assert.match(en, /\[4\] Language: English/);
  assert.match(en, /\[5\] Exit/);
  const pl = en.slice(en.indexOf("Language: English"));
  assert.match(pl, /\[4\] Język: polski/);
  assert.match(pl, /\[5\] Wyjście/);
  assert.equal(loadLanguage(), "pl");
});

test("zła wartość language w config.json: ekran wyboru", async () => {
  for (const bad of [JSON.stringify({ language: "de", graphics: "gray" }), "{ to nie json"]) {
    fs.writeFileSync(configFile(), bad);
    assert.equal(loadLanguage(), null);
    const io = createScriptedIO(["1", "4"]); // Polski, Exit
    await run(io, { options: { askLanguage: true } });
    assert.match(text(io), /Wybierz język \/ Choose language/);
    assert.match(text(io), /\[3\] Język: polski/);
    assert.equal(loadLanguage(), "pl");
  }
  assert.equal(JSON.parse(fs.readFileSync(configFile(), "utf8")).language, "pl");
  // without askLanguage (tests, a script) a missing setting means Polish and no question
  fs.rmSync(configFile());
  const io = createScriptedIO(["4"]);
  await run(io, { options: {} });
  assert.doesNotMatch(text(io), /Choose language/);
  assert.equal(loadLanguage(), null);
});

test("język i grafiki w jednym config.json: zapis jednego nie kasuje drugiego", () => {
  saveGraphics("gray");
  saveLanguage("en");
  assert.equal(loadGraphics(), "gray");
  assert.equal(loadLanguage(), "en");
  saveGraphics("none");
  assert.equal(loadLanguage(), "en");
  assert.deepEqual(JSON.parse(fs.readFileSync(configFile(), "utf8")), { graphics: "none", language: "en" });
});

test("--lang en nie pyta i nie zapisuje", async () => {
  process.env.OSTRZE_DATA = dir;
  const deps = { stdout: () => {}, stderr: () => {}, askLanguage: true };
  const io = createScriptedIO(["4"]);
  assert.equal(await main(["--lang", "en"], { ...deps, io }), 0);
  assert.doesNotMatch(text(io), /Choose language/);
  assert.match(text(io), /\[1\] New game/);
  assert.ok(!fs.existsSync(configFile()));

  // a switch in the menu holds for this run only
  const io2 = createScriptedIO(["3", "4"]);
  assert.equal(await main(["--lang", "en"], { ...deps, io: io2 }), 0);
  assert.match(text(io2), /\[1\] Nowa gra/);
  assert.ok(!fs.existsSync(configFile()));

  // --lang beats the saved setting
  saveLanguage("pl");
  const io3 = createScriptedIO(["4"]);
  assert.equal(await main(["--lang", "en"], { ...deps, io: io3 }), 0);
  assert.match(text(io3), /\[1\] New game/);
  assert.equal(loadLanguage(), "pl");

  // without --lang the saved setting picks the language
  saveLanguage("en");
  const io4 = createScriptedIO(["4"]);
  assert.equal(await main([], { ...deps, io: io4 }), 0);
  assert.match(text(io4), /\[1\] New game/);
});

test("zapisany język z pustym przekładem: plik nakładki pominięty, gra wstaje po angielsku; z --lang też", async () => {
  // an empty translation of non-empty text is an overlay error: that file stays Polish, so the data stay valid
  const first = start();
  await writeFile(path.join(dir, "lang", "en", "story.json"), JSON.stringify({ [`scenes.[${first.id}].text`]: { t: "", h: hashText(first.text) } }));
  process.env.OSTRZE_DATA = dir;
  saveLanguage("en");
  const err = [];
  const deps = { stdout: () => {}, stderr: (s) => err.push(s) };
  const io = createScriptedIO(["4"]);
  assert.equal(await main([], { ...deps, io }), 0);
  const out = text(io);
  assert.doesNotMatch(out, /Nie udało się wczytać gry/);
  assert.match(out, /\[1\] New game/);
  assert.equal(loadLanguage(), "en");
  assert.deepEqual(err, []);

  const io2 = createScriptedIO(["4"]);
  assert.equal(await main(["--lang", "en"], { ...deps, io: io2 }), 0);
  assert.match(text(io2), /\[1\] New game/);
  assert.deepEqual(err, []);
});

test("zapisany język, którego dane się nie wczytują: start po polsku z komunikatem, ustawienie zostaje; z --lang błąd", async () => {
  process.env.OSTRZE_DATA = dir;
  saveLanguage("en");
  const failing = async (d, opts = {}) => {
    if (opts.lang === "en") throw new DataLoadError("lang/en: zepsute dane");
    return loadData(d, opts);
  };
  const err = [];
  const deps = { stdout: () => {}, stderr: (s) => err.push(s), loadData: failing };
  const io = createScriptedIO(["4"]);
  assert.equal(await main([], { ...deps, io }), 0);
  const out = text(io);
  assert.match(out, /Nie udało się wczytać gry w wybranym języku \(angielski\), więc jest po polsku: .*zepsute dane/);
  assert.match(out, /\[1\] Nowa gra/);
  assert.equal(loadLanguage(), "en");
  assert.deepEqual(err, []);

  // given explicitly, the same language is an error
  const io2 = createScriptedIO(["4"]);
  assert.equal(await main(["--lang", "en"], { ...deps, io: io2 }), 1);
  assert.match(err.join("\n"), /zepsute dane/);
  assert.equal(io2.output.length, 0);
});

test("zmiana języka w menu przeładowuje dane i zapisuje ustawienie", async () => {
  await saveSlot1();
  // language → English; Load → Back; New game → the first screen (the script ends there)
  const io = createScriptedIO(["3", "2", "2", "1"]);
  await run(io, { options: { seed: 3 } });
  const out = text(io);
  assert.match(out, /\[3\] Język: polski/);
  const menus = out.slice(out.indexOf("Język: polski") + 1);
  assert.match(menus, /\[1\] New game/);
  assert.match(menus, /\[2\] Load/);
  assert.match(menus, /\[3\] Language: English/);
  assert.match(menus, /\[4\] Exit/);
  assert.match(menus, new RegExp(`\\[1\\] 1 · ${START_EN} · day 1 · `));
  assert.match(menus, /\[2\] Back/);
  assert.doesNotMatch(menus, /Nowa gra|Wczytaj|Wróć/);
  // the game screen alone: everything after the last main menu
  const game = after(out, "[4] Exit");
  assert.doesNotMatch(game, /Back|Load/, "nic z menu");
  assert.match(game, new RegExp(`^${START_EN}$`, "m"));
  assert.doesNotMatch(game, new RegExp(start().title));
  assert.equal(loadLanguage(), "en");

  // and back to Polish
  const io2 = createScriptedIO(["3", "4"]);
  await runApp({ data: await reloadData("en"), io: io2, reloadData });
  assert.match(text(io2).slice(text(io2).indexOf("Language: English")), /\[1\] Nowa gra/);
  assert.equal(loadLanguage(), "pl");
});

test("nieudane przeładowanie: język zostaje, komunikat, nic się nie zapisuje", async () => {
  const io = createScriptedIO(["3", "4"]);
  await runApp({ data: plData, io, reloadData: async () => { throw new Error("brak danych"); } });
  const rest = text(io).slice(text(io).indexOf("Język: polski") + 1);
  assert.match(rest, /brak danych/);
  assert.match(rest, /\[1\] Nowa gra/);
  assert.match(rest, /\[3\] Język: polski/);
  assert.equal(loadLanguage(), null);
});

test("nieudane przeładowanie na ekranie wyboru: komunikat, po polsku, nic nie zapisane, następny start pyta znowu", async () => {
  const failing = async () => { throw new Error("brak danych"); };
  const io = createScriptedIO(["2", "4"]); // English, Exit
  await runApp({ data: plData, io, reloadData: failing, options: { askLanguage: true } });
  const rest = after(text(io), "[2] English");
  assert.match(rest, /Nie udało się wczytać danych w tym języku: brak danych/);
  assert.match(rest, /\[1\] Nowa gra/);
  assert.match(rest, /\[3\] Język: polski/);
  assert.equal(loadLanguage(), null);
  assert.ok(!fs.existsSync(configFile()));

  const again = createScriptedIO(["1", "4"]);
  await runApp({ data: plData, io: again, reloadData, options: { askLanguage: true } });
  assert.match(text(again), /Wybierz język \/ Choose language/);
});

test("wczytany zapis po zmianie języka: ten sam stan, teksty w nowym języku", async () => {
  await saveSlot1();
  const before = fs.readFileSync(slot1File(), "utf8");
  const io = createScriptedIO(["3", "2", "1"]); // English, Load, slot 1
  await run(io, { options: {} });
  const game = after(text(io), "[2] Back");
  assert.match(game, new RegExp(`^${START_EN}$`, "m"));
  assert.doesNotMatch(game, new RegExp(start().title));
  const enData = await reloadData("en");
  assert.deepEqual(await loadGame("1", enData), await loadGame("1", plData));
  assert.equal(fs.readFileSync(slot1File(), "utf8"), before);
});
