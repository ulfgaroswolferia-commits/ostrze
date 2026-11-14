import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { walkMinutes, locationById } from "../src/systems/travel.js";

const data = await loadData();

test("Leśniczówka i Ruiny strażnicy to dalekie miejsca Wilczego Brodu: dwa dni i dzień drogi", () => {
  const days = (id) => data.travel.routes.find((r) => r.id === locationById(data, id).far.route).days;
  assert.equal(days("lesniczowka"), 2);
  assert.equal(days("ruiny_straznicy"), 1);
});

test("każda lokacja z near.via: droga do rodzica trwa near.minutes, a droga przez hub nie jest krótsza od drogi bezpośredniej", () => {
  for (const loc of data.travel.locations.filter((l) => l.near?.via)) {
    assert.equal(walkMinutes(data, loc.id, loc.near.via), loc.near.minutes, loc.id);
    assert.ok(walkMinutes(data, "wilczy_brod", loc.id) > walkMinutes(data, "wilczy_brod", loc.near.via), loc.id);
  }
});

test("walidacja: near.via nieznana lub cykl to błąd", () => {
  const bad = structuredClone(data);
  bad.travel.locations.find((l) => l.id === "stary_mlyn").near.via = "nie_ma";
  assert.ok(validateData(bad).some((m) => /via/.test(m)));
  const loop = structuredClone(data);
  loop.travel.locations.find((l) => l.id === "wilczy_las").near.via = "stary_mlyn";
  loop.travel.locations.find((l) => l.id === "stary_mlyn").near.via = "wilczy_las";
  assert.ok(validateData(loop).some((m) => /via|cykl/.test(m)));
  void locationById;
});
