import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, writeFile, stat, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataDir } from "../src/config.js";
import { loadData, validateData, translationReport, listFiles } from "../src/engine/data.js";
import { textEntries, checkOverlay, hashText } from "../src/i18n/overlay.js";
import { SCOPES, scopeOf, textFiles } from "../tools/i18n/scope.mjs";
import { extract, formatWorklist, isGenerated } from "../tools/i18n/extract.mjs";
import { apply } from "../tools/i18n/apply.mjs";
import { staleReport, NOT_FOUND } from "../tools/i18n/stale.mjs";
import { main } from "../src/cli.js";
import { tmpDir } from "./helpers.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

async function copyData() {
  const dir = await tmpDir();
  await cp(dataDir(), dir, { recursive: true });
  await rm(path.join(dir, "lang"), { recursive: true, force: true }); // without the real overlay: each test writes its own
  return dir;
}
const en = (dir, file) => path.join(dir, "lang", "en", file);
const exists = (p) => stat(p).then(() => true, () => false);
const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));
async function writeEn(dir, file, content) {
  await mkdir(path.dirname(en(dir, file)), { recursive: true });
  await writeFile(en(dir, file), typeof content === "string" ? content : JSON.stringify(content));
}

test("każdy wpis danych ma zakres", async () => {
  const data = await loadData();
  const scopes = scopeOf(data);
  let n = 0;
  for (const { file, json } of textFiles(data)) {
    const paths = json === undefined ? [""] : [...textEntries(file, json).keys()];
    for (const p of paths) {
      n++;
      assert.ok(SCOPES.includes(scopes.get(`${file}|${p}`)), `${file}|${p}: ${scopes.get(`${file}|${p}`)}`);
    }
  }
  assert.equal(scopes.size, n);
  // every act holds something
  for (const s of SCOPES) assert.ok([...scopes.values()].includes(s), s);
});

test("prolog_wstep to akt1, wilczy_brod to akt2, dialog kowal to akt2", async () => {
  const scopes = scopeOf(await loadData());
  assert.equal(scopes.get("story.json|scenes.[prolog_wstep].text"), "akt1");
  assert.equal(scopes.get("travel.json|locations.[wilczy_brod].name"), "akt2");
  const kowal = [...scopes].filter(([k]) => k.startsWith("dialogues/kowal.json|"));
  assert.ok(kowal.length > 0);
  assert.ok(kowal.every(([, s]) => s === "akt2"), "cały dialog w jednym zakresie");
  // the demo_ tail after the prologue is the Wilczy Bród hub (act 2), not the training camp
  assert.equal(scopes.get("story.json|scenes.[demo_mapa].title"), "akt2");
  assert.equal(scopes.get("story.json|scenes.[demo_swit].text"), "akt1");
  assert.equal(scopes.get("maps/wir.txt|"), "final");
  assert.equal(scopes.get("items.json|[miecz_krotki].name") ?? "wspolne", "wspolne");
});

test("Brzezina: nazwy miejsca w akt1 (nagłówek prologu), trasy i reszta Pogórza zostają w akt2", async () => {
  const data = await loadData();
  const scopes = scopeOf(data);
  assert.equal(scopes.get("travel.json|locations.[brzezina].name"), "akt1");
  assert.equal(scopes.get("travel.json|locations.[brzezina].short"), "akt1");
  // nothing else of travel.json moves: the override is the location's own texts only
  assert.deepEqual([...scopes].filter(([k, s]) => k.startsWith("travel.json|") && s === "akt1").map(([k]) => k),
    ["travel.json|locations.[brzezina].name", "travel.json|locations.[brzezina].short"]);
  assert.equal(scopes.get("travel.json|regions.pogorze.name"), "akt2");
});

