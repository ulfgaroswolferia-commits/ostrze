# Cykl A – rdzeń silnika – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grywalne demo `ostrze` z walidacją danych, deterministycznym RNG, pętlą scen po `id`, zapisem/odczytem i testowalnym IO.

**Architecture:** Czyste moduły w `src/engine/` (bez importów z `src/ui/`), handlery scen w `src/scenes/` łączą je z UI przez wstrzyknięty `ctx.io`. Testy jednostkowe na modułach, e2e przez `createScriptedIO`. CLI (`src/cli.js`) zwraca kod wyjścia, `bin/game.js` tylko go wywołuje.

**Tech Stack:** Node.js ≥ 22, ESM, JSDoc, `node:test`, `node:assert/strict`, `node:util` (`styleText`, `parseArgs`, `stripVTControlCharacters`), `node:readline/promises`. Zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-20-cykl-a-rdzen-silnika-design.md` (oraz `docs/koncepcja-gry.md` v2 jako tło).

## Global Constraints

- `package.json`: `"name": "ostrze"`, `"version": "0.1.0"`, `"type": "module"`, `"bin": { "ostrze": "bin/game.js" }`, `"engines": { "node": ">=22" }`, `"scripts": { "test": "node --test" }`, brak `dependencies`.
- Kod i nazwy techniczne po angielsku; teksty dla gracza tylko w `data/ui.json` (komunikaty walidatora i CLI dla twórcy treści mogą być w kodzie, po polsku).
- `id` w danych: `^[a-z0-9_]+$`, polskie słowa bez diakrytyków.
- `src/engine/*` (poza `loop.js`) nie importuje niczego z `src/ui/`.
- Zmienne środowiskowe czytane w chwili wywołania (nie przy imporcie): `OSTRZE_HOME`, `OSTRZE_DATA`.
- Sloty zapisu: `auto`, `1`, `2`, `3`, `crash`. `SAVE_FORMAT_VERSION = 1`.
- Start gry: `rules.startHour = 6` → `time.minutes = 360`.
- Format błędu danych: `plik › id › pole: opis` (np. `story.json › demo_x › goto: nieznana scena "nie_ma"`).
- Commity kończą się linią `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Wejście gracza z białymi znakami / CRLF / spoza zakresu (`" 2\r"`, `"0"`, `"abc"`, `""`) – `choose` akceptuje `" 2\r"` jako 2, resztę odrzuca i pyta ponownie (Task 5).
2. Zamknięte stdin (EOF, potok) – gra kończy się czysto, bez zawieszenia i bez stosu (Task 5 `InputClosedError`, Task 9).
3. Brak TTY / nieznana szerokość (`process.stdout.columns` = `undefined`) – zawijanie do 80, brak kolorów (Task 5).
4. Nadpisanie istniejącego slotu na Windows – drugi `saveGame` do tego samego slotu się udaje i odczyt daje nowszy stan (Task 6).
5. Błędne flagi CLI (`--seed abc`, `--seed -1`, `--scene nie_ma`, nieznana flaga) – kod 1 i czytelny komunikat, bez stosu (Task 9).

---

## File Structure

```
package.json
bin/game.js                  shebang; process.exitCode = await main(process.argv.slice(2))
src/config.js                stałe i ścieżki
src/cli.js                   main(argv, deps) → kod wyjścia
src/app.js                   menu główne, nowa gra, wczytywanie, obsługa przerwań i crash
src/engine/dice.js           RNG mulberry32
src/engine/schema.js         mini-walidator kształtu
src/engine/conditions.js     evaluate / validateCondition
src/engine/time.js           clockOf(minutes)
src/engine/data.js           loadData / validateData
src/engine/state.js          createNewState
src/engine/save.js           saveGame / loadGame / listSaves
src/engine/loop.js           createSceneList / runScenes / runStory
src/scenes/schemas.js        schematy pól scen (bez importów UI – używa ich data.js)
src/scenes/index.js          rejestr handlerów
src/scenes/narration.js, flag.js, save_point.js, ending.js
src/ui/strings.js            t(ui, key, vars)
src/ui/colors.js             paint / setColorsEnabled
src/ui/text.js               wrap
src/ui/io.js                 createTerminalIO / createScriptedIO / błędy wejścia
src/ui/screen.js             clear / statusBar / sceneHeader
src/ui/prompt.js             choose / pressEnter / confirm
data/ui.json, data/rules.json, data/story.json
test/*.test.js, test/helpers.js
```

---

### Task 1: Pakiet, konfiguracja, RNG

**Files:**
- Create: `package.json`, `src/config.js`, `src/engine/dice.js`
- Test: `test/dice.test.js`, `test/config.test.js`

**Interfaces:**
- Produces:
  - `config.js`: `GAME_NAME = "ostrze"`, `GAME_VERSION` (string, odczytany z `package.json` przez `fs.readFileSync` + `new URL("../package.json", import.meta.url)`), `SAVE_FORMAT_VERSION = 1`, `homeDir(): string` (`OSTRZE_HOME` lub `path.join(os.homedir(), ".ostrze")`), `savesDir(): string` (`homeDir()/saves`), `dataDir(): string` (`OSTRZE_DATA` lub `<katalog pakietu>/data`, przez `fileURLToPath`).
  - `dice.js`: `createRng(seed: number): Rng`; `Rng = { next(): number /* [0,1) */, int(min: number, max: number): number /* włącznie */, percent(chance: number): { roll: number /* 1–100 */, success: boolean /* roll <= chance */ }, getState(): number, setState(state: number): void }`.

- [ ] **Step 1: Write failing tests**

```js
// test/dice.test.js
test("to samo ziarno daje ten sam ciąg", () => {
  const a = createRng(42), b = createRng(42);
  const xs = Array.from({ length: 20 }, () => a.next());
  assert.deepEqual(xs, Array.from({ length: 20 }, () => b.next()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});
test("różne ziarna dają różne ciągi", () => {
  assert.notEqual(createRng(1).next(), createRng(2).next());
});
test("getState/setState kontynuuje ciąg identycznie", () => {
  const a = createRng(7); a.next(); a.next();
  const b = createRng(999); b.setState(a.getState());
  assert.deepEqual([a.next(), a.int(1, 6)], [b.next(), b.int(1, 6)]);
});
test("int mieści się w zakresie włącznie i trafia w oba końce", () => {
  const r = createRng(3); const seen = new Set();
  for (let i = 0; i < 2000; i++) { const v = r.int(2, 4); assert.ok(v >= 2 && v <= 4); seen.add(v); }
  assert.deepEqual([...seen].sort(), [2, 3, 4]);
});
test("percent: 0 nigdy, 100 zawsze, roll 1–100", () => {
  const r = createRng(5);
  for (let i = 0; i < 500; i++) {
    const z = r.percent(0), s = r.percent(100);
    assert.equal(z.success, false); assert.equal(s.success, true);
    assert.ok(z.roll >= 1 && z.roll <= 100);
  }
});
// test/config.test.js
test("homeDir i dataDir respektują zmienne środowiskowe w chwili wywołania", () => {
  process.env.OSTRZE_HOME = "/tmp/x"; assert.equal(homeDir(), "/tmp/x");
  assert.equal(savesDir(), path.join("/tmp/x", "saves"));
  delete process.env.OSTRZE_HOME; assert.equal(homeDir(), path.join(os.homedir(), ".ostrze"));
  process.env.OSTRZE_DATA = "/d"; assert.equal(dataDir(), "/d"); delete process.env.OSTRZE_DATA;
  assert.ok(dataDir().endsWith(`${path.sep}data`));
});
test("GAME_VERSION pochodzi z package.json", () => assert.equal(GAME_VERSION, "0.1.0"));
```

- [ ] **Step 2: Run `npm test` – FAIL (brak modułów).**

- [ ] **Step 3: Implement** `package.json` (Global Constraints), `config.js`, `dice.js`. Algorytm mulberry32 (stan = 32-bitowa liczba bez znaku, `seed >>> 0`):

```js
function step(s) {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [s, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}
```
`int(min, max) = min + Math.floor(next() * (max - min + 1))`; `percent(c)`: `roll = int(1, 100)`.

- [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Commit** `feat: pakiet, konfiguracja i RNG z ziarnem`.

---

### Task 2: Mini-walidator kształtu

**Files:**
- Create: `src/engine/schema.js`
- Test: `test/schema.test.js`

**Interfaces:**
- Produces: `check(value: unknown, schema: Schema, path?: string): string[]`.
  `Schema = { type: "object"|"array"|"string"|"number"|"integer"|"boolean", required?: string[], fields?: Record<string, Schema>, additional?: boolean /* domyślnie true; false = nieznane pola to błąd */, values?: Schema /* schemat każdej wartości obiektu-słownika */, items?: Schema, enum?: unknown[], pattern?: RegExp, min?: number, nonEmpty?: boolean }`.
  Każdy błąd: `` `${path}: ${opis}` `` (bez `path` – sam opis). Ścieżki: `a.b`, `a[2]`.

- [ ] **Step 1: Write failing tests**

```js
const S = { type: "object", required: ["id", "time"], additional: false,
  fields: { id: { type: "string", pattern: /^[a-z0-9_]+$/ }, time: { type: "integer", min: 0 },
            tags: { type: "array", items: { type: "string" } }, set: { type: "object", values: { type: "boolean" } },
            kind: { type: "string", enum: ["a", "b"] }, text: { type: "string", nonEmpty: true } } };
test("poprawny obiekt – brak błędów", () =>
  assert.deepEqual(check({ id: "x_1", time: 0, tags: ["a"], set: { f: true }, kind: "a", text: "t" }, S), []));
test("brak wymaganego pola", () => assert.deepEqual(check({ id: "x" }, S), ["time: brak wymaganego pola"]));
test("zły typ i ujemna liczba", () => {
  assert.deepEqual(check({ id: "x", time: "5" }, S), ["time: oczekiwano liczby całkowitej"]);
  assert.deepEqual(check({ id: "x", time: -1 }, S), ["time: wartość mniejsza niż 0"]);
  assert.deepEqual(check({ id: "x", time: 1.5 }, S), ["time: oczekiwano liczby całkowitej"]);
});
test("nieznane pole przy additional:false", () =>
  assert.deepEqual(check({ id: "x", time: 0, tiem: 3 }, S), ["tiem: nieznane pole"]));
test("pattern, enum, nonEmpty", () => assert.deepEqual(
  check({ id: "Zły", time: 0, kind: "c", text: "" }, S),
  ['id: niepoprawny format "Zły"', 'kind: dozwolone wartości: a, b', "text: pusty tekst"]));
test("ścieżki w tablicach i słownikach", () => assert.deepEqual(
  check({ id: "x", time: 0, tags: ["a", 3], set: { f: "tak" } }, S),
  ["tags[1]: oczekiwano tekstu", "set.f: oczekiwano wartości logicznej"]));
test("ścieżka bazowa jest doklejana", () =>
  assert.deepEqual(check(5, { type: "string" }, "root"), ["root: oczekiwano tekstu"]));
test("null i tablica to nie obiekt", () => {
  assert.deepEqual(check(null, { type: "object" }), ["oczekiwano obiektu"]);
  assert.deepEqual(check([], { type: "object" }), ["oczekiwano obiektu"]);
});
```

Opisy typów: `object` → „oczekiwano obiektu”, `array` → „oczekiwano tablicy”, `string` → „oczekiwano tekstu”, `number` → „oczekiwano liczby”, `integer` → „oczekiwano liczby całkowitej”, `boolean` → „oczekiwano wartości logicznej”. Przy błędzie typu nie sprawdzaj dalszych reguł tej wartości.

- [ ] **Step 2: Run `node --test test/schema.test.js` – FAIL.**
- [ ] **Step 3: Implement `check`** (kolejność błędów: wymagane pola w kolejności `required`, potem pola obiektu w kolejności kluczy wartości).
- [ ] **Step 4: Run – PASS.**
- [ ] **Step 5: Commit** `feat: mini-walidator kształtu danych`.

---

### Task 3: Warunki i zegar

**Files:**
- Create: `src/engine/conditions.js`, `src/engine/time.js`
- Test: `test/conditions.test.js`, `test/time.test.js`

**Interfaces:**
- Produces:
  - `evaluate(cond: Condition, state: { flags: Record<string, boolean> }): boolean`
  - `validateCondition(cond: unknown, path: string): string[]` – nieznany klucz: `` `${path}.${klucz}: nieznany warunek` ``; `flag`/`notFlag` muszą być tekstem; `all`/`any` – niepusta tablica warunków (rekurencyjnie, ścieżki `if.all[0].flag`); pusty obiekt – `` `${path}: pusty warunek` ``.
  - `clockOf(minutes: number): { day: number /* od 1 */, hour: number, minute: number }`.

- [ ] **Step 1: Write failing tests**

```js
const st = { flags: { a: true, b: false } };
test("flag / notFlag", () => {
  assert.equal(evaluate({ flag: "a" }, st), true);
  assert.equal(evaluate({ flag: "b" }, st), false);
  assert.equal(evaluate({ flag: "brak" }, st), false);
  assert.equal(evaluate({ notFlag: "b" }, st), true);
  assert.equal(evaluate({ notFlag: "brak" }, st), true);
});
test("all / any / zagnieżdżenie / wiele kluczy = AND", () => {
  assert.equal(evaluate({ all: [{ flag: "a" }, { notFlag: "b" }] }, st), true);
  assert.equal(evaluate({ any: [{ flag: "b" }, { flag: "a" }] }, st), true);
  assert.equal(evaluate({ any: [{ flag: "b" }, { all: [{ flag: "a" }, { flag: "b" }] }] }, st), false);
  assert.equal(evaluate({ flag: "a", notFlag: "a" }, st), false);
});
test("validateCondition", () => {
  assert.deepEqual(validateCondition({ flag: "a" }, "if"), []);
  assert.deepEqual(validateCondition({ flga: "a" }, "if"), ["if.flga: nieznany warunek"]);
  assert.deepEqual(validateCondition({ all: [] }, "if"), ["if.all: oczekiwano niepustej tablicy warunków"]);
  assert.deepEqual(validateCondition({ any: [{ flag: 3 }] }, "if"), ["if.any[0].flag: oczekiwano tekstu"]);
  assert.deepEqual(validateCondition({}, "if"), ["if: pusty warunek"]);
  assert.deepEqual(validateCondition("a", "if"), ["if: oczekiwano obiektu"]);
});
// test/time.test.js
test("clockOf", () => {
  assert.deepEqual(clockOf(360), { day: 1, hour: 6, minute: 0 });
  assert.deepEqual(clockOf(1439), { day: 1, hour: 23, minute: 59 });
  assert.deepEqual(clockOf(1440 + 90), { day: 2, hour: 1, minute: 30 });
});
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run – PASS.**
- [ ] **Step 5: Commit** `feat: warunki i zegar świata`.

---

### Task 4: Ładowanie i walidacja danych + dane demo

**Files:**
- Create: `src/scenes/schemas.js`, `src/engine/data.js`, `data/ui.json`, `data/rules.json`, `data/story.json`
- Test: `test/data.test.js`, `test/helpers.js`

**Interfaces:**
- Consumes: `check` (Task 2), `validateCondition` (Task 3), `dataDir` (Task 1).
- Produces:
  - `schemas.js`: `SCENE_TYPES: Record<string, Schema>` – klucze `narration`, `flag`, `save_point`, `ending`; każdy schemat zawiera pola wspólne (`id` wymagane z `pattern`, `type` wymagane, `if` typu object, `goto` string, `time` integer min 0, `tags` tablica stringów) + własne (`narration`: `text` wymagane nonEmpty, `title`; `flag`: `set` wymagane, `values: boolean`; `ending`: `text` wymagane nonEmpty), `additional: false`.
  - `data.js`: `loadData(dir?: string): Promise<GameData>` (domyślnie `dataDir()`), `GameData = { ui: Record<string,string>, rules: { startHour: number }, story: { start: string, scenes: Scene[] } }`, głęboko zamrożone. Brak pliku / zły JSON → `DataLoadError` z komunikatem `` `${plik}: ${powód}` ``.
  - `validateData(data: GameData): string[]`.
  - `test/helpers.js`: `tmpDir(): Promise<string>` (mkdtemp w `os.tmpdir()`), `minimalData(overrides?)` – poprawny obiekt `GameData` z 2 scenami (`a` narration, `b` ending).

Reguły `validateData` (prefiks pliku `story.json` / `rules.json` / `ui.json`):
- `story.start` musi istnieć → `story.json › start: nieznana scena "x"`.
- `scenes` niepusta tablica; każda scena: znany `type` (`story.json › <id> › type: nieznany typ sceny "x"`), potem `check` schematu typu, `validateCondition(scene.if, "if")`, `goto` do istniejącej sceny (`goto: nieznana scena "x"`), `goto` różne od własnego `id` (`goto: scena wskazuje samą siebie`).
- Zduplikowane `id` → `story.json › <id>: zduplikowane id`.
- Scena bez `id` w komunikacie występuje jako `#<indeks>`.
- `rules.startHour` integer 0–23; `ui` – słownik stringów.

- [ ] **Step 1: Write failing tests**

```js
test("minimalne dane przechodzą", () => assert.deepEqual(validateData(minimalData()), []));
test("prawdziwy katalog data/ przechodzi walidację", async () =>
  assert.deepEqual(validateData(await loadData()), []));
test("komunikaty błędów", () => {
  const d = minimalData({ scenes: [
    { id: "a", type: "narration", text: "x", goto: "nie_ma" },
    { id: "a", type: "ending", text: "y" },
    { id: "c", type: "walka" },
    { type: "flag", set: { f: true } },
    { id: "e", type: "narration", text: "z", if: { flga: "f" }, goto: "e" },
  ], start: "zly_start" });
  const errs = validateData(d);
  for (const e of [
    'story.json › start: nieznana scena "zly_start"',
    'story.json › a › goto: nieznana scena "nie_ma"',
    "story.json › a: zduplikowane id",
    'story.json › c › type: nieznany typ sceny "walka"',
    "story.json › #3 › id: brak wymaganego pola",
    "story.json › e › if.flga: nieznany warunek",
    "story.json › e › goto: scena wskazuje samą siebie",
  ]) assert.ok(errs.includes(e), `brak: ${e}\n${errs.join("\n")}`);
});
test("loadData: brak pliku i zły JSON dają DataLoadError z nazwą pliku", async () => {
  const dir = await tmpDir();
  await assert.rejects(loadData(dir), (e) => e instanceof DataLoadError && /ui\.json/.test(e.message));
  // zapisz poprawne ui.json i rules.json, a story.json = "{"
  await assert.rejects(loadData(dir), (e) => /story\.json/.test(e.message));
});
test("dane są zamrożone", async () => assert.ok(Object.isFrozen((await loadData()).story.scenes[0])));
```

- [ ] **Step 2: Run – FAIL.**
- [ ] **Step 3: Implement** `schemas.js`, `data.js`, pliki danych:
  - `rules.json`: `{ "startHour": 6 }`.
  - `story.json` (demo, teksty 1–3 zdania w klimacie prologu: poranek w prowincjonalnej szkole ostrza, plac ćwiczeń, wieść o kurierze – bez imion i nazw własnych, te ustali cykl E): `demo_start` (narration, `title: "Prolog"`, `time: 30`) → `demo_flaga` (flag `{ "demo_widzial_ogien": true }`) → `demo_warunek` (narration, `if: { flag: demo_widzial_ogien }`) → `demo_zapis` (save_point) → `demo_pominieta` (narration, `if: { notFlag: demo_widzial_ogien }`) → `demo_po_zapisie` (narration, `time: 60`) → `demo_koniec` (ending).
  - `ui.json`: klucze dodawane w Task 5–9 (na razie `{}` wystarczy; test w Task 5 wymusi komplet).
- [ ] **Step 4: Run – PASS.**
- [ ] **Step 5: Commit** `feat: ładowanie i walidacja danych, demo fabuły`.

---

### Task 5: Warstwa UI – IO, teksty, kolory, zawijanie, wybór

**Files:**
- Create: `src/ui/io.js`, `src/ui/strings.js`, `src/ui/colors.js`, `src/ui/text.js`, `src/ui/screen.js`, `src/ui/prompt.js`
- Modify: `data/ui.json`
- Test: `test/io.test.js`, `test/text.test.js`, `test/prompt.test.js`, `test/ui.test.js`

**Interfaces:**
- Consumes: `clockOf` (Task 3).
- Produces:
  - `io.js`:
    - `class InputClosedError extends Error`, `class InterruptError extends Error`, `class InputExhaustedError extends Error`.
    - `IO = { write(text: string): void, ask(question: string): Promise<string>, close(): void, columns: number }`.
    - `createScriptedIO(inputs: string[]): IO & { output: string[], text(): string }` – `ask` zapisuje pytanie do `output` i zwraca kolejne wejście; wejście `"^C"` → rzuca `InterruptError`; wyczerpanie → `InputExhaustedError`; `text()` = połączone `output` po `stripVTControlCharacters`; `columns = 80`.
    - `createTerminalIO({ input = process.stdin, output = process.stdout } = {}): IO` – `readline/promises`; Ctrl+C (zdarzenie `SIGINT` interfejsu) odrzuca bieżące `ask` z `InterruptError`; zamknięcie wejścia (`close`) – `InputClosedError`; `columns` = getter `output.columns || 80`.
  - `strings.js`: `t(ui: Record<string,string>, key: string, vars?: Record<string, string|number>): string` – podstawia `{nazwa}`; brak klucza → `` `[[${key}]]` ``.
  - `colors.js`: `paint(role: "title"|"dim"|"damage"|"heal"|"check"|"mystic"|"warn", text: string): string`; `setColorsEnabled(on: boolean): void`; domyślnie włączone gdy `process.stdout.isTTY && !process.env.NO_COLOR`. Mapowanie na `styleText`: title → `bold`, dim → `gray`, damage → `red`, heal → `green`, check → `yellow`, mystic → `magenta`, warn → `["yellow", "bold"]`.
  - `text.js`: `wrap(text: string, width: number): string` – akapity (`\n\n`) i pojedyncze `\n` zachowane; długość liczona w punktach kodowych; słowo dłuższe niż `width` cięte twardo; `width < 10` traktuj jak 10.
  - `screen.js`: `clear(io)` (pisze `"\x1b[2J\x1b[H"`), `statusBar(state, ui): string` (`t(ui, "status.time", { day, hh, mm })`, `hh`/`mm` dwucyfrowe), `sceneHeader(title: string): string` (`paint("title", title)`), `textWidth(io): number` = `Math.min(io.columns, 100)`.
  - `prompt.js`:
    - `choose(io, ui, labels: string[], question?: string): Promise<number>` – wypisuje `[1] etykieta`…; odpowiedź `trim()`, poprawna gdy `/^\d+$/` i 1..n; inaczej `t(ui, "prompt.invalid", { max: n })` i ponowne pytanie; zwraca indeks od 0.
    - `pressEnter(io, ui): Promise<void>` – `ask(t(ui, "prompt.enter"))`, dowolna odpowiedź.
    - `confirm(io, ui, question: string): Promise<boolean>` – `t`/`tak`/`y` → true, `n`/`nie` → false (bez wielkości liter, po `trim`), inaczej `t(ui, "prompt.confirmInvalid")` i ponów.
- Klucze `ui.json` wymagane w tym cyklu (test `ui.test.js` pilnuje kompletu): `prompt.choice` („> ”), `prompt.invalid` („Wpisz liczbę od 1 do {max}.”), `prompt.enter` („[Enter] dalej”), `prompt.confirmInvalid` („Odpowiedz t lub n.”), `status.time` („Dzień {day}, {hh}:{mm}”) oraz klucze z Task 8–9.

- [ ] **Step 1: Write failing tests**

```js
// test/io.test.js
test("scripted IO zwraca kolejne odpowiedzi i zapisuje wyjście", async () => {
  const io = createScriptedIO(["1", "tak"]);
  io.write("Witaj"); assert.equal(await io.ask("? "), "1"); assert.equal(await io.ask("? "), "tak");
  assert.match(io.text(), /Witaj/);
  await assert.rejects(io.ask("?"), InputExhaustedError);
});
test("^C rzuca InterruptError", async () =>
  await assert.rejects(createScriptedIO(["^C"]).ask("?"), InterruptError));
test("terminal IO: zamknięte wejście → InputClosedError, brak columns → 80", async () => {
  const input = Readable.from([]); const output = new PassThrough();
  const io = createTerminalIO({ input, output });
  assert.equal(io.columns, 80);
  await assert.rejects(io.ask("? "), InputClosedError);
});
// test/text.test.js
test("zawija po słowach z polskimi znakami", () =>
  assert.equal(wrap("Zażółć gęślą jaźń i pójdź dalej", 12), "Zażółć gęślą\njaźń i pójdź\ndalej"));
test("zachowuje akapity i łamania", () => assert.equal(wrap("a b\n\nc\nd", 80), "a b\n\nc\nd"));
test("tnie zbyt długie słowa", () => assert.equal(wrap("abcdefghijklmno", 10), "abcdefghij\nklmno"));
// test/prompt.test.js
test("choose akceptuje ' 2\\r', odrzuca 0/abc/puste/za duże", async () => {
  const io = createScriptedIO(["0", "abc", "", "4", " 2\r"]);
  assert.equal(await choose(io, UI, ["A", "B", "C"]), 1);
  assert.equal((io.text().match(/Wpisz liczbę od 1 do 3\./g) ?? []).length, 4);
});
test("confirm", async () => {
  assert.equal(await confirm(createScriptedIO(["TAK"]), UI, "?"), true);
  assert.equal(await confirm(createScriptedIO(["x", "n"]), UI, "?"), false);
});
test("statusBar", () => assert.equal(stripVTControlCharacters(statusBar({ time: { minutes: 1440 + 65 } }, UI)), "Dzień 2, 01:05"));
test("t podstawia zmienne i zwraca [[klucz]] dla braku", () => {
  assert.equal(t({ a: "x {n}" }, "a", { n: 3 }), "x 3"); assert.equal(t({}, "b"), "[[b]]");
});
// test/ui.test.js – UI = prawdziwy data/ui.json
test("każdy klucz t(ui, \"…\") użyty w src/ istnieje w ui.json", async () => {
  // rekurencyjnie czytaj src/**/*.js, regex /\bt\(\s*[\w.]+\s*,\s*["']([\w.]+)["']/g
  // assert.deepEqual(brakujące, [])
});
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement** moduły i klucze w `ui.json`. - [ ] **Step 4: Run – PASS.**
- [ ] **Step 5: Commit** `feat: warstwa UI – io, teksty, kolory, zawijanie, wybór opcji`.

---

### Task 6: Stan gry i zapis

**Files:**
- Create: `src/engine/state.js`, `src/engine/save.js`
- Test: `test/save.test.js`

**Interfaces:**
- Consumes: `savesDir`, `SAVE_FORMAT_VERSION`, `GAME_VERSION` (Task 1), `check` (Task 2), `createRng` (Task 1), `GameData`, `minimalData`, `tmpDir` (Task 4).
- Produces:
  - `createNewState({ seed: number, startScene: string, rules: { startHour: number } }): GameState` – kształt z sekcji „Stan gry” specyfikacji cyklu A (`version: 1`, `gameVersion: GAME_VERSION`, `savedAt: null`, `seed`, `rngState: seed >>> 0`, `time.minutes = startHour * 60`, `scene.id`, `context: "story"`, `flags: {}`, `character: null`, `inventory: null`, `world: { location: null, locations: {}, failedChecks: [] }`, `quests: {}`).
  - `SLOTS = ["auto", "1", "2", "3", "crash"]`.
  - `class SaveError extends Error`, `class LoadError extends Error`.
  - `saveGame(slot: string, state: GameState, rng: Rng): Promise<void>` – kopia `structuredClone`, `savedAt = new Date().toISOString()`, `rngState = rng.getState()`; `mkdir -p`, zapis `<slot>.json.tmp`, `rename` na `<slot>.json`; błąd → usuń `.tmp` (ignoruj brak) i rzuć `SaveError(powód)`. Nieznany slot → `SaveError`.
  - `loadGame(slot: string, data: GameData): Promise<GameState>` – `LoadError` z komunikatami: brak pliku „brak zapisu”, zły JSON „uszkodzony plik”, `version > SAVE_FORMAT_VERSION` „zapis z nowszej wersji gry”, zły kształt „niepoprawna struktura (…pierwszy błąd check…)”, `scene.id` spoza `data.story` `` `nieznana scena "${id}"` ``. Starsze wersje: `migrations[v](state)` kolejno do bieżącej (obiekt `migrations` eksportowany, w cyklu A pusty).
  - `listSaves(data: GameData): Promise<Array<{ slot: string, ok: boolean, summary?: { sceneId: string, sceneTitle: string|null, day: number, savedAt: string }, error?: string }>>` – tylko istniejące pliki, w kolejności `SLOTS`; `sceneTitle` = `title` sceny lub `null`.

- [ ] **Step 1: Write failing tests** (każdy test ustawia `process.env.OSTRZE_HOME = await tmpDir()`)

```js
test("createNewState", () => {
  const s = createNewState({ seed: 42, startScene: "a", rules: { startHour: 6 } });
  assert.equal(s.time.minutes, 360); assert.equal(s.scene.id, "a"); assert.equal(s.version, 1);
  assert.deepEqual(s.flags, {}); assert.deepEqual(s.quests, {}); assert.equal(s.world.location, null);
});
test("zapis → odczyt daje ten sam stan + rngState z generatora, bez .tmp", async () => {
  const s = createNewState({ seed: 1, startScene: "a", rules: { startHour: 6 } });
  const rng = createRng(1); rng.next(); s.flags.x = true;
  await saveGame("1", s, rng);
  const back = await loadGame("1", minimalData());
  assert.equal(back.rngState, rng.getState()); assert.equal(back.flags.x, true);
  assert.ok(back.savedAt); assert.deepEqual(await readdir(savesDir()), ["1.json"]);
  assert.equal(s.savedAt, null); // oryginał nietknięty
});
test("nadpisanie istniejącego slotu", async () => {
  const d = minimalData(); const s = createNewState({ seed: 1, startScene: "a", rules: { startHour: 6 } });
  await saveGame("auto", s, createRng(1)); s.flags.y = true; await saveGame("auto", s, createRng(1));
  assert.equal((await loadGame("auto", d)).flags.y, true);
});
test("błędy odczytu", async () => {
  const d = minimalData();
  await assert.rejects(loadGame("2", d), { name: "LoadError", message: "brak zapisu" });
  await mkdir(savesDir(), { recursive: true });
  await writeFile(path.join(savesDir(), "2.json"), "{");
  await assert.rejects(loadGame("2", d), { message: "uszkodzony plik" });
  const s = createNewState({ seed: 1, startScene: "a", rules: { startHour: 6 } });
  await writeFile(path.join(savesDir(), "3.json"), JSON.stringify({ ...s, version: 99 }));
  await assert.rejects(loadGame("3", d), { message: "zapis z nowszej wersji gry" });
  await writeFile(path.join(savesDir(), "3.json"), JSON.stringify({ ...s, scene: { id: "zniknela" } }));
  await assert.rejects(loadGame("3", d), { message: 'nieznana scena "zniknela"' });
});
test("listSaves opisuje poprawne i uszkodzone sloty", async () => {
  const d = minimalData(); const s = createNewState({ seed: 1, startScene: "a", rules: { startHour: 6 } });
  await saveGame("auto", s, createRng(1)); await writeFile(path.join(savesDir(), "1.json"), "{");
  const list = await listSaves(d);
  assert.deepEqual(list.map((e) => [e.slot, e.ok]), [["auto", true], ["1", false]]);
  assert.equal(list[0].summary.sceneId, "a"); assert.equal(list[0].summary.day, 1);
  assert.equal(list[1].error, "uszkodzony plik");
});
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run – PASS.**
- [ ] **Step 5: Commit** `feat: stan gry i atomowy zapis z wersjonowaniem`.

---

### Task 7: Pętla scen

**Files:**
- Create: `src/engine/loop.js`
- Test: `test/loop.test.js`

**Interfaces:**
- Consumes: `evaluate` (Task 3).
- Produces:
  - `createSceneList(scenes: Scene[]): SceneList`, `SceneList = { get(id: string): Scene /* nieznane id → Error */, has(id: string): boolean, nextId(id: string): string | null, scenes: Scene[] }`.
  - `SceneResult = { goto?: string, outcome?: string, end?: boolean }`; `Handler = (ctx, scene) => Promise<SceneResult | void>`.
  - `Ctx = { state: GameState, data: GameData, io: IO, rng: Rng, debug: boolean, story: SceneList, handlers?: Record<string, Handler> }`.
  - `runScenes(ctx: Ctx, list: SceneList, startId: string, opts?: { trackScene?: boolean /* domyślnie false */ }): Promise<SceneResult & { end: true }>` – algorytm z sekcji „Przepływ” pkt 4 specyfikacji; handlery z `ctx.handlers ?? defaultHandlers` (import z `src/scenes/index.js` – w tym tasku utwórz `src/scenes/index.js` eksportujący `defaultHandlers = {}`, Task 8 go wypełni). Zwraca `{ end: true, outcome? }` – `outcome` z wyniku sceny, która zakończyła pętlę.
  - `runStory(ctx: Ctx)` = `runScenes(ctx, ctx.story, ctx.state.scene.id, { trackScene: true })`.

- [ ] **Step 1: Write failing tests** (handlery testowe zapisują `scene.id` do tablicy `log`)

```js
const rec = (log) => ({ step: async (_c, s) => { log.push(s.id); return s.result; } });
const mk = (scenes) => { const log = []; const state = { flags: { f: true }, time: { minutes: 0 }, scene: { id: scenes[0].id } };
  return { log, ctx: { state, handlers: rec(log), story: createSceneList(scenes) } };
};
test("wykonuje sceny po kolei i kończy na końcu listy", async () => {
  const { log, ctx } = mk([{ id: "a", type: "step" }, { id: "b", type: "step" }]);
  assert.deepEqual(await runStory(ctx), { end: true }); assert.deepEqual(log, ["a", "b"]);
});
test("if pomija, goto sceny i goto wyniku przekierowują, end kończy z outcome", async () => {
  const { log, ctx } = mk([
    { id: "a", type: "step", goto: "c" },
    { id: "b", type: "step", result: { end: true, outcome: "ok" } },
    { id: "c", type: "step", if: { notFlag: "f" } },
    { id: "d", type: "step", result: { goto: "b" } },
  ]);
  assert.deepEqual(await runStory(ctx), { end: true, outcome: "ok" });
  assert.deepEqual(log, ["a", "d", "b"]);
});
```

```js
test("time przesuwa zegar, scene.id śledzone tylko z trackScene", async () => {
  const { ctx } = mk([{ id: "a", type: "step", time: 30 }, { id: "b", type: "step", time: 15 }]);
  await runStory(ctx); assert.equal(ctx.state.time.minutes, 45); assert.equal(ctx.state.scene.id, "b");
  const other = createSceneList([{ id: "x", type: "step" }]);
  await runScenes(ctx, other, "x"); assert.equal(ctx.state.scene.id, "b");
});
test("scene.id ustawiane PRZED handlerem (zapis w trakcie sceny pamięta ją)", async () => {
  const seen = []; const { ctx } = mk([{ id: "a", type: "spy" }]);
  ctx.handlers = { spy: async (c) => { seen.push(c.state.scene.id); } };
  ctx.state.scene.id = "zzz"; await runScenes(ctx, ctx.story, "a", { trackScene: true });
  assert.deepEqual(seen, ["a"]);
});
test("createSceneList: nextId, has, get nieznanego rzuca", () => {
  const l = createSceneList([{ id: "a" }, { id: "b" }]);
  assert.equal(l.nextId("a"), "b"); assert.equal(l.nextId("b"), null);
  assert.equal(l.has("c"), false); assert.throws(() => l.get("c"));
});
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run – PASS.**
- [ ] **Step 5: Commit** `feat: pętla scen po id z if/goto/time`.

---

### Task 8: Handlery scen

**Files:**
- Create: `src/scenes/narration.js`, `src/scenes/flag.js`, `src/scenes/save_point.js`, `src/scenes/ending.js`
- Modify: `src/scenes/index.js`, `data/ui.json`
- Test: `test/scenes.test.js`

**Interfaces:**
- Consumes: `clear`, `statusBar`, `sceneHeader`, `textWidth` (Task 5), `wrap`, `pressEnter`, `t`, `paint` (Task 5), `saveGame`, `SaveError` (Task 6), `runScenes`, `createSceneList` (Task 7).
- Produces: `defaultHandlers = { narration, flag, save_point, ending }`, każdy typu `Handler`.
  - `narration`: `clear` → `statusBar` → pusty wiersz → `sceneHeader(title)` jeśli jest → `wrap(text, textWidth(io))` → `pressEnter`.
  - `flag`: `Object.assign(state.flags, scene.set)`; nic nie wypisuje, nie pyta.
  - `save_point`: `saveGame("auto", state, rng)`; sukces → `paint("dim", t(ui, "save.done"))`; `SaveError` → `paint("warn", t(ui, "save.failed", { reason }))`; nie pyta o Enter.
  - `ending`: jak `narration` (bez tytułu, jeśli brak), potem `return { end: true }`.
- Nowe klucze `ui.json`: `save.done` („Zapisano.”), `save.failed` („Nie udało się zapisać: {reason}”).

- [ ] **Step 1: Write failing tests** (ctx z `createScriptedIO`, `minimalData`, `createRng(1)`, `OSTRZE_HOME = tmpDir()`)

```js
test("narration wypisuje pasek stanu, tytuł i tekst, czeka na Enter", async () => {
  const io = createScriptedIO([""]); /* ctx */
  await defaultHandlers.narration(ctx, { id: "a", type: "narration", title: "Prolog", text: "Świt." });
  const out = io.text(); assert.match(out, /Dzień 1, 06:00/); assert.match(out, /Prolog/); assert.match(out, /Świt\./);
  await assert.rejects(io.ask("?"), InputExhaustedError); // zużył dokładnie 1 wejście
});
test("flag ustawia flagi bez wejścia", async () => {
  await defaultHandlers.flag(ctx, { id: "f", type: "flag", set: { x: true, y: false } });
  assert.deepEqual(ctx.state.flags, { x: true, y: false });
});
test("save_point zapisuje slot auto i informuje", async () => {
  await defaultHandlers.save_point(ctx, { id: "s", type: "save_point" });
  assert.equal((await loadGame("auto", ctx.data)).scene.id, ctx.state.scene.id); assert.match(io.text(), /Zapisano\./);
});
test("save_point przy błędzie zapisu informuje i nie rzuca", async () => {
  process.env.OSTRZE_HOME = path.join(await tmpDir(), "plik"); await writeFile(process.env.OSTRZE_HOME, "x"); // katalog nie da się utworzyć
  await defaultHandlers.save_point(ctx, { id: "s", type: "save_point" });
  assert.match(io.text(), /Nie udało się zapisać/);
});
test("ending zwraca end", async () =>
  assert.deepEqual(await defaultHandlers.ending(ctxZ([""]), { id: "k", type: "ending", text: "Koniec." }), { end: true }));
test("rejestr pokrywa wszystkie typy z SCENE_TYPES", () =>
  assert.deepEqual(Object.keys(defaultHandlers).sort(), Object.keys(SCENE_TYPES).sort()));
```

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `npm test` – PASS (w tym `ui.test.js`).**
- [ ] **Step 5: Commit** `feat: handlery scen narration, flag, save_point, ending`.

---

### Task 9: Aplikacja, CLI i e2e

**Files:**
- Create: `src/app.js`, `src/cli.js`, `bin/game.js`
- Modify: `data/ui.json`
- Test: `test/cli.test.js`, `test/e2e.test.js`

**Interfaces:**
- Consumes: wszystko powyżej.
- Produces:
  - `runApp({ data: GameData, io: IO, options: { seed?: number, scene?: string, debug: boolean } }): Promise<{ lastState: GameState | null }>` – `lastState` = stan po ostatnio zakończonej (lub przerwanej) rozgrywce.
  - `main(argv: string[], deps?: { io?: IO, stdout?: (s: string) => void, stderr?: (s: string) => void }): Promise<number>` – kod wyjścia.
  - `bin/game.js`: `#!/usr/bin/env node`, `process.exitCode = await main(process.argv.slice(2))`.

Zachowanie `main`:
- `util.parseArgs` z `strict: true`: `--seed <string>`, `--scene <string>`, `--debug`, `--validate`, `--help`. Błąd parsowania (nieznana flaga) → `stderr` komunikat + kod 1.
- `--help` → krótka pomoc (tekst w `ui.json`, klucz `cli.help`) na `stdout`, kod 0.
- `--seed`: `/^\d+$/` i ≤ 4294967295, inaczej `stderr` „--seed: oczekiwano liczby całkowitej 0–4294967295”, kod 1.
- `loadData()` (błąd `DataLoadError` → `stderr` + kod 1) i `validateData` – błędy na `stderr` po jednym w wierszu, kod 1. `--validate` przy braku błędów: `stdout` „Dane poprawne.” i kod 0.
- `--scene` spoza `story` → `stderr` `` `--scene: nieznana scena "${id}"` ``, kod 1.
- Inaczej: `setColorsEnabled` zależnie od TTY, `runApp` z `deps.io ?? createTerminalIO()`, na końcu `io.close()`, kod 0.

Zachowanie `runApp`:
- Menu (`choose`): `menu.new` („Nowa gra”), `menu.load` („Wczytaj”), `menu.exit` („Wyjście”), nagłówek `menu.title` („OSTRZE”).
- **Nowa gra:** `seed = options.seed ?? (Date.now() >>> 0)`; `createNewState`; `createRng(seed)`; autozapis `auto` (błąd → komunikat `save.failed`, gra trwa); `runStory`.
- **Wczytaj:** `listSaves`; brak → `menu.noSaves` („Brak zapisów.”) i powrót; uszkodzone wypisane jako `load.corrupt` („{slot}: nieczytelny – {reason}”), niewybieralne; poprawne jako opcje `load.entry` („{slot} · {scene} · dzień {day} · {date}”, `scene` = tytuł albo id, `date` = `savedAt` w formacie `YYYY-MM-DD HH:MM`) + ostatnia opcja `load.back` („Wróć”). Po wyborze: `loadGame`, `rng = createRng(state.seed); rng.setState(state.rngState)`, `runStory`. `LoadError` → komunikat i powrót do menu.
- Po `runStory` zakończonym `end` → powrót do menu.
- `InterruptError` w trakcie gry → `confirm(t(ui, "confirm.saveOnExit"))` („Zapisać przed wyjściem?”); tak → `saveGame("auto")`; potem zakończ `runApp`. `InterruptError` drugi raz w tym pytaniu lub w menu → zakończ bez zapisu.
- `InputClosedError` gdziekolwiek → zakończ `runApp` bez pytań.
- Inny wyjątek w trakcie gry → `saveGame("crash")` (ciche, błąd zapisu ignoruj), `paint("warn", t(ui, "error.crash"))` („Coś poszło nie tak. Stan gry zapisano w slocie „crash”.”), stos tylko gdy `debug`, powrót do menu. `InputExhaustedError` (testy) **nie** jest łapany – propaguje, żeby test się wywrócił zamiast wisieć.

- [ ] **Step 1: Write failing tests**

```js
// test/cli.test.js – OSTRZE_HOME = tmpDir(); stdout/stderr zbierane do tablic
test("--validate na prawdziwych danych → 0", async () => assert.equal(await main(["--validate"], deps), 0));
test("--validate na zepsutej kopii → 1 i czytelny błąd", async () => {
  const dir = await tmpDir(); await cp(dataDir(), dir, { recursive: true });
  // w kopii story.json: pierwszej scenie ustaw goto: "nie_ma"
  process.env.OSTRZE_DATA = dir;
  assert.equal(await main(["--validate"], deps), 1);
  assert.match(err.join("\n"), /story\.json › demo_start › goto: nieznana scena "nie_ma"/);
});
for (const argv of [["--seed", "abc"], ["--seed", "-1"], ["--scene", "nie_ma"], ["--bzdura"]])
  test(`błędne argumenty ${argv.join(" ")} → 1 bez stosu`, async () => {
    assert.equal(await main(argv, deps), 1); assert.doesNotMatch(err.join("\n"), /\n\s+at /);
  });
test("--help → 0", async () => { assert.equal(await main(["--help"], deps), 0); assert.ok(out.join("").length > 0); });

// test/e2e.test.js – OSTRZE_HOME = tmpDir(), data = await loadData()
// Demo: demo_start(Enter) demo_flaga demo_warunek(Enter) demo_zapis demo_pominieta(pominięta) demo_po_zapisie(Enter) demo_koniec(Enter)
const strip = (s) => { const { savedAt, ...rest } = s; return rest; };
test("nowa gra przechodzi demo do końca i wraca do menu", async () => {
  const io = createScriptedIO(["1", "", "", "", "", "3"]);
  const { lastState } = await runApp({ data, io, options: { seed: 7, debug: false } });
  assert.equal(lastState.scene.id, "demo_koniec"); assert.equal(lastState.flags.demo_widzial_ogien, true);
  assert.equal(lastState.time.minutes, 360 + 30 + 60);
  assert.doesNotMatch(io.text(), /\[\[/); // brak brakujących tekstów
});
test("zapis w połowie + wczytanie + dokończenie = ten sam stan co przejście bez przerwy", async () => {
  const full = (await runApp({ data, io: createScriptedIO(["1", "", "", "", "", "3"]), options: { seed: 7, debug: false } })).lastState;
  // przerwij po save_point: Ctrl+C na narracji demo_po_zapisie, odmów zapisu (autozapis z save_point już jest)
  await runApp({ data, io: createScriptedIO(["1", "", "", "^C", "n"]), options: { seed: 7, debug: false } });
  // wczytaj: menu 2 → slot auto (opcja 1) → demo_zapis zapisuje ponownie → demo_po_zapisie Enter → koniec Enter → wyjście
  const resumed = (await runApp({ data, io: createScriptedIO(["2", "1", "", "", "3"]), options: { debug: false } })).lastState;
  assert.deepEqual(strip(resumed), strip(full));
});
test("Ctrl+C w grze z zapisem tworzy slot auto na bieżącej scenie", async () => {
  await runApp({ data, io: createScriptedIO(["1", "^C", "t"]), options: { seed: 1, debug: false } });
  assert.equal((await loadGame("auto", data)).scene.id, "demo_start");
});
test("wyjątek w scenie → slot crash i powrót do menu", async () => {
  const handlers = { ...defaultHandlers, narration: async () => { throw new Error("bum"); } };
  const io = createScriptedIO(["1", "3"]);
  await runApp({ data, io, options: { seed: 1, debug: false, handlers } });
  assert.match(io.text(), /slocie „crash”/);
  assert.doesNotMatch(io.text(), /\n\s+at /); // bez stosu, gdy debug: false
  assert.equal((await loadGame("crash", data)).scene.id, "demo_start");
});
test("pusta lista zapisów", async () => {
  const io = createScriptedIO(["2", "3"]); await runApp({ data, io, options: { debug: false } });
  assert.match(io.text(), /Brak zapisów\./);
});
```

Uwaga do testu crash: `runApp` przyjmuje opcjonalne `options.handlers` i przekazuje je do `ctx.handlers` (tylko do testów; CLI go nie ustawia).

- [ ] **Step 2: Run – FAIL.** - [ ] **Step 3: Implement** `app.js`, `cli.js`, `bin/game.js` i klucze `ui.json`. - [ ] **Step 4: Run `npm test` – PASS.**
- [ ] **Step 5: Ręczna weryfikacja:** `npm link`, potem `ostrze --validate` (→ „Dane poprawne.”), `ostrze --seed 7` – przejście demo, zapis, wyjście Ctrl+C, ponowne `ostrze` → Wczytaj. Wynik zanotować w podsumowaniu.
- [ ] **Step 6: Commit** `feat: menu główne, CLI i testy e2e`.

---

## Kryterium ukończenia cyklu

- `npm test` – zielone wszystkie testy.
- `ostrze` po `npm link` – demo z zapisem/wczytaniem działa w Windows Terminal.
- `ostrze --validate` – 0 na `data/`, 1 z komunikatem na zepsutej kopii (test `cli.test.js`).
