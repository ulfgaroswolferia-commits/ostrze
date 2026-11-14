// The binding glossary docs/i18n/slownik-en.md: parsing and matching, shared by the glossary test and
// tools/i18n/glossary_forms.mjs.
//
// Every table in the file must have the header PL | EN | wzorzec PL | uwagi. A pattern is a JavaScript regex
// (flag u, case-sensitive) in one `…` span; the matcher adds letter boundaries around it.

export const HEADER = ["PL", "EN", "wzorzec PL", "uwagi"];

/** Splits a markdown table row on unescaped "|" and unescapes "\|". */
function cells(line) {
  const out = [];
  let cur = "";
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && body[i + 1] === "|") { cur += "|"; i++; continue; }
    if (body[i] === "|") { out.push(cur.trim()); cur = ""; continue; }
    cur += body[i];
  }
  out.push(cur.trim());
  return out;
}

/**
 * Rows of every table: { pl, en, pattern, note, line }. Throws on any table whose header is not exactly
 * PL | EN | wzorzec PL | uwagi, on a row without exactly 4 cells, on a pattern cell that is not one `…` span
 * (or empty), and on a pattern starting with ^ but not ending with $.
 */
export function parseGlossary(md) {
  const rows = [];
  const errors = [];
  const lines = md.split(/\r?\n/);
  const isSep = (l) => /^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(l?.trim() ?? "");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("|") || !isSep(lines[i + 1])) continue;
    const head = cells(lines[i]);
    if (head.join("|") !== HEADER.join("|")) { errors.push(`wiersz ${i + 1}: zły nagłówek tabeli: ${head.join(" | ")}`); continue; }
    for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) {
      const c = cells(lines[i]);
      if (c.length !== 4) { errors.push(`wiersz ${i + 1}: ${c.length} komórek zamiast 4`); continue; }
      const [pl, en, cell, note] = c;
      let pattern = "";
      if (cell !== "") {
        const m = /^`([^`]+)`$/.exec(cell);
        if (!m) { errors.push(`wiersz ${i + 1}: wzorzec musi być jednym \`…\` bez innych odwróconych apostrofów`); continue; }
        pattern = m[1];
        if (pattern.startsWith("^") && !pattern.endsWith("$")) errors.push(`wiersz ${i + 1}: wzorzec z ^ musi kończyć się $`);
      }
      rows.push({ pl, en, pattern, note, line: i + 1 });
    }
    i--;
  }
  if (errors.length > 0) throw new Error(`słownik: ${errors.join("; ")}`);
  return rows;
}

/** A glossary pattern as a RegExp with letter boundaries (`g` for matchAll). */
export const compile = (p, flags = "u") => new RegExp(`(?<!\\p{L})(?:${p})(?!\\p{L})`, flags);

const apos = (s) => s.replace(/[‘’]/g, "'");
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** English plural forms of the last word beyond plain -s/-es: party → parties, wolf → wolves, man → men. */
function pluralBodies(term) {
  const out = [];
  if (/[^aeiou]y$/i.test(term)) out.push(`${term.slice(0, -1)}ies`);
  if (/fe$/i.test(term)) out.push(`${term.slice(0, -2)}ves`);
  else if (/f$/i.test(term)) out.push(`${term.slice(0, -1)}ves`);
  if (/man$/i.test(term)) out.push(`${term.slice(0, -3)}men`);
  return out;
}

/**
 * Whether `text` contains the glossary name `en` as whole words. After it may stand a plural or possessive
 * ending (s, es, 's, s', '), and the last word may take an -ies, -ves or -men plural. An EN with a capital letter
 * must match letter for letter (only a leading "the" may be "The"); an all-lowercase EN matches in any case.
 */
export function containsTerm(text, en) {
  const term = apos(en);
  const proper = /\p{Lu}/u.test(term);
  const bodies = [term, ...pluralBodies(term)].map((t) => {
    const e = escRe(t);
    return proper && t.startsWith("the ") ? `[Tt]he ${escRe(t.slice(4))}` : e;
  });
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${bodies.join("|")})(?:'s|s'|es|s|')?(?![\\p{L}])`, proper ? "u" : "iu");
  return re.test(apos(text));
}
