# Cykl E1b – nowy układ paneli – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przełożyć ramki E1 na układ: tekst sceny po lewej, panel wyboru/akcji po prawej na całą wysokość, stałe menu w jednej linii na dole; walka i kreator w dwóch panelach; odrzucanie klawiszy wciśniętych przed pokazaniem ekranu.

**Architecture:** `composeFrame` (czysta funkcja, `src/ui/frame.js`) dostaje nową geometrię; `io.frame` (screen.js) niesie `choiceTitle`/`choiceInfo`; widżety (`menu.js`, `prompt.js`) rysują w prawym panelu i biorą pojemność z kompozytora; ekrany (walka, kreator) składają lewy panel. Tryb liniowy (bez TTY lub < 80×24) pozostaje bez zmian bajt w bajt.

**Tech Stack:** Node ≥ 22 ESM, `node:test`, zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-22-cykl-e1b-uklad-design.md` (poprawia E1 na gałęzi `cykl-e1`; brak nowej gałęzi – wykonanie na `cykl-e1`).

## Global Constraints

- Zero zależności; kod i komentarze po angielsku, teksty gry po polsku, id bez ogonków; commity po polsku z końcówką `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` i `Claude-Session: https://claude.ai/code/session_01Eu4yxvqBrZ6vEHNHp2m6gy`.
- Ramki tylko w TTY ≥ 80×24 (`framesOn(io)`); tryb liniowy bez zmian bajt w bajt.
- Szerokość ramki `W = min(cols, 132)`; prawy panel `R = clamp(round(W × 0.3), 30, 42)` kolumn tekstu; lewy panel tekstu `W − 7 − R`.
- Wysokość ramki = `rows − 1` wierszy (ostatni wiersz terminala to pole odpowiedzi); żaden tekst nie jest pisany pod ramką (tylko `say`/notices).
- Linie ramek `frame` (ciemna zieleń), tytuły wpisane w ramkę `frame_title` (brąz) – jak w E1.
- **R1 (stały):** testy związane ze starym układem (czytanie dolnego panelu, kolumny poleceń, `choiceRows`) adaptujemy w miejscu, zachowując progi i sens; adaptacja nie wymaga osobnego rulingu.
- Pełny zestaw: `timeout 115 npm test` (oczekiwane 815+ zielonych); `node bin/game.js --validate` → „Dane poprawne.”

## Review Focus

1. Okno 220×50: żadna linia ramki szersza niż 132; ramka nie wyższa niż `rows − 1`.
2. Okno 80×24: długie etykiety akcji walki obcięte „…”, ale pełny tekst w polu opisu; lista 12 akcji/30 pozycji przewija się z kursorem zawsze widocznym (regres z C1 E1).
3. Przejście kursora między pozycją z opisem i bez opisu nie zmienia wysokości okna listy (pole opisu ma stałą wysokość).
4. Komunikaty (> 2, „[L]”) i stałe menu razem: ramka dalej ma dokładnie `rows − 1` wierszy.
5. Klawisze wciśnięte przed narysowaniem ekranu (przytrzymane Enter) nie wykonują akcji pod kursorem.

---

### Task 1: Geometria kompozytora i warstwa ekranu

**Files:**
- Modify: `src/ui/frame.js`, `src/ui/screen.js`, `src/ui/hero_panel.js` (tylko szerokość), `test/frame.test.js`
- Create: `test/frame_read.js` (czytnik ramek do testów)

**Interfaces:**
- Produces (frame.js):
  - `composeFrame({ cols, rows, hero, title, body, commands, notices, choices, choiceTitle, info, page, bottom }) → { lines, pages, sceneRows, choiceRows, choiceWidth }` – `bottom?: { title: string, lines: string[] }`: dolny panel na całą szerokość (dziennik walki) zamiast strefy komunikatów i stałego menu; wysokość `clamp(3, round(rows × 0.16), 8)` wierszy (ostatnie linie z `lines`, najnowsza na dole), wiersz tytułu panelu `├─ title ─…─┤`; `M` liczone bez komunikatów i menu, z wysokością panelu zamiast nich – `commands`: `[{ key, label, disabled? }]` (rysowane w stałym menu, nie w kolumnie); `choices`: `string[]` (wiersze listy, już pomalowane, composer przycina „…” do `choiceWidth`); `choiceTitle?: string|null` (wpisany w prawą część wiersza tytułu, rola `frame_title`); `info?: string|null` (`null` = brak pola opisu; łańcuch, także pusty = pole zarezerwowane: separator + 4 wiersze, tekst zawijany do `choiceWidth`, ucięty „…”); `choiceRows` = liczba wierszy listy, jakie mieści prawy panel przy tych `info`.
  - `frameWidth(cols) → number` = `Math.min(cols, 132)`.
  - `sceneWidth(cols)` → `W − 7 − R` (zmiana sygnatury: bez `hasCommands`).
