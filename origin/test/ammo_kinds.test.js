import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { minimalData, tmpDir } from "./helpers.js";
import { addItem, countOf, equip, pickAmmo, loadedAmmoOf } from "../src/systems/inventory.js";
import { itemById } from "../src/systems/items.js";
import { createCombat } from "../src/systems/combat/state.js";
import { playerActions, doAction } from "../src/systems/combat/actions.js";
import { savesDir } from "../src/config.js";
import { loadGame, saveGame } from "../src/engine/save.js";
import { createRng } from "../src/engine/dice.js";
import { createNewState } from "../src/engine/state.js";
import { validateData } from "../src/engine/data.js";
import { runActions } from "../src/systems/actions.js";

let prevHome;
beforeEach(async () => {
  prevHome = process.env.OSTRZE_HOME;
  process.env.OSTRZE_HOME = await tmpDir();
});
afterEach(() => {
  if (prevHome === undefined) delete process.env.OSTRZE_HOME;
  else process.env.OSTRZE_HOME = prevHome;
});

const data = minimalData();
const fixed = (k) => ({ int: () => k });

function mk() {
  return {
    character: {
      name: "T", classId: "miecz", level: 1, xp: 0,
      attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 },
      skillPoints: {}, tagged: [], perks: [], pendingLevelUp: null, hp: 35, effects: [],
    },
    time: { minutes: 12 * 60 },
    inventory: { items: [], equipped: {}, quickSlots: [], loaded: {} },
  };
}
const kusza = () => itemById(data, "kusza_lekka");

test("bełty mają pola amunicji z danych", () => {
  const w = itemById(data, "belt_wzmocniony");
  const e = itemById(data, "belt_wybuchowy");
  assert.deepEqual([w.type, w.ammoOf, w.damageBonus, w.value], ["ammo", "belt", 1, 5]);
  assert.deepEqual([e.type, e.ammoOf, e.damageBonus, e.explosive, e.value], ["ammo", "belt", 1, true, 10]);
});

test("kusza ładuje najlepszy dostępny bełt", () => {
  const s = mk();
  addItem(s, data, "belt", 2); addItem(s, data, "belt_wzmocniony", 1); addItem(s, data, "kusza_lekka", 1);
  assert.equal(pickAmmo(s, data, kusza()), "belt_wzmocniony");
  equip(s, data, "kusza_lekka", "bron");
  assert.equal(s.inventory.loaded.kusza_lekka, 1);
  assert.equal(loadedAmmoOf(s, kusza()), "belt_wzmocniony");
  assert.equal(countOf(s, "belt_wzmocniony"), 0);
  assert.equal(countOf(s, "belt"), 2);
});

test("wybuchowy tylko po włączeniu przełącznika", () => {
  const s = mk();
  addItem(s, data, "belt", 1); addItem(s, data, "belt_wzmocniony", 1); addItem(s, data, "belt_wybuchowy", 1);
  assert.equal(pickAmmo(s, data, kusza()), "belt_wzmocniony");
  s.inventory.loadExplosive = true;
  assert.equal(pickAmmo(s, data, kusza()), "belt_wybuchowy");
  addItem(s, data, "kusza_lekka", 1);
  equip(s, data, "kusza_lekka", "bron");
  assert.equal(loadedAmmoOf(s, kusza()), "belt_wybuchowy");
});

test("sam wybuchowy przy wyłączonym przełączniku nie ładuje się", () => {
  const s = mk();
  addItem(s, data, "belt_wybuchowy", 3); addItem(s, data, "kusza_lekka", 1);
  assert.equal(pickAmmo(s, data, kusza()), null);
  equip(s, data, "kusza_lekka", "bron");
  assert.equal(s.inventory.loaded.kusza_lekka ?? 0, 0);
  assert.equal(countOf(s, "belt_wybuchowy"), 3);
});

