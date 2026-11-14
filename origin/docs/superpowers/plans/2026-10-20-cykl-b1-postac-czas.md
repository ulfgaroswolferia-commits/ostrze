# Cykl B1 – postać, zmienne, czas, widżet wyboru – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kreator postaci sterowany strzałkami, `getStats` ze źródłami modyfikatorów, awans z perkami, czas z porami doby i odpoczynkiem, ukryte zmienne `wola`/`dlug`, zapis v2 – grywalne w demo.

**Architecture:** Czyste systemy w `src/systems/` (modifiers, stats, character, vars) i rozszerzone `src/engine/` (conditions, time, save, loop) – bez importów z `src/ui/` (poza istniejącym wyjątkiem `loop.js`). UI: jeden widżet wyboru `src/ui/menu.js` nad nowym `io.readKey()`, z trybem „numer + Enter” bez TTY. Nowe sceny w `src/scenes/`, hak po scenie w `src/scenes/after.js`.

**Tech Stack:** Node.js ≥ 22, ESM, JSDoc, `node:test`, `node:readline` (`emitKeypressEvents`), zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-20-cykl-b1-postac-czas-design.md` (tło: `docs/koncepcja-gry.md` v2, rozdziały 4, 9, 14, 15).

## Global Constraints

- Bez zależności npm; `engines.node >= 22`.
- Kod i nazwy techniczne po angielsku; teksty dla gracza tylko w `data/ui.json` (komunikaty walidatora po polsku w kodzie dozwolone).
- `src/engine/*` (poza `loop.js`) i `src/systems/*` nie importują `src/ui/`.
- `id` w danych: `^[a-z0-9_]+$`. Format błędu danych: `plik › id › pole: opis`.
- Wszystkie liczby balansu w `data/rules.json` (wartości dokładnie jak w sekcji „`data/rules.json`” specyfikacji B1).
- `SAVE_FORMAT_VERSION = 2` (w `src/config.js`); migracja v1 → v2 dopisuje `vars: {}`.
- Progi XP: poziom 2/3/4/5 przy 150/450/900/1500 łącznego XP; punkty umiejętności na awans `3 + floor(rozum / 2)`; perk co 2 poziomy; maks. 6 perków.
- Kreator: atrybuty start 5, `rozum` +1 (dar, poza pulą), pula 5, zakres 2–10, 3 umiejętności wiodące (1 z klasy), +20 dla wiodących, wiodące +2 za punkt.
- Każdy test izoluje `OSTRZE_HOME` / `OSTRZE_DATA` i przywraca je po sobie.
- Każdy commit kończy się linią `Co-Authored-By: <model, który faktycznie pisał kod> <noreply@anthropic.com>`.

## Review Focus

1. Ctrl+C lub błąd w trakcie menu/suwaków w trybie surowym – terminal musi wrócić do trybu normalnego (Task 7: test atrapy `setRawMode`, ostatnie wywołanie `false` po `close()` i po `InterruptError`).
2. Wąski terminal (np. 40 kolumn) – etykiety menu dłuższe niż szerokość łamałyby przerysowanie kursorem; menu przycina etykiety do `io.columns - 4` z „…” (Task 8: test).
3. Awans bez żadnego dostępnego perka – gracz nie może utknąć; perk przepada z komunikatem (Task 11: test).
4. Wszystkie umiejętności na limicie przy awansie – budżetu nie da się wydać; „Gotowe” musi być dostępne, gdy żaden wiersz nie może wzrosnąć (Task 8: test suwaków, Task 11 korzysta).
5. Wczytanie zapisu zrobionego w trakcie kreatora (`character === null`, scena kreatora) – kreator startuje od nowa bez błędów (Task 12: e2e).

---

## File Structure

```
data/attributes.json, skills.json, classes.json, perks.json   nowe dane
data/rules.json, ui.json, story.json                          rozszerzone / nowe demo
src/config.js                     SAVE_FORMAT_VERSION = 2
src/systems/modifiers.js          katalog i sumowanie modyfikatorów
src/systems/stats.js              getStats + STAT_SOURCES
src/systems/character.js          kreator, XP, awans, perki
src/systems/vars.js               addVar
src/engine/data.js                ładowanie nowych plików + walidacja
src/engine/conditions.js          warunek var
src/engine/time.js                timeOfDay, advanceTime, HOURLY_HOOKS
src/engine/state.js               vars: {}
src/engine/save.js                v2, migracja, schemat postaci
src/engine/loop.js                advanceTime + afterScene
src/ui/io.js                      readKey (terminal + scripted tty)
src/ui/menu.js                    select, multiSelect, sliders, textInput
src/ui/character_screen.js        renderCharacter, showCharacter
src/ui/screen.js                  statusBar(state, data, opts)
src/ui/prompt.js                  pressEnter z [P] postać
src/scenes/schemas.js, index.js   nowe typy scen
src/scenes/var.js, reward.js, character_creation.js, rest.js, after.js, errors.js
src/app.js                        MissingCharacterError → komunikat i menu
test/*.test.js, test/helpers.js
```

---

### Task 1: Nowe pliki danych i ich walidacja kształtu

**Files:**
- Create: `data/attributes.json`, `data/skills.json`, `data/classes.json`, `data/perks.json`
- Modify: `data/rules.json`, `src/engine/data.js`, `test/helpers.js`
- Test: `test/data.test.js`

**Interfaces:**
- Produces:
  - `loadData(dir?) → GameData` czyta w kolejności: `ui.json`, `rules.json`, `attributes.json`, `skills.json`, `classes.json`, `perks.json`, `story.json`; `GameData = { ui, rules, attributes, skills, classes, perks, story }` (zamrożone).
  - `minimalData(overrides)` – wszystkie pliki poza `story` czytane z prawdziwego `data/`.
  - Kształty: `attributes[] = { id, name, description }`; `skills[] = { id, name, primary, secondary }`; `classes[] = { id, name, description, taggedSkill, modifiers? }`; `perks[] = { id, name, description, requires: { level?, attributes?, skills? }, modifiers?, unlocks? }`.
- Treść plików: dokładnie tabele specyfikacji B1 (sekcja „Dane”); opisy perków i klas po polsku, 1 zdanie, w stylu „Styl i ton”. `rules.json` – dokładnie blok JSON ze specyfikacji B1.

Reguły walidacji (prefiks pliku, `id` rekordu albo `#indeks`):
- Każdy plik: tablica, unikalne `id` (`attributes.json › sila: zduplikowane id`), schemat rekordu (`additional: false`).
- `skills.json › <id> › primary: nieznany atrybut "x"` (też `secondary`).
- `classes.json › <id> › taggedSkill: nieznana umiejętność "x"`.
- `perks.json › <id> › requires.attributes.x: nieznany atrybut "x"`, `requires.skills.x: nieznana umiejętność "x"`, `requires.level` liczba całkowita ≥ 2.
- `rules.json` – pełny schemat z `additional: false` na każdym poziomie obiektów; `rules.json › vars: zduplikowana zmienna "x"`.
- (Modyfikatory, `unlocks`, pokrycie pór doby – Task 2.)

- [ ] **Step 1: Write failing tests**

```js
test("prawdziwe data/ przechodzi walidację i ma nowe pliki", async () => {
  const d = await loadData();
  assert.deepEqual(validateData(d), []);
  assert.deepEqual(d.attributes.map((a) => a.id), ["sila", "zrecznosc", "krzepa", "bystrosc", "rozum", "oglada", "fart"]);
  assert.equal(d.skills.length, 11); assert.equal(d.perks.length, 17);
  assert.deepEqual(d.classes.map((c) => [c.id, c.taggedSkill]), [["miecz", "sieczna"], ["wlocznia", "drzewcowa"]]);
  assert.equal(d.rules.leveling.xpStep, 150); assert.deepEqual(d.rules.creator.gifts, { rozum: 1 });
});
test("błędy odwołań w nowych plikach", () => {
  const d = structuredClone(minimalData());
  d.skills[0].primary = "sial"; d.classes[0].taggedSkill = "brak";
  d.perks[0].requires = { attributes: { mocarz: 5 }, skills: { lucznictwo: 10 } };
  d.attributes.push({ ...d.attributes[0] }); d.rules.vars = ["wola", "wola"];
  const errs = validateData(d);
  for (const e of [
    'skills.json › sieczna › primary: nieznany atrybut "sial"',
    'classes.json › miecz › taggedSkill: nieznana umiejętność "brak"',
    'perks.json › szkola_miecza › requires.attributes.mocarz: nieznany atrybut "mocarz"',
    'perks.json › szkola_miecza › requires.skills.lucznictwo: nieznana umiejętność "lucznictwo"',
    "attributes.json › sila: zduplikowane id",
    'rules.json › vars: zduplikowana zmienna "wola"',
  ]) assert.ok(errs.includes(e), `brak: ${e}\n${errs.join("\n")}`);
});
test("brak pliku perks.json → DataLoadError z nazwą pliku", async () => { /* kopia data/ bez perks.json */ });
```

- [ ] **Step 2: Run `node --test test/data.test.js` – FAIL.**
- [ ] **Step 3: Implement** pliki danych, `loadData`, schematy i reguły w `data.js`, `minimalData`.
- [ ] **Step 4: Run `npm test` – PASS** (istniejące testy nadal zielone).
- [ ] **Step 5: Commit** `feat: dane atrybutów, umiejętności, klas i perków`.

---

### Task 2: Katalog modyfikatorów

**Files:**
- Create: `src/systems/modifiers.js`
- Modify: `src/engine/data.js`
- Test: `test/modifiers.test.js`, `test/data.test.js`

**Interfaces:**
- Consumes: `GameData` (Task 1).
- Produces:
  - `DAMAGE_TYPES = ["sieczne", "klute", "obuchowe", "ogien", "palne"]`.
  - `NUMERIC_KEYS = ["hpMax", "ap", "defense", "initiative", "carry", "hitChance", "meleeHitChance", "rangedHitChance", "damage", "critChance", "fleeChance"]`.
  - `isModifierKey(key, data): boolean` – atrybut, umiejętność, `NUMERIC_KEYS`, `resist_<id>`, `effectDuration_<id>` (`<id>` pasuje do `^[a-z0-9_]+$`), `extraDamage`, `damageTaken`.
  - `validateModifiers(mods, path, data): string[]` – `${path}.${key}: nieznany modyfikator`; wartości liczbowe (liczby skończone) poza `extraDamage` = `{ type: DAMAGE_TYPE, amount: [int, int] (min ≤ max) }` i `damageTaken` = `{ DAMAGE_TYPE: liczba ≥ 0 }`.
  - `emptyTotals(): Totals`, `addModifiers(totals, mods): Totals` – liczby sumowane; `damageTaken` mnożone per typ; `extraDamage` zbierane do tablicy. `Totals = { numbers: Record<string, number>, damageTaken: Record<string, number>, extraDamage: Array<{type, amount}> }`.
- `validateData` dodaje: `modifiers` klas, perków i `rules.timeOfDay[i].modifiers` (ścieżka `classes.json › miecz › modifiers.bystrsoc: nieznany modyfikator`, `rules.json › timeOfDay[3].modifiers.x: …`); `perks.json › <id> › unlocks[0]: nieznane odblokowanie "x"` (lista `rules.unlocks`); pokrycie godzin pór doby: każda godzina 0–23 dokładnie raz (`from < to` → `from…to-1`, `from > to` → zawija przez północ) – `rules.json › timeOfDay: godzina 5 nie jest pokryta` / `rules.json › timeOfDay: godzina 6 pokryta wielokrotnie`.

- [ ] **Step 1: Write failing tests**

```js
test("isModifierKey", () => {
  for (const k of ["sila", "sieczna", "ap", "resist_strach", "effectDuration_strach", "extraDamage", "damageTaken"])
    assert.equal(isModifierKey(k, data), true, k);
  for (const k of ["bystrsoc", "resist_", "Ap"]) assert.equal(isModifierKey(k, data), false, k);
});
test("validateModifiers", () => {
  assert.deepEqual(validateModifiers({ ap: 1, extraDamage: { type: "ogien", amount: [2, 4] }, damageTaken: { sieczne: 0.5 } }, "m", data), []);
  assert.deepEqual(validateModifiers({ bystrsoc: 1 }, "m", data), ["m.bystrsoc: nieznany modyfikator"]);
  assert.deepEqual(validateModifiers({ ap: "1" }, "m", data), ["m.ap: oczekiwano liczby"]);
  assert.ok(validateModifiers({ extraDamage: { type: "lod", amount: [4, 2] } }, "m", data).length >= 2);
});
test("addModifiers sumuje liczby, mnoży damageTaken, zbiera extraDamage", () => {
  let t = addModifiers(emptyTotals(), { ap: 1, damageTaken: { sieczne: 0.5 }, extraDamage: { type: "ogien", amount: [1, 2] } });
  t = addModifiers(t, { ap: 2, damageTaken: { sieczne: 0.5 } });
  assert.equal(t.numbers.ap, 3); assert.equal(t.damageTaken.sieczne, 0.25); assert.equal(t.extraDamage.length, 1);
});
// test/data.test.js
test("walidacja modyfikatorów, unlocks i pokrycia pór doby", () => {
  const d = structuredClone(minimalData());
  d.classes[0].modifiers = { bystrsoc: 1 }; d.perks.find((p) => p.id === "finta").unlocks = ["fintaa"];
  d.rules.timeOfDay[0].from = 6; // swit 6–7: godzina 5 niepokryta
  const errs = validateData(d);
  for (const e of ["classes.json › miecz › modifiers.bystrsoc: nieznany modyfikator",
    'perks.json › finta › unlocks[0]: nieznane odblokowanie "fintaa"', "rules.json › timeOfDay: godzina 5 nie jest pokryta"])
    assert.ok(errs.includes(e), `brak: ${e}\n${errs.join("\n")}`);
});
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Commit** `feat: katalog modyfikatorów i ich walidacja`.

