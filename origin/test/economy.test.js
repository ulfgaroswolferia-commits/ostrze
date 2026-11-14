import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";

// Lint ekonomii (wytyczne 5, cykl E2e): każdy przedmiot ma źródło, stopnie rosną z regionem, sklepy i regiony nie są puste.
const data = await loadData();
const itemIds = data.items.map((i) => i.id);
const item = (id) => data.items.find((i) => i.id === id);
/** Upgraded versions (_u1/_u2) come only from a smith's exchange; their base item has the source. */
const isUpgrade = (id) => /_u[12]$/.test(id);

/** Items that nothing hands out on purpose, each with the reason. */
const NO_SOURCE_OK = {
  piesci: "ukryty: pięści, zawsze pod ręką",
  miecz_gwiazd_test: "ukryty: przedmiot testowy artefaktu w slocie broni",
};

/** Walks any JSON and collects the item ids that something hands to the player (not those asked for or taken). */
function collectSources() {
  const sources = new Map();
  const add = (id, from) => { if (typeof id === "string" && itemIds.includes(id)) (sources.get(id) ?? sources.set(id, new Set()).get(id)).add(from); };
  const itemRef = (v) => (typeof v === "string" ? v : v?.id);
  const walk = (node, from) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, from));
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (k === "giveItem") add(itemRef(v), `${from} › giveItem`);
      else if (k === "items" && node.type === "reward") (Array.isArray(v) ? v : []).forEach((x) => add(itemRef(x), `${from} › reward`));
      else walk(v, from);
    }
  };
  for (const shop of data.shops) shop.stock.forEach((s) => add(s.id, `sklep ${shop.id}`));
  for (const table of data.loot.tables) table.entries.forEach((e) => add(e.item, `tabela ${table.id}`));
  for (const cls of data.classes) cls.startItems.forEach((s) => add(s.id, `klasa ${cls.id}`));
  for (const region of Object.values(data.travel.regions)) region.forage.forEach((f) => add(f.item, "zbieractwo"));
  walk(data.enemies, "wróg");
  walk(data.quests, "zlecenie");
  walk(data.travel, "podróże");
  walk(data.story, "fabuła");
  for (const d of data.dialogues) walk(d, `dialog ${d.id}`);
  return sources;
}
const sources = collectSources();
const tablesUsed = () => {
  const used = new Set();
  const scan = (node) => {
    if (Array.isArray(node)) return node.forEach(scan);
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) { if (k === "giveRandom") used.add(v); else scan(v); }
  };
  [data.enemies, data.quests, data.travel, data.story, data.dialogues].forEach(scan);
  return used;
};

test("ekonomia: każdy przedmiot ma źródło (sklep, łup, tabela łupów, znalezisko, nagroda, klasa), wyjątki są jawne", () => {
  const orphans = itemIds.filter((id) => !sources.has(id) && !(id in NO_SOURCE_OK) && !isUpgrade(id));
  assert.deepEqual(orphans, [], "przedmioty, których nikt nie wydaje (dopisz źródło albo jawny wyjątek w NO_SOURCE_OK)");
  for (const id of Object.keys(NO_SOURCE_OK)) assert.ok(item(id)?.hidden === true, `${id}: wyjątek musi być ukryty`);
});

test("ekonomia: tabela łupów, której nikt nie używa, jest martwa", () => {
  const used = tablesUsed();
  const dead = data.loot.tables.map((t) => t.id).filter((id) => !used.has(id) && id !== "lupy_testowe");
  assert.deepEqual(dead, []);
});

test("ekonomia: stopień 4 tylko z łupów elity, tabeli rzadkich, znalezisk i nagród, nigdy ze sklepu", () => {
  for (const i of data.items.filter((x) => x.tier === 4 && !isUpgrade(x.id))) {
    const from = [...(sources.get(i.id) ?? [])];
    assert.ok(from.length > 0, `${i.id}: brak źródła`);
    assert.ok(from.every((f) => !f.startsWith("sklep")), `${i.id}: T4 w sklepie`);
  }
});

