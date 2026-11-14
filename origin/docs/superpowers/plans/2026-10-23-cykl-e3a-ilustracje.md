# Cykl E3a – ilustracje pixel-art – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kolorowe ilustracje w półblokach (format `.pix`) dla wrogów, portretów, scen i etapów podróży, z automatycznym ASCII w trybie liniowym i układem zależnym od rozmiaru okna.

**Architecture:** `src/engine/pix.js` (parser/limity) → `data.art` (zamrożone obiekty) → `src/ui/pixels.js` (render kolor/ASCII, czysta funkcja) → `composeFrame` dostaje `art` i sam wybiera układ obok/nad/brak → `showScreen` przyjmuje `art: id`. Walka używa tego samego renderera.

**Tech Stack:** Node ≥ 22 ESM, `node:test`, zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-23-cykl-e3a-ilustracje-design.md` (gałąź `cykl-e3a`).

## Global Constraints

- Zero zależności; kod i komentarze po angielsku, teksty gry po polsku, id bez ogonków; commity po polsku z końcówką `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` i `Claude-Session: https://claude.ai/code/session_01CSUDEqmx6DsMRLPg8xRKSu`.
- Format: `data/art/<id>.pix`, linia `paleta: a=236 b=94 …` (litera `a–z` → numer 0–255, `.` = przezroczysty), `#` w pierwszej kolumnie = komentarz, wiersze równej długości, parzysta liczba wierszy; pliki z CRLF muszą się parsować.
- Limity (px): scena/etap `48×20`, portret `20×20`, wróg `40×16`; rozmiar sprawdzany względem **użycia**, nie nazwy.
- Układ w ramce: **obok** gdy `L − art.width − 2 ≥ 50` (`L` = szerokość lewego panelu); **nad tekstem** gdy nie obok i `sceneRows − artRows ≥ 8`; inaczej **brak**. Ilustracja tylko na stronie 0 sceny. W 80×24 (`sceneRows = 16`) ilustracji nie ma i ramka jest bajt w bajt jak przed E3a.
- `MAX_WIDTH` ramki = 200 (było 132); `R = clamp(round(W·0.3), 30, 42)`; wysokość ramki = `rows − 1`.
- Tryb liniowy scen i dialogów: bez ilustracji. Walka w trybie liniowym (TTY bez ramki): ASCII z pikseli zamiast starego rysunku.
- Pełny zestaw: `timeout 115 npm test` (oczekiwane 830+ zielonych); `node bin/game.js --validate` → „Dane poprawne.”

## Review Focus

1. 80×24: ramka z `art` w danych identyczna z ramką bez `art` (żaden wiersz, żadna strona więcej).
2. Okno 220×50 z ilustracją, 2 komunikatami i stałym menu: ramka dalej ma dokładnie `rows − 1` wierszy i ≤ 200 kolumn.
3. Tekst dłuższy niż strona w trybie „nad”: ilustracja tylko na pierwszej stronie, kolejne strony mają pełny panel, „▼ dalej” bez zmian.
4. Plik `.pix` z CRLF, komentarzami i pustymi liniami na końcu; plik z błędem (nieznana litera, nierówny wiersz) → czytelny komunikat `art/<plik> › wiersz N: …`, kod wyjścia ≠ 0.
5. Komórki w pełni przezroczyste i `NO_COLOR`: spacje, bez wycieku sekwencji ANSI.

**Rulings:** R1 – w układzie „obok” tekst jest zawijany do węższej szerokości na wszystkich stronach sceny (strony po pierwszej bez ilustracji, ale z tym samym zawijaniem); R2 – próg „nad tekstem” to 8 wierszy tekstu (spec poprawiony z 6, bo 6 dawało ilustrację w 80×24).

---

### Task 1: Format `.pix`, loader, migracja wrogów

**Files:**
- Create: `src/engine/pix.js`, `test/pix.test.js`
- Modify: `src/engine/data.js` (`readArt`, komentarz `loadData`), `data/art/*` (4 × `.txt` → `.pix`), `test/helpers.js` (`readArt`), `test/data.test.js` (jeśli odwołuje się do `.txt`)

