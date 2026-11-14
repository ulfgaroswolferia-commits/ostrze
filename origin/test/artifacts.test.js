import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { addItem, removeItem, equip, countOf } from "../src/systems/inventory.js";
import { getStats } from "../src/systems/stats.js";
import { artifactState, carriedArtifacts, equippedArtifact, regenerate, passiveModifiers, setExposed } from "../src/systems/artifacts.js";

const data = minimalData();
// Kamień Zmierzchu ładuje się w grze tylko wystawiony; testy matematyki ładowania liczą go jak noszony artefakt bez tego wymogu.
data.items.find((i) => i.id === "kamien_zmierzchu").regen.requiresExposure = false;
const phen = (id) => data.phenomena.find((p) => p.id === id);
const DAY = 12 * 60;
const NIGHT = 22 * 60;

/** Swordsman at noon with the stone in the bag (optionally worn in the talisman slot). */
function withStone({ worn = true, charge } = {}) {
  const s = combatState(data, "miecz");
  addItem(s, data, "kamien_zmierzchu", 1);
  if (worn) equip(s, data, "kamien_zmierzchu", "talizman");
  if (charge !== undefined) s.artifacts.kamien_zmierzchu.charge = charge;
  return s;
}
const charge = (s, id = "kamien_zmierzchu") => artifactState(s, id).charge;

