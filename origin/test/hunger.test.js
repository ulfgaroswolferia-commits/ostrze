import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { loadData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { advanceTime } from "../src/engine/time.js";
import { migrations } from "../src/engine/save.js";
import { getStats } from "../src/systems/stats.js";
import { appetitePercent, resetAppetite } from "../src/systems/appetite.js";
import { eatItem, mealsLeft } from "../src/systems/food.js";
import { hasEffect } from "../src/systems/effects.js";
import { runActions } from "../src/systems/actions.js";
import { heroPanel } from "../src/ui/hero_panel.js";
import { pushEventNotices } from "../src/ui/events.js";
import { renderCharacter } from "../src/ui/character_screen.js";
import { combatState } from "./helpers.js";

const data = await loadData();
const HOUR = 60;
const { fullHours } = data.rules.appetite;

function hero({ food = 0 } = {}) {
  const cs = combatState(data, "miecz");
  const s = createNewState({ seed: 1, startScene: "demo_mapa", rules: data.rules });
  Object.assign(s, { character: cs.character, inventory: cs.inventory });
  s.inventory.items = s.inventory.items.filter((i) => !data.items.find((x) => x.id === i.id)?.food);
  s.inventory.quickSlots = [];
  if (food) s.inventory.items.push({ id: "prowiant", qty: food });
  s.world.phenomenonRolledDay = 9999;
  s.character.effects = [];
  s.character.lastMeal = s.time.minutes;
  return s;
}
/** Moves the clock until the gauge stands at `pct` percent, with the hourly hooks running. */
function passTo(s, pct) {
  const minutes = Math.ceil((pct * fullHours * 60) / 100);
  const wait = s.character.lastMeal + minutes - s.time.minutes;
  const hours = Math.ceil(wait / HOUR);
  const events = [];
  for (let h = 0; h < hours; h++) events.push(...advanceTime(s, HOUR, data, createRng(h + 1)));
  return events;
}
const stats = (s) => getStats(s, data).attributes;

test("zasady: licznik pełny po 24 godzinach, próg 85, konanie od 150", () => {
  assert.deepEqual({ ...data.rules.appetite }, { fullHours: 24, hintAt: 85, starveAt: 150 });
});

test("poniżej 85%: żadnych skutków", () => {
  const s = hero();
  const base = stats(s);
  passTo(s, 80);
  assert.ok(appetitePercent(s, data) < 85);
  assert.deepEqual(stats(s), base);
  assert.deepEqual(s.character.effects, []);
});

test("od 85% bez jedzenia: lekki efekt Siła −1 i komunikat", () => {
  const s = hero();
  const base = stats(s);
  const events = passTo(s, 85);
  assert.equal(stats(s).sila, base.sila - 1);
  assert.equal(stats(s).krzepa, base.krzepa);
  assert.ok(events.some((e) => e.type === "glod_pora"));
  assert.ok(hasEffect(s, "glod_lekki"));
});

test("100% bez jedzenia: pełny efekt zamiast lekkiego, Siła −1 i Krzepa −1, gorsze leczenie snem", () => {
  const s = hero();
  const base = stats(s);
  passTo(s, 100);
  assert.ok(!hasEffect(s, "glod_lekki"));
  assert.ok(hasEffect(s, "glod"));
  assert.equal(stats(s).sila, base.sila - 1);
  assert.equal(stats(s).krzepa, base.krzepa - 1);
  assert.equal(data.effects.find((e) => e.id === "glod").restHealMultiplier, 0.5);
});

test("100% bez jedzenia: HP nie przekracza niższego maksimum", () => {
  const s = hero();
  s.character.hp = getStats(s, data).derived.hpMax;
  passTo(s, 100);
  assert.ok(s.character.hp <= getStats(s, data).derived.hpMax);
});

test("150% bez jedzenia: dochodzą Zręczność −2 i Bystrość −1, siła i krzepa dalej obniżone", () => {
  const s = hero();
  const base = stats(s);
  const events = passTo(s, 150);
  assert.ok(hasEffect(s, "glod") && hasEffect(s, "glod_konanie"));
  assert.equal(stats(s).zrecznosc, base.zrecznosc - 2);
  assert.equal(stats(s).bystrosc, base.bystrosc - 1);
  assert.equal(stats(s).sila, base.sila - 1);
  assert.equal(stats(s).krzepa, base.krzepa - 1);
  assert.ok(events.some((e) => e.type === "glod_etap" && e.id === "glod_konanie"));
});

test("100% z jedzeniem: automat zjada jeden posiłek, licznik od zera, bez skutków", () => {
  const s = hero({ food: 2 });
  const events = passTo(s, 100);
  assert.equal(mealsLeft(s, data), 1);
  assert.ok(events.some((e) => e.type === "posilek"));
  assert.ok(appetitePercent(s, data) < 10);
  assert.deepEqual(s.character.effects, []);
});

test("automat w ciągu doby zjada jeden posiłek, nie więcej", () => {
  const s = hero({ food: 5 });
  for (let h = 0; h < 24; h++) advanceTime(s, HOUR, data, createRng(h + 1));
  assert.equal(mealsLeft(s, data), 4);
});

test("przy 85% można zjeść samemu: skutek znika od razu, licznik od zera", () => {
  const s = hero({ food: 1 });
  passTo(s, 85);
  assert.ok(hasEffect(s, "glod_lekki"));
  assert.equal(mealsLeft(s, data), 1, "automat rusza dopiero przy 100%");
  assert.equal(eatItem(s, data, "prowiant", createRng(1)).ok, true);
  assert.equal(appetitePercent(s, data), 0);
  assert.deepEqual(s.character.effects, []);
});

test("posiłek odejmuje 100 punktów: po 150% zostaje 50% i pełny skutek znika", () => {
  const s = hero();
  passTo(s, 150);
  s.inventory.items.push({ id: "prowiant", qty: 1 });
  const before = appetitePercent(s, data);
  eatItem(s, data, "prowiant", createRng(1));
  assert.equal(appetitePercent(s, data), before - 100);
  assert.deepEqual(s.character.effects, []);
});

test("jedzenie znalezione przy 120%: następna pełna godzina karmi sama", () => {
  const s = hero();
  passTo(s, 120);
  s.inventory.items.push({ id: "prowiant", qty: 3 });
  advanceTime(s, HOUR, data, createRng(1));
  assert.equal(mealsLeft(s, data), 2);
  assert.ok(appetitePercent(s, data) < 100);
  assert.ok(!hasEffect(s, "glod"));
});

test("ciepła strawa zdejmuje każdy etap głodu", () => {
  const s = hero();
  passTo(s, 150);
  runActions(s, data, [{ meal: 5 }], createRng(1));
  assert.deepEqual(s.character.effects, []);
  assert.equal(appetitePercent(s, data), 0);
});

test("panel: do 149% procenty, od 150% napis bez procentów", () => {
  const text = (s) => strip(heroPanel(s, data, { cols: 120 }).lines.join(" "));
  const s = hero();
  passTo(s, 120);
  assert.match(text(s), /Głód 1[12]\d%/);
  passTo(s, 150);
  assert.match(text(s), /Konasz z głodu/);
  assert.doesNotMatch(text(s), /Głód \d+%/);
});

test("komunikaty wypisują skutki z liczbami", () => {
  const notice = (id) => {
    const ctx = { data, notices: [], state: {} };
    pushEventNotices(ctx, [{ type: "glod_etap", id }]);
    return strip(ctx.notices.join(" "));
  };
  assert.match(notice("glod_lekki"), /Siła -1/);
  assert.match(notice("glod"), /Siła -1.*Krzepa -1/);
  assert.match(notice("glod_konanie"), /Konasz z głodu.*Zręczność -2.*Bystrość -1/);
});

test("karta postaci wypisuje skutki głodu z liczbami", () => {
  const s = hero();
  passTo(s, 150);
  const sheet = strip(renderCharacter(s, data));
  assert.match(sheet, /Głodny.*Siła -1.*Krzepa -1/);
  assert.match(sheet, /Konający z głodu.*Zręczność -2.*Bystrość -1/);
});

// --- old saves ---
const at13 = (character, minutes = 100000) => migrations[12]({ version: 12, time: { minutes }, character }, data);
const pctOf = (m) => appetitePercent(m, data);

test("stary zapis, licznik zatrzymany na 100% dawno temu: bez kary przy wczytaniu", () => {
  const m = at13({ lastMeal: 10, effects: [] });
  assert.equal(m.version, 13);
  assert.ok(pctOf(m) < 85);
});

test("stary zapis po niedawnym posiłku: licznik nietknięty", () => {
  const m = at13({ lastMeal: 100000 - 120, effects: [] });
  assert.equal(m.character.lastMeal, 100000 - 120);
});

test("stary zapis z efektem Głodny: 100% przy jednym stopniu, 150% przy dwóch i trzech", () => {
  assert.equal(pctOf(at13({ lastMeal: 10, effects: [{ id: "glod", stacks: 1, remaining: 1 }] })), 100);
  for (const stacks of [2, 3]) {
    const m = at13({ lastMeal: 10, effects: [{ id: "glod", stacks, remaining: 1 }] });
    assert.equal(pctOf(m), 150);
    assert.equal(m.character.effects.find((e) => e.id === "glod").stacks, 1);
  }
});

test("stary zapis bez postaci przechodzi bez błędu", () => {
  assert.equal(migrations[12]({ version: 12, time: { minutes: 0 }, character: null }, data).version, 13);
});

test("resetAppetite dalej zeruje licznik", () => {
  const s = hero();
  passTo(s, 50);
  resetAppetite(s);
  assert.equal(appetitePercent(s, data), 0);
});
