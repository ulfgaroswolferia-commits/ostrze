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
import { evaluate } from "../src/engine/conditions.js";
import { createNewState } from "../src/engine/state.js";

const data = await loadData();
const HUB = "przystan_jarnowo";
const NEAR = ["stocznia", "kuznie", "cmentarz_lodzi", "dom_czarnego_szkla"];
const FAR = ["oboz_hetmana", "wraki_floty", "lysa_skala"];
const loc = (id) => data.travel.locations.find((l) => l.id === id);
const dlg = (id) => data.dialogues.find((d) => d.id === id);
const item = (id) => data.items.find((i) => i.id === id);
const shop = (id) => data.shops.find((s) => s.id === id);

test("Jarnowo: region, hub, lokacje i trasy istnieją, dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  assert.ok(data.travel.regions.jarnowo);
  assert.equal(loc(HUB).region, "jarnowo");
  for (const id of [...NEAR, ...FAR]) assert.equal(loc(id)?.region, "jarnowo", id);
  const r = routeById(data, "loch_jarnowo");
  assert.deepEqual([r.from, r.to, r.days, r.region], ["loch_pod_palacem", HUB, 3, "morze"]);
  assert.deepEqual(FAR.map((id) => routeById(data, loc(id).far.route).days).sort(), [1, 2, 4]);
  assert.ok(data.rules.vars.includes("zlecenia_jarnowa"));
});

test("Jarnowo: odległości – bliskie ≤ 60, średnie 90–480, ukryte z podpowiedzią, mapa ze znacznikami", () => {
  const minutes = Object.fromEntries(NEAR.map((id) => [id, walkMinutes(data, HUB, id)]));
  assert.ok(minutes.stocznia <= 60 && minutes.kuznie <= 60);
  for (const id of ["cmentarz_lodzi", "dom_czarnego_szkla"]) assert.ok(minutes[id] >= 90 && minutes[id] <= 480, `${id}: ${minutes[id]}`);
  for (const id of ["dom_czarnego_szkla", ...FAR]) assert.ok(loc(id).secret && loc(id).hint, id);
  const tokens = new Set([...data.maps.jarnowo.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]));
  for (const id of [HUB, ...NEAR, ...FAR]) assert.ok(tokens.has(id), id);
});

test("Jarnowo: hub ma karczmę, biuro kapitana, nocleg, tablicę i sklep; każda lokacja ≥2 miejsca i pogadankę z ≥4 stanami", () => {
  const ids = loc(HUB).spots.map((s) => s.id);
  for (const id of ["karczma_stoczniowa", "biuro_kapitana", "nocleg", "tablica_jarnowo", "sklep_stoczni"]) assert.ok(ids.includes(id), id);
  for (const id of [HUB, ...NEAR, ...FAR]) {
    assert.ok((loc(id).spots ?? []).length >= 2, `${id}: ≥2 miejsca`);
    assert.ok(loc(id).spots.some((s) => (s.scenes ?? []).filter((x) => x.type === "narration").length >= 4), `${id}: pogadanka`);
  }
});

test("Jarnowo: sklep 8–15 pozycji do T3", () => {
  const s = shop("sklep_stoczni");
  assert.ok(s.stock.length >= 8 && s.stock.length <= 15);
  for (const x of s.stock) assert.ok((item(x.id).tier ?? 0) <= 3, x.id);
  assert.ok(data.loot.tables.find((t) => t.id === "lupy_wyspa").entries.every((e) => (item(e.item).tier ?? 0) <= 3));
});

test("Jarnowo: ludzie – rozmowy bez ślepych węzłów, odkrywanie ukrytych miejsc bez sojuszników", () => {
  for (const id of ["hetman", "stoczniowiec", "kowal_wyspy", "kapitan_przystani", "brygida_wyspa", "brama_z_wiru", "czarne_szklo"]) {
    const d = dlg(id);
    assert.ok(d, id);
    for (const [nid, n] of Object.entries(d.nodes)) assert.ok((n.options ?? []).length >= 1, `${id}.${nid}`);
  }
  const text = JSON.stringify(data.dialogues);
  for (const id of ["dom_czarnego_szkla", "wraki_floty", "lysa_skala"]) assert.ok(text.includes(`"reveal":"${id}"`), `${id}: nikt go nie ujawnia`);
});

// --- zdarzenia ---
const regionOfEvent = (e) => (e.if?.region ?? (e.if?.all ?? []).find((c) => c.region)?.region ?? null);
test("Jarnowo: co najmniej dwanaście zdarzeń regionu, ataki z ucieczką i porażką, na wyspie i morzu bez upiorów, wilków i patroli", () => {
  const own = data.travel.events.filter((e) => regionOfEvent(e) === "jarnowo");
  assert.ok(own.length >= 12, `jest ${own.length}`);
  const attacks = own.filter((e) => e.kind === "attack");
  assert.ok(attacks.length >= 4);
  for (const e of attacks) {
    const fight = e.scenes.find((s) => s.type === "combat");
    assert.ok(fight.canFlee && e.scenes.some((s) => s.id === fight.onFlee) && e.scenes.some((s) => s.id === fight.onDefeat), e.id);
  }
  const st = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  st.world = { ...(st.world ?? {}), location: HUB };
  for (const e of data.travel.events.filter((x) => x.weight > 0 && regionOfEvent(x) !== "jarnowo")) {
    if (["wilki", "pielgrzym"].includes(e.id)) assert.equal(e.if && evaluate(e.if, st, data), false, `${e.id} na wyspie`);
  }
  const shopEvent = own.flatMap((e) => e.scenes).find((s) => s.type === "shop");
  assert.ok(shop(shopEvent.shop));
});

