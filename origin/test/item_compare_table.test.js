import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData } from "../src/engine/data.js";
import { combatState } from "./helpers.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { renderItemCard } from "../src/ui/inventory_screen.js";
import { wearSlots, TABLE_WIDTH } from "../src/ui/item_compare.js";
import { setColorsEnabled, setRich256 } from "../src/ui/colors.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { sceneWidth } from "../src/ui/frame.js";

const data = await loadData();
const item = (id) => data.items.find((i) => i.id === id);
const strip = (s) => stripVTControlCharacters(s);
const card = (id, state) => strip(renderItemCard(item(id), state, data)).split("\n");
const rich = (id, state) => {
  setColorsEnabled(true);
  try { return renderItemCard(item(id), state, data).split("\n"); } finally { setColorsEnabled(false); }
};
const hero = (classId = "miecz") => combatState(data, classId);
const row = (lines, label) => lines.findLast((l) => l.startsWith(label) && !l.includes("·") && !l.includes(":"));
const wearing = (state, id, slot) => { addItem(state, data, id, 1); assert.equal(equip(state, data, id, slot).ok, true, `załóż ${id}`); return state; };
const blade = data.items.find((i) => i.damage && i.range === "melee" && !i.pair && !i.offhand && i.id !== "miecz_krotki" && i.type !== "artifact").id;
const armor = data.items.filter((i) => i.type === "armor" && i.slot === "tulow" && i.armor).sort((a, b) => a.armor - b.armor);

test("zakładana rzecz mówi od razu, na co się ją zakłada", () => {
  const s = hero();
  assert.ok(card(armor[0].id, s).includes(`Zakłada się na: ${data.ui["slot.tulow"]}`));
  assert.ok(card(blade, s).includes(`Zakłada się na: ${data.ui["slot.bron"]}`));
});

test("sztylet można nosić w obu rękach i tak to opisuje", () => {
  assert.ok(card("sztylet", hero()).includes(`Zakłada się na: ${data.ui["slot.bron"]} lub ${data.ui["slot.bron_druga"]}`));
});

test("rzecz niezakładana nie ma linii ani tabeli", () => {
  const lines = card("prowiant", hero());
  assert.ok(!lines.some((l) => l.startsWith("Zakłada się na")));
  assert.ok(!lines.some((l) => l.startsWith("Założone")));
});

test("każdy typ zakładanej rzeczy ma nazwę miejsca w interfejsie", () => {
  for (const i of data.items) for (const slot of wearSlots(i)) assert.ok(data.ui[`slot.${slot}`], `${i.id}: slot.${slot}`);
});

test("pusty slot: bez tabeli, a różnica zostaje", () => {
  const s = hero();
  s.inventory.equipped.tulow = null;
  const lines = card(armor[1].id, s);
  assert.ok(!lines.some((l) => l.startsWith("Założone")));
  assert.ok(lines.some((l) => l.startsWith("Po założeniu:")));
});

test("założony pancerz: tabela z dwiema kolumnami, różnica zostaje pod nią", () => {
  const s = wearing(hero(), armor[0].id, "tulow");
  const other = armor.at(-1);
  const lines = card(other.id, s);
  const at = lines.indexOf(`Założone: ${armor[0].name}`);
  assert.ok(at > 0, lines.join("\n"));
  assert.match(lines[at + 1], /Założone\s+Ta rzecz$/);
  const pancerz = row(lines, "Pancerz");
  assert.match(pancerz, new RegExp(`${armor[0].armor}\\s+${other.armor}$`));
  assert.match(row(lines, "Waga"), new RegExp(`${armor[0].weight} kg\\s+${other.weight} kg$`));
  assert.ok(lines.findIndex((l) => l.startsWith("Zamiast:")) > at, "różnica pod tabelą");
});

test("założona broń: obrażenia, typ, PA, zasięg, siła, waga", () => {
  const s = hero();
  const worn = s.inventory.equipped.bron;
  const lines = card(blade, s);
  assert.ok(lines.includes(`Założone: ${item(worn).name}`), lines.join("\n"));
  const [a0, a1] = item(worn).damage;
  const [b0, b1] = item(blade).damage;
  assert.match(row(lines, "Obrażenia"), new RegExp(`${a0}–${a1}\\s+${b0}–${b1}$`));
  for (const label of ["Typ obrażeń", "PA", "Zasięg", "Waga"]) assert.ok(row(lines, label), label);
});

test("pusta ręka to nie założona broń: bez tabeli", () => {
  const s = hero();
  s.inventory.equipped.bron = null;
  assert.ok(!card(blade, s).some((l) => l.startsWith("Założone")));
});

test("rzecz już założona: „Założone.” i bez tabeli", () => {
  const s = hero();
  const lines = card(s.inventory.equipped.bron, s);
  assert.ok(lines.includes("Założone."));
  assert.ok(!lines.some((l) => l.startsWith("Założone:")));
});

test("kolory: więcej pancerza zielone; większa waga żółta, bo mniej znaczy lepiej", () => {
  const heavy = armor.at(-1);
  const s = wearing(hero(), armor[0].id, "tulow");
  assert.ok(heavy.weight > armor[0].weight && heavy.armor > armor[0].armor, "dane testu");
  const lines = rich(heavy.id, s);
  const green = "\x1b[32m", yellow = "\x1b[33m";
  assert.ok(row(lines.map((l) => l), "Pancerz").includes(green));
  assert.ok(row(lines, "Waga").includes(yellow));
  const none = rich(blade, hero());
  assert.ok(!row(none, "Typ obrażeń").includes("\x1b["), "typu obrażeń nie oceniamy");
});

