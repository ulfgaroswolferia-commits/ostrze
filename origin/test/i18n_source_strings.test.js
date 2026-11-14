import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/**
 * Where Polish literals may stay: text for the developer, never shown to the player. Everything the player reads goes
 * through data/ui.json. Per file: `whole` - a pure validator file that does nothing else (only data.js, schema.js, schemas.js);
 * `fns` - only the top-level declarations whose name matches (the validators of a runtime module); `lines` - only the
 * source lines that match. Besides these, a literal on a line that throws, builds an Error / super() message, sets a
 * `message = ` default (error-class constructors) or pushes to `errors` is developer text too (DEV_LINE).
 */
const EXCEPTIONS = new Map([
  ["engine/data.js", { whole: true, why: "data loading: validation messages for the developer" }],
  ["engine/schema.js", { whole: true, why: "schema check: validation messages for the developer" }],
  ["scenes/schemas.js", { whole: true, why: "scene schemas: validation messages for the developer" }],
  ["cli.js", { lines: /--seed|--scene|--lang|--scope|Dane poprawne|razem:/, why: "developer CLI messages (--seed, --scene, --lang, --scope, the --validate report); --help and screens go through ui" }],
  ["i18n/scope.js", { fns: /^scopedReport$/, why: "the --validate --scope report lines for the developer" }],
  ["engine/conditions.js", { fns: /^validate|^checkRef$/, why: "condition validators" }],
  ["engine/pix.js", { fns: /^(parsePix|artRefErrors)$/, why: "picture validator" }],
  ["systems/actions.js", { fns: /^validate/, why: "action validators" }],
  ["systems/combat/data.js", { fns: /^validate/, why: "enemy data validators" }],
  ["systems/dialogue.js", { fns: /^validate/, why: "dialogue validators" }],
  ["systems/effects.js", { fns: /^validate/, why: "effect validators" }],
  ["systems/items.js", { fns: /^validate/, why: "item validators" }],
  ["systems/loot.js", { fns: /^validate/, why: "loot validators" }],
  ["systems/modifiers.js", { fns: /^validate/, why: "modifier validators" }],
  ["systems/phenomena.js", { fns: /^validate/, why: "phenomenon validators" }],
  ["systems/quests.js", { fns: /^validate/, why: "quest validators" }],
  ["systems/travel.js", { fns: /^(validate|records$)/, why: "travel validators" }],
]);

/** Decodes the escape at `src[i]` (a backslash): returns [character, index after it]. Handles unicode (4 hex digits or braces) and \xHH escapes. */
function readEscape(src, i) {
  const c = src[i + 1] ?? "";
  if (c === "u" && src[i + 2] === "{") {
    const end = src.indexOf("}", i + 3);
    if (end > 0) return [String.fromCodePoint(parseInt(src.slice(i + 3, end), 16)), end + 1];
  }
  if (c === "u" && /^[0-9a-fA-F]{4}$/.test(src.slice(i + 2, i + 6))) return [String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)), i + 6];
  if (c === "x" && /^[0-9a-fA-F]{2}$/.test(src.slice(i + 2, i + 4))) return [String.fromCharCode(parseInt(src.slice(i + 2, i + 4), 16)), i + 4];
  return [{ n: "\n", t: "\t" }[c] ?? c, i + 2];
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

