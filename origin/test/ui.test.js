import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const UI = JSON.parse(readFileSync(new URL("data/ui.json", root), "utf8"));

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(join(dir, e.name)) : e.name.endsWith(".js") ? [join(dir, e.name)] : []);
}

test("każdy klucz t(ui, \"…\") użyty w src/ istnieje w ui.json", () => {
  const re = /\bt\(\s*[\w.]+\s*,\s*["']([\w.]+)["']/g;
  const missing = new Set();
  for (const file of jsFiles(fileURLToPath(new URL("src", root)))) {
    for (const m of readFileSync(file, "utf8").matchAll(re)) {
      if (!(m[1] in UI)) missing.add(`${m[1]} (${file})`);
    }
  }
  assert.deepEqual([...missing], []);
});