/** The comparison rows of a card: from "Założone:"/"Worn:" to the line after the table. */
function comparisonRows(lines, d, id) {
  const head = d.ui["compare.tableWorn"].split("{")[0];
  const from = lines.findIndex((l) => l.startsWith(head));
  if (from < 0) return [];
  const stops = [d.ui["compare.headReplace"].split("{")[0], d.ui["compare.head"], d.items.find((i) => i.id === id).description];
  const end = lines.findIndex((l, i) => i > from && stops.some((s) => l.startsWith(s)));
  return lines.slice(from + 1, end < 0 ? undefined : end);
}

test("opis rzeczy 80×24 (zwykły panel): wiersze tabeli mieszczą się bez zawijania", () => {
  const width = sceneWidth(80);
  const s = wearing(hero(), armor[0].id, "tulow");
  for (const other of armor) {
    for (const l of comparisonRows(card(other.id, s), data, other.id)) assert.ok([...l].length <= width, `${[...l].length}: ${l}`);
  }
});

test("sklep i ekwipunek 80×24 (panel obok szerokiej listy): porównanie w wierszach mieści się bez zawijania, po polsku i po angielsku", async () => {
  const width = sceneWidth(80, true);
  assert.ok(width < TABLE_WIDTH, "przy szerokiej liście tabela przechodzi w wiersze");
  for (const d of [data, await loadData(undefined, { lang: "en" })]) {
    const s = combatState(d, "miecz");
    addItem(s, d, armor[0].id, 1);
    assert.equal(equip(s, d, armor[0].id, "tulow").ok, true);
    const weapons = d.items.filter((i) => i.type === "weapon" && !i.hidden && i.id !== s.inventory.equipped.bron);
    for (const other of [...armor.map((a) => d.items.find((i) => i.id === a.id)), ...weapons]) {
      const lines = strip(renderItemCard(other, s, d, { width })).split("\n");
      for (const l of comparisonRows(lines, d, other.id)) assert.ok([...l].length <= width, `${d.lang ?? ""} ${other.id} ${[...l].length}: ${l}`);
    }
  }
});

// --- the card in a real frame: what does not fit must not push the table out of sight ---
const shopFrame = async (columns, rows, downs, art) => {
  setColorsEnabled(true);
  setRich256(true);
  try {
    const hero = combatState(data, "miecz");
    const state = Object.assign(createNewState({ seed: 1, startScene: "demo_mapa", rules: data.rules }), { character: hero.character, inventory: hero.inventory });
    state.world.location = "wilczy_brod";
    state.world.phenomenonRolledDay = 99;
    state.character.money = 5000;
    const io = createScriptedIO(["1", ...Array(downs).fill("<down>")], { tty: true });
    Object.assign(io, { columns, rows });
    await assert.rejects(defaultHandlers.shop({ state, data, io, rng: createRng(1), notices: [], debug: false }, { id: "x", type: "shop", shop: "kowal_brod", ...(art ? { art } : {}) }), InputExhaustedError);
    return strip(io.output.join("")).split(/(?=█▀ )/).at(-1);
  } finally {
    setColorsEnabled(false);
    setRich256(null);
  }
};

for (const [columns, rows] of [[80, 24], [100, 30], [120, 40], [160, 45], [200, 50]]) {
  for (const art of [null, "kuznie"]) {
    test(`sklep ${columns}×${rows}${art ? " z ilustracją" : ""}: nazwa i tabela widoczne przy każdej rzeczy z półki`, async (t) => {
      if (art && !data.art[art]) return t.skip("brak ilustracji");
      const stock = data.shops.find((s) => s.id === "kowal_brod").stock;
      for (let downs = 0; downs < Math.min(stock.length, 9); downs++) {
        const frame = await shopFrame(columns, rows, downs, art);
        const worn = /Założone: /.test(frame);
        const wearable = /Zakłada się na: /.test(frame);
        assert.ok(wearable || !/Założone: /.test(frame), frame);
        // beside the wide shop list a panel narrower than the table gets the comparison as rows "Waga: 2 kg → 0.5 kg"
        const table = sceneWidth(columns, true) >= TABLE_WIDTH ? /Ta rzecz/ : /Waga: \S.* → \S/;
        if (wearable && worn) assert.match(frame, table, frame);
        assert.doesNotMatch(frame.split("\n").slice(4, 6).join(" "), /Zamiast:/, frame);
      }
    });
  }
}

test("sklep 80×24: pierwsza broń z półki – widać nazwę, miejsce i całą tabelę z wagą", async () => {
  const frame = await shopFrame(80, 24, 0);
  for (const needle of ["Kastet", "Zakłada się na: W ręku", "Założone: Krótki miecz", "Obrażenia", "Waga"]) assert.ok(frame.includes(needle), `${needle}\n${frame}`);
});

test("wąskie okno: przy tabeli nie ma już powtórzonego „Dotychczas w ręku”", () => {
  assert.ok(!card(blade, hero()).some((l) => l.startsWith("Dotychczas w ręku")));
});

test("pusta ręka: linia o pięściach zostaje, bo tabeli nie ma", () => {
  const s = hero();
  s.inventory.equipped.bron = null;
  assert.ok(card(blade, s).some((l) => l.startsWith("Dotychczas w ręku")));
});
