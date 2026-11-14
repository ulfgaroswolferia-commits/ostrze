import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { evaluate } from "../src/engine/conditions.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { combatState } from "./helpers.js";
import { startQuest, advanceErrands } from "../src/systems/quests.js";

const data = await loadData();
const scenes = data.story.scenes;
const byId = (id) => scenes.find((s) => s.id === id);
const dlg = (id) => data.dialogues.find((d) => d.id === id);

/** Walks the story from `startId` like the engine does (sequence, `if` skips, `goto`, flag scenes) and returns the ids played. */
function walk(startId, state, stopAt) {
  const played = [];
  let i = scenes.findIndex((s) => s.id === startId);
  for (let guard = 0; guard < 80 && i >= 0 && i < scenes.length; guard++) {
    const s = scenes[i];
    if (s.id === stopAt) break;
    if (s.if && !evaluate(s.if, state, data)) { i++; continue; }
    played.push(s.id);
    if (s.type === "flag") Object.assign(state.flags, s.set);
    if (s.type === "ending") break;
    i = s.goto ? scenes.findIndex((x) => x.id === s.goto) : i + 1;
  }
  return played;
}
const hero = (flags = {}, vars = {}) => {
  const st = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  Object.assign(st.flags, flags);
  Object.assign(st.vars, vars);
  return st;
};

test("fabuła lochu: Noc długich noży → schody w dół → mapa lochu → Cisza → Dług spłacony → zakończenie tymczasowe", () => {
  assert.deepEqual(validateData(data), []);
  const ids = scenes.map((s) => s.id);
  const order = ["akt4_stolica_mapa", "akt4_stolica_dalej", "akt4b_przejscie", "akt4c_loch_mapa", "akt4c_loch_odpoczynek", "akt4c_loch_zapis", "akt4c_loch_dalej", "akt4c_cisza_wstep", "akt4c_dlug_wstep", "akt4c_dlug_flaga", "akt4c_przejscie"];
  assert.ok(order.map((id) => ids.indexOf(id)).every((i, k, a) => i >= 0 && (k === 0 || i > a[k - 1])), "porządek scen");
  assert.equal(byId("akt4b_przejscie").type, "narration");
  assert.equal(byId("akt4c_przejscie").type, "narration");
  const map = byId("akt4c_loch_mapa");
  assert.deepEqual([map.hub, map.arriveAt, map.leaves, map.starts], ["loch_pod_palacem", "loch_pod_palacem", "ulfgrod", ["watek_loch"]]);
  assert.deepEqual(map.exitWhen.if, { flag: "pelnomocnik_pokonany" });
  assert.equal(byId(map.exitWhen.goto).type, "narration");
  assert.equal(byId("akt4_stolica_mapa").exitWhen.goto, "akt4b_przejscie");
});

test("Cisza po cesarzu: wariant śmierci cesarza pasuje do tego, co się stało, a wzmianki o frontach tylko pod własną flagą", () => {
  const text = (st) => walk("akt4c_cisza_wstep", st, "akt4c_dlug_wstep").map((id) => byId(id).text).join(" ");
  const bare = text(hero({ noc_pekniecie: true }));
  assert.match(bare, /Wsiewłod/);
  assert.doesNotMatch(bare, /Tomasz|stary żołnierz|Stary żołnierz|most|studni|Dobromił/i);
  assert.match(text(hero({ noc_bunt: true })), /Tomasz/);
  assert.match(text(hero({ noc_zamach: true })), /Stary żołnierz/);
  assert.match(text(hero({ noc_pekniecie: true })), /naturalnej śmierci/);
  const rich = text(hero({ noc_bunt: true, wojna_most_zerwany: true, wojna_studnia_zatruta: true, wojna_ranni_wszyscy: true }));
  assert.match(rich, /most na Szarej/i);
  assert.match(rich, /Skjeldowem/);
  assert.match(rich, /Dobromiła/);
  for (const [flag, re] of [["wojna_most_zerwany", /most na Szarej/i], ["wojna_studnia_zatruta", /Skjeldowem/], ["wojna_ranni_wszyscy", /Dobromiła/]]) assert.doesNotMatch(text(hero({ noc_bunt: true })), re, flag);
});

