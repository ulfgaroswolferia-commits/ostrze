import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, validateData } from "../src/engine/data.js";
import { readFileSync } from "node:fs";

const data = await loadData();
const strings = [];
const walk = (o, where) => {
  if (typeof o === "string") strings.push([where, o]);
  else if (Array.isArray(o)) o.forEach((x) => walk(x, where));
  else if (o && typeof o === "object") for (const v of Object.values(o)) walk(v, where);
};
walk(data.travel, "travel");
walk(data.story, "story");
walk(data.dialogues, "dialogues");

test("treść: powracające kwestie NPC nie powtarzają szablonów („Spać nie możesz, psia mać?”, „znajdź sobie zajęcie”, „muszę się podrapać”)", () => {
  const banned = [/Spać (pan )?nie możesz/i, /znajdź sobie zajęcie/i, /muszę się podrapać/i, /nie mam teraz czasu/i];
  const hits = strings.filter(([, s]) => banned.some((re) => re.test(s))).map(([w, s]) => `${w}: ${s.slice(0, 70)}`);
  assert.deepEqual(hits, []);
});

test("treść: żadne dwie sceny pogadanek (travel) nie mają identycznego tekstu", () => {
  const seen = new Map();
  const dups = [];
  for (const [, s] of strings.filter(([w]) => w === "travel" && /^[„A-ZĄĆĘŁŃÓŚŹŻ]/.test("")).concat([])) void s;
  for (const loc of data.travel.locations) for (const spot of loc.spots ?? []) for (const sc of spot.scenes ?? []) {
    if (sc.type !== "narration" || !sc.text || sc.text.length < 40) continue;
    if (seen.has(sc.text)) dups.push(`${seen.get(sc.text)} = ${sc.id}`);
    else seen.set(sc.text, sc.id);
  }
  assert.deepEqual(dups, []);
});

test("treść: Istota mówi o sobie w rodzaju żeńskim we wszystkich aktach (bez „spodziewałem się”, „ostrzegałem”)", () => {
  const speakers = data.dialogues.filter((d) => ["brygida", "echo_istoty"].includes(d.id));
  const text = JSON.stringify(speakers.flatMap((d) => Object.values(d.nodes).filter((n) => /Głos z/.test(n.speaker ?? ""))));
  assert.doesNotMatch(text, /spodziewałem|ostrzegałem|zapisałem|zaciągnąłem/);
});

test("treść: opcje graczy nie używają niejasnego „Zapamiętam ci to”", () => {
  const options = data.dialogues.flatMap((d) => Object.values(d.nodes).flatMap((n) => n.options ?? [])).map((o) => o.text);
  assert.deepEqual(options.filter((t) => /Zapamiętam ci to/.test(t)), []);
  assert.deepEqual(validateData(data), []);
});

test("treść: imiona postaci mówiących nie powtarzają się dla różnych osób (Jaga wdowa ≠ zielarka)", () => {
  const speakers = new Set(data.dialogues.flatMap((d) => Object.values(d.nodes).map((n) => n.speaker)).filter(Boolean));
  assert.ok(!speakers.has("Zielarka Jaga"));
  assert.ok([...speakers].filter((s) => /Jaga$/.test(s)).length <= 1);
});

test("treść: Smyk, Hjalmar, siostra Jadwiga i kapitan Wars mają osobne powitanie przy powrocie", () => {
  for (const id of ["smyk", "hjalmar", "siostra_domu_ciszy", "kapitan_przystani"]) {
    const d = JSON.parse(readFileSync(new URL(`../data/dialogues/${id}.json`, import.meta.url), "utf8"));
    assert.ok(d.returnStart, `${id}: brak returnStart`);
    assert.notEqual(d.nodes[d.returnStart].text, d.nodes[d.start].text, id);
    const { text: _a, ...start } = d.nodes[d.start];
    const { text: _b, ...back } = d.nodes[d.returnStart];
    assert.deepEqual(back, start, `${id}: węzeł powrotny różni się od startowego czymś innym niż tekst`);
    const toStart = Object.entries(d.nodes).filter(([k]) => k !== d.start && k !== d.returnStart)
      .filter(([, n]) => (n.options ?? []).some((o) => [o.goto, o.success, o.failure].includes(d.start))).map(([k]) => k);
    assert.deepEqual(toStart, [], `${id}: podtematy wracają do powitania pierwszej wizyty`);
  }
});

walk(data.enemies, "enemies");
test("treść: brak anachronizmów i zakazanych fraz w tekstach gry", () => {
  const banned = /żadnego sprzeczności|go nie zaprzecza|bardziej cię boję|do ocenienia|Z studni|szrapnel|\bfacet|kontakt wzrokowy|opłata manipulacyjna|adwokat|zarząd portu|\bpozew/i;
  const hits = strings.filter(([, s]) => banned.test(s)).map(([w, s]) => `${w}: ${s.match(banned)[0]}`);
  assert.deepEqual(hits, []);
});

test("treść: wróg miejski nazywa się Strażnik miejski, nie „Patrol”", () => {
  const e = data.enemies.find((x) => x.id === "patrol_miejski");
  assert.equal(e.name, "Strażnik miejski");
});

test("treść: opis po wygranej walce nie twierdzi, że ktoś uciekł, bo gracz mógł zabić wszystkich", () => {
  const claims = /Drugi zniknął w tłumie|a drugi wyrywa w las|rzuca rusznicę i ucieka|Wilki uciekają w mrok/;
  const hits = strings.filter(([, s]) => claims.test(s)).map(([w, s]) => `${w}: ${s.slice(0, 60)}`);
  assert.deepEqual(hits, []);
});
