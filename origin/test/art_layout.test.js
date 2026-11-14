import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { composeFrame, visibleWidth } from "../src/ui/frame.js";
import { ART_LIMITS } from "../src/engine/pix.js";

const strip = (s) => stripVTControlCharacters(s);
const HERO = { left: "Thorgniew · poz. 2", right: "Dzień 2, 14:00", lines: ["HP ████████░░ 41/46   XP 190/450", "Broń: Krótki miecz"] };
const COMMANDS = [{ key: "P", label: "Postać" }, { key: "M", label: "Menu" }];
/** An image as the renderer gives it: `h / 2` rows of `w` cells. */
const art = ({ w, h }) => ({ lines: Array.from({ length: h / 2 }, () => "▀".repeat(w)), width: w });
const TEXT = Array.from({ length: 40 }, (_, i) => `Wiersz tekstu numer ${i + 1} opowiada o tym, co się dzieje w scenie.`);
const SIZES = [[80, 24], [120, 35], [160, 45], [200, 55]];
const spec = (cols, rows, image, over = {}) => ({ cols, rows, hero: HERO, title: "Scena", body: TEXT, commands: COMMANDS, notices: [], choices: ["[1] Dalej", "[2] Wróć", "[3] Porzuć"], art: image, ...over });

for (const [kind, limit] of Object.entries(ART_LIMITS)) {
  for (const [cols, rows] of SIZES) {
    test(`ramka ${cols}×${rows} z obrazkiem ${kind} ${limit.w}×${limit.h}: mieści się w oknie, wybory widoczne`, () => {
      const r = composeFrame(spec(cols, rows, art(limit)));
      assert.ok(r.lines.length <= rows, `${r.lines.length} wierszy > ${rows}`);
      const widths = new Set(r.lines.map((l) => visibleWidth(l)));
      assert.equal(widths.size, 1, "wszystkie wiersze tej samej szerokości");
      assert.ok(Math.max(...widths) <= cols);
      const text = r.lines.map(strip).join("\n");
      for (const c of ["[1] Dalej", "[2] Wróć", "[3] Porzuć"]) assert.ok(text.includes(c), `brak ${c}`);
      if (cols === 80) assert.equal(r.artMode, "none", "w 80×24 obrazek znika");
    });
  }
}

test("scena 96×48 w oknie 200×55 jest pokazana (obok albo nad tekstem)", () => {
  const r = composeFrame(spec(200, 55, art(ART_LIMITS.scene)));
  assert.ok(["side", "top"].includes(r.artMode), r.artMode);
});

import { renderCombat } from "../src/ui/combat_screen.js";
import { createCombat } from "../src/systems/combat/state.js";
import { minimalData, combatState } from "./helpers.js";
import { setColorsEnabled } from "../src/ui/colors.js";

setColorsEnabled(false);
const cdata = minimalData();
const bigEnemy = (w, h) => ({ w, h, palette: { a: 15 }, rows: Array(h).fill("a".repeat(w)) });
function combatWith(image) {
  const d = { ...cdata, art: { ...cdata.art, bandyta: image } };
  const state = combatState(d, "miecz");
  const combat = createCombat(state, d, { enemies: [{ id: "bandyta", count: 1 }], start: "far", canFlee: true }, { int: () => 1 });
  combat.log.push("Pierwszy wpis.", "Ostatni wpis w logu.");
  return { d, state, combat };
}
const panel = (image, width, height) => {
  const { d, state, combat } = combatWith(image);
  return renderCombat(state, d, combat, { frame: true, tty: true, width, height, color: true }).map(strip);
};

test("panel walki: wróg 64×48 w szerokim panelu – obrazek obok informacji, log widoczny, linie mieszczą się", () => {
  const lines = panel(bigEnemy(64, 48), 150, 40);
  assert.ok(lines.length <= 40);
  assert.ok(lines.every((l) => [...l].length <= 150), "linie ≤ szerokość panelu");
  assert.match(lines.join("\n"), /Ostatni wpis w logu\./);
  assert.ok(lines[0].indexOf("BANDYTA") >= 64, "informacje po prawej od obrazka");
});

test("panel walki: za wąski albo za niski panel na wroga 64×48 – bez obrazka, bez przepełnienia", () => {
  for (const [w, h] of [[100, 40], [150, 20]]) {
    const lines = panel(bigEnemy(64, 48), w, h);
    assert.ok(lines.length <= h);
    assert.ok(lines.every((l) => [...l].length <= w), `${w}×${h}`);
    assert.match(lines.join("\n"), /Ostatni wpis w logu\./, `${w}×${h}: log widoczny`);
    assert.ok(lines[0].indexOf("BANDYTA") < 10, `${w}×${h}: informacje od lewej`);
  }
});

test("panel walki: stary wróg 40×16 nadal obok informacji od kolumny 42", () => {
  const lines = panel(bigEnemy(40, 16), 100, 16);
  assert.equal(lines[0].indexOf("BANDYTA"), 41);
});

test("renderCombat bez ramki: wróg szerszy niż 40 nie psuje układu 80×24 (bez obrazka)", () => {
  const { d, state, combat } = combatWith(bigEnemy(64, 48));
  const lines = renderCombat(state, d, combat, { columns: 80, rows: 24, tty: true }).map(strip);
  assert.ok(lines.every((l) => [...l].length <= 78), lines.join("\n"));
  assert.ok(lines[0].indexOf("BANDYTA") < 10);
});
