import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, equip } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { advanceTime } from "../src/engine/time.js";
import { artifactState, setExposed } from "../src/systems/artifacts.js";
import {
  rollDaily, update, forcePhenomenon, activePhenomenon, phenomenonModifiers, phenomenonBystroscPenalty,
  phenomenonEnemyModifiers, blockedSkill,
} from "../src/systems/phenomena.js";

const data = minimalData();
const H = 60;
const DAY = 24 * H;

/** Scripted rng: answers `int` calls from `values` in order (throws when they run out); counts calls. */
function scripted(values) {
  const rng = { calls: [], int(min, max) {
    if (values.length === 0) throw new Error(`rng: brak wartości dla int(${min}, ${max})`);
    const v = values.shift();
    rng.calls.push([min, max, v]);
    return v;
  } };
  return rng;
}
/** Rng whose every roll misses (100 > any chancePerDay); counts calls. */
function missing() {
  const rng = { count: 0, int(min, max) { rng.count++; return max; } };
  return rng;
}
function worldState(minutes) {
  const s = combatState(data, "miecz");
  s.time.minutes = minutes;
  s.world = { phenomenon: null, phenomenonRolledDay: 0 };
  return s;
}

test("rollDaily: pierwsze trafione wg kolejności w pliku, najwyżej jedno", () => {
  const s = worldState(6 * H);
  // burza: 15 ≤ 15 trafia; godziny 6..23 (18), indeks 4 → 10:00; czas trwania 3 h
  const rng = scripted([15, 4, 3]);
  rollDaily(s, data, rng, 0);
  assert.deepEqual(s.world.phenomenon, { id: "burza_iskier", startsAt: 10 * H, endsAt: 13 * H, omenAt: 8 * H, omenShown: false, started: false });
  assert.equal(rng.calls.length, 3);
  rollDaily(s, data, scripted([]), 0); // już zaplanowane: brak rzutów
  const miss = worldState(6 * H);
  const r2 = scripted([16, 10, 1, 2, 4]);
  rollDaily(miss, data, r2, 0);
  // burza 16 > 15 pudło; noc 10 ≤ 10 trafia → tylko godziny nocy ≥ 6: 20,21,22,23 → indeks 1 → 21:00; 4 h
  assert.deepEqual(r2.calls.map((c) => c.slice(0, 2)), [[1, 100], [1, 100], [0, 3], [3, 6]]);
  assert.equal(miss.world.phenomenon.id, "noc_bez_gwiazd");
  assert.equal(miss.world.phenomenon.startsAt, 21 * H);
  assert.equal(miss.world.phenomenon.omenAt, 20 * H);
});
test("rollDaily: zapowiedź od razu, gdy start bliżej niż hoursBefore", () => {
  const s = worldState(9 * H);
  rollDaily(s, data, scripted([1, 0, 2]), 0); // burza o 9:00 (bieżąca godzina)
  assert.equal(s.world.phenomenon.startsAt, 9 * H);
  assert.equal(s.world.phenomenon.omenAt, 9 * H);
  assert.deepEqual(update(s, data, 9 * H).map((e) => e.type), ["zapowiedz_zjawiska", "start_zjawiska"]);
});
test("update: zapowiedź raz, potem start, potem koniec", () => {
  const s = worldState(6 * H);
  s.world.phenomenon = { id: "mgla_ciszy", startsAt: 10 * H, endsAt: 12 * H, omenAt: 9 * H, omenShown: false, started: false };
  assert.deepEqual(update(s, data, 8 * H), []);
  assert.deepEqual(update(s, data, 9 * H), [{ type: "zapowiedz_zjawiska", id: "mgla_ciszy" }]);
  assert.deepEqual(update(s, data, 9 * H + 30), []);
  assert.equal(activePhenomenon(s, data), null);
  assert.deepEqual(update(s, data, 10 * H), [{ type: "start_zjawiska", id: "mgla_ciszy" }]);
  assert.equal(activePhenomenon(s, data).id, "mgla_ciszy");
  assert.equal(blockedSkill(s, data, "proch"), true);
  assert.equal(blockedSkill(s, data, "sieczna"), false);
  assert.deepEqual(update(s, data, 12 * H), [{ type: "koniec_zjawiska", id: "mgla_ciszy" }]);
  assert.equal(s.world.phenomenon, null);
  assert.equal(blockedSkill(s, data, "proch"), false);
});
test("sen 8 h od 22:00 przez burzę o 2:00: zapowiedź → start → naładowanie → koniec; ładunek w 0…max", () => {
  const s = worldState(22 * H);
  s.world.phenomenonRolledDay = 1;
  s.world.phenomenon = { id: "burza_iskier", startsAt: DAY + 2 * H, endsAt: DAY + 4 * H, omenAt: DAY, omenShown: false, started: false };
  addItem(s, data, "kamien_zmierzchu", 1);
  equip(s, data, "kamien_zmierzchu", "talizman");
  setExposed(s, data, true);
  const seen = [];
  for (let h = 0; h < 8; h++) {
    const events = advanceTime(s, H, data, scripted([]));
    seen.push(...events.filter((e) => e.type !== "zmiana_pory").map((e) => e.type));
    const c = artifactState(s, "kamien_zmierzchu").charge;
    assert.ok(c >= 0 && c <= 100, `ładunek ${c}`);
    if (s.time.minutes === DAY + 3 * H) assert.equal(c, 100);
  }
  assert.deepEqual(seen, ["zapowiedz_zjawiska", "start_zjawiska", "artefakt_naladowany", "koniec_zjawiska"]);
  assert.equal(s.world.phenomenonRolledDay, 2);
});
test("każdy dzień losowany dokładnie raz – także po zapisie i wczytaniu z pokazaną zapowiedzią", () => {
  const s = worldState(6 * H + 30);
  const rng = missing();
  advanceTime(s, 30 * H, data, rng);
  assert.equal(rng.count, 2 * data.phenomena.length, "2 dni × liczba zjawisk");
  assert.equal(s.world.phenomenonRolledDay, 2);
  const p = worldState(6 * H);
  p.world.phenomenonRolledDay = 1;
  p.world.phenomenon = { id: "burza_iskier", startsAt: 12 * H, endsAt: 14 * H, omenAt: 10 * H, omenShown: false, started: false };
  assert.deepEqual(advanceTime(p, 4 * H, data, missing()).map((e) => e.type).filter((t) => t !== "zmiana_pory"), ["zapowiedz_zjawiska"]);
  const loaded = JSON.parse(JSON.stringify(p));
  const r = missing();
  const events = advanceTime(loaded, 6 * H, data, r).map((e) => e.type).filter((t) => t !== "zmiana_pory");
  assert.deepEqual(events, ["start_zjawiska", "koniec_zjawiska"]);
  assert.equal(r.count, 0, "dzień 1 już losowany");
});
test("getStats przy burzy: rangedHitChance −20, kara Bystrości −10 (nocą razem −25)", () => {
  const s = worldState(12 * H);
  s.character.skillPoints.strzelecka = 40; // above the 0 clamp
  const base = getStats(s, data);
  s.world.phenomenon = { id: "burza_iskier", startsAt: 0, endsAt: 20 * H, omenAt: 0, omenShown: true, started: true };
  const st = getStats(s, data);
  assert.equal(st.derived.rangedHitChance, base.derived.rangedHitChance - 20);
  assert.equal(st.skills.strzelecka, base.skills.strzelecka - 10);
  assert.equal(phenomenonBystroscPenalty(s, data), -10);
  assert.deepEqual(phenomenonModifiers(s, data), [{ rangedHitChance: -20 }]);
  s.time.minutes = 22 * H;
  s.world.phenomenon.endsAt = 23 * H;
  assert.equal(getStats(s, data).skills.strzelecka, base.skills.strzelecka - 25);
});
test("phenomenonEnemyModifiers: upiór przy nocy bez gwiazd, bandyta zera", () => {
  const s = worldState(22 * H);
  assert.deepEqual(phenomenonEnemyModifiers(s, data, { id: "upior_zwiadowca" }), { hitChance: 0, damage: 0, defense: 0 });
  s.world.phenomenon = { id: "noc_bez_gwiazd", startsAt: 0, endsAt: 30 * H, omenAt: 0, omenShown: true, started: true };
  assert.deepEqual(phenomenonEnemyModifiers(s, data, { id: "upior_zwiadowca" }), { hitChance: 10, damage: 2, defense: 0 });
  assert.deepEqual(phenomenonEnemyModifiers(s, data, { id: "bandyta" }), { hitChance: 0, damage: 0, defense: 0 });
});
test("forcePhenomenon zastępuje zaplanowane i startuje od razu", () => {
  const s = worldState(7 * H + 15);
  s.world.phenomenon = { id: "burza_iskier", startsAt: 12 * H, endsAt: 14 * H, omenAt: 10 * H, omenShown: false, started: false };
  const events = forcePhenomenon(s, data, "mgla_ciszy", scripted([3]), s.time.minutes);
  assert.deepEqual(events, [{ type: "start_zjawiska", id: "mgla_ciszy" }]);
  assert.deepEqual(s.world.phenomenon, { id: "mgla_ciszy", startsAt: 7 * H + 15, endsAt: 10 * H + 15, omenAt: 7 * H + 15, omenShown: true, started: true });
});
test("advanceTime bez świata (stan walki testowej) działa jak dotąd", () => {
  const s = combatState(data, "miecz");
  assert.deepEqual(advanceTime(s, 2 * H, data, scripted([])), []);
});
