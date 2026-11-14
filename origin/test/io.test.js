import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough, Readable } from "node:stream";
import {
  createScriptedIO, createTerminalIO, InputClosedError, InterruptError, InputExhaustedError,
} from "../src/ui/io.js";

test("scripted IO zwraca kolejne odpowiedzi i zapisuje wyjście", async () => {
  const io = createScriptedIO(["1", "tak"]);
  io.write("Witaj"); assert.equal(await io.ask("? "), "1"); assert.equal(await io.ask("? "), "tak");
  assert.match(io.text(), /Witaj/);
  await assert.rejects(io.ask("?"), InputExhaustedError);
});
test("^C rzuca InterruptError", async () =>
  await assert.rejects(createScriptedIO(["^C"]).ask("?"), InterruptError));
test("terminal IO: zamknięte wejście → InputClosedError, brak columns → 80", async () => {
  const input = Readable.from([]); const output = new PassThrough();
  const io = createTerminalIO({ input, output });
  try {
    assert.equal(io.columns, 80);
    await assert.rejects(io.ask("? "), InputClosedError);
    await assert.rejects(io.ask("? "), InputClosedError);
  } finally { io.close(); }
});
test("terminal IO: odpowiedź i write z newline", async () => {
  const input = new PassThrough(); const output = new PassThrough();
  const io = createTerminalIO({ input, output });
  try {
    io.write("hej");
    const p = io.ask("? ");
    input.write("odp\n");
    assert.equal(await p, "odp");
    const written = [];
    for (let chunk = output.read(); chunk !== null; chunk = output.read()) written.push(chunk.toString());
    assert.match(written.join(""), /hej\n\? /);
  } finally { io.close(); }
});
test("terminal IO: SIGINT interfejsu odrzuca ask z InterruptError", async () => {
  const input = new PassThrough(); const output = new PassThrough();
  const io = createTerminalIO({ input, output });
  try {
    const p = io.ask("? ");
    io.rl.emit("SIGINT");
    await assert.rejects(p, InterruptError);
  } finally { io.close(); }
});
test("terminal IO: wejście z pipe – kolejne odpowiedzi nie giną po zamknięciu", async () => {
  const input = new PassThrough(); const output = new PassThrough();
  const io = createTerminalIO({ input, output });
  try {
    input.end("a\nb\n");
    await new Promise((r) => setImmediate(r));
    assert.equal(await io.ask("? "), "a");
    assert.equal(await io.ask("? "), "b");
    await assert.rejects(io.ask("? "), InputClosedError);
  } finally { io.close(); }
});
test("scripted IO: ^D rzuca InputClosedError; isTTY false", async () => {
  const io = createScriptedIO(["^D"]);
  assert.equal(io.isTTY, false);
  await assert.rejects(io.ask("?"), InputClosedError);
});

