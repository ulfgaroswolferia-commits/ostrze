import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { loadData, validateData } from "../src/engine/data.js";
import { createRng } from "../src/engine/dice.js";
import { createCombat } from "../src/systems/combat/state.js";
import { beginTurn } from "../src/systems/combat/turn.js";
import { doAction } from "../src/systems/combat/actions.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { combatEventText } from "../src/ui/events.js";
import { renderItemCard } from "../src/ui/inventory_screen.js";
import { combatState } from "./helpers.js";

const data = await loadData();

// --- thrown items ---
function aim(itemId, enemy, band = "far") {
  const s = combatState(data, "miecz");
  s.character.hp = 999;
  s.character.attributes.zrecznosc = 5;
  addItem(s, data, itemId, 1);
  return (seed) => {
    const state = structuredClone(s);
    const rng = createRng(seed);
    const combat = createCombat(state, data, { id: "m", type: "combat", enemies: [{ id: enemy, count: 1 }], start: band, canFlee: true }, rng);
    beginTurn(state, data, combat, rng);
    combat.enemies[0].band = band;
    combat.playerAp = 20;
    const target = combat.enemies[0];
    const r = doAction(state, data, combat, { id: "use", itemId, target: target.uid }, rng);
    return { combat, target, events: r.events, use: r.events.find((e) => e.type === "uzycie"), worked: target.effects.length > 0 };
  };
}
const rate = (fn, pick, n = 1500) => {
  let hit = 0;
  for (let k = 0; k < n; k++) if (pick(fn(5000 + k))) hit++;
  return hit / n;
};

test("rzuty: rzucane przedmioty mają premię do celności z reguł", () => {
  assert.equal(data.rules.combat.throwHitBonus, 30);
  assert.deepEqual(validateData(data), []);
});

test("rzuty: bandyta na dystans – trafienie wyraźnie częściej niż co trzeci rzut", () => {
  assert.ok(rate(aim("flasza_oleju", "bandyta"), (r) => r.use.hit) > 0.5);
});

test("rzuty: wróg w zwarciu jest trudniejszy niż na dystansie, ale nie beznadziejny", () => {
  const far = rate(aim("flasza_oleju", "bandyta"), (r) => r.use.hit);
  const near = rate(aim("flasza_oleju", "bandyta", "melee"), (r) => r.use.hit);
  assert.ok(near < far);
  assert.ok(near > 0.25, `${near}`);
});

test("garnek huku: działa w około połowie rzutów, także w zwarciu", () => {
  const far = rate(aim("garnek_huku", "bandyta"), (r) => r.worked);
  const near = rate(aim("garnek_huku", "bandyta", "melee"), (r) => r.worked);
  assert.ok(far > 0.45, `dystans ${far}`);
  assert.ok(near > 0.35, `zwarcie ${near}`);
});

test("garnek huku: chybiony też potrafi ogłuszyć", () => {
  const throwIt = aim("garnek_huku", "bandyta");
  assert.ok(rate(throwIt, (r) => r.use.hit === false && r.worked) > 0.05);
});

test("garnek huku: przy chybieniu ogłuszenie trwa co najmniej turę", () => {
  const throwIt = aim("garnek_huku", "bandyta");
  for (let k = 0; k < 400; k++) {
    const r = throwIt(7000 + k);
    if (r.worked) assert.ok(r.target.effects[0].remaining >= 1);
  }
});

test("wróg odporny: rzut zawsze mówi, że to nie działa, także przy chybieniu", () => {
  const immune = data.enemies.find((e) => (e.immune ?? []).includes("rozkojarzenie"));
  assert.ok(immune);
  const throwIt = aim("puszka_szerszeni", immune.id);
  let hits = 0;
  let misses = 0;
  for (let k = 0; k < 300; k++) {
    const r = throwIt(9000 + k);
    if (r.use.fumble) continue;
    if (r.use.hit) hits++; else misses++;
    assert.equal(r.worked, false);
    const said = r.events.find((e) => e.type === "efekt_odporny");
    assert.ok(said, "brak komunikatu o odporności");
    assert.match(strip(combatEventText(data.ui, data, r.combat, said)), /rozkojarzenie/);
  }
  assert.ok(hits > 0 && misses > 0);
});

test("wróg nieodporny: bez komunikatu o odporności", () => {
  const throwIt = aim("puszka_szerszeni", "bandyta");
  for (let k = 0; k < 100; k++) assert.ok(!throwIt(100 + k).events.some((e) => e.type === "efekt_odporny"));
});

// --- light armour ---
const LIGHT = ["kaftan_wlocznika", "karwasze_rogowe", "nagolenice_skorzane"];
const item = (id) => data.items.find((i) => i.id === id);
const stockOf = (shop) => data.shops.find((s) => s.id === shop).stock.map((e) => e.id);

test("lekkie pancerze: bez kary do PA, z ochroną przed pchnięciem i obuchem", () => {
  for (const id of LIGHT) {
    const it = item(id);
    assert.ok(it, id);
    assert.equal(it.type, "armor");
    assert.equal(it.modifiers?.ap, undefined, id);
    assert.ok(it.reduction.klute > 0 && it.reduction.obuchowe > 0, id);
    assert.ok(it.description.length > 10, id);
  }
  assert.deepEqual({ armor: item("kaftan_wlocznika").armor, ...item("kaftan_wlocznika").reduction }, { armor: 3, sieczne: 20, klute: 30, obuchowe: 20 });
});

test("lekkie pancerze: dostępne wcześnie u Zbycha i później u Bogdana", () => {
  for (const id of ["karwasze_rogowe", "nagolenice_skorzane"]) assert.ok(stockOf("kowal_brod").includes(id), id);
  for (const id of LIGHT) assert.ok(stockOf("kowal_gluszec_sklep").includes(id), id);
});

test("lekki komplet: PA bez zmian, ochrona jak w pomiarze", () => {
  const s = combatState(data, "wlocznia");
  const ap = getStats(s, data).derived.ap;
  for (const [slot, id] of [["tulow", "kaftan_wlocznika"], ["rece", "karwasze_rogowe"], ["nogi", "nagolenice_skorzane"]]) {
    addItem(s, data, id, 1);
    assert.equal(equip(s, data, id, slot).ok, true, id);
  }
  const d = getStats(s, data).derived;
  assert.equal(d.ap, ap);
  assert.equal(d.reduction.klute, 55 > 40 ? 47 : 55, "powyżej progu liczy się w połowie");
});

test("karta kaftana włócznika ma tabelę i miejsce", () => {
  const s = combatState(data, "wlocznia");
  const text = strip(renderItemCard(item("kaftan_wlocznika"), s, data));
  assert.match(text, /Zakłada się na: Tułów/);
  assert.match(text, /Założone: Kaftan przeszywany/);
});

// --- starting food ---
test("start: obie klasy mają 3 prowianty", () => {
  for (const c of data.classes) assert.equal(c.startItems.find((i) => i.id === "prowiant").qty, 3, c.id);
});