**Interfaces:**
- Produces (pix.js): `parsePix(text: string): { w: number, h: number, palette: Record<string, number>, rows: string[] }` – rzuca `PixError` (message `wiersz N: opis`, N od 1 w pliku); `ART_LIMITS = { scene: { w: 48, h: 20 }, portrait: { w: 20, h: 20 }, enemy: { w: 40, h: 16 } }`; `class PixError extends Error`.
- Produces (data.js): `data.art[id] = { w, h, palette, rows }` (zamrożone); błędy plików zebrane w jednym `DataLoadError` (`art/<plik> › wiersz N: …`, po jednej linii na błąd).

- [ ] **Step 1: Testy (RED)** `test/pix.test.js`: poprawny plik (komentarz, CRLF, pusta linia na końcu) → `{ w, h, palette, rows }`; błędy z numerem wiersza: brak `paleta:`, nieznana litera w siatce, litera palety `.` lub spoza `a–z`, numer poza 0–255, wiersz o innej długości, nieparzysta liczba wierszy, pusta siatka.
- [ ] **Step 2: Run** `node --test test/pix.test.js` – Expected: FAIL (brak modułu).
- [ ] **Step 3: Implement** `parsePix`, `PixError`, `ART_LIMITS` w `src/engine/pix.js`.
- [ ] **Step 4: Loader:** `readArt` czyta tylko `*.pix` (sort po nazwie), parsuje, zbiera błędy wszystkich plików w jeden `DataLoadError`; zaktualizuj `test/helpers.js › readArt` tak samo (`parsePix`).
- [ ] **Step 5: Migracja:** jednorazowy skrypt (w scratchpadzie, nie w repo) zamienia 4 pliki `.txt` na `.pix` – każdy niepusty znak → `a` w palecie `a=250`, spacja → `.`, wysokość dopełniona pustym wierszem do parzystej; usuń `.txt`. (Prawdziwa kolorowa wersja powstaje w Task 6.)
- [ ] **Step 6: Run** `timeout 115 npm test` i `node bin/game.js --validate` – Expected: zielone; adaptuj testy odwołujące się do `.txt` lub starego `data.art` jako `string[]` (walka: tymczasowo `renderCombat` ma nie rzucać – puste wiersze zamiast `art[i]`, dopóki Task 5 nie dostarczy renderera).
- [ ] **Step 7: Commit** `feat(art): format .pix – parser, loader, migracja grafik wrogów`.

---

### Task 2: Renderer pikseli i `--art`

**Files:**
- Create: `src/ui/pixels.js`, `test/pixels.test.js`
- Modify: `src/ui/colors.js`, `src/cli.js`, `data/ui.json` (`cli.help`, `cli.artUnknown`), `test/cli.test.js`

**Interfaces:**
- Consumes: kształt `{ w, h, palette, rows }` z Task 1.
- Produces: `renderPixels(art, { color }: { color: boolean }): string[]` – `art.h / 2` wierszy po `art.w` komórek; `luminance(index: number): number` (0–255; xterm: 0–15 tablica systemowa, 16–231 sześcian 6×6×6 poziomy `[0,95,135,175,215,255]`, 232–255 szarości `8 + 10·n`); `colors.js`: `useColor(): boolean` = kolory włączone (TTY, bez `NO_COLOR`) **i** terminal z 256 kolorami.
- Produces (CLI): `--art <id>` drukuje obraz (`renderPixels(art, { color: useColor() })`) i kończy kodem 0; nieznane id → `stderr` z `t(ui, "cli.artUnknown", { id })` i kod 1.

