import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData } from "../src/engine/data.js";

// Analiza grafu fabuły: optymistyczny punkt stały. Zaczynamy od pustego stanu i dokładamy wszystko, co da się osiągnąć,
// zakładając, że każdy warunek na liczby (pieniądze, umiejętności, zmienne) da się spełnić. Warunki na flagi, przedmioty,
// odkryte miejsca i statusy zleceń są liczone dokładnie. Wynik: co jest nieosiągalne mimo optymizmu, to błąd w grafie.
const data = await loadData();

const S = { flags: new Set(["klasa_miecz", "klasa_wlocznia"]), items: new Set(), places: new Set(), started: new Set(), done: new Set(), dialogues: new Set(), nodes: new Set() };
const size = () => S.flags.size + S.items.size + S.places.size + S.started.size + S.done.size + S.nodes.size;

// ---- conditions
function ok(c) {
  if (!c) return true;
  if (Array.isArray(c)) return c.every(ok);
  if (Object.hasOwn(c, "var")) return true;
  return Object.entries(c).every(([k, v]) => {
    switch (k) {
      case "flag": return S.flags.has(v) || (v.startsWith("dialog_met_") && S.dialogues.has(v.slice(11))); // the engine sets dialog_met_<id> when a talk starts
      case "notFlag": return true;
      case "all": return v.every(ok);
      case "any": return v.some(ok);
      case "questStatus": return v.is === "none" || v.is === "failed" || (v.is === "active" ? S.started.has(v.id) : S.done.has(v.id));
      case "item": return S.items.has(typeof v === "string" ? v : v.id);
      case "known": return known(v);
      default: return true; // money, attribute, skill, effect, timeOfDay, region, location, search, travelDay ...
    }
  });
}
const locOf = (id) => data.travel.locations.find((l) => l.id === id);
function known(id) {
  const [locId, spotId] = id.split(".");
  const loc = locOf(locId);
  if (!loc) return false;
  if (loc.secret && !S.places.has(locId)) return false;
  if (!spotId) return true;
  const spot = loc.spots?.find((s) => s.id === spotId);
  return Boolean(spot) && (!spot.secret || S.places.has(id) || Boolean(spot.if)); // a secret spot with an `if` shows up when it holds
}

// ---- actions
/** A reached giveRandom: any entry of the loot table can drop. */
const giveTable = (id) => { for (const e of data.loot.tables.find((x) => x.id === id)?.entries ?? []) S.items.add(e.item); };
const giveLoot = (l) => { if (l.giveItem) S.items.add(l.giveItem); if (l.giveRandom) giveTable(l.giveRandom); };
function act(list) {
  for (const a of list ?? []) {
    const [k] = Object.keys(a); const v = a[k];
    if (k === "setFlag") S.flags.add(v);
    else if (k === "giveItem") S.items.add(typeof v === "string" ? v : v.id);
    else if (k === "giveRandom") giveTable(v);
    else if (k === "reveal") S.places.add(v);
    else if (k === "startQuest") S.started.add(v);
    else if (k === "completeQuest") S.done.add(v);
  }
}
const addScenes = (list) => {
  for (const s of list ?? []) {
    if (!ok(s.if)) continue;
    if (s.type === "flag") for (const f of Object.keys(s.set)) S.flags.add(f);
    if (s.type === "reward") for (const i of s.items ?? []) S.items.add(typeof i === "string" ? i : i.id);
    if (s.type === "quest") { if (s.start) S.started.add(s.start); if (s.complete || s.report) S.done.add(s.complete ?? s.report); }
    if (s.type === "map") for (const q of s.starts ?? []) S.started.add(q);
    if (s.type === "dialogue" && s.dialogue) S.dialogues.add(s.dialogue);
    if (s.type === "shop") for (const e of data.shops.find((x) => x.id === s.shop)?.stock ?? []) S.items.add(e.id);
    if (s.type === "combat") for (const e of s.enemies ?? []) for (const l of data.enemies.find((x) => x.id === e.id)?.loot ?? []) giveLoot(l);
    for (const l of s.loot ?? []) giveLoot(l);
    act(s.onStart);
  }
};
const dialogue = (id) => data.dialogues.find((d) => d.id === id);

function walkDialogue(d) {
  const seen = new Set();
  const visit = (nid) => {
    if (nid === "end" || nid.startsWith("end:") || seen.has(nid) || !d.nodes[nid]) return;
    seen.add(nid); S.nodes.add(`${d.id}:${nid}`);
    const node = d.nodes[nid];
    act(node.actions);
    for (const o of node.options ?? []) {
      if (!ok(o.requires)) continue;
      act(o.actions);
      for (const t of [o.goto, o.success, o.failure, o.tooHeavy]) if (typeof t === "string") visit(t);
    }
  };
  visit(d.start); if (d.returnStart) visit(d.returnStart);
}

