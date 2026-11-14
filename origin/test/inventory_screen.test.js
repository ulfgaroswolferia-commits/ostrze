import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters, styleText } from "node:util";
import { setColorsEnabled } from "../src/ui/colors.js";
import { showInventory, renderItemCard } from "../src/ui/inventory_screen.js";
import { addItem, countOf, equip, grantStartKit, removeItem } from "../src/systems/inventory.js";
import { itemById } from "../src/systems/items.js";
import { createNewState } from "../src/engine/state.js";
import { advanceTime } from "../src/engine/time.js";
import { createRng } from "../src/engine/dice.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { minimalData } from "./helpers.js";

const data = minimalData();

/** Class kit (sword) + hood + light crossbow, strength 3. List: 1 miecz, 2 kaftan, 3 pas, 4 opatrunek, 5 kaptur, 6 kusza, 7 Wróć. */
function setup(inputs) {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  state.character = {
    name: "T", classId: "miecz", level: 1, xp: 0, money: 0,
    attributes: { sila: 3, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 5, oglada: 5, fart: 5 },
    skillPoints: {}, tagged: [], perks: [], pendingLevelUp: null, hp: 35,
  };
  grantStartKit(state, data, "miecz");
  removeItem(state, data, "prowiant", 2); // keeps the list numbering below
  addItem(state, data, "kaptur_mysliwego", 1);
  addItem(state, data, "kusza_lekka", 1);
  return { state, data, io: createScriptedIO(inputs), rng: createRng(1) };
}
const run = async (inputs) => {
  const ctx = setup(inputs);
  await showInventory(ctx);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError); // every scripted input was consumed
  return ctx;
};

test("pas w linii slotów z liczbą miejsc", async () => {
  const ctx = await run(["7"]);
  assert.match(ctx.io.text(), /Pas: Zwykły pas \(1\/2\)/);
});

