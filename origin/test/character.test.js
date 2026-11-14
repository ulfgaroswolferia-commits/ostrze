import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData } from "./helpers.js";
import { getStats } from "../src/systems/stats.js";
import {
  creatorStartAttributes, validateCreatorChoices, createCharacter, xpToReach, skillPointsPerLevel,
  addXp, availablePerks, applyLevelUp,
} from "../src/systems/character.js";

const data = minimalData();
const attrs = (over) => ({ ...creatorStartAttributes(data), ...over });
const ok = { name: "Thorgniew", classId: "miecz", attributes: attrs({ sila: 7, zrecznosc: 6, krzepa: 7 }), tagged: ["sieczna", "wymowa", "medycyna"] };

test("start z darem Rozumu", () => assert.equal(creatorStartAttributes(data).rozum, 6));
test("poprawny kreator", () => {
  assert.deepEqual(validateCreatorChoices(ok, data), []);
  const c = createCharacter(ok, data); assert.equal(c.level, 1); assert.equal(c.hp, 20 + 3 * 7);
});
test("błędy kreatora", () => {
  for (const bad of [{ attributes: attrs({ sila: 7 }) }, { attributes: attrs({ sila: 11, fart: 1, zrecznosc: 9 }) },
    { tagged: ["wymowa", "medycyna", "handel"] }, { tagged: ["sieczna", "sieczna", "wymowa"] }, { name: "X" }, { name: "R2D2" }, { classId: "luk" },
    { attributes: { ...ok.attributes, extra: 1 } }, { attributes: attrs({ sila: 9, zrecznosc: 6, krzepa: 7 }) }])
    assert.ok(validateCreatorChoices({ ...ok, ...bad }, data).length > 0, JSON.stringify(bad));
  assert.throws(() => createCharacter({ ...ok, name: "X" }, data));
});
test("progi XP i punkty", () => {
  assert.deepEqual([2, 3, 4, 5].map((l) => xpToReach(l, data.rules)), [150, 450, 900, 1500]);
  const c = createCharacter(ok, data);
  assert.equal(skillPointsPerLevel(c, data.rules), 6);
  assert.deepEqual(addXp(c, 149, data), { levelsGained: 0 });
  assert.deepEqual(addXp(c, 1, data), { levelsGained: 1 }); assert.deepEqual(c.pendingLevelUp, { skillPoints: 6, perks: 1 });
});
test("kilka awansów naraz sumuje", () => {
  const c = createCharacter(ok, data); addXp(c, 900, data);
  assert.equal(c.level, 4); assert.deepEqual(c.pendingLevelUp, { skillPoints: 18, perks: 2, attributePoints: 1 });
});
test("availablePerks: wymagania i braki", () => {
  const state = { character: createCharacter(ok, data), time: { minutes: 23 * 60 } };
  const byId = Object.fromEntries(availablePerks(state, data).map((p) => [p.perk.id, p]));
  assert.equal(byId.twarda_skora.ok, true); assert.equal(byId.sokole_oko.ok, false);
  assert.deepEqual(byId.sokole_oko.missing, [{ kind: "attribute", id: "bystrosc", need: 6, have: 5 }]);
  assert.equal(byId.szczesciarz.missing[0].kind, "level");
});
test("availablePerks: owned i limit", () => {
  const state = { character: createCharacter(ok, data), time: { minutes: 600 } };
  state.character.perks = ["twarda_skora"];
  assert.deepEqual(availablePerks(state, data).find((p) => p.perk.id === "twarda_skora").missing, [{ kind: "owned" }]);
  state.character.perks = ["twarda_skora", "twarda_reka", "lekki_krok", "szczesciarz", "kocie_zycie", "cyrulik"];
  const t = availablePerks(state, data).find((p) => p.perk.id === "gadane");
  assert.ok(t.missing.some((m) => m.kind === "attribute")); assert.equal(t.missing.at(-1).kind, "limit");
});
test("applyLevelUp: rozdanie, perk, pełne leczenie, błędy", () => {
  const state = { character: createCharacter(ok, data), time: { minutes: 600 } };
  addXp(state.character, 150, data); state.character.hp = 1;
  assert.throws(() => applyLevelUp(state, { skillPoints: { sieczna: 5 }, perks: ["twarda_skora"] }, data));
  assert.throws(() => applyLevelUp(state, { skillPoints: { sieczna: 6 }, perks: ["sokole_oko"] }, data));
  assert.throws(() => applyLevelUp(state, { skillPoints: { sieczna: 6 }, perks: [] }, data));
  assert.deepEqual(state.character.skillPoints, {});
  applyLevelUp(state, { skillPoints: { sieczna: 4, wrecz: 2 }, perks: ["twarda_skora"] }, data);
  const c = state.character; assert.equal(c.pendingLevelUp, null); assert.deepEqual(c.perks, ["twarda_skora"]);
  assert.equal(c.hp, getStats(state, data).derived.hpMax);
});
test("applyLevelUp: limit umiejętności", () => {
  const state = { character: createCharacter(ok, data), time: { minutes: 600 } };
  addXp(state.character, 150, data);
  state.character.skillPoints.sieczna = 25; // wiodąca: ~14+20+50 = 84+
  const before = getStats(state, data).skills.sieczna;
  assert.throws(() => applyLevelUp(state, { skillPoints: { sieczna: 6 }, perks: ["twarda_skora"] }, data), /limit/);
  assert.equal(state.character.skillPoints.sieczna, 25); assert.ok(before < 100);
});
test("applyLevelUp: wszystkie umiejętności na limicie pozwalają na mniejszą sumę", () => {
  const state = { character: createCharacter(ok, data), time: { minutes: 600 } };
  addXp(state.character, 150, data);
  for (const s of data.skills) state.character.skillPoints[s.id] = 100;
  applyLevelUp(state, { skillPoints: {}, perks: ["twarda_skora"] }, data);
  assert.equal(state.character.pendingLevelUp, null);
});
test("limit 6 perków: przy 6 posiadanych awans nie daje perka", () => {
  const c = createCharacter(ok, data);
  c.perks = ["twarda_skora", "twarda_reka", "lekki_krok", "szczesciarz", "kocie_zycie", "cyrulik"];
  addXp(c, 450 - 150 + 150, data);
  assert.equal(c.level, 3);
  addXp(c, 450, data);
  assert.equal(c.level, 4); assert.equal(c.pendingLevelUp.perks, 0);
});

test("imię liczy się w znakach, nie w jednostkach UTF-16 (jak w kreatorze)", () => {
  const astral = "\u{1D49C}"; // a letter outside the BMP: 2 UTF-16 units, 1 character
  assert.ok(validateCreatorChoices({ ...ok, name: astral }, data).length > 0, "jeden znak to za mało");
  assert.deepEqual(validateCreatorChoices({ ...ok, name: astral.repeat(11) }, data), [], "11 znaków mieści się w 20");
  assert.ok(validateCreatorChoices({ ...ok, name: astral.repeat(21) }, data).length > 0);
});
