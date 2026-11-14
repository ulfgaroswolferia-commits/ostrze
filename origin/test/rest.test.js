import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultHandlers } from "../src/scenes/index.js";
import { createNewState } from "../src/engine/state.js";
import { createScriptedIO, InputExhaustedError } from "../src/ui/io.js";
import { createCharacter, creatorStartAttributes } from "../src/systems/character.js";
import { addItem, equip, countOf } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { applyEffect } from "../src/systems/effects.js";
import { artifactState, equippedArtifact } from "../src/systems/artifacts.js";
import { minimalData } from "./helpers.js";

const data = minimalData();
const START = 6 * 60;

/** Rng answering `int` from `values` in order; throws when asked for more (so "no rolls" is checked too). */
function scripted(values) {
  const queue = [...values];
  return { int(min, max) {
    if (queue.length === 0) throw new Error(`rng: nieoczekiwany rzut int(${min}, ${max})`);
    return queue.shift();
  }, left: () => queue.length };
}

function restCtx(inputs, rolls, { stone = true, worn = true, charge } = {}) {
  const state = createNewState({ seed: 1, startScene: "r", rules: { startHour: 6 } });
  state.world.phenomenonRolledDay = 99; // no daily phenomenon roll in these tests
  state.character = createCharacter({
    name: "Ala", classId: "miecz", attributes: { ...creatorStartAttributes(data), sila: 7, zrecznosc: 6, krzepa: 7 }, tagged: ["sieczna", "medycyna", "wymowa"],
  }, data);
  state.character.money = 100;
  state.character.hp = 10;
  if (stone) {
    addItem(state, data, "kamien_zmierzchu", 1);
    if (worn) equip(state, data, "kamien_zmierzchu", "talizman");
    if (charge !== undefined) state.artifacts.kamien_zmierzchu.charge = charge;
  }
  const rng = scripted(rolls);
  return { state, data, io: createScriptedIO(inputs), rng, debug: false, notices: [] };
}
const run = (ctx) => defaultHandlers.rest(ctx, { id: "r", type: "rest" });
const HEAL = 4; // healBase 2 + krzepa 7 / 3
const exposeQuestion = data.ui["rest.expose"];

test("bez artefaktu – brak pytania o wystawienie", async () => {
  const ctx = restCtx(["1+++", "2", ""], [], { stone: false });
  await run(ctx);
  assert.ok(!ctx.io.text().includes(exposeQuestion));
  assert.equal(ctx.state.time.minutes, START + 4 * 60);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});
test("„nie” – żadnych rzutów ryzyka", async () => {
  const ctx = restCtx(["2", "1+++", "2", ""], []);
  await run(ctx);
  assert.ok(ctx.io.text().includes(exposeQuestion));
  assert.equal(ctx.state.time.minutes, START + 4 * 60);
  assert.equal(artifactState(ctx.state, "kamien_zmierzchu").exposed, false);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});
test("„tak” i spokojna noc – pełny sen, ładunek rośnie, po śnie nie jest wystawiony", async () => {
  const ctx = restCtx(["1", "1+++", "2", ""], [9, 9, 9, 9]);
  await run(ctx);
  assert.equal(ctx.state.time.minutes, START + 4 * 60);
  assert.equal(ctx.state.character.hp, 10 + 4 * HEAL);
  assert.equal(artifactState(ctx.state, "kamien_zmierzchu").exposed, false);
  assert.equal(artifactState(ctx.state, "kamien_zmierzchu").charge, 56, "wystawiony: bez kary sakwy");
  assert.equal(ctx.rng.left(), 0);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});
test("złodziej w 2. godzinie, przyłapany – sen przerwany, grosze całe", async () => {
  const ctx = restCtx(["1", "1+++", "2", ""], [5, 4, 1]);
  await run(ctx);
  assert.equal(ctx.state.time.minutes, START + 2 * 60);
  assert.equal(ctx.state.character.hp, 10 + 2 * HEAL);
  assert.equal(ctx.state.character.money, 100);
  assert.equal(artifactState(ctx.state, "kamien_zmierzchu").exposed, false);
  assert.equal(ctx.rng.left(), 0);
  await assert.rejects(ctx.io.ask("?"), InputExhaustedError);
});
test("złodziej nieprzyłapany – kradnie 20–40% groszy, artefakt zostaje", async () => {
  const ctx = restCtx(["1", "1+++", "2", ""], [4, 100, 30, 100]);
  await run(ctx);
  assert.equal(ctx.state.time.minutes, START + 60);
  assert.equal(ctx.state.character.money, 70);
  assert.equal(countOf(ctx.state, "kamien_zmierzchu"), 1);
  assert.equal(ctx.rng.left(), 0);
});
test("złodziej kradnie założony artefakt – zdjęty ze slotu i z torby, wpis ładunku zostaje, pasyw znika", async () => {
  const ctx = restCtx(["1", "1+++", "2", ""], [4, 100, 20, 1, 0], { worn: true, charge: 80 });
  const before = getStats(ctx.state, ctx.data).attributes.bystrosc;
  await run(ctx);
  assert.equal(ctx.state.inventory.equipped.talizman, undefined);
  assert.equal(countOf(ctx.state, "kamien_zmierzchu"), 0);
  assert.ok(artifactState(ctx.state, "kamien_zmierzchu").charge >= 80);
  assert.equal(equippedArtifact(ctx.state, ctx.data), null);
  assert.equal(getStats(ctx.state, ctx.data).attributes.bystrosc, before - 1);
  assert.equal(ctx.state.character.money, 80);
  assert.equal(ctx.rng.left(), 0);
});
test("podczas zjawiska próg ryzyka 10", async () => {
  const calm = restCtx(["1", "1", "2", ""], [5]);
  await run(calm);
  assert.equal(calm.state.character.money, 100);
  assert.equal(calm.rng.left(), 0);
  const storm = restCtx(["1", "1", "2", ""], [10, 1]);
  storm.state.world.phenomenon = { id: "mgla_ciszy", startsAt: 0, endsAt: 30 * 60, omenAt: 0, omenShown: true, started: true };
  await run(storm);
  assert.equal(storm.rng.left(), 0, "10 ≤ 10: złodziej, potem rzut przyłapania");
});
test("pytanie o wystawienie nie obiecuje szybszego ładowania (założony ładuje się tak samo; działają zjawiska nieba)", () => {
  assert.doesNotMatch(data.ui["rest.expose"], /szybciej/);
  assert.match(data.ui["rest.expose"], /zjawisk/);
});
test("D2a: głodny śpi gorzej – leczenie ×0,5 na godzinę", async () => {
  const ctx = restCtx(["1+++", "2", ""], [], { stone: false });
  const inv = ctx.state.inventory;
  inv.items = inv.items.filter((i) => !ctx.data.items.find((x) => x.id === i.id)?.food);
  ctx.state.character.lastMeal = ctx.state.time.minutes - ctx.data.rules.appetite.fullHours * 60;
  applyEffect(ctx.state, ctx.data, "glod", ctx.rng, { force: true });
  await run(ctx);
  // Krzepa 7 − 1 = 6 → (2 + floor(6 / 3)) × 0.5 = 2 HP per hour
  assert.equal(ctx.state.character.hp, 10 + 4 * Math.floor((2 + Math.floor((7 - 1) / 3)) * 0.5));
});
