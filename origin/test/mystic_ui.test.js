import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { artifactState } from "../src/systems/artifacts.js";
import { createCombat } from "../src/systems/combat/state.js";
import { techniqueActions } from "../src/systems/combat/techniques.js";
import { statusBar } from "../src/ui/screen.js";
import { renderCombat, techniqueItems } from "../src/ui/combat_screen.js";
import { renderItemCard } from "../src/ui/inventory_screen.js";
import { renderCharacter } from "../src/ui/character_screen.js";
import { combatEventText, pushEventNotices } from "../src/ui/events.js";
import { itemById } from "../src/systems/items.js";

const data = minimalData();
const strip = (s) => stripVTControlCharacters(s);
const H = 60;
/** Terminal columns of a line (⚡ is drawn two columns wide). */
const cols = (s) => [...strip(s)].length + (strip(s).match(/⚡/g) ?? []).length;

function hero({ charge = 64, worn = true, name } = {}) {
  const state = createNewState({ seed: 1, startScene: "x", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  if (name) state.character.name = name;
  state.inventory = cs.inventory;
  state.time.minutes = 12 * H;
  state.world.phenomenonRolledDay = 99;
  addItem(state, data, "kamien_zmierzchu", 1);
  if (worn) equip(state, data, "kamien_zmierzchu", "talizman");
  state.artifacts.kamien_zmierzchu.charge = charge;
  return state;
}
const omen = (state) => { state.world.phenomenon = { id: "burza_iskier", startsAt: 14 * H, endsAt: 16 * H, omenAt: 12 * H, omenShown: true, started: false }; };
const storm = (state) => { state.world.phenomenon = { id: "burza_iskier", startsAt: 0, endsAt: 20 * H, omenAt: 0, omenShown: true, started: true }; };

test("statusBar: zapowiedź zjawiska i ładunek założonego artefaktu, ≤ 80 kolumn", () => {
  const s = hero();
  omen(s);
  assert.match(strip(statusBar(s, data, { width: 120 })), /Dzień 1, 12:00 · dzień · Brzezina · ⚡ Burza iskier za ~2 h · ◆ Kamień Zmierzchu 64% · Test/);
  const bar = strip(statusBar(s, data, { width: 80 }));
  assert.equal(bar, "Dzień 1, 12:00 · dzień · ⚡ Burza iskier ~2h · ◆ 64% · Test, poz. 1 · HP 38/38");
  assert.ok(cols(bar) <= 80, bar);
  storm(s);
  assert.match(strip(statusBar(s, data, { width: 80 })), /· ⚡ Burza iskier · ◆/);
  const long = hero({ name: "Bardzo Długie Imię Wojownika i Jego Konia Bojowego" });
  omen(long);
  const cut = strip(statusBar(long, data, { width: 80 }));
  assert.ok(cols(cut) <= 80, cut);
  assert.ok(cut.endsWith("…"), cut);
});
test("statusBar: bez artefaktu i zjawiska – jak dotąd; artefakt w sakwie się nie pokazuje", () => {
  const s = hero({ worn: false });
  assert.doesNotMatch(strip(statusBar(s, data, { width: 80 })), /[◆⚡]/);
  s.inventory.equipped.talizman = "kamien_zmierzchu";
  s.inventory.items = s.inventory.items.filter((i) => i.id !== "kamien_zmierzchu"); // stolen
  delete s.inventory.equipped.talizman;
  assert.doesNotMatch(strip(statusBar(s, data, { width: 80 })), /◆/);
});
test("ekran walki: wiersz czasu ze zjawiskiem i ładunkiem, ≤ 22 wiersze bez zawijania", () => {
  const s = hero();
  storm(s);
  const combat = createCombat(s, data, { id: "w", enemies: [{ id: "bandyta", count: 2 }], start: "melee" }, { int: (a) => a });
  combat.playerAp = 6;
  const lines = renderCombat(s, data, combat, { columns: 80, rows: 24, tty: true });
  const time = lines.map(strip).find((l) => l.includes("Dzień 1"));
  assert.match(time, /⚡ Burza iskier · ◆ 64%/);
  assert.ok(lines.every((l) => cols(l) <= 78), lines.map(strip).join("\n"));
  assert.ok(lines.length <= 22);
});
test("Techniki: etykiety zdolności artefaktu z kosztem; wyszarzenie z powodem; koszt HP", () => {
  const s = hero({ charge: 60 });
  const combat = createCombat(s, data, { id: "w", enemies: [{ id: "bandyta" }], start: "melee" }, { int: (a) => a });
  combat.playerAp = 6;
  const items = techniqueItems(data, techniqueActions(s, data, combat));
  const fire = items.find((i) => i.label.startsWith("Płonące ostrze"));
  assert.equal(fire.label, "Płonące ostrze (◆50 · 2 PA)");
  assert.ok(!fire.disabled);
  const veil = items.find((i) => i.label.startsWith("Zasłona Zmierzchu"));
  assert.equal(veil.disabled, true);
  assert.equal(veil.hint, `(${data.ui["artifact.notFull"]})`);
  s.artifacts.kamien_zmierzchu.charge = 0;
  const hp = techniqueItems(data, techniqueActions(s, data, combat)).find((i) => i.label.startsWith("Płonące"));
  assert.equal(hp.label, "Płonące ostrze (−10 HP · 2 PA)");
});

function fightCtx(inputs, { tty = false } = {}) {
  const state = hero({ charge: 100 });
  const d = structuredClone(data);
  d.enemies = d.enemies.map((e) => (e.id === "bandyta" ? { ...e, initiative: 0, hp: 100, attacks: [{ ...e.attacks[0], effects: [] }] } : e));
  return { state, data: d, io: createScriptedIO(inputs, { tty }), rng: { int: (lo) => lo }, debug: false, notices: [] };
}
const FIGHT = { id: "x", type: "combat", enemies: [{ id: "bandyta" }], start: "melee" };

test("scena walki: Techniki → zdolność artefaktu zużywa PA i ładunek (bez wyboru celu)", async () => {
  const ctx = fightCtx(["t", "7"]);
  await assert.rejects(defaultHandlers.combat(ctx, FIGHT), InputExhaustedError);
  const out = ctx.io.text();
  assert.match(out, /\[6\] Płonące ostrze \(◆50 · 2 PA\)/);
  assert.match(out, /\[7\] Zasłona Zmierzchu \(◆100 · 4 PA\)/);
  // an interrupted fight restores the state, so the effect is read from the last screen
  const last = out.slice(out.lastIndexOf("BANDYTA"));
  assert.match(last, /◆ 0%/);
  assert.match(last, /PA ●●●●○○○○ \(4\/8\)\s+\[Zasłona 3\]/);
  assert.match(last, /Kamień Zmierzchu: Zasłona Zmierzchu\./);
});
test("scena walki TTY: podmenu Technik z dwiema zdolnościami mieści się w 23 wierszach", async () => {
  const ctx = fightCtx(["t", "w"], { tty: true });
  await assert.rejects(defaultHandlers.combat(ctx, FIGHT), InputExhaustedError);
  // since E1b: the submenu is the choice panel of a frame (whole height, all rows at once)
  const out = ctx.io.output.join("");
  const at = out.lastIndexOf("Wybierz technikę");
  const next = out.indexOf("\u001b[2J", at);
  const frame = strip(out.slice(out.lastIndexOf("\u001b[2J", at), next < 0 ? undefined : next));
  const rows = frame.split("\n").filter((l) => /^[█▌]/.test(l));
  assert.ok(rows.length <= 23, frame);
  assert.match(frame, /Wybierz technikę/);
  assert.match(frame, /\[7\] Zasłona/); // the artifact's abilities fit the panel without scrolling
  assert.doesNotMatch(frame, /↓/);
});
test("opis artefaktu: ładunek, regeneracja z warunkami, pasywy, zdolności – bez zawijania", () => {
  const s = hero({ charge: 40 });
  const card = strip(renderItemCard(itemById(data, "kamien_zmierzchu"), s, data));
  for (const part of ["40/100 (40%)", "4/h", "noc ×2", "w pobliżu upiora ×0", "od 75%: Bystrość +1", "Płonące ostrze", "50% ładunku", "Zasłona Zmierzchu", "cały ładunek", "10 HP"]) {
    assert.ok(card.includes(part), `${part}\n${card}`);
  }
  assert.ok(card.split("\n").every((l) => cols(l) <= 80), card);
  s.artifacts.kamien_zmierzchu.charge = 80;
  assert.match(strip(renderItemCard(itemById(data, "kamien_zmierzchu"), s, data)), /✓ od 75%/);
});
test("karta postaci: sekcja artefaktu; źródło pasywu w rozbiciu", () => {
  const s = hero({ charge: 80 });
  const sheet = strip(renderCharacter(s, data));
  assert.match(sheet, /Artefakt: Kamień Zmierzchu 80%/);
  assert.match(sheet, /\+1 Kamień Zmierzchu/);
  storm(s);
  assert.match(strip(renderCharacter(s, data)), /-10 Burza iskier/);
});
test("teksty zdarzeń mistyki: komunikaty i dziennik walki", () => {
  const ctx = { data, notices: [] };
  pushEventNotices(ctx, [
    { type: "zapowiedz_zjawiska", id: "burza_iskier" }, { type: "start_zjawiska", id: "burza_iskier" },
    { type: "koniec_zjawiska", id: "burza_iskier" }, { type: "artefakt_naladowany", id: "kamien_zmierzchu" },
    { type: "zlodziej" }, { type: "zlodziej_przylapany" }, { type: "zlodziej_kradnie", money: 12 },
    { type: "zlodziej_artefakt", id: "kamien_zmierzchu" },
  ]);
  const text = ctx.notices.map(strip).join("\n");
  for (const part of ["Powietrze gęstnieje", "Burza iskier", "Zaczyna się", "Mija", "Kamień Zmierzchu", "złodziej", "12 gr"]) {
    assert.ok(text.toLowerCase().includes(part.toLowerCase()), `${part}\n${text}`);
  }
  assert.equal(ctx.notices.length, 8);
  const combat = { enemies: [] };
  assert.equal(combatEventText(data.ui, data, combat, { type: "zdolnosc", artifact: "kamien_zmierzchu", ability: "plonace_ostrze" }), "Kamień Zmierzchu: Płonące ostrze.");
  assert.equal(combatEventText(data.ui, data, combat, { type: "zdolnosc", artifact: "kamien_zmierzchu", ability: "plonace_ostrze", viaHp: 10, text: "Kamień pije z ciebie." }),
    "Kamień Zmierzchu: Płonące ostrze. Kamień pije z ciebie. −10 HP.");
  const scene = { data, notices: [] };
  pushEventNotices(scene, [{ type: "zdolnosc", artifact: "kamien_zmierzchu", ability: "plonace_ostrze" }]);
  assert.equal(scene.notices.length, 1);
});
test("statusBar: przy zjawisku i artefakcie na 80 kolumnach HP zostaje widoczne (skraca się najpierw mistyka)", () => {
  for (const name of ["Thorgniew", "Bardzo Długie Imię Wojownika"]) {
    const s = hero({ name });
    omen(s);
    const bar = strip(statusBar(s, data, { width: 80 }));
    assert.ok(cols(bar) <= 80, bar);
    assert.match(bar, /HP \d+\/\d+/, bar);
    if (name === "Thorgniew") assert.match(bar, /⚡ Burza.*· ◆ \d+%/, bar); // the long name leaves no room for the tags
  }
});
