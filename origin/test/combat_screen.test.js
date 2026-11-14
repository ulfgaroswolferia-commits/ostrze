import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { combatEventRole } from "../src/ui/events.js";
import { renderCombat, combatActionItems, techniqueItems, zoneItems } from "../src/ui/combat_screen.js";
import { techniqueActions, zoneActions } from "../src/systems/combat/techniques.js";
import { setColorsEnabled } from "../src/ui/colors.js";
import { createCombat } from "../src/systems/combat/state.js";
import { playerActions } from "../src/systems/combat/actions.js";
import { addItem } from "../src/systems/inventory.js";
import { renderPixels } from "../src/ui/pixels.js";
import { minimalData, combatState } from "./helpers.js";

setColorsEnabled(false);
const data = minimalData();
// Bandyta w tych testach ma mały obrazek 40×16 (układ starej kolumny obrazka); prawdziwe obrazy są teraz portretami 64×48.
data.art.bandyta = { w: 40, h: 16, palette: { a: 236, b: 94, c: 180 }, rows: Array.from({ length: 16 }, (_, y) => Array.from({ length: 40 }, (_, x) => ((x + y) % 7 === 0 ? "c" : (x * y) % 5 < 2 ? "b" : "a")).join("")) };
const fixed = (k) => ({ int: () => k });

function setup({ canFlee = true, start = "far" } = {}) {
  const state = combatState(data, "miecz");
  state.character.attributes.zrecznosc = 3; // 6 AP
  const combat = createCombat(state, data, { enemies: [{ id: "bandyta", count: 2 }], start, canFlee }, fixed(1));
  combat.playerAp = 3;
  return { state, combat };
}
const render = (state, combat, opts = {}) => renderCombat(state, data, combat, { columns: 80, rows: 24, tty: true, ...opts }).map(strip);

test("renderCombat 80×24: blok + 3 wiersze, linie ≤ 78, kluczowe treści", () => {
  const { state, combat } = setup();
  combat.enemies[0].hp = 13;
  combat.log.push("Bandyta 2 chybia.", "Trafiasz Bandytę 1 za 6.", "Bandyta 1: Zamroczony.");
  const lines = render(state, combat);
  assert.ok(lines.length <= 13, `${lines.length} linii`);
  assert.ok(lines.every((l) => [...l].length <= 78), lines.join("\n"));
  const text = lines.join("\n");
  assert.match(text, /BANDYTA 1/);
  assert.match(text, /▸ 1 Bandyta 1/);
  assert.match(text, /2 Bandyta 2/);
  assert.match(text, /PA ●●●○○○ \(3\/6\)/);
  assert.match(text, /Trafiasz Bandytę 1 za 6\./);
  assert.match(text, /HP \d+\/\d+/);
  assert.match(text, /Broń: Krótki miecz/);
  assert.equal(lines[0].indexOf("BANDYTA 1"), 0); // without a frame there is no picture, the text starts at the edge
});

test("renderCombat: naładowany łuk, efekty celu, wybrany cel", () => {
  const { state, combat } = setup();
  state.inventory.equipped.bron = "luk_mysliwski";
  addItem(state, data, "luk_mysliwski", 1);
  state.inventory.loaded.luk_mysliwski = 1;
  combat.enemies[1].effects.push({ id: "zamroczenie", remaining: 2, stacks: 1, dazed: true });
  const text = render(state, combat, { targetUid: combat.enemies[1].uid }).join("\n");
  assert.match(text, /\[naładowana\]/);
  assert.match(text, /BANDYTA 2/);
  assert.match(text, /\[Zamroczony 2\]/);
  assert.match(text, /▸ 2 Bandyta 2/);
  state.inventory.loaded.luk_mysliwski = 0;
  assert.match(render(state, combat).join("\n"), /\[pusta\]/);
});

test("renderCombat: razem z 10 akcjami i opisem ≤ 22 wiersze", () => {
  const { state, combat } = setup();
  const items = combatActionItems(data.ui, playerActions(state, data, combat));
  assert.equal(items.length, 10);
  assert.ok(render(state, combat).length + items.length + 1 <= 22);
});

test("renderCombat: wąski lub niski terminal – bez grafiki", () => {
  const { state, combat } = setup();
  for (const size of [{ columns: 60, rows: 24 }, { columns: 80, rows: 20 }]) {
    const lines = render(state, combat, size);
    assert.ok(lines.every((l) => [...l].length <= size.columns - 2), lines.join("\n"));
    assert.ok(!lines.some((l) => data.art.bandyta.rows.some((a) => a.trim() && l.includes(a.trim()))));
    assert.match(lines[0], /^BANDYTA 1/);
  }
});

