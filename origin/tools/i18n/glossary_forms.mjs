// Rebuilds test/fixtures/glossary_forms.json from the Polish data and reports pattern gaps.
//
//   node tools/i18n/glossary_forms.mjs [--dir <data>] [--quiet]
//
// For every glossary row with a free pattern (not ^…$):
// - `data`: short phrases cut from the Polish data where the row's pattern matches (the match itself, plus at
//   most two words before and one after when the pattern needs that context), one per distinct form;
// - `extra`: hand-written alternation forms that do not occur in the data (kept from the existing fixture).
//
// The gap report is independent of the patterns: it builds a loose stem regex from the row's Polish name
// (each word cut to its stem, any ending) and prints every phrase in the data that the stem regex finds but the
// row's pattern does not match. Review these: each is either a missing inflected form (fix the pattern) or a
// different meaning the pattern leaves out on purpose.
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadData } from "../../src/engine/data.js";
import { dataDir } from "../../src/config.js";
import { textEntries } from "../../src/i18n/overlay.js";
import { textFiles } from "../../src/i18n/scope.js";
import { parseGlossary, compile } from "./glossary.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const GLOSSARY = path.join(ROOT, "docs", "i18n", "slownik-en.md");
export const FIXTURE = path.join(ROOT, "test", "fixtures", "glossary_forms.json");
const MAX_FORMS = 8;
const STOP = new Set(["na", "nad", "pod", "przez", "przy", "do", "od", "po", "za", "ze", "z", "w", "we", "i", "ku", "dla", "bez", "o", "u"]);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every Polish text of the data: JSON text fields, dialogues and maps. */
export async function polishTexts(dir = dataDir()) {
  const data = await loadData(dir);
  const out = [];
  for (const f of textFiles(data)) {
    if (f.text !== undefined) out.push(f.text);
    else out.push(...textEntries(f.file, f.json).values());
  }
  return out;
}

// Loose stem regex for a Polish name: "Łysa Skała" matches "Łysej Skale", "łysą skałę" (each word cut to its stem,
// any ending, first letter in either case; short stop words stay literal).
export function stemRegex(name) {
  const word = (w) => {
    const low = w.toLowerCase();
    if (STOP.has(low)) return `[${w[0].toUpperCase()}${w[0].toLowerCase()}]${escRe(w.slice(1))}`;
    // short words keep 2 letters, 4-letter words 3, longer ones lose the last 3 (room for k/c, ł/l, ó/o alternations)
    const stem = w.length <= 3 ? w.slice(0, 2) : w.length === 4 ? w.slice(0, 3) : w.slice(0, Math.max(3, w.length - 3));
    const alt = (s) => escRe(s).replace(/ó/g, "[óo]").replace(/ł/g, "[łl]").replace(/ą/g, "[ąę]");
    return `[${stem[0].toUpperCase()}${stem[0].toLowerCase()}]${alt(stem.slice(1))}\\p{L}*`;
  };
  const src = name.replace(/\p{L}+/gu, (w) => `\u0000${w}\u0001`).split(/(\u0000[^\u0001]*\u0001)/u)
    .map((part) => (part.startsWith("\u0000") ? word(part.slice(1, -1)) : escRe(part).replace(/\s+/g, "\\s+")))
    .join("");
  return new RegExp(`(?<!\\p{L})${src}(?!\\p{L})`, "gu");
}

/** The Polish names a row stands for: its PL cell without notes in brackets, split on " / ". */
export const rowNames = (pl) => pl.replace(/\s*\([^)]*\)/g, "").split(" / ").map((s) => s.trim()).filter(Boolean);

/** The shortest phrase around a match (up to 2 words before and 1 after) that the pattern still matches. */
function phrase(text, m, re) {
  const start = m.index, end = m.index + m[0].length;
  const head = text.slice(0, start);
  const tail = text.slice(end);
  // candidate starts: the match, then back over characters glued to it, then over up to two whole words
  const glued = head.match(/\S*$/u)[0];
  const words = head.slice(0, head.length - glued.length).match(/(?:\S+\s+){0,2}$/u)[0].split(/(?<=\s)/u).filter(Boolean);
  const befores = ["", glued];
  for (let b = 1; b <= words.length; b++) befores.push(words.slice(words.length - b).join("") + glued);
  const gluedAfter = tail.match(/^\S*/u)[0];
  const afters = ["", gluedAfter, tail.match(/^\S*\s+\S+/u)?.[0] ?? gluedAfter];
  const tries = [];
  for (const b of befores) for (const a of afters) tries.push(b + m[0] + a);
  tries.sort((x, y) => x.length - y.length);
  return tries.find((t) => re.test(t)) ?? null;
}

export async function buildForms({ dir = dataDir(), glossary = GLOSSARY, fixture = FIXTURE } = {}) {
  const rows = parseGlossary(await fs.readFile(glossary, "utf8"));
  const texts = await polishTexts(dir);
  let old = {};
  try { old = JSON.parse(await fs.readFile(fixture, "utf8")); } catch { old = {}; }
  const out = {};
  const gaps = [];
  for (const r of rows) {
    if (!r.pattern || r.pattern.startsWith("^")) continue;
    const g = compile(r.pattern, "gu");
    const one = compile(r.pattern);
    const forms = new Map();
    for (const t of texts) {
      for (const m of t.matchAll(g)) {
        if (forms.size >= MAX_FORMS) break;
        if (forms.has(m[0])) continue;
        const p = phrase(t, m, one);
        if (p) forms.set(m[0], p);
      }
    }
    const extra = (old[r.pl]?.extra ?? []).filter((f) => !texts.some((t) => t.includes(f)));
    out[r.pl] = extra.length > 0 ? { data: [...forms.values()], extra } : { data: [...forms.values()] };

    const missed = new Map();
    for (const name of rowNames(r.pl)) {
      const s = stemRegex(name);
      for (const t of texts) {
        for (const m of t.matchAll(s)) {
          const ctx = t.slice(Math.max(0, m.index - 25), m.index + m[0].length + 15);
          const hitsPattern = [...t.matchAll(g)].some((x) => x.index < m.index + m[0].length && m.index < x.index + x[0].length);
          if (!hitsPattern) missed.set(m[0], { n: (missed.get(m[0])?.n ?? 0) + 1, ctx });
        }
      }
    }
    if (missed.size > 0) gaps.push({ pl: r.pl, missed: [...missed].map(([form, { n, ctx }]) => ({ form, n, ctx })) });
  }
  return { forms: out, gaps };
}

async function main() {
  const { values } = parseArgs({ options: { dir: { type: "string" }, quiet: { type: "boolean" } } });
  const { forms, gaps } = await buildForms({ dir: values.dir ?? dataDir() });
  await fs.mkdir(path.dirname(FIXTURE), { recursive: true });
  await fs.writeFile(FIXTURE, `${JSON.stringify(forms, null, 1)}\n`);
  const empty = Object.entries(forms).filter(([, v]) => v.data.length === 0).map(([k]) => k);
  console.log(`Zapisano ${path.relative(ROOT, FIXTURE)}: ${Object.keys(forms).length} wierszy.`);
  if (empty.length > 0) console.log(`Wzorce bez trafień w danych: ${empty.join("; ")}`);
  if (values.quiet) return;
  console.log(`\nTrafienia rdzenia, których wzorzec nie łapie (${gaps.length} wierszy):`);
  for (const { pl, missed } of gaps) {
    console.log(`\n## ${pl}`);
    for (const { form, n, ctx } of missed) console.log(`  ${form} (${n}) … ${ctx.replace(/\s+/g, " ")} …`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
