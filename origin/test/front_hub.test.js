import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { walkMinutes, routeById } from "../src/systems/travel.js";

const data = await loadData();
const loc = (id) => data.travel.locations.find((l) => l.id === id);
const HUB = "oboz_wronia";
const NEAR = ["przeprawa_szarej", "pole_bitwy", "spalona_wies", "ruiny_fortu", "oboz_cesarski_przedni"];
const FAR = "wzgorze_wisielcow";

test("front: region, hub i lokacje istnieją, dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  assert.ok(data.travel.regions.front, "region front");
  assert.equal(loc(HUB).region, "front");
  assert.equal(loc(HUB).name, "Obóz na Wroniej Górze");
  for (const id of [...NEAR, FAR]) assert.equal(loc(id)?.region, "front", id);
});

test("front: trzy klasy odległości (bliskie ≤ 60 min, średnie 90–480 min, dalekie podróżą), reszta lokacji ukryta z podpowiedzią", () => {
  const minutes = Object.fromEntries(NEAR.map((id) => [id, walkMinutes(data, HUB, id)]));
  assert.ok(minutes.przeprawa_szarej <= 60);
  for (const id of NEAR.filter((x) => x !== "przeprawa_szarej")) assert.ok(minutes[id] >= 90 && minutes[id] <= 480, `${id}: ${minutes[id]}`);
  assert.equal(minutes.ruiny_fortu, walkMinutes(data, HUB, "przeprawa_szarej") + 150, "fort leży za przeprawą");
  assert.equal(routeById(data, loc(FAR).far.route).days, 3);
  for (const id of [...NEAR.filter((x) => x !== "przeprawa_szarej"), FAR]) assert.ok(loc(id).secret && loc(id).hint, `${id}: ukryte`);
  assert.ok(!loc("przeprawa_szarej").secret);
  assert.equal(routeById(data, loc("oboz_jarnowian_przedni").far.route).days, 2, "obóz Jarnowian leży dwa dni za rzeką");
  assert.ok(loc("oboz_jarnowian_przedni").secret && loc("oboz_jarnowian_przedni").hint);
});

test("front: każda lokacja ma co najmniej dwa miejsca, a dalekie miejsce trzy", () => {
  for (const id of NEAR) assert.ok(loc(id).spots.length >= 2, id);
  assert.ok(loc(FAR).spots.length >= 3);
});

test("front: hub ma sztab, kantynę, kuźnię, lazaret, ognisko i tablicę", () => {
  const ids = loc(HUB).spots.map((s) => s.id);
  for (const id of ["namiot_sztabu", "kantyna", "kuznia_polowa", "lazaret", "ognisko", "tablica_front"]) assert.ok(ids.includes(id), id);
});

test("front: każda lokacja ma marker na mapie tekstowej, a trasa z Obserwatorium trwa trzy dni", () => {
  const tokens = new Set([...data.maps.front.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]));
  for (const id of [HUB, ...NEAR, FAR]) assert.ok(tokens.has(id), id);
  const r = routeById(data, "obserwatorium_front");
  assert.deepEqual([r.from, r.to, r.days, r.region], ["obserwatorium", HUB, 3, "gwiazdy"]);
});

test("front: zmienna zlecenia_frontu jest dozwolona w regułach", () => {
  assert.ok(data.rules.vars.includes("zlecenia_frontu"));
});

// --- sklepy, ludzie w obozie, pogadanki i popchnięcia (Task 3) ---
import { evaluate } from "../src/engine/conditions.js";
import { createNewState } from "../src/engine/state.js";
import { combatState } from "./helpers.js";

const shop = (id) => data.shops.find((s) => s.id === id);
const item = (id) => data.items.find((i) => i.id === id);
const spot = (id) => loc(HUB).spots.find((s) => s.id === id);

test("front: kantyna i kuźnia mają 10–15 pozycji, kuźnia sprzedaje T2–T3, nic nie jest T4", () => {
  for (const id of ["kantyna_frontowa", "kuznia_polowa"]) {
    const n = shop(id).stock.length;
    assert.ok(n >= 10 && n <= 15, `${id}: ${n}`);
    for (const s of shop(id).stock) assert.ok((item(s.id).tier ?? 0) <= 3, `${id}: ${s.id}`);
    assert.ok(shop(id).buys.includes("material"));
  }
  const stock = ["kantyna_frontowa", "kuznia_polowa"].flatMap((id) => shop(id).stock.map((s) => item(s.id)));
  assert.ok(stock.some((i) => i.type === "weapon"));
  assert.ok(stock.some((i) => i.type === "armor" && i.slot !== "talizman"));
  assert.ok(stock.some((i) => i.type === "armor" && i.slot === "talizman"));
  assert.ok(stock.some((i) => i.type === "consumable"));
  assert.ok(shop("kuznia_polowa").stock.some((s) => item(s.id).tier === 3));
});