test("ekonomia: sklepy poza szkolnymi i wędrownymi mają 10–15 pozycji, a tabele nie wskazują ukrytych przedmiotów", () => {
  for (const shop of data.shops.filter((s) => !["kramarz_szkolny", "kupiec_drogi", "handlarz_wedrowny"].includes(s.id))) {
    assert.ok(shop.stock.length >= 10 && shop.stock.length <= 15, `${shop.id}: ${shop.stock.length}`);
  }
  for (const t of data.loot.tables) for (const e of t.entries) assert.ok(!item(e.item).hidden, `${t.id}: ${e.item}`);
});

test("ekonomia: każdy wróg ma łup, ludzie dropią sprzęt z tabeli, a każdy region ma sklep z bronią, pancerzem i amuletem", () => {
  for (const e of data.enemies.filter((x) => !["instruktor", "upior_zwiadowca", "upior_nocy"].includes(x.id))) assert.ok((e.loot ?? []).length > 0, `${e.id}: brak łupu`);
  const regionShops = { pogorze: ["kramarz_brod", "kowal_brod", "szkarad_ruszniczar"], glusz: ["handlarz_gluszec", "kowal_gluszec_sklep"], gwiazdy: ["zapasy_obserwatorium", "warsztat_brygidy"], front: ["kantyna_frontowa", "kuznia_polowa"], stolica: ["sklep_hurtownika", "szklarz", "kantor_portowy"] };
  for (const [region, ids] of Object.entries(regionShops)) {
    const stock = ids.flatMap((id) => data.shops.find((s) => s.id === id).stock.map((s) => item(s.id)));
    assert.ok(stock.some((i) => i.type === "weapon"), `${region}: broń`);
    assert.ok(stock.some((i) => i.type === "armor" && i.slot !== "talizman"), `${region}: pancerz`);
    assert.ok(stock.some((i) => i.type === "armor" && i.slot === "talizman"), `${region}: amulet`);
  }
});

test("ekonomia: ceny rosną ze stopniem (średnia wartość T1 < T2 < T3) w broni i pancerzu", () => {
  const avgValue = (tier, type) => {
    const list = data.items.filter((i) => i.type === type && i.tier === tier && !i.hidden);
    return list.reduce((s, i) => s + i.value, 0) / list.length;
  };
  for (const type of ["weapon", "armor"]) {
    assert.ok(avgValue(1, type) < avgValue(2, type) && avgValue(2, type) < avgValue(3, type), type);
  }
});

test("ekonomia (recenzja): łupy aktu II (Pogórze) nie dają T3 ani T4", () => {
  const tierOf = (id) => item(id).tier ?? 0;
  for (const table of ["lupy_zbojcy", "lupy_herszt", "lupy_zolnierz", "lupy_znalezisko_pogorze"]) {
    const t = data.loot.tables.find((x) => x.id === table);
    for (const e of t.entries) assert.ok(tierOf(e.item) <= 2, `${table}: ${e.item} T${tierOf(e.item)}`);
  }
  const pogorze = JSON.stringify(data.travel.locations.filter((l) => l.region === "pogorze"));
  assert.ok(!pogorze.includes("lupy_rzadkie"), "T4 w miejscach Pogórza");
  const events = JSON.stringify(data.travel.events.filter((e) => JSON.stringify(e.if ?? {}).includes('"pogorze"')));
  assert.ok(!events.includes("lupy_rzadkie"), "T4 w zdarzeniach Pogórza");
});

test("zlecenia z drogi (recenzja): nie startują już na trasie wychodzącej z huba po końcu jego aktu", () => {
  const END = { pogorze: "akt2_koniec", glusz: "akt3a_koniec", gwiazdy: "akt3b_koniec" };
  for (const e of data.travel.events.filter((x) => x.id.startsWith("prosba_"))) {
    const region = (e.if.all.find((c) => c.region)).region;
    assert.ok(e.if.all.some((c) => c.notFlag === END[region]), `${e.id}: brak notFlag ${END[region]}`);
  }
});