---

### Task 3: Zmienne `wola` / `dlug`, scena `var`, zapis v2

**Files:**
- Create: `src/systems/vars.js`, `src/scenes/var.js`
- Modify: `src/engine/conditions.js`, `src/engine/data.js`, `src/scenes/schemas.js`, `src/scenes/index.js`, `src/engine/state.js`, `src/engine/save.js`, `src/config.js`
- Test: `test/conditions.test.js`, `test/vars.test.js`, `test/save.test.js`, `test/data.test.js`, `test/scenes.test.js`

**Interfaces:**
- Consumes: `validateCondition`, `evaluate` (cykl A), `SCENE_TYPES`.
- Produces:
  - `evaluate(cond, state)` obsługuje `{ var, gte|lte|eq }` (`state.vars?.[name] ?? 0`).
  - `validateCondition(cond, path, opts = {})`, `opts.vars?: string[]` – `${path}.var: nieznana zmienna "x"` (tylko gdy `opts.vars` podane), `${path}: warunek var wymaga dokładnie jednego z gte/lte/eq`, `${path}.gte: oczekiwano liczby całkowitej`, `var` musi być tekstem. `data.js` przekazuje `{ vars: rules.vars }`.
  - `addVar(state, changes: Record<string, number>): void` – `state.vars ??= {}`, dodaje.
  - Scena `var`: schemat `scene(["add"], { add: { type: "object", values: { type: "integer" } } })`; walidacja nazw: `story.json › <id> › add.x: nieznana zmienna "x"`; handler `var` wywołuje `addVar`, nic nie wypisuje.
  - `createNewState` dodaje `vars: {}`; `SAVE_FORMAT_VERSION = 2`; `migrations[1] = (s) => ({ ...s, version: 2, vars: {} })`; `STATE_SCHEMA` wymaga `vars` (wartości całkowite).

