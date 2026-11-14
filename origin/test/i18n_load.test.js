import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../src/config.js";
import { loadData, translationReport } from "../src/engine/data.js";
import { textEntries, hashText, TEXT_KEYS } from "../src/i18n/overlay.js";
import { main } from "../src/cli.js";
import { tmpDir } from "./helpers.js";

/** A copy of the real data in a temp dir, without its overlay; `lang/en` is created on demand. */
async function copyData() {
  const dir = await tmpDir();
  await cp(dataDir(), dir, { recursive: true });
  await rm(path.join(dir, "lang"), { recursive: true, force: true }); // without the real overlay: each test writes its own
  return dir;
}
const en = (dir, ...parts) => path.join(dir, "lang", "en", ...parts);
async function writeEn(dir, file, content) {
  await mkdir(path.dirname(en(dir, file)), { recursive: true });
  await writeFile(en(dir, file), typeof content === "string" ? content : JSON.stringify(content));
}
const readPl = async (dir, file) => JSON.parse(await readFile(path.join(dir, file), "utf8"));

test("loadData z lang en nakłada przekład i mapy", async () => {
  const dir = await copyData();
  const items = await readPl(dir, "items.json");
  const first = items[0];
  await writeEn(dir, "items.json", {
    [`[${first.id}].name`]: { t: "Short Sword", h: hashText(first.name) },
    [`[${items[2].id}].name`]: { t: "Old translation", h: hashText("stary polski tekst") },
  });
  const kowal = await readPl(dir, "dialogues/kowal.json");
  const [dPath, dText] = [...textEntries("dialogues/kowal.json", kowal)][0];
  await writeEn(dir, "dialogues/kowal.json", { [dPath]: { t: "EN dialogue", h: hashText(dText) } });
  const plMap = await readFile(path.join(dir, "maps", "pogorze.txt"), "utf8");
  await writeEn(dir, "maps/pogorze.txt", `Foothills\n${plMap}`);

  const data = await loadData(dir, { lang: "en" });
  assert.equal(data.lang, "en");
  assert.equal(data.items[0].name, "Short Sword");
  if (typeof first.nameAcc === "string") assert.equal(data.items[0].nameAcc, "Short Sword");
  assert.equal(data.items[1].name, items[1].name, "nieprzetłumaczony wpis zostaje po polsku");
  assert.equal(data.dialogues.find((d) => d.file === "kowal.json").nodes !== undefined, true);
  assert.equal(textEntries("dialogues/kowal.json", data.dialogues.find((d) => d.file === "kowal.json")).get(dPath), "EN dialogue");
  assert.equal(data.maps.pogorze, `Foothills\n${plMap}`);
  assert.ok(Object.isFrozen(data.items[0]));

  const pl = await loadData(dir);
  assert.equal(pl.lang, "pl");
  assert.equal(pl.items[0].name, first.name);
  assert.equal(pl.maps.pogorze, plMap);

  const report = await translationReport(dir, "en");
  assert.deepEqual(report.errors, []);
  assert.equal(report.perFile["items.json"].stale, 1);
  assert.equal(data.items[2].name, "Old translation", "nieaktualny przekład dalej się nakłada");
  assert.ok(report.warnings.includes(`items.json: brak ${report.perFile["items.json"].missing}, nieaktualne 1`));
  assert.equal(report.perFile["items.json"].missing, textEntries("items.json", items).size - 2 - [...textEntries("items.json", items).keys()].filter((p) => /\.(nameAcc|clientGen)$/.test(p)).length);
  assert.equal(report.perFile["maps/pogorze.txt"]?.missing ?? 0, 0);
  assert.equal(report.perFile["maps/glusz.txt"].missing, 1);
});

test("brak katalogu lang/en: dane po polsku, ostrzeżenie w raporcie", async () => {
  const dir = await copyData();
  const data = await loadData(dir, { lang: "en" });
  const pl = await loadData(dir);
  assert.equal(data.items[0].name, pl.items[0].name);
  assert.equal(data.lang, "en");
  const report = await translationReport(dir, "en");
  assert.deepEqual(report.errors, []);
  assert.ok(report.warnings.some((w) => /lang\/en.*brak katalogu/.test(w)), report.warnings.join("\n"));
  assert.ok(report.warnings.some((w) => /^items\.json: brak \d+, nieaktualne 0$/.test(w)), report.warnings.join("\n"));
});

