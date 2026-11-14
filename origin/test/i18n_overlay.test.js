import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { textEntries, applyOverlay, hashText, checkOverlay, CASE_KEYS, TEXT_KEYS } from "../src/i18n/overlay.js";

const DATA = new URL("../data/", import.meta.url);
const tr = (pl, en) => ({ t: en, h: hashText(pl) });

test("textEntries: tablica po id, tablica bez id po indeksie, ui po kluczu", () => {
  const e = textEntries("items.json", [{ id: "a", name: "Miecz", value: 3 }]);
  assert.deepEqual([...e], [["[a].name", "Miecz"]]);
  assert.deepEqual([...textEntries("x.json", { list: [{ text: "Raz" }] })], [["list.#0.text", "Raz"]]);
  assert.deepEqual([...textEntries("ui.json", { "menu.new": "Nowa gra" })], [["menu.new", "Nowa gra"]]);
});

test("textEntries: ścieżki z briefu dla dialogów, scen i zdarzeń", () => {
  const dialog = { start: "kuznia", nodes: { kuznia: { speaker: "Kowal", text: "Czego?", options: [{ id: "odlamek", text: "Pokaż odłamek.", goto: "x" }] } } };
  assert.deepEqual([...textEntries("dialogues/kowal.json", dialog)], [
    ["nodes.kuznia.speaker", "Kowal"], ["nodes.kuznia.text", "Czego?"], ["nodes.kuznia.options.[odlamek].text", "Pokaż odłamek."],
  ]);
  assert.deepEqual([...textEntries("story.json", { scenes: [{ id: "prolog_wstep", text: "Noc." }] })], [["scenes.[prolog_wstep].text", "Noc."]]);
  const travel = { events: [{ id: "pielgrzym", scenes: [{ id: "pielgrzym_spotkanie", text: "Pielgrzym." }] }] };
  assert.deepEqual([...textEntries("travel.json", travel)], [["events.[pielgrzym].scenes.[pielgrzym_spotkanie].text", "Pielgrzym."]]);
});

test("textEntries: listy akcji to mechanika, nie tekst (hint w akcji to id miejsca)", () => {
  const data = { locations: [{ id: "las", hint: "dym nad lasem" }], nodes: { a: { text: "Tak.", actions: [{ hint: "las" }] } } };
  assert.deepEqual([...textEntries("x.json", data)], [["locations.[las].hint", "dym nad lasem"], ["nodes.a.text", "Tak."]]);
  assert.equal(textEntries("quests.json", [{ id: "q", onComplete: [{ hint: "las" }], onStart: [{ hint: "las" }] }]).size, 0);
});

test("hashText: pierwsze 8 znaków SHA-1 w hex", () => {
  assert.equal(hashText(""), "da39a3ee");
  assert.equal(hashText("abc"), "a9993e36");
  assert.match(hashText("Zażółć gęślą jaźń"), /^[0-9a-f]{8}$/);
});

test("applyOverlay podmienia tylko teksty i nie zmienia oryginału", () => {
  const src = [{ id: "a", name: "Miecz", description: "Krótki miecz.", value: 3, heavy: false, tags: ["bron"] }, { id: "b", name: "Topór", value: 5 }];
  const before = structuredClone(src);
  const out = applyOverlay("items.json", src, { "[a].name": tr("Miecz", "Sword"), "[a].description": tr("Krótki miecz.", "A short sword.") });
  assert.deepEqual(src, before);
  assert.notEqual(out, src);
  assert.deepEqual(out, [{ id: "a", name: "Sword", description: "A short sword.", value: 3, heavy: false, tags: ["bron"] }, { id: "b", name: "Topór", value: 5 }]);
  const ui = { "menu.new": "Nowa gra", "menu.quit": "Wyjdź" };
  assert.deepEqual(applyOverlay("ui.json", ui, { "menu.new": tr("Nowa gra", "New game") }), { "menu.new": "New game", "menu.quit": "Wyjdź" });
  assert.equal(ui["menu.new"], "Nowa gra");
});

test("applyOverlay pomija wpisy osierocone i nietekstowe", () => {
  const src = [{ id: "a", name: "Miecz", value: 3 }];
  const out = applyOverlay("items.json", src, { "[a].value": { t: "9", h: "x" }, "[zz].name": tr("X", "Y"), "[a].name": { t: 7, h: "x" } });
  assert.deepEqual(out, src);
});

