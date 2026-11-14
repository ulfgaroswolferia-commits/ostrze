import { test } from "node:test";
import assert from "node:assert/strict";
import { detect256 } from "../src/ui/colors.js";

const tty = (depth) => ({ isTTY: true, getColorDepth: () => depth });

test("cmd.exe na Windowsie: bez TERM i COLORTERM, ale z głębią 24 bity, są kolory (ilustracje z bloków zamiast ASCII)", () => {
  assert.equal(detect256({}, tty(24)), true);
});

test("terminal z głębią 8 bitów ma 256 kolorów", () => {
  assert.equal(detect256({}, tty(8)), true);
});

test("terminal z 16 kolorami dostaje ASCII", () => {
  assert.equal(detect256({ TERM: "xterm" }, tty(4)), false);
});

test("TERM i COLORTERM działają dalej, także bez getColorDepth (strumień bez TTY)", () => {
  assert.equal(detect256({ TERM: "xterm-256color" }, {}), true);
  assert.equal(detect256({ COLORTERM: "truecolor" }, {}), true);
  assert.equal(detect256({ COLORTERM: "24bit" }, {}), true);
  assert.equal(detect256({ TERM: "xterm" }, {}), false);
  assert.equal(detect256({}, {}), false);
});