test("scripted readKey: tokeny, znaki, ^C, wyczerpanie", async () => {
  const io = createScriptedIO(["<up>", "p", "<enter>", "^C"], { tty: true });
  assert.equal(io.isTTY, true);
  assert.deepEqual(await io.readKey(), { name: "up" });
  assert.deepEqual(await io.readKey(), { name: "char", char: "p" });
  assert.deepEqual(await io.readKey(), { name: "enter" });
  await assert.rejects(io.readKey(), InterruptError);
  await assert.rejects(io.readKey(), InputExhaustedError);
});
test("scripted readKey: ^D, nieznany token, wspólna kolejka z ask", async () => {
  const io = createScriptedIO(["tekst", "<down>", "<zly>", "^D"]);
  assert.equal(await io.ask("? "), "tekst");
  assert.deepEqual(await io.readKey(), { name: "down" });
  await assert.rejects(io.readKey(), /nieznany token klawisza: <zly>/);
  await assert.rejects(io.readKey(), InputClosedError);
});
function fakeTTY() {
  const input = new PassThrough(); input.isTTY = true; input.raw = [];
  input.setRawMode = (on) => { input.raw.push(on); };
  const output = new PassThrough(); output.isTTY = true; output.columns = 80;
  return { input, output };
}
test("terminal readKey: strzałki i Enter, tryb surowy przywracany przy close", async () => {
  const { input, output } = fakeTTY(); const io = createTerminalIO({ input, output });
  const p = io.readKey(); input.write("\x1b[A"); assert.deepEqual(await p, { name: "up" });
  const q = io.readKey(); input.write("\r"); assert.deepEqual(await q, { name: "enter" });
  io.close(); assert.equal(input.raw.at(-1), false);
});
test("terminal readKey: Ctrl+C → InterruptError, dalej działa readKey i ask", async () => {
  const { input, output } = fakeTTY(); const io = createTerminalIO({ input, output });
  try {
    const p = io.readKey(); input.write("\x03"); await assert.rejects(p, InterruptError);
    const q = io.readKey(); input.write("x"); assert.deepEqual(await q, { name: "char", char: "x" });
    const a = io.ask("? "); input.write("ok\r"); assert.equal(await a, "ok");
  } finally { io.close(); }
  assert.equal(input.raw.at(-1), false);
});
test("terminal readKey: Enter i wpisane znaki nie trafiają do następnego ask", async () => {
  const { input, output } = fakeTTY(); const io = createTerminalIO({ input, output });
  try {
    const p = io.readKey(); input.write("z"); assert.deepEqual(await p, { name: "char", char: "z" });
    const q = io.readKey(); input.write("\r"); assert.deepEqual(await q, { name: "enter" });
    const a = io.ask("x"); input.write("abc\r"); assert.equal(await a, "abc");
  } finally { io.close(); }
});
test("terminal readKey: wklejony tekst w jednej porcji – kolejne readKey dostają wszystkie znaki", async () => {
  const { input, output } = fakeTTY(); const io = createTerminalIO({ input, output });
  try {
    const p = io.readKey(); input.write("Jan\r");
    assert.deepEqual(await p, { name: "char", char: "J" });
    assert.deepEqual(await io.readKey(), { name: "char", char: "a" });
    assert.deepEqual(await io.readKey(), { name: "char", char: "n" });
    assert.deepEqual(await io.readKey(), { name: "enter" });
    const q = io.readKey(); input.write("x");
    assert.deepEqual(await q, { name: "char", char: "x" }, "bufor nie przecieka na później");
  } finally { io.close(); }
});
test("terminal readKey: discardInput odrzuca też resztę wklejonej porcji", async () => {
  const { input, output } = fakeTTY(); const io = createTerminalIO({ input, output });
  try {
    const p = io.readKey(); input.write("1\r2"); assert.deepEqual(await p, { name: "char", char: "1" });
    io.discardInput(10);
    await new Promise((r) => setTimeout(r, 30));
    const q = io.readKey(); input.write("x");
    assert.deepEqual(await q, { name: "char", char: "x" });
  } finally { io.close(); }
});
test("terminal readKey: Ctrl+C w ogonie porcji przerywa następny readKey", async () => {
  const { input, output } = fakeTTY(); const io = createTerminalIO({ input, output });
  try {
    const p = io.readKey(); input.write("a\x03b"); assert.deepEqual(await p, { name: "char", char: "a" });
    await assert.rejects(io.readKey(), InterruptError);
  } finally { io.close(); }
});
test("terminal readKey: close w trakcie → InputClosedError", async () => {
  const { input, output } = fakeTTY(); const io = createTerminalIO({ input, output });
  const p = io.readKey(); io.close();
  await assert.rejects(p, InputClosedError);
});
test("terminal bez TTY: readKey odrzuca", async () => {
  const input = new PassThrough(); const output = new PassThrough();
  const io = createTerminalIO({ input, output });
  try { await assert.rejects(io.readKey(), /readKey wymaga terminala/); } finally { io.close(); }
});
test("terminal readKey: readline nie przetwarza klawiszy (brak echa, historii), ask działa dalej", async () => {
  const { input, output } = fakeTTY(); const chunks = [];
  output.on("data", (d) => chunks.push(d.toString()));
  const io = createTerminalIO({ input, output });
  try {
    const h = io.ask("? "); input.write("historia\r"); assert.equal(await h, "historia");
    chunks.length = 0;
    const p = io.readKey(); input.write("p"); assert.deepEqual(await p, { name: "char", char: "p" });
    const q = io.readKey(); input.write("\x1b[A"); assert.deepEqual(await q, { name: "up" });
    const r = io.readKey(); input.write("ab"); assert.deepEqual(await r, { name: "char", char: "a" });
    const a = io.ask("x"); input.write("abc\r"); assert.equal(await a, "abc");
    const out = chunks.join("");
    assert.doesNotMatch(out, /p/); assert.doesNotMatch(out, /historia/);
  } finally { io.close(); }
  assert.equal(input.raw.at(-1), false);
});

test("terminal IO: brak rows → 24, scripted IO ma rows 24", () => {
  const output = new PassThrough(); output.isTTY = true;
  const io = createTerminalIO({ input: new PassThrough(), output });
  assert.equal(io.rows, 24);
  assert.equal(createScriptedIO([]).rows, 24);
  io.close();
});

test("terminal IO: discardInput gubi klawisze sprzed ekranu i z okresu karencji", async () => {
  const input = new PassThrough(); const output = new PassThrough();
  output.isTTY = true;
  const io = createTerminalIO({ input, output });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    input.write("\r\r\r");
    io.discardInput(50);
    await wait(20);
    input.write("\r");
    const pending = io.readKey();
    assert.equal(await Promise.race([pending, wait(10).then(() => "none")]), "none");
    await wait(80);
    input.write("\r");
    assert.equal((await Promise.race([pending, wait(300).then(() => ({ name: "timeout" }))])).name, "enter");
  } finally { io.close(); }
});