- [ ] **Step 1: Write failing tests**

```js
test("var gte/lte/eq i brak zmiennej = 0", () => {
  const s = { flags: {}, vars: { wola: 2 } };
  assert.equal(evaluate({ var: "wola", gte: 2 }, s), true); assert.equal(evaluate({ var: "wola", lte: 1 }, s), false);
  assert.equal(evaluate({ var: "dlug", eq: 0 }, s), true); assert.equal(evaluate({ var: "dlug", gte: 1 }, { flags: {} }), false);
});
test("validateCondition var", () => {
  const o = { vars: ["wola", "dlug"] };
  assert.deepEqual(validateCondition({ var: "wola", gte: 1 }, "if", o), []);
  assert.deepEqual(validateCondition({ var: "zlosc", gte: 1 }, "if", o), ['if.var: nieznana zmienna "zlosc"']);
  assert.deepEqual(validateCondition({ var: "wola", gte: 1, lte: 3 }, "if", o), ["if: warunek var wymaga dokładnie jednego z gte/lte/eq"]);
  assert.deepEqual(validateCondition({ var: "wola", gte: 1.5 }, "if", o), ["if.gte: oczekiwano liczby całkowitej"]);
  assert.deepEqual(validateCondition({ all: [{ var: "x", eq: 0 }] }, "if", o), ['if.all[0].var: nieznana zmienna "x"']);
});
test("addVar", () => { const s = {}; addVar(s, { wola: 1 }); addVar(s, { wola: 2, dlug: -1 }); assert.deepEqual(s.vars, { wola: 3, dlug: -1 }); });
test("scena var zmienia zmienne bez wejścia", async () => { /* ctx ze scripted IO bez wejść; var { add: { dlug: 1 } } → state.vars.dlug === 1 */ });
test("zapis v1 migruje do v2 z vars: {}", async () => {
  // zapisz ręcznie plik slotu z version: 1 (stan jak w cyklu A, bez vars, scene.id istniejące w minimalData)
  const s = await loadGame("1", minimalData()); assert.equal(s.version, 2); assert.deepEqual(s.vars, {});
});
test("walidacja nazw zmiennych w scenie var i warunku if", () => { /* add.zlosc i if var zlosc → oba komunikaty z prefiksem story.json › id */ });
```
Zaktualizuj istniejące testy oczekujące `version: 1` (np. `createNewState`) na `2`.

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Commit** `feat: zmienne liczbowe wola/dlug, scena var, zapis v2`.

---

### Task 4: Czas – pory doby i `advanceTime`

**Files:**
- Modify: `src/engine/time.js`, `src/engine/loop.js`, `data/ui.json`
- Test: `test/time.test.js`, `test/loop.test.js`

**Interfaces:**
- Consumes: `rules.timeOfDay` (Task 1), `pushNotice` (cykl A), `t`.
- Produces:
  - `timeOfDay(minutes: number, rules): string` – id pory dla godziny `clockOf(minutes).hour`.
  - `HOURLY_HOOKS: Array<(state, data, atMinutes) => Event[]>` – eksportowana, pusta tablica.
  - `advanceTime(state, minutes: number, data): Event[]` – algorytm: dopóki zostało czasu, krok = `min(pozostało, minuty do następnej pełnej godziny)`; po kroku, jeśli `time.minutes % 60 === 0`: porównaj porę przed/po kroku → `{ type: "zmiana_pory", to, at }`; dopisz wyniki `HOURLY_HOOKS`.
  - `loop.js`: zamiast `state.time.minutes += scene.time` → `advanceTime(...)`; każde zdarzenie `zmiana_pory` → `pushNotice(ctx, paint("dim", t(ctx.data.ui, \`time.change.${e.to}\`)))`.
  - `ui.json`: `time.swit` „świt”, `time.dzien` „dzień”, `time.zmierzch` „zmierzch”, `time.noc` „noc”; `time.change.swit` „Świta.”, `time.change.dzien` „Nastał dzień.”, `time.change.zmierzch` „Zapada zmierzch.”, `time.change.noc` „Zapadła noc.”.

- [ ] **Step 1: Write failing tests**

```js
const R = minimalData().rules; const at = (h, m = 0) => h * 60 + m;
test("timeOfDay na granicach", () => {
  const cases = [[at(4, 59), "noc"], [at(5), "swit"], [at(6, 59), "swit"], [at(7), "dzien"], [at(17, 59), "dzien"],
    [at(18), "zmierzch"], [at(19, 59), "zmierzch"], [at(20), "noc"], [at(0), "noc"], [1440 + at(5), "swit"]];
  for (const [m, id] of cases) assert.equal(timeOfDay(m, R), id, String(m));
});
test("10 × 6 minut = 60 minut (te same zdarzenia)", () => {
  const a = { time: { minutes: at(17, 30) } }, b = { time: { minutes: at(17, 30) } };
  const ea = Array.from({ length: 10 }, () => advanceTime(a, 6, minimalData())).flat();
  assert.deepEqual(ea, advanceTime(b, 60, minimalData())); assert.equal(a.time.minutes, b.time.minutes);
  assert.deepEqual(ea.map((e) => e.to), ["zmierzch"]);
});
test("8 h od 22:00 → świt o 5:00; 24 h → 4 zmiany", () => {
  const s = { time: { minutes: at(22) } };
  assert.deepEqual(advanceTime(s, 480, minimalData()), [{ type: "zmiana_pory", to: "swit", at: 1440 + at(5) }]);
  assert.equal(advanceTime({ time: { minutes: at(6) } }, 1440, minimalData()).length, 4);
});
test("hook godzinowy wołany na każdej pełnej godzinie", () => { /* push hooka do HOURLY_HOOKS, 150 min od 6:30 → 3 wywołania (7,8,9), usuń hook w finally */ });
// test/loop.test.js
test("scene.time przez advanceTime → notatka o zmianie pory", async () => { /* scena time 60 o 17:30 → ctx.notices zawiera "Zapada zmierzch." */ });
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Commit** `feat: pory doby i advanceTime`.

---

### Task 5: `getStats` ze źródłami modyfikatorów

**Files:**
- Create: `src/systems/stats.js`
- Test: `test/stats.test.js`

**Interfaces:**
- Consumes: `emptyTotals`, `addModifiers` (Task 2), `timeOfDay` (Task 4), `GameData`.
- Produces:
  - `Source = { source: { kind: "class" | "perk" | "timeOfDay", id: string }, modifiers: object, permanent: boolean }`.
  - `STAT_SOURCES: Array<(state, data) => Source[]>` – kolejno: klasa (`permanent: true`), perki (każdy osobno, `true`), pora doby (`false`; `modifiers` z `rules.timeOfDay` + dla umiejętności z `primary`/`secondary` = `bystrosc` wartość `bystroscSkillPenalty`, jeśli pora ją ma).
  - `getStats(state, data, opts = {}): Stats`; `opts.permanentOnly` pomija źródła `permanent: false`. Rzuca `Error`, gdy `state.character` jest `null`.
  - `Stats` – jak w specyfikacji B1 (sekcja „Typy”), `breakdown[key] = [{ source: { kind: "base" } , value }, { source, value }, …]` dla atrybutów, umiejętności i `NUMERIC_KEYS`; `timeOfDay: id`.
- Kolejność liczenia (z specyfikacji „Wzory”): atrybuty końcowe = baza + wszystkie źródła; baza umiejętności liczona z atrybutów „bazowe + źródła permanent” (bez pory doby); pochodne z atrybutów końcowych; limit umiejętności 0…`rules.skills.max`.

- [ ] **Step 1: Write failing tests** (`char(overrides)` – helper tworzący `state = { character: { name: "T", classId: "miecz", level: 1, xp: 0, attributes: { sila: 5, zrecznosc: 5, krzepa: 5, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 }, skillPoints: {}, tagged: ["sieczna", "wymowa", "medycyna"], perks: [], pendingLevelUp: null, hp: 35, ...overrides }, time: { minutes: 12 * 60 } }`)

```js
test("umiejętności bazowe i wiodące", () => {
  const s = getStats(char(), data);
  assert.equal(s.skills.drzewcowa, 15); assert.equal(s.skills.sieczna, 35);
  assert.equal(s.skills.wymowa, 2 * 5 + 6 + 20); // oglada + rozum
});
test("punkty umiejętności: wiodąca ×2, zwykła ×1, limit 100", () => {
  const s = getStats(char({ skillPoints: { sieczna: 5, drzewcowa: 5, wrecz: 200 } }), data);
  assert.equal(s.skills.sieczna, 45); assert.equal(s.skills.drzewcowa, 20); assert.equal(s.skills.wrecz, 100);
});
test("pochodne", () => {
  const s = getStats(char(), data).derived;
  assert.deepEqual([s.hpMax, s.ap, s.carry, s.defense, s.initiative, s.critChance], [35, 7, 75, 10, 10, 5]);
  assert.equal(getStats(char({ level: 2 }), data).derived.hpMax, 39);
});
test("noc: rangedHitChance −15, umiejętności z Bystrością −15, skradanie +10; permanentOnly pomija porę", () => {
  const night = char(); night.time.minutes = 23 * 60;
  const s = getStats(night, data);
  assert.equal(s.timeOfDay, "noc"); assert.equal(s.derived.rangedHitChance, -15);
  assert.equal(s.skills.strzelecka, 15 - 15); assert.equal(s.skills.skradanie, 15 - 15 + 10);
  assert.equal(getStats(night, data, { permanentOnly: true }).skills.strzelecka, 15);
});
test("perk zmieniający atrybut przelicza umiejętności; rozbicie na źródła", () => {
  const s = getStats(char({ perks: ["szczesciarz"], level: 4 }), data);
  assert.equal(s.attributes.fart, 6); assert.equal(s.skills.wiedza_tajemna, 2 * 6 + 6);
  assert.deepEqual(s.breakdown.fart, [{ source: { kind: "base" }, value: 5 }, { source: { kind: "perk", id: "szczesciarz" }, value: 1 }]);
});
test("brak postaci → Error", () => assert.throws(() => getStats({ character: null, time: { minutes: 0 } }, data)));
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run – PASS.**
- [ ] **Step 5: Commit** `feat: getStats ze źródłami modyfikatorów`.