test("pusty zapas: reload niedostępny z combat.noAmmo, z zapasem ładuje wybrany bełt", () => {
  const s = mk();
  addItem(s, data, "kusza_lekka", 1);
  equip(s, data, "kusza_lekka", "bron");
  const combat = createCombat(s, data, { enemies: [{ id: "bandyta", count: 1 }], start: "far", canFlee: true }, fixed(1));
  combat.playerAp = 6;
  const reload = () => playerActions(s, data, combat).find((a) => a.id === "reload");
  assert.equal(reload().reason, "combat.noAmmo");
  addItem(s, data, "belt_wybuchowy", 1);
  assert.equal(reload().reason, "combat.explosiveOff", "same wybuchowe przy wyłączonym ładowaniu");
  addItem(s, data, "belt", 1); addItem(s, data, "belt_wzmocniony", 1);
  assert.equal(reload().disabled, false);
  assert.equal(doAction(s, data, combat, { id: "reload" }, fixed(1)).ok, true);
  assert.equal(s.inventory.loaded.kusza_lekka, 1);
  assert.equal(loadedAmmoOf(s, kusza()), "belt_wzmocniony");
  assert.equal(countOf(s, "belt_wzmocniony"), 0);
  assert.equal(countOf(s, "belt"), 1);
});

test("combat.explosiveOff: przy włączonym ładowaniu reload bierze wybuchowy; pistolet z bełtami wybuchowymi dalej noAmmo", () => {
  const s = mk();
  addItem(s, data, "kusza_lekka", 1);
  equip(s, data, "kusza_lekka", "bron");
  addItem(s, data, "belt_wybuchowy", 2);
  const combat = createCombat(s, data, { enemies: [{ id: "bandyta", count: 1 }], start: "far", canFlee: true }, fixed(1));
  combat.playerAp = 6;
  const reload = () => playerActions(s, data, combat).find((a) => a.id === "reload");
  assert.equal(reload().reason, "combat.explosiveOff");
  assert.ok(data.ui["combat.explosiveOff"]);
  s.inventory.loadExplosive = true;
  assert.equal(reload().disabled, false);
  assert.equal(doAction(s, data, combat, { id: "reload" }, fixed(1)).ok, true);
  assert.equal(loadedAmmoOf(s, kusza()), "belt_wybuchowy");

  const p = mk();
  const pistol = Object.values(data.items).find((i) => i.reload?.ammo === "kula_z_prochem");
  addItem(p, data, pistol.id, 1);
  equip(p, data, pistol.id, "bron");
  addItem(p, data, "belt_wybuchowy", 2);
  const pc = createCombat(p, data, { enemies: [{ id: "bandyta", count: 1 }], start: "far", canFlee: true }, fixed(1));
  pc.playerAp = 6;
  assert.equal(playerActions(p, data, pc).find((a) => a.id === "reload").reason, "combat.noAmmo");
});

test("ostatnia sztuka broni odchodzi: znika jej ładunek i rodzaj bełtu, następna przychodzi pusta", () => {
  const s = mk();
  s.inventory.loadExplosive = true;
  addItem(s, data, "belt_wybuchowy", 1);
  addItem(s, data, "kusza_lekka", 1);
  equip(s, data, "kusza_lekka", "bron");
  assert.equal(s.inventory.loaded.kusza_lekka, 1);
  assert.equal(loadedAmmoOf(s, kusza()), "belt_wybuchowy");
  // a smith's exchange: unequip, take; the same helper serves selling and dropping
  runActions(s, data, [{ unequipItem: "kusza_lekka" }, { takeItem: "kusza_lekka" }], fixed(1));
  assert.equal(countOf(s, "kusza_lekka"), 0);
  assert.equal("kusza_lekka" in s.inventory.loaded, false);
  assert.equal("kusza_lekka" in (s.inventory.loadedAmmo ?? {}), false);
  addItem(s, data, "kusza_lekka", 1);
  assert.equal(s.inventory.loaded.kusza_lekka ?? 0, 0, "nowa kusza nie jest naładowana");

  // a spare copy leaves: the loaded one stays as it was
  const t = mk();
  addItem(t, data, "belt", 1);
  addItem(t, data, "kusza_lekka", 2);
  equip(t, data, "kusza_lekka", "bron");
  runActions(t, data, [{ takeItem: "kusza_lekka" }], fixed(1));
  assert.equal(countOf(t, "kusza_lekka"), 1);
  assert.equal(t.inventory.loaded.kusza_lekka, 1);
});