- Produces (screen.js): `drawFrame(io, choices, { page, info })`; `choiceCapacity(io, { info = false }) → number` (pojemność listy prawego panelu dla bieżącego `io.frame`); `io.frame` ma pola `{ hero, title, body, commands, notices, page, choiceTitle, choiceInfo?, lastChoices }` (bez `pageRows`); `showScreen(ctx, { title, text, lines, wide, blank, hero })` (usunięte `choiceRows`; `wide` ignorowane w ramce, panel prawy jest zawsze).
- Produces (test/frame_read.js): `readFrame(lines: string[]) → { hero: string[], title: string, choiceTitle: string, scene: string[], choices: string[], info: string[], notices: string[], menu: string|null }` – dzieli plansze po kolumnie `┬` wiersza tytułu (bez kolorów).

**Geometria (dokładnie):** `H = rows − 1`. Od góry: ramka górna (1); wiersze bohatera (2, gdy `hero`); wiersz tytułu (1, zawsze: `├─ title ─…─┬─ choiceTitle ─…─┤`); środek `M` wierszy (lewy: scena, prawy: lista, ewentualnie na dole separator `─` + 4 wiersze opisu); wiersz zamykający (1, `├──…┴──…┤`); komunikaty `n` wierszy (0–2; przy większej liczbie: ostatni + „…i N więcej [L]”); gdy są i komunikaty, i menu – separator (1); stałe menu (1, gdy `commands` niepuste); ramka dolna (1). Stąd `M = H − 1 − heroRows − 1 − 1 − n − (n > 0 && menu ? 1 : 0) − (menu ? 1 : 0) − 1`. Bez bohatera (menu główne): górna ramka z tytułem „OSTRZE GWIAZD”, `heroRows = 0`. `sceneRows = M`; `choiceRows = M − (info !== null ? 5 : 0)`. Przy 80×24 z bohaterem, bez komunikatów, z menu: `M = 16`.
- Stałe menu: polecenia `[X] Etykieta` rozdzielone dwiema spacjami, nieaktywne `dim`; gdy się nie mieszczą w `W − 4`, od końca skracane do `[X]`; wiersz zawsze przycięty do `W − 4`.
- Strony tekstu: strona = `M` wierszy; gdy tekst dłuższy, `M − 1` wierszy + „▼ dalej (Enter)”. `showScreen` w trakcie stron rysuje prawy panel z jedną pozycją „▶ Enter – dalej”.
- `hero_panel.js` dostaje `cols = frameWidth(io.columns)` (caller).