function round() {
  // initial kit
  for (const c of data.classes) for (const i of c.startItems ?? []) S.items.add(i.id);
  for (const r of Object.values(data.travel.regions)) for (const f of r.forage ?? []) S.items.add(f.item); // found while making camp
  for (const l of data.travel.locations) if (!l.secret) S.places.add(l.id);
  // story
  addScenes(data.story.scenes);
  // events (road and walks)
  for (const e of data.travel.events) if (ok(e.if)) addScenes(e.scenes);
  // locations: spots and visitors, when the place is known
  for (const l of data.travel.locations) {
    if (!known(l.id)) continue;
    for (const v of l.visitors ?? []) if (ok(v.if)) addScenes(v.scenes);
    for (const sp of l.spots ?? []) {
      if (!known(`${l.id}.${sp.id}`) || !ok(sp.if)) continue;
      if (sp.type === "talk") S.dialogues.add(sp.ref);
      if (sp.type === "shop") for (const e of data.shops.find((x) => x.id === sp.ref)?.stock ?? []) S.items.add(e.id);
      addScenes(sp.scenes);
      addScenes(sp.ambush?.scenes ?? []);
    }
  }
  // dialogues reachable through some host
  for (const id of [...S.dialogues]) { const d = dialogue(id); if (d) walkDialogue(d); }
  // quests
  for (const q of data.quests) {
    const board = q.board && ok(q.requires) && known(q.hub);
    if (board) S.started.add(q.id);
    if (!S.started.has(q.id)) continue;
    act(q.onStart);
    if (q.kind === "errand") {
      if (q.objectives.every((o) => ok(o.done))) { S.done.add(q.id); act(q.onComplete); }
    } else {
      addScenes(q.scenes);
      if (q.kind === "quest" && (S.done.has(q.id))) act(q.onComplete);
    }
  }
}
for (let i = 0, prev = -1; size() !== prev && i < 60; i++) { prev = size(); round(); }

test("graf: każde zlecenie da się wziąć i wykonać (optymistycznie, z dokładnymi flagami, przedmiotami i odkryciami)", () => {
  const notStarted = data.quests.filter((q) => !S.started.has(q.id)).map((q) => q.id);
  assert.deepEqual(notStarted, [], "zlecenia, których nic nie zaczyna");
  const notDone = data.quests.filter((q) => q.kind === "errand" && !S.done.has(q.id)).map((q) => q.id);
  assert.deepEqual(notDone, [], "zlecenia, których cele są nieosiągalne");
});

test("graf: wszystkie lokacje i miejsca da się odkryć", () => {
  const lost = [];
  for (const l of data.travel.locations) {
    if (!known(l.id)) lost.push(l.id);
    for (const sp of l.spots ?? []) if (!known(`${l.id}.${sp.id}`)) lost.push(`${l.id}.${sp.id}`);
  }
  assert.deepEqual(lost, []);
});

test("graf: każda scena fabuły z warunkiem jest osiągalna, a koniec Aktu III prowadzi do tymczasowego zakończenia", () => {
  const byEngine = (s) => /combat_|klasa_/.test(JSON.stringify(s.if)); // set by fights and the class choice, not by content
  const dead = data.story.scenes.filter((s) => s.if && !byEngine(s) && !ok(s.if)).map((s) => s.id);
  assert.deepEqual(dead, []);
  const ids = data.story.scenes.map((s) => s.id);
  for (const id of ["akt3b_final", "akt3b_kuznia", "akt3b_przejscie"]) assert.ok(ids.includes(id), id);
  assert.ok(ids.indexOf("akt3b_final") < ids.indexOf("akt3b_kuznia") && ids.indexOf("akt3b_kuznia") < ids.indexOf("akt3b_przejscie"));
});

test("graf: każda flaga i każdy przedmiot, których ktoś wymaga, są osiągalne", () => {
  const needFlags = new Set(); const needItems = new Set();
  const scan = (c) => {
    if (Array.isArray(c)) return c.forEach(scan);
    if (c && typeof c === "object") for (const [k, v] of Object.entries(c)) {
      if (k === "flag" && typeof v === "string") needFlags.add(v);
      else if (k === "item") needItems.add(typeof v === "string" ? v : v.id);
      else scan(v);
    }
  };
  for (const d of data.dialogues) for (const n of Object.values(d.nodes)) for (const o of n.options ?? []) scan(o.requires);
  for (const q of data.quests) { scan(q.requires); for (const o of q.objectives ?? []) scan(o.done); }
  for (const s of data.story.scenes) scan(s.if);
  const engine = new Set(["klasa_miecz", "klasa_wlocznia"]);
  const lostFlags = [...needFlags].filter((f) => !S.flags.has(f) && !engine.has(f) && !/^combat_/.test(f));
  assert.deepEqual(lostFlags, [], "flagi wymagane, ale nieosiągalne");
  const lostItems = [...needItems].filter((i) => !S.items.has(i));
  assert.deepEqual(lostItems, [], "przedmioty wymagane, ale nieosiągalne");
});

test("graf: węzły dialogów, do których nie da się dojść (martwe fragmenty)", () => {
  const dead = [];
  for (const d of data.dialogues) {
    if (!S.dialogues.has(d.id)) { dead.push(`${d.id} (cała rozmowa)`); continue; }
    for (const nid of Object.keys(d.nodes)) if (!S.nodes.has(`${d.id}:${nid}`)) dead.push(`${d.id}:${nid}`);
  }
  assert.deepEqual(dead, [], "węzły niedostępne nawet optymistycznie");
});
