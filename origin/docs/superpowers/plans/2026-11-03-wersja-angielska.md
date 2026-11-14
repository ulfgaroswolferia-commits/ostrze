# Wersja angielska: plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zrobić grę w pełni grywalną po angielsku, z wyborem języka przy pierwszym uruchomieniu i w menu głównym.

**Architecture:** Polskie dane zostają źródłem. Przekład leży w nakładce `data/lang/en/` z tym samym układem plików. Każdy wpis nakładki ma ścieżkę do pola tekstowego, przekład i skrót polskiego tekstu. `loadData` kładzie nakładkę na dane przed zamrożeniem, więc reszta kodu widzi gotowe dane w jednym języku. Przekład idzie przez narzędzia `tools/i18n/`, które wypisują listę roboczą tekstów danego zakresu (aktu) i wkładają gotowy przekład do nakładki.

**Tech Stack:** Node ≥ 22, ESM, `node:test`, bez nowych zależności.

**Spec:** `docs/superpowers/specs/2026-11-03-wersja-angielska-design.md`. Próbki tonu, które użytkownik widział: `docs/i18n/probki-en.md`.

## Global Constraints

- Polskie dane są źródłem. Nakładka zawiera tylko pola tekstowe. Pole liczbowe albo logiczne w nakładce to błąd walidacji.
- Format zapisu gry się nie zmienia (`SAVE_FORMAT_VERSION` = 13). Zapisy nie zawierają tekstu.
- Ustawienie `language` (`"pl"` albo `"en"`) leży w `~/.ostrze/config.json`, obok `graphics`.
- `--lang pl|en` nadpisuje ustawienie na jedno uruchomienie i go nie zapisuje.
- Tytuł po angielsku to „Voided: Defying the Stars”.
- Komunikaty walidacji danych i błędy wiersza poleceń dla twórcy zostają po polsku. `--help` i wszystko, co widzi gracz, ma przekład.
- Ton: sucho, rubasznie, z przekłuwanymi wymianami zdań jak w angielskim Wiedźminie 3. Bez kwiecistych metafor i pseudo-aforyzmów. Przekład idzie za sensem, nie za każdym słowem, bez kalk. Wzór jest w `docs/i18n/probki-en.md`.
- Słownik: imiona osób zostają polskie. Nazwę miejsca tłumaczy się, jeśli jest zbitką pospolitych słów albo ma naturalny angielski odpowiednik: Wolf's Ford, Glass Hills, Crow Mountain, Bald Rock, Brzezina → Birchgrove. Wymyślona nazwa własna bez łatwego odpowiednika zostaje w oryginale. Dotyczy to też nazwy podobnej do pospolitego słowa, jeśli od niego nie pochodzi: Głuszec od „głuszy” (zadupia), nie od ptaka. Zostają więc Głuszec, Ulfgród, Jarnowo. (Decyzja użytkownika z 2026-11-03.) Grosze to „groats”, skrót „gr” zostaje. Atrybuty: Strength, Agility, Endurance, Perception, Wits, Charm, Luck.
- Testy uruchamia się przez `npm test -- --test-concurrency=2`, bo maszyna ma mało pamięci.
- Każdy commit kończy się stopką z atrybucją ustaloną w sesji.
- Obecne testy działają dalej po polsku, bez zmian w oczekiwanych tekstach.

## Review Focus

1. **Polska odmiana w angielskim zdaniu.** Wróg bez `nameAcc` w nakładce pokazałby polski biernik („Bandytę”). Oczekiwanie: pola przypadków biorą angielską nazwę. Test w zadaniu 1.
2. **Za długie angielskie napisy.** Wiersz menu albo karta przedmiotu może wyjść poza ramkę przy szerokości 80 kolumn. Oczekiwanie: wszystko się mieści albo zawija. Test w zadaniu 8.
3. **Zmiana języka z wczytanym zapisem.** Oczekiwanie: stan gry się nie zmienia, teksty są w nowym języku, a zapis wczytuje się dalej w obu językach. Test w zadaniu 5.
4. **Uszkodzona albo brakująca nakładka.** Oczekiwanie: gra działa po polsku, a walidacja mówi, który plik jest zły. Gra się nie wywraca. Test w zadaniu 2.
5. **Zła wartość `language` w pliku ustawień.** Oczekiwanie: traktowana jak brak, więc gra pokazuje ekran wyboru. Test w zadaniu 5.

---

## Struktura plików

