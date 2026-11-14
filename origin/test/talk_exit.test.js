import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { PassThrough } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { combatState, tmpDir, createAdaptiveIO } from "./helpers.js";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { evaluate } from "../src/engine/conditions.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { createScriptedIO, createTerminalIO, InputExhaustedError } from "../src/ui/io.js";

const data = await loadData();
const MAP = data.story.scenes.find((s) => s.id === "akt3_mapa");

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function gluszec() {
  const state = createNewState({ seed: 1, startScene: "akt3_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 9 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "gluszec";
  return state;
}

test("Głuszec: „Bywaj” wraca od razu do listy miejsc, bez dodatkowego „Dalej”", async () => {
  const state = gluszec();
  const io = createAdaptiveIO(["Karczma „Pod Zdechłym Kogutem”", "Bywaj.", "Wróć na mapę", "Prześpij noc"].map((pick) => ({ pick })));
  await defaultHandlers.map({ state, data, io, rng: createRng(3), debug: false, notices: [] }, MAP);
  assert.match(stripVTControlCharacters(io.text()), /Mruk/);
});

test("zlecenie od wdowy: odpowiedź pasuje do pytania „Zapytasz za mnie?”", () => {
  const node = data.dialogues.find((d) => d.id === "wdowa").nodes.q9_start;
  assert.match(node.text, /Zapytasz za mnie\?/);
  assert.deepEqual(node.options.map((o) => o.text), ["Zapytam."]);
});

/** Minimal terminal: applies what drawFrame writes (clear, home, row positioning, line erase) and returns the rows on the screen. */
function terminal(raw) {
  let rows = [];
  let y = 0;
  for (const part of raw.split(/(\x1b\[2J\x1b\[3J\x1b\[H|\x1b\[H|\x1b\[\d+;1H|\x1b\[2K)/)) {
    if (part === "\x1b[2J\x1b[3J\x1b[H") { rows = []; y = 0; }
    else if (part === "\x1b[H") y = 0;
    else if (/^\x1b\[\d+;1H$/.test(part)) y = Number(part.slice(2, -3)) - 1;
    else if (part === "\x1b[2K") rows[y] = "";
    else for (const [i, text] of part.split("\n").entries()) {
      if (i > 0) y += 1;
      if (text) rows[y] = text;
    }
  }
  return rows.map(stripVTControlCharacters);
}

async function moveCursorInGluszec(diffFrames) {
  const state = gluszec();
  const io = createScriptedIO(["<down>", "<down>", "<down>"], { tty: true });
  Object.assign(io, { columns: 180, rows: 50, diffFrames });
  await assert.rejects(defaultHandlers.map({ state, data, io, rng: createRng(3), debug: false, notices: [] }, MAP), InputExhaustedError);
  return io.output.join("");
}

test("Głuszec, ruch kursora: bez czyszczenia ekranu, tylko zmienione wiersze, a obraz taki sam jak po pełnym rysowaniu", async () => {
  const diff = await moveCursorInGluszec(true);
  const full = await moveCursorInGluszec(false);
  assert.equal(diff.split("\x1b[2J").length - 1, 2, "ekran czyści tylko wejście na ten ekran (clear i pierwsza klatka)");
  assert.equal(full.split("\x1b[2J").length - 1, 6, "bez aktualizacji wierszy każda klatka czyści ekran");
  assert.ok(diff.length < full.length / 3, `${diff.length} vs ${full.length}`);
  const expected = terminal(full);
  assert.ok(expected.some((row) => row.includes("▶")), "kursor jest na ekranie");
  assert.deepEqual(terminal(diff), expected);
});

/** The rest scene with Kamień Zmierzchu charged to `charge`, worn or in the bag; returns the text up to the first question. */
async function restWithStone(charge, worn = true) {
  const state = gluszec();
  const item = data.items.find((i) => i.id === "kamien_zmierzchu");
  state.inventory.items.push({ id: item.id, qty: 1 });
  if (worn) state.inventory.equipped.talizman = item.id;
  state.artifacts[item.id] = { charge, exposed: false };
  const io = createScriptedIO([]);
  await assert.rejects(defaultHandlers.rest({ state, data, io, rng: createRng(3), debug: false, notices: [] }, { id: "postoj", type: "rest" }), InputExhaustedError);
  return { text: stripVTControlCharacters(io.output.join("")), max: item.charge.max };
}

test("postój: artefakt naładowany do pełna – bez pytania o wystawienie; niepełny – pytanie zostaje", async () => {
  const { max } = await restWithStone(0);
  const asks = data.ui["rest.expose"];
  assert.ok((await restWithStone(0)).text.includes(asks));
  assert.ok((await restWithStone(max - 1)).text.includes(asks));
  assert.ok(!(await restWithStone(max)).text.includes(asks));
  assert.ok(!(await restWithStone(0, false)).text.includes(asks), "artefakt w torbie, nie założony: bez pytania");
});

/** The real terminal IO on fake TTY streams, with the Głuszec screen open; `resize` changes the window and returns what the game wrote. */
async function gluszecWindow(columns, rows) {
  const input = new PassThrough(); input.isTTY = true; input.setRawMode = () => {};
  const output = new PassThrough(); output.isTTY = true; output.columns = columns; output.rows = rows;
  let written = "";
  output.on("data", (chunk) => { written += chunk; });
  const io = createTerminalIO({ input, output });
  const play = defaultHandlers.map({ state: gluszec(), data, io, rng: createRng(3), debug: false, notices: [] }, MAP).catch(() => {});
  await delay(100);
  return {
    opened: written,
    async resize(c, r, burst = 1) {
      written = "";
      output.columns = c; output.rows = r;
      for (let i = 0; i < burst; i++) output.emit("resize");
      await delay(100);
      return written;
    },
    async stop() { io.close(); await play; },
  };
}

test("zmiana rozmiaru okna: gra rysuje od razu, bez ruszania kursorem; w małym oknie nic nie wychodzi poza ekran, wybór widać", async () => {
  const win = await gluszecWindow(180, 50);
  try {
    const small = await win.resize(30, 8);
    const rows = terminal(small);
    assert.ok(small.includes("\x1b[2J"), "czyści stary obraz");
    assert.ok(rows.length <= 7, `${rows.length} wierszy w oknie 8`);
    assert.ok(rows.every((row) => [...row].length < 30), rows.join("\n"));
    assert.ok(rows.some((row) => row.includes("▶")), "kursor widoczny");

    const big = terminal(await win.resize(180, 50));
    assert.equal(big.length, 49, "cała ramka na nowy rozmiar");
    assert.ok(big.some((row) => row.includes("▶")));

    assert.equal(terminal(await win.resize(100, 30)).length, 29);
  } finally { await win.stop(); }
});

test("seria zmian rozmiaru (ciągnięcie okna) daje jedno przerysowanie", async () => {
  const win = await gluszecWindow(120, 40);
  try {
    const raw = await win.resize(121, 40, 5);
    assert.equal(raw.split("\x1b[2J").length - 1, 1);
  } finally { await win.stop(); }
});

test("ramka po zmianie okna wygląda tak samo jak ramka otwarta od razu w tym rozmiarze", async () => {
  const resized = await gluszecWindow(180, 50);
  const fresh = await gluszecWindow(100, 30);
  try {
    const a = terminal(await resized.resize(100, 30));
    assert.deepEqual(a, terminal(fresh.opened));
  } finally { await resized.stop(); await fresh.stop(); }
});

test("ekran otwarty w małym oknie: po powiększeniu dostaje ramkę z kursorem", async () => {
  const win = await gluszecWindow(60, 20);
  try {
    const big = terminal(await win.resize(160, 45));
    assert.equal(big.length, 44);
    assert.ok(big.some((row) => row.includes("▶")));
  } finally { await win.stop(); }
});

test("„Enter – dalej”: zmiana rozmiaru przerysowuje i nie przechodzi dalej", async () => {
  const { pressEnter } = await import("../src/ui/prompt.js");
  const { showScreen } = await import("../src/ui/screen.js");
  const io = createScriptedIO(["<resize>", ""], { tty: true });
  Object.assign(io, { columns: 120, rows: 40 });
  await showScreen({ state: gluszec(), data, io, notices: [] }, { text: "Tekst." });
  io.output.length = 0;
  io.columns = 100; io.rows = 30;
  await pressEnter(io, data.ui);
  assert.equal(terminal(io.output.join("")).length, 29);
});

test("Brygida: „Hieronim kazał mi się z tobą zapoznać” dopiero po rozmowie z Hieronimem", () => {
  const option = data.dialogues.find((d) => d.id === "brygida").nodes.powitanie.options.find((o) => o.id === "poznanie");
  const state = gluszec();
  state.quests.przyjecie_w_obserwatorium = { status: "active", done: [] };
  assert.equal(evaluate(option.requires, state, data), false, "zlecenie aktywne od wejścia, Hieronim jeszcze nie widziany");
  state.flags.hieronim_przyjal = true;
  assert.equal(evaluate(option.requires, state, data), true);
  state.flags.brygida_poznana = true;
  assert.equal(evaluate(option.requires, state, data), false);
});

test("walka: zmiana rozmiaru okna układa ekran na nowo, wrogowie i akcje zostają", async () => {
  const fight = { id: "f", type: "combat", enemies: [{ id: "bandyta", count: 2 }], next: "x" };
  const state = gluszec();
  const io = createScriptedIO(["<resize>", "<resize>"], { tty: true });
  Object.assign(io, { columns: 160, rows: 45 });
  const sizes = [[100, 30], [90, 26]];
  const readKey = io.readKey.bind(io);
  io.readKey = async () => {
    const key = await readKey();
    [io.columns, io.rows] = sizes.shift();
    io.output.length = 0;
    return key;
  };
  await assert.rejects(defaultHandlers.combat({ state, data, io, rng: createRng(3), debug: false, notices: [] }, fight), InputExhaustedError);
  const rows = terminal(io.output.join(""));
  assert.equal(rows.length, 25);
  assert.ok(rows.some((row) => /BANDYTA/.test(row)), rows.join("\n"));
  assert.ok(rows.some((row) => row.includes("[A] Atak")), rows.join("\n"));
  assert.ok(!rows.some((row) => row.includes("▼ dalej")), "tekst walki nie przelewa się na drugą stronę");
});

test("karta postaci w ramce: statystyki i umiejętności w głównym panelu, w kolumnach dobranych do szerokości", async () => {
  const { characterPanels } = await import("../src/ui/character_screen.js");
  const state = gluszec();
  const plain = (lines) => lines.map(stripVTControlCharacters);
  const titles = ["Atrybuty", "Wartości pochodne", "Umiejętności"];

  const wide = plain(characterPanels(state, data, { width: 70 }).main);
  const header = wide.find((l) => l.includes("Atrybuty"));
  for (const title of titles) assert.ok(header.includes(title), header);
  assert.ok(wide.some((l) => /Pancerz +\d+/.test(l)), wide.join("\n"));
  assert.ok(wide.some((l) => l.includes("Redukcja")), wide.join("\n"));

  const medium = plain(characterPanels(state, data, { width: 52 }).main);
  assert.ok(medium.some((l) => l.includes("Atrybuty") && l.includes("Wartości pochodne")), medium.join("\n"));
  assert.ok(medium.some((l) => l.startsWith("Umiejętności")), medium.join("\n"));

  const narrow = plain(characterPanels(state, data, { width: 30 }).main);
  for (const title of titles) assert.ok(narrow.includes(title), title);
  assert.ok(narrow.every((l) => [...l].length <= 30 || l.includes(" – ")), narrow.join("\n"));

  for (const size of [70, 52, 30]) {
    for (const skill of data.skills) assert.ok(plain(characterPanels(state, data, { width: size }).main).some((l) => l.includes(skill.name)), `${size}: ${skill.name}`);
  }
  assert.deepEqual(plain(characterPanels(state, data).side).filter((l) => data.skills.some((s) => l.includes(s.name))), [], "panel boczny bez umiejętności");
});

test("karta postaci: nagłówki sekcji i wiodące umiejętności mają własne kolory, zwykłe umiejętności nie", async () => {
  const { characterPanels } = await import("../src/ui/character_screen.js");
  const { setColorsEnabled, paint } = await import("../src/ui/colors.js");
  setColorsEnabled(true);
  try {
    const state = gluszec();
    state.character.perks = [data.perks[0].id];
    const { main } = characterPanels(state, data, { width: 30 });
    for (const title of ["Atrybuty", "Umiejętności", "Wartości pochodne", "Redukcja", "Perki"]) assert.ok(main.includes(paint("heading", title)), title);
    const [leading] = state.character.tagged;
    const skill = data.skills.find((s) => s.id === leading);
    const row = main.find((l) => stripVTControlCharacters(l).startsWith(`*${skill.name}`));
    assert.notEqual(row, stripVTControlCharacters(row), "wiodąca pokolorowana");
    assert.ok(row.startsWith(paint("leading", "").slice(0, 3)), row);
    const other = data.skills.find((s) => !state.character.tagged.includes(s.id));
    const plainRow = main.find((l) => stripVTControlCharacters(l).startsWith(` ${other.name}`));
    assert.equal(plainRow, stripVTControlCharacters(plainRow), "zwykła bez koloru");
  } finally {
    setColorsEnabled(false);
  }
});

test("karta postaci 80×24: tabela nie jest odcięta od nagłówka na granicy stron; opisy perków z kolorowym nagłówkiem się zawijają", async () => {
  const { showCharacter } = await import("../src/ui/character_screen.js");
  const { setColorsEnabled } = await import("../src/ui/colors.js");
  setColorsEnabled(true);
  try {
    const state = gluszec();
    state.character.perks = data.perks.slice(0, 3).map((p) => p.id);
    const io = createScriptedIO(["<enter>", "<enter>", "<enter>"], { tty: true });
    Object.assign(io, { columns: 80, rows: 24 });
    await showCharacter({ state, data, io, rng: createRng(1), notices: [] }).catch((e) => { if (!(e instanceof InputExhaustedError)) throw e; });
    const frames = io.output.join("").split("\x1b[2J").map(stripVTControlCharacters);
    const page = (text) => frames.findIndex((f) => f.includes(text));
    assert.equal(page("Wartości pochodne"), page("Punkty akcji"), "nagłówek na tej samej stronie co wiersze");
    const perk = data.perks[0];
    assert.ok(frames.some((f) => f.includes(perk.name)), "perk widoczny");
    assert.ok(frames.every((f) => f.split("\n").filter(Boolean).every((row) => [...row].length <= 80)), "nic nie rozpycha ramki");
    assert.ok(frames.some((f) => f.includes(perk.description.split(" ").at(-1))), "koniec opisu perka nie jest ucięty");
  } finally {
    setColorsEnabled(false);
  }
});