---

### Task 6: Postać – kreator, XP, awans, perki; zapis postaci

**Files:**
- Create: `src/systems/character.js`
- Modify: `src/engine/save.js`
- Test: `test/character.test.js`, `test/save.test.js`

**Interfaces:**
- Consumes: `getStats` (Task 5), `GameData`.
- Produces:
  - `creatorStartAttributes(data): Record<id, number>` – start + `gifts`.
  - `validateCreatorChoices({ name, classId, attributes, tagged }, data): string[]` – komunikaty (dla UI/testów, po polsku): pula niewydana lub przekroczona, atrybut poza 2–10, klasa nieznana, `tagged` ≠ 3 / bez umiejętności klasy / duplikaty / nieznane, imię poza długością albo `!/^[\p{L}][\p{L} -]*$/u`.
  - `createCharacter(choices, data): Character` – rzuca `Error(błędy.join("; "))`; `level 1`, `xp 0`, `skillPoints {}`, `perks []`, `pendingLevelUp null`, `hp = getStats(...).derived.hpMax`.
  - `xpToReach(level, rules): number` = `xpStep × (level − 1) × level / 2`.
  - `skillPointsPerLevel(character, rules): number` = `skillPointsBase + floor(attributes.rozum / skillPointsRozumDiv)`.
  - `addXp(character, amount, data): { levelsGained: number }` – mutuje `xp`, `level`, `pendingLevelUp` (sumuje `skillPoints` i `perks`; perk tylko na poziomie podzielnym przez `perkEveryLevels`, gdy `perks.length + pending.perks < maxPerks`).
  - `availablePerks(state, data): Array<{ perk, ok: boolean, missing: Array<{ kind: "attribute"|"skill"|"level"|"owned"|"limit", id?: string, need?: number, have?: number }> }>` – wymagania sprawdzane na `getStats(state, data, { permanentOnly: true })`.
  - `applyLevelUp(state, { skillPoints: Record<id, number>, perks: string[] }, data): void` – rzuca `Error`, gdy suma punktów ≠ `pending.skillPoints` (chyba że wszystkie umiejętności na limicie – wtedy dozwolona mniejsza suma), gdy umiejętność przekroczyłaby `rules.skills.max`, gdy liczba perków ≠ `pending.perks` (dozwolona mniejsza tylko jeśli brak perków `ok`), gdy perk niedostępny. Po sukcesie: `pendingLevelUp = null`, `hp = hpMax` (po zmianach).
  - `save.js`: `STATE_SCHEMA.character` – `null` albo obiekt (wymagane pola `Character`, typy); `loadGame` po schemacie: `LoadError('nieznana klasa "x"')`, `LoadError('nieznany perk "x"')`.

- [ ] **Step 1: Write failing tests**