| Plik | Odpowiedzialność |
|---|---|
| `src/i18n/overlay.js` | czyste funkcje: wypisanie pól tekstowych pliku, nałożenie nakładki, skrót tekstu, sprawdzenie nakładki |
| `src/engine/data.js` | `loadData(dir, { lang })` czyta i nakłada `lang/<lang>/` |
| `src/ui/strings.js` | `t()` z liczbą mnogą |
| `src/config.js` | `loadLanguage()`, `saveLanguage()` |
| `src/ui/language_screen.js` | ekran pierwszego wyboru języka |
| `tools/i18n/scope.mjs` | przypisanie każdego wpisu do zakresu: `wspolne`, `akt1`…`akt5`, `final` |
| `tools/i18n/extract.mjs`, `apply.mjs`, `stale.mjs` | lista robocza, wkładanie przekładu, raport nieaktualnych |
| `data/lang/en/**` | nakładka angielska |
| `docs/i18n/slownik-en.md` | słownik |

---

## Część A: mechanizm

### Task 1: Rdzeń nakładki

**Files:**
- Create: `src/i18n/overlay.js`
- Test: `test/i18n_overlay.test.js`

**Interfaces:**
- Produces:
  - `textEntries(file: string, json: unknown): Map<string, string>` zwraca ścieżki pól tekstowych i ich polskie teksty. `file` to ścieżka względna, np. `items.json` albo `dialogues/kowal.json`.
  - `applyOverlay(file, json, overlay): unknown` zwraca nową kopię danych z przekładem.
  - `hashText(s: string): string` zwraca 8 znaków szesnastkowych, czyli pierwsze 8 znaków SHA-1 z `node:crypto`.
  - `checkOverlay(file, json, overlay): { missing: string[], stale: string[], orphan: string[], varMismatch: string[], nonText: string[] }`
  - Stała `CASE_KEYS = ["nameAcc"]`.
- **Format nakładki:** plik `data/lang/en/<file>`, obiekt `{ "<ścieżka>": { "t": "<przekład>", "h": "<hashText polskiego tekstu>" } }`.
- **Ścieżka:** segmenty łączone kropką. Element tablicy z polem `id` adresuje się jako `[id]`, a bez `id` jako `#indeks`. Przykłady: `[miecz_krotki].name`, `nodes.kuznia.options.[odlamek].text`, `scenes.[prolog_wstep].text`, `events.[pielgrzym].scenes.[pielgrzym_spotkanie].text`.
- **`ui.json`:** każdy klucz jest ścieżką, np. `menu.graphics`.
- **Pola tekstowe:** to klucze z listy `TEXT_KEYS` w `overlay.js`. Wykonawca ustala listę, przeglądając dane; na pewno należą do niej `name`, `nameAcc`, `description`, `text`, `title`, `label`. Wartości `ui.json` są tekstem w całości.

- [ ] **Step 1: Testy**

```js
test("textEntries: tablica po id, tablica bez id po indeksie, ui po kluczu", () => {
  const e = textEntries("items.json", [{ id: "a", name: "Miecz", value: 3 }]);
  assert.deepEqual([...e], [["[a].name", "Miecz"]]);
  assert.deepEqual([...textEntries("x.json", { list: [{ text: "Raz" }] })], [["list.#0.text", "Raz"]]);
  assert.deepEqual([...textEntries("ui.json", { "menu.new": "Nowa gra" })], [["menu.new", "Nowa gra"]]);
});
test("applyOverlay podmienia tylko teksty i nie zmienia oryginału", () => { /* liczby i id bez zmian, wejście nietknięte */ });
test("pola przypadków bez przekładu biorą przetłumaczoną nazwę", () => {
  const out = applyOverlay("enemies.json", [{ id: "b", name: "Bandyta", nameAcc: "Bandytę" }], { "[b].name": { t: "Bandit", h: hashText("Bandyta") } });
  assert.equal(out[0].nameAcc, "Bandit");
});
test("checkOverlay: brak, nieaktualny, osierocony, inne zmienne, pole nietekstowe", () => {
  /* po jednym przypadku na każdą listę; {n} w polskim a {count} w angielskim → varMismatch; wpis "[a].value" → nonText */
});
test("pola przypadków nie liczą się jako brak przekładu", () => {});
test("każdy tekst z prozą w danych leży pod kluczem z TEXT_KEYS", () => {
  /* przejdź wszystkie pliki data/ (bez art, maps); każdy string ze spacją i co najmniej 3 literami musi mieć ścieżkę w textEntries albo leżeć na liście wyjątków w teście */
});
```

