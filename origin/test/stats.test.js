import { test } from "node:test";
import assert from "node:assert/strict";
import { getStats } from "../src/systems/stats.js";
import { minimalData } from "./helpers.js";
import { NUMERIC_KEYS } from "../src/systems/modifiers.js";

const data = minimalData();

function char(overrides = {}) {
  return {
    character: {
      name: "T", classId: "miecz", level: 1, xp: 0,
      attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 },
      skillPoints: {}, tagged: ["sieczna", "wymowa", "medycyna"], perks: [], pendingLevelUp: null, hp: 35,
      ...overrides,
    },
    time: { minutes: 12 * 60 },
  };
}

test("umiejętności bazowe i wiodące", () => {
  const s = getStats(char(), data);
  assert.equal(s.skills.drzewcowa, 15); assert.equal(s.skills.sieczna, 35);
  assert.equal(s.skills.wymowa, 2 * 5 + 6 + 20); // oglada + rozum
});
test("punkty umiejętności: wiodąca ×2, zwykła ×1, limit 100", () => {
  const s = getStats(char({ skillPoints: { sieczna: 5, drzewcowa: 5, wrecz: 200 } }), data);
  assert.equal(s.skills.sieczna, 45); assert.equal(s.skills.drzewcowa, 20); assert.equal(s.skills.wrecz, 100);
});
test("pochodne", () => {
  const s = getStats(char(), data).derived;
  assert.deepEqual([s.hpMax, s.ap, s.carry, s.defense, s.initiative, s.critChance], [35, 7, 75, 10, 10, 5]);
  assert.equal(getStats(char({ level: 2 }), data).derived.hpMax, 39);
});
test("noc: rangedHitChance −15, umiejętności z Bystrością −15, skradanie +10; permanentOnly pomija porę", () => {
  const night = char(); night.time.minutes = 23 * 60;
  const s = getStats(night, data);
  assert.equal(s.timeOfDay, "noc"); assert.equal(s.derived.rangedHitChance, -15);
  assert.equal(s.skills.strzelecka, 15 - 15); assert.equal(s.skills.skradanie, 15 - 15 + 10);
  assert.equal(getStats(night, data, { permanentOnly: true }).skills.strzelecka, 15);
});
test("perk zmieniający atrybut przelicza umiejętności; rozbicie na źródła", () => {
  const s = getStats(char({ perks: ["szczesciarz"], level: 4 }), data);
  assert.equal(s.attributes.fart, 6); assert.equal(s.skills.wiedza_tajemna, 2 * 6 + 6);
  assert.deepEqual(s.breakdown.fart, [{ source: { kind: "base" }, value: 5 }, { source: { kind: "perk", id: "szczesciarz" }, value: 1 }]);
});
test("brak postaci → Error", () => assert.throws(() => getStats({ character: null, time: { minutes: 0 } }, data)));
test("derived ma dokładnie NUMERIC_KEYS; other zawiera resist_ i damageTaken/extraDamage", () => {
  const s = getStats(char({ perks: ["nieugiety"], level: 4 }), data);
  assert.equal(s.other.resist_ogluszenie, 25);
  assert.deepEqual(s.other.damageTaken, {}); assert.deepEqual(s.other.extraDamage, []);
  assert.deepEqual(Object.keys(s.derived).sort(), [...NUMERIC_KEYS, "armor", "reduction"].sort());
});

function withInv(equipped, d = data) {
  const s = char();
  s.inventory = { items: Object.values(equipped).map((id) => ({ id, qty: 1 })), equipped, quickSlots: [] };
  return getStats(s, d);
}
test("sprzęt: kaptur daje +1 Bystrości z rozbiciem", () => {
  const base = getStats(char(), data);
  const s = withInv({ glowa: "kaptur_mysliwego" });
  assert.equal(s.attributes.bystrosc, base.attributes.bystrosc + 1);
  assert.ok(s.breakdown.bystrosc.some((e) => e.source.kind === "item" && e.source.id === "kaptur_mysliwego" && e.value === 1));
});
test("sprzęt: kolczuga – AP, skradanie, pancerz i redukcja", () => {
  const sneaky = (extra) => { const c = char({ skillPoints: { skradanie: 30 } }); c.inventory = extra; return getStats(c, data); };
  const base = sneaky(null);
  const s = sneaky({ items: [{ id: "kolczuga", qty: 1 }], equipped: { tulow: "kolczuga" }, quickSlots: [] });
  assert.equal(s.derived.ap, base.derived.ap - 1);
  assert.equal(s.skills.skradanie, base.skills.skradanie - 20);
  assert.equal(s.derived.armor, 2); assert.equal(s.derived.reduction.sieczne, 30);
  assert.equal(s.derived.reduction.ogien, 0);
});
test("sprzęt: broń w bron_zapas nie działa, w bron działa", () => {
  const d = { ...data, items: [...data.items, { id: "test_miecz", name: "T", type: "weapon", modifiers: { fart: 3 } }] };
  const base = getStats(char(), d);
  assert.equal(withInv({ bron_zapas: "test_miecz" }, d).attributes.fart, base.attributes.fart);
  assert.equal(withInv({ bron: "test_miecz" }, d).attributes.fart, base.attributes.fart + 3);
});
test("sprzęt: redukcja obcięta do 75", () => {
  const mk = (id, slot) => ({ id, name: id, type: "armor", slot, reduction: { sieczne: 50 } });
  const { softCap, ...inventory } = data.rules.inventory;
  const d = { ...data, rules: { ...data.rules, inventory }, items: [...data.items, mk("p1", "tulow"), mk("p2", "glowa")] };
  assert.equal(withInv({ tulow: "p1", glowa: "p2" }, d).derived.reduction.sieczne, 75);
  assert.ok(softCap, "reguły gry mają miękki limit");
  assert.equal(withInv({ tulow: "p1", glowa: "p2" }, { ...d, rules: data.rules }).derived.reduction.sieczne, 57, "75% ponad próg 40 liczone w połowie");
});
test("sprzęt: permanentOnly pomija sprzęt; brak/null inventory bez błędu", () => {
  const s = char(); s.inventory = { items: [{ id: "kolczuga", qty: 1 }], equipped: { tulow: "kolczuga" }, quickSlots: [] };
  const p = getStats(s, data, { permanentOnly: true });
  assert.equal(p.derived.armor, 0); assert.equal(p.skills.skradanie, getStats(char(), data).skills.skradanie);
  s.inventory = null;
  assert.equal(getStats(s, data).derived.armor, 0);
  assert.equal(getStats(char(), data).derived.armor, 0);
});

test("sprzęt: broń w bron_druga nie daje modyfikatorów", () => {
  const d = { ...data, items: [...data.items, { id: "test_sztylet", name: "T", type: "weapon", offhand: true, modifiers: { fart: 3 } }] };
  const base = getStats(char(), d);
  assert.equal(withInv({ bron_druga: "test_sztylet" }, d).attributes.fart, base.attributes.fart);
});
