// The binding glossary docs/i18n/slownik-en.md: every overlay entry whose Polish text matches a row's
// pattern must carry that row's English name, and the glossary itself must be consistent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, readFile, writeFile, stat, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataDir } from "../src/config.js";
import { loadData } from "../src/engine/data.js";
import { textEntries, hashText } from "../src/i18n/overlay.js";
import { textFiles } from "../src/i18n/scope.js";
import { tmpDir } from "./helpers.js";
import { parseGlossary, compile, containsTerm } from "../tools/i18n/glossary.mjs";
import { polishTexts, stemRegex } from "../tools/i18n/glossary_forms.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const GLOSSARY = path.join(ROOT, "docs", "i18n", "slownik-en.md");
const FORMS = path.join(ROOT, "test", "fixtures", "glossary_forms.json");
const apos = (s) => s.replace(/[‘’]/g, "'");

async function glossary() {
  let md;
  try {
    md = await readFile(GLOSSARY, "utf8");
  } catch (e) {
    assert.fail(`brak słownika ${GLOSSARY}: ${e.message}`);
  }
  const rows = parseGlossary(md);
  assert.ok(rows.length > 0, "słownik nie ma żadnych wierszy w tabelach PL | EN | wzorzec PL | uwagi");
  return rows;
}

/** Every overlay entry as { where, pl, en } (a translated map is one entry with the whole text). */
async function overlayPairs(dir) {
  const data = await loadData(dir);
  const pairs = [];
  for (const f of textFiles(data)) {
    const abs = path.join(dir, "lang", "en", f.file);
    let raw;
    try {
      raw = await readFile(abs, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") continue;
      throw e;
    }
    // a map's {id} markers are location ids, not text ({obserwatorium} is not the word Obserwatorium): the names
    // drawn in their place come from travel.json, which is checked on its own
    const unmarked = (s) => s.replace(/\{[^{}]*\}/g, "");
    if (f.text !== undefined) { pairs.push({ where: f.file, pl: unmarked(f.text), en: unmarked(raw) }); continue; }
    const pl = textEntries(f.file, f.json);
    for (const [p, e] of Object.entries(JSON.parse(raw))) {
      if (pl.has(p) && e && typeof e.t === "string") pairs.push({ where: `${f.file} › ${p}`, pl: pl.get(p), en: e.t });
    }
  }
  return pairs;
}

async function violations(dir) {
  const rows = (await glossary()).filter((r) => r.pattern).map((r) => ({ ...r, re: compile(r.pattern) }));
  const pairs = await overlayPairs(dir);
  const bad = [];
  for (const { where, pl, en } of pairs) {
    // a quest title is in Title Case ("Grey Reed") even when it is an item's name ("Grey reed"): the words must be there, the
    // capitals are free (a lower-case term matches in any case)
    const title = /^quests\.json › .*\.name$/.test(where);
    for (const r of rows) {
      if (r.re.test(pl) && !containsTerm(title ? en.toLowerCase() : en, title ? r.en.toLowerCase() : r.en)) bad.push(`${where}: brak „${r.en}” (${r.pl})`);
    }
  }
  return { bad, pairs: pairs.length };
}

test("słownik: każdy wzorzec się kompiluje, a EN nie jest puste", async () => {
  const bad = [];
  for (const r of await glossary()) {
    if (!r.pl || !r.en) bad.push(`wiersz ${r.line}: puste PL albo EN`);
    if (!r.pattern) continue;
    try { compile(r.pattern); } catch (e) { bad.push(`wiersz ${r.line} (${r.pl}): ${e.message}`); }
  }
  assert.deepEqual(bad, []);
});

test("słownik: bez powtórzonych PL", async () => {
  const seen = new Map();
  const dup = [];
  for (const r of await glossary()) {
    const k = r.pl.toLowerCase();
    if (seen.has(k)) dup.push(`${r.pl} (wiersze ${seen.get(k)} i ${r.line})`);
    else seen.set(k, r.line);
  }
  assert.deepEqual(dup, []);
});

test("słownik: dwa różne PL z tym samym EN tylko z uwagą „celowo”", async () => {
  const byEn = new Map();
  for (const r of await glossary()) {
    const k = apos(r.en).toLowerCase();
    if (!byEn.has(k)) byEn.set(k, []);
    byEn.get(k).push(r);
  }
  const bad = [];
  for (const [en, rs] of byEn) {
    if (rs.length > 1 && !rs.every((r) => /celowo/i.test(r.note))) bad.push(`${en}: ${rs.map((r) => r.pl).join(", ")}`);
  }
  assert.deepEqual(bad, []);
});

test("słownik: polska nazwa pasująca do wzorca innego wiersza ma w EN jego EN", async () => {
  const rows = await glossary();
  const withPat = rows.filter((r) => r.pattern).map((r) => ({ ...r, re: compile(r.pattern) }));
  const bad = [];
  for (const r of rows) {
    for (const p of withPat) {
      if (p === r || !p.re.test(r.pl)) continue;
      if (!containsTerm(r.en, p.en)) bad.push(`${r.pl} → „${r.en}” nie zawiera „${p.en}” (wiersz ${p.line}: ${p.pl})`);
    }
  }
  assert.deepEqual(bad, []);
});

// Fixture: { "<PL row>": { data: [snippets cut from the Polish data], extra: [alternation forms absent from the data] } }.
test("słownik: każdy wzorzec bez ^…$ łapie prawdziwe formy z danych i formy z obocznością", async () => {
  const rows = await glossary();
  const forms = JSON.parse(await readFile(FORMS, "utf8"));
  const texts = await polishTexts();
  const byPl = new Map(rows.map((r) => [r.pl, r]));
  const bad = [];
  for (const [pl, { data = [], extra = [] }] of Object.entries(forms)) {
    const r = byPl.get(pl);
    if (!r || !r.pattern) { bad.push(`${pl}: brak wiersza ze wzorcem`); continue; }
    const re = compile(r.pattern);
    if (data.length === 0) bad.push(`${pl}: brak form z danych`);
    for (const f of data) {
      if (!texts.some((t) => t.includes(f))) bad.push(`${pl}: „${f}” nie występuje w danych`);
      if (!re.test(f)) bad.push(`${pl}: wzorzec nie łapie „${f}”`);
    }
    for (const f of extra) if (!re.test(f)) bad.push(`${pl}: wzorzec nie łapie „${f}”`);
  }
  for (const r of rows) if (r.pattern && !r.pattern.startsWith("^") && !Object.hasOwn(forms, r.pl)) bad.push(`${r.pl}: wzorzec bez form w ${path.basename(FORMS)} (node tools/i18n/glossary_forms.mjs)`);
  // phrases stay short, so an unrelated edit of the Polish line does not break the fixture
  for (const [pl, { data = [] }] of Object.entries(forms)) for (const f of data) if (f.split(/\s+/).length > 8) bad.push(`${pl}: za długa fraza „${f}”`);
  assert.deepEqual(bad, []);
});

test("nakładka: polski tekst pasujący do wzorca ma w przekładzie EN ze słownika", async () => {
  const dir = dataDir();
  const { bad, pairs } = await violations(dir);
  assert.deepEqual(bad, []);
  const hasOverlay = await stat(path.join(dir, "lang", "en")).then((s) => s.isDirectory(), () => false);
  if (hasOverlay) assert.ok(pairs > 0, "data/lang/en istnieje, a test nie znalazł w nim żadnego wpisu");
});

test("nakładka: test łapie nazwę niezgodną ze słownikiem", async () => {
  const dir = await tmpDir();
  await cp(dataDir(), dir, { recursive: true });
  await rm(path.join(dir, "lang"), { recursive: true, force: true }); // only the overlay written below
  await mkdir(path.join(dir, "lang", "en"), { recursive: true });
  const travel = JSON.parse(await readFile(path.join(dir, "travel.json"), "utf8"));
  const pl = textEntries("travel.json", travel);
  const entry = (p, t) => [p, { t, h: hashText(pl.get(p)) }];
  await writeFile(path.join(dir, "lang", "en", "travel.json"), JSON.stringify(Object.fromEntries([
    entry("locations.[wilczy_brod].short", "Wolfford"),
    entry("locations.[brzezina].short", "Birchgrove"),
  ])));
  const { bad, pairs } = await violations(dir);
  assert.equal(pairs, 2);
  assert.deepEqual(bad, ["travel.json › locations.[wilczy_brod].short: brak „Wolf's Ford” (Wilczy Bród)"]);
});

test("nakładka: tytuł zadania może mieć inne wielkie litery niż słownik, ale nie inną nazwę", async () => {
  const dir = await tmpDir();
  await cp(dataDir(), dir, { recursive: true });
  await rm(path.join(dir, "lang"), { recursive: true, force: true });
  await mkdir(path.join(dir, "lang", "en"), { recursive: true });
  const quests = JSON.parse(await readFile(path.join(dir, "quests.json"), "utf8"));
  const pl = textEntries("quests.json", quests);
  const entry = (p, t) => [p, { t, h: hashText(pl.get(p)) }];
  await writeFile(path.join(dir, "lang", "en", "quests.json"), JSON.stringify(Object.fromEntries([
    entry("[szara_trzcina].name", "Grey Reed"), // Title Case of the item "Grey reed": fine
    entry("[notatnik_ucznia].name", "The Apprentice's Diary"), // another name: caught
    entry("[szara_trzcina].description", "Dobrawa needs Grey Reed from the Greywater Marshes."), // not a title: no pattern row hits it
    entry("[wilcza_nora].name", "wolf's den"), // a title in lower case still names the place
    entry("[przyjecie_w_osadzie].objectives.[izba].text", "Rent a room at the Dead Cockerel."), // prose keeps the case rule
  ])));
  const { bad, pairs } = await violations(dir);
  assert.equal(pairs, 5);
  assert.deepEqual(bad, ["quests.json › [notatnik_ucznia].name: brak „Apprentice's notebook” (Kajet ucznia)"]);
});

test("containsTerm: całe słowa, końcówki s/'s, wielkość liter przy nazwach własnych", () => {
  assert.ok(containsTerm("the Wolf's Ford road", "Wolf's Ford"));
  assert.ok(containsTerm("Wolf’s Ford", "Wolf's Ford"));
  assert.ok(containsTerm("three Jarnowians", "Jarnowian"));
  assert.ok(containsTerm("the Islanders' Forges", "islander"));
  assert.ok(containsTerm("The Being speaks", "the Being"));
  assert.ok(containsTerm("Imperial scouts", "imperial scout"));
  assert.ok(!containsTerm("a being speaks", "the Being"));
  assert.ok(!containsTerm("my mother", "Mother"));
  assert.ok(!containsTerm("five groats", "gr"));
  assert.ok(containsTerm("(20 gr)", "gr"));
  assert.ok(!containsTerm("Starwatch", "star"));
  assert.ok(!containsTerm("wraithlike", "wraith"));
  assert.ok(containsTerm("the tribute parties", "tribute party"));
  assert.ok(containsTerm("two wolves", "wolf"));
  assert.ok(containsTerm("three fishermen", "fisherman"));
  assert.ok(!containsTerm("partying", "party"));
});

test("stemRegex: łapie formy z obocznością niezależnie od wzorca", () => {
  const hits = (name, text) => [...text.matchAll(stemRegex(name))].map((m) => m[0]);
  assert.deepEqual(hits("Łysa Skała", "na Łysej Skale, nie na łysej skale"), ["Łysej Skale", "łysej skale"]);
  assert.deepEqual(hits("Mgła Ciszy", "w Mgle Ciszy"), ["Mgle Ciszy"]);
  assert.deepEqual(hits("Wilczy Bród", "pod Wilczym Brodem"), ["Wilczym Brodem"]);
  assert.deepEqual(hits("Mruk", "z Mrukowymi pchłami"), ["Mrukowymi"]);
});

test("parser słownika: komórki, \\| i błędy formatu", () => {
  const ok = ["| PL | EN | wzorzec PL | uwagi |", "|---|---|---|---|", "| Wilczy Bród | Wolf's Ford | `Wilczy Bród\\|Wilczego Brodu` | x |", "| Bez | wzorca |  |  |"].join("\n");
  assert.deepEqual(parseGlossary(ok).map(({ pl, en, pattern, note }) => ({ pl, en, pattern, note })), [
    { pl: "Wilczy Bród", en: "Wolf's Ford", pattern: "Wilczy Bród|Wilczego Brodu", note: "x" },
    { pl: "Bez", en: "wzorca", pattern: "", note: "" },
  ]);
  const table = (head, row) => [head, "|---|---|---|---|", row].join("\n");
  const head = "| PL | EN | wzorzec PL | uwagi |";
  assert.throws(() => parseGlossary(table("| PL | EN | wzorzec | uwagi |", "| a | b | `c` | d |")), /zły nagłówek/);
  assert.throws(() => parseGlossary(table("| Pl | EN | wzorzec PL | uwagi |", "| a | b | `c` | d |")), /zły nagłówek/);
  assert.throws(() => parseGlossary(table("| inna | tabela | bez | nagłówka |", "| a | b | c | d |")), /zły nagłówek/);
  assert.throws(() => parseGlossary(table(head, "| a | b | `c` |")), /3 komórek/);
  assert.throws(() => parseGlossary(table(head, "| a | b | c | d |")), /jednym `…`/);
  assert.throws(() => parseGlossary(table(head, "| a | b | `c`d` | e |")), /jednym `…`/);
  assert.throws(() => parseGlossary(table(head, "| a | b | `^c` | d |")), /kończyć się \$/);
});