test("addItem artefaktu tworzy wpis stanu; drugi egzemplarz odrzucony; wpis zostaje po usunięciu", () => {
  const s = combatState(data, "miecz");
  assert.equal(artifactState(s, "kamien_zmierzchu"), undefined);
  assert.deepEqual(addItem(s, data, "kamien_zmierzchu", 1), { ok: true });
  assert.deepEqual(artifactState(s, "kamien_zmierzchu"), { charge: 40, exposed: false });
  s.artifacts.kamien_zmierzchu.charge = 55;
  assert.deepEqual(addItem(s, data, "kamien_zmierzchu", 1), { ok: false, reason: "inv.artifactUnique" });
  assert.equal(countOf(s, "kamien_zmierzchu"), 1);
  assert.equal(charge(s), 55);
  removeItem(s, data, "kamien_zmierzchu", 1);
  assert.equal(countOf(s, "kamien_zmierzchu"), 0);
  assert.deepEqual(artifactState(s, "kamien_zmierzchu"), { charge: 55, exposed: false });
  addItem(s, data, "kamien_zmierzchu", 1);
  assert.equal(charge(s), 55, "powrót przedmiotu nie resetuje ładunku");
  assert.deepEqual(carriedArtifacts(s, data).map((i) => i.id), ["kamien_zmierzchu"]);
});
test("regenerate: proporcjonalnie, noc ×2, sakwa ×0.5", () => {
  const s = withStone();
  s.time.minutes = DAY;
  regenerate(s, data, 60);
  assert.equal(charge(s), 44);
  const h = withStone();
  h.time.minutes = DAY;
  regenerate(h, data, 30);
  assert.equal(charge(h), 42);
  const n = withStone();
  n.time.minutes = NIGHT;
  regenerate(n, data, 60);
  assert.equal(charge(n), 48);
  const bag = withStone({ worn: false });
  bag.time.minutes = DAY;
  regenerate(bag, data, 60);
  assert.equal(charge(bag), 42);
});
test("regenerate: near:upior w walce i w tagach sceny → ×0", () => {
  const s = withStone();
  s.time.minutes = DAY;
  regenerate(s, data, 60, { combat: { enemies: [{ id: "upior_zwiadowca", dead: false }] } });
  assert.equal(charge(s), 40);
  regenerate(s, data, 60, { combat: { enemies: [{ id: "upior_zwiadowca", dead: true }, { id: "bandyta", dead: false }] } });
  assert.equal(charge(s), 44, "martwy upiór nie blokuje");
  regenerate(s, data, 60, { sceneTags: ["upior"] });
  assert.equal(charge(s), 44);
});
test("regenerate: zjawiska – ujemny mnożnik, exposed full, zdarzenie naładowania raz", () => {
  const s = withStone();
  s.time.minutes = DAY;
  regenerate(s, data, 60, { phenomenon: phen("noc_bez_gwiazd") });
  assert.equal(charge(s), 36);
  const e = withStone();
  setExposed(e, data, true);
  assert.equal(artifactState(e, "kamien_zmierzchu").exposed, true);
  const events = regenerate(e, data, 10, { phenomenon: phen("burza_iskier") });
  assert.equal(charge(e), 100);
  assert.deepEqual(events, [{ type: "artefakt_naladowany", id: "kamien_zmierzchu" }]);
  assert.deepEqual(regenerate(e, data, 60, { phenomenon: phen("burza_iskier") }), []);
  setExposed(e, data, false);
  assert.equal(artifactState(e, "kamien_zmierzchu").exposed, false);
});
test("regenerate: obcięcie do 0 i max", () => {
  const s = withStone({ charge: 99 });
  s.time.minutes = DAY;
  assert.deepEqual(regenerate(s, data, 60), [{ type: "artefakt_naladowany", id: "kamien_zmierzchu" }]);
  assert.equal(charge(s), 100);
  const z = withStone({ charge: 1 });
  z.time.minutes = DAY;
  regenerate(z, data, 60, { phenomenon: phen("noc_bez_gwiazd") });
  assert.equal(charge(z), 0);
});
test("regenerate: requiresExposure bez wystawienia nic nie zmienia; artefakt poza torbą się nie ładuje", () => {
  const d = structuredClone(data);
  d.items.find((i) => i.id === "kamien_zmierzchu").regen.requiresExposure = true;
  const s = combatState(d, "miecz");
  addItem(s, d, "kamien_zmierzchu", 1);
  s.time.minutes = DAY;
  regenerate(s, d, 60);
  assert.equal(charge(s), 40);
  setExposed(s, d, true);
  regenerate(s, d, 60);
  assert.equal(charge(s), 40, "w torbie się nie wystawia, trzeba założyć");
  equip(s, d, "kamien_zmierzchu", "talizman");
  setExposed(s, d, true);
  regenerate(s, d, 60);
  assert.equal(charge(s), 44);
  const gone = withStone({ worn: false });
  removeItem(gone, data, "kamien_zmierzchu", 1);
  regenerate(gone, data, 60);
  assert.equal(charge(gone), 40);
});
test("pasywy: próg 75 w getStats", () => {
  const s = withStone({ charge: 75 });
  const base = getStats(withStone({ charge: 74 }), data).attributes.bystrosc;
  assert.equal(getStats(s, data).attributes.bystrosc, base + 1);
  assert.deepEqual(passiveModifiers(s, data), [{ bystrosc: 1 }]);
  assert.deepEqual(passiveModifiers(withStone({ charge: 74 }), data), []);
  assert.deepEqual(passiveModifiers(withStone({ worn: false, charge: 90 }), data), [], "w sakwie pasywy nie działają");
});
test("broń-artefakt w bron: equippedArtifact i pasyw; talizman ma pierwszeństwo", () => {
  const s = combatState(data, "miecz");
  const before = getStats(s, data).derived.meleeHitChance;
  addItem(s, data, "miecz_gwiazd_test", 1);
  assert.deepEqual(equip(s, data, "miecz_gwiazd_test", "bron").ok, true);
  assert.equal(equippedArtifact(s, data).id, "miecz_gwiazd_test");
  assert.equal(getStats(s, data).derived.meleeHitChance, before + 5);
  addItem(s, data, "kamien_zmierzchu", 1);
  equip(s, data, "kamien_zmierzchu", "talizman");
  assert.equal(equippedArtifact(s, data).id, "kamien_zmierzchu");
  assert.equal(getStats(s, data).derived.meleeHitChance, before);
  assert.equal(equippedArtifact(combatState(data, "miecz"), data), null);
});
test("drugi egzemplarz: akcja giveItem pomija bez zdarzenia, sklep odmawia bez pobrania groszy", async () => {
  const { runActions } = await import("../src/systems/actions.js");
  const { buy } = await import("../src/systems/shop.js");
  const s = withStone({ charge: 70 });
  s.world = { shops: {} };
  const r = runActions(s, data, [{ giveItem: "kamien_zmierzchu" }], { int: () => 1 });
  assert.deepEqual(r.events, []);
  assert.equal(countOf(s, "kamien_zmierzchu"), 1);
  assert.equal(charge(s), 70);
  const d = structuredClone(data);
  d.shops[0].stock.push({ id: "kamien_zmierzchu", qty: 1 });
  s.character.money = 10000;
  assert.deepEqual(buy(s, d, d.shops[0].id, "kamien_zmierzchu", 1), { ok: false, reason: "inv.artifactUnique" });
  assert.equal(s.character.money, 10000);
});
