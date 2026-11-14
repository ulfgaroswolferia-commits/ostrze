import { test } from "node:test";
import assert from "node:assert/strict";
import { validateData } from "../src/engine/data.js";
import { minimalData } from "./helpers.js";
import { enemyById, validateEnemies, validateArt, AI_TYPES } from "../src/systems/combat/data.js";

const base = () => structuredClone(minimalData().enemies.find((e) => e.id === "bandyta"));
const withEnemy = (patch) => {
  const d = structuredClone(minimalData());
  d.enemies.push({ ...base(), id: "x", ...patch });
  return validateEnemies(d.enemies, d).filter((m) => m.startsWith("enemies.json › x"));
};
const withAttack = (patch) => withEnemy({ attacks: [Object.fromEntries(Object.entries({ name: "Cios", apCost: 3, damage: [1, 2], damageType: "obuchowe", hit: 50, ...patch }).filter(([, v]) => v !== undefined))] });
const expectErr = (errs, msg) => assert.ok(errs.some((e) => e.includes(msg)), `brak: ${msg}\n${errs.join("\n")}`);

test("wrogowie: prawdziwe dane przechodzą, demo", () => {
  const d = minimalData();
  assert.deepEqual(validateEnemies(d.enemies, d), []);
  assert.deepEqual(validateData(d), []);
  assert.deepEqual(AI_TYPES, ["aggressive", "cautious", "ranged"]);
  assert.equal(enemyById(d, "instruktor").nameAcc, "Instruktora");
  assert.equal(enemyById(d, "bandyta").nameAcc, "Bandytę");
  assert.equal(enemyById(d, "instruktor").morale, null);
  assert.equal(enemyById(d, "brak"), undefined);
  assert.deepEqual(withEnemy({}), []);
});
test("wrogowie: pola i odwołania", () => {
  expectErr(withEnemy({ ai: "magia" }), 'enemies.json › x › ai: nieznany typ AI "magia"');
  expectErr(withAttack({ damageType: undefined }), "enemies.json › x › attacks[0].damageType: wymagane razem z damage");
  expectErr(withAttack({ damage: undefined, damageType: undefined }), "enemies.json › x › attacks[0]: atak bez obrażeń wymaga effects");
  expectErr(withAttack({ hit: 99 }), "enemies.json › x › attacks[0].hit: wartość poza zakresem 5–95");
  expectErr(withAttack({ hit: undefined }), "enemies.json › x › attacks[0].hit: brak wymaganego pola");
  expectErr(withAttack({ effects: [{ id: "brak", chance: 10 }] }), 'enemies.json › x › attacks[0].effects[0].id: nieznany efekt "brak"');
  expectErr(withAttack({ effects: [{ id: "strach", chance: 0 }] }), "enemies.json › x › attacks[0].effects[0].chance: wartość poza zakresem 1–100");
  assert.deepEqual(withAttack({ damage: undefined, damageType: undefined, effects: [{ id: "strach", chance: 50 }] }), []);
  expectErr(withEnemy({ immune: ["brak"] }), 'enemies.json › x › immune[0]: nieznany efekt "brak"');
  expectErr(withEnemy({ effectResist: { strach: 150 } }), "enemies.json › x › effectResist.strach: wartość poza zakresem 0–100");
  expectErr(withEnemy({ effectResist: { brak: 10 } }), 'enemies.json › x › effectResist.brak: nieznany efekt "brak"');
  expectErr(withEnemy({ morale: 120 }), "enemies.json › x › morale: oczekiwano liczby całkowitej 0–100 lub null");
  expectErr(withEnemy({ reduction: { sieczne: 80 } }), "enemies.json › x › reduction.sieczne: wartość poza zakresem 0–75");
  expectErr(withEnemy({ damageTaken: { magia: 2 } }), 'enemies.json › x › damageTaken.magia: nieznany typ obrażeń "magia"');
  expectErr(withEnemy({ hp: 0 }), "enemies.json › x › hp: wartość mniejsza niż 1");
  expectErr(withEnemy({ attacks: [] }), "enemies.json › x › attacks: wymagany co najmniej jeden atak");
  expectErr(withEnemy({ foo: 1 }), "enemies.json › x › foo: nieznane pole");
  expectErr(withEnemy({ art: "brak" }), "enemies.json › x › art: brak pliku art/brak.pix");
});
test("wrogowie: łup", () => {
  assert.deepEqual(withEnemy({ loot: [{ chance: 50, giveItem: "opatrunek" }, { chance: 10, setFlag: "f" }] }), []);
  expectErr(withEnemy({ loot: [{ chance: 100, takeMoney: 4 }] }), "enemies.json › x › loot[0]: dozwolone akcje giveItem, giveRandom, giveMoney, setFlag");
  expectErr(withEnemy({ loot: [{ chance: 0, giveMoney: 4 }] }), "enemies.json › x › loot[0].chance: wartość poza zakresem 1–100");
  expectErr(withEnemy({ loot: [{ giveMoney: 4 }] }), "enemies.json › x › loot[0].chance: brak wymaganego pola");
  expectErr(withEnemy({ loot: [{ chance: 10, giveItem: "brak" }] }), "enemies.json › x › loot[0].giveItem: nieznany przedmiot");
  expectErr(withEnemy({ loot: [{ chance: 10 }] }), "enemies.json › x › loot[0]: oczekiwano jednej akcji obok chance");
});
test("wrogowie: duplikat id i brak tablicy", () => {
  const d = minimalData();
  expectErr(validateEnemies([d.enemies[0], d.enemies[0]], d), "enemies.json › instruktor: zduplikowane id");
  assert.deepEqual(validateEnemies({}, d), ["enemies.json: oczekiwano tablicy"]);
});
test("grafiki: kształt obrazu i limit wroga", () => {
  assert.deepEqual(validateArt(minimalData().art), []);
  assert.deepEqual(validateArt({ x: "źle" }), ["art/x.pix: oczekiwano obrazu"]);
  const d = minimalData();
  d.art.bandyta = { w: 65, h: 48, palette: { a: 1 }, rows: Array(48).fill("a".repeat(65)) };
  expectErr(validateData(d), "enemies.json › bandyta › art: grafika 65×48 przekracza limit 64×48");
  d.art.bandyta = { w: 64, h: 50, palette: { a: 1 }, rows: Array(50).fill("a".repeat(64)) };
  expectErr(validateData(d), "enemies.json › bandyta › art: grafika 64×50 przekracza limit 64×48");
});

test("upior_nocy: wróg przechodzi walidację, odporny na zwykłą broń, podatny na ogień, bez łupu i PD", () => {
  const d = minimalData();
  const e = d.enemies.find((x) => x.id === "upior_nocy");
  assert.ok(e, "wpis upior_nocy");
  assert.deepEqual(validateEnemies(d.enemies, d), []);
  assert.equal(e.hp, 150);
  assert.deepEqual(e.damageTaken, { sieczne: 0.1, klute: 0.1, ogien: 2.0 });
  assert.equal(e.xp, 0);
  assert.deepEqual(e.loot, []);
  assert.equal(e.art, "upior_zwiadowca");
});
test("wrogowie: łup losowy z tabeli (giveRandom)", () => {
  assert.deepEqual(withEnemy({ loot: [{ chance: 40, giveRandom: "lupy_testowe" }] }), []);
  expectErr(withEnemy({ loot: [{ chance: 40, giveRandom: "nie_ma" }] }), "nieznana tabela łupów");
});
