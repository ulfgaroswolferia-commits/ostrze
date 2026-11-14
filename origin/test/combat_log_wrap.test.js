import { test, before } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { dataDir } from "../src/config.js";
import { loadData } from "../src/engine/data.js";
import { createCombat } from "../src/systems/combat/state.js";
import { combatEventText } from "../src/ui/events.js";
import { renderCombat, logEntryRows } from "../src/ui/combat_screen.js";
import { heroPanel } from "../src/ui/hero_panel.js";
import { sceneCapacity } from "../src/ui/screen.js";
import { sceneWidth, frameWidth } from "../src/ui/frame.js";
import { setColorsEnabled } from "../src/ui/colors.js";
import { createRng } from "../src/engine/dice.js";
import { combatState } from "./helpers.js";

const COLS = 80;
const ROWS = 24;
const data = {};

before(async () => {
  setColorsEnabled(false);
  data.pl = await loadData(dataDir());
  data.en = await loadData(dataDir(), { lang: "en" });
});

/**
 * The highest instance number each enemy can carry in a real fight: every object in the data with an `enemies` list is a
 * fight; its count of an id plus its `reinforcements` of that id, or, with no reinforcements, one more of each kind (a quick
 * kill brings one more of the fallen kind while others stand, strike.js `noiseOfKill`). A veteran has its base's number.
 */
function maxNumbers(d) {
  const max = {};
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node.enemies) && node.enemies.every((g) => typeof g?.id === "string")) {
      const totals = {};
      const add = (groups) => { for (const { id, count = 1 } of groups ?? []) totals[id] = (totals[id] ?? 0) + count; };
      add(node.enemies);
      add(node.reinforcements);
      const many = node.enemies.reduce((n, g) => n + (g.count ?? 1), 0) > 1;
      const noise = !node.reinforcements && many && !node.quiet && !node.training;
      for (const [id, n] of Object.entries(totals)) max[id] = Math.max(max[id] ?? 1, n + (noise ? 1 : 0));
    }
    Object.values(node).forEach(visit);
  };
  visit([d.story, d.travel, d.quests, d.dialogues, d.maps]);
  for (const e of d.enemies) if (e.veteran) max[e.veteran] = Math.max(max[e.veteran] ?? 1, max[e.id] ?? 1);
  return max;
}

/** The longest name among `list` (by characters), for the stricter case. */
const longest = (list) => list.reduce((a, b) => ([...b.name].length > [...a.name].length ? b : a));

/** Every journal event that names the enemy `uid` (with `other` as a second one), through `combatEventText`. */
function eventsFor(d, uid, other, damage) {
  const effect = longest(d.effects).id;
  const weapon = longest(d.items.filter((i) => i.type === "weapon")).id;
  return [
    { type: "atak", attacker: uid, target: "player", hit: false },
    { type: "atak", attacker: uid, target: "player", hit: true, damage, crit: true },
    { type: "atak", attacker: other, target: uid, hit: true, damage, crit: true },
    { type: "atak", attacker: "player", target: uid, hit: true, damage: 24, crit: true, weapon },
    { type: "atak", attacker: "player", target: uid, hit: true, damage: 24, crit: true, weapon, reaction: true },
    { type: "atak", attacker: "player", target: uid, hit: true, damage: 24, crit: true, weapon: "sztylet", thrown: true },
    { type: "wrog_pokonany", target: uid },
    { type: "wrog_ucieka", target: uid },
    { type: "ruch", mover: uid, band: "melee", target: uid },
    { type: "ruch", mover: uid, band: "far", target: uid },
    { type: "ruch", mover: uid, band: "far", target: uid, leap: true },
    { type: "ruch", mover: "player", band: "melee", target: uid },
    { type: "ruch", mover: "player", band: "far", target: uid },
    { type: "tura_przepada", target: uid },
    { type: "efekt_nalozony", target: uid, id: effect },
    { type: "efekt_odparty", target: uid, id: effect },
    { type: "efekt_odporny", target: uid, id: effect },
    { type: "efekt_obrazenia", target: uid, id: effect, damage: 12 },
    { type: "efekt_koniec", target: uid, id: effect },
    { type: "efekt_ap", target: uid, id: effect, ap: 2 },
    { type: "wybuch", hit: true, selfDamage: 0, victims: [{ target: uid, damage: 15 }, { target: other, damage: 15 }] },
    { type: "posilki", enemies: [uid, other] },
  ];
}

