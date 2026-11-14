import { test } from "node:test";
import assert from "node:assert/strict";
import { combatState } from "./helpers.js";
import { loadData, validateData } from "../src/engine/data.js";
import { createRng } from "../src/engine/dice.js";
import { createCombat } from "../src/systems/combat/state.js";
import { addReinforcements } from "../src/systems/combat/firearm.js";

const data = await loadData();
const enemy = (id) => data.enemies.find((e) => e.id === id);
const SOLDIERS = ["cesarski_pikinier", "cesarski_kusznik", "cesarski_weszyciel", "jarnowski_strzelec", "jarnowski_kowal", "jarnowski_zwiadowca", "patrol_miejski"];

function spawn(level, enemies, extra = {}) {
  const state = combatState(data, "miecz");
  state.character.level = level;
  return createCombat(state, data, { id: "t", type: "combat", enemies, start: "melee", ...extra }, createRng(1)).enemies;
}

test("weterani: dane poprawne, każdy mocniejszy od rekruta pod każdym względem, wart więcej XP, z tą samą grafiką i łupem", () => {
  assert.deepEqual(validateData(data), []);
  for (const id of SOLDIERS) {
    const base = enemy(id);
    const vet = enemy(base.veteran);
    assert.ok(vet, id);
    assert.ok(vet.hp > base.hp && vet.defense > base.defense && (vet.armor ?? 0) > (base.armor ?? 0) && vet.xp > base.xp, id);
    assert.equal(vet.art, base.art);
    assert.deepEqual(vet.loot, base.loot);
    vet.attacks.forEach((attack, i) => {
      assert.ok(attack.hit > base.attacks[i].hit && attack.damage[1] > base.attacks[i].damage[1], `${id}: ${attack.name}`);
    });
  }
});

test("weterani: pojawiają się od poziomu 7, wcześniej te same walki bez zmian, liczebność zostaje", () => {
  assert.deepEqual(spawn(6, [{ id: "cesarski_pikinier", count: 2 }]).map((e) => e.id), ["cesarski_pikinier", "cesarski_pikinier"]);
  assert.deepEqual(spawn(7, [{ id: "cesarski_pikinier", count: 2 }]).map((e) => e.id), ["cesarski_pikinier_weteran", "cesarski_pikinier_weteran"]);
  assert.equal(spawn(10, [{ id: "cesarski_pikinier" }])[0].hp, enemy("cesarski_pikinier_weteran").hp);
});

test("weterani: szabrownicy i maruderzy zostają zwykli, a sparing nie zmienia przeciwnika", () => {
  assert.deepEqual(spawn(10, [{ id: "szabrownik" }, { id: "maruder" }]).map((e) => e.id), ["szabrownik", "maruder"]);
  assert.equal(spawn(10, [{ id: "cesarski_pikinier" }], { training: true })[0].id, "cesarski_pikinier");
});

test("weterani: posiłki też są weteranami (z listy sceny i po hałasie), a przy słabszym bohaterze zwykłe", () => {
  const fight = (level) => {
    const state = combatState(data, "miecz");
    state.character.level = level;
    return createCombat(state, data, { id: "t", type: "combat", enemies: [{ id: "cesarski_pikinier" }], start: "melee" }, createRng(1));
  };
  const late = fight(10);
  addReinforcements(null, data, late, createRng(1), [{ id: "cesarski_pikinier" }]);
  assert.deepEqual(late.enemies.map((e) => e.id), ["cesarski_pikinier_weteran", "cesarski_pikinier_weteran"]);
  const fallen = fight(10);
  addReinforcements(null, data, fallen, createRng(1), [{ id: fallen.enemies[0].id }]);
  assert.equal(fallen.enemies[1].id, "cesarski_pikinier_weteran", "z poległego weterana");
  const early = fight(5);
  addReinforcements(null, data, early, createRng(1), [{ id: "cesarski_pikinier" }]);
  assert.deepEqual(early.enemies.map((e) => e.id), ["cesarski_pikinier", "cesarski_pikinier"]);
});

test("lochy: panowie lochu mocniejsi dopiero od poziomu 10, nazwa zostaje, liczniki i walka dalej działają", () => {
  for (const id of ["straznik_progu", "szeptacz", "kustosz_kabli", "niespiacy", "pelnomocnik"]) {
    const base = enemy(id);
    const vet = enemy(base.veteran);
    assert.equal(base.veteranFrom, 10, id);
    assert.equal(vet.name, base.name, "ten sam przeciwnik, nie weteran z nazwy");
    assert.ok(vet.hp > base.hp && vet.armor > base.armor && vet.xp > base.xp, id);
    assert.equal(spawn(9, [{ id }])[0].id, id, "poziom 9: zwykły");
    assert.equal(spawn(10, [{ id }])[0].id, base.veteran, "poziom 10: mocniejszy");
  }
});

test("akt 5: strażnicy, słudzy i Istota mocniejsi od poziomu 10, a w tej samej walce przychodzą z tą samą nazwą", () => {
  for (const id of ["straznik_wiru", "sluga_wiru", "straz_szklanna", "istota_szklanna"]) {
    const base = enemy(id);
    const vet = enemy(base.veteran);
    assert.equal(vet.name, base.name);
    assert.ok(vet.hp > base.hp && vet.armor > base.armor && vet.defense > base.defense, id);
    assert.equal(spawn(9, [{ id }])[0].id, id);
    assert.equal(spawn(10, [{ id }])[0].id, base.veteran);
  }
});
