import { test } from "node:test";
import assert from "node:assert/strict";
import { buyPrice, sellPrice, shopStock, buy, sell, sellable, priceAdjust } from "../src/systems/shop.js";
import { addItem, equip, countOf } from "../src/systems/inventory.js";
import { createNewState } from "../src/engine/state.js";
import { getStats } from "../src/systems/stats.js";
import { minimalData } from "./helpers.js";

const data = minimalData();
const SHOP = "kramarz_szkolny";

function fresh(money = 0, sila = 5) {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  s.character = {
    name: "T", classId: "miecz", level: 1, xp: 0, money,
    attributes: { sila, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 5, oglada: 5, fart: 5 },
    skillPoints: {}, tagged: [], perks: [], pendingLevelUp: null, hp: 35,
  };
  return s;
}
function fails(state, reason, fn) {
  const before = structuredClone(state);
  assert.deepEqual(fn(), { ok: false, reason });
  assert.deepEqual(state, before);
}
const item = (value) => ({ value });
const handelOf = (s) => getStats(s, data).skills.handel;
const byId = (id) => data.items.find((i) => i.id === id);

test("ceny: value 40 przy handlu 0, 50, 100", () => {
  assert.equal(buyPrice(data, item(40), 0), 60);
  assert.equal(sellPrice(data, item(40), 0), 12);
  assert.equal(buyPrice(data, item(40), 50), 50);
  assert.equal(sellPrice(data, item(40), 50), 17);
  assert.equal(buyPrice(data, item(40), 100), 40);
  assert.equal(sellPrice(data, item(40), 100), 22);
});
test("ceny: minimum 1, kupno >= sprzedaż zawsze", () => {
  assert.equal(buyPrice(data, item(1), 0), 2);
  assert.equal(sellPrice(data, item(1), 0), 1);
  for (let v = 1; v <= 60; v++) for (let h = 0; h <= 150; h += 10) {
    assert.ok(buyPrice(data, item(v), h) >= sellPrice(data, item(v), h), `v=${v} h=${h}`);
  }
});
test("shopStock: kopia z shops.json bez zapisu do stanu", () => {
  const s = fresh();
  const stock = shopStock(s, data, SHOP);
  assert.deepEqual(stock.find((e) => e.id === "opatrunek"), { id: "opatrunek", qty: 4 });
  stock[0].qty = 99;
  assert.equal(shopStock(s, data, SHOP)[0].qty, data.shops[0].stock[0].qty);
  assert.deepEqual(s.world.shops, {});
});
test("buy: opatrunek ×2 – pieniądze, torba, towar kupca", () => {
  const s = fresh(30);
  const cost = 2 * buyPrice(data, byId("opatrunek"), handelOf(s));
  const r = buy(s, data, SHOP, "opatrunek", 2);
  assert.deepEqual(r, { ok: true, cost });
  assert.equal(s.character.money, 30 - cost);
  assert.equal(countOf(s, "opatrunek"), 2);
  assert.equal(s.world.shops[SHOP].find((e) => e.id === "opatrunek").qty, 2);
});
test("buy: do zera usuwa pozycję; brak towaru, pieniędzy, za ciężko", () => {
  const s = fresh(1000);
  fails(s, "shop.noStock", () => buy(s, data, SHOP, "opatrunek", 5));
  fails(s, "shop.noStock", () => buy(s, data, SHOP, "miecz_krotki", 1));
  assert.equal(buy(s, data, SHOP, "pas_ladownice", 1).ok, true);
  assert.equal(s.world.shops[SHOP].some((e) => e.id === "pas_ladownice"), false);
  const poor = fresh(1);
  fails(poor, "shop.noMoney", () => buy(poor, data, SHOP, "opatrunek", 1));
  const weak = fresh(100000, 1);
  const limit = (getStats(weak, data).derived.carry * data.rules.inventory.hardLimitPercent) / 100;
  addItem(weak, data, "garniec_wapno", Math.floor(limit) - 1); // 1 kg below the hard limit
  fails(weak, "inv.tooHeavy", () => buy(weak, data, SHOP, "garniec_wapno", 2));
});
test("sell: założony notFree, amunicja notBought", () => {
  const s = fresh();
  addItem(s, data, "kaftan_przeszywany", 1); equip(s, data, "kaftan_przeszywany", "tulow");
  addItem(s, data, "strzala", 5);
  fails(s, "inv.notFree", () => sell(s, data, SHOP, "kaftan_przeszywany", 1));
  fails(s, "shop.notBought", () => sell(s, data, SHOP, "strzala", 1));
});
test("sellable bez piesci i założonych; sprzedany zapasowy miecz trafia do kupca", () => {
  const s = fresh();
  addItem(s, data, "piesci", 1);
  addItem(s, data, "miecz_krotki", 2); equip(s, data, "miecz_krotki", "bron");
  addItem(s, data, "opatrunek", 1);
  const list = sellable(s, data, SHOP);
  assert.equal(list.some((e) => e.id === "piesci"), false);
  assert.deepEqual(list.find((e) => e.id === "miecz_krotki"),
    { id: "miecz_krotki", qty: 1, price: sellPrice(data, byId("miecz_krotki"), handelOf(s)) });
  const r = sell(s, data, SHOP, "miecz_krotki", 1);
  assert.equal(r.ok, true);
  assert.equal(s.character.money, r.gain);
  assert.equal(countOf(s, "miecz_krotki"), 1);
  assert.equal(shopStock(s, data, SHOP).find((e) => e.id === "miecz_krotki").qty, 1);
  fails(s, "inv.notFree", () => sell(s, data, SHOP, "miecz_krotki", 1));
});