- [ ] **Step 2:** `node --test test/i18n_overlay.test.js` → FAIL.
- [ ] **Step 3: Zaimplementuj.** Moduł jest czysty: bez dostępu do plików i bez stanu.
- [ ] **Step 4:** `node --test test/i18n_overlay.test.js` → PASS.
- [ ] **Step 5: Commit:** `feat: rdzeń nakładki językowej`

### Task 2: Ładowanie, walidacja i opcje wiersza poleceń

**Files:**
- Modify: `src/engine/data.js`, `src/cli.js`
- Test: `test/i18n_load.test.js`

**Interfaces:**
- Consumes: zadanie 1.
- Produces:
  - `loadData(dir = dataDir(), { lang = "pl" } = {})`. Przy `lang !== "pl"` czyta `dir/lang/<lang>/`, nakłada każdy plik i podmienia całe mapy z `lang/<lang>/maps/*.txt`. Wynik ma pole `lang`.
  - `translationReport(dir, lang): Promise<{ errors: string[], warnings: string[], perFile: Record<string, {missing, stale}> }>`.
  - Mapa przetłumaczona musi mieć te same znaczniki `{id}` co polska. Inaczej zgłaszany jest błąd.
- **CLI:**
  - `--lang pl|en`;
  - `--strict`, czyli braki i nieaktualne wpisy są błędem;
  - `--scope <nazwa>` ogranicza `--strict` do zakresu z zadania 6 (do czasu zadania 6 opcja przyjmuje tylko `all`).
  - `--validate --lang en` wypisuje ostrzeżenia z liczbą braków na plik, potem „Dane poprawne.”.

- [ ] **Step 1: Testy**

```js
test("loadData z lang en nakłada przekład i mapy", async () => { /* katalog tymczasowy z małą kopią danych testowych */ });
test("brak katalogu lang/en: dane po polsku, ostrzeżenie w raporcie", async () => {});
test("uszkodzony JSON nakładki: dane po polsku, błąd z nazwą pliku w raporcie, bez wyjątku z loadData", async () => {});
test("mapa z innymi znacznikami {id} to błąd", async () => {});
test("--validate --lang en --strict kończy się kodem 1 przy brakach", async () => {});
test("nakładka nie zmienia mechaniki: dane en bez pól tekstowych równe danym pl", async () => { /* na prawdziwych data/ */ });
```

- [ ] **Step 2:** FAIL. **Step 3:** zaimplementuj. **Step 4:** `npm test -- --test-concurrency=2` oraz `node bin/game.js --validate` → PASS.
- [ ] **Step 5: Commit:** `feat: ładowanie nakładki i walidacja przekładu`

### Task 3: Liczba mnoga

**Files:**
- Modify: `src/ui/strings.js`, `src/ui/map_screen.js:13-18`, `data/ui.json`
- Test: `test/strings.test.js` (dopisz albo utwórz)

**Interfaces:**
- **Format w szablonie:** `{n|forma1|forma2}` albo `{n|forma1|forma2|forma3}`, gdzie `n` to nazwa zmiennej liczbowej.
  - Dwie formy, reguła angielska: 1 → forma1, reszta → forma2.
  - Trzy formy, reguła polska: 1 → forma1; końcówka 2–4 poza 12–14 → forma2; reszta → forma3.
  - Sama liczba zostaje osobnym `{n}`, np. `"{n} {n|dzień|dni|dni}"`.
- Ręczną odmianę w `map_screen.js` zastąp szablonem w `ui.json`.

- [ ] **Step 1: Testy**

```js
for (const [n, pl, en] of [[0,"bełtów","bolts"],[1,"bełt","bolt"],[2,"bełty","bolts"],[5,"bełtów","bolts"],[12,"bełtów","bolts"],[21,"bełtów","bolts"],[22,"bełty","bolts"]])
  test(`liczba mnoga ${n}`, () => {
    assert.equal(t({ k: "{n|bełt|bełty|bełtów}" }, "k", { n }), pl);
    assert.equal(t({ k: "{n|bolt|bolts}" }, "k", { n }), en);
  });
test("dni na mapie jak dotąd", () => { /* 1 dzień, 2 dni, 5 dni */ });
```

- [ ] **Step 2–4:** FAIL, potem zaimplementuj, potem PASS w całym zestawie.
- [ ] **Step 5: Commit:** `feat: liczba mnoga w szablonach`

### Task 4: Napisy z kodu do ui.json

