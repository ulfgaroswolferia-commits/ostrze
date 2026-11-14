// Worklist of what is left to translate: missing, stale and blank entries of one scope.
//
//   node tools/i18n/extract.mjs [--scope akt1] [--kind story|dialogues|travel|quests|maps|all] [--out <file>] [--dir <data>] [--lang en]
//
// Prints (or writes to --out) a JSON array `[{ file, path, pl, en: "" }]` in file order, then data order
// (files as loadData reads them, entries in file order) so a scene reads top to bottom. A map is one entry with
// path "" and the whole Polish map in `pl`. Fill `en`, then run apply.mjs.
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { loadData } from "../../src/engine/data.js";
import { dataDir } from "../../src/config.js";
import { textEntries, checkOverlay } from "../../src/i18n/overlay.js";
import { SCOPES, scopeOf, textFiles } from "../../src/i18n/scope.js";

export const KINDS = ["story", "dialogues", "travel", "quests", "maps", "all"];
const KIND_OF = (file) => (file.startsWith("dialogues/") ? "dialogues" : file.startsWith("maps/") ? "maps" : file.slice(0, -".json".length));

const exists = (p) => fs.stat(p).then(() => true, () => false);

/**
 * Entries another tool writes: the _u1/_u2 items of items.json belong to tools/upgrades/generate.mjs (name and
 * suffix from the glossary, description from the base item's translation), so they are never on a worklist.
 */
export const isGenerated = (file, p) => file === "items.json" && /^\[[^\]]+_u[12]\]\./.test(p);

/** Reads an overlay file: {} when absent; throws Error with a Polish message when broken. */
export async function readOverlay(file, abs) {
  let text;
  try {
    text = await fs.readFile(abs, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw new Error(`${file}: ${e.message}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`${file}: niepoprawny JSON (${e.message})`);
  }
  if (json === null || typeof json !== "object" || Array.isArray(json)) throw new Error(`${file}: oczekiwano obiektu`);
  return json;
}

/** The worklist for `scope` ("all" or a scope name) and `kind`. */
export async function extract({ dir = dataDir(), lang = "en", scope = "all", kind = "all" } = {}) {
  if (scope !== "all" && !SCOPES.includes(scope)) throw new Error(`--scope: nieznany zakres "${scope}" (dostępne: all, ${SCOPES.join(", ")})`);
  if (!KINDS.includes(kind)) throw new Error(`--kind: nieznany rodzaj "${kind}" (dostępne: ${KINDS.join(", ")})`);
  const data = await loadData(dir);
  const scopes = scopeOf(data);
  const base = path.join(dir, "lang", lang);
  const inScope = (key) => scope === "all" || scopes.get(key) === scope;
  const out = [];
  for (const { file, json, text } of textFiles(data)) {
    if (kind !== "all" && KIND_OF(file) !== kind) continue;
    if (json === undefined) {
      if (inScope(`${file}|`) && !(await exists(path.join(base, file)))) out.push({ file, path: "", pl: text, en: "" });
      continue;
    }
    const r = checkOverlay(file, json, await readOverlay(`lang/${lang}/${file}`, path.join(base, file)));
    const todo = new Set([...r.missing, ...r.stale, ...r.empty]);
    for (const [p, pl] of textEntries(file, json)) {
      if (todo.has(p) && !isGenerated(file, p) && inScope(`${file}|${p}`)) out.push({ file, path: p, pl, en: "" });
    }
  }
  return out;
}

/** Pretty-printed worklist: 2-space indent, one object per entry. */
export const formatWorklist = (list) => `${JSON.stringify(list, null, 2)}\n`;

async function cli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { scope: { type: "string" }, kind: { type: "string" }, out: { type: "string" }, dir: { type: "string" }, lang: { type: "string" } },
  });
  const list = await extract({ dir: values.dir, lang: values.lang, scope: values.scope, kind: values.kind });
  if (values.out) {
    await fs.writeFile(values.out, formatWorklist(list));
    process.stderr.write(`${values.out}: ${list.length} wpisów\n`);
  } else {
    process.stdout.write(formatWorklist(list));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  cli(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 1;
  });
}