test("extract → apply → checkOverlay bez braków dla tych wpisów", async () => {
  const dir = await copyData();
  const list = await extract({ dir, scope: "akt1", kind: "story" });
  assert.ok(list.length > 0);
  assert.ok(list.every((e) => e.file === "story.json" && e.en === ""));
  const scopes = scopeOf(await loadData(dir));
  assert.ok(list.every((e) => scopes.get(`${e.file}|${e.path}`) === "akt1"));
  // the worklist is pretty-printed, one object per entry
  assert.match(formatWorklist(list), /^\[\n {2}\{\n {4}"file": "story\.json",\n/);

  const filled = list.map((e, i) => ({ ...e, en: i === 0 ? "" : `EN ${e.pl}` }));
  const map = (await extract({ dir, scope: "akt2", kind: "maps" }))[0];
  assert.equal(map.file, "maps/pogorze.txt");
  filled.push({ ...map, en: `Foothills\n${map.pl}` });
  const r = await apply(filled, { dir });
  assert.deepEqual(r.errors, []);
  assert.equal(r.written, list.length);
  assert.equal(r.skipped, 1);

  const story = await readJson(path.join(dir, "story.json"));
  const overlay = await readJson(en(dir, "story.json"));
  assert.deepEqual(Object.keys(overlay), Object.keys(overlay).sort(), "nakładka posortowana po ścieżce");
  assert.ok(!Object.values(overlay).some((e) => e.t === ""), "pusty en nie trafia do nakładki");
  const missing = new Set(checkOverlay("story.json", story, overlay).missing);
  assert.deepEqual(list.slice(1).filter((e) => missing.has(e.path)), []);
  assert.deepEqual(checkOverlay("story.json", story, overlay).stale, []);
  assert.deepEqual((await extract({ dir, scope: "akt1", kind: "story" })).map((e) => e.path), [list[0].path]);
  assert.equal(await readFile(en(dir, "maps/pogorze.txt"), "utf8"), `Foothills\n${map.pl}`);

  // a second apply updates in place and keeps the file sorted
  const again = await apply([{ ...list[1], en: "Changed." }], { dir });
  assert.deepEqual(again.errors, []);
  const after = await readJson(en(dir, "story.json"));
  assert.equal(after[list[1].path].t, "Changed.");
  assert.equal(Object.keys(after).length, Object.keys(overlay).length);

  const report = await translationReport(dir, "en");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(validateData(await loadData(dir, { lang: "en" })), []);
});

test("apply odrzuca złą ścieżkę i niezgodne zmienne, nic nie zapisując", async () => {
  const dir = await copyData();
  const ui = await readJson(path.join(dir, "ui.json"));
  const [vPath, vText] = [...textEntries("ui.json", ui)].find(([, s]) => /\{\w+\}/.test(s));
  const story = await readJson(path.join(dir, "story.json"));
  const [sPath, sText] = [...textEntries("story.json", story)][0];
  const good = { file: "story.json", path: sPath, pl: sText, en: "Night." };

  const badPath = await apply([good, { file: "story.json", path: "scenes.[nie_ma].text", pl: "x", en: "y" }], { dir });
  assert.ok(badPath.errors.some((e) => /scenes\.\[nie_ma\]\.text: ścieżka nie istnieje/.test(e)), badPath.errors.join("\n"));
  assert.equal(badPath.written, 0);
  assert.equal(await exists(path.join(dir, "lang")), false, "nic nie zapisano");

  const badVars = await apply([good, { file: "ui.json", path: vPath, pl: vText, en: "No variables." }], { dir });
  assert.ok(badVars.errors.some((e) => e.includes(`${vPath}: zmienne`)), badVars.errors.join("\n"));
  assert.equal(await exists(path.join(dir, "lang")), false, "nic nie zapisano");

  const others = await apply([
    good, { ...good },
    { file: "nie_ma.json", path: "a", pl: "x", en: "y" },
    { file: "story.json", path: [...textEntries("story.json", story)][1][0], pl: "stary tekst", en: "Old." },
    { file: "maps/pogorze.txt", path: "", pl: await readFile(path.join(dir, "maps", "pogorze.txt"), "utf8"), en: "no markers" },
    { file: "story.json" },
  ], { dir });
  for (const re of [/wpis powtórzony/, /nie_ma\.json.*nieznany plik/, /polski tekst zmienił się/, /znaczniki \{id\}/, /oczekiwano \{ file, path, pl, en \}/]) {
    assert.ok(others.errors.some((e) => re.test(e)), `${re}\n${others.errors.join("\n")}`);
  }
  assert.equal(await exists(path.join(dir, "lang")), false, "nic nie zapisano");

  // a broken overlay file stops the whole worklist, and stays as it was
  await writeEn(dir, "story.json", "{ zepsute");
  const broken = await apply([good], { dir });
  assert.ok(broken.errors.some((e) => /lang\/en\/story\.json: niepoprawny JSON/.test(e)), broken.errors.join("\n"));
  assert.equal(await readFile(en(dir, "story.json"), "utf8"), "{ zepsute");
});

test("pusty przekład niepustego tekstu to błąd nakładki: plik zostaje po polsku", async () => {
  const dir = await copyData();
  const items = await readJson(path.join(dir, "items.json"));
  await writeEn(dir, "items.json", {
    [`[${items[0].id}].name`]: { t: "", h: hashText(items[0].name) },
    [`[${items[1].id}].name`]: { t: "Axe", h: hashText(items[1].name) },
  });
  assert.deepEqual(checkOverlay("items.json", items, await readJson(en(dir, "items.json"))).empty, [`[${items[0].id}].name`]);
  const report = await translationReport(dir, "en");
  assert.ok(report.errors.some((e) => e.includes(`lang/en/items.json › [${items[0].id}].name: pusty przekład`)), report.errors.join("\n"));
  const data = await loadData(dir, { lang: "en" });
  assert.equal(data.items[1].name, items[1].name, "plik pominięty w całości");
  assert.deepEqual(validateData(data), [], "gra wstaje");
  // extract offers the blank entry again
  assert.ok((await extract({ dir, kind: "all" })).some((e) => e.file === "items.json" && e.path === `[${items[0].id}].name`));
});

test("extract pomija wpisy _u1/_u2 z items.json: pisze je generator ulepszeń", async () => {
  const dir = await copyData();
  const list = (await extract({ dir, kind: "all" })).filter((e) => e.file === "items.json");
  assert.ok(list.some((e) => e.path === "[miecz_krotki].name"), "przedmiot bazowy jest na liście");
  assert.deepEqual(list.filter((e) => /_u[12]\]/.test(e.path)).map((e) => e.path), []);
  assert.ok(isGenerated("items.json", "[miecz_krotki_u1].description"));
  assert.ok(!isGenerated("items.json", "[miecz_krotki].description"));
  assert.ok(!isGenerated("dialogues/x.json", "[a_u1].text"));
});

test("checkOverlay: pusty albo biały przekład tylko w empty, nie w varMismatch", () => {
  const src = { "a.b": "Masz {n}.", "a.c": "Tak." };
  const r = checkOverlay("ui.json", src, { "a.b": { t: "", h: hashText(src["a.b"]) }, "a.c": { t: "  \n", h: hashText(src["a.c"]) } });
  assert.deepEqual(r.empty, ["a.b", "a.c"]);
  assert.deepEqual(r.varMismatch, []);
});

test("listFiles: błąd odczytu katalogu trafia do raportu, nie jest rzucany", async () => {
  const errors = [];
  const eacces = async () => { throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }); };
  assert.deepEqual(await listFiles("x", ".json", errors, "lang/en", eacces), []);
  assert.deepEqual(errors, ["lang/en: EACCES: permission denied"]);
  const enoent = async () => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); };
  assert.deepEqual(await listFiles("x", ".json", errors, "lang/en", enoent), []);
  assert.equal(errors.length, 1);
});

