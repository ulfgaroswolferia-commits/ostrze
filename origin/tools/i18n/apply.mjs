// Puts a filled worklist (from extract.mjs) into the overlay.
//
//   node tools/i18n/apply.mjs <worklist.json> [--dir <data>] [--lang en]
//
// Entries with a non-empty `en` go into data/lang/<lang>/<file> as { t: en, h: hash of the current Polish text };
// entries with an empty `en` are skipped. The whole worklist is checked first and nothing is written when any entry
// is wrong: unknown file or path, `pl` no longer equal to the current Polish text (extract again), {variables} or map
// {id} markers that differ from the Polish, a duplicate entry, or a broken overlay file. Existing overlay entries are
// updated in place and the file stays sorted by path, one entry per line.
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { loadData, mapTokens } from "../../src/engine/data.js";
import { dataDir } from "../../src/config.js";
import { textEntries, checkOverlay, hashText } from "../../src/i18n/overlay.js";
import { textFiles } from "../../src/i18n/scope.js";
import { readOverlay } from "./extract.mjs";

/** Overlay JSON: sorted by path, one entry per line. */
export function formatOverlay(overlay) {
  const keys = Object.keys(overlay).sort();
  if (keys.length === 0) return "{}\n";
  return `{\n${keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(overlay[k])}`).join(",\n")}\n}\n`;
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Checks `worklist` and, when it is all valid, writes it. Resolves with `{ errors, written, skipped, files }`:
 * with errors nothing was written.
 */
export async function apply(worklist, { dir = dataDir(), lang = "en" } = {}) {
  const errors = [];
  if (!Array.isArray(worklist)) return { errors: ["lista: oczekiwano tablicy wpisów"], written: 0, skipped: 0, files: [] };
  const data = await loadData(dir);
  const sources = new Map(textFiles(data).map((f) => [f.file, f]));
  const base = path.join(dir, "lang", lang);
  const seen = new Set();
  const byFile = new Map(); // file → [{ path, pl, en }]
  let skipped = 0;
  worklist.forEach((e, i) => {
    const at = `#${i}${isObj(e) && typeof e.file === "string" ? ` ${e.file} › ${e.path}` : ""}`;
    if (!isObj(e) || typeof e.file !== "string" || typeof e.path !== "string" || typeof e.pl !== "string" || typeof e.en !== "string") {
      errors.push(`${at}: oczekiwano { file, path, pl, en } z tekstami`);
      return;
    }
    const src = sources.get(e.file);
    if (!src) {
      errors.push(`${at}: nieznany plik`);
      return;
    }
    const current = src.json === undefined ? (e.path === "" ? src.text : undefined) : textEntries(e.file, src.json).get(e.path);
    if (current === undefined) {
      errors.push(`${at}: ścieżka nie istnieje w danych`);
      return;
    }
    const key = `${e.file}|${e.path}`;
    if (seen.has(key)) {
      errors.push(`${at}: wpis powtórzony`);
      return;
    }
    seen.add(key);
    if (e.pl !== current) {
      errors.push(`${at}: polski tekst zmienił się od wyciągnięcia listy (wyciągnij ją od nowa)`);
      return;
    }
    if (e.en === "") {
      skipped++;
      return;
    }
    if (src.json === undefined && mapTokens(e.en).join() !== mapTokens(current).join()) errors.push(`${at}: znaczniki {id} niezgodne z polską mapą`);
    if (!byFile.has(e.file)) byFile.set(e.file, []);
    byFile.get(e.file).push({ at, path: e.path, pl: current, en: e.en });
  });
  // {variables}: one check per file
  for (const [file, entries] of byFile) {
    const src = sources.get(file);
    if (src.json === undefined) continue;
    const candidate = Object.fromEntries(entries.map((x) => [x.path, { t: x.en, h: hashText(x.pl) }]));
    const bad = new Set(checkOverlay(file, src.json, candidate).varMismatch);
    for (const x of entries) if (bad.has(x.path)) errors.push(`${x.at}: zmienne {…} niezgodne z polskim tekstem`);
  }

  const outputs = [];
  for (const [file, entries] of byFile) {
    const abs = path.join(base, file);
    if (file.startsWith("maps/")) {
      outputs.push({ abs, content: entries[0].en });
      continue;
    }
    let overlay;
    try {
      overlay = await readOverlay(`lang/${lang}/${file}`, abs);
    } catch (e) {
      errors.push(e.message);
      continue;
    }
    for (const { path: p, pl, en } of entries) overlay[p] = { t: en, h: hashText(pl) };
    outputs.push({ abs, content: formatOverlay(overlay) });
  }
  if (errors.length > 0) return { errors, written: 0, skipped, files: [] };

  // everything is checked: write each file through a temporary file, so a crash never leaves half a file
  for (const { abs, content } of outputs) {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(`${abs}.tmp`, content);
    await fs.rename(`${abs}.tmp`, abs);
  }
  const written = [...byFile.values()].reduce((n, l) => n + l.length, 0);
  return { errors, written, skipped, files: [...byFile.keys()] };
}

async function cli(argv) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { dir: { type: "string" }, lang: { type: "string" } } });
  if (positionals.length !== 1) throw new Error("użycie: node tools/i18n/apply.mjs <lista.json> [--dir <dane>] [--lang en]");
  let list;
  try {
    list = JSON.parse(await fs.readFile(positionals[0], "utf8"));
  } catch (e) {
    throw new Error(`${positionals[0]}: ${e instanceof SyntaxError ? `niepoprawny JSON (${e.message})` : e.message}`);
  }
  const r = await apply(list, { dir: values.dir, lang: values.lang });
  if (r.errors.length > 0) {
    for (const e of r.errors) process.stderr.write(`${e}\n`);
    process.stderr.write(`Nic nie zapisano (błędów: ${r.errors.length}).\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Zapisano ${r.written} wpisów w ${r.files.length} plikach, pominięto ${r.skipped} pustych.\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  cli(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 1;
  });
}