**Files:**
- Modify: pliki `src/` z napisami dla gracza (pełną listę daje Step 1), `data/ui.json`, `src/ui/title_screen.js` (podtytuł z klucza `title.tagline`)
- Test: `test/i18n_source_strings.test.js`

**Interfaces:**
- Produces: nowe klucze w `ui.json` z polskimi tekstami, identycznymi z dotychczasowymi.
- Lista wyjątków dla twórcy, czyli pliki, w których polskie napisy mogą zostać: `src/engine/data.js`, `src/engine/schema.js`, `src/scenes/schemas.js`, komunikaty `--seed`/`--scene` i „Dane poprawne.” w `src/cli.js` oraz `src/engine/save.js` dla ostrzeżeń naprawy zapisu. Wyjątki zapisuje się w teście z komentarzem przy każdym.

- [ ] **Step 1: Test.** Przejdź `src/**/*.js` i znajdź literały z polskimi literami albo z prozą (spacja i co najmniej 3 litery) poza komentarzami. Każdy taki literał musi leżeć w pliku z listy wyjątków. Dziś jest ich około 80.
- [ ] **Step 2:** FAIL z listą miejsc. **Step 3:** przenieś napisy do `ui.json`. **Step 4:** cały zestaw testów PASS bez zmian w oczekiwanych tekstach.
- [ ] **Step 5: Commit:** `refactor: napisy gracza z kodu do ui.json`

### Task 5: Wybór języka

**Files:**
- Create: `src/ui/language_screen.js`
- Modify: `src/config.js`, `src/app.js`, `src/cli.js`, `data/ui.json`
- Test: `test/language_choice.test.js`

**Interfaces:**
- Consumes: `loadData(dir, { lang })` z zadania 2.
- Produces:
  - `loadLanguage(): "pl" | "en" | null`, gdzie `null` oznacza brak ustawienia albo złą wartość;
  - `saveLanguage(lang)`;
  - `runApp({ data, io, options, reloadData })`, gdzie `reloadData(lang) → Promise<data>` przekazuje `cli.js`.
- **Ekran wyboru:** „Wybierz język / Choose language” z dwoma wierszami „Polski” i „English”. Pokazuje się tylko wtedy, gdy `loadLanguage()` zwraca `null` i nie podano `--lang`. Wybór jest zapisywany.
- **Menu główne:** wiersz `menu.language` („Język: polski” / „Language: English”) obok grafik. Wybór przełącza język, zapisuje go i przeładowuje dane, a menu rysuje się od nowa w nowym języku.

- [ ] **Step 1: Testy**

```js
test("pierwsze uruchomienie bez ustawienia pyta o język i zapisuje wybór", async () => {});
test("zła wartość language w config.json: ekran wyboru", async () => {});
test("--lang en nie pyta i nie zapisuje", async () => {});
test("zmiana języka w menu przeładowuje dane i zapisuje ustawienie", async () => {});
test("wczytany zapis po zmianie języka: ten sam stan, teksty w nowym języku", async () => {});
```

  Te testy przechodzą przez `runApp` ze skryptowanym `io`, jak inne testy e2e w `test/`. Obecne testy e2e muszą działać bez zmian, więc w testach brak ustawienia oznacza polski bez pytania. Rozstrzyga to jawna opcja `options.askLanguage`, którą włącza tylko `cli.js` przy prawdziwym terminalu.
- [ ] **Step 2–4:** FAIL, zaimplementuj, PASS w całym zestawie.
- [ ] **Step 5: Commit:** `feat: wybór języka`

### Task 6: Narzędzia przekładu

**Files:**
- Create: `tools/i18n/scope.mjs`, `tools/i18n/extract.mjs`, `tools/i18n/apply.mjs`, `tools/i18n/stale.mjs`, `tools/i18n/README.md`
- Modify: `src/cli.js` (`--scope` przyjmuje nazwy zakresów)
- Test: `test/i18n_tools.test.js`

**Interfaces:**
- Produces:
  - `scopeOf(data): Map<"<file>|<path>", Scope>`, gdzie `Scope` to `"wspolne" | "akt1" | "akt2" | "akt3" | "akt4" | "akt5" | "final"`.
  - `node tools/i18n/extract.mjs --scope akt1 --kind story|dialogues|travel|quests|maps|all --out <plik>` wypisuje tablicę `[{ file, path, pl, en: "" }]` tylko z brakujących i nieaktualnych wpisów.
  - `node tools/i18n/apply.mjs <plik>` wkłada wpisy z niepustym `en` do nakładki i liczy `h` z bieżącego polskiego tekstu. Odrzuca cały plik, jeśli ścieżka nie istnieje albo zmienne się nie zgadzają.
  - `node tools/i18n/stale.mjs` wypisuje nieaktualne wpisy z polskim tekstem sprzed zmiany, odnalezionym w historii git po skrócie, oraz z obecnym tekstem.
