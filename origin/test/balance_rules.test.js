import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { combatState } from "./helpers.js";
import { getStats } from "../src/systems/stats.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { addXp, availablePerks, applyLevelUp } from "../src/systems/character.js";
import { createCombat } from "../src/systems/combat/state.js";
import { playerActions } from "../src/systems/combat/actions.js";
import { fleeChance } from "../src/systems/combat/formulas.js";
import { combatActionItems } from "../src/ui/combat_screen.js";
import { createRng } from "../src/engine/dice.js";

const data = await loadData();

const wearing = (kit) => {
  const s = combatState(data, "miecz");
  for (const slot of ["glowa", "tulow", "rece", "nogi", "plaszcz"]) delete s.inventory.equipped[slot];
  for (const [slot, id] of kit) { addItem(s, data, id, 1); assert.equal(equip(s, data, id, slot).ok, true, id); }
  return getStats(s, data).derived;
};
const FULL = [["glowa", "helm_straznika"], ["tulow", "polpancerz"], ["rece", "rekawice_kolcze"], ["nogi", "nagolenniki"], ["plaszcz", "plaszcz_cesarski"]];

test("pancerz: pełny komplet liczy się słabiej ponad próg (11 → 8, cięte 75% → 57%)", () => {
  const d = wearing(FULL);
  assert.equal(d.armor, 8);
  assert.equal(d.reduction.sieczne, 57);
  assert.equal(d.reduction.klute, 35, "poniżej progu bez zmian");
  assert.equal(d.reduction.obuchowe, 20, "poniżej progu bez zmian");
});

test("pancerz: lekki strój nie traci nic, ani we wczesnej grze, ani u lekko ubranego włócznika", () => {
  assert.equal(wearing([["tulow", "kaftan_przeszywany"]]).armor, 2);
  assert.equal(wearing([["tulow", "kaftan_przeszywany"]]).reduction.sieczne, 15);
  const kit = wearing([["tulow", "kaftan_przeszywany"], ["rece", "karwasze"], ["plaszcz", "plaszcz_cesarski"]]);
  assert.equal(kit.armor, 4);
  assert.equal(kit.reduction.sieczne, 30);
  assert.equal(kit.reduction.obuchowe, 30);
});

const fight = (melee) => {
  const s = combatState(data, "miecz");
  s.character.attributes.zrecznosc = 5;
  delete s.inventory.equipped.nogi;
  const combat = createCombat(s, data, { id: "t", type: "combat", enemies: [{ id: "bandyta", count: 4 }], start: "far", canFlee: true }, createRng(1));
  combat.enemies.forEach((e, i) => { e.band = i < melee ? "melee" : "far"; });
  combat.playerAp = 8;
  return { s, combat };
};

test("ucieczka: wróg w zwarciu odejmuje 5 punktów procentowych, nie 10", () => {
  const free = fight(0);
  const crowded = fight(4);
  assert.equal(fleeChance(free.s, data, free.combat) - fleeChance(crowded.s, data, crowded.combat), 20);
  assert.equal(fleeChance(crowded.s, data, crowded.combat), 25);
});

test("ucieczka: menu walki pokazuje koszt i aktualną szansę", () => {
  const { s, combat } = fight(3);
  const chance = fleeChance(s, data, combat);
  const flee = combatActionItems(data.ui, playerActions(s, data, combat)).find((i) => i.label === "Ucieczka");
  assert.equal(flee.hint, `(${data.rules.combat.fleeAp} PA · ${chance}%)`);
});

test("ucieczka: szansa w menu spada, gdy podchodzi kolejny wróg", () => {
  const hint = (melee) => { const { s, combat } = fight(melee); return combatActionItems(data.ui, playerActions(s, data, combat)).find((i) => i.label === "Ucieczka").hint; };
  assert.notEqual(hint(0), hint(4));
});

const narrow = (classId, attrs, skill) => {
  const s = combatState(data, classId);
  Object.assign(s.character, { level: 12, perks: [], attributes: { ...s.character.attributes, ...attrs } });
  s.character.skillPoints[skill] = 40;
  return availablePerks(s, data).filter((p) => p.ok).map((p) => p.perk.id);
};
const rest = { krzepa: 5, bystrosc: 5, rozum: 5, oglada: 5, fart: 5 };

test("perki: bohater z punktami w samej sile ma z czego wybierać w obu klasach", () => {
  const sword = narrow("miecz", { sila: 10, zrecznosc: 5, ...rest }, "sieczna");
  const spear = narrow("wlocznia", { sila: 10, zrecznosc: 5, ...rest }, "drzewcowa");
  assert.ok(sword.length >= 5, sword.join());
  assert.equal(spear.length, sword.length, "klasa nie zmienia liczby perków");
  for (const id of ["pewny_chwyt", "wol_roboczy"]) assert.ok(sword.includes(id), id);
});

test("perki: bohater z punktami w samej zręczności też", () => {
  const list = narrow("miecz", { sila: 5, zrecznosc: 10, ...rest }, "sieczna");
  assert.ok(list.length >= 4, list.join());
  for (const id of ["unik", "szybkie_nogi"]) assert.ok(list.includes(id), id);
});

test("perki: dane nowych perków przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
});

const levelTo = (s, level) => {
  const need = (level - 1) * level / 2 * data.rules.leveling.xpStep;
  addXp(s.character, Math.max(0, need - s.character.xp), data);
};
const spendAll = (s, perks) => {
  const p = s.character.pendingLevelUp;
  const attributes = p.attributePoints ? { krzepa: p.attributePoints } : {};
  applyLevelUp(s, { perks, attributes, skillPoints: { medycyna: p.skillPoints } }, data);
};

test("perki: punkt bez dostępnego perka nie przepada, wraca przy następnym awansie", () => {
  const s = combatState(data, "miecz");
  const empty = { ...data, perks: [] };
  levelTo(s, 2);
  assert.equal(s.character.pendingLevelUp.perks, 1);
  const p = s.character.pendingLevelUp;
  applyLevelUp(s, { perks: [], skillPoints: { medycyna: p.skillPoints } }, empty); // nothing to pick
  assert.equal(s.character.perks.length, 0);
  levelTo(s, 3);
  assert.equal(s.character.pendingLevelUp.perks, 1, "odłożony punkt wrócił");
});

test("perki: stary zapis, w którym punkt przepadł, odzyskuje go przy kolejnym awansie", () => {
  const s = combatState(data, "miecz");
  Object.assign(s.character, { level: 7, perks: ["szkola_miecza"], xp: 21 * data.rules.leveling.xpStep, pendingLevelUp: null });
  levelTo(s, 8);
  assert.equal(s.character.pendingLevelUp.perks, 3, "poziom 8 to 4 perki, ma 1");
});

test("perki: zwykły przebieg bez zmian, jeden perk co dwa poziomy i nie więcej niż limit", () => {
  const s = combatState(data, "miecz");
  levelTo(s, 2);
  assert.equal(s.character.pendingLevelUp.perks, 1);
  spendAll(s, [availablePerks(s, data).find((p) => p.ok).perk.id]);
  levelTo(s, 3);
  assert.equal(s.character.pendingLevelUp.perks, 0);
  const full = combatState(data, "miecz");
  const six = data.perks.slice(0, data.rules.leveling.maxPerks).map((p) => p.id);
  Object.assign(full.character, { level: 13, perks: six, xp: 78 * data.rules.leveling.xpStep, pendingLevelUp: null });
  levelTo(full, 14);
  assert.equal(full.character.pendingLevelUp.perks, 0, "komplet zostaje kompletem");
});
