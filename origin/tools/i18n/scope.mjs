// Translation scopes (which act each text entry belongs to). The table and the rules live in src/i18n/scope.js,
// because `--validate --strict --scope <name>` needs them in the shipped game; this module re-exports them.
//
//   node tools/i18n/scope.mjs [--dir <data>]    prints the entry count per scope and per file
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { loadData } from "../../src/engine/data.js";
import { dataDir } from "../../src/config.js";
import { scopeOf, scopeCounts, SCOPES } from "../../src/i18n/scope.js";

export * from "../../src/i18n/scope.js";

async function cli(argv) {
  const { values } = parseArgs({ args: argv, options: { dir: { type: "string" } } });
  const scopes = scopeOf(await loadData(values.dir ?? dataDir()));
  for (const [scope, n] of Object.entries(scopeCounts(scopes))) process.stdout.write(`${scope}: ${n}\n`);
  const perFile = new Map();
  for (const [key, scope] of scopes) {
    const file = key.slice(0, key.indexOf("|"));
    const group = file.startsWith("dialogues/") ? "dialogues/*" : file.startsWith("maps/") ? "maps/*" : file;
    if (!perFile.has(group)) perFile.set(group, Object.fromEntries(SCOPES.map((s) => [s, 0])));
    perFile.get(group)[scope]++;
  }
  process.stdout.write("\n");
  for (const [group, n] of perFile) {
    process.stdout.write(`${group}: ${SCOPES.filter((s) => n[s] > 0).map((s) => `${s} ${n[s]}`).join(", ")}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  cli(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`${e.message}\n`);
    process.exitCode = 1;
  });
}