- [ ] **Step 1: Testy (RED)** `test/pixels.test.js`: (a) kolor: górny `A` + dolny `B` = `\x1b[38;5;{A}m\x1b[48;5;{B}m▀`, tylko górny = `\x1b[38;5;{A}m▀`, tylko dolny = `\x1b[38;5;{B}m▄`, oba przezroczyste = spacja; każdy wiersz kończy się `\x1b[0m`; (b) ASCII: biały piksel (15) → `@`, czarny (0) → pierwszy znak rampy ` .:-=+*#%@` wg `luminance`, przezroczysta komórka → spacja, komórka z jednym pikselem liczy tylko ten piksel; (c) liczba wierszy = `art.h / 2`, każda linia (bez ANSI) ma `art.w` kolumn; (d) `luminance(15) > luminance(8) > luminance(0)`. `test/cli.test.js`: `main(["--art", "bandyta"])` → kod 0 i niepuste wyjście; `main(["--art", "nie_ma"])` → kod 1.
- [ ] **Step 2: Run** – Expected: FAIL.
- [ ] **Step 3: Implement** `renderPixels`/`luminance` (`src/ui/pixels.js`), `useColor` (`colors.js`, współdzielone z `paint`), opcja `art` w `parseArgs` i gałąź w `main` po walidacji danych, teksty pomocy.
- [ ] **Step 4: Run** pełny zestaw + `node bin/game.js --art bandyta` – Expected: zielone, rysunek w terminalu.
- [ ] **Step 5: Commit** `feat(art): renderer półblokowy i ASCII, podgląd --art`.

---

### Task 3: Układ ramki z ilustracją

**Files:**
- Modify: `src/ui/frame.js`, `src/ui/screen.js`, `test/frame.test.js`, `test/frame_fixes.test.js`, `test/e2e.test.js` (limit 132 → 200), `test/screens_tty.test.js`

**Interfaces:**
- Consumes: `renderPixels`, `useColor` (Task 2) – tylko w `showScreen`; `composeFrame` dostaje już wyrenderowane linie.
- Produces (frame.js): `MAX_WIDTH = 200`; `composeFrame({ …, art })` z `art: { lines: string[], width: number } | null`; wynik rozszerzony o `artMode: "side" | "top" | "none"`; stałe `ART_SIDE_TEXT_MIN = 50`, `ART_TOP_TEXT_MIN = 8`, `ART_GAP = 2`.
  - **side:** tekst zawijany do `L − art.width − ART_GAP` na wszystkich stronach (R1); na stronie 0 wiersz `i` lewego panelu = `art.lines[i]` dopełniony do `art.width` + `ART_GAP` spacji + `text[i]`; poniżej obrazu tekst zostaje w tej samej kolumnie (wcięcie bez obrazu).
  - **top:** na stronie 0 `art.lines` na górze, pod nimi tekst zawijany do `L`; pojemność strony 0 = `M − art.lines.length`, kolejne strony `M − 1` jak dotąd; liczba stron liczona z tych pojemności.
  - **none:** dokładnie obecne zachowanie. Obraz tylko gdy wyświetlana strona = 0.
- Produces (screen.js): `showScreen(ctx, { …, art?: string })` – `art` to id; w ramce `io.frame.art = { lines: renderPixels(data.art[id], { color: useColor() }), width: data.art[id].w }`; poza ramką ignorowane; `compose` przekazuje `f.art`.

- [ ] **Step 1: Testy (RED)** `test/frame.test.js` (obraz testowy 48 × 10 komórek, wiersze `"#".repeat(48)`): (a) 80×24 → `artMode === "none"` i `lines` identyczne jak bez `art`; (b) 132×40 (`L = 83`) → `top`, obraz w pierwszych 10 wierszach sceny, tekst pod nim; (c) 200×50 → `side`, wiersz tekstu leży w tej samej linii co wiersz obrazu, tekst zawinięty do `L − 50`; (d) tekst dłuższy niż strona w `top`: `page: 1` nie zawiera obrazu, `pages` zgodne z pojemnością `M − 10` dla strony 0; (e) 220×50 z 2 komunikatami i menu: `lines.length === 49`, każda linia ≤ 200 kolumn; (f) dotychczasowe asercje „≤ 132” → `frameWidth(220) === 200`.
- [ ] **Step 2: Run** `node --test test/frame.test.js` – Expected: FAIL.
- [ ] **Step 3: Implement** w `composeFrame` i `compose`/`showScreen` jak w Interfaces; test integracyjny w `test/screens_tty.test.js`: `showScreen` z `art: "bandyta"` w 200×50 pokazuje obraz „obok”, a w 80×24 ramka równa ramce bez `art` (porównaj wyjścia `lastFrame`).
- [ ] **Step 4: Run** pełny zestaw; zaktualizuj twarde limity 132 w testach ramek – Expected: zielone.
- [ ] **Step 5: Commit** `feat(ui): ilustracje w ramce – układ obok/nad/brak, szerokość do 200`.

