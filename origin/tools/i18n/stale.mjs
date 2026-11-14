// Stale translations: overlay entries whose Polish text changed after they were translated.
//
//   node tools/i18n/stale.mjs [--dir <data>] [--lang en]
//
// For each one prints the Polish text the translation was made from, the current Polish text and the current
// translation. The old text is found by walking `git log` of the Polish file and hashing the value at that path in
// each revision until one matches the entry's `h`; without git, or with no match, it reads "(nie znaleziono)".
import { execFileSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { loadData } from "../../src/engine/data.js";
import { dataDir } from "../../src/config.js";
import { textEntries, checkOverlay, hashText } from "../../src/i18n/overlay.js";
import { textFiles } from "../../src/i18n/scope.js";
import { readOverlay } from "./extract.mjs";

export const NOT_FOUND = "(nie znaleziono)";

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

/** Text entries of `file` in each git revision, newest first, read lazily; empty when git or the history is unavailable. */
function* revisions(dir, file) {
  let root, rel, shas;
  try {
    root = git(dir, ["rev-parse", "--show-toplevel"]).trim();
    rel = path.relative(root, path.join(dir, file)).split(path.sep).join("/");
    shas = git(root, ["log", "--format=%H", "--", rel]).split("\n").filter(Boolean);
  } catch {
    return;
  }
  for (const sha of shas) {
    try {
      yield textEntries(file, JSON.parse(git(root, ["show", `${sha}:${rel}`])));
    } catch {
      // a revision where the file was missing or broken
    }
  }
}

/** The Polish text at `p` whose hash is `h`, from the git history of `file`; null when not found. */
function oldText(cache, dir, file, p, h) {
  if (!cache.has(file)) cache.set(file, { iter: revisions(dir, file), seen: [] });
  const c = cache.get(file);
  const match = (entries) => {
    const v = entries.get(p);
    return typeof v === "string" && hashText(v) === h ? v : null;
  };
  for (const entries of c.seen) {
    const v = match(entries);
    if (v !== null) return v;
  }
  for (let r = c.iter.next(); !r.done; r = c.iter.next()) {
    c.seen.push(r.value);
    const v = match(r.value);
    if (v !== null) return v;
  }
  return null;
}

/** `[{ file, path, old, pl, en }]` for every stale overlay entry (`old` is NOT_FOUND when the history has no match). */
export async function staleReport({ dir = dataDir(), lang = "en" } = {}) {
  const data = await loadData(dir);
  const out = [];
  const cache = new Map();
  for (const { file, json } of textFiles(data)) {
    if (json === undefined) continue;
    const overlay = await readOverlay(`lang/${lang}/${file}`, path.join(dir, "lang", lang, file));
    const entries = textEntries(file, json);
    for (const p of checkOverlay(file, json, overlay).stale) {
      out.push({ file, path: p, old: oldText(cache, dir, file, p, overlay[p].h) ?? NOT_FOUND, pl: entries.get(p), en: overlay[p].t });
    }
  }
  return out;
}

async function cli(argv) {
  const { values } = parseArgs({ args: argv, options: { dir: { type: "string" }, lang: { type: "string" } } });
  const list = await staleReport({ dir: values.dir, lang: values.lang });
  for (const e of list) {
    process.stdout.write(`${e.file} › ${e.path}\n  było: ${e.old}\n  jest: ${e.pl}\n  przekład: ${e.en}\n\n`);
  }
  process.stdout.write(`nieaktualne: ${list.length}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  cli(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 1;
  });
}