```js
const attrs = (over) => ({ ...creatorStartAttributes(data), ...over }); // start: 5…, rozum 6
const ok = { name: "Thorgniew", classId: "miecz", attributes: attrs({ sila: 7, zrecznosc: 6, krzepa: 7 }), tagged: ["sieczna", "wymowa", "medycyna"] };
test("start z darem Rozumu", () => assert.equal(creatorStartAttributes(data).rozum, 6));
test("poprawny kreator", () => {
  assert.deepEqual(validateCreatorChoices(ok, data), []);
  const c = createCharacter(ok, data); assert.equal(c.level, 1); assert.equal(c.hp, 20 + 3 * 7);
});
test("błędy kreatora", () => {
  for (const bad of [{ attributes: attrs({ sila: 7 }) }, { attributes: attrs({ sila: 11, fart: 1, zrecznosc: 9 }) },
    { tagged: ["wymowa", "medycyna", "handel"] }, { tagged: ["sieczna", "sieczna", "wymowa"] }, { name: "X" }, { name: "R2D2" }, { classId: "luk" }])
    assert.ok(validateCreatorChoices({ ...ok, ...bad }, data).length > 0, JSON.stringify(bad));
  assert.throws(() => createCharacter({ ...ok, name: "X" }, data));
});
test("progi XP i punkty", () => {
  assert.deepEqual([2, 3, 4, 5].map((l) => xpToReach(l, data.rules)), [150, 450, 900, 1500]);
  const c = createCharacter(ok, data);
  assert.equal(skillPointsPerLevel(c, data.rules), 6);
  assert.deepEqual(addXp(c, 149, data), { levelsGained: 0 });
  assert.deepEqual(addXp(c, 1, data), { levelsGained: 1 }); assert.deepEqual(c.pendingLevelUp, { skillPoints: 6, perks: 1 });
});
test("kilka awansów naraz sumuje", () => {
  const c = createCharacter(ok, data); addXp(c, 900, data);
  assert.equal(c.level, 4); assert.deepEqual(c.pendingLevelUp, { skillPoints: 18, perks: 2 });
});
test("availablePerks: wymagania i braki", () => {
  const state = { character: createCharacter(ok, data), time: { minutes: 23 * 60 } };
  const byId = Object.fromEntries(availablePerks(state, data).map((p) => [p.perk.id, p]));
  assert.equal(byId.twarda_skora.ok, true); assert.equal(byId.sokole_oko.ok, false); // bystrosc 5 < 6 (noc nie wpływa)
  assert.deepEqual(byId.sokole_oko.missing, [{ kind: "attribute", id: "bystrosc", need: 6, have: 5 }]);
  assert.equal(byId.szczesciarz.missing[0].kind, "level");
});
test("applyLevelUp: rozdanie, perk, pełne leczenie, błędy", () => {
  const state = { character: createCharacter(ok, data), time: { minutes: 600 } };
  addXp(state.character, 150, data); state.character.hp = 1;
  assert.throws(() => applyLevelUp(state, { skillPoints: { sieczna: 5 }, perks: ["twarda_skora"] }, data)); // 5 ≠ 6
  assert.throws(() => applyLevelUp(state, { skillPoints: { sieczna: 6 }, perks: ["sokole_oko"] }, data)); // niedostępny
  applyLevelUp(state, { skillPoints: { sieczna: 4, wrecz: 2 }, perks: ["twarda_skora"] }, data);
  const c = state.character; assert.equal(c.pendingLevelUp, null); assert.deepEqual(c.perks, ["twarda_skora"]);
  assert.equal(c.hp, getStats(state, data).derived.hpMax);
});
test("limit 6 perków: przy 6 posiadanych awans nie daje perka", () => { /* character.perks = 6 dowolnych id, addXp do poziomu parzystego → pending.perks === 0 */ });
// test/save.test.js
test("nieznana klasa / perk w zapisie → LoadError", async () => { /* zapis z character.classId "luk" i perks ["brak"] */ });
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Commit** `feat: kreator, XP, awans i perki postaci`.

---

### Task 7: `io.readKey()`

**Files:**
- Modify: `src/ui/io.js`
- Test: `test/io.test.js`

**Interfaces:**
- Produces:
  - `Key = { name: "up"|"down"|"left"|"right"|"enter"|"escape"|"backspace"|"char", char?: string }`.
  - `createScriptedIO(inputs, { tty = false } = {})` – `isTTY = tty`; `readKey()` zużywa kolejny token: `"<up>" "<down>" "<left>" "<right>" "<enter>" "<esc>" "<backspace>"` → nazwa; `"^C"` → `InterruptError`; `"^D"` → `InputClosedError`; pojedynczy znak → `{ name: "char", char }`; inny token → `Error("nieznany token klawisza: …")`; wyczerpanie → `InputExhaustedError`. `ask` bez zmian (oba czytają z tej samej kolejki).
  - `createTerminalIO`: `readKey()` – tylko gdy `isTTY` (inaczej odrzuca `Error("readKey wymaga terminala")`); `readline.emitKeypressEvents(input)` raz; czeka na jedno zdarzenie `keypress` na `input`; mapowanie: `up/down/left/right/return(enter)/escape/backspace`, Ctrl+C → `InterruptError`, zwykły znak → `char`; po odczycie czyści bufor linii interfejsu readline (np. `rl.write(null, { ctrl: true, name: "u" })`), żeby wciśnięte klawisze nie trafiły do następnego `ask`; `close` w trakcie → `InputClosedError`. Tryb surowy: jeśli `input.setRawMode` istnieje, włączony na czas oczekiwania i **zawsze** wyłączony w `finally` oraz w `close()`.

- [ ] **Step 1: Write failing tests**

```js
test("scripted readKey: tokeny, znaki, ^C, wyczerpanie", async () => {
  const io = createScriptedIO(["<up>", "p", "<enter>", "^C"], { tty: true });
  assert.equal(io.isTTY, true);
  assert.deepEqual(await io.readKey(), { name: "up" }); assert.deepEqual(await io.readKey(), { name: "char", char: "p" });
  assert.deepEqual(await io.readKey(), { name: "enter" });
  await assert.rejects(io.readKey(), InterruptError); await assert.rejects(io.readKey(), InputExhaustedError);
});
function fakeTTY() { const input = new PassThrough(); input.isTTY = true; input.raw = []; input.setRawMode = (on) => { input.raw.push(on); }; const output = new PassThrough(); output.isTTY = true; output.columns = 80; return { input, output }; }
test("terminal readKey: strzałki i Enter, tryb surowy przywracany", async () => {
  const { input, output } = fakeTTY(); const io = createTerminalIO({ input, output });
  const p = io.readKey(); input.write("\x1b[A"); assert.deepEqual(await p, { name: "up" });
  const q = io.readKey(); input.write("\r"); assert.deepEqual(await q, { name: "enter" });
  io.close(); assert.equal(input.raw.at(-1), false);
});
test("terminal readKey: Ctrl+C → InterruptError i tryb surowy wyłączony", async () => {
  const { input, output } = fakeTTY(); const io = createTerminalIO({ input, output });
  const p = io.readKey(); input.write("\x03"); await assert.rejects(p, InterruptError);
  assert.equal(input.raw.at(-1), false); io.close();
});
test("terminal bez TTY: readKey odrzuca", async () => { /* PassThrough bez isTTY → rejects */ });
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Commit** `feat: odczyt pojedynczych klawiszy (readKey)`.

---

### Task 8: Widżet wyboru `menu.js`

**Files:**
- Create: `src/ui/menu.js`
- Modify: `data/ui.json`
- Test: `test/menu.test.js`

**Interfaces:**
- Consumes: `readKey`, `isTTY`, `ask`, `writeRaw`, `columns` (Task 7, cykl A), `t`, `paint`.
- Produces (tryb klawiszy gdy `io.isTTY`, inaczej tryb liniowy):
  - `select(io, ui, { title?, items: Array<{ label, hint?, disabled?, description? }>, initial? }): Promise<number>` – klawisze: ↑↓ (zawija, przeskakuje `disabled`), Enter (zwraca bieżący), cyfra 1–9 (zwraca, jeśli aktywna), `p`… ignorowane. Render: `▶ ` + `paint("title", label)` dla bieżącej, `  ` dla innych, `paint("dim", …)` dla `disabled`; `hint` po etykiecie; `description` bieżącej pod listą. Przerysowanie: `writeRaw("\x1b[<n>A\x1b[0J")` (n = liczba wierszy poprzedniego renderu). Etykiety przycinane do `io.columns - 4` z „…”. Tryb liniowy: wiersze `[n] etykieta` (+ ` ` + `t(ui,"menu.unavailable")` dla `disabled`), pytanie `prompt.choice`; zły numer → `prompt.invalid`; numer `disabled` → `t(ui,"menu.unavailable")` i ponów. Brak aktywnych pozycji → `Error`.
  - `multiSelect(io, ui, { title?, items: Array<{ label, hint?, locked?, checked? }>, count }): Promise<number[]>` – Enter przełącza bieżącą; cyfra (1–9; w trybie liniowym dowolny numer) **przesuwa kursor na pozycję i ją przełącza** (zablokowanych nie przełącza), ostatnia pozycja `t(ui,"menu.done")` aktywna tylko przy `count` zaznaczonych; zwraca posortowane indeksy zaznaczonych (z zablokowanymi). Zaznaczenie `[x]` / `[ ]`.
  - `sliders(io, ui, { title?, rows: Array<{ label, value, min, max, step = 1, note? }>, budget? }): Promise<number[]>` – ↑↓ wiersz (ostatni wiersz = „Gotowe”), → `value += step` gdy `value + step ≤ max` i (`budget` nieokreślony albo > 0) – wtedy `budget −= 1`; ← `value −= step` gdy `value − step ≥ min` – wtedy `budget += 1`; „Gotowe” aktywne gdy `budget` nieokreślony, `budget === 0`, albo żaden wiersz nie może wzrosnąć. Nagłówek `t(ui,"menu.budget",{ n })`. Tryb liniowy: wiersze `[n] etykieta wartość`, `[k] Gotowe`; wejście `N+`, `N-`, `N++`, `N---` (powtórzenia), numer „Gotowe”; inne → `t(ui,"menu.slidersHelp")`.
  - `textInput(io, ui, { prompt, min, max, pattern: RegExp, defaultValue? }): Promise<string>` – zawsze `io.ask`; `trim`; puste → `defaultValue` (jeśli jest); niepasujące → `t(ui,"input.invalid",{ min, max })` i ponów.