- **Zasady przypisania zakresu:**
  - sceny `story.json` po prefiksie id: `prolog`, `demo` → `akt1`; `akt2` → `akt2`; `akt3*` → `akt3`; `akt4*` i `schody` → `akt4`; `akt5*` → `akt5`; `akt6` → `final`;
  - regiony `travel.json`: `pogorze` → `akt2`; `glusz`, `gwiazdy` → `akt3`; `front`, `stolica`, `loch` → `akt4`; `jarnowo`, `morze` → `akt5`; `wir` → `final`;
  - zdarzenie z warunkiem na kilka regionów trafia do najwcześniejszego z nich;
  - zadanie trafia do zakresu regionu swojego `hub`;
  - dialog trafia do najwcześniejszego zakresu sceny, miejsca albo zdarzenia, które go wywołuje;
  - mapa trafia do zakresu swojego regionu;
  - wszystko inne trafia do `wspolne`.

  Jeśli prefiks albo region nie pasuje do treści aktu, wykonawca poprawia tabelę w `scope.mjs` i opisuje to w raporcie.

- [ ] **Step 1: Testy**

```js
test("każdy wpis danych ma zakres", () => {});
test("prolog_wstep to akt1, wilczy_brod to akt2, dialog kowal to akt2", () => {});
test("extract → apply → checkOverlay bez braków dla tych wpisów", () => { /* w katalogu tymczasowym */ });
test("apply odrzuca złą ścieżkę i niezgodne zmienne, nic nie zapisując", () => {});
```

- [ ] **Step 2–4:** FAIL, zaimplementuj, PASS.
- [ ] **Step 5: Commit:** `feat: narzędzia przekładu`

### Task 7: Generator ulepszeń z wersją angielską

**Files:**
- Modify: `tools/upgrades/workshops.mjs`, `tools/upgrades/recipes.mjs`, `tools/upgrades/generate.mjs`
- Create (generowane): `data/lang/en/dialogues/ulepszenia_*.json`
- Test: `test/upgrades_workshops.test.js` (dopisz)

**Interfaces:**
- Consumes: format nakładki z zadania 1.
- Kwestie kowali i opisy ulepszeń dostają pola `en` obok polskich w tabelach generatora. Generator zapisuje nakładkę z poprawnymi `h`. Kwestie angielskie pisze się w tonie z Global Constraints. Ręczna edycja wygenerowanych plików nie wchodzi w grę.

- [ ] **Step 1: Test:** `node bin/game.js --validate --lang en --strict --scope all` nie zgłasza braków w `dialogues/ulepszenia_*.json`, a ponowne uruchomienie generatora nie zmienia plików.
- [ ] **Step 2–4:** FAIL, zaimplementuj, `node tools/upgrades/generate.mjs && npm test -- --test-concurrency=2` → PASS.
- [ ] **Step 5: Commit:** `feat: generator ulepszeń z przekładem`

### Task 8: Przekład interfejsu

**Files:**
- Create: `data/lang/en/ui.json`
- Test: `test/i18n_ui_en.test.js`

**Interfaces:**
- Consumes: `extract`/`apply` z zadania 6, liczba mnoga z zadania 3.
- Przekład obejmuje całe `ui.json`, w tym `cli.help`, `title.tagline` („Voided: Defying the Stars”) i ekran błędu. Atrybuty i waluta idą według Global Constraints.

- [ ] **Step 1: Testy:**
  - `--validate --lang en --strict` bez braków w `ui.json`;
  - menu, walka, ekwipunek i karta przedmiotu po angielsku, uruchomione przez prawdziwe ekrany przy 80 kolumnach: żaden wiersz nie przekracza szerokości ramki i nie ma polskich liter w tekstach z `ui.json`.
- [ ] **Step 2–4:** FAIL, przetłumacz, PASS.
- [ ] **Step 5: Commit:** `feat: interfejs po angielsku`

## Część B: przekład treści

