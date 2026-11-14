import { test } from "node:test";
import assert from "node:assert/strict";
import { minimalData } from "./helpers.js";
import { validateData } from "../src/engine/data.js";

/** Real data with a near forest in the hub's region (and the map token for it) – `edit` changes the clone. */
function data(edit = () => {}) {
  const d = structuredClone(minimalData());
  d.travel.locations.push({ id: "las", name: "Las", short: "Las", region: "pogorze", near: { minutes: 40 }, danger: 2,
    secret: true, hint: "ścieżka", spots: [{ id: "polana", name: "Polana", type: "rest" }] });
  d.maps = { ...d.maps, pogorze: "Hub {wilczy_brod}  Las {las} {wilczy_las} {stary_mlyn} {trakt_kupiecki} {lesniczowka} {ruiny_straznicy}\n" };
  edit(d);
  return d;
}
const las = (d) => d.travel.locations.find((l) => l.id === "las");
const errors = (edit) => validateData(data(edit));
const has = (list, re) => assert.ok(list.some((m) => re.test(m)), `brak ${re}\n${list.join("\n")}`);

test("poprawne lokacje z miejscami przechodzą walidację", () => {
  assert.deepEqual(errors(), []);
});

test("spots: typ spoza listy, talk/shop z nieznanym ref, scene bez scenes, board/rest z ref, powtórzone id", () => {
  has(errors((d) => { las(d).spots[0].type = "dom"; }), /locations › las › .*type/);
  has(errors((d) => { las(d).spots.push({ id: "t", name: "T", type: "talk", ref: "nikt" }); }), /nieznana rozmowa/);
  has(errors((d) => { las(d).spots.push({ id: "s", name: "S", type: "shop", ref: "nic" }); }), /nieznany sklep/);
  has(errors((d) => { las(d).spots.push({ id: "x", name: "X", type: "scene" }); }), /scenes/);
  has(errors((d) => { las(d).spots.push({ id: "b", name: "B", type: "board", ref: "x" }); }), /ref/);
  has(errors((d) => { las(d).spots.push({ id: "polana", name: "P", type: "rest" }); }), /zduplikowane/);
});

test("near.minutes poza 1–480, danger 5, art nieznany, spots[].if nieznany warunek", () => {
  has(errors((d) => { las(d).near.minutes = 0; }), /near/);
  has(errors((d) => { las(d).near.minutes = 481; }), /near/);
  has(errors((d) => { las(d).danger = 5; }), /danger/);
  has(errors((d) => { las(d).art = "nie_ma"; }), /art/);
  has(errors((d) => { las(d).spots[0].if = { zly: 1 }; }), /nieznany warunek/);
});

test("sceny miejsca są walidowane jak sceny zdarzenia i mają globalnie unikalne id", () => {
  has(errors((d) => { las(d).spots.push({ id: "sc", name: "Sc", type: "scene", scenes: [{ id: "las_sc", type: "narration", text: "x", goto: "nie_ma" }] }); }), /nieznana scena/);
  has(errors((d) => { las(d).spots.push({ id: "sc", name: "Sc", type: "scene", scenes: [{ id: "a", type: "narration", text: "x" }] }); }), /już zajęte/);
  assert.deepEqual(errors((d) => { las(d).spots.push({ id: "sc", name: "Sc", type: "scene", scenes: [{ id: "las_sc", type: "narration", text: "x", goto: "koniec" }] }); }), []);
});

test("mapa regionu: token nieznanej lokacji i lokacja bliska bez tokenu to błędy", () => {
  has(errors((d) => { d.maps.pogorze += "{duch}"; }), /duch/);
  has(errors((d) => { d.maps.pogorze = "{wilczy_brod}"; }), /las.*mapie|mapie.*las/);
});

test("typ misc: bez pól dodatkowych poprawny, z polem damage niepoprawny", () => {
  const misc = { id: "list", name: "List", type: "misc", weight: 0.1, value: 0, description: "Papier." };
  assert.deepEqual(errors((d) => { d.items.push(misc); }), []);
  has(errors((d) => { d.items.push({ ...misc, damage: [1, 2] }); }), /damage/);
});