test("nagłówek: waga i pieniądze; kusza za ciężka", async () => {
  const ctx = await run(["7"]);
  const out = ctx.io.text();
  assert.match(out, /Waga 12\.2\//);
  assert.match(out, /30 gr/);
  assert.match(out, /Lekka kusza.*za ciężka/);
  assert.match(out, /Krótki miecz \[W ręku\]/);
  assert.doesNotMatch(out, /Pięści/);
});

test("załóż kaptur", async () => {
  const ctx = await run(["5", "1", "7"]);
  assert.equal(ctx.state.inventory.equipped.glowa, "kaptur_mysliwego");
});

test("zdejmij kaftan", async () => {
  const ctx = await run(["2", "2", "7"]);
  assert.equal(ctx.state.inventory.equipped.tulow, undefined);
});

test("zamień broń przenosi miecz na plecy", async () => {
  const ctx = await run(["1", "4", "7"]);
  assert.equal(ctx.state.inventory.equipped.bron_zapas, "miecz_krotki");
  assert.equal(ctx.state.inventory.equipped.bron, undefined);
});

test("kusza trafia na plecy z podmenu", async () => {
  const ctx = await run(["6", "2", "7"]);
  assert.equal(ctx.state.inventory.equipped.bron_zapas, "kusza_lekka");
});

test("użyj opatrunku: leczy, +10 min, notice z HP", async () => {
  const ctx = setup(["4", "3", "7"]);
  ctx.state.character.hp = 10;
  const before = ctx.state.time.minutes;
  await showInventory(ctx);
  assert.ok(ctx.state.character.hp > 10);
  assert.equal(ctx.state.time.minutes, before + 10);
  assert.equal(countOf(ctx.state, "opatrunek"), 1);
  assert.match(ctx.io.text(), /Opatrunek: \+\d+ HP\./);
});

test("użycie przesuwające porę dnia pokazuje zmianę pory", async () => {
  const ctx = setup(["4", "3", "7"]);
  ctx.state.character.hp = 10;
  // Find a clock position from which the 10 minutes of use cross a time-of-day boundary.
  let change;
  for (let m = 0; m < 1440 && !change; m++) {
    const probe = structuredClone(ctx.state);
    probe.time.minutes = m;
    change = advanceTime(probe, data.rules.inventory.useMinutes, data, { int: (min, max) => max }).find((e) => e.type === "zmiana_pory");
    if (change) ctx.state.time.minutes = m;
  }
  assert.ok(change);
  await showInventory(ctx);
  assert.ok(ctx.io.text().includes(data.ui[`time.change.${change.to}`]));
});

test("wyrzuć założonego miecza – wyszarzone z powodem", async () => {
  const ctx = await run(["1", "5", "7", "7"]);
  assert.match(ctx.io.text(), /Wyrzuć Najpierw zdejmij ten przedmiot\. \(niedostępne\)/);
  assert.equal(countOf(ctx.state, "miecz_krotki"), 1);
});

test("wyrzuć 1 z 2 opatrunków: suwak od 1, Gotowe, t", async () => {
  const ctx = await run(["4", "4", "2", "t", "7"]);
  assert.equal(countOf(ctx.state, "opatrunek"), 1);
  assert.match(ctx.io.text(), /Wyrzucono: Opatrunek ×1\./);
});

test("wyrzuć oba opatrunki: suwak 1+, stos znika z listy i z pasa", async () => {
  const ctx = await run(["4", "4", "1+", "2", "t", "6"]);
  assert.equal(countOf(ctx.state, "opatrunek"), 0);
  assert.deepEqual(ctx.state.inventory.quickSlots, []);
});

test("wyrzuć: n anuluje", async () => {
  const ctx = await run(["4", "4", "2", "n", "7"]);
  assert.equal(countOf(ctx.state, "opatrunek"), 2);
});

test("zdjęcie pasa przycina szybkie miejsca i pokazuje notice", async () => {
  const ctx = await run(["3", "2", "7"]);
  assert.equal(ctx.state.inventory.equipped.pas, undefined);
  assert.match(ctx.io.text(), /Z pasa trafia do torby: Opatrunek\./);
});

test("opis pokazuje kartę przedmiotu", async () => {
  const ctx = await run(["6", "6", "", "w", "7"]); // no explosive bolts in the bag, so no load toggle: 5 Wyrzuć, 6 Opis
  assert.match(ctx.io.text(), /Napina się szybko, o udo[\s\S]*\[Enter\] dalej/);
  // after the card the item's action list comes back, not the item list
  const afterCard = ctx.io.text().split("[Enter] dalej").pop();
  assert.ok(afterCard.includes("Opis")); // the item list itself has no "Opis" entry
});

test("renderItemCard: kusza i kaftan", () => {
  const state = setup([]).state;
  const kusza = renderItemCard(itemById(data, "kusza_lekka"), state, data);
  assert.match(kusza, /8–14/);
  assert.match(kusza, /3 PA/);
  assert.match(kusza, /Waga 4/);
  const kaftan = renderItemCard(itemById(data, "kaftan_przeszywany"), state, data);
  assert.match(kaftan, /sieczne 15%/);
  assert.match(kaftan, /Skradanie/i);
});

test("użyj bimbru: komunikat o efekcie, bez „+0 HP”", async () => {
  const ctx = setup(["7", "3", "7"]); // 7 = bimber (after kit, hood, crossbow); once drunk, 7 = Wróć
  addItem(ctx.state, data, "bimber", 1);
  await showInventory(ctx);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  assert.ok(ctx.state.character.effects.some((e) => e.id === "podchmielenie"));
  assert.match(ctx.io.text(), /Jesteś teraz: Podchmielony\./);
  assert.doesNotMatch(ctx.io.text(), /Bimber: \+/);
});

test("sztylet: akcja Załóż do drugiej ręki, linia slotów z Drugą ręką", async () => {
  const ctx = setup(["7", "3", "8"]);
  addItem(ctx.state, data, "sztylet", 1);
  await showInventory(ctx);
  assert.equal(ctx.state.inventory.equipped.bron_druga, "sztylet");
  assert.match(ctx.io.text(), /Druga ręka: Sztylet/);
  assert.match(ctx.io.text(), /Załóż do drugiej ręki/);
});
test("miecz: brak akcji Załóż do drugiej ręki", async () => {
  const ctx = await run(["1", "w", "7"]);
  assert.doesNotMatch(ctx.io.text(), /Załóż do drugiej ręki/);
});

test("przełącznik w ekwipunku zmienia loadExplosive i ładowanie po walce", async () => {
  const { loadWorn } = await import("../src/systems/inventory.js");
  // kusza (6) → toggle (5) stays in the submenu → toggle again (5) → toggle (5) → Wróć (w) → Wróć (w)
  const ctx = setup(["6", "5", "5", "5", "w", "w"]);
  const { state } = ctx;
  state.character.attributes.sila = 6; // the light crossbow needs more than the kit's strength
  addItem(state, data, "belt", 10);
  addItem(state, data, "belt_wybuchowy", 3);
  await showInventory(ctx);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  const out = stripVTControlCharacters(ctx.io.text());
  assert.ok(out.includes(data.ui["inv.loadExplosiveOn"]));
  assert.ok(out.includes(data.ui["inv.loadExplosiveOff"]));
  assert.equal(state.inventory.loadExplosive, true, "trzy przełączenia: włączone");

  // After a fight the empty crossbow in hand takes the explosive bolts.
  assert.equal(equip(state, data, "kusza_lekka", "bron").ok, true);
  state.inventory.loaded = { kusza_lekka: 0 };
  loadWorn(state, data);
  assert.equal(state.inventory.loadedAmmo.kusza_lekka, "belt_wybuchowy");
  // Switched off: the plain bolts go in.
  state.inventory.loadExplosive = false;
  state.inventory.loaded = { kusza_lekka: 0 };
  addItem(state, data, "belt_wybuchowy", 1);
  loadWorn(state, data);
  assert.equal(state.inventory.loadedAmmo.kusza_lekka, "belt");
});

test("przełącznik tylko przy broni, do której są wybuchowe naboje", async () => {
  const ctx = setup(["1", "w", "w"]);
  addItem(ctx.state, data, "belt_wybuchowy", 3);
  await showInventory(ctx);
  assert.ok(!ctx.io.text().includes(data.ui["inv.loadExplosiveOn"]));
});

test("przełącznik włączony: przy łuku i pistolecie go nie ma", async () => {
  for (const id of ["luk_mysliwski", "pistolet_skalkowy"]) {
    const ctx = setup(["7", "w", "w"]); // the added weapon is 7th, after the crossbow
    ctx.state.inventory.loadExplosive = true;
    addItem(ctx.state, data, id, 1);
    addItem(ctx.state, data, "belt_wybuchowy", 3);
    await showInventory(ctx);
    await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
    const out = stripVTControlCharacters(ctx.io.text());
    assert.ok(out.includes(itemById(data, id).name), id);
    assert.ok(!out.includes(data.ui["inv.loadExplosiveOff"]), id);
    assert.ok(!out.includes(data.ui["inv.loadExplosiveOn"]), id);
  }
});

test("przełącznik ukryty przy kuszy, gdy w torbie nie ma wybuchowych", async () => {
  const ctx = setup(["6", "w", "w"]);
  addItem(ctx.state, data, "belt", 10);
  await showInventory(ctx);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  const out = ctx.io.text();
  assert.ok(!out.includes(data.ui["inv.loadExplosiveOn"]));
  assert.ok(!out.includes(data.ui["inv.loadExplosiveOff"]));
});

test("przełącznik włączony bez wybuchowych w torbie: widać go i da się wyłączyć", async () => {
  const ctx = setup(["6", "5", "w", "w"]); // crossbow → toggle (5) → the submenu has no toggle now → Wróć
  ctx.state.inventory.loadExplosive = true;
  await showInventory(ctx);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  assert.ok(ctx.io.text().includes(data.ui["inv.loadExplosiveOff"]));
  assert.equal(ctx.state.inventory.loadExplosive, false);
});

test("na plecy nie założysz broni tego samego rodzaju co ta w ręku; innego rodzaju – tak", async () => {
  const { equip } = await import("../src/systems/inventory.js");
  const ctx = setup([]);
  const { state } = ctx;
  addItem(state, data, "sztylet", 1); // a sword-class weapon like the short sword in hand
  assert.equal(equip(state, data, "sztylet", "bron_zapas").reason, "inv.sameKind");
  assert.equal(state.inventory.equipped.bron_zapas, undefined);
  assert.equal(equip(state, data, "kusza_lekka", "bron_zapas").ok, true, "inny rodzaj");
  assert.equal(state.inventory.equipped.bron_zapas, "kusza_lekka");
});

/** The rows of the item list from the frame last drawn (terminal mode, colours on). */
function listRows(io) {
  const out = io.output.join("");
  return out.slice(out.lastIndexOf("\x1b[2J")).split("\n").map((l) => l.split("▒").pop()).filter((l) => l.includes("Wróć") || /[▶ ] \[\d+\] /.test(stripVTControlCharacters(l)));
}

test("lista: założone rzeczy na górze i w kolorze, reszta w kolejności z torby, a torba się nie zmienia", async () => {
  setColorsEnabled(true);
  try {
    const ctx = setup([]);
    ctx.io = createScriptedIO(["<esc>"], { tty: true });
    Object.assign(ctx.io, { columns: 120, rows: 40 });
    equip(ctx.state, data, "kaptur_mysliwego", "glowa");
    const bag = ctx.state.inventory.items.map((s) => s.id);
    await assert.rejects(showInventory(ctx), InputExhaustedError);
    const rows = listRows(ctx.io);
    const plain = rows.map((r) => stripVTControlCharacters(r));
    const at = (name) => plain.findIndex((r) => r.includes(name));
    const worn = ["Krótki miecz", "Kaptur", "Zwykły pas"].map(at);
    const free = ["Opatrunek", "Lekka kusza"].map(at);
    assert.ok(worn.every((i) => i >= 0) && free.every((i) => i >= 0), plain.join("\n"));
    assert.ok(Math.max(...worn) < Math.min(...free), plain.join("\n"));
    assert.ok(at("Opatrunek") < at("Lekka kusza"), "reszta jak w torbie");
    const green = (name) => rows[at(name)].includes(styleText("greenBright", "x", { validateStream: false }).split("x")[0]);
    assert.ok(["Krótki miecz", "Kaptur", "Zwykły pas"].every(green), rows.join("\n"));
    assert.ok(!["Opatrunek", "Lekka kusza"].some(green), rows.join("\n"));
    assert.deepEqual(ctx.state.inventory.items.map((s) => s.id), bag);
  } finally { setColorsEnabled(false); }
});

test("kursor idzie za przedmiotem, który po założeniu przeskoczył na górę listy", async () => {
  const ctx = setup([]);
  ctx.io = createScriptedIO(["5", "1"], { tty: true });
  Object.assign(ctx.io, { columns: 120, rows: 40 });
  await assert.rejects(showInventory(ctx), InputExhaustedError);
  assert.equal(ctx.state.inventory.equipped.glowa, "kaptur_mysliwego");
  const cursor = listRows(ctx.io).map((r) => stripVTControlCharacters(r)).find((r) => r.includes("▶"));
  assert.match(cursor, /Kaptur/);
});

/** The scene panel's rows of the frame last drawn by the inventory, in a window of the given size. */
async function inventoryFrame(columns, rows, change = () => {}) {
  const ctx = setup([]);
  ctx.io = createScriptedIO([], { tty: true });
  Object.assign(ctx.io, { columns, rows });
  change(ctx);
  await assert.rejects(showInventory(ctx), InputExhaustedError);
  const out = stripVTControlCharacters(ctx.io.output.join(""));
  return out.slice(out.lastIndexOf("\x1b[2J") >= 0 ? out.lastIndexOf("█▀") : 0).split("\n");
}

test("schemat slotów: wszystkie sloty na ciele, założone po nazwie, puste jako „pusto”, pas z miejscami, ramka równa", async () => {
  const rows = await inventoryFrame(110, 36);
  const text = rows.join("\n");
  for (const slot of ["Talizman", "Głowa", "Płaszcz", "W ręku", "Tułów", "Druga ręka", "Ręce", "Pas", "Na plecach", "Nogi"]) assert.match(text, new RegExp(`─ ${slot} `), slot);
  assert.match(text, /│ Krótki miecz +│/);
  assert.match(text, /│ Kaftan przeszywany +│/);
  assert.match(text, /│ Zwykły pas 1\/2 +│/);
  assert.match(text, /│ pusto +│/);
  assert.equal(rows.filter(Boolean).every((row) => [...row].length === 110), true, "schemat nie rozpycha ramki");
});

test("schemat slotów: założony artefakt ma ładunek w procentach", async () => {
  const rows = await inventoryFrame(160, 40, ({ state }) => {
    addItem(state, data, "kamien_zmierzchu", 1);
    equip(state, data, "kamien_zmierzchu", "talizman");
    state.artifacts.kamien_zmierzchu.charge = 86;
  });
  assert.match(rows.join("\n"), /│ Kamień Zmierzchu 86% +│/);
});

test("schemat slotów: w niskim oknie sloty zostają w jednej linii, żeby karta przedmiotu się mieściła", async () => {
  const text = (await inventoryFrame(80, 24)).join("\n");
  assert.doesNotMatch(text, /┌─ Talizman/);
  assert.match(text, /W ręku: Krótki miecz/);
  assert.match((await inventoryFrame(80, 30)).join("\n"), /┌─ Talizman/);
});

test("schemat slotów: przy parze broni druga ręka nie udaje pustej", async () => {
  const text = (await inventoryFrame(110, 36, ({ state }) => {
    addItem(state, data, "para_wloczni", 1);
    equip(state, data, "para_wloczni", "bron");
  })).join("\n");
  assert.match(text, /│ para w obu rękach +│/);
});