for (const [label, flags, vars, dialogue, flag] of [
  ["wola wysoka", {}, { wola: 4, dlug: 4 }, "istota_dlug_wola", "istota_wyrok"],
  ["wola niska, dług wysoki", {}, { wola: 1, dlug: 3 }, "istota_dlug_dlug", "istota_przetarg"],
  ["wola 0, dług 0", {}, {}, "istota_dlug_krotko", "istota_zwloka"],
  ["wola 2, dług 2", {}, { wola: 2, dlug: 2 }, "istota_dlug_krotko", "istota_zwloka"],
]) {
  test(`Dług spłacony (${label}): gra dokładnie jedną rozmowę, ustawia dlug_splacony i kończy przejściem na wyspę`, () => {
    const st = hero(flags, vars);
    const played = walk("akt4c_dlug_wstep", st, "akt4c_przejscie");
    const dialogues = played.map(byId).filter((s) => s.type === "dialogue");
    assert.deepEqual(dialogues.map((s) => s.dialogue), [dialogue]);
    assert.equal(st.flags.dlug_splacony, true);
    assert.equal(played.at(-1), "akt4c_dlug_flaga");
    const d = dlg(dialogue);
    const sets = Object.values(d.nodes).flatMap((n) => (n.actions ?? []).map((a) => a.setFlag));
    assert.ok(sets.includes(flag), `${dialogue}: ${flag}`);
    for (const [nid, n] of Object.entries(d.nodes)) assert.ok((n.options ?? []).length >= 1, nid);
  });
}

test("Dług spłacony: wola wysoka daje jawną deklarację zagłady, wola niska – ostrożne „raty po racie”", () => {
  const all = (id) => JSON.stringify(dlg(id));
  assert.match(all("istota_dlug_wola"), /nie wrócicie tam, skąd przylecieliście/);
  assert.match(all("istota_dlug_dlug"), /ratami/);
  assert.doesNotMatch(all("istota_dlug_krotko"), /nie wrócicie/);
});

test("wejście do lochu nie oblewa wątku miasta, nawet gdy gracz nie rozmawiał z Hjalmarem i Smykiem", () => {
  const st = hero({ akt4b_koniec: true, palac_otwarty: true, dowod_zywego: true }, { zlecenia_stolicy: 3 });
  const cs = combatState(data, "miecz");
  st.character = cs.character;
  st.inventory = cs.inventory;
  startQuest(st, data, "watek_ulfgrod");
  advanceErrands(st, data, createRng(1));
  assert.equal(st.quests.watek_ulfgrod.status, "done");
});

test("akt4b_przejscie nie zakłada spotkania z lokajem (opcjonalnego), tylko z kucharzem z obowiązkowej sceny", () => {
  const text = byId("akt4b_przejscie").text;
  assert.doesNotMatch(text, /lokaj/i);
  assert.match(text, /kucharz/i);
});

test("zejście do lochu: trzy poziomy schodów z upiorami przed mapą, przegrana nie kończy gry i prowadzi dalej w dół", () => {
  const ids = scenes.map((s) => s.id);
  const order = ["akt4b_przejscie", "schody_1_wstep", "schody_1_walka", "schody_2_wstep", "schody_2_walka", "schody_3_wstep", "schody_3_walka", "akt4c_loch_mapa"];
  assert.ok(order.map((id) => ids.indexOf(id)).every((i, k, a) => i >= 0 && (k === 0 || i > a[k - 1])), "porządek");
  assert.deepEqual(["schody_1_walka", "schody_2_walka", "schody_3_walka"].map((id) => byId(id).enemies[0].count), [2, 3, 2]);
  for (const n of [1, 2, 3]) {
    const fight = byId(`schody_${n}_walka`);
    assert.equal(fight.enemies[0].id, "upior_schodow");
    assert.equal(fight.canFlee, false);
    const next = n === 3 ? "akt4c_loch_mapa" : `schody_${n + 1}_wstep`;
    assert.equal(byId(`schody_${n}_po`).goto, next);
    assert.equal(byId(fight.onDefeat).goto, next, "przegrana prowadzi dalej w dół");
  }
  assert.equal(data.enemies.find((e) => e.id === "upior_schodow").tags.includes("upior"), true);
  assert.equal(data.enemies.find((e) => e.id === "upior_schodow").veteranFrom, 10);
});