Zadania 10–27 robi się tak samo:
1. `extract` dla zakresu i rodzaju z zadania;
2. przekład listy roboczej według Global Constraints i słownika;
3. `apply`;
4. `--validate --lang en --strict --scope <zakres>` dla przetłumaczonego rodzaju;
5. przejście skryptem przez prawdziwe ekrany kawałka tego zakresu po angielsku (`--lang en`) przy 80 kolumnach, z wypisaniem fragmentu tekstu do raportu; żaden wiersz nie może wyjść poza ramkę;
6. commit `feat: przekład <zakres> – <rodzaj>`.

Przegląd zadania sprawdza przekład z polskim oryginałem: sens, ton, słownik, zmienne i kalki. Nowe nazwy własne trafiają do słownika w tym samym zadaniu.

### Task 9: Słownik

**Files:**
- Create: `docs/i18n/slownik-en.md`
- Test: `test/i18n_glossary.test.js`

Słownik ma tabele z kolumnami: PL | EN | wzorzec PL (wyrażenie regularne, które obejmuje formy odmienione, np. `Wilcz\w* Brod\w*|Wilczy Bród`) | uwagi.

Obejmuje:
- wszystkie miejsca z `travel.json`, regiony, frakcje i stopnie poszukiwań;
- atrybuty, umiejętności, efekty, typy obrażeń, typy broni, perki i zjawiska;
- walutę i stałe terminy z próbek („burza iskier” → spark storm, „kamień z nieba” → stone from the sky, „Matka” → Mother).

Nazwy miejsc idą według zasady z Global Constraints. Przy nazwach, których pochodzenia nie da się ustalić z tekstu gry, wykonawca zapisuje w kolumnie uwag swoje założenie, a kontroler podaje te nazwy użytkownikowi razem z próbką po zadaniu 15.

- [ ] **Step 1: Test:** dla każdego wpisu nakładki, którego polski tekst pasuje do wzorca PL, angielski tekst zawiera EN. Wiersze bez wzorca nie są sprawdzane.
- [ ] **Step 2–4:** test przechodzi, bo nakładki treści jeszcze nie ma, oraz `--validate` → PASS.
- [ ] **Step 5: Commit:** `docs: słownik przekładu`

### Tasks 10–12: Wspólne dane

| Task | Pliki (zakres `wspolne`) |
|---|---|
| 10 | `attributes.json`, `skills.json`, `classes.json`, `perks.json`, `effects.json`, `phenomena.json`, `rules.json` (jeśli ma teksty) |
| 11 | `items.json`, `shops.json`, `loot.json`. Po przekładzie items.json uruchom `node tools/upgrades/generate.mjs`; wpisy `_u*` zostaw generatorowi (extract je pomija albo apply ich nie nadpisuje). |
| 12 | `enemies.json` |

Przejście skryptem: tworzenie postaci, karta postaci, sklep, ekwipunek i jedna walka po angielsku.

### Tasks 13–15: Prolog i akt I (`akt1`)

| Task | Rodzaj |
|---|---|
| 13 | `story` i `quests` |
| 14 | `dialogues` |
| 15 | `travel` i `maps` |

Po zadaniu 15 praca **staje**. Kontroler daje użytkownikowi próbkę: wycinek przejścia skryptem i tabelę z 30 losowymi wpisami PL/EN z tego zakresu, w formacie jak `docs/i18n/probki-en.md`. Uwagi użytkownika trafiają do słownika i do Global Constraints tego planu, zanim pójdzie zadanie 16.

### Tasks 16–27: Akty II–V

Po trzy zadania na zakres, w tym samym podziale co 13–15: zadania 16–18 to `akt2`, 19–21 `akt3`, 22–24 `akt4`, 25–27 `akt5`.

### Task 28: Finał i wydanie

**Files:**
- Create: przekład zakresu `final` (zakończenia, epilog, Wir) i resztek z zakresu `wspolne`, które wskaże `extract --scope wspolne`
- Modify: `README.en.md` (atrybuty według słownika, sekcja o wyborze języka i `--lang`), `README.md` (sekcja o języku)
- Test: `test/i18n_full.test.js`

- [ ] **Step 1: Testy:**
  - `node bin/game.js --validate --lang en --strict` bez ostrzeżeń dla całej gry;
  - skryptowane przejście po angielsku przez początek każdego aktu (`--scene`) bez polskich liter w tekście ekranu, z wyjątkiem imion i nazw ze słownika, które zostają polskie.
- [ ] **Step 2–4:** dokończ przekład, PASS.
- [ ] **Step 5: Commit:** `feat: przekład finału, README`

Wydanie nowej wersji (podbicie wersji, kopia publiczna, npm, GitHub) robi się osobno, na prośbę użytkownika, według zasad publikacji.