test("renderCombat: więcej niż dwóch wrogów – +N w ostatnim wierszu listy", () => {
  const { state } = setup();
  const combat = createCombat(state, data, { enemies: [{ id: "bandyta", count: 4 }], start: "far", canFlee: true }, fixed(1));
  combat.playerAp = 6;
  const lines = render(state, combat);
  assert.match(lines[2], /▸ 1 Bandyta 1/);
  assert.match(lines[3], /\+3/);
});

test("renderCombat: długa nazwa nie wychodzi poza kolumnę", () => {
  const { state } = setup();
  const combat = createCombat(state, data, { enemies: [{ id: "instruktor" }], start: "melee", canFlee: false }, fixed(1));
  combat.playerAp = 6;
  const lines = render(state, combat);
  assert.ok(lines.every((l) => [...l].length <= 78), lines.join("\n"));
  assert.match(lines[0], /INSTRUKTOR RADOGOST/);
});

test("combatActionItems: skróty, koszt PA, wyszarzona ucieczka z powodem", () => {
  const { state, combat } = setup({ canFlee: false, start: "melee" });
  const items = combatActionItems(data.ui, playerActions(state, data, combat));
  assert.deepEqual(items.map((i) => i.hotkey), ["a", "p", "u", "z", "b", "o", "c", "k", "l", "t"]);
  const attack = items[0];
  assert.equal(attack.label, "Atak");
  assert.match(attack.hint, /^\(\d PA\)$/);
  const flee = items[6];
  assert.equal(flee.disabled, true);
  assert.equal(flee.label, "Ucieczka");
  assert.match(flee.hint, /Stąd nie ma ucieczki/);
  assert.equal(items[7].label, "Koniec tury");
  assert.equal(items[7].hint, undefined);
  assert.ok(items.every((i) => typeof i.description === "string" && i.description.length > 0));
});

test("renderCombat: bez tty (tryb liniowy) nie ma grafiki mimo 80×24", () => {
  const { state, combat } = setup();
  const lines = render(state, combat, { tty: false });
  assert.ok(!lines.some((l) => data.art.bandyta.rows.some((a) => a.trim() && l.includes(a.trim()))));
  assert.match(lines[0], /^BANDYTA 1/);
});

test("renderCombat: pas bez numerków w nawiasach (cyfry wybierają akcje)", () => {
  const { state, combat } = setup();
  const belt = render(state, combat).find((l) => l.includes("Pas:"));
  assert.match(belt, /Pas: Opatrunek/);
  assert.doesNotMatch(belt, /\[\d\]/);
});

test("renderCombat: znacznik pominiętych wpisów, gdy od ostatniego rysowania doszło więcej niż logSize", () => {
  const { state, combat } = setup();
  combat.log.push("Trafiasz Bandytę 1 za 6.", "Bandyta 1 chybia.", "Bandyta 1 trafia cię za 5.", "Bandyta 2 chybia.", "Bandyta 2 trafia cię za 7.");
  const lines = render(state, combat, { logSeen: 1, tty: false }); // 4 new entries, 3 log rows: marker + the last 2
  const text = lines.join("\n");
  assert.equal(lines[4].trim(), "(+2 wcześniej – [L])");
  assert.match(lines[5], /· Bandyta 2 chybia\./);
  assert.match(lines[6], /· Bandyta 2 trafia cię za 7\./);
  assert.doesNotMatch(text, /Bandyta 1 trafia cię/);
  assert.equal(render(state, combat, { tty: false }).length, lines.length);
  // three new entries fit: no marker; without logSeen: no marker either
  assert.doesNotMatch(render(state, combat, { logSeen: 2 }).join("\n"), /wcześniej/);
  assert.doesNotMatch(render(state, combat).join("\n"), /wcześniej/);
  assert.match(render(state, combat, { logSeen: 2 }).join("\n"), /Bandyta 1 trafia cię za 5\./);
});

test("techniqueItems: etykiety z nazwą broni, koszt PA, wyszarzenie z powodem, opis", () => {
  const { state, combat } = setup({ start: "melee" });
  combat.playerAp = 6;
  const items = techniqueItems(data, techniqueActions(state, data, combat));
  assert.deepEqual(items.map((i) => i.label), ["Atak obiema", "Uderz i zasłoń", "Rzuć drugą broń", "Podnieś broń", "Gotowość do ciosu"]);
  assert.equal(items[0].disabled, true);
  assert.equal(items[0].hint, "(Brak drugiej broni.)");
  assert.ok(items.every((i) => i.description));

  state.inventory.equipped.bron = "para_wloczni";
  addItem(state, data, "para_wloczni", 1);
  combat.thrown = { uid: combat.enemies[0].uid, itemId: "para_wloczni" };
  const thrown = techniqueItems(data, techniqueActions(state, data, combat));
  assert.equal(thrown.find((i) => /^Podnieś/.test(i.label)).label, "Podnieś: Włócznia");
  assert.equal(thrown.find((i) => /^Podnieś/.test(i.label)).hint, "(2 PA)");
});

