import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { createRng } from "../src/engine/dice.js";
import { validateData } from "../src/engine/data.js";
import { createCombat } from "../src/systems/combat/state.js";
import { doAction, attackTargets } from "../src/systems/combat/actions.js";
import { addItem, equip } from "../src/systems/inventory.js";

const data = minimalData();
const BLADES = ["ostrze_gwiazd_bogdana", "ostrze_gwiazd_surowe", "para_gwiazd_bogdana", "para_gwiazd_surowa"];
const item = (id) => data.items.find((i) => i.id === id);
const avg = (i) => (i.damage[0] + i.damage[1]) / 2;

test("Ostrza z nieba: cztery artefakty w slocie broni z typem obrażeń gwiezdne, dane przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
  for (const id of BLADES) {
    const i = item(id);
    assert.ok(i, id);
    assert.equal(i.type, "artifact");
    assert.equal(i.slot, "bron");
    assert.equal(i.damageType, "gwiezdne");
    assert.equal(i.tier, 4);
  }
  assert.equal(item("para_gwiazd_bogdana").pair, true);
  assert.equal(item("ostrze_gwiazd_bogdana").masteryType, "miecz");
  assert.equal(item("para_gwiazd_surowa").masteryType, "wlocznie");
});

test("Ostrza z nieba: wersja Bogdana bije mocniej niż surowa w obu formach", () => {
  assert.ok(avg(item("ostrze_gwiazd_bogdana")) > avg(item("ostrze_gwiazd_surowe")));
  assert.ok(avg(item("para_gwiazd_bogdana")) > avg(item("para_gwiazd_surowa")));
});

test("interfejs: nowy typ obrażeń ma nazwę, a karta ekwipunku nie pokazuje „[[”", () => {
  assert.ok(data.ui["damage.gwiezdne"]);
});

/** Total HP taken from the night wraith in 200 swings of `weaponId` (one attack per fresh fight, fixed seeds). */
function damageDealt(weaponId, classId) {
  let total = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const rng = createRng(seed);
    const state = combatState(data, classId);
    if (weaponId !== state.inventory.equipped.bron) {
      addItem(state, data, weaponId, 1);
      equip(state, data, weaponId, "bron");
    }
    const combat = createCombat(state, data, { enemies: [{ id: "upior_nocy", count: 1 }], start: "melee", canFlee: true, id: "blade_sim" }, rng);
    const enemy = combat.enemies[0];
    const before = enemy.hp;
    combat.playerAp = 10;
    doAction(state, data, combat, { id: "attack", target: attackTargets(state, data, combat)[0] }, rng);
    total += before - enemy.hp;
  }
  return total;
}

test("Ostrze z nieba naprawdę bije upiory: co najmniej 5× więcej obrażeń niż zwykły miecz (upiór ma 10% na sieczne)", () => {
  const plain = damageDealt("miecz_krotki", "miecz");
  const star = damageDealt("ostrze_gwiazd_bogdana", "miecz");
  assert.ok(star >= 5 * plain, `Ostrze ${star}, miecz ${plain}`);
});

test("para z nieba też bije upiory mocniej niż zwykła para włóczni", () => {
  const plain = damageDealt("para_wloczni", "wlocznia");
  const star = damageDealt("para_gwiazd_bogdana", "wlocznia");
  assert.ok(star >= 5 * plain, `para ${star}, zwykła ${plain}`);
});
