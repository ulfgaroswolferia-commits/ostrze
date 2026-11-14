import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { homeDir, savesDir, dataDir, GAME_VERSION } from "../src/config.js";

test("homeDir i dataDir respektują zmienne środowiskowe w chwili wywołania", () => {
  process.env.OSTRZE_HOME = "/tmp/x"; assert.equal(homeDir(), "/tmp/x");
  assert.equal(savesDir(), path.join("/tmp/x", "saves"));
  delete process.env.OSTRZE_HOME; assert.equal(homeDir(), path.join(os.homedir(), ".ostrze"));
  process.env.OSTRZE_DATA = "/d"; assert.equal(dataDir(), "/d"); delete process.env.OSTRZE_DATA;
  assert.ok(dataDir().endsWith(`${path.sep}data`));
});
test("GAME_VERSION pochodzi z package.json", () => assert.equal(GAME_VERSION, JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version));
