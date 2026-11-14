import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { runApp } from "../src/app.js";
import { loadData } from "../src/engine/data.js";
import { createAdaptiveIO } from "./helpers.js";

// The menu can write settings: keep the player's real ~/.ostrze out of reach.
let savedHome;
beforeEach(async () => {
  savedHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await fs.mkdtemp(path.join(os.tmpdir(), "ostrze-ui-lang-"));
});
afterEach(async () => {
  const dir = process.env.OSTRZE_HOME;
  if (savedHome === undefined) delete process.env.OSTRZE_HOME;
  else process.env.OSTRZE_HOME = savedHome;
  await fs.rm(dir, { recursive: true, force: true });
});

test("ekran startowy bierze teksty ramki z załadowanego ui (nie z domyślnego polskiego)", async () => {
  const data = await loadData();
  const ui = { ...data.ui, "frame.title": "VOIDED: DEFYING THE STARS", "title.tagline": "DEFYING THE STARS" };
  const io = createAdaptiveIO(["5"], { tty: true }); // menu: new, load, graphics, language, exit
  io.columns = 100;
  io.rows = 30;
  await runApp({ data: { ...data, ui }, io, options: { debug: false, seed: 1 } });
  const firstFrame = stripVTControlCharacters(io.output.find((chunk) => chunk.includes("DEFYING THE STARS")) ?? "");
  const topRow = firstFrame.split("\n").find((l) => l.includes("VOIDED"));
  assert.match(topRow, /VOIDED: DEFYING THE STARS/);
  assert.doesNotMatch(io.text(), /NA PRZEKÓR GWIAZDOM/);
});
