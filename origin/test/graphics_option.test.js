import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { grayLines } from "../src/ui/pixels.js";
import { graphicsMode, setGraphics, setColorsEnabled, setRich256 } from "../src/ui/colors.js";
import { loadGraphics, saveGraphics } from "../src/config.js";
import { loadData } from "../src/engine/data.js";
import { createScriptedIO } from "../src/ui/io.js";
import { runApp } from "../src/app.js";
import { main } from "../src/cli.js";
import { getGraphics } from "../src/ui/colors.js";

let prevHome;
let home;
beforeEach(() => {
  prevHome = process.env.OSTRZE_HOME;
  home = fs.mkdtempSync(path.join(os.tmpdir(), "ostrze-graphics-"));
  process.env.OSTRZE_HOME = home;
});
afterEach(() => {
  if (prevHome === undefined) delete process.env.OSTRZE_HOME;
  else process.env.OSTRZE_HOME = prevHome;
  fs.rmSync(home, { recursive: true, force: true });
  setGraphics("color");
  setColorsEnabled(false);
  setRich256(null);
});

test("szarość: kody kolorów idą na skalę szarości, czerń i biel zostają czyste, znaki bez zmian", () => {
  assert.deepEqual(grayLines(["\x1b[38;5;16m\x1b[48;5;231m▀\x1b[0m"]), ["\x1b[38;5;16m\x1b[48;5;231m▀\x1b[0m"]);
  const [line] = grayLines(["\x1b[38;5;196m\x1b[48;5;28m▀\x1b[0m tekst"]);
  const codes = [...line.matchAll(/\x1b\[(?:38|48);5;(\d+)m/g)].map((m) => Number(m[1]));
  assert.equal(codes.length, 2);
  for (const c of codes) assert.ok(c >= 232 && c <= 255, `kod ${c}`);
  assert.ok(line.endsWith("▀\x1b[0m tekst"));
});

test("terminal z 256 kolorami: tryb grafik to wybór gracza", () => {
  setColorsEnabled(true);
  setRich256(true);
  for (const mode of ["color", "gray", "none"]) {
    setGraphics(mode);
    assert.equal(graphicsMode(), mode);
  }
});

test("terminal bez 256 kolorów albo NO_COLOR: grafik nie ma niezależnie od wyboru", () => {
  setGraphics("color");
  setColorsEnabled(true);
  setRich256(false);
  assert.equal(graphicsMode(), "none");
  setRich256(true);
  setColorsEnabled(false);
  assert.equal(graphicsMode(), "none");
});

test("wybór przeżywa ponowne uruchomienie: zapis do config.json w katalogu gry", () => {
  saveGraphics("gray");
  assert.equal(loadGraphics(), "gray");
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, "config.json"), "utf8")).graphics, "gray");
});

test("zapis grafik nie kasuje innych ustawień w pliku", () => {
  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ inne: 1 }));
  saveGraphics("none");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, "config.json"), "utf8")), { inne: 1, graphics: "none" });
});

test("brak pliku, uszkodzony plik albo nieznana wartość: domyślnie kolorowe", () => {
  assert.equal(loadGraphics(), "color");
  fs.writeFileSync(path.join(home, "config.json"), "{ to nie json");
  assert.equal(loadGraphics(), "color");
  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ graphics: "neon" }));
  assert.equal(loadGraphics(), "color");
});

test("uszkodzony plik nie blokuje zapisu nowego wyboru", () => {
  fs.writeFileSync(path.join(home, "config.json"), "{ to nie json");
  saveGraphics("gray");
  assert.equal(loadGraphics(), "gray");
});

const menuRun = async (keys) => {
  const io = createScriptedIO(keys, { tty: true });
  Object.assign(io, { columns: 120, rows: 40 });
  await runApp({ data: await loadData(), io, options: { debug: false, seed: 7 } });
  return io.output.join("");
};
const strip = (s) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
const on256 = () => { setColorsEnabled(true); setRich256(true); };

test("menu główne: Enter na „Grafiki” przełącza kolorowe → czarno-białe → bez grafik → kolorowe i zapisuje wybór", async () => {
  on256();
  const text = strip(await menuRun(["3", "3", "3", "5"]));
  for (const label of ["Grafiki: kolorowe", "Grafiki: czarno-białe", "Grafiki: bez grafik"]) assert.ok(text.includes(label), label);
  assert.equal(getGraphics(), "color");
  assert.equal(loadGraphics(), "color");
  await menuRun(["3", "5"]);
  assert.equal(loadGraphics(), "gray");
});

test("ekran startowy: w szarości bez kolorowych pikseli, bez grafik sam napis, ramka zawsze zielona", async () => {
  on256();
  const scene = (raw) => [...raw.matchAll(/\x1b\[48;5;(\d+)m/g)].map((m) => Number(m[1]));
  setGraphics("color");
  const colour = await menuRun(["5"]);
  assert.ok(scene(colour).some((c) => c >= 17 && c < 232), "obraz w kolorze");
  setGraphics("gray");
  const gray = await menuRun(["5"]);
  assert.deepEqual(scene(gray).filter((c) => !(c === 16 || c === 231 || c >= 232)), []);
  assert.ok(scene(gray).length > 0);
  assert.ok(gray.includes("\x1b[38;5;28m"), "ramka");
  setGraphics("none");
  const none = await menuRun(["5"]);
  assert.equal(scene(none).length, 0);
  assert.ok(strip(none).includes("V O I D E D"));
  assert.ok(none.includes("\x1b[38;5;28m"), "ramka");
});

test("terminal bez 256 kolorów: „Grafiki: niedostępne”, nie da się wybrać, nic się nie zapisuje", async () => {
  setColorsEnabled(true);
  setRich256(false);
  const text = strip(await menuRun(["3", "5"]));
  assert.ok(text.includes("Grafiki: niedostępne"));
  assert.ok(!fs.existsSync(path.join(home, "config.json")));
});

test("nieudany zapis: komunikat, wybór działa do końca gry", async () => {
  on256();
  fs.mkdirSync(path.join(home, "config.json")); // a directory where the file should be
  const text = strip(await menuRun(["3", "5"]));
  assert.ok(text.includes("Nie udało się zapisać ustawienia grafik"));
  assert.equal(getGraphics(), "gray");
});

test("tryb liniowy nie ma pozycji „Grafiki”: Wyjście zostaje ostatnie, pod 4", async () => {
  const io = createScriptedIO(["4"]);
  await runApp({ data: await loadData(), io, options: { debug: false, seed: 7 } });
  assert.ok(!io.output.join("").includes("Grafiki"));
});

test("start gry wczytuje zapisany wybór", async () => {
  saveGraphics("none");
  const io = createScriptedIO(["4"]);
  assert.equal(await main([], { io, stdout: () => {}, stderr: () => {} }), 0);
  assert.equal(getGraphics(), "none");
});
