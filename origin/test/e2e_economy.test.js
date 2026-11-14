import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { combatState } from "./helpers.js";
import { buyPrice, sellPrice } from "../src/systems/shop.js";
import { getStats } from "../src/systems/stats.js";
import { xpToReach } from "../src/systems/character.js";
const xpForLevel = (level) => xpToReach(level, data.rules);

// Bilans ekonomii na prawdziwych danych: ile gracz zarabia do końca aktu II i czy za to kupi pierwszy sprzęt T2.
const data = await loadData();
const item = (id) => data.items.find((i) => i.id === id);
const shopItems = (ids) => ids.flatMap((id) => data.shops.find((s) => s.id === id).stock.map((s) => item(s.id)));
const WILCZY = ["kramarz_brod", "kowal_brod", "szkarad_ruszniczar"];
const moneyOf = (quests) => quests.flatMap((q) => q.onComplete ?? []).filter((a) => a.giveMoney).reduce((s, a) => s + a.giveMoney, 0);
const xpOf = (quests) => quests.flatMap((q) => q.onComplete ?? []).filter((a) => a.xp).reduce((s, a) => s + a.xp, 0);

test("ekonomia: zarobki z aktu II wystarczają na pierwszy zestaw T2 (broń + tułów + głowa) w Wilczym Brodzie", () => {
  const state = combatState(data, "miecz");
  const handel = getStats(state, data).skills.handel ?? 0;
  const startMoney = Math.min(...data.classes.map((c) => c.startMoney));
  // Guaranteed money: the class start, the hub's errands and two roadside fights (~5 gr each).
  const income = startMoney + moneyOf(data.quests.filter((q) => q.hub === "wilczy_brod")) + 10;
  const cheapest = (pred) => Math.min(...shopItems(WILCZY).filter((i) => i.tier === 2 && pred(i)).map((i) => buyPrice(data, i, handel)));
  const set = cheapest((i) => i.type === "weapon") + cheapest((i) => i.type === "armor" && i.slot === "tulow") + cheapest((i) => i.type === "armor" && i.slot === "glowa");
  assert.ok(set <= income, `zestaw T2 ${set} gr, zarobki ${income} gr`);
  assert.ok(set >= income * 0.4, `zestaw T2 ${set} gr to za mało przy zarobkach ${income} gr (sprzęt ma coś kosztować)`);
});

test("ekonomia: za sprzedaż łupu da się coś utargować, ale sprzedaż nigdy nie przewyższa kupna", () => {
  for (const i of data.items.filter((x) => x.value > 0 && !x.hidden)) {
    assert.ok(sellPrice(data, i, 15) <= buyPrice(data, i, 15), i.id);
  }
});

test("ekonomia: T3 nie jest do kupienia przed aktem III (szkoła, Wilczy Bród, wędrowni)", () => {
  for (const id of ["kramarz_szkolny", "kupiec_drogi", "handlarz_wedrowny", "wedrowny_pogorze", ...WILCZY]) {
    for (const s of data.shops.find((x) => x.id === id).stock) assert.ok((item(s.id).tier ?? 0) <= 2, `${id}: ${s.id}`);
  }
});

test("ekonomia: strzelecka i proch mają osiągalną broń przed końcem aktu II", () => {
  const stock = shopItems(WILCZY);
  assert.ok(stock.some((i) => i.type === "weapon" && i.skill === "strzelecka"));
  assert.ok(stock.some((i) => i.type === "weapon" && i.skill === "proch"));
});

test("ekonomia: zlecenia aktu II dają PD na 3. poziom, a aktu III na 4.", () => {
  const act2 = xpOf(data.quests.filter((q) => q.hub === "wilczy_brod"));
  const act3 = act2 + xpOf(data.quests.filter((q) => q.hub === "gluszec"));
  assert.ok(act2 >= xpForLevel(3), `akt II: ${act2} PD < ${xpForLevel(3)}`);
  assert.ok(act3 >= xpForLevel(4), `akt III A: ${act3} PD < ${xpForLevel(4)}`);
});