---

### Task 4: Pola `art`, `portrait`, `stageArt` – walidacja i podłączenie

**Files:**
- Modify: `src/engine/data.js` (walidacja), `src/scenes/{narration,dialogue,shop,rest,map,reward,trip,after}.js` oraz renderer sceny `ending` (znajdź go w `src/scenes/`) – przekazanie `art` do `showScreen`; `test/data.test.js`, `test/screens_tty.test.js`

**Interfaces:**
- Consumes: `showScreen({ art })` (Task 3), `ART_LIMITS` (Task 1).
- Produces: pole opcjonalne `art: string` na scenach `narration`, `dialogue`, `shop`, `rest`, `map`, `reward`, `ending` (także w `travel.json › events[].scenes[]`); `portrait: string` na rozmowie (`dialogues/*.json`) i w węźle (nadpisuje); `travel.json › stageArt: { depart?, march?, camp?, ulewa? }` (id plików). Walidator `validateArtRefs(data)` wołany z `validateData`: plik musi istnieć, rozmiar ≤ limit dla użycia (`scene` dla `art` i `stageArt`, `portrait` dla `portrait`, `enemy` dla `enemies[].art`); błędy `story.json › <scena> › art: nieznana grafika "x"` / `… grafika 60×20 przekracza limit 48×20`.
- Dialog: `showScreen(ctx, { …, art: node.portrait ?? dialogue.portrait })`.
- Podróż: wymarsz → `stageArt.depart`, podsumowanie etapu → `stageArt.march`, obóz → `stageArt.camp`; gdy aktywne zjawisko ma wpis w `stageArt` (np. `ulewa`), wygrywa nad `march`/`camp`.

- [ ] **Step 1: Testy (RED)** `test/data.test.js`: nieznane `art` na scenie i na scenie w evencie, nieznany `portrait`, plik większy niż limit dla użycia (np. portret 30×20), `stageArt` ze złym kluczem lub nieistniejącym plikiem, `enemies[].art` większy niż `enemy`; poprawne dane przechodzą. `test/screens_tty.test.js` (200×50): narracja z `art` pokazuje obraz, dialog z `portrait` pokazuje portret obok tekstu, ekran etapu podróży pokazuje `stageArt.march`; ta sama scena w trybie liniowym nie drukuje obrazu.
- [ ] **Step 2: Run** – Expected: FAIL.
- [ ] **Step 3: Implement** walidację i podłączenie we wszystkich wymienionych scenach (`trip.js`: `screen(ctx, body, art)`).
- [ ] **Step 4: Run** pełny zestaw + `--validate` – Expected: zielone.
- [ ] **Step 5: Commit** `feat(art): pola art, portrait i stageArt – walidacja i podłączenie scen`.

---

### Task 5: Walka w nowym formacie

**Files:**
- Modify: `src/ui/combat_screen.js`, `test/combat_screen.test.js`, `test/combat_scene.test.js`, `test/screens_tty.test.js`

**Interfaces:**
- Consumes: `renderPixels`, `useColor()` (Task 2), `data.art[enemy.art]` = `{ w, h, palette, rows }`.
- Produces: `renderCombat` i panel walki rysują grafikę celu z `renderPixels(art, { color })`: w ramce `color = useColor()`, w TTY bez ramki `color = false` (ASCII). Kolumna grafiki zajmuje `ART_WIDTH + 1` (40 + 1) kolumn jak dziś; wiersze dopełniane do tej szerokości przez `visibleWidth` (linie z ANSI nie przechodzą przez `fit`; limit 40 px pilnuje walidator).

- [ ] **Step 1: Testy (RED):** (a) `renderCombat` w TTY ≥ 80×24 bez ramki: lewa kolumna to ASCII z pikseli (bez ANSI); (b) panel walki 200×50 przy `setColorsEnabled(true)` i `TERM=xterm-256color`: linie grafiki zawierają `\x1b[38;5;`, wiersze bloku mają tę samą szerokość widoczną; (c) 80×24: brak grafiki, wynik jak dotąd; (d) zmiana celu zmienia obraz na grafikę wybranego wroga.
- [ ] **Step 2: Run** – Expected: FAIL.
- [ ] **Step 3: Implement** w `combat_screen.js` (usuń tymczasowe puste wiersze z Task 1).
- [ ] **Step 4: Run** pełny zestaw – Expected: zielone; zaktualizuj oczekiwania testów trybu liniowego, które zakładały stary rysunek.
- [ ] **Step 5: Commit** `feat(art): grafika wroga w walce z formatu .pix`.