test("buy/sell rzucają przy ilości niedodatniej lub niecałkowitej; stan nietknięty", () => {
  const s = fresh(1000); addItem(s, data, "opatrunek", 2);
  const before = structuredClone(s);
  for (const bad of [0, -1, 1.5, NaN]) {
    assert.throws(() => buy(s, data, SHOP, "opatrunek", bad), /ilo/i);
    assert.throws(() => sell(s, data, SHOP, "opatrunek", bad), /ilo/i);
  }
  assert.deepEqual(s, before);
});

// --- rabaty (priceModifiers) ---
test("ceny z rabatem: kupno −10% = 54, sprzedaż +10% = 13", () => {
  assert.equal(buyPrice(data, item(40), 0, { buyPercent: -10, sellPercent: 0 }), 54);
  assert.equal(sellPrice(data, item(40), 0, { buyPercent: 0, sellPercent: 10 }), 13);
  assert.equal(sellPrice(data, item(40), 0, { buyPercent: -50, sellPercent: 100 }), 24);
  assert.equal(sellPrice(data, item(40), 0, { buyPercent: -50, sellPercent: 200 }), 30); // capped by the buy price
});
test("priceAdjust: suma spełnionych wpisów, niespełnione pomijane", () => {
  const d = { ...data, shops: [{ ...data.shops[0], priceModifiers: [
    { if: { flag: "a" }, buyPercent: -10 },
    { if: { flag: "b" }, buyPercent: -5, sellPercent: 10 },
    { if: { flag: "c" }, buyPercent: -50 },
  ] }] };
  const s = fresh(); s.flags.a = true; s.flags.b = true;
  assert.deepEqual(priceAdjust(s, d, SHOP), { buyPercent: -15, sellPercent: 10 });
  assert.deepEqual(priceAdjust(fresh(), data, SHOP), { buyPercent: 0, sellPercent: 0 });
});
test("buy/sell/sellable używają rabatu", () => {
  const d = { ...data, shops: [{ ...data.shops[0], priceModifiers: [{ if: { flag: "a" }, buyPercent: -10, sellPercent: 10 }] }] };
  const s = fresh(1000); s.flags.a = true;
  const op = byId("opatrunek");
  const adj = { buyPercent: -10, sellPercent: 10 };
  assert.equal(buy(s, d, SHOP, "opatrunek", 1).cost, buyPrice(d, op, handelOf(s), adj));
  assert.equal(sellable(s, d, SHOP)[0].price, sellPrice(d, op, handelOf(s), adj));
  assert.equal(sell(s, d, SHOP, "opatrunek", 1).gain, sellPrice(d, op, handelOf(s), adj));
});
