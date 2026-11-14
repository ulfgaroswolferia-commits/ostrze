import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { heroPanel } from "../src/ui/hero_panel.js";
import { visibleWidth } from "../src/ui/frame.js";
import { setColorsEnabled } from "../src/ui/colors.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { applyEffect } from "../src/systems/effects.js";
import { startTravel } from "../src/systems/travel.js";

const data = minimalData();
const strip = (s) => stripVTControlCharacters(s);
const H = 60;

function hero({ name } = {}) {
  const s = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  s.character = cs.character;
  s.inventory = cs.inventory;
  if (name) s.character.name = name;
  s.time.minutes = 12 * H;
  s.world.phenomenonRolledDay = 99;
  return s;
}
const panel = (s, opts = {}) => heroPanel(s, data, { cols: 80, ...opts });

test("bez postaci – brak panelu", () => {
  const s = hero();
  s.character = null;
  assert.equal(panel(s), null);
});

test("górna ramka i linia 1: imię, poziom, klasa, czas; HP z paskiem, XP, miejsce", () => {
  const s = hero();
  const p = panel(s);
  assert.equal(p.left, "Test · poz. 1 · Klasa miecza");
  assert.equal(p.right, "Dzień 1, 12:00 · dzień");
  const l1 = strip(p.lines[0]);
  assert.match(l1, /^HP ██████████ 38\/38 {3}XP 0\/150/);
  assert.match(l1, /Brzezina$/);
  assert.ok(visibleWidth(p.lines[0]) <= 76);
  s.character.hp = 19;
  assert.match(strip(panel(s).lines[0]), /^HP █████░░░░░ 19\/38/);
  startTravel(s, data, "brzezina_wilczy_brod");
  assert.match(strip(panel(s).lines[0]), /W drodze 1\/2$/);
});

test("kolory HP: zielony > 50%, żółty > 25%, czerwony niżej", () => {
  setColorsEnabled(true);
  try {
    const s = hero();
    const colourOf = (hp) => { s.character.hp = hp; return panel(s).lines[0]; };
    assert.ok(colourOf(38).includes("\x1b[32m"));
    assert.ok(colourOf(15).includes("\x1b[33m"));
    assert.ok(colourOf(5).includes("\x1b[31m"));
  } finally {
    setColorsEnabled(false);
  }
});

test("efekty: głód bez stosów; linia 2: broń, druga ręka, pas, mistyka", () => {
  const s = hero();
  applyEffect(s, data, "glod", null, { force: true });
  applyEffect(s, data, "glod", null, { force: true });
  assert.match(strip(panel(s).lines[0]), /\[Głodny\]/);
  assert.match(strip(panel(s).lines[1]), /^Broń: Krótki miecz {3}Pas: Opatrunek ×2/);
  addItem(s, data, "sztylet", 1);
  equip(s, data, "sztylet", "bron_druga");
  addItem(s, data, "kamien_zmierzchu", 1);
  equip(s, data, "kamien_zmierzchu", "talizman");
  s.world.phenomenon = { id: "burza_iskier", startsAt: 0, endsAt: 20 * H, omenAt: 0, omenShown: true, started: true };
  const l2 = strip(panel(s).lines[1]);
  assert.match(l2, /^Broń: Krótki miecz \+ Sztylet/);
  assert.match(l2, /⚡ Burza iskier/);
  assert.match(l2, /◆/);
});

test("walka: linia 2 zaczyna się od PA", () => {
  const s = hero();
  const l2 = strip(panel(s, { combat: { playerAp: 3 } }).lines[1]);
  assert.match(l2, /^PA ●●●○○○○○ \(3\/8\) {3}Broń: Krótki miecz/);
});

test("długie imię, zjawisko, artefakt i 3 efekty przy 80 kolumnach – linie mieszczą się, HP zawsze", () => {
  const s = hero({ name: "Bardzo Długie Imię Wojownika i Jego Konia Bojowego" });
  addItem(s, data, "kamien_zmierzchu", 1);
  equip(s, data, "kamien_zmierzchu", "talizman");
  s.world.phenomenon = { id: "burza_iskier", startsAt: 14 * H, endsAt: 16 * H, omenAt: 12 * H, omenShown: true, started: false };
  for (const id of ["glod", "zmeczenie", "trucizna", "podchmielenie"]) applyEffect(s, data, id, null, { force: true });
  startTravel(s, data, "brzezina_wilczy_brod");
  const p = panel(s);
  for (const l of p.lines) assert.ok(visibleWidth(l) <= 76, strip(l));
  assert.match(strip(p.lines[0]), /^HP /);
  assert.match(strip(p.lines[0]), /\+1/);
});