test("zoneItems: ciosy celowane z wartościami z rules, głowa o 1 PA droższa, za mało PA – wyszarzone", () => {
  const { state, combat } = setup({ start: "melee" });
  combat.playerAp = 6;
  const zones = zoneItems(data, zoneActions(state, data, combat));
  assert.deepEqual(zones.map((z) => z.id), ["glowa", "tulow", "nogi", "ogluszenie"]);
  assert.deepEqual(zones.map((z) => z.label), ["Cios w głowę", "Cios w tułów", "Cios w nogi", "Ogłusz"]);
  assert.deepEqual(zones.map((z) => z.hotkey), ["g", "r", "n", "s"]);
  assert.equal(zones[0].hint, "(4 PA)");
  assert.match(zones[0].description, /−20.*\+50%.*krytyk \+20%/);
  assert.match(zones[1].description, /\+10.*−15%/);
  assert.match(zones[3].description, /Bez obrażeń.*40%.*Ogłuszony.*60%/);
  assert.ok(zones.every((z) => !z.disabled));
  combat.playerAp = 2;
  const poor = zoneItems(data, zoneActions(state, data, combat));
  assert.ok(poor.every((z) => z.disabled && /Za mało PA/.test(z.hint)));
});

// --- E3a: grafika wroga z .pix ---
const WIDE = { frame: true, tty: true, width: 100, height: 16 };

