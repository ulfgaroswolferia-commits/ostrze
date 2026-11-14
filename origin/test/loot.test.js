import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData, combatState } from "./helpers.js";
import { createNewState } from "../src/engine/state.js";
import { createRng } from "../src/engine/dice.js";
import { rollLootTable, validateLootTables } from "../src/systems/loot.js";
import { runActions, validateActions } from "../src/systems/actions.js";
import { validateData } from "../src/engine/data.js";
import { countOf } from "../src/systems/inventory.js";

const TABLE = { id: "lupy_probne", entries: [{ item: "opatrunek", qty: 1, weight: 9 }, { item: "napar_ziol", qty: [1, 2], weight: 1 }] };

function dataWith(tables = [TABLE]) {
  const data = structuredClone(minimalData());
  data.loot = { tables: [...data.loot.tables, ...tables] };
  return data;
}
function heroState(data) {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  return state;
}

test("rollLootTable: pozycje z wagami (≈90% przy wadze 9 do 1) i ilość w zakresie", () => {
  const data = dataWith();
  const rng = createRng(7);
  let first = 0;
  for (let i = 0; i < 10000; i++) {
    const { id, qty } = rollLootTable(data, "lupy_probne", rng);
    if (id === "opatrunek") { first++; assert.equal(qty, 1); } else { assert.equal(id, "napar_ziol"); assert.ok(qty === 1 || qty === 2); }
  }
  assert.ok(first / 10000 > 0.85 && first / 10000 < 0.95, `opatrunek ${first}`);
});

test("giveRandom: dodaje wylosowany przedmiot i zgłasza zdarzenie otrzymano", () => {
  const data = dataWith([{ id: "jeden", entries: [{ item: "napar_ziol", qty: 2, weight: 1 }] }]);
  const state = heroState(data);
  const before = countOf(state, "napar_ziol");
  const { events } = runActions(state, data, [{ giveRandom: "jeden" }], createRng(1));
  assert.deepEqual(events, [{ type: "otrzymano", id: "napar_ziol", qty: 2 }]);
  assert.equal(countOf(state, "napar_ziol"), before + 2);
});

test("giveRandom: za ciężki łup nie psuje reszty (zdarzenie za_ciezko, bez zmiany ekwipunku)", () => {
  const data = dataWith([{ id: "ciezki", entries: [{ item: "kolczuga", qty: 1, weight: 1 }] }]);
  const state = heroState(data);
  state.character.attributes.sila = 1;
  state.inventory.items.push({ id: "kolczuga", qty: 40 });
  const { events } = runActions(state, data, [{ giveRandom: "ciezki" }, { setFlag: "nie_dojdzie" }], createRng(1));
  assert.ok(events.some((e) => e.type === "za_ciezko"));
  assert.equal(state.flags.nie_dojdzie, undefined);
});

test("walidacja: giveRandom z nieznaną tabelą jest błędem, ze znaną nie", () => {
  const data = dataWith();
  assert.deepEqual(validateActions([{ giveRandom: "lupy_probne" }], "a", data), []);
  assert.match(validateActions([{ giveRandom: "duch" }], "a", data)[0], /duch/);
});

test("validateLootTables: nieznany przedmiot, waga < 1, zła ilość, duplikat i pusta tabela", () => {
  const data = dataWith();
  const bad = [
    { id: "t1", entries: [{ item: "nie_ma", qty: 1, weight: 1 }] },
    { id: "t2", entries: [{ item: "opatrunek", qty: 1, weight: 0 }] },
    { id: "t3", entries: [{ item: "opatrunek", qty: [3, 1], weight: 1 }] },
    { id: "t4", entries: [] },
    { id: "t4", entries: [{ item: "opatrunek", qty: 1, weight: 1 }] },
  ];
  const errors = validateLootTables({ tables: bad }, data);
  for (const re of [/nie_ma/, /weight/, /qty/, /t4.*puste|entries/, /zduplikowane/]) assert.ok(errors.some((m) => re.test(m)), String(re));
  assert.deepEqual(validateLootTables({ tables: [TABLE] }, data), []);
});

test("loot.json wchodzi w pełną walidację danych", () => {
  const data = dataWith([{ id: "zly", entries: [{ item: "nie_ma", qty: 1, weight: 1 }] }]);
  assert.ok(validateData(data).some((m) => /loot\.json/.test(m) && /nie_ma/.test(m)));
  assert.deepEqual(validateData(dataWith()), []);
});

test("tier: broń i pancerz muszą go mieć (1–4), inne typy nie", () => {
  const data = dataWith();
  const sword = data.items.find((i) => i.id === "miecz_krotki");
  delete sword.tier;
  assert.ok(validateData(data).some((m) => /miecz_krotki.*tier/.test(m)));
  sword.tier = 5;
  assert.ok(validateData(data).some((m) => /miecz_krotki.*tier/.test(m)));
  sword.tier = 1;
  assert.deepEqual(validateData(data), []);
});

test("broń wręcz nie wymaga masteryType (R5), miecz bez niego jest błędem", () => {
  const data = dataWith();
  data.items.push({ id: "kastet_probny", name: "Kastet", type: "weapon", tier: 1, skill: "wrecz", damageType: "obuchowe", damage: [2, 4], apCost: 2, range: "melee", minStrength: 1, weight: 0.5, value: 20, description: "Żelazo na palce." });
  assert.deepEqual(validateData(data), []);
  data.items.at(-1).skill = "sieczna";
  assert.ok(validateData(data).some((m) => /kastet_probny.*masteryType/.test(m)));
});

test("typ material: przedmiot do sprzedaży bez użycia przechodzi walidację, sklep może go skupować", () => {
  const data = dataWith();
  data.items.push({ id: "skora_probna", name: "Skóra", type: "material", weight: 1, value: 12, description: "Śmierdzi, ale się sprzeda." });
  const shop = data.shops.find((s) => s.id === "kramarz_szkolny");
  shop.buys = [...shop.buys, "material"];
  assert.deepEqual(validateData(data), []);
});
