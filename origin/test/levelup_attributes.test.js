import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";
import { combatState } from "./helpers.js";
import { addXp, applyLevelUp, availablePerks, xpToReach } from "../src/systems/character.js";
import { getStats } from "../src/systems/stats.js";

const data = await loadData();
const fresh = () => {
  const state = combatState(data, "miecz");
  state.time = { minutes: 600 };
  return state;
};
const levelTo = (state, level) => addXp(state.character, xpToReach(level, data.rules) - state.character.xp, data);

/** A valid choice for the pending level-up: every skill point on the first skills with room, the first available perks. */
function choice(state, extra = {}) {
  const pending = state.character.pendingLevelUp;
  const skills = getStats(state, data, { permanentOnly: true }).skills;
  const skillPoints = {};
  let left = pending.skillPoints;
  for (const s of data.skills) {
    const step = state.character.tagged.includes(s.id) ? data.rules.skills.taggedPointValue : 1;
    while (left > 0 && skills[s.id] + step * ((skillPoints[s.id] ?? 0) + 1) <= data.rules.skills.max) { skillPoints[s.id] = (skillPoints[s.id] ?? 0) + 1; left--; }
  }
  const perks = availablePerks(state, data).filter((p) => p.ok).slice(0, pending.perks).map((p) => p.perk.id);
  return { skillPoints, perks, ...extra };
}

test("punkt atrybutu co 2 poziomy: na 3. i 5., nie na 2. i 4.; perki dalej na parzystych", () => {
  const state = fresh();
  levelTo(state, 2);
  assert.equal(state.character.pendingLevelUp.attributePoints ?? 0, 0);
  assert.equal(state.character.pendingLevelUp.perks, 1);
  levelTo(state, 3);
  assert.equal(state.character.pendingLevelUp.attributePoints, 1);
  levelTo(state, 4);
  assert.equal(state.character.pendingLevelUp.attributePoints, 1);
  assert.equal(state.character.pendingLevelUp.perks, 2);
  levelTo(state, 5);
  assert.equal(state.character.pendingLevelUp.attributePoints, 2);
});

test("applyLevelUp rozdaje punkty atrybutów i walidacja nie zostawia śladów", () => {
  const state = fresh();
  levelTo(state, 3);
  const base = { ...state.character.attributes };
  assert.throws(() => applyLevelUp(state, choice(state, { attributes: { sila: 2 } }), data), /za dużo punktów atrybutów/);
  assert.throws(() => applyLevelUp(state, choice(state), data), /rozdaj wszystkie punkty atrybutów/);
  assert.throws(() => applyLevelUp(state, choice(state, { attributes: { nie_ma: 1 } }), data), /nieznany atrybut/);
  assert.deepEqual(state.character.attributes, base);
  assert.ok(state.character.pendingLevelUp, "awans nadal oczekuje");
  applyLevelUp(state, choice(state, { attributes: { sila: 1 } }), data);
  assert.equal(state.character.attributes.sila, base.sila + 1);
  assert.equal(state.character.pendingLevelUp, null);
});

test("atrybut na limicie z kreatora nie przyjmie punktu; gdy wszystkie na limicie, punkt przepada", () => {
  const state = fresh();
  const max = data.rules.creator.attributeMax;
  levelTo(state, 3);
  state.character.attributes.sila = max;
  assert.throws(() => applyLevelUp(state, choice(state, { attributes: { sila: 1 } }), data), /limit/);
  for (const a of data.attributes) state.character.attributes[a.id] = max;
  applyLevelUp(state, choice(state), data);
  assert.equal(state.character.pendingLevelUp, null, "bez atrybutów do podniesienia nie blokuje awansu");
});