- [ ] **Step 1: Napisz `test/frame_read.js` i nowe testy `test/frame.test.js`** (przepisz istniejące testy geometrii na nowy układ; zachowaj testy zawijania/ucinania, ⚡ ×2, bohatera): `composeFrame` przy 80×24 (`lines.length === 23`, `choiceWidth === 30`, `sceneRows === 16`, wszystkie linie ≤ 80 kolumn), 120×40 (`choiceWidth === 36`), 220×50 (każda linia ≤ 132, `lines.length === 49`, `choiceWidth === 40`); `info: ""` zmniejsza `choiceRows` o 5, `info: null` nie; wiele komunikatów + menu = nadal `rows − 1` wierszy; menu skracane do `[X]` przy 80 kolumnach z 8 poleceniami; `choiceTitle` w wierszu tytułu; strony zależą tylko od `sceneRows` (ten sam `pages` dla `choices` długości 1 i 40).
- [ ] **Step 2: Uruchom** `node --test test/frame.test.js` – Expected: FAIL (nowe pola/geometria).
- [ ] **Step 3: Zaimplementuj** nowy `composeFrame`, `frameWidth`, `sceneWidth` w `src/ui/frame.js` wg geometrii; usuń kolumnę poleceń, `pageRows`, `choicesHeight`.
- [ ] **Step 4: Dostosuj `src/ui/screen.js`:** `drawFrame` przekazuje `choiceTitle`, `info`, `cols: frameWidth(io.columns)`; `choiceCapacity`; `showScreen` bez `choiceRows`/`pageRows`, `heroPanel` z `cols = frameWidth(io.columns)`, strony jak wyżej; `say` bez zmian logicznych. Callerów `showScreen` z `choiceRows` (narration, character_screen, journal_screen, inventory_screen, character_creation) – usuń argument.
- [ ] **Step 5: Uruchom** `node --test test/frame.test.js` – Expected: PASS. Reszta zestawu może jeszcze być czerwona (widżety w Task 1b niżej) – nie commituj bez Step 8.
- [ ] **Step 5b: Widżety – wiersze listy w ramce:** etykieta po lewej, podpowiedź/koszt (`hint`) **wyrównana do prawej** w szerokości `choiceWidth` (gdy się mieści, inaczej po spacji); pozycje `{ heading: "NAGŁÓWEK" }` w `select` są niewybieralne (kursor je przeskakuje, numeracja `[n]` ich nie liczy, rysowane przyciemnione jako `— NAGŁÓWEK —`); w trybie liniowym nagłówek to zwykła linia tekstu przed pozycjami.
- [ ] **Step 6: Widżety** (`src/ui/menu.js`, `src/ui/prompt.js`): w ramce rysują listę w prawym panelu: `select` – numeracja `[n]`/`[A]` jak dotąd, lista pionowa (usuń gałęzie `oneLine` i `columns: 2` dla ramki), opis kursora → `info` (pole opisu rezerwowane, gdy którakolwiek pozycja ma `description`), `makeWindow` bierze pojemność z `choiceCapacity(io, { info })` minus `extra` (licznik/budżet – jeden wiersz na górze listy; `multiSelect`/`sliders` jak dotąd); tytuł widżetu → `io.frame.choiceTitle` (bez wiersza w liście); `pressEnter` w ramce: pozycja „▶ Enter – dalej” w prawym panelu (bez pisania na wierszu odpowiedzi); ukryte polecenia (`hidden: true`) → `io.frame.commands` (stałe menu) jak dotąd, `[L]` dopisywane gdy > 2 komunikaty.
- [ ] **Step 7: Sterownik testowy** (`test/helpers.js`, `rowNumber`, `readFramedCombat`) i pozostałe testy TTY (`screens_tty.test.js`, `frame_fixes.test.js`, `scenes.test.js`, `e2e.test.js`, inne czerwone) – czytają wybory/akcje przez `readFrame` (prawy panel; akcje walki jedna kolumna). Adaptuj wg R1.
- [ ] **Step 8: Uruchom** `timeout 115 npm test` oraz `node bin/game.js --validate` – Expected: wszystkie zielone. Dodaj do `test/e2e.test.js` demo w TTY 80×24 **i** 160×45 (każda klatka = dokładnie `rows − 1` wierszy, ≤ 132 kolumn, brak luźnego tekstu).
- [ ] **Step 9: Commit** `feat(ui): nowy układ ramki – wybory w prawym panelu, stałe menu u dołu`.

---

### Task 2: Walka w trzech panelach (arena, akcje, dziennik)

**Files:** Modify: `src/ui/combat_screen.js`, `src/scenes/combat.js`, `data/ui.json`; Test: `test/combat_screen.test.js` (lub istniejące testy walki), `test/screens_tty.test.js`.