test("stale: stary polski tekst z historii git albo (nie znaleziono)", async (t) => {
  const dir = await copyData();
  const story = await readJson(path.join(dir, "story.json"));
  const [sPath, sText] = [...textEntries("story.json", story)][0];
  const scene = story.scenes.find((s) => sPath.startsWith(`scenes.[${s.id}].`));
  const field = sPath.split(".").at(-1);
  // no git repository: the old text is not found
  await writeEn(dir, "story.json", { [sPath]: { t: "Old night.", h: hashText("tekst, którego nigdy nie było") } });
  let r = await staleReport({ dir });
  assert.deepEqual(r, [{ file: "story.json", path: sPath, old: NOT_FOUND, pl: sText, en: "Old night." }]);

  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    t.skip("brak gita");
    return;
  }
  const g = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: dir, stdio: "ignore" });
  g("init", "-q");
  g("add", "story.json");
  g("commit", "-q", "-m", "a");
  await writeEn(dir, "story.json", { [sPath]: { t: "Old night.", h: hashText(sText) } });
  scene[field] = "Zmieniony tekst.";
  await writeFile(path.join(dir, "story.json"), JSON.stringify(story));
  g("add", "story.json");
  g("commit", "-q", "-m", "b");
  r = await staleReport({ dir });
  assert.deepEqual(r, [{ file: "story.json", path: sPath, old: sText, pl: "Zmieniony tekst.", en: "Old night." }]);
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

