import { stripVTControlCharacters } from "node:util";

/** Plain text of a frame line; the wide ⚡ gets a following space so that every character is one column. */
const plain = (l) => stripVTControlCharacters(l).replace(/⚡/g, "⚡ ");

/**
 * Splits a composed frame (lines, possibly painted) into its panels by the ▓ column of the title row (the junction of the
 * block frame, see src/ui/frame_style.js).
 * @param {string[]} lines
 * @returns {{ hero: string[], title: string, choiceTitle: string, scene: string[], choices: string[], info: string[], notices: string[], menu: string|null }}
 */
export function readFrame(lines) {
  const rows = lines.map(plain);
  const titleAt = rows.findIndex((l) => l.includes("▓"));
  if (titleAt < 0) throw new Error(`readFrame: brak wiersza tytułu\n${rows.join("\n")}`);
  const split = rows[titleAt].indexOf("▓");
  const width = rows[titleAt].length;
  const inner = (l) => l.slice(2, width - 2).trimEnd();
  const label = (text) => text.replace(/^[░▒\s]+|[░▒\s]+$/g, "");
  const closeAt = rows.findIndex((l, i) => i > titleAt && l.includes("▓"));
  const out = {
    hero: rows.slice(1, titleAt).map(inner), title: label(rows[titleAt].slice(1, split)), choiceTitle: label(rows[titleAt].slice(split + 1, width - 1)),
    scene: [], choices: [], info: [], notices: [], menu: null,
  };
  let inInfo = false;
  for (const l of rows.slice(titleAt + 1, closeAt)) {
    out.scene.push(l.slice(2, split - 1).trimEnd());
    const right = l.slice(split + 2, width - 2).trimEnd();
    // the description field starts with a zigzag divider where the bar column normally has a space after it
    if (l[split + 1] === "▄" || l[split + 1] === "▀") inInfo = true;
    else if (inInfo) out.info.push(right);
    else out.choices.push(right);
  }
  const tail = rows.slice(closeAt + 1, -1);
  const sep = tail.findIndex((l) => l.startsWith("█"));
  if (sep >= 0) {
    out.notices = tail.slice(0, sep).map(inner);
    out.menu = inner(tail[sep + 1]) || null;
  } else if (tail.length) {
    out.menu = inner(tail[0]) || null;
  }
  return out;
}
