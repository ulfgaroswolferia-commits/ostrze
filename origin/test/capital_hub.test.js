import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { walkMinutes, routeById } from "../src/systems/travel.js";
import { minimalData, combatState, playFight } from "./helpers.js";
import { createRng } from "../src/engine/dice.js";
import { createCombat } from "../src/systems/combat/state.js";
import { attackTargets, playerActions } from "../src/systems/combat/actions.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";

const data = await loadData();
const loc = (id) => data.travel.locations.find((l) => l.id === id);
const HUB = "ulfgrod";
const NEAR = ["targ_pod_murem", "zaulek_szklarzy", "dom_ciszy", "port_rzeczny", "palac"];
const FAR = ["koszary", "cmentarz_zbiorowy", "stare_wodociagi", "opuszczony_klasztor"];
const shop = (id) => data.shops.find((s) => s.id === id);
const item = (id) => data.items.find((i) => i.id === id);
const dlg = (id) => data.dialogues.find((d) => d.id === id);

test("stolica: region, hub i lokacje istnieją, dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  assert.ok(data.travel.regions.stolica);
  assert.equal(loc(HUB).region, "stolica");
  for (const id of [...NEAR, ...FAR]) assert.equal(loc(id)?.region, "stolica", id);
  const r = routeById(data, "oboz_wronia_ulfgrod");
  assert.deepEqual([r.from, r.to, r.days, r.region], ["oboz_wronia", HUB, 3, "front"]);
  assert.ok(data.rules.vars.includes("zlecenia_stolicy"));
});

test("stolica: odległości – bliskie ≤ 60, średnie 90–480, dalekie 3 i 4 dni, ukryte z podpowiedzią", () => {
  const minutes = Object.fromEntries(NEAR.map((id) => [id, walkMinutes(data, HUB, id)]));
  assert.ok(minutes.targ_pod_murem <= 60 && minutes.zaulek_szklarzy <= 60);
  for (const id of NEAR.filter((x) => !["targ_pod_murem", "zaulek_szklarzy"].includes(x))) assert.ok(minutes[id] >= 90 && minutes[id] <= 480, `${id}: ${minutes[id]}`);
  assert.deepEqual(FAR.map((id) => routeById(data, loc(id).far.route).days).sort(), [1, 1, 3, 4]);
  for (const id of ["palac", ...FAR]) assert.ok(loc(id).secret && loc(id).hint, id);
  assert.ok(!loc("targ_pod_murem").secret);
});

test("stolica: mapa tekstowa ma znaczniki wszystkich lokacji", () => {
  const tokens = new Set([...data.maps.stolica.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]));
  for (const id of [HUB, ...NEAR, ...FAR]) assert.ok(tokens.has(id), id);
});

test("stolica: hub ma karczmę, nocleg, tablicę, sklep, Smyka i fontannę; każda lokacja ma co najmniej dwa miejsca", () => {
  const ids = loc(HUB).spots.map((s) => s.id);
  for (const id of ["karczma", "nocleg", "tablica_ulfgrod", "sklep_hurtownika", "smyk_ulica", "fontanna"]) assert.ok(ids.includes(id), id);
  for (const id of [...NEAR, ...FAR]) assert.ok(loc(id).spots.length >= 2, id);
});

test("stolica: sklepy 8–15 pozycji, bez T4; sklep hurtownika sprzedaje T3", () => {
  for (const id of ["sklep_hurtownika", "szklarz", "kantor_portowy"]) {
    const s = shop(id);
    assert.ok(s.stock.length >= 8 && s.stock.length <= 15, `${id}: ${s.stock.length}`);
    for (const x of s.stock) assert.ok((item(x.id).tier ?? 0) <= 3, `${id}: ${x.id}`);
    assert.ok(s.buys.includes("material"));
  }
  assert.ok(shop("sklep_hurtownika").stock.some((x) => item(x.id).tier === 3));
});