**Interfaces:**
- Consumes: `composeFrame`/`choiceCapacity` (Task 1).
- Produces: `renderCombat(state, data, combat, { columns, rows, tty, targetUid, logSeen, frame: true, width, height }) → { arena: string[], log: string[] }` – w trybie `frame` `arena` to dokładnie `height` wierszy dla lewego panelu o szerokości `width` (inspiracja: koncept `docs/interfejs-walka.png`, układ można dopasować do terminala): gracz i wróg obok siebie – imię, klasa/rola, pasek HP, między nimi dystans („zwarcie”/„daleko”) i „VS”, pod spodem „Stan: Tura N (Twój ruch)”; grafika ASCII obu postaci, gdy `width ≥ 84` (gracz: `data/art/gracz_<klasa>.txt`, nowe: `gracz_miecz`, `gracz_wlocznia`; wróg: jego `art`), poniżej bez grafiki; `log` to wpisy dziennika w formie `[TURA n] tekst` (kolory: wynik gracza `heal`/`check`, wróg `damage`, ostrzeżenia `warn`), przekazane do `composeFrame({ bottom: { title: "DZIENNIK ZDARZEŃ", lines } })`. Akcje walki w prawym panelu: lista pogrupowana nagłówkami (`ATAKI I BROŃ`: A, ciosy z C2c; `TECHNIKI`: T; `INNE`: O, P, C, U, K, Z, B, L), wiersze `[A] Atak` z kosztem `(N PA)` po prawej, opis zaznaczonej w polu opisu. `[L]` pełny dziennik: panel dolny rośnie na całą wysokość środka, ↑/↓ przewijają, Enter wraca. Komunikaty w walce (`notices`) trafiają do dziennika jako wpisy.

- [ ] **Step 1: Testy (RED):** (a) przy 80×24 arena zawiera imiona obu stron, paski HP, dystans i „VS”, a panel dziennika ≥ 3 ostatnie wpisy (po 5 akcjach); przy 160×45 widać grafikę wilka i gracza obok siebie, panel dziennika ≥ 6 wpisów; komunikaty z `ctx.notices` pojawiają się w dzienniku; (b) prawy panel zawiera wszystkie hotkeye akcji pionowo, opis zaznaczonej w polu opisu; (c) `[L]` przewija dziennik z 40 wpisami strzałkami; (d) lista 12 technik przewija się z widocznym kursorem w 80×24.
- [ ] **Step 2: Run** testy walki – Expected: FAIL.
- [ ] **Step 3: Implement** `renderCombat` (`frame`/`width`/`height`), `drawScreen` w `combat.js` (ustawia `io.frame.body` na wynik dla `Lw = sceneWidth`, `height = M` z probe `composeFrame`), pickery (cel, strefa, technika, przedmiot) i `[L]` w prawym panelu/lewym panelu. Usuń `columns: 2` w walce.
- [ ] **Step 4: Run** pełny zestaw – Expected: zielony (sterownik `readFramedCombat` czyta prawy panel z Task 1).
- [ ] **Step 5: Dodaj** `data/art/gracz_miecz.txt` i `gracz_wlocznia.txt` (ASCII, jak `wilk.txt`; wczytywane automatycznie przez `readArt`).
- [ ] **Step 6: Commit** `feat(ui): walka w trzech panelach – arena, akcje pogrupowane, dziennik zdarzeń`.

---

### Task 3: Kreator w dwóch panelach

**Files:** Modify: `src/scenes/character_creation.js`, `src/ui/menu.js` (opcjonalne `preview`), `data/ui.json`; Test: `test/screens_tty.test.js`, `test/scenes.test.js`.

**Interfaces:**
- Produces: `sliders(io, ui, { …, preview?: (values: number[]) => string[] })` i `multiSelect(io, ui, { …, preview?: (checked: number[]) => string[] })` – po każdej zmianie, gdy `io.frame`, `io.frame.body` = wynik `preview` (przerysowanie ramki). Podgląd kroku atrybutów: nagłówek kroku, krótki opis każdego atrybutu (z `data.attributes`) i **wartości pochodne** (HP, PA, Obrona, Inicjatywa, Udźwig, szansa na cios krytyczny) liczone z bieżących wartości przez `getStats` na podglądowej postaci (jak już robi to krok umiejętności). Krok klasy: opis klasy. Krok umiejętności: baza z bonusem wiodącej. Podsumowanie: karta postaci w dwóch kolumnach lewego panelu (jak `[P]`), prawy: „Zatwierdź / Zacznij od nowa”.

- [ ] **Step 1: Testy (RED):** zmiana suwaka Siła +1 zmienia w lewym panelu „Udźwig” (i „HP maks.” po Krzepie); podgląd przy 80×24 mieści się bez ucinania nagłówków; podsumowanie w 80×24 mieści kartę na jednej stronie (bez „▼ dalej”) – demo e2e i test kreatora w TTY bez dodatkowych Enter-ów.
- [ ] **Step 2: Run** – Expected: FAIL.
- [ ] **Step 3: Implement** opcję `preview` w widżetach (TTY w ramce; line mode ignoruje) oraz kroki kreatora.
- [ ] **Step 4: Run** pełny zestaw – Expected: zielony (testy kreatora z Enter-ami stron adaptowane wg R1).
- [ ] **Step 5: Commit** `feat(ui): kreator w dwóch panelach z podglądem na żywo`.