---

### Task 6: Treść – wrogowie, portrety, ilustracje dema

**Files:**
- Create/Modify: `data/art/*.pix` (nadpisanie 4 wrogów, nowe portrety i ilustracje); `data/story.json`, `data/travel.json`, `data/dialogues/*.json` (pola `art`/`portrait`/`stageArt`)
- Test: `test/data.test.js` (istniejące sprawdzenia odwołań), `test/e2e.test.js`

**Interfaces:** Consumes pola z Task 4. Pliki i ich użycie:
- wrogowie (≤ 40×16): `bandyta`, `wilk`, `upior_zwiadowca`, `instruktor` (nazwy z `enemies.json › art`);
- portrety (≤ 20×20): `portret_wszebor` → `komendant.json`, `portret_kwatermistrz` → `kwatermistrz.json`, `portret_ostromir` → `ostromir.json`, `portret_wedrowiec` → `glodny_wedrowiec.json`;
- sceny/etapy (≤ 48×20): `kram` (sklep + scena `demo_kram_wstep`), `wymarsz` (`stageArt.depart`), `trakt` (`stageArt.march`), `oboz` (`stageArt.camp`), `ulewa` (`stageArt.ulewa`), `wilki` (scena spotkania z wilkami), `zasadzka` (`bandyci_zasadzka`), `odpoczynek` (`demo_odpoczynek`), `mapa_brod` (`demo_mapa`), `szkolka` (`demo_swit`/sparing), `koniec` (`demo_koniec`), `nagroda` (`demo_nagroda`).

- [ ] **Step 1: Pierwsza seria:** narysuj `bandyta.pix`, `portret_wszebor.pix`, `kram.pix` (kolorowe, paleta 256, przezroczyste tło, czytelna sylwetka; kolory np. skóra 180/137, ubrania 94/130/58, żelazo 244/250, zieleń 28/34, ziemia 94/101). Podepnij je i **zatrzymaj się**: pokaż użytkownikowi wyniki `node bin/game.js --art bandyta`, `--art portret_wszebor`, `--art kram` i poproś o ocenę stylu; kolejne kroki dopiero po jego odpowiedzi.
- [ ] **Step 2: Reszta wrogów i portretów** (po akceptacji stylu): 3 wrogowie, 3 portrety, podpięcie w `dialogues/*.json`.
- [ ] **Step 3: Ilustracje scen i etapów** z listy wyżej; podpięcie w `story.json` (`art`) i `travel.json` (`stageArt`, `art` na scenach eventów).
- [ ] **Step 4: Test:** `e2e` – demo przechodzi w 200×50 TTY: każda klatka = `rows − 1` wierszy, ≤ 200 kolumn, w co najmniej jednej klatce widać `▀` (ilustracja) przy `setColorsEnabled(true)` + `TERM=xterm-256color`; w 80×24 klatki bez `▀`/`▄`; `timeout 115 npm test` i `--validate` zielone.
- [ ] **Step 5: Commit** (osobne: `feat(art): wrogowie i portrety`, `feat(art): ilustracje scen i podróży`).

---

### Task 7: Dokumentacja

**Files:** Modify: `docs/koncepcja-gry.md` (rozdz. 15 i akapit o grafikach ASCII ok. wiersza 483), `docs/superpowers/specs/2026-10-23-cykl-e3a-ilustracje-design.md` (status)

- [ ] **Step 1:** Opisz format `.pix`, limity, układ obok/nad/brak, `--art` i szerokość ramki 200; status specu „wykonany”.
- [ ] **Step 2: Run** `timeout 115 npm test` i `node bin/game.js --validate` – Expected: zielone.
- [ ] **Step 3: Commit** `docs: ilustracje E3a`.