- `ui.json`: `menu.unavailable` „(niedostępne)”, `menu.done` „Gotowe”, `menu.budget` „Wolne punkty: {n}”, `menu.slidersHelp` „Wpisz numer i + lub − (np. 1+), albo numer „Gotowe”.”, `input.invalid` „Od {min} do {max} znaków: litery, spacja, myślnik.”.

- [ ] **Step 1: Write failing tests**

```js
const tty = (keys) => createScriptedIO(keys, { tty: true });
const items = [{ label: "A" }, { label: "B", disabled: true }, { label: "C" }];
test("select: ↓ przeskakuje wyszarzone, zawija, Enter", async () => {
  assert.equal(await select(tty(["<down>", "<enter>"]), UI, { items }), 2);
  assert.equal(await select(tty(["<down>", "<down>", "<enter>"]), UI, { items }), 0);
  assert.equal(await select(tty(["<up>", "<enter>"]), UI, { items }), 2);
});
test("select: cyfra jako skrót, wyszarzona cyfra ignorowana", async () =>
  assert.equal(await select(tty(["2", "3"]), UI, { items }), 2));
test("select bez TTY: numer, zły numer, wyszarzony", async () => {
  const io = createScriptedIO(["9", "2", "3"]);
  assert.equal(await select(io, UI, { items }), 2);
  assert.match(io.text(), /Wpisz liczbę od 1 do 3\./); assert.match(io.text(), /\(niedostępne\)/);
});
test("select przycina długie etykiety do szerokości", async () => {
  const io = tty(["<enter>"]); io.columns = 20;
  await select(io, UI, { items: [{ label: "x".repeat(50) }] });
  assert.ok(io.text().split("\n").every((l) => [...l].length <= 20));
});
test("multiSelect: zablokowana, przełączanie, Gotowe dopiero przy count", async () => {
  const its = [{ label: "Sieczna", locked: true, checked: true }, { label: "Wymowa" }, { label: "Medycyna" }, { label: "Handel" }];
  assert.deepEqual(await multiSelect(tty(["2", "3", "4", "4", "5"]), UI, { items: its, count: 3 }), [0, 1, 2]);
});
test("sliders: budżet, granice, Gotowe", async () => {
  const rows = [{ label: "Siła", value: 5, min: 2, max: 10 }, { label: "Fart", value: 5, min: 2, max: 10 }];
  const v = await sliders(tty(["<right>", "<right>", "<down>", "<left>", "<right>", "<right>", "<down>", "<enter>"]), UI, { rows, budget: 2 });
  // Siła 7 (budżet 0), Fart 5→4 (budżet 1)→5 (0)→ prawo zablokowane (0) → Gotowe
  assert.deepEqual(v, [7, 5]);
});
test("sliders: step 2 i Gotowe, gdy nic nie może wzrosnąć", async () => {
  const v = await sliders(tty(["<right>", "<down>", "<enter>"]), UI, { rows: [{ label: "S", value: 98, min: 98, max: 100, step: 2 }], budget: 3 });
  assert.deepEqual(v, [100]);
});
test("sliders bez TTY: 1++, 2-, Gotowe", async () => {
  const rows = [{ label: "Siła", value: 5, min: 2, max: 10 }, { label: "Fart", value: 5, min: 2, max: 10 }];
  assert.deepEqual(await sliders(createScriptedIO(["1++", "2-", "1+", "3"]), UI, { rows, budget: 2 }), [8, 4]);
});
test("textInput: domyślna, walidacja, polskie litery", async () => {
  const opts = { prompt: "Imię: ", min: 2, max: 20, pattern: /^[\p{L}][\p{L} -]*$/u, defaultValue: "Bezimienny" };
  assert.equal(await textInput(createScriptedIO([""]), UI, opts), "Bezimienny");
  assert.equal(await textInput(createScriptedIO(["R2D2", " Żelisław "]), UI, opts), "Żelisław");
});
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS** (w tym `ui.test.js`).
- [ ] **Step 5: Commit** `feat: widżet wyboru ze strzałkami (menu, suwaki, wielokrotny wybór)`.

---

### Task 9: Ekran postaci, pasek stanu, [P] postać

**Files:**
- Create: `src/ui/character_screen.js`
- Modify: `src/ui/screen.js`, `src/ui/prompt.js`, `src/scenes/narration.js`, `src/scenes/ending.js`, `data/ui.json`
- Test: `test/character_screen.test.js`, `test/prompt.test.js`, `test/scenes.test.js`

**Interfaces:**
- Consumes: `getStats` (Task 5), `xpToReach` (Task 6), `timeOfDay` (Task 4), `readKey` (Task 7).
- Produces:
  - `statusBar(state, data, { debug = false } = {}): string` (**zmiana sygnatury** – zaktualizuj wywołania): `t(ui,"status.time",…)` + ` · ` + `t(ui, "time.<pora>")`; gdy jest postać: ` · ` + `t(ui,"status.character",{ name, level, hp, hpMax })` („{name}, poz. {level} · ŻYC {hp}/{hpMax}”); gdy `debug`: ` [wola {wola} · dług {dlug}]` (`status.debugVars`).
  - `renderCharacter(state, data): string` – sekcje: atrybuty (`Nazwa  końcowa  (baza B; +X Źródło …)`), umiejętności (wiodące oznaczone `*`), pochodne (`hpMax`, `ap`, `defense`, `initiative`, `carry`, `critChance`), XP `{xp}/{xpToReach(level+1)}`, perki (nazwa – opis). Etykiety źródeł: `class` → nazwa klasy, `perk` → nazwa perka, `timeOfDay` → `t(ui, "time.<id>")`, `base` → `t(ui,"char.base")`. Wszystkie nagłówki z `ui.json` (`char.attributes`, `char.skills`, `char.derived`, `char.xp`, `char.perks`, `char.base`, `char.tagged`, nazwy pochodnych `derived.hpMax` …).
  - `showCharacter(ctx): Promise<void>` – `clear`, `io.write(renderCharacter(...))`, `pressEnter(io, ui)`.
  - `pressEnter(io, ui, { onCharacter } = {}): Promise<void>` – monit `t(ui,"prompt.enter")`, a gdy `onCharacter` podane – `t(ui,"prompt.enterOrCharacter")` („[Enter] dalej · [P] postać”). TTY: `readKey` – `enter` kończy, `p`/`P` → `await onCharacter()` i ponów monit, inne ignorowane. Bez TTY: `ask`; odpowiedź `p`/`P` (po `trim`) → `onCharacter` i ponów; cokolwiek innego kończy.
  - `narration` i `ending`: `statusBar(state, data, { debug: ctx.debug })`; `pressEnter(io, ui, state.character ? { onCharacter: () => showCharacter(ctx) } : {})`.

- [ ] **Step 1: Write failing tests**

```js
test("statusBar: czas, pora, postać, debug", () => {
  const s = { time: { minutes: 6 * 60 + 30 }, character: null, vars: { wola: 1 } };
  assert.equal(strip(statusBar(s, data)), "Dzień 1, 06:30 · świt");
  const withChar = { ...s, character: makeCharacter() }; // poziom 1, hp 35/35, imię Thorgniew
  assert.equal(strip(statusBar(withChar, data, { debug: true })), "Dzień 1, 06:30 · świt · Thorgniew, poz. 1 · ŻYC 35/35 [wola 1 · dług 0]");
});
test("renderCharacter: wartości, rozbicie i XP", () => {
  const out = strip(renderCharacter(stateWithPerk("szczesciarz"), data));
  assert.match(out, /Fart\s+6/); assert.match(out, /Szczęściarz/); assert.match(out, /XP: \d+\/\d+/);
  assert.doesNotMatch(out, /wola|dług/i); // zmienne ukryte
});
test("pressEnter: p pokazuje postać, potem Enter kończy (TTY i bez TTY)", async () => {
  let n = 0; const onCharacter = async () => { n++; };
  await pressEnter(createScriptedIO(["p", "<enter>"], { tty: true }), UI, { onCharacter });
  await pressEnter(createScriptedIO(["P", ""]), UI, { onCharacter });
  assert.equal(n, 2);
});
test("narration z postacią: [P] otwiera ekran postaci", async () => { /* ctx z postacią, wejścia ["p", "", ""] → output zawiera nagłówek atrybutów */ });
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Commit** `feat: ekran postaci, pasek stanu z porą doby, skrót [P]`.