---

### Task 4: Pozostałe ekrany i przegląd układu

**Files:** Modify (w razie potrzeby): `src/scenes/{dialogue,shop,rest,reward,trip,map,after}.js`, `src/ui/{inventory_screen,journal_screen,character_screen,camp}.js`; Test: `test/screens_tty.test.js`.

- [ ] **Step 1: Testy (RED):** (a) sklep: lista towarów z cenami w prawym panelu, opis towaru w polu opisu (przy 80×24 i 160×45); (b) dialog: wypowiedź w lewym, odpowiedzi w prawym panelu, długi tekst stronicowany po `sceneRows`; (c) ekwipunek: nagłówek (waga, pieniądze) w lewym panelu, lista przedmiotów w prawym, karta przedmiotu w lewym; (d) każdy z ekranów: `readFrame` – brak pustego prawego panelu poza ekranami `pressEnter` (tam „Enter – dalej”).
- [ ] **Step 2: Run** – Expected: FAIL tam, gdzie ekran pisał wiersze pod wyborem lub zakładał stary układ.
- [ ] **Step 3: Implement** poprawki ekranów (np. opisy towarów jako `description`, odpowiedzi dialogu jako pozycje `select`, ewentualne skrócenie linii nagłówków do `sceneWidth`).
- [ ] **Step 4: Run** pełny zestaw + e2e z Task 1 – Expected: zielony.
- [ ] **Step 5: Commit** `feat(ui): sklep, dialog, ekwipunek i reszta ekranów w nowym układzie`.

---

### Task 5: Odrzucanie klawiszy wciśniętych przed ekranem

**Files:** Modify: `src/ui/io.js`, `src/ui/screen.js` (`showScreen`), `src/scenes/combat.js` (pierwsze rysowanie walki); Test: `test/io.test.js`.

**Interfaces:**
- Produces: `io.discardInput(graceMs = 150)` – w `createTerminalIO` czyści kolejkę sparsowanych klawiszy i ignoruje klawisze, które przyjdą w ciągu `graceMs` ms; w `createScriptedIO` i adaptacyjnym sterowniku: no-op. Wołane z `showScreen` (po `clear`) i przy pierwszym narysowaniu ekranu walki; **nie** przy przerysowaniach widżetów (przytrzymana strzałka nadal działa).

- [ ] **Step 1: Test (RED)** `terminal IO: discardInput gubi klawisze sprzed ekranu i z okresu karencji`: `PassThrough`, wpisz `"\r\r\r"`, `io.discardInput(50)`, odczekaj 20 ms, wpisz `"\r"`, `await` krótki timeout na `readKey` → nie dostaje żadnego klawisza; po 80 ms wpisz `"\r"` → dostaje `enter`.
- [ ] **Step 2: Run** `node --test test/io.test.js` – Expected: FAIL (`discardInput` nie istnieje).
- [ ] **Step 3: Implement** `discardInput` w `createTerminalIO` (znacznik czasu odrzucenia, czyszczenie kolejki), no-op w scripted IO; wywołaj w `showScreen` i przy starcie walki.
- [ ] **Step 4: Test (RED→GREEN)** ekran: po `showScreen` w TTY `io.discardInput` jest wywołane raz (szpieg na scripted IO).
- [ ] **Step 5: Run** pełny zestaw – Expected: zielony.
- [ ] **Step 6: Commit** `fix(ui): klawisze wciśnięte przed pokazaniem ekranu są odrzucane`.

---

### Task 6: Dokumentacja i szlif

**Files:** Modify: `docs/koncepcja-gry.md` (rozdz. 15), `docs/superpowers/specs/2026-10-22-cykl-e1b-uklad-design.md` (status), `data/ui.json` (nowe klucze).

- [ ] **Step 1:** Zaktualizuj rozdział 15 „Interfejs” i status specu (wykonany).
- [ ] **Step 2: Run** `timeout 115 npm test` i `node bin/game.js --validate` – Expected: zielony.
- [ ] **Step 3: Commit** `docs: układ paneli E1b`.