test("uszkodzony JSON nakładki: dane po polsku, błąd z nazwą pliku w raporcie, bez wyjątku z loadData", async () => {
  const dir = await copyData();
  await writeEn(dir, "items.json", "{ zepsute");
  const story = await readPl(dir, "story.json");
  const [sPath, sText] = [...textEntries("story.json", story)][0];
  await writeEn(dir, "story.json", { [sPath]: { t: "Night.", h: hashText(sText) } });
  const data = await loadData(dir, { lang: "en" });
  const pl = await loadData(dir);
  assert.equal(data.items[0].name, pl.items[0].name);
  assert.equal(textEntries("story.json", data.story).get(sPath), "Night.", "pozostałe pliki nakładki działają");
  const report = await translationReport(dir, "en");
  assert.ok(report.errors.some((e) => /lang\/en\/items\.json: niepoprawny JSON/.test(e)), report.errors.join("\n"));
});

test("błędy wpisów nakładki: osierocona ścieżka, zmienne, pole nietekstowe", async () => {
  const dir = await copyData();
  const items = await readPl(dir, "items.json");
  const withVar = [...textEntries("ui.json", await readPl(dir, "ui.json"))].find(([, s]) => /\{\w+\}/.test(s));
  await writeEn(dir, "items.json", {
    "[nie_ma_takiego].name": { t: "X", h: "00000000" },
    [`[${items[0].id}].id`]: { t: "X", h: "00000000" },
  });
  assert.ok(withVar, "ui.json ma tekst ze zmienną");
  await writeEn(dir, "ui.json", { [withVar[0]]: { t: "No vars here.", h: hashText(withVar[1]) } });
  await writeEn(dir, "nie_ma.json", {});
  const report = await translationReport(dir, "en");
  assert.ok(report.errors.some((e) => /lang\/en\/items\.json › \[nie_ma_takiego\]\.name/.test(e)), report.errors.join("\n"));
  assert.ok(report.errors.some((e) => e.includes(`lang/en/items.json › [${items[0].id}].id`)), report.errors.join("\n"));
  assert.ok(report.errors.some((e) => e.includes(`lang/en/ui.json › ${withVar[0]}: zmienne`)), report.errors.join("\n"));
  assert.ok(report.errors.some((e) => /lang\/en\/nie_ma\.json/.test(e)), report.errors.join("\n"));
  const data = await loadData(dir, { lang: "en" });
  assert.equal(data.items[0].name, items[0].name);
});

test("mapa z innymi znacznikami {id} to błąd", async () => {
  const dir = await copyData();
  const plMap = await readFile(path.join(dir, "maps", "pogorze.txt"), "utf8");
  assert.match(plMap, /\{[a-z0-9_]+\}/);
  const broken = plMap.replace(/\{[a-z0-9_]+\}/, "{nie_ma}");
  await writeEn(dir, "maps/pogorze.txt", broken);
  await writeEn(dir, "maps/nie_ma.txt", "x");
  const data = await loadData(dir, { lang: "en" });
  assert.equal(data.maps.pogorze, plMap, "zła mapa zostaje po polsku");
  assert.equal(data.maps.nie_ma, undefined);
  const report = await translationReport(dir, "en");
  assert.ok(report.errors.some((e) => /lang\/en\/maps\/pogorze\.txt: znaczniki/.test(e)), report.errors.join("\n"));
  assert.ok(report.errors.some((e) => /lang\/en\/maps\/nie_ma\.txt/.test(e)), report.errors.join("\n"));
});