/** Returns the text of every string literal (and template literal fragment) outside comments, with its line. */
export function literals(src) {
  const out = [];
  let fn = ""; // the top-level declaration the scan is in
  let i = 0;
  let line = 1;
  let last = "";
  const braces = []; // stack: "t" for a template ${ ... }, "b" for a plain block
  const readTemplate = () => {
    let buf = "";
    const start = line;
    while (i < src.length) {
      const c = src[i];
      if (c === "\\") { const [ch, next] = readEscape(src, i); buf += ch; i = next; continue; }
      if (c === "`") { i++; out.push({ text: buf, line: start, fn }); return; }
      if (c === "$" && src[i + 1] === "{") { i += 2; braces.push("t"); out.push({ text: buf, line: start, fn }); return "expr"; }
      if (c === "\n") line++;
      buf += c; i++;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (; i < stop; i++) if (src[i] === "\n") line++;
      continue;
    }
    if (c === '"' || c === "'") {
      let buf = "";
      i++;
      while (i < src.length && src[i] !== c && src[i] !== "\n") {
        if (src[i] === "\\") { const [ch, next] = readEscape(src, i); buf += ch; i = next; continue; }
        buf += src[i++];
      }
      i++;
      out.push({ text: buf, line, fn });
      last = "s";
      continue;
    }
    if (c === "`") { i++; readTemplate(); last = "s"; continue; }
    if (c === "{") { braces.push("b"); i++; last = "{"; continue; }
    if (c === "}") {
      i++;
      if (braces.pop() === "t") readTemplate();
      last = "}";
      continue;
    }
    if (c === "/") {
      // a regex literal when the previous token cannot end an expression
      if (last === "" || /[(,=:\[!&|?{};+\-*%<>~^]/.test(last) || last === "kw") {
        i++;
        let inClass = false;
        while (i < src.length && src[i] !== "\n") {
          if (src[i] === "\\") { i += 2; continue; }
          if (src[i] === "[") inClass = true;
          else if (src[i] === "]") inClass = false;
          else if (src[i] === "/" && !inClass) break;
          i++;
        }
        i++;
        while (/[a-z]/.test(src[i] ?? "")) i++;
        last = "s";
        continue;
      }
      i++; last = "/"; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (/[\w$]/.test(src[j] ?? "")) j++;
      const word = src.slice(i, j);
      if (braces.length === 0 && ["function", "class", "const", "let", "var"].includes(word)) {
        const m = /^\s*\*?\s*([\w$]+)/.exec(src.slice(j, j + 80));
        if (m) fn = m[1];
      }
      last = ["return", "typeof", "case", "in", "of", "else", "do", "yield", "await", "void", "delete", "throw"].includes(word) ? "kw" : "w";
      i = j;
      continue;
    }
    if (/\d/.test(c)) { while (/[\w.]/.test(src[i] ?? "")) i++; last = "n"; continue; }
    if (!/\s/.test(c)) last = c;
    i++;
  }
  return out;
}

/** Developer messages: thrown errors, error-class defaults and validator output never reach the player as written. */
const DEV_LINE = /\bthrow\b|\bError\(|\bsuper\(|\bmessage = |\berrors\.push\(/;

const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const PROSE = /[A-Za-z]{3,}/;

/**
 * Short Polish function words (za, na, do, …) as whole words. Prose needs a run of 3+ letters, so a fragment such as
 * `${name} za ${damage}` slipped through: a literal with whitespace and one of these words is player text too.
 * Lowercase only, so the English "I" and "O" are no match; "do" and "to" never stand alone in a code literal here.
 */
const SHORT_WORD = /(?<!\p{L})(?:za|na|do|od|po|ze|we|w|i|z|o|u)(?!\p{L})/u;

/** A literal is player text when it has Polish letters, is prose (whitespace plus a run of 3+ letters) or has a short Polish word. */
function isPlayerText(text) {
  return POLISH.test(text) || (/\s/.test(text) && (PROSE.test(text) || SHORT_WORD.test(text)));
}

/**
 * A single capitalised word with no diacritics ("Atak", "Wróć" is caught by POLISH already) is a label shown to the player
 * when it stands in UI code (src/ui, src/scenes). Code there has no reason for such a literal except the ones below.
 */
const UI_DIRS = /^(ui|scenes)\//;
const LABEL = /^\p{Lu}\p{Ll}{2,}$/u;
const LABEL_OK = new Map([
  ["One", "a ui key suffix (`${key}One`, scenes/shop.js), not shown"],
  ["Any", "a ui key suffix (`combat.tech.${id}Any`, ui/combat_screen.js), not shown"],
]);

test("src/ holds no player-facing literals outside the exception list", () => {
  const found = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).replaceAll("\\", "/");
    const rule = EXCEPTIONS.get(rel);
    if (rule?.whole) continue;
    const source = readFileSync(file, "utf8");
    const lines = source.split("\n");
    for (const { text, line, fn } of literals(source)) {
      if (DEV_LINE.test(lines[line - 1])) continue;
      if (rule?.fns?.test(fn) || rule?.lines?.test(lines[line - 1])) continue;
      if (isPlayerText(text) || (UI_DIRS.test(rel) && LABEL.test(text) && !LABEL_OK.has(text))) found.push("src/" + rel + ":" + line + " [" + fn + "]  " + JSON.stringify(text));
    }
  }
  assert.deepEqual(found, [], "Player text in code, move it to data/ui.json:\n" + found.join("\n"));
});

test("scanner: sees literals, skips comments and regexes, decodes escapes, knows the function", () => {
  const got = literals('// "zażółć gęślą"\nfunction f() { return "za\\u017c\\u00f3\\u0142\\u0107"; }\nconst r = /ł a/g; /* "x y zzz" */ const t = `ab ${f("ą")} cd`;').map((l) => [l.text, l.fn]);
  assert.deepEqual(got, [["zażółć", "f"], ["ab ", "t"], ["ą", "t"], [" cd", "t"]]);
});

test("short Polish words in a literal with whitespace are player text; English code fragments are not", () => {
  for (const text of [" za ", "Bandyta 2 za 5", " i ", "w lesie", "z ", " o "]) assert.ok(isPlayerText(text), text);
  for (const text of [" · ", ", ", " ×", "I ", "a b", "\x1b[0m "]) assert.ok(!isPlayerText(text), text);
});

test("a bare capitalised word is a label in UI code", () => {
  for (const text of ["Atak", "Wilk", "Bandyta"]) assert.ok(LABEL.test(text), text);
  for (const text of ["dim", "OK", "Ab", "zbroja", "Krótki miecz"]) assert.ok(!LABEL.test(text), text);
});