test("--validate --strict --scope akt1 liczy tylko wpisy aktu 1", async () => {
  const dir = await copyData();
  process.env.OSTRZE_DATA = dir;
  assert.equal(await main(["--validate", "--lang", "en", "--strict", "--scope", "akt1"], deps), 1);
  assert.match(err.join("\n"), /^story\.json: brak \d+, nieaktualne 0$/m);
  assert.doesNotMatch(err.join("\n"), /^items\.json:/m, "przedmioty to zakres wspolne");

  // translate the whole of act 1: --strict --scope akt1 passes, the full check still fails
  const list = await extract({ dir, scope: "akt1" });
  assert.ok(list.some((e) => e.file.startsWith("dialogues/")));
  assert.deepEqual((await apply(list.map((e) => ({ ...e, en: `EN ${e.pl}` })), { dir })).errors, []);
  err.length = 0;
  out.length = 0;
  assert.equal(await main(["--validate", "--lang", "en", "--strict", "--scope", "akt1"], deps), 0, err.join("\n"));
  assert.match(out.at(-1), /^Dane poprawne\.$/);
  assert.equal(await main(["--validate", "--lang", "en", "--strict"], deps), 1);
});

test("--strict albo --scope bez --lang en: jedno ostrzeżenie, wynik bez zmian", async () => {
  process.env.OSTRZE_DATA = await copyData();
  assert.equal(await main(["--validate", "--strict", "--scope", "akt1"], deps), 0);
  assert.deepEqual(err, ["--strict i --scope działają tylko z --lang en (tu nic nie zmieniają)"]);
  assert.match(out.at(-1), /^Dane poprawne\.$/);
  err.length = 0;
  assert.equal(await main(["--validate"], deps), 0);
  assert.deepEqual(err, []);
});

test("narzędzia działają z wiersza poleceń", async () => {
  const dir = await copyData();
  const work = path.join(await tmpDir(), "lista.json");
  const node = (script, ...args) => execFileSync(process.execPath, [path.join(ROOT, "tools", "i18n", script), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  node("extract.mjs", "--dir", dir, "--scope", "final", "--kind", "maps", "--out", work);
  const list = await readJson(work);
  assert.deepEqual(list.map((e) => e.file), ["maps/wir.txt"]);
  await writeFile(work, JSON.stringify([{ ...list[0], en: list[0].pl }]));
  assert.match(node("apply.mjs", work, "--dir", dir), /Zapisano 1/);
  assert.equal(await readFile(en(dir, "maps/wir.txt"), "utf8"), list[0].pl);
  assert.match(node("stale.mjs", "--dir", dir), /nieaktualne: 0/);
  assert.match(node("scope.mjs", "--dir", dir), /^akt1: \d+$/m);
});