test("pola przypadków bez przekładu biorą przetłumaczoną nazwę", () => {
  const out = applyOverlay("enemies.json", [{ id: "b", name: "Bandyta", nameAcc: "Bandytę" }], { "[b].name": { t: "Bandit", h: hashText("Bandyta") } });
  assert.equal(out[0].nameAcc, "Bandit");
  const own = applyOverlay("enemies.json", [{ id: "b", name: "Bandyta", nameAcc: "Bandytę" }], { "[b].name": tr("Bandyta", "Bandit"), "[b].nameAcc": tr("Bandytę", "the bandit") });
  assert.equal(own[0].nameAcc, "the bandit");
  const none = applyOverlay("enemies.json", [{ id: "b", name: "Bandyta", nameAcc: "Bandytę" }], {});
  assert.equal(none[0].nameAcc, "Bandytę");
  assert.deepEqual(CASE_KEYS, ["nameAcc", "clientGen"]);
});

test("clientGen bez przekładu bierze przetłumaczonego zleceniodawcę", () => {
  const src = [{ id: "q", client: "Kupiec Ostromir", clientGen: "kupca Ostromira" }];
  const out = applyOverlay("quests.json", src, { "[q].client": tr("Kupiec Ostromir", "Ostromir the merchant") });
  assert.equal(out[0].clientGen, "Ostromir the merchant");
  assert.deepEqual(checkOverlay("quests.json", src, { "[q].client": tr("Kupiec Ostromir", "Ostromir the merchant") }).missing, []);
});

