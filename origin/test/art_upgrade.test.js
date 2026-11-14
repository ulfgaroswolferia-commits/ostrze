import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { ART_LIMITS } from "../src/engine/pix.js";

const data = await loadData();

const enemyArt = new Set(data.enemies.map((e) => e.art).filter(Boolean));
/** Rodzaj obrazu: wróg (art z enemies.json), portret (portret_*), reszta to sceny i lokacje. */
const kindOf = (id) => (enemyArt.has(id) ? "enemy" : id.startsWith("portret_") ? "portrait" : "scene");

test("każda grafika w data/art ma pełny rozmiar swojego rodzaju (wróg 64×48, portret 48×48, scena 96×48) i do 62 kolorów", () => {
  const wrong = [];
  for (const [id, image] of Object.entries(data.art)) {
    const limit = ART_LIMITS[kindOf(id)];
    if (image.w !== limit.w || image.h !== limit.h) wrong.push(`${id}: ${image.w}×${image.h}, oczekiwano ${limit.w}×${limit.h} (${kindOf(id)})`);
    const colours = new Set(image.rows.join("").replaceAll(".", "")).size;
    if (colours > 62) wrong.push(`${id}: ${colours} kolorów`);
  }
  assert.deepEqual(wrong, []);
});

test("dane z nowymi grafikami przechodzą walidację", () => {
  assert.deepEqual(validateData(data), []);
});

test("dialogi głównych postaci mają portret (hetman, Pełnomocnik, kapitanowie, Pisarz, Smyk, cesarz…)", () => {
  const dialogs = ["hetman", "pelnomocnik", "kapitan", "kapitan_przystani", "pisarz", "smyk", "hjalmar", "siostra_domu_ciszy", "cesarz", "kwatermistrz_koszar", "medyczka", "kowal_wyspy", "przekupka"];
  for (const id of dialogs) {
    const d = data.dialogues.find((x) => x.id === id);
    assert.ok(d?.portrait, `${id}: brak portretu`);
    assert.ok(data.art[d.portrait], `${id}: brak grafiki ${d.portrait}`);
  }
});

test("lokacje nie dzielą grafiki: każda lokacja ma własny obraz (art na poziomie lokacji jest unikalny)", () => {
  const byArt = {};
  for (const loc of data.travel.locations) if (typeof loc.art === "string") (byArt[loc.art] ??= []).push(loc.id);
  const shared = Object.entries(byArt).filter(([, ids]) => ids.length > 1);
  assert.deepEqual(shared, [], "wspólne obrazy lokacji: " + JSON.stringify(shared));
});

test("każda grafika jest użyta (wróg, portret w dialogu, scena lub etap podróży) – brak osieroconych plików", () => {
  const used = new Set(enemyArt);
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if ((k === "art" || k === "portrait") && typeof v === "string") used.add(v);
        else if (k === "stageArt" && v && typeof v === "object") Object.values(v).forEach((x) => used.add(x));
        else walk(v);
      }
    }
  };
  [data.travel, data.story, ...data.dialogues, ...data.enemies].forEach(walk);
  for (const e of data.enemies) if (e.art) used.add(e.art);
  const orphans = Object.keys(data.art).filter((id) => !used.has(id));
  assert.deepEqual(orphans, []);
});