---

### Task 10: Scena kreatora, scena `reward`, brak postaci

**Files:**
- Create: `src/scenes/character_creation.js`, `src/scenes/reward.js`, `src/scenes/errors.js`
- Modify: `src/scenes/schemas.js`, `src/scenes/index.js`, `src/engine/data.js`, `src/app.js`, `data/ui.json`
- Test: `test/scenes.test.js`, `test/data.test.js`, `test/e2e.test.js`

**Interfaces:**
- Consumes: `select`, `multiSelect`, `sliders`, `textInput` (Task 8), `renderCharacter` (Task 9), `createCharacter`, `validateCreatorChoices`, `creatorStartAttributes`, `addXp` (Task 6), `getStats` (Task 5).
- Produces:
  - `class MissingCharacterError extends Error` (`src/scenes/errors.js`, `name` ustawione).
  - `character_creation` (schemat: tylko pola wspólne): kroki ze specyfikacji B1 „Kreator” 1–5; umiejętności w kroku 4 pokazują wartość bazową jako `hint`; po zatwierdzeniu `state.character = createCharacter(...)` i `state.flags["klasa_" + classId] = true`; „Zacznij od nowa” wraca do kroku 1. Teksty: `creator.title`, `creator.name`, `creator.defaultName` („Bezimienny”), `creator.class`, `creator.attributes`, `creator.gift` („dar”), `creator.tagged`, `creator.summary`, `creator.confirm` („Zatwierdź”), `creator.restart` („Zacznij od nowa”).
  - `reward` (schemat: `scene(["xp"], { xp: { type: "integer", min: 0 } })`): brak postaci → `MissingCharacterError`; `addXp`; ekran: pasek stanu, `t(ui,"reward.xp",{ xp })` („Zdobywasz {xp} PD.”), przy awansie `t(ui,"reward.levelUp",{ level })` („Awans! Poziom {level}.”), `pressEnter` z `onCharacter`.
  - `data.js`: sceny `rest` i `reward` muszą wystąpić w `story.scenes` po pierwszej scenie `character_creation` – inaczej `story.json › <id> › type: scena wymaga postaci – brak wcześniejszej sceny character_creation`.
  - `app.js` (`play`): `MissingCharacterError` → `pushNotice(screenCtx, paint("warn", t(ui,"error.noCharacter")))` („Ta scena wymaga postaci – zacznij nową grę od początku.”), bez slotu `crash`, powrót do menu.

- [ ] **Step 1: Write failing tests**

Kolejność umiejętności w `skills.json` (z tabeli specyfikacji): 1 sieczna, 2 drzewcowa, 3 strzelecka, 4 proch, 5 wrecz, 6 miotanie, 7 medycyna, 8 skradanie, 9 wymowa, 10 handel, 11 wiedza_tajemna, 12 = „Gotowe”. Wiersze atrybutów: 1–7 jak w `attributes.json`, 8 = „Gotowe”.