test("stolica: rozmówcy mają dialogi bez ślepych węzłów, a miasto reaguje na co najmniej trzy flagi frontu", () => {
  const ids = ["hjalmar", "smyk", "przekupka", "szulerzy", "siostra_domu_ciszy", "kwatermistrz_koszar"];
  for (const id of ids) {
    const d = dlg(id);
    assert.ok(d, id);
    for (const [nid, n] of Object.entries(d.nodes)) assert.ok((n.options ?? []).length >= 1, `${id}.${nid}`);
  }
  const text = JSON.stringify(ids.map(dlg));
  const flags = new Set([...text.matchAll(/"wojna_[a-z_]+"/g)].map((m) => m[0]));
  assert.ok(flags.size >= 3, `flagi frontu: ${[...flags]}`);
});

test("stolica: każda lokacja (poza pałacem) ma pogadankę z co najmniej czterema stanami", () => {
  for (const id of [HUB, ...NEAR.filter((x) => x !== "palac"), ...FAR]) {
    assert.ok(loc(id).spots.some((s) => (s.scenes ?? []).length >= 4), `${id}: brak pogadanki`);
  }
});

const NEWE = ["kieszonkowiec", "cesarski_weszyciel", "patrol_miejski", "rzezimieszek_z_portu"];
test("stolica: czterej wrogowie miejscy mają grafikę, biernik i łup z tabeli bez T4", () => {
  for (const id of NEWE) {
    const e = data.enemies.find((x) => x.id === id);
    assert.ok(e && data.art[e.art] && e.nameAcc && e.loot.some((l) => l.giveRandom), id);
  }
  for (const e of data.loot.tables.find((t) => t.id === "lupy_miasto").entries) assert.ok((item(e.item).tier ?? 0) <= 3, e.item);
});

const AMBUSHES = [["ulfgrod", "karczma"], ["targ_pod_murem", "przekupka"], ["koszary", "kwatermistrz"], ["port_rzeczny", "kantor_portowy"]];
test("stolica: zasadzki przy wejściach mają walkę z ucieczką i porażką oraz cztery wyjścia (walka, wymowa, skradanie, ucieczka)", () => {
  for (const [l, s] of AMBUSHES) {
    const spot = loc(l).spots.find((x) => x.id === s);
    const a = spot.ambush;
    assert.ok(a && a.chance >= 1, `${l}.${s}`);
    const combat = a.scenes.find((x) => x.type === "combat");
    assert.ok(combat && combat.canFlee && a.scenes.some((x) => x.id === combat.onFlee) && a.scenes.some((x) => x.id === combat.onDefeat), `${l}.${s}: walka`);
    const d = dlg(a.scenes.find((x) => x.type === "dialogue").dialogue);
    const opts = d.nodes[d.start].options;
    assert.ok(opts.some((o) => o.check?.skill === "wymowa") && opts.some((o) => o.check?.skill === "skradanie") && opts.length >= 4, `${l}.${s}: wyjścia`);
    assert.equal(a.scenes.at(-1).goto, undefined, `${l}.${s}: ostatnia scena spada w scenę miejsca`);
    for (const x of a.scenes.filter((y) => y.type === "narration" && /uciek|porazk/.test(y.id))) assert.equal(x.goto, "koniec");
  }
  assert.ok(loc("koszary").spots.find((s) => s.id === "kwatermistrz").ambush.if, "koszary: tylko przy podwyższonym search");
});

