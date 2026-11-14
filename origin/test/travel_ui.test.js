import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { statusBar } from "../src/ui/screen.js";
import { renderItemCard, showInventory } from "../src/ui/inventory_screen.js";
import { renderCharacter } from "../src/ui/character_screen.js";
import { pushEventNotices } from "../src/ui/events.js";
import { addItem, removeItem, equip } from "../src/systems/inventory.js";
import { itemById } from "../src/systems/items.js";
import { applyEffect } from "../src/systems/effects.js";
import { startTravel } from "../src/systems/travel.js";

const data = minimalData();
const strip = (s) => stripVTControlCharacters(s);
const H = 60;
/** Terminal columns of a line (⚡ is drawn two columns wide). */
const cols = (s) => [...strip(s)].length + (strip(s).match(/⚡/g) ?? []).length;

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

test("pasek stanu: lokacja w miejscu, „W drodze d/n” w podróży", () => {
  const s = hero();
  assert.match(strip(statusBar(s, data, { width: 120 })), /^Dzień 1, 12:00 · dzień · Brzezina · Test, poz\. 1 · HP \d+\/\d+$/);
  startTravel(s, data, "brzezina_wilczy_brod");
  s.world.travel.day = 2;
  assert.match(strip(statusBar(s, data, { width: 120 })), /· W drodze 2\/2 · Test/);
});

test("pasek stanu przy 80 kolumnach: długie imię, zjawisko i artefakt – HP zawsze widoczne", () => {
  for (const name of ["Thorgniew", "Bardzo Długie Imię Wojownika"]) {
    const s = hero({ name });
    addItem(s, data, "kamien_zmierzchu", 1);
    equip(s, data, "kamien_zmierzchu", "talizman");
    startTravel(s, data, "brzezina_wilczy_brod");
    s.world.phenomenon = { id: "burza_iskier", startsAt: 14 * H, endsAt: 16 * H, omenAt: 12 * H, omenShown: true, started: false };
    const bar = strip(statusBar(s, data, { width: 80 }));
    assert.ok(cols(bar) <= 80, bar);
    assert.match(bar, /HP \d+\/\d+$/, bar);
    if (name === "Thorgniew") {
      assert.match(bar, /⚡ Burza/, bar); // the place gives way before the omen is cut
      s.world.phenomenon = null;
      assert.match(strip(statusBar(s, data, { width: 80 })), /W drodze 1\/2 · ◆ (Kamień Zmierzchu )?\d+% · Thorgniew/);
    }
  }
});

test("głód na pasku i w karcie postaci – bez czasu, ze skutkami", () => {
  const s = hero();
  applyEffect(s, data, "glod", null, { force: true });
  applyEffect(s, data, "glod", null, { force: true });
  assert.match(strip(statusBar(s, data, { width: 120 })), /\[Głodny\]/);
  const sheet = strip(renderCharacter(s, data));
  assert.match(sheet, /Głodny · Siła -1, Krzepa -1/);
  assert.doesNotMatch(sheet, /Głodny · zostało/);
});

test("karta jedzenia: posiłek, jak szybko się psuje, ryzyko grzybów – ≤ 80 kolumn", () => {
  const s = hero();
  const card = (id) => strip(renderItemCard(itemById(data, id), s, data));
  assert.match(card("jagody"), /Posiłek na drogę\. Psuje się szybko\./);
  assert.match(card("orzechy"), /Wytrzyma kilka dni\./);
  assert.match(card("prowiant"), /Długo się trzyma\./);
  assert.match(card("grzyby"), /Może zaszkodzić \(15%\) – chyba że Medycyna to twoja umiejętność wiodąca\./);
  assert.doesNotMatch(card("ziola_lesne"), /Posiłek/);
  for (const id of ["jagody", "grzyby", "prowiant", "mieso"]) assert.ok(card(id).split("\n").every((l) => cols(l) <= 80), card(id));
});

test("ekwipunek: „Zjedz” przy jedzeniu – zdejmuje głód i pokazuje komunikat", async () => {
  const s = hero();
  removeItem(s, data, "prowiant", 2);
  addItem(s, data, "jagody", 1);
  s.character.lastMeal = s.time.minutes - data.rules.appetite.fullHours * 60;
  applyEffect(s, data, "glod", null, { force: true });
  const row = s.inventory.items.findIndex((i) => i.id === "jagody") + 1;
  const ctx = { state: s, data, io: createScriptedIO([String(row), "1", "w"]), rng: createRng(1), notices: [] };
  await showInventory(ctx);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
  const out = strip(ctx.io.text());
  assert.match(out, /\[1\] Zjedz/);
  assert.match(out, /Zjadasz: Jagody\. Zostało posiłków: 0\./);
  assert.equal(s.character.effects.find((e) => e.id === "glod"), undefined);
});

test("komunikaty jedzenia", () => {
  const ctx = { data, notices: [] };
  pushEventNotices(ctx, [
    { type: "posilek", id: "prowiant", left: 2 }, { type: "glod_etap", id: "glod" },
    { type: "zatrucie_jedzeniem", id: "grzyby" }, { type: "efekt_koniec", id: "glod" },
  ]);
  const text = ctx.notices.map(strip).join("\n");
  for (const part of ["Zjadasz: Prowiant. Zostało posiłków: 2.", "Głodny: Siła -1, Krzepa -1, gorzej się leczysz we śnie.", "Coś było nie tak z: Grzyby", "Głodny"]) {
    assert.ok(text.includes(part), `${part}\n${text}`);
  }
});

test("final: po ostatnim obozie pasek nie pokazuje dnia ponad długość podróży", () => {
  const s = hero();
  startTravel(s, data, "brzezina_wilczy_brod");
  s.world.travel.day = 3; // nextDay after the last camp, before the arrival
  assert.match(strip(statusBar(s, data, { width: 120 })), /W drodze 2\/2/);
});