test("renderCombat bez ramki, TTY 80×24: bez obrazka, sam tekst od lewej krawędzi", () => {
  const { state, combat } = setup();
  const lines = render(state, combat, { color: true });
  assert.equal(lines[0].indexOf("BANDYTA 1"), 0);
  assert.ok(lines.every((l) => !/[▀▄]|[#@%*+=]{4}/.test(l)), lines.join("\n"));
});

test("panel walki bez kolorów: bez obrazka i bez ASCII", () => {
  const { state, combat } = setup({ start: "melee" });
  const lines = renderCombat(state, data, combat, { ...WIDE, color: false }).map(strip);
  assert.equal(lines[0].indexOf("BANDYTA 1"), 0);
  assert.ok(lines.every((l) => !/[▀▄]|[#@%*+=]{4}/.test(l)), lines.join("\n"));
});

test("panel walki 100 kolumn: grafika kolorowa (kody 256), wszystkie wiersze bloku tej samej szerokości widocznej", () => {
  const { state, combat } = setup({ start: "melee" });
  const raw = renderCombat(state, data, combat, { ...WIDE, color: true });
  assert.ok(raw.some((l) => l.includes("[38;5;")), "kody koloru");
  const block = raw.slice(0, 7).map((l) => [...strip(l)].length);
  assert.ok(block.every((w) => w >= 41), block.join(","));
  assert.ok(!render(state, combat, { ...WIDE, color: false }).join("").includes(""));
});

test("panel walki 43 kolumny (80×24 w ramce): bez grafiki", () => {
  const { state, combat } = setup();
  const lines = renderCombat(state, data, combat, { frame: true, tty: true, width: 43, height: 16, color: true }).map(strip);
  assert.ok(lines.every((l) => !/[#@%*+=]{4}/.test(l)), lines.join(String.fromCharCode(10)));
});

test("zmiana celu zmienia grafikę na grafikę wybranego wroga", () => {
  const state = combatState(data, "miecz");
  const combat = createCombat(state, data, { enemies: [{ id: "bandyta" }, { id: "wilk" }], start: "melee", canFlee: true }, fixed(1));
  const bandit = renderCombat(state, data, combat, { ...WIDE, width: 150, height: 40, color: true, targetUid: "bandyta#1" }).map(strip);
  const wolf = renderCombat(state, data, combat, { ...WIDE, width: 150, height: 40, color: true, targetUid: "wilk#1" }).map(strip);
  const cells = (img) => renderPixels(img, { color: true }).map(strip);
  cells(data.art.bandyta).forEach((row, i) => assert.ok(bandit[i].startsWith(row)));
  cells(data.art.wilk).forEach((row, i) => assert.ok(wolf[i].startsWith(row)));
  assert.notDeepEqual(bandit.slice(0, 4), wolf.slice(0, 4));
});

test("dziennik walki: czerwony gdy bohater dostaje obrażenia, zielony za jego trafienia, niebieski gdy wróg pada lub ucieka", () => {
  const roles = (e) => combatEventRole(e);
  assert.equal(roles({ type: "atak", attacker: "player", target: "bandyta#1", hit: true }), "heal");
  assert.equal(roles({ type: "atak", attacker: "bandyta#1", target: "player", hit: true }), "damage");
  assert.equal(roles({ type: "atak", attacker: "bandyta#1", target: "player", hit: false }), "dim");
  assert.equal(roles({ type: "atak", attacker: "player", target: "bandyta#1", hit: false }), "dim");
  assert.equal(roles({ type: "efekt_obrazenia", target: "player", damage: 2 }), "damage");
  assert.equal(roles({ type: "efekt_obrazenia", target: "bandyta#1", damage: 2 }), "dim");
  assert.equal(roles({ type: "wrog_pokonany", target: "bandyta#1" }), "foe_down");
  assert.equal(roles({ type: "wrog_ucieka", target: "bandyta#1" }), "foe_down");
  assert.equal(roles({ type: "obrona", bonus: 5 }), "dim");

  setColorsEnabled(true);
  try {
    const { state, combat } = setup();
    const draw = (log, logRoles) => {
      combat.log = log;
      combat.logRoles = logRoles;
      return renderCombat(state, data, combat, { columns: 80, rows: 24, tty: false });
    };
    const find = (raw, needle) => raw.find((l) => l.includes(needle));
    const mixed = draw(["Trafiasz Bandytę 1 za 6.", "Bandyta 1 pada.", "Bandyta 2 chybia."], ["heal", "foe_down"]); // the last has no role: dim (a save from before)
    assert.match(find(mixed, "Trafiasz"), /\x1b\[32m/);
    assert.match(find(mixed, "pada"), /\x1b\[34m/);
    assert.match(find(mixed, "chybia"), /\x1b\[90m/);
    assert.match(find(draw(["Bandyta 1 trafia cię za 3."], ["damage"]), "trafia cię"), /\x1b\[31m/);
  } finally {
    setColorsEnabled(false);
  }
});

test("renderCombat: wysoka grafika bez ramki – pominięta, a nie ucięta do 7 wierszy", () => {
  const { state, combat } = setup();
  const original = data.art.bandyta;
  data.art.bandyta = { ...original, w: 40, h: 48, rows: Array.from({ length: 48 }, (_, y) => original.rows[y % 16]) };
  try {
    const lines = render(state, combat);
    assert.match(lines[0], /^BANDYTA 1/);
  } finally {
    data.art.bandyta = original;
  }
});

test("panel walki: lista wrogów wykorzystuje miejsce w panelu, „+N” dopiero gdy się nie mieści, a cel zawsze na liście", () => {
  const panel = (count, target, height) => {
    const combat = { enemies: Array.from({ length: count }, (_, i) => ({ id: "bandyta", uid: `bandyta#${i + 1}`, name: `Bandyta ${i + 1}`, hp: 10, hpMax: 10, band: "far", effects: [] })), log: ["Wpis."], logRoles: [], playerAp: 5 };
    const state = { character: { effects: [] }, inventory: { equipped: {}, quickSlots: [] }, time: { minutes: 600 } };
    return renderCombat(state, data, combat, { frame: true, tty: false, targetUid: `bandyta#${target}`, width: 60, height, color: false }).map(strip);
  };
  const listed = (rows) => rows.filter((l) => /Bandyta \d+ +\d+%/.test(l));

  const five = panel(5, 5, 20);
  assert.equal(listed(five).length, 5, five.join("\n"));
  assert.ok(!five.some((l) => /^\s*\+\d+\s*$/.test(l)), five.join("\n"));
  assert.ok(five.some((l) => l.includes("Wpis.")), "dziennik zostaje");

  const many = panel(30, 30, 20);
  assert.ok(listed(many).length > 5, many.join("\n"));
  assert.ok(listed(many).some((l) => l.includes("Bandyta 30")), "cel na liście");
  const more = many.find((l) => /^\s*\+\d+\s*$/.test(l));
  assert.equal(Number(more.trim().slice(1)) + listed(many).length, 30, many.join("\n"));
  assert.equal(many.length <= 20, true);
  assert.ok(many.some((l) => l.includes("Wpis.")), "dziennik zostaje");
});
