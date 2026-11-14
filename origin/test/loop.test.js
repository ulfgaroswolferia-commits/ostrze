import { test } from "node:test";
import assert from "node:assert/strict";
import { createSceneList, runScenes, runStory } from "../src/engine/loop.js";
import { minimalData } from "./helpers.js";

const rec = (log) => ({ step: async (_c, s) => { log.push(s.id); return s.result; } });
const mk = (scenes) => {
  const log = [];
  const state = { flags: { f: true }, time: { minutes: 0 }, scene: { id: scenes[0].id } };
  return { log, ctx: { state, handlers: rec(log), story: createSceneList(scenes) } };
};

test("wykonuje sceny po kolei i kończy na końcu listy", async () => {
  const { log, ctx } = mk([{ id: "a", type: "step" }, { id: "b", type: "step" }]);
  assert.deepEqual(await runStory(ctx), { end: true });
  assert.deepEqual(log, ["a", "b"]);
});

test("if pomija, goto sceny i goto wyniku przekierowują, end kończy z outcome", async () => {
  const { log, ctx } = mk([
    { id: "a", type: "step", goto: "c" },
    { id: "b", type: "step", result: { end: true, outcome: "ok" } },
    { id: "c", type: "step", if: { notFlag: "f" } },
    { id: "d", type: "step", result: { goto: "b" } },
  ]);
  assert.deepEqual(await runStory(ctx), { end: true, outcome: "ok" });
  assert.deepEqual(log, ["a", "d", "b"]);
});

test("time przesuwa zegar, scene.id śledzone tylko z trackScene", async () => {
  const { ctx } = mk([{ id: "a", type: "step", time: 30 }, { id: "b", type: "step", time: 15 }]);
  ctx.data = minimalData();
  await runStory(ctx);
  assert.equal(ctx.state.time.minutes, 45);
  assert.equal(ctx.state.scene.id, "b");
  const other = createSceneList([{ id: "x", type: "step" }]);
  await runScenes(ctx, other, "x");
  assert.equal(ctx.state.scene.id, "b");
});

test("scene.id ustawiane PRZED handlerem (zapis w trakcie sceny pamięta ją)", async () => {
  const seen = [];
  const { ctx } = mk([{ id: "a", type: "spy" }]);
  ctx.handlers = { spy: async (c) => { seen.push(c.state.scene.id); } };
  ctx.state.scene.id = "zzz";
  await runScenes(ctx, ctx.story, "a", { trackScene: true });
  assert.deepEqual(seen, ["a"]);
});

test("createSceneList: nextId, has, get nieznanego rzuca", () => {
  const l = createSceneList([{ id: "a" }, { id: "b" }]);
  assert.equal(l.nextId("a"), "b");
  assert.equal(l.nextId("b"), null);
  assert.equal(l.has("c"), false);
  assert.throws(() => l.get("c"));
});

test("brak handlera dla typu sceny rzuca błąd z nazwą typu", async () => {
  const { ctx } = mk([{ id: "a", type: "nieznany" }]);
  ctx.handlers = {};
  await assert.rejects(runStory(ctx), /nieznany/);
});

test("scene.time przez advanceTime → notatka o zmianie pory", async () => {
  const { ctx } = mk([{ id: "a", type: "step", time: 60 }]);
  ctx.data = minimalData();
  ctx.state.time.minutes = 17 * 60 + 30;
  await runStory(ctx);
  assert.equal(ctx.notices.length, 1);
  assert.ok(ctx.notices[0].includes("Zapada zmierzch."));
});

test("hooki afterScene po wykonanej scenie, nie po pominiętej; runStory woła przed pierwszą sceną", async () => {
  const { log, ctx } = mk([{ id: "a", type: "step" }, { id: "b", type: "step", if: { notFlag: "f" } }, { id: "c", type: "step" }]);
  let calls = 0;
  ctx.afterScene = [async () => { calls += 1; }];
  await runStory(ctx);
  assert.deepEqual(log, ["a", "c"]);
  assert.equal(calls, 3);
});

test("D2a: onScene dostaje id przed handlerem; goto do endId kończy listę", async () => {
  const seen = [];
  const { log, ctx } = mk([{ id: "a", type: "step", goto: "c" }, { id: "b", type: "step" }, { id: "c", type: "step", goto: "koniec" }, { id: "d", type: "step" }]);
  assert.deepEqual(await runScenes(ctx, ctx.story, "a", { onScene: (id) => seen.push(id), endId: "koniec" }), { end: true });
  assert.deepEqual(log, ["a", "c"]);
  assert.deepEqual(seen, ["a", "c"]);
  assert.equal(ctx.state.scene.id, "a", "onScene nie rusza scene.id");
});

// --- E2a: waitUntil ---
test("waitUntil: scena zaczyna się o podanej godzinie – dziś, a gdy już po niej, następnego dnia; bez danych w state.time nic nie psuje", async () => {
  const data = minimalData();
  const seen = [];
  const handlers = { step: async (c) => { seen.push(c.state.time.minutes); } };
  const run = async (start, hour) => {
    const state = { flags: {}, time: { minutes: start }, scene: { id: "a" }, character: null };
    const ctx = { state, data, handlers, story: createSceneList([{ id: "a", type: "step", waitUntil: hour }]), rng: { int: () => 1 } };
    await runStory(ctx);
  };
  await run(9 * 60 + 30, 18);
  await run(19 * 60, 18);
  await run(18 * 60, 18);
  assert.deepEqual(seen, [18 * 60, 24 * 60 + 18 * 60, 18 * 60], "9:30→18:00, 19:00→18:00 jutro, 18:00 zostaje");
});