// --- balans (poziom 4, Ostrze, T2) ---
const mdata = minimalData();
function cityHero(classId) {
  const state = combatState(mdata, classId);
  const blade = classId === "miecz" ? "ostrze_gwiazd_bogdana" : "para_gwiazd_bogdana";
  for (const id of [blade, "skorznia_nabijana", "helm_zelazny"]) addItem(state, mdata, id, 1);
  equip(state, mdata, blade, "bron");
  equip(state, mdata, "skorznia_nabijana", "tulow");
  equip(state, mdata, "helm_zelazny", "glowa");
  state.character.level = 4;
  state.character.hp = getStats(state, mdata).derived.hpMax;
  return state;
}
function strat(state, d, combat) {
  const actions = playerActions(state, d, combat);
  const can = (id) => !actions.find((a) => a.id === id).disabled;
  if (state.character.hp < 0.4 * getStats(state, d).derived.hpMax && can("use")) return { id: "use", itemId: "opatrunek" };
  if (can("attack")) return { id: "attack", target: attackTargets(state, d, combat)[0] };
  const far = combat.enemies.find((e) => !e.dead && !e.fled && e.band === "far");
  if (far && can("move")) return { id: "move", target: far.uid };
  return null;
}
function rate(enemies) {
  let wins = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const state = cityHero("miecz");
    const combat = createCombat(state, mdata, { enemies, start: "far", canFlee: true, id: "city_sim" }, rng);
    if (playFight(state, mdata, combat, rng, strat).outcome === "win") wins++;
  }
  return wins / 200;
}
for (const [label, enemies, lo, hi] of [
  ["kieszonkowcy ×2", [{ id: "kieszonkowiec", count: 2 }], 0.85, 1],
  ["rzezimieszek solo", [{ id: "rzezimieszek_z_portu", count: 1 }], 0.8, 1],
  ["węszyciel solo", [{ id: "cesarski_weszyciel", count: 1 }], 0.8, 1],
  ["patrol miejski ×2", [{ id: "patrol_miejski", count: 2 }], 0.4, 0.95],
  ["węszyciel + rzezimieszek", [{ id: "cesarski_weszyciel", count: 1 }, { id: "rzezimieszek_z_portu", count: 1 }], 0.5, 0.95],
]) {
  test(`symulacja stolicy: ${label} – wygrane w widełkach ${lo}–${hi}`, (t) => {
    const r = rate(enemies);
    t.diagnostic(`${label}: ${r}`);
    assert.ok(r >= lo && r <= hi, `${r} poza ${lo}–${hi}`);
  });
}

// --- zdarzenia na ulicach i traktach stolicy (poprawki po recenzji) ---
const regionOfEvent = (e) => (e.if?.region ?? (e.if?.all ?? []).find((c) => c.region)?.region ?? null);
test("stolica: co najmniej dwanaście zdarzeń regionu, ataki z ucieczką i porażką bez śmierci, wilki nie wchodzą do miasta", async () => {
  const { evaluate } = await import("../src/engine/conditions.js");
  const { createNewState } = await import("../src/engine/state.js");
  const own = data.travel.events.filter((e) => regionOfEvent(e) === "stolica");
  assert.ok(own.length >= 12, `jest ${own.length}`);
  const attacks = own.filter((e) => e.kind === "attack");
  assert.ok(attacks.length >= 4);
  for (const e of attacks) {
    const fight = e.scenes.find((s) => s.type === "combat");
    assert.ok(fight.canFlee && e.scenes.some((s) => s.id === fight.onFlee) && e.scenes.some((s) => s.id === fight.onDefeat), e.id);
  }
  const wilki = data.travel.events.find((e) => e.id === "wilki");
  const city = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  city.world = { ...(city.world ?? {}), location: HUB };
  assert.equal(evaluate(wilki.if, city, data), false, "wilki w mieście");
  assert.ok(shop(own.flatMap((e) => e.scenes).find((s) => s.type === "shop").shop));
  assert.deepEqual(validateData(data), []);
});

test("zasadzki: nieudany rzut w wymowie lub skradaniu nie blokuje opcji przy następnej zasadzce (retry)", () => {
  for (const [l, s] of AMBUSHES) {
    const a = loc(l).spots.find((x) => x.id === s).ambush;
    const d = dlg(a.scenes.find((x) => x.type === "dialogue").dialogue);
    for (const o of d.nodes[d.start].options.filter((x) => x.check)) assert.equal(o.retry, true, `${l}.${s}.${o.id}`);
  }
});

test("kwatermistrz: po nieudanym kłamstwie nie obiecuje drugiej próby, tylko odsyła do świątyni", () => {
  const n = dlg("kwatermistrz_koszar").nodes.falsz_pudlo;
  assert.doesNotMatch(n.text, /wróci/i);
  assert.match(n.text, /świątyni|Dom[u]? Ciszy/);
});