```js
const expectHero = (state) => {
  const c = state.character;
  assert.equal(c.name, "Thorgniew"); assert.equal(c.classId, "miecz");
  assert.deepEqual(c.attributes, { sila: 7, zrecznosc: 6, krzepa: 7, bystrosc: 5, rozum: 6, oglada: 5, fart: 5 });
  assert.deepEqual([...c.tagged].sort(), ["medycyna", "sieczna", "wymowa"]); assert.equal(state.flags.klasa_miecz, true);
};
test("kreator w trybie TTY (strzałki)", async () => {
  const keys = ["Thorgniew", "<enter>",                                   // imię (ask), klasa miecz
    "<right>", "<right>", "<down>", "<right>", "<down>", "<right>", "<right>", // Siła 7, Zręczność 6, Krzepa 7
    "<down>", "<down>", "<down>", "<down>", "<down>", "<enter>",            // → Gotowe
    "7", "9", "<down>", "<down>", "<down>", "<enter>",                     // medycyna, wymowa → Gotowe
    "<enter>"];                                                            // Zatwierdź
  const ctx = makeCtx(createScriptedIO(keys, { tty: true }));
  await defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" }); expectHero(ctx.state);
});
test("kreator bez TTY (skróty)", async () => {
  const ctx = makeCtx(createScriptedIO(["Thorgniew", "1", "1++", "2+", "3++", "8", "7", "9", "12", "1"]));
  await defaultHandlers.character_creation(ctx, { id: "k", type: "character_creation" }); expectHero(ctx.state);
});
test("kreator: 'Zacznij od nowa' wraca do imienia", async () => { /* drugi przebieg z innym imieniem → to imię w postaci */ });
test("reward: XP, awans, MissingCharacterError", async () => {
  // z postacią: reward xp 150 → level 2, pendingLevelUp { skillPoints: 6, perks: 1 }, tekst "Awans! Poziom 2."
  // bez postaci: rejects MissingCharacterError
});
test("walidacja: reward przed kreatorem", () => {
  const d = minimalData({ start: "r", scenes: [{ id: "r", type: "reward", xp: 10 }, { id: "c", type: "character_creation" }, { id: "k", type: "ending", text: "x" }] });
  assert.ok(validateData(d).includes("story.json › r › type: scena wymaga postaci – brak wcześniejszej sceny character_creation"));
});
// e2e: --scene za kreatorem na scenie reward → komunikat error.noCharacter, menu, brak slotu crash
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Commit** `feat: scena kreatora postaci i nagrody`.

---

### Task 11: Ekran awansu po scenie i scena `rest`

**Files:**
- Create: `src/scenes/after.js`, `src/scenes/rest.js`
- Modify: `src/engine/loop.js`, `src/scenes/schemas.js`, `src/scenes/index.js`, `data/ui.json`
- Test: `test/scenes.test.js`, `test/loop.test.js`

**Interfaces:**
- Consumes: `sliders`, `select` (Task 8), `availablePerks`, `applyLevelUp`, `skillPointsPerLevel` (Task 6), `getStats` (Task 5), `advanceTime` (Task 4).
- Produces:
  - `defaultAfterScene: Array<(ctx) => Promise<void>>` w `src/scenes/after.js` = `[levelUpHook]`; `levelUpHook(ctx)` działa gdy `state.character?.pendingLevelUp`.
  - Ekran awansu: `sliders` – wiersze = wszystkie umiejętności (wartość z `getStats(..., { permanentOnly: true })`, `min` = ta wartość, `max = rules.skills.max`, `step = taggedPointValue` dla wiodących, `1` dla pozostałych), `budget = pendingLevelUp.skillPoints`; przeliczenie na punkty: `(nowa − stara) / step`. Potem `pendingLevelUp.perks` razy `select` z perków (`disabled: !ok`, `hint` – opis braków z `ui.json`: `perk.missing.attribute` „wymaga: {name} {need}”, `perk.missing.skill`, `perk.missing.level` „wymaga poziomu {need}”, `perk.missing.owned` „masz już”); gdy żaden perk `ok` → `pushNotice(..., t(ui,"levelUp.noPerk"))` („Żaden talent nie jest dla ciebie dostępny – ten przepada.”) i pominięcie. Na końcu `applyLevelUp` i `t(ui,"levelUp.done",{ level })`.
  - `loop.js`: po każdej **wykonanej** scenie (po `advanceTime`, przed sprawdzeniem `end`) – `for (const hook of ctx.afterScene ?? defaultAfterScene) await hook(ctx)`. `runStory`: przed pętlą też wywołuje hooki (zaległy awans po wczytaniu).
  - `rest` (schemat `scene([], { allowExposure: { type: "boolean" } })`): brak postaci → `MissingCharacterError`; `sliders` jeden wiersz `t(ui,"rest.hours")`, `value = minHours`, `min/max` z `rules.rest`; dla każdej godziny: `advanceTime(state, 60, data)` (zdarzenia → notatki), `hp = min(hpMax, hp + healBase + floor(krzepa / healKrzepaDiv))` (krzepa końcowa z `getStats`); podsumowanie `t(ui,"rest.summary",{ hours, hp })` („Odpoczywasz {hours} godz. Odzyskujesz {hp} ŻYC.”), notatki, `pressEnter` z `onCharacter`.

- [ ] **Step 1: Write failing tests**

```js
test("awans po scenie: punkty z krokiem 2 dla wiodącej, perk, leczenie", async () => {
  // state po addXp(150): pending { skillPoints: 6, perks: 1 }; hp = 1
  // TTY: sliders – Sieczna (wiodąca) → ×3 (+6), budżet 3 → ↓ Drzewcowa → ×3 (+3) → Gotowe; select perka: twarda_skora
  // oczekiwane: skillPoints { sieczna: 3, drzewcowa: 3 }, perks ["twarda_skora"], pendingLevelUp null, hp = hpMax
});
test("awans bez dostępnych perków: perk przepada z komunikatem", async () => {
  // dane: kopia minimalData() z perks = [{ id: "odlegly", name: "Odległy", description: "x", requires: { level: 10 } }]
  // pending { skillPoints: 6, perks: 1 } → po suwakach (Gotowe po wydaniu punktów) brak wyboru perka,
  // ctx.notices zawiera "Żaden talent nie jest dla ciebie dostępny – ten przepada.", pendingLevelUp === null, perks === []
});
test("hooki afterScene po wykonanej scenie, nie po pominiętej; runStory woła przed pierwszą sceną", async () => {
  // ctx.afterScene = [spy]; sceny a, b(if false), c → spy wołany: 1 (start) + 2 (a, c)
});
test("rest: 3 godziny od 17:30 leczy i zgłasza zmierzch", async () => {
  // hp 20/35, krzepa 5 → +3/h → 29; czas +180 min; notatka "Zapada zmierzch."; tekst "Odpoczywasz 3 godz. Odzyskujesz 9 ŻYC."
});
test("rest: leczenie nie przekracza hpMax", async () => { /* hp 34/35, 8 h → 35 */ });
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Commit** `feat: ekran awansu po scenie i odpoczynek`.

---

### Task 12: Demo B1 i e2e

**Files:**
- Modify: `data/story.json`, `data/ui.json`
- Test: `test/e2e.test.js`, `test/cli.test.js`

**Interfaces:**
- Consumes: wszystko powyżej.
- Produces: `data/story.json` ze specyfikacji B1 „Demo `story.json` po B1” (id scen: `demo_swit`, `demo_kreator`, `demo_sparing`, `demo_postawa_miecz`, `demo_postawa_wlocznia`, `demo_nagroda` (xp **160**), `demo_kurier`, `demo_odpoczynek`, `demo_przekora`, `demo_posluch`, `demo_zapis`, `demo_koniec`; `time` na narracjach tak, by odpoczynek mógł przejść przez zmierzch: `demo_swit` 30, `demo_sparing` 120, `demo_kurier` 480 → 16:30 przed odpoczynkiem; 4 h odpoczynku → zmierzch o 18:00 i noc o 20:00). Teksty po polsku w stylu „Styl i ton” (rubasznie, instruktor szorstki, nazwy tymczasowe nordycko-słowiańskie), 1–3 zdania, bez nazw z istniejących książek.

- [ ] **Step 1: Write/adjust e2e tests** (istniejące testy e2e z cyklu A dopasuj do nowego demo)

```js
test("demo B1 bez TTY: kreator → awans z perkiem → odpoczynek przez zmierzch → koniec", async () => {
  // wejścia liniowe: menu "1", Enter swit, kreator skrótami (miecz), Enter sparing, nagroda Enter, awans (suwaki skróty + Gotowe, perk numer),
  // Enter kurier, odpoczynek "1+++" + Gotowe (4 h z 16:30 → zmierzch), Enter podsumowanie, Enter posłuch (miecz → dlug 1), Enter koniec, "3"
  // asercje: lastState.character.level === 2, perks.length === 1, vars.dlug === 1, wola brak/0, output zawiera "Zapada zmierzch.", brak "[["
});
test("demo B1 w trybie TTY (strzałki)", async () => { /* ta sama ścieżka klawiszami createScriptedIO(..., { tty: true }) */ });
test("zapis w połowie + wczytanie = ten sam stan końcowy", async () => {
  // przebieg A: pełne demo → lastState
  // przebieg B: te same wejścia do narracji demo_kurier, tam "^C", "t" (zapis auto na demo_kurier);
  //             potem nowe runApp: "2", "1" (slot auto), reszta wejść od demo_kurier → lastState
  // assert.deepEqual(bez savedAt(B), bez savedAt(A))
});
test("wczytanie zapisu zrobionego w kreatorze startuje kreator od nowa", async () => {
  // nowa gra, Enter swit, w kreatorze "^C" + "t" → slot auto ze scene.id demo_kreator i character null;
  // wczytaj → kreator od kroku 1, dokończ → postać istnieje
});
test("[P] postać w trakcie demo", async () => { /* na narracji po kreatorze "p" → nagłówek atrybutów w output */ });
// test/cli.test.js: printf-owy przebieg jako test procesu potomnego: spawn node bin/game.js --seed 7 z stdin = wszystkie odpowiedzi naraz → kod 0, output zawiera tekst demo_koniec
```

- [ ] **Step 2: Run – FAIL** (nowe demo jeszcze nie istnieje). - [ ] **Step 3: Implement** `story.json` i brakujące klucze `ui.json`. - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Ręczna weryfikacja:** `node bin/game.js --validate` (kod 0); przebieg z potoku z odpowiedziami z testu e2e (kod 0, widać „Zapada zmierzch.”). Wynik zanotować w raporcie.
- [ ] **Step 6: Commit** `feat: demo cyklu B1 i testy e2e`.

---

## Kryterium ukończenia cyklu

- `npm test` – zielone.
- Demo B1 przechodzi z potoku (kod 0) i w trybie TTY (scripted); gra w prawdziwym terminalu – weryfikuje użytkownik (`npm link`, `ostrze`).
- Zapis v1 wczytuje się po migracji (test Task 3).
