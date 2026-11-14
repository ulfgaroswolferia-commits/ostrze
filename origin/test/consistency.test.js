import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";

// Lint spójności danych (wytyczne 5 i 2): flagi i przedmioty muszą się domykać. Nowa treść, która ustawia flagę i nigdy jej nie czyta
// (albo czyta flagę, której nic nie ustawia), wywala ten test. Wyjątki są jawne i opisane.
const data = await loadData();

/** Flags set by the engine itself (class choice, dialog_met_kowal: set when a talk starts, read by the smith's upgrade spot) or by content that lands in a later task of the current cycle. */
const SET_ELSEWHERE = new Set(["klasa_miecz", "klasa_wlocznia", "dialog_met_kowal"]);
/** Flags kept as memory of the player's choices for the following acts (read by act III content or only by the endings). */
const MEMORY = new Set([
  "dzien_zamkniety", "akt3_dzien_zamkniety", "akt3b_dzien_zamkniety", "akt4_dzien_zamkniety", "akt4_stolica_dzien_zamkniety", // technical markers of a closed day, not choices
  "akt4c_loch_dzien_zamkniety", "akt5_dzien_zamkniety", "akt6_dzien_zamkniety", // technical markers of a closed day (under the palace, on the island, in the Vortex)
]);
/** Items given and never asked for (kept for later acts). */
const KEEPSAKES = new Set([]);

const setFlags = new Set();
const readFlags = new Set();
function cond(o) {
  if (Array.isArray(o)) return o.forEach(cond);
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) {
    if ((k === "flag" || k === "notFlag") && typeof v === "string") readFlags.add(v);
    else cond(v);
  }
}
const acts = (list) => { for (const a of list ?? []) { if (a.setFlag) setFlags.add(a.setFlag); if (a.clearFlag) setFlags.add(a.clearFlag); } };
function scenes(list) {
  for (const s of list ?? []) {
    for (const k of Object.keys(s.set ?? {})) setFlags.add(k);
    cond(s.if);
    acts(s.onStart);
  }
}
for (const d of data.dialogues) for (const node of Object.values(d.nodes)) {
  acts(node.actions);
  for (const o of node.options ?? []) { acts(o.actions); cond(o.requires); }
}
scenes(data.story.scenes);
for (const l of data.travel.locations) {
  for (const s of l.spots ?? []) { scenes(s.scenes); scenes(s.ambush?.scenes); cond(s.if); cond(s.ambush?.if); }
  for (const v of l.visitors ?? []) { scenes(v.scenes); cond(v.if); }
}
for (const e of data.travel.events) { scenes(e.scenes); cond(e.if); }
for (const q of data.quests) {
  scenes(q.scenes); scenes(q.events); acts(q.onComplete); acts(q.onStart); cond(q.requires);
  for (const o of q.objectives ?? []) cond(o.done);
}
const engineFlag = /^combat_.*_(wygrana|ucieczka|porazka)$/;

test("spójność: każda flaga, której ktoś wymaga, jest gdzieś ustawiana", () => {
  const orphans = [...readFlags].filter((f) => !setFlags.has(f) && !SET_ELSEWHERE.has(f) && !engineFlag.test(f));
  assert.deepEqual(orphans, [], "warunek na flagę, której nic nie ustawia (martwa ścieżka)");
});

test("spójność: każda ustawiona flaga jest czytana albo jawnie zapisana jako pamięć wyborów", () => {
  const dead = [...setFlags].filter((f) => !readFlags.has(f) && !MEMORY.has(f));
  assert.deepEqual(dead, [], "flaga ustawiona i nigdzie nieczytana: użyj jej albo dopisz do MEMORY z powodem");
});

test("spójność: przedmioty fabularne (misc) dawane graczowi są potem potrzebne, oddawane lub jawnie pamiątkowe", () => {
  const blob = JSON.stringify([data.dialogues, data.quests, data.travel, data.story]);
  for (const item of data.items.filter((i) => i.type === "misc" && !KEEPSAKES.has(i.id))) {
    const given = new RegExp(`"giveItem":\s*(\{[^}]*"id":\s*)?"${item.id}"`).test(blob);
    const used = new RegExp(`"(takeItem|item)":\s*(\{[^}]*"id":\s*)?"${item.id}"`).test(blob);
    if (given) assert.ok(used, `${item.id}: dawany, ale nigdzie nie wymagany ani zabierany`);
  }
});