/** Rows of the scene panel during a fight at COLS×ROWS (the hero panel beside it shapes the frame). */
function panelHeight(state, d, combat) {
  const io = { columns: COLS, rows: ROWS, frame: { hero: heroPanel(state, d, { cols: frameWidth(COLS), combat }), title: null, body: [], commands: [], notices: [], page: 0, choiceTitle: null, ui: d.ui } };
  return sceneCapacity(io);
}

for (const lang of ["pl", "en"]) {
  test(`${lang}: at ${COLS}×${ROWS} every log line naming any enemy wraps whole into the panel, with no "…" cut`, () => {
    const d = data[lang];
    const max = maxNumbers(d);
    const width = sceneWidth(COLS);
    const state = combatState(d, d.classes[0].id);
    const cuts = [];
    let checked = 0;
    for (const enemy of d.enemies) {
      const n = max[enemy.id] ?? 1;
      // the second enemy (the other one in a blow between enemies, a blast, reinforcements): the longest other name
      const second = longest(d.enemies.filter((e) => e.id !== enemy.id && e.name !== enemy.name));
      const combat = createCombat(state, d, { enemies: [{ id: enemy.id, count: n }, { id: second.id }] }, createRng(1));
      const uid = `${enemy.id}#${n}`;
      const other = `${second.id}#1`;
      const damage = Math.max(...enemy.attacks.map((a) => (Array.isArray(a.damage) ? a.damage[1] : 9)), 9);
      const height = panelHeight(state, d, combat);
      for (const event of eventsFor(d, uid, other, damage)) {
        const text = combatEventText(d.ui, d, combat, event);
        if (!text) continue;
        combat.log = [text];
        combat.logRoles = ["dim"];
        const lines = renderCombat(state, d, combat, { frame: true, tty: false, width, height, color: false, targetUid: uid }).map(strip);
        const rows = logEntryRows(text, width);
        checked++;
        if (rows.some((row) => row.includes("…") || [...row].length > width) || lines.slice(-rows.length).join("\n") !== rows.join("\n")) {
          cuts.push(`${enemy.id} #${n} ${event.type}: ${text}\n  ${lines.slice(-rows.length).join("\n  ")}`);
        }
      }
    }
    assert.ok(checked > d.enemies.length * 15, `checked ${checked} lines`);
    assert.deepEqual(cuts, [], `log lines cut or missing at ${COLS}×${ROWS}:\n${cuts.join("\n")}`);
  });
}

test("a long entry wraps to width - 2 with a two-space indent; (+n earlier) counts rows", () => {
  const rows = logEntryRows("Odłamki trafiają Rabusia łucznika 3 za 15, Rabusia łucznika 2 za 15.", 41);
  assert.deepEqual(rows, ["· Odłamki trafiają Rabusia łucznika 3 za", "  15, Rabusia łucznika 2 za 15."]);
  for (const row of rows) assert.ok([...row].length <= 41);

  const d = data.pl;
  const state = combatState(d, d.classes[0].id);
  const combat = createCombat(state, d, { enemies: [{ id: "bandyta", count: 1 }] }, createRng(1));
  const long = "Bandyta trafia cię za 9 (krytyk!) i jeszcze długo, długo opowiada, co o tobie myśli, aż wszyscy zasną.";
  combat.log = ["stary wpis", long, long, long];
  combat.logRoles = combat.log.map(() => "dim");
  const height = 10;
  const lines = renderCombat(state, d, combat, { frame: true, tty: false, width: 41, height, color: false, logSeen: 1 }).map(strip);
  const perEntry = logEntryRows(long, 41).length;
  assert.ok(perEntry > 1);
  const at = lines.findIndex((l) => l.startsWith("(+"));
  assert.ok(at >= 0, lines.join("\n"));
  const shown = lines.length - at - 1; // whole entries only, below the marker
  assert.ok(shown % perEntry === 0 && shown < 3 * perEntry, lines.join("\n"));
  assert.match(lines[at], new RegExp(`^\\(\\+${3 * perEntry - shown} `), lines[at]);
});