test("Jarnowo: pola walki – co najmniej dwa w pobliżu i po jednym w każdej dalekiej lokacji, z clearedBy i onDefeat", () => {
  const hunts = (ids) => ids.flatMap((id) => loc(id).spots.filter((s) => s.type === "hunt"));
  assert.ok(hunts(NEAR).length >= 2);
  for (const id of FAR) assert.ok(hunts([id]).length >= 1, id);
  for (const h of hunts([...NEAR, ...FAR])) {
    const fight = h.scenes.find((s) => s.id === h.clearedBy);
    assert.ok(fight.type === "combat" && fight.canFlee && fight.onDefeat, h.id);
  }
  for (const id of FAR) assert.ok(loc(id).spots.some((s) => s.type === "scene" && s.scenes.some((x) => x.type === "reward")), `${id}: znalezisko`);
});

// --- balans (poziom 5, Ostrze, T2) ---
const mdata = minimalData();
function hero(classId, raw) {
  const state = combatState(mdata, classId);
  const blade = (classId === "miecz" ? "ostrze_gwiazd_" : "para_gwiazd_") + (raw ? (classId === "miecz" ? "surowe" : "surowa") : "bogdana");
  for (const id of [blade, "skorznia_nabijana", "helm_zelazny", "opatrunek", "opatrunek"]) addItem(state, mdata, id, 1);
  equip(state, mdata, blade, "bron");
  equip(state, mdata, "skorznia_nabijana", "tulow");
  equip(state, mdata, "helm_zelazny", "glowa");
  state.character.level = 5;
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
function rate(classId, raw, enemies) {
  let wins = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const state = hero(classId, raw);
    const combat = createCombat(state, mdata, { enemies, start: "far", canFlee: true, id: "wyspa_sim" }, rng);
    if (playFight(state, mdata, combat, rng, strat).outcome === "win") wins++;
  }
  return wins / 200;
}
for (const classId of ["miecz", "wlocznia"]) {
  for (const raw of [false, true]) {
    for (const [label, enemies, lo, hi] of [
      ["strażnik wiru ×2", [{ id: "straznik_wiru", count: 2 }], 0.45, 0.99],
      ["szabrownik wraków ×2", [{ id: "szabrownik_wrakow", count: 2 }], 0.8, 1],
      ["Jarnowianie: zwiadowca + strzelec", [{ id: "jarnowski_zwiadowca", count: 1 }, { id: "jarnowski_strzelec", count: 1 }], 0.7, 1],
    ]) {
      test(`symulacja wyspy: ${label} (${classId}, ${raw ? "surowe" : "Bogdana"}) – ${lo}–${hi}`, (t) => {
        const r = rate(classId, raw, enemies);
        t.diagnostic(`${label}: ${r}`);
        assert.ok(r >= lo && r <= hi, `${r} poza ${lo}–${hi}`);
      });
    }
  }
}

test("Jarnowo: obóz hetmana jest ujawniany od pierwszej rozmowy z kapitanem (nie tylko opcjonalną plotką), a hetman wzywa gońcem po trzech zleceniach", () => {
  const biuro = dlg("kapitan_przystani").nodes.biuro;
  const reveals = (biuro.actions ?? []).filter((a) => a.reveal).map((a) => a.reveal);
  assert.ok(reveals.includes("oboz_hetmana"), "biuro ujawnia obóz");
  const v = loc(HUB).visitors?.find((x) => x.id === "goniec_hetmana");
  assert.ok(v && !v.forced, "goniec jest gościem");
  const st = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  assert.equal(evaluate(v.if, st, data), false);
  st.vars.zlecenia_jarnowa = 3;
  assert.equal(evaluate(v.if, st, data), true);
  st.flags.hetman_rozmowa = true;
  assert.equal(evaluate(v.if, st, data), false);
});

test("Jarnowo: zdarzenia morskie są na przeprawie i trasach łodzią, a lądowe zdarzenia ogólne nie losują się ani na wyspie, ani na morzu", () => {
  assert.equal(routeById(data, "loch_jarnowo").region, "morze");
  const sea = data.travel.events.filter((e) => JSON.stringify(e.if ?? {}).includes('"morze"'));
  assert.ok(sea.length >= 6, `morskich: ${sea.length}`);
  for (const e of sea) assert.ok(JSON.stringify(e.if).includes("travelDay"), `${e.id}: na trasach łodzią do dalekich miejsc`);
  for (const id of ["cisza", "kupiec_wedrowny", "glodny_wedrowiec", "kupiec_ostromir", "pielgrzym", "wilki"]) {
    const e = data.travel.events.find((x) => x.id === id);
    const cond = JSON.stringify(e.if ?? {});
    assert.ok(e.if && !cond.includes('"jarnowo"') && !cond.includes('"morze"'), `${id}: nie dla wyspy ani morza`);
  }
  const land = data.travel.events.filter((e) => regionOfEvent(e) === "jarnowo");
  for (const e of land) assert.ok(JSON.stringify(e.if).includes('"location"'), `${e.id}: tylko przy lądowych spacerach`);
});