let saved, out, err, deps;
beforeEach(async () => {
  saved = { OSTRZE_HOME: process.env.OSTRZE_HOME, OSTRZE_DATA: process.env.OSTRZE_DATA };
  process.env.OSTRZE_HOME = await tmpDir();
  out = [];
  err = [];
  deps = { stdout: (s) => out.push(s), stderr: (s) => err.push(s) };
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

test("--validate --lang en --strict kończy się kodem 1 przy brakach", async () => {
  process.env.OSTRZE_DATA = await copyData();
  assert.equal(await main(["--validate", "--lang", "en"], deps), 0);
  const text = out.join("\n");
  assert.match(text, /^items\.json: brak \d+, nieaktualne 0$/m);
  assert.match(text, /^razem: brak \d+, nieaktualne 0$/m);
  assert.match(out.at(-1), /^Dane poprawne\.$/);

  out.length = 0;
  assert.equal(await main(["--validate", "--lang", "en", "--strict"], deps), 1);
  assert.match(err.join("\n"), /^items\.json: brak \d+, nieaktualne 0$/m);
  assert.doesNotMatch(out.join("\n"), /Dane poprawne/);

  err.length = 0;
  assert.equal(await main(["--validate", "--lang", "en", "--strict", "--scope", "all"], deps), 1);
  err.length = 0;
  assert.equal(await main(["--validate", "--lang", "en", "--strict", "--scope", "nie_ma"], deps), 1);
  assert.match(err.join("\n"), /--scope/);
  err.length = 0;
  assert.equal(await main(["--validate", "--lang", "de"], deps), 1);
  assert.match(err.join("\n"), /--lang/);
});

test("--validate --lang en: błąd nakładki → kod 1", async () => {
  const dir = await copyData();
  await writeEn(dir, "items.json", "{ zepsute");
  process.env.OSTRZE_DATA = dir;
  assert.equal(await main(["--validate", "--lang", "en"], deps), 1);
  assert.match(err.join("\n"), /lang\/en\/items\.json: niepoprawny JSON/);
});

/** Walks pl and en together: every difference must be an "EN:" text field (any string in ui). */
function compareMechanics(pl, enData, at, inUi, diffs) {
  if (typeof pl === "string" && typeof enData === "string") {
    if (pl === enData) return 0;
    const key = at.split(".").at(-1);
    if (enData.startsWith("EN:") && (inUi || TEXT_KEYS.includes(key))) return 1;
    diffs.push(at);
    return 0;
  }
  if (pl === null || typeof pl !== "object" || enData === null || typeof enData !== "object") {
    if (!Object.is(pl, enData)) diffs.push(at);
    return 0;
  }
  if (Array.isArray(pl) !== Array.isArray(enData)) { diffs.push(at); return 0; }
  const keys = new Set([...Object.keys(pl), ...Object.keys(enData)]);
  let n = 0;
  for (const k of keys) {
    if (!Object.hasOwn(pl, k) || !Object.hasOwn(enData, k)) { diffs.push(`${at}.${k}`); continue; }
    n += compareMechanics(pl[k], enData[k], `${at}.${k}`, inUi, diffs);
  }
  return n;
}

test("nakładka nie zmienia mechaniki: dane en bez pól tekstowych równe danym pl", async () => {
  const dir = await copyData();
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  files.push(...(await readdir(path.join(dir, "dialogues"))).filter((f) => f.endsWith(".json")).map((f) => `dialogues/${f}`));
  let total = 0;
  for (const file of files) {
    const overlay = {};
    for (const [p, s] of textEntries(file, await readPl(dir, file))) {
      if (/\.(nameAcc|clientGen)$/.test(p)) continue;
      overlay[p] = { t: `EN:${s}`, h: hashText(s) };
      total++;
    }
    await writeEn(dir, file, overlay);
  }
  for (const f of (await readdir(path.join(dir, "maps"))).filter((x) => x.endsWith(".txt"))) {
    await writeEn(dir, `maps/${f}`, `EN:${await readFile(path.join(dir, "maps", f), "utf8")}`);
  }
  const report = await translationReport(dir, "en");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings, []);

  const pl = await loadData(dir);
  const enData = await loadData(dir, { lang: "en" });
  const diffs = [];
  let changed = 0;
  for (const part of Object.keys(pl)) {
    if (part === "lang" || part === "maps") continue;
    changed += compareMechanics(pl[part], enData[part], part, part === "ui", diffs);
  }
  for (const region of Object.keys(pl.maps)) assert.equal(enData.maps[region], `EN:${pl.maps[region]}`);
  assert.deepEqual(diffs, []);
  assert.ok(changed >= total, `przetłumaczono ${changed} pól, wpisów ${total}`);
  assert.deepEqual(Object.keys(enData).sort(), Object.keys(pl).sort());
});