test("applyOverlay działa na głęboko zamrożonym wejściu", () => {
  const freeze = (v) => { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
  const src = freeze([{ id: "b", name: "Bandyta", nameAcc: "Bandytę", attacks: [{ name: "Cios", damage: 3 }] }]);
  const out = applyOverlay("enemies.json", src, { "[b].name": tr("Bandyta", "Bandit"), "[b].attacks.#0.name": tr("Cios", "Hit") });
  assert.deepEqual(out, [{ id: "b", name: "Bandit", nameAcc: "Bandit", attacks: [{ name: "Hit", damage: 3 }] }]);
  assert.equal(src[0].name, "Bandyta");
  assert.deepEqual(applyOverlay("ui.json", freeze({ "a.b": "Tak" }), { "a.b": tr("Tak", "Yes") }), { "a.b": "Yes" });
});

test("checkOverlay: zniekształcony token zmiennej to zawsze inne zmienne", () => {
  const src = { "a.b": "Masz {n}.", "a.c": "Zły { n} token." };
  const r = checkOverlay("ui.json", src, { "a.b": tr(src["a.b"], "You have {n }."), "a.c": tr(src["a.c"], "Bad { n} token.") });
  assert.deepEqual(r.varMismatch, ["a.b", "a.c"]);
});

test("checkOverlay: brak, nieaktualny, osierocony, inne zmienne, pole nietekstowe", () => {
  const src = [{ id: "a", name: "Miecz", description: "Masz {n} sztuk.", value: 3 }, { id: "b", name: "Topór", description: "Ostry." }];
  const overlay = {
    "[a].name": tr("Miecz", "Sword"),
    "[a].description": tr("Masz {n} sztuk.", "You have {count} pieces."),
    "[b].description": tr("Tępy.", "Sharp."),
    "[c].name": tr("Łuk", "Bow"),
    "[a].value": { t: "4", h: "00000000" },
  };
  assert.deepEqual(checkOverlay("items.json", src, overlay), {
    missing: ["[b].name"], stale: ["[b].description"], orphan: ["[c].name"], varMismatch: ["[a].description"], nonText: ["[a].value"], empty: [],
  });
});

test("checkOverlay: wartość liczbowa albo logiczna w nakładce to pole nietekstowe", () => {
  const src = [{ id: "a", name: "Miecz" }];
  assert.deepEqual(checkOverlay("items.json", src, { "[a].name": { t: 5, h: hashText("Miecz") } }).nonText, ["[a].name"]);
  assert.deepEqual(checkOverlay("items.json", src, { "[a].name": true }).nonText, ["[a].name"]);
});

test("checkOverlay: zmienne porównuje po nazwie, także w formach liczby mnogiej", () => {
  const src = { "a.b": "{n|bełt|bełty|bełtów} dla {name}", "a.c": "Masz {n}." };
  const ok = checkOverlay("ui.json", src, { "a.b": tr(src["a.b"], "{name} gets {n|bolt|bolts}"), "a.c": tr(src["a.c"], "You have {n}, {n}.") });
  assert.deepEqual(ok.varMismatch, []);
  const bad = checkOverlay("ui.json", src, { "a.b": tr(src["a.b"], "{count|bolt|bolts} for {name}"), "a.c": tr(src["a.c"], "You have it.") });
  assert.deepEqual(bad.varMismatch, ["a.b", "a.c"]);
});

test("pola przypadków nie liczą się jako brak przekładu", () => {
  const src = [{ id: "b", name: "Bandyta", nameAcc: "Bandytę" }];
  const r = checkOverlay("enemies.json", src, { "[b].name": tr("Bandyta", "Bandit") });
  assert.deepEqual(r, { missing: [], stale: [], orphan: [], varMismatch: [], nonText: [], empty: [] });
  assert.ok(textEntries("enemies.json", src).has("[b].nameAcc"));
  assert.deepEqual(checkOverlay("enemies.json", src, { "[b].name": tr("Bandyta", "Bandit"), "[b].nameAcc": tr("Bandytę", "the bandit") }).orphan, []);
});

// Strings flagged by the coverage test that are not player text, keyed by "<file> <path>". Each needs a reason.
const PROSE_EXCEPTIONS = new Map([
  // (none today: every flagged string in data/ sits under a TEXT_KEYS field)
]);

function dataFiles(dir = fileURLToPath(DATA), rel = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((f) => {
    const r = rel ? `${rel}/${f.name}` : f.name;
    if (f.isDirectory()) return ["art", "maps", "lang"].includes(r) ? [] : dataFiles(path.join(dir, f.name), r);
    return f.name.endsWith(".json") ? [r] : [];
  });
}

test("każdy tekst z prozą w danych leży pod kluczem z TEXT_KEYS, a ścieżki są jednoznaczne", () => {
  // Prose: a space and at least 3 letters. Also any Polish diacritic, so a single word like "Bandyty" under a new key is caught.
  const flagged = (s) => (s.includes(" ") && (s.match(/\p{L}/gu) ?? []).length >= 3) || /[ąćęłńóśźż]/i.test(s);
  const BAD_SEGMENT = /[.[\]]|^#/;
  const files = dataFiles();
  assert.ok(files.includes("items.json") && files.some((f) => f.startsWith("dialogues/")));
  assert.ok(!files.some((f) => f.startsWith("lang/")));
  const uncovered = [], badSegments = [], dupPaths = [], wrongPaths = [];
  let total = 0;
  for (const file of files) {
    const json = JSON.parse(readFileSync(new URL(file, DATA), "utf8"));
    const ui = file === "ui.json";
    // Tag every string (ids stay, they shape the paths) so coverage is checked by position, not by equal text.
    // The walk also builds each position's path by the overlay convention, independently of overlay.js.
    const originals = [], seen = new Set();
    const at = (p, seg) => (p === "" ? seg : `${p}.${seg}`);
    const tag = (v, key, p) => {
      if (p !== "") { if (seen.has(p)) dupPaths.push(`${file} ${p}`); seen.add(p); }
      if (typeof v === "string") return key === "id" ? v : (originals.push({ s: v, p }), `\u0000${originals.length - 1}`);
      if (Array.isArray(v)) {
        return v.map((x, i) => {
          const id = x && typeof x === "object" && !Array.isArray(x) ? x.id : undefined;
          if (typeof id === "string" && BAD_SEGMENT.test(id)) badSegments.push(`${file} ${p} id ${id}`);
          return tag(x, key, at(p, typeof id === "string" || typeof id === "number" ? `[${id}]` : `#${i}`));
        });
      }
      if (v && typeof v === "object") {
        return Object.fromEntries(Object.entries(v).map(([k, x]) => {
          if (!ui && BAD_SEGMENT.test(k)) badSegments.push(`${file} ${p} key ${k}`);
          return [k, tag(x, k, at(p, k))];
        }));
      }
      return v;
    };
    const entries = textEntries(file, tag(json, "", ""));
    total += entries.size;
    const covered = new Set();
    for (const [p, marker] of entries) {
      const o = originals[Number(marker.slice(1))];
      covered.add(marker);
      if (!o || o.p !== p) wrongPaths.push(`${file} ${p}`);
    }
    originals.forEach(({ s, p }, i) => {
      if (flagged(s) && !covered.has(`\u0000${i}`) && !PROSE_EXCEPTIONS.has(`${file} ${p}`)) uncovered.push(`${file} ${p}: ${s.slice(0, 60)}`);
    });
  }
  assert.deepEqual(badSegments, []);
  assert.deepEqual(dupPaths, []);
  assert.deepEqual(wrongPaths, []);
  assert.deepEqual(uncovered, []);
  assert.ok(total > 4000, `za mało tekstów: ${total}`);
  for (const k of ["name", "nameAcc", "description", "text", "title", "label"]) assert.ok(TEXT_KEYS.includes(k), k);
});
