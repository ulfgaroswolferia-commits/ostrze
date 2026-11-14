import { test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters as strip } from "node:util";
import { renderItemCard } from "../src/ui/inventory_screen.js";
import { itemById } from "../src/systems/items.js";
import { createNewState } from "../src/engine/state.js";
import { minimalData, combatState } from "./helpers.js";

const data = minimalData();
function hero() {
  const state = createNewState({ seed: 1, startScene: "a", rules: data.rules });
  const cs = combatState(data, "miecz");
  state.character = cs.character;
  state.inventory = cs.inventory;
  return state;
}
const card = (state, id) => strip(renderItemCard(itemById(data, id), state, data));

test("karta pancerza nieposiadanego pokazuje zysk na statystykach po założeniu", () => {
  assert.match(card(hero(), "kaptur_mysliwego"), /Po założeniu: Bystrość 6→7 \(\+1\)/);
});

test("karta broni pokazuje dotychczasową broń i nie zmienia stanu", () => {
  const state = hero();
  const before = JSON.stringify(state);
  assert.match(card(state, "sztylet"), /Założone: Krótki miecz/);
  assert.match(card(state, "sztylet"), /Obrażenia\s+4–8\s/);
  assert.equal(JSON.stringify(state), before);
});

test("założony przedmiot jest oznaczony, a nie porównywany", () => {
  assert.match(card(hero(), "miecz_krotki"), /Założone\./);
});