test("stolica: mapa tekstowa zgadza się z podpowiedziami kierunków i czasami marszu (wszystko odchodzi od huba)", () => {
  const pos = {};
  data.maps.stolica.split("\n").forEach((line, row) => { for (const m of line.matchAll(/\{([a-z0-9_]+)\}/g)) pos[m[1]] = { row, col: m.index + m[0].length / 2 }; });
  for (const id of NEAR) assert.equal(loc(id).near.via, undefined, `${id}: czas liczony od huba, więc mapa nie może rysować go za inną lokacją`);
  assert.ok(pos.port_rzeczny.col < pos[HUB].col, "port „za zachodnią bramą”");
  assert.match(loc("port_rzeczny").hint, /zachodni/);
  assert.match(loc("cmentarz_zbiorowy").hint, /wschód/);
  assert.match(loc("koszary").hint, /północ/);
  const lines = data.maps.stolica.split("\n");
  for (const id of NEAR) assert.ok(!lines[pos[id].row].includes("--") || lines[pos[id].row].includes(`{${HUB}}`) || id === "palac", `${id}: nie rysujemy go za innym miejscem`);
});

test("pałac: schody dla służby mają warianty pory dnia (nie przykrywa ich scena „późno”), a noc wskazuje komnatę", () => {
  const spot = loc("palac").spots.find((s) => s.id === "schody_sluzby");
  assert.ok(!spot.scenes.some((s) => /_pozno$/.test(s.id)), "martwa scena późno");
  const night = spot.scenes.find((s) => s.id === "schody_sluzby_noc");
  assert.match(night.text, /komnat/i);
  assert.match(spot.scenes.find((s) => s.id === "schody_sluzby_dzien").text, /noc/i);
});

const POZNO_SPOTS = [["ulfgrod", "fontanna"], ["targ_pod_murem", "plotki"], ["zaulek_szklarzy", "pracownia_alchemika"], ["dom_ciszy", "krypta_ciszy"], ["port_rzeczny", "nabrzeze"], ["koszary", "plac_apelowy"], ["cmentarz_zbiorowy", "grabarz"], ["stare_wodociagi", "kanal_glowny"], ["opuszczony_klasztor", "refektarz"]];
test("stolica: sceny „późno” (3 zlecenia) grają się raz, a potem wracają warianty pory dnia", async () => {
  const { evaluate } = await import("../src/engine/conditions.js");
  const { createNewState } = await import("../src/engine/state.js");
  for (const [l, s] of POZNO_SPOTS) {
    const scenes = loc(l).spots.find((x) => x.id === s).scenes;
    const i = scenes.findIndex((x) => /_pozno$/.test(x.id));
    assert.ok(i >= 0, `${l}.${s}`);
    const pozno = scenes[i], flagScene = scenes[i + 1];
    assert.equal(flagScene.type, "flag", `${s}: scena ustawiająca flagę „było”`);
    const marker = Object.keys(flagScene.set)[0];
    const st = createNewState({ seed: 1, startScene: "a", rules: data.rules });
    st.vars.zlecenia_stolicy = 3;
    assert.equal(evaluate(pozno.if, st, data), true, `${s}: pierwsza wizyta`);
    st.flags[marker] = true;
    assert.equal(evaluate(pozno.if, st, data), false, `${s}: kolejne wizyty`);
    assert.equal(flagScene.goto, "koniec");
  }
});

test("stolica: sceny „późno” nie odwołują się do wyborów, których gracz mógł nie zrobić (most, smoła, beczki)", () => {
  for (const [l, s] of [["targ_pod_murem", "plotki"], ["port_rzeczny", "nabrzeze"]]) {
    const pozno = loc(l).spots.find((x) => x.id === s).scenes.find((x) => /_pozno$/.test(x.id));
    assert.doesNotMatch(pozno.text, /most|smoł|beczek/i, s);
  }
  const alch = loc("zaulek_szklarzy").spots.find((x) => x.id === "pracownia_alchemika").scenes.find((x) => /_pozno$/.test(x.id));
  assert.match(JSON.stringify(alch.if), /kto_pali_w_zaulku_zrobione/, "alchemik nie prosi o robotę po własnym zleceniu");
});
