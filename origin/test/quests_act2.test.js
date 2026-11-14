import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { loadData, validateData } from "../src/engine/data.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { InputExhaustedError } from "../src/ui/io.js";
import { defaultHandlers } from "../src/scenes/index.js";
import { revealPlace } from "../src/systems/places.js";
import { startQuest } from "../src/systems/quests.js";
import { addItem } from "../src/systems/inventory.js";
import { combatState, createAdaptiveIO, tmpDir } from "./helpers.js";

const data = await loadData();
const strip = (s) => stripVTControlCharacters(s).replace(/\s+/g, " ");
const MAP = { id: "demo_mapa", type: "map", hub: "wilczy_brod", title: "x", main: { label: "Zamknij dzień", goto: "x" } };
const pick = (...labels) => labels.map((l) => ({ pick: l }));

let prevHome;
beforeEach(async () => { prevHome = process.env.OSTRZE_HOME; process.env.OSTRZE_HOME = await tmpDir(); });
afterEach(() => { if (prevHome === undefined) delete process.env.OSTRZE_HOME; else process.env.OSTRZE_HOME = prevHome; });

function start(flags = {}) {
  const state = createNewState({ seed: 1, startScene: "demo_mapa", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  state.time.minutes = 10 * 60;
  state.world.phenomenonRolledDay = 99;
  state.world.location = "wilczy_brod";
  Object.assign(state.flags, flags);
  return state;
}
/** Plays the map scene standing at `location` on `tokens` until they run out; returns the screen text. */
async function at(state, location, tokens, rng = createRng(5)) {
  state.world.location = location;
  state.world.map = null;
  const io = createAdaptiveIO(tokens);
  await assert.rejects(defaultHandlers.map({ state, data, io, rng, debug: false, notices: [] }, MAP), InputExhaustedError);
  return strip(io.text());
}
const status = (state, id) => state.quests[id]?.status;
const quietRng = { int: () => 1 }; // every roll succeeds

test("dane aktu II przechodzą walidację; nowe lokacje są ukryte, mają wskazówkę i token na mapie", () => {
  assert.deepEqual(validateData(data), []);
  const state = start();
  for (const id of ["stary_mlyn", "trakt_kupiecki", "lesniczowka", "ruiny_straznicy"]) {
    const l = data.travel.locations.find((x) => x.id === id);
    assert.ok(l.secret && l.hint && (l.near || l.far) && l.spots.length >= 2, id);
    assert.ok(data.maps.pogorze.includes(`{${id}}`), id);
    assert.equal(state.world.discovered.includes(id), false);
  }
});

test("Zboże dla młyna → Dług kupca: przedmioty i wiadomości tam i z powrotem", async () => {
  const state = start({ ziola_zebrane: true });
  revealPlace(state, data, "stary_mlyn");
  await at(state, "wilczy_brod", pick("Tablica ogłoszeń", "Zboże dla młyna", "Odejdź od tablicy"));
  assert.equal(status(state, "zboze_dla_mlyna"), "active");
  await at(state, "stary_mlyn", pick("! Młynarz Ostap", "Przyniosłem worek zboża", "Przekażę."));
  assert.equal(state.flags.ostap_zboze, true);
  await at(state, "wilczy_brod", pick("! Karczma", "Ostap kazał", "Dobra.", "Bywaj."));
  assert.equal(status(state, "zboze_dla_mlyna"), "done");
  await at(state, "wilczy_brod", pick("Karczma", "Masz dla mnie", "Zrobię to.", "Bywaj."));
  assert.equal(status(state, "dlug_kupca"), "active");
  await at(state, "trakt_kupiecki", pick("! Kupiec Ostromir", "Mam weksel", "Przekażę."));
  await at(state, "wilczy_brod", pick("! Karczma", "Mam pokwitowanie", "Bywaj."));
  assert.equal(status(state, "dlug_kupca"), "done");
  assert.equal(state.flags.dlug_oddany, true);
});

test("List do leśniczego: komendant → leśniczówka → odpowiedź u komendanta", async () => {
  const state = start({ komendant_byl: true, nora_zgoda: true, nora_wykonana: true, nora_rozliczona: true });
  await at(state, "wilczy_brod", pick("Komendant Wszebor", "Masz dla mnie robotę?", "Zaniosę."));
  assert.equal(status(state, "list_do_lesniczego"), "active");
  await at(state, "lesniczowka", pick("! Leśniczy", "Mam list", "Trzymać się"));
  await at(state, "wilczy_brod", pick("! Komendant Wszebor", "Leśniczy kazał", "Postaram się."));
  assert.equal(status(state, "list_do_lesniczego"), "done");
});

test("Światło w młynie: tylko nocą daje odłamek, kowal go rozpoznaje", async () => {
  const state = start();
  revealPlace(state, data, "stary_mlyn");
  startQuest(state, data, "swiatlo_w_mlynie");
  await at(state, "stary_mlyn", pick("! Wnętrze młyna", "Dalej")); // daytime: nothing happens
  assert.equal(state.flags.odlamek_zebrany, undefined);
  state.time.minutes = 23 * 60;
  await at(state, "stary_mlyn", pick("! Wnętrze młyna", "Dalej", "Dalej"));
  assert.equal(state.flags.odlamek_zebrany, true);
  await at(state, "wilczy_brod", pick("! Kuźnia", "Odłamek szkła", "Nikomu."));
  assert.equal(status(state, "swiatlo_w_mlynie"), "done");
});

test("Kto pyta o ocalałych: porażka podsłuchu nie blokuje (rozmowa jawna), raport u komendanta", async () => {
  const state = start({ komendant_byl: true, nora_zgoda: true, nora_wykonana: true, nora_rozliczona: true });
  revealPlace(state, data, "trakt_kupiecki");
  startQuest(state, data, "kto_pyta_o_ocalalych");
  state.time.minutes = 19 * 60;
  const fail = { int: () => 100 }; // everything fails
  const text = await at(state, "trakt_kupiecki", pick("! Ognisko zwiadowców", "[Skradanie", "Odejdź."), fail);
  assert.match(text, /Wyłaź, nim/);
  assert.equal(state.flags.zwiadowcy_slysza, undefined);
  await at(state, "trakt_kupiecki", pick("! Ognisko zwiadowców", "[Wymowa", "Dziękuję"), quietRng);
  assert.equal(state.flags.zwiadowcy_slysza, true);
  await at(state, "wilczy_brod", pick("! Komendant Wszebor", "Podsłuchałem", "Nie mam pojęcia"));
  assert.equal(status(state, "kto_pyta_o_ocalalych"), "done");
  assert.equal(state.flags.akt3_zapowiedz, true);
});

test("Zaginiony pasterz Borek i Amulet z ruin: ślady, ruiny, żona, córka", async () => {
  const state = start({ zona_wskazana: true, pobojowisko_ragnoslawa: false });
  revealPlace(state, data, "wilczy_brod.zona_borka");
  revealPlace(state, data, "wilczy_las");
  revealPlace(state, data, "ruiny_straznicy");
  await at(state, "wilczy_brod", pick("Żona Borka", "Co się stało?", "Poszukam.", "Bywaj."));
  assert.equal(status(state, "zaginiony_pasterz_borek"), "active");
  await at(state, "wilczy_las", pick("! Ślady za polaną", "Dalej"));
  assert.equal(state.flags.borek_slady, true);
  await at(state, "ruiny_straznicy", pick("! Rumowisko", "Dalej", "[Medycyna", "Idź za mną.", "Dalej", "Dalej"), quietRng);
  assert.equal(state.flags.borek_znaleziony, true);
  assert.equal(state.flags.borek_zdrowy, true);
  await at(state, "wilczy_brod", pick("! Żona Borka", "Znalazłem go. Żyje i jest zdrów.", "Dzięki."));
  assert.equal(status(state, "zaginiony_pasterz_borek"), "done");
  // the amulet from the ruins starts the last errand
  await at(state, "wilczy_brod", pick("Córka strażnika", "To amulet", "Sprawdzę.", "Bywaj."));
  assert.equal(status(state, "amulet_z_ruin"), "active");
  await at(state, "ruiny_straznicy", pick("! Rumowisko", "Dalej", "Dalej"));
  assert.equal(state.flags.amulet_pasuje, true);
  await at(state, "wilczy_brod", pick("! Córka strażnika", "Znak pasuje. Zatrzymam", "Bywaj."));
  assert.equal(status(state, "amulet_z_ruin"), "done");
  assert.equal(state.flags.technologia_wiedza, true);
});

test("koniec aktu: eskorta ustawia akt2_koniec przed zamknięciem zlecenia, scena końcowa czeka na flagę", () => {
  const esk = data.quests.find((q) => q.id === "eskorta_ostromira");
  const ids = esk.scenes.map((s) => s.id);
  assert.ok(ids.indexOf("przelecz_akt") < ids.indexOf("przelecz_wykonane"));
  const ending = data.story.scenes.find((s) => s.id === "akt2_koniec_scena");
  assert.deepEqual(ending.if, { flag: "akt2_koniec" });
  const next = data.story.scenes.find((s) => s.id === "demo_dalej");
  assert.deepEqual(next.if, { notFlag: "akt2_koniec" });
  assert.equal(next.goto, "demo_mapa", "zamknięcie dnia przed końcem aktu II wraca na mapę, nie kończy gry");
  assert.equal(data.story.scenes.some((s) => s.id === "demo_koniec"), false);
  void addItem;
});

test("ludzie do pogadania: każdy z siedmiu gadających miejsc przechodzi trzy stany reakcji przy kolejnych wizytach", async () => {
  const spots = [["wilczy_brod", "Wartownik przy palisadzie", "straznik"], ["wilczy_brod", "Gospodyni z kurami", "gospodyni"], ["stary_mlyn", "Żona młynarza", "zonamlyn"],
    ["trakt_kupiecki", "Pielgrzym na kamieniu", "pielgrzym"], ["lesniczowka", "Pies przy chacie", "pies"], ["wilczy_las", "Drwal", "drwal"], ["ruiny_straznicy", "Kruk między kamieniami", "kamienie"]];
  for (const [loc, name, prefix] of spots) {
    const state = start();
    for (const id of ["stary_mlyn", "trakt_kupiecki", "lesniczowka", "ruiny_straznicy", "wilczy_las"]) revealPlace(state, data, id);
    const seen = [];
    for (let i = 0; i < 4; i++) {
      await at(state, loc, pick(name, "Dalej"));
      seen.push([state.flags[`${prefix}_0`] === true, state.flags[`${prefix}_1`] === true]);
    }
    assert.deepEqual(seen, [[true, false], [true, true], [true, true], [true, true]], name);
  }
});
