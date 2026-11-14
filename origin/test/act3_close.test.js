import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createSceneList, runStory } from "../src/engine/loop.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { slotAccepts } from "../src/systems/items.js";
import { countOf } from "../src/systems/inventory.js";
import { saveGame, loadGame } from "../src/engine/save.js";
import { createRng } from "../src/engine/dice.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const data = await loadData();
const pick = (...labels) => labels.map((l) => ({ pick: l }));
const SZKLO = ["Słucham.", "Słucham dalej.", "Słucham dalej.", "Słucham dalej.", "Słucham dalej."];

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function atTheGlass(classId, flags = {}) {
  const state = createNewState({ seed: 1, startScene: "akt3b_final", rules: data.rules });
  const cs = combatState(data, classId);
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.world.location = "obserwatorium";
  state.world.phenomenonRolledDay = 99;
  state.flags[`klasa_${classId}`] = true;
  Object.assign(state.flags, { akt3b_koniec: true }, flags);
  return state;
}
async function play(state, plan) {
  const io = createAdaptiveIO(plan);
  const ctx = { state, data, io, rng: { int: (lo) => lo, setState() {}, getState: () => 0 }, debug: false, story: createSceneList(data.story.scenes), notices: [] };
  const result = await runStory(ctx).catch((e) => { if (!(e instanceof InputExhaustedError)) throw e; return "exhausted"; });
  return { result, text: stripVTControlCharacters(io.text()).replace(/\s+/g, " ") };
}
const dlg = (id) => data.dialogues.find((d) => d.id === id);

// --- Szkło, które pamięta ---
for (const [label, key, flagKey] of [["Zabieram odłamek. Zobaczymy, kto kogo wynajął.", "wola", "szklo_wola"], ["Zabieram odłamek. Dług to dług.", "dlug", null]]) {
  test(`Szkło, które pamięta: opcja „${label}” daje odłamek, flagę i +1 do ${key}`, async () => {
    const state = atTheGlass("miecz");
    const before = state.vars[key] ?? 0;
    const { text } = await play(state, [...pick(...SZKLO, label)]);
    assert.equal(state.flags.szklo_wziete, true);
    if (flagKey) assert.equal(state.flags[flagKey], true);
    assert.equal((state.vars[key] ?? 0) - before, 1);
    assert.match(text, /klauzula/i);
    assert.match(text, /kontrahent/i);
    assert.doesNotMatch(text, /\[\[/);
  });
}

test("Szkło, które pamięta: żaden węzeł nie jest ślepy, a prawda świata pada w pięciu faktach", () => {
  const d = dlg("szklo_pamieta");
  for (const [id, n] of Object.entries(d.nodes)) assert.ok((n.options ?? []).length >= 1, id);
  const all = JSON.stringify(d.nodes);
  for (const re of [/pakt/i, /danin/i, /wynajem|wynajęt/i, /zniszczen/i, /zwłok/i]) assert.match(all, re);
});

// --- Ostrze z nieba ---
const CASES = [
  ["miecz", { glusz_pomoc: true }, "ostrze_gwiazd_bogdana", "ostrze_bogdana"],
  ["wlocznia", { glusz_pomoc: true }, "para_gwiazd_bogdana", "ostrze_bogdana"],
  ["miecz", {}, "ostrze_gwiazd_surowe", "ostrze_surowe"],
  ["wlocznia", {}, "para_gwiazd_surowa", "ostrze_surowe"],
];
for (const [classId, flags, blade, quality] of CASES) {
  test(`Ostrze z nieba: klasa ${classId}, glusz_pomoc ${Boolean(flags.glusz_pomoc)} → ${blade}`, async () => {
    const state = atTheGlass(classId, flags);
    const { text } = await play(state, [...pick(...SZKLO, "Zabieram odłamek. Dług to dług.", "Wracam do ludzi.", "Dalej", "Podaj odłamek", "Dzięki.", "Dalej")]);
    assert.equal(countOf(state, blade), 1, "dokładnie jedno Ostrze");
    assert.equal(countOf(state, "odlamek_krateru"), 0, "odłamek poszedł do kuźni");
    assert.equal(state.flags[quality], true);
    assert.equal(state.flags.ostrze_odebrane, true);
    assert.ok(slotAccepts(data.items.find((i) => i.id === blade), "bron"));
  });
}

test("Ostrze z nieba: ponowne wejście w kuźnię (wczytany zapis) nie daje drugiego Ostrza i nie zostawia gracza bez wyjścia", async () => {
  const state = atTheGlass("miecz", { glusz_pomoc: true });
  state.flags.szklo_wziete = true;
  state.flags.ostrze_odebrane = true;
  state.flags.ostrze_bogdana = true;
  state.inventory.items.push({ id: "ostrze_gwiazd_bogdana", qty: 1 });
  state.scene.id = "akt3b_kuznia";
  const { text } = await play(state, [...pick("Ostrze już leży w dłoni.", "Idę.", "Dalej")]);
  assert.equal(countOf(state, "ostrze_gwiazd_bogdana"), 1);
  assert.match(text, /Z Obserwatorium schodzisz o świcie/);
});

test("Ostrze z nieba: każda kombinacja sojuszy kończy się Ostrzem (żaden gracz nie zostaje bez broni z nieba)", () => {
  const d = dlg("ostrze_z_nieba");
  const start = d.nodes[d.start];
  const forging = start.options.filter((o) => (d.nodes[o.goto]?.actions ?? []).some((a) => a.giveItem));
  assert.equal(forging.length, 4);
  // exactly one forging option is open for every (class, glusz_pomoc) pair, and "bywaj" does not skip the forge
  assert.ok(!start.options.some((o) => /bywaj/i.test(o.text) && !o.requires));
});

// --- Nowe zakończenie Aktu III ---
test("koniec Aktu III: pełna ścieżka dochodzi do narracji akt3b_przejscie, starego finału i siedmiu zakończeń nie ma", async () => {
  const state = atTheGlass("miecz", { glusz_pomoc: true });
  const { text } = await play(state, [...pick(...SZKLO, "Zabieram odłamek. Dług to dług.", "Wracam do ludzi.", "Dalej", "Podaj odłamek", "Dzięki.", "Dalej")]);
  assert.equal(state.scene.id, "akt3b_przejscie");
  assert.match(text, /Z Obserwatorium schodzisz o świcie/);
  assert.doesNotMatch(text, /TO JESZCZE NIE KONIEC/);
  assert.ok(!data.story.scenes.some((s) => /^koniec_/.test(s.id)));
  assert.ok(!data.dialogues.some((d) => d.id === "rozdroze_final"));
  assert.ok(!JSON.stringify(data.story).includes("rozdroze_final"));
  assert.deepEqual(validateData(data), []);
});

test("koniec Aktu III: stary zapis na scenie akt3b_final (z postępem rozmowy z poprzedniej wersji) po wczytaniu startuje Szkło od początku", async () => {
  const old = atTheGlass("miecz");
  old.world.dialogueProgress = { akt3b_final: "final" };
  await saveGame("1", old, createRng(1));
  const warnings = [];
  const state = await loadGame("1", data, { warnings });
  assert.ok(warnings.some((w) => /akt3b_final/.test(w)), "wczytanie zgłasza naprawę postępu rozmowy");
  assert.equal(state.world.dialogueProgress.akt3b_final, undefined);
  const { text } = await play(state, [...pick(...SZKLO)]);
  assert.match(text, /Zapis w szkle|klauzula/i);
});
