import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { cp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { main } from "../src/cli.js";
import { dataDir } from "../src/config.js";
import { spawn } from "node:child_process";
import { tmpDir, createAdaptiveIO, endAfterFirstDay } from "./helpers.js";
import { runApp } from "../src/app.js";
import { loadData } from "../src/engine/data.js";
import { InputExhaustedError } from "../src/ui/io.js";

let out, err, deps, saved;
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

test("--validate na prawdziwych danych → 0", async () => {
  assert.equal(await main(["--validate"], deps), 0);
  assert.match(out.join("\n"), /Dane poprawne\./);
});

test("--validate na zepsutej kopii → 1 i czytelny błąd", async () => {
  const dir = await tmpDir();
  await cp(dataDir(), dir, { recursive: true });
  const file = path.join(dir, "story.json");
  const story = JSON.parse(await readFile(file, "utf8"));
  story.scenes[0].goto = "nie_ma";
  await writeFile(file, JSON.stringify(story));
  process.env.OSTRZE_DATA = dir;
  assert.equal(await main(["--validate"], deps), 1);
  assert.match(err.join("\n"), /story\.json › prolog_wstep › goto: nieznana scena "nie_ma"/);
});

for (const argv of [["--seed", "abc"], ["--seed", "-1"], ["--seed", "4294967296"], ["--scene", "nie_ma"], ["--bzdura"]]) {
  test(`błędne argumenty ${argv.join(" ")} → 1 bez stosu`, async () => {
    assert.equal(await main(argv, deps), 1);
    assert.ok(err.length > 0);
    assert.doesNotMatch(err.join("\n"), /\n\s+at /);
  });
}

test("--help → 0", async () => {
  assert.equal(await main(["--help"], deps), 0);
  assert.ok(out.join("").length > 0);
  assert.doesNotMatch(out.join(""), /\[\[/);
});

test("proces potomny z potoku: całe demo z odpowiedziami naraz → kod 0 i zakończenie", async () => {
  // The adaptive driver plays the demo in-process at seed 7 (every fight won, the trip included); its recorded answers, fights included,
  // are then piped to the child at once with the same seed, which replays the same game.
  const plan = ["1", "", "", "", "Thorgniew", "1", "1++", "2+", "3++", "8", "7", "9", "12", "1", "", { fight: "win" }, "", "",
    "1+++", "2+++", "12", "5", "", "5", "", "2", "", "", "5", "", "3", "4", "", "", { trip: { fight: "win" } }, "", "1", "4", "9", "1", { expose: "2" }, "1+++", "2", "", "", "4"];
  const driven = createAdaptiveIO(plan);
  const { lastState } = await runApp({ data: endAfterFirstDay(await loadData()), io: driven, options: { debug: false, seed: 7 } });
  assert.equal(lastState.scene.id, "demo_koniec");
  await assert.rejects(driven.ask("?"), InputExhaustedError); // every planned input was consumed
  const answers = driven.answers();
  const script = path.join(import.meta.dirname, "..", "bin", "game.js");
  const child = spawn(process.execPath, [script, "--seed", "7"], {
    env: { ...process.env, OSTRZE_HOME: await tmpDir() },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => { stdout += d; });
  child.stderr.on("data", (d) => { stderr += d; });
  child.stdin.end(answers.join("\n") + "\n");
  const code = await new Promise((resolve) => child.on("close", resolve));
  assert.equal(code, 0, stderr);
  assert.match(stdout, /Zapada zmierzch\./);
  assert.doesNotMatch(stdout, /koniec\s+dostępnej\s+opowieści/, "prawdziwa gra po zamknięciu dnia wraca na mapę, nie kończy się");
  assert.match(stdout, /Wilczy Bród/);
});

test("--art <id> drukuje obraz i kończy kodem 0; nieznane id → 1", async () => {
  assert.equal(await main(["--art", "bandyta"], deps), 0);
  assert.ok(out.join("\n").trim().length > 0);
  out.length = 0;
  assert.equal(await main(["--art", "nie_ma"], deps), 1);
  assert.match(err.join("\n"), /--art: nieznana grafika "nie_ma"/);
});