test("front: spoty obozu są prawdziwe (sztab z kapitanem, sklepy, lazaret z medyczką, nocleg, ognisko z czterema stanami)", () => {
  assert.deepEqual([spot("namiot_sztabu").type, spot("namiot_sztabu").ref], ["talk", "kapitan"]);
  assert.equal(spot("kantyna").type, "scene");
  assert.ok(spot("kantyna").scenes.some((s) => s.type === "shop" && s.shop === "kantyna_frontowa"));
  assert.ok(spot("kantyna").scenes.some((s) => s.type === "dialogue" && s.dialogue === "kantyna"));
  assert.deepEqual([spot("kuznia_polowa").type, spot("kuznia_polowa").ref], ["shop", "kuznia_polowa"]);
  assert.deepEqual([spot("lazaret").type, spot("lazaret").ref], ["talk", "medyczka"]);
  assert.equal(spot("nocleg").type, "rest");
  assert.ok(spot("ognisko").scenes.filter((s) => s.type === "narration").length >= 4);
  for (const id of ["kapitan", "medyczka"]) assert.ok(data.dialogues.some((d) => d.id === id), id);
});

const hubState = () => {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  return state;
};
const visitor = (id) => loc(HUB).visitors.find((v) => v.id === id);

test("front: sojusznicy z Aktu III pojawiają się jako goście tylko z odpowiednią flagą", () => {
  for (const [id, flag] of [["tomasz_na_froncie", "sojusz_dezerter"], ["wedrowcy_na_froncie", "sojusz_wedrowcy"], ["stary_zolnierz_na_froncie", "sojusz_straznicy"]]) {
    const v = visitor(id);
    assert.ok(v && !v.forced && v.chance === 100, id);
    const state = hubState();
    assert.equal(evaluate(v.if, state, data), false, `${id}: bez flagi`);
    state.flags[flag] = true;
    assert.equal(evaluate(v.if, state, data), true, `${id}: z flagą`);
  }
});

test("front: kapitan sam wzywa po trzech zleceniach (popchnięcie), a po wyjściu do stolicy przestaje", () => {
  const v = visitor("kapitan_wola");
  assert.ok(v && !v.forced);
  const state = hubState();
  assert.equal(evaluate(v.if, state, data), false);
  state.vars.zlecenia_frontu = 3;
  assert.equal(evaluate(v.if, state, data), true);
  state.flags.akt4a_koniec = true;
  assert.equal(evaluate(v.if, state, data), false);
  assert.equal(loc(HUB).visitors.at(-1).id, "kapitan_wola", "popchnięcie po sojusznikach, by ich nie zagłuszało");
});

// --- zdarzenia na drogach frontu (Task 5) ---
const regionOfEvent = (e) => (e.if?.region ?? (e.if?.all ?? []).find((c) => c.region)?.region ?? null);
const ownEvents = () => data.travel.events.filter((e) => regionOfEvent(e) === "front");
const dlg = (id) => data.dialogues.find((d) => d.id === id);
const dlgActions = (d) => Object.values(d.nodes).flatMap((n) => [...(n.actions ?? []), ...(n.options ?? []).flatMap((o) => o.actions ?? [])]);

test("front: co najmniej dziesięć zdarzeń regionu, a dostępnych (z ogólnymi) dwanaście", () => {
  assert.ok(ownEvents().length >= 10, `jest ${ownEvents().length}`);
  const available = data.travel.events.filter((e) => e.weight > 0 && [null, "front"].includes(regionOfEvent(e)));
  assert.ok(available.length >= 12, `dostępnych ${available.length}`);
  assert.deepEqual(validateData(data), []);
});

test("front: ≥3 ataki z ucieczką i nowymi wrogami, ≥3 znaleziska z tabeli łupów, handlarz z towarem, jeniec i sytuacja moralna", () => {
  const own = ownEvents();
  const attacks = own.filter((e) => e.kind === "attack");
  assert.ok(attacks.length >= 3);
  for (const e of attacks) {
    const fights = e.scenes.filter((s) => s.type === "combat");
    assert.ok(fights.length >= 1 && fights.every((f) => f.canFlee && e.scenes.some((s) => s.id === f.onFlee)), e.id);
  }
  const NEWENEMY = new Set(["jarnowski_strzelec", "jarnowski_kowal", "jarnowski_zwiadowca", "cesarski_pikinier", "cesarski_kusznik", "szabrownik"]);
  const usedNew = new Set(attacks.flatMap((e) => e.scenes.filter((s) => s.type === "combat").flatMap((s) => s.enemies.map((x) => x.id))).filter((id) => NEWENEMY.has(id)));
  assert.ok(usedNew.size >= 4, `nowi wrogowie w atakach: ${[...usedNew]}`);
  const finds = own.filter((e) => e.scenes.some((s) => s.type === "dialogue" && dlgActions(dlg(s.dialogue)).some((a) => a.giveRandom)));
  assert.ok(finds.length >= 3, `znaleziska ${finds.length}`);
  const trader = own.find((e) => e.scenes.some((s) => s.type === "shop" && s.shop === "wedrowny_front"));
  assert.ok(trader && shop("wedrowny_front").stock.length >= 8);
  assert.ok(shop("wedrowny_front").stock.every((s) => (item(s.id).tier ?? 0) <= 3));
  assert.ok(own.some((e) => e.id.startsWith("spotkanie_") && e.kind === "encounter" && !e.scenes.some((s) => s.type === "shop")), "pogadanka z jeńcem lub podobna");
  assert.ok(own.some((e) => e.scenes.some((s) => s.type === "dialogue" && dlgActions(dlg(s.dialogue)).some((a) => a.addVar?.wola))), "sytuacja moralna z wolą");
});

test("front: droga z Obserwatorium losuje zdarzenia regionu i fabularne, bez zdarzenia na sztywno", () => {
  const r = routeById(data, "obserwatorium_front");
  assert.equal(r.fixed, undefined);
});