test("pistolet nie bierze bełtów", () => {
  const s = mk();
  const pistol = Object.values(data.items).find((i) => i.reload?.ammo === "kula_z_prochem");
  addItem(s, data, "belt", 2); addItem(s, data, "belt_wzmocniony", 2);
  assert.equal(pickAmmo(s, data, pistol), null);
  addItem(s, data, pistol.id, 1);
  equip(s, data, pistol.id, "bron");
  assert.equal(s.inventory.loaded[pistol.id] ?? 0, 0);
  assert.equal(countOf(s, "belt"), 2);
});

test("loadedAmmoOf: broń naładowana bez wpisu liczy się jako zwykły bełt", () => {
  const s = mk();
  s.inventory.loaded.kusza_lekka = 1;
  assert.equal(loadedAmmoOf(s, kusza()), "belt");
});

test("dane z bełtami przechodzą walidację", () => {
  assert.deepEqual(validateData(data).filter((m) => /belt|ammo/i.test(m)), []);
});

// --- save ---
const put = async (state) => {
  await mkdir(savesDir(), { recursive: true });
  await writeFile(path.join(savesDir(), "1.json"), JSON.stringify(state));
};
const hero = () => ({
  name: "Ala", classId: "miecz", level: 1, xp: 0, money: 7, attributes: { sila: 5 },
  skillPoints: {}, tagged: [], perks: [], pendingLevelUp: null, hp: 10, effects: [],
});
const withInv = (inventory) => ({ ...createNewState({ seed: 1, startScene: "a", rules: { startHour: 6 } }), character: hero(), inventory: { items: [], equipped: {}, quickSlots: [], loaded: {}, ...inventory } });

test("stary zapis bez loadedAmmo wczytuje się bez ostrzeżeń i liczy jako zwykły bełt", async () => {
  await put(withInv({ loaded: { kusza_lekka: 1 } }));
  const warnings = [];
  const s = await loadGame("1", data, { warnings });
  assert.deepEqual(warnings, []);
  assert.equal(loadedAmmoOf(s, kusza()), "belt");
});

test("loadedAmmo i loadExplosive: pełny cykl bez ostrzeżeń", async () => {
  await saveGame("1", withInv({ loaded: { kusza_lekka: 1 }, loadedAmmo: { kusza_lekka: "belt_wzmocniony" }, loadExplosive: true }), createRng(1));
  const warnings = [];
  const s = await loadGame("1", data, { warnings });
  assert.deepEqual(warnings, []);
  assert.deepEqual(s.inventory.loadedAmmo, { kusza_lekka: "belt_wzmocniony" });
  assert.equal(s.inventory.loadExplosive, true);
});

test("nieznany bełt w loadedAmmo jest naprawiany i zgłaszany", async () => {
  await put(withInv({ loaded: { kusza_lekka: 1 }, loadedAmmo: { kusza_lekka: "belt_zaginiony" } }));
  const warnings = [];
  const s = await loadGame("1", data, { warnings });
  assert.equal(warnings.length, 1); assert.match(warnings[0], /belt_zaginiony/);
  assert.equal(loadedAmmoOf(s, kusza()), "belt");
});

test("loadedAmmo: bełt nie do tej broni jest naprawiany", async () => {
  await put(withInv({ loaded: { kusza_lekka: 1 }, loadedAmmo: { kusza_lekka: "strzala" } }));
  const warnings = [];
  const s = await loadGame("1", data, { warnings });
  assert.equal(warnings.length, 1);
  assert.equal(loadedAmmoOf(s, kusza()), "belt");
});
