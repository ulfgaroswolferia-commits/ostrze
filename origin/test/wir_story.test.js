import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { evaluate } from "../src/engine/conditions.js";
import { createNewState } from "../src/engine/state.js";

const data = await loadData();
const scenes = data.story.scenes;
const byId = (id) => scenes.find((s) => s.id === id);

function walk(startId, state, stopAt) {
  const played = [];
  let i = scenes.findIndex((s) => s.id === startId);
  for (let guard = 0; guard < 120 && i >= 0 && i < scenes.length; guard++) {
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
const text = (st, from = "akt6_wojna_wstep") => walk(from, st).map((id) => byId(id)).filter((s) => s.text).map((s) => s.text).join(" ");

test("fabuła Wiru: akt5a_przejscie przestaje być zakończeniem; mapa Wiru z leaves i exitWhen; dwa zakończenia", () => {
  assert.deepEqual(validateData(data), []);
  assert.equal(byId("akt5a_przejscie").type, "narration");
  const map = byId("akt6_wir_mapa");
  assert.deepEqual([map.hub, map.arriveAt, map.leaves, map.starts], ["wir_lysa_skala", "wir_lysa_skala", "przystan_jarnowo", ["watek_wir"]]);
  assert.deepEqual(map.exitWhen.if, { any: [{ flag: "istota_zginela" }, { flag: "istota_uciekla" }] });
  assert.equal(byId("akt6_koniec_swiety_spokoj").type, "ending");
  assert.equal(byId("akt6_koniec_cisza_po_wirze").type, "ending");
  assert.match(byId("akt6_koniec_swiety_spokoj").text, /ŚWIĘTY SPOKÓJ/);
  assert.match(byId("akt6_koniec_cisza_po_wirze").text, /CISZA PO WIRZE/);
  assert.ok(!scenes.some((s) => s.type === "ending" && /TO JESZCZE NIE KONIEC/.test(s.text ?? "")), "gra ma prawdziwe zakończenia");
});

const ALL = [
  {},
  { sojusz_dezerter: true, sojusz_wedrowcy: true, sojusz_straznicy: true, sojusz_astrolog: true },
  { hetman_przekonany: true, jarnowo_dowod: true, ostrze_bogdana: true, istota_wyrok: true, istota_prawda: true },
  { ostrze_surowe: true, istota_przetarg: true, noc_zamach: true, wojna_ranni_wszyscy: true, wojna_studnia_zatruta: true, wojna_most_zerwany: true },
  { jarnowo_proch_zatopiony: true, jarnowo_kuznia_sabotaz: true, noc_bunt: true, istota_zwloka: true },
];
for (const [i, base] of ALL.entries()) {
  for (const [name, flag, ending] of [["Święty spokój", "istota_zginela", "akt6_koniec_swiety_spokoj"], ["Cisza po wirze", "istota_uciekla", "akt6_koniec_cisza_po_wirze"]]) {
    test(`zakończenie „${name}” (zestaw flag ${i}): dokładnie jedno zakończenie, zdanie podsumowujące, bez wzmianek o niezrobionych wyborach`, () => {
      const portal = flag === "istota_zginela" ? { portal_rozbrojony: true } : { portal_sprawny: true };
      const flags = { cesarz_nie_zyje: true, dlug_splacony: true, hetman_rozmowa: true, ...portal, ...base, [flag]: true };
      const played = walk("akt6_wojna_wstep", hero(flags));
      assert.equal(played.at(-1), ending);
      assert.equal(played.filter((id) => byId(id).type === "ending").length, 1);
      assert.ok(played.includes("akt6_podsumowanie"), "zdanie podsumowujące");
      const t = text(hero(flags));
      if (!base.sojusz_dezerter) assert.doesNotMatch(t, /Tomasz/);
      if (!base.sojusz_astrolog) assert.doesNotMatch(t, /Hieronim/);
      if (!base.wojna_ranni_wszyscy) assert.doesNotMatch(t, /Dobromił/);
      if (!base.hetman_przekonany) assert.doesNotMatch(t, /zapisie ze szkła/i);
      if (!base.ostrze_bogdana) assert.doesNotMatch(t, /Bogdan/);
    });
  }
}

test("Ostrze w epilogu: kominek / pniak / kowal zależnie od tonu rozmowy z Istotą; bez flagi tonu jest wariant bazowy", () => {
  const t = (flags) => text(hero({ cesarz_nie_zyje: true, hetman_rozmowa: true, portal_rozbrojony: true, istota_zginela: true, ...flags }));
  assert.match(t({ istota_wyrok: true }), /kominkiem/i);
  assert.match(t({ istota_przetarg: true }), /pniak/i);
  assert.match(t({ istota_zwloka: true }), /kowal/i);
  assert.match(t({}), /gwiezdnego metalu/);
  assert.match(t({ ostrze_bogdana: true }), /Bogdan/);
});

test("mapa Wiru porzuca otwarte zlecenia Jarnowa (leaves)", () => {
  assert.equal(byId("akt6_wir_mapa").leaves, "przystan_jarnowo");
});

test("epilog: Ostrze nie przeczy samo sobie – po oddaniu kowalowi nie ma „kładziesz na nim rękę” ani „Jest.”, a tekst nie zakłada klingi (włócznik nosi Parę Gwiazd)", () => {
  const t = (flags) => text(hero({ cesarz_nie_zyje: true, hetman_rozmowa: true, portal_rozbrojony: true, istota_zginela: true, ...flags }));
  for (const flags of [{ istota_zwloka: true }, { istota_zwloka: true, ostrze_bogdana: true }]) {
    assert.doesNotMatch(t(flags), /kładziesz|Jest\.|klinga|klingę/i, JSON.stringify(flags));
    assert.match(t(flags), /kowal|Bogdanowi/i);
  }
  assert.match(t({ istota_zwloka: true, ostrze_bogdana: true }), /Bogdanowi/);
  for (const flags of [{ istota_wyrok: true }, { istota_przetarg: true }, { istota_wyrok: true, ostrze_bogdana: true }]) assert.doesNotMatch(t(flags), /klinga|klingę|Jest\./i, JSON.stringify(flags));
  assert.doesNotMatch(t({ istota_wyrok: true }), /obiecałeś/, "obietnica nie wisi nad portalem sprawnym");
});

test("zdanie podsumowujące zależy od wyniku: inne dla śmierci Istoty, inne dla ucieczki", () => {
  const base = { cesarz_nie_zyje: true, hetman_rozmowa: true };
  const z = text(hero({ ...base, portal_rozbrojony: true, istota_zginela: true }));
  const u = text(hero({ ...base, portal_sprawny: true, istota_uciekla: true }));
  assert.match(z, /zamknął|zamknąłeś/i);
  assert.match(u, /otwart|drzwi/i);
  const sum = (st) => walk("akt6_wojna_wstep", st).filter((id) => id.startsWith("akt6_pods")).join();
  assert.notEqual(sum(hero({ ...base, portal_rozbrojony: true, istota_zginela: true })), sum(hero({ ...base, portal_sprawny: true, istota_uciekla: true })));
});

test("poprawna polszczyzna: „szklany”, nie „szklanny”; hetman „składa broń”", () => {
  const all = JSON.stringify([data.story, data.travel.locations.find((l) => l.id === "wir_lysa_skala"), data.enemies.filter((e) => ["sluga_wiru", "straz_szklanna", "istota_szklanna"].includes(e.id))]);
  assert.doesNotMatch(all, /szklann(y|e|ego|ych)/);
  assert.doesNotMatch(JSON.stringify(data.story), /składa bunt/);
});

// --- przebieg przez silnik: od końca wojny do zakończenia, stary zapis ---
import { stripVTControlCharacters } from "node:util";
import { beforeEach, afterEach } from "node:test";
import { createSceneList, runStory } from "../src/engine/loop.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { createRng } from "../src/engine/dice.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });
const lowRng = { int: (lo) => lo, setState() {}, getState: () => 0 };
function atEnd(sceneId, flags) {
  const state = createNewState({ seed: 1, startScene: sceneId, rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.world.location = "wir_lysa_skala";
  Object.assign(state.flags, { cesarz_nie_zyje: true, dlug_splacony: true, hetman_rozmowa: true, ...flags });
  return state;
}
async function playOut(state) {
  const io = createAdaptiveIO(new Array(60).fill(""));
  await runStory({ state, data, io, rng: lowRng, debug: false, story: createSceneList(data.story.scenes), notices: [] });
  return stripVTControlCharacters(io.text()).replace(/\s+/g, " ");
}
for (const [label, flags, ending, marker] of [
  ["Święty spokój", { portal_rozbrojony: true, istota_zginela: true }, "akt6_koniec_swiety_spokoj", /ŚWIĘTY SPOKÓJ/],
  ["Cisza po wirze", { portal_sprawny: true, istota_uciekla: true }, "akt6_koniec_cisza_po_wirze", /CISZA PO WIRZE/],
]) {
  test(`silnik: od końca wojny do zakończenia „${label}” – dokładnie jedno ending, scena kończy się na nim`, async () => {
    const state = atEnd("akt6_wojna_wstep", flags);
    const out = await playOut(state);
    assert.match(out, marker);
    assert.equal(state.scene.id, ending);
    assert.doesNotMatch(out, label === "Święty spokój" ? /CISZA PO WIRZE/ : /ŚWIĘTY SPOKÓJ/);
  });
}

test("stary zapis na akt5a_przejscie (dawniej zakończenie) wczytuje się i prowadzi do mapy Wiru", async () => {
  const state = atEnd("akt5a_przejscie", { portal_sprawny: true });
  await saveGame("1", state, createRng(1));
  const loaded = await loadGame("1", data, { warnings: [] });
  assert.equal(loaded.scene.id, "akt5a_przejscie");
  const io = createAdaptiveIO(["", "^C"]);
  await assert.rejects(runStory({ state: loaded, data, io, rng: lowRng, debug: false, story: createSceneList(data.story.scenes), notices: [] }));
  assert.equal(loaded.world.location, "wir_lysa_skala");
});
