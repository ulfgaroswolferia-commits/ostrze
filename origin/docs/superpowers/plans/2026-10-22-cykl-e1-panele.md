# Cykl E1 – interfejs w panelach – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** W TTY (≥ 80×24) każdy ekran to ramka z panelem bohatera, panelem sceny, kolumną poleceń, komunikatami i panelem wyboru; tryb liniowy bez zmian.

**Architecture:** `src/ui/frame.js` – czysta funkcja `composeFrame(spec) → { lines, pages }`. `src/ui/hero_panel.js` – dane panelu bohatera. `src/ui/screen.js` dostaje `framesOn(io)`, `setFrame(io, spec)` / `clearFrame(io)` i `showScreen(ctx, spec)`: w trybie ramek zapamiętuje specyfikację bieżącego ekranu na `io.frame`; widżety (`select`, `sliders`, `multiSelect`, `textInput`, `pressEnter`, `confirm`) w TTY, gdy `io.frame` jest ustawione, rysują całą ramkę z własnymi wierszami w panelu wyboru (czyszczenie + zapis całej ramki przy każdej zmianie). W trybie liniowym `showScreen` pisze dokładnie to, co dziś.

**Tech Stack:** Node.js ≥ 22, ESM, zero zależności, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-22-cykl-e1-panele-design.md` (binding).

## Global Constraints

- Zero zależności; tylko `node:*`.
- Ramki tylko gdy `framesOn(io)`: `io.isTTY && io.columns >= 80 && io.rows >= 24`. Mniejszy TTY – tryb liniowy + „Powiększ okno do 80×24, aby zobaczyć panele.” na początku linii stanu.
- Tryb liniowy (`isTTY === false`) – wyjście bajt w bajt jak przed E1; dotychczasowe testy liniowe bez zmian asercji.
- Testy TTY (scripted IO z `tty: true` ma `columns 80, rows 24`) zmieniają się – po E1 sprawdzają ramki; asercje treści (np. „Ruszaj w drogę”) zostają.
- Ramka: dokładnie `rows − 1` wierszy, każdy dokładnie `cols` kolumn (`displayWidth` z D1; kolory nie liczą się); znaki `┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴`.
- Kolory: `frame` = `\x1b[38;5;28m` (zamiennik: zielony), `frame_title` = `\x1b[38;5;130m` + pogrubienie (zamiennik: żółty); `hp_ok` zielony, `hp_mid` żółty, `hp_low` czerwony pogrubiony, `xp`/`ap` niebieski, `gold` żółty, `bad` czerwony. Zamiennik, gdy `process.env.COLORTERM`/`TERM` nie wskazuje 256 kolorów (`TERM` zawiera `256color` lub `COLORTERM` ∈ {truecolor, 24bit} → 256; inaczej zamiennik).
- Kolumna poleceń 17 kolumn + separator; tekst sceny `cols − 22` przy kolumnie, `cols − 4` bez; komunikaty 0–2 wiersze; wybór 1–6 wierszy (krótki wybór w jednej linii, gdy wszystkie pozycje mieszczą się w szerokości).
- Każde zadanie: zielony `npm test`, `--validate` czyste, commit na `cykl-e1`.

## Plan rulings

- **R1:** Spec nazywał przekazanie ramki `ctx.frame`; widżety dostają tylko `io`, więc ramka bieżącego ekranu żyje na `io.frame` (ustawiana przez `showScreen`, czyszczona przy `clear` nowego ekranu). Koszt: nazwa pola.
- **R2:** Testy TTY sprzed E1, które sprawdzają kształt dzisiejszego ekranu (np. „ramka ≤ 23 wierszy” w podróży, mapie, walce), zostają z tymi samymi progami i dostają sprawdzenie domkniętych ramek – nie są usuwane.

## Review Focus

1. Ekran z bardzo długim tekstem sceny (opis spotkania > 30 wierszy) – strony „▼ dalej”, żaden wiersz ramki nie przekracza `cols`, ramka zawsze domknięta (test w Task 1 i 3).
2. Menu dłuższe niż 6 pozycji (sklep 13 pozycji, kreator umiejętności 12) – przewijanie w panelu wyboru, kursor zawsze widoczny, ramka nie rośnie (test w Task 3 i 4).
3. Zmiana rozmiaru terminala na mniejszy niż 80×24 w trakcie gry – następny ekran przechodzi w tryb liniowy z komunikatem, bez wyjątku (test w Task 7).
4. Długie imię + zjawisko + artefakt + 3 efekty w panelu bohatera przy 80 kolumnach – HP zawsze widoczne, linie panelu ≤ szerokości (test w Task 2).
5. Komunikaty z ekranu, który od razu przechodzi do następnego (np. zjawisko → narracja) – nie giną: trafiają do strefy komunikatów następnej ramki (test w Task 3).

---

### Task 1: Kompozytor ramki i paleta

**Files:**
- Create: `src/ui/frame.js`
- Modify: `src/ui/colors.js` (role z Global Constraints; `paint` obsługuje surowe sekwencje 256 z zamiennikiem)
- Test: `test/frame.test.js`

**Interfaces:**
- Produces: `composeFrame({ cols, rows, hero, title, body, commands, notices, choices }) → { lines: string[], pages: number }` – `hero: { left, right, lines: [string, string] } | null`, `body: string[]` (zawijane do szerokości), `commands: Array<{ key, label, disabled? }>`, `notices: string[]`, `choices: string[]`, opcjonalnie `page` (0-based) – zwraca ramkę tej strony; `sceneWidth(cols, hasCommands) → number`; `choicesHeight(choices) → 1..6`.

- [ ] **Step 1: Testy (failing)** – 80×24: `lines.length === 23`, każda linia `displayWidth === 80` (po zdjęciu kolorów), pierwsza zaczyna się `┌`, ostatnia `└`, środkowe `│`/`├`; tytuł sceny w linii `├─ Zasadzka ─…┬…┤`; bez komunikatów – brak strefy; 1/2/5 komunikatów → 1/2/2 wiersze, przy 5 „…i 3 więcej [L]”; wybór 1 i 6 wierszy – scena 13 i 8 wierszy (bez komunikatów); bez kolumny poleceń tekst 76 kolumn, z kolumną 58; tekst 40 wierszy → `pages > 1`, ostatni wiersz panelu sceny „▼ dalej (Enter)” na stronach poza ostatnią; linia z ⚡ i kolorami nie psuje szerokości; zbyt długa linia ucięta „…”; 120×40 – szerokość 120, scena wyższa; `hero: null` – górna ramka z „OSTRZE GWIAZD”.
- [ ] **Step 2:** `node --test test/frame.test.js` – FAIL.
- [ ] **Step 3:** implementacja.
- [ ] **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(ui): kompozytor ramki i paleta kolorów`.

### Task 2: Panel bohatera

**Files:**
- Create: `src/ui/hero_panel.js`
- Test: `test/hero_panel.test.js`

**Interfaces:**
- Consumes: `displayWidth`, `mysticTags`, `placeText` (wyeksportować z `screen.js`), `getStats`, `artifactPercent`.
- Produces: `heroPanel(state, data, { cols, combat = null }) → { left, right, lines: [l1, l2] } | null` (null bez postaci).

- [ ] **Step 1: Testy (failing)** – lewa „Test · poz. 1 · Klasa miecza”, prawa „Dzień 1, 12:00 · dzień”; l1: pasek HP 10 znaków (`█` × round(10·hp/max)), kolor `hp_ok` przy 38/38, `hp_mid` przy 15/38, `hp_low` przy 5/38; „XP 0/150”; „[Głodny ×2]”; po prawej „Brzezina” / „W drodze 1/2”; l2: „Broń: Krótki miecz”, z drugą ręką „Broń: Krótki miecz + Sztylet”, „Pas: Opatrunek ×2”, mistyka po prawej; w walce l2 zaczyna się „PA ●●●○○○○○ (3/8)”; długie imię + zjawisko + artefakt + 3 efekty przy 80 – obie linie ≤ szerokości wnętrza, „HP” zawsze obecne (Review Focus 4).
- [ ] **Step 2:** `node --test test/hero_panel.test.js` – FAIL.
- [ ] **Step 3:** implementacja.
- [ ] **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(ui): panel bohatera`.

### Task 3: `showScreen`, widżety w panelu wyboru, proste ekrany

**Files:**
- Modify: `src/ui/screen.js` (`framesOn`, `setFrame`, `clearFrame`, `showScreen`, `commandsFor(ctx, kind)`), `src/ui/menu.js` (`select`, `sliders`, `multiSelect`, `textInput` – rysowanie przez ramkę, gdy `io.frame`), `src/ui/prompt.js` (`pressEnter`, `confirm` – w ramce), `src/ui/camp.js` (polecenia jako kolumna w TTY; w trybie liniowym bez zmian), `src/scenes/narration.js`, `reward.js`, `effect.js`, `phenomenon.js`, `src/ui/events.js` (notice queue bez zmian)
- Test: `test/screens_tty.test.js`

**Interfaces:**
- Produces: `framesOn(io) → boolean`; `showScreen(ctx, { title?, body: string[], commands?: "camp" | "dialogue" | "shop" | "rest" | "none" })` – w ramkach ustawia `io.frame = { hero, title, body, commands, notices }` (notices zabrane z `ctx.notices`), w trybie liniowym pisze jak dziś; `drawFrame(io, choiceLines)` – używane przez widżety; `campMenu` w ramkach: wybory sceny (Dalej, `before`, `extra`) w panelu wyboru, polecenia (P/E/D/Z/M) w kolumnie i obsługiwane klawiszami liter (bez numerów).

- [ ] **Step 1: Testy (failing)** – narracja w TTY 80×24: klatka (od ostatniego czyszczenia) ma 23 wiersze ramki + wiersz odpowiedzi, kolumna poleceń „[P] Postać”, „[E] Ekwipunek”, „[D] Dziennik”, „[Z] Zapisz”, „[M] Menu”, panel wyboru „[1] Dalej” w jednej linii; `p` otwiera kartę postaci i wraca do tej samej ramki; długi tekst (40 wierszy) – Enter pokazuje kolejne strony, potem menu (Review Focus 1); komunikat ze sceny `phenomenon` pojawia się w strefie komunikatów następnej narracji (Review Focus 5); menu 13 pozycji – w panelu wyboru 6 wierszy z „↓ …”, kursor przewija (Review Focus 2); tryb liniowy narracji – wyjście identyczne jak przed zmianą (porównanie z zapisanym oczekiwanym tekstem).
- [ ] **Step 2:** `node --test test/screens_tty.test.js` – FAIL.
- [ ] **Step 3:** implementacja (sceny wołają `showScreen` zamiast własnego `render`).
- [ ] **Step 4:** `npm test` PASS (testy TTY sprzed E1 – dostosować do ramek wg R2).
- [ ] **Step 5: Commit** `feat(ui): ekrany w ramkach – narracja, nagroda, efekt, zjawisko, menu obozu`.

### Task 4: Dialog, sklep, odpoczynek, podróż, mapa, dziennik, awans, kreator, menu główne

**Files:**
- Modify: `src/scenes/dialogue.js`, `shop.js`, `rest.js`, `trip.js`, `map.js`, `after.js` (awans), `character_creation.js`, `src/ui/journal_screen.js`, `src/app.js` (menu główne, `hero: null`)
- Test: `test/screens_tty.test.js`

**Interfaces:**
- Consumes: Task 3 (`showScreen`, `drawFrame`, polecenia `commandsFor`).

- [ ] **Step 1: Testy (failing)** – każdy ekran z tabeli spec w TTY 80×24: ramka 23 wiersze, linie 80 kolumn, właściwe polecenia w kolumnie (dialog: tylko P; sklep: P, E; mapa i podróż: P, E, D, Z, M; awans, kreator, menu główne: brak kolumny), mówca dialogu w tytule ramki, „Wilczy Bród – dokąd?” w panelu sceny, suwak godzin odpoczynku w panelu wyboru, kreator – lista umiejętności (12 pozycji) przewija się w panelu wyboru (Review Focus 2).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** implementacja.
- [ ] **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(ui): dialog, sklep, odpoczynek, podróż, mapa, awans i kreator w ramkach`.

### Task 5: Ekwipunek, karta postaci, komunikaty `[L]`

**Files:**
- Modify: `src/ui/inventory_screen.js`, `src/ui/character_screen.js` (dwie kolumny w ramce), `src/ui/screen.js` (`[L] Komunikaty` w kolumnie, gdy komunikaty ukryte; pełna lista w panelu sceny do Enter)
- Test: `test/screens_tty.test.js`

- [ ] **Step 1: Testy (failing)** – ekwipunek w ramce bez kolumny poleceń, sloty i lista w panelu sceny, akcje przedmiotu w panelu wyboru; karta postaci: atrybuty i umiejętności obok siebie, całość w 23 wierszach; 5 komunikatów → „…i 3 więcej [L]”, `l` pokazuje wszystkie 5 i wraca.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(ui): ekwipunek, karta postaci i komunikaty w ramkach`.

### Task 6: Walka w ramce

**Files:**
- Modify: `src/ui/combat_screen.js` (wariant ramkowy: bez linii czasu i stanu gracza – są w panelu bohatera; akcje w dwóch kolumnach), `src/scenes/combat.js`
- Test: `test/combat_screen.test.js`, `test/screens_tty.test.js`

**Interfaces:**
- Consumes: `heroPanel(..., { combat })` (Task 2), `composeFrame` (Task 1).

- [ ] **Step 1: Testy (failing)** – walka z 3 wrogami w TTY 80×24: ramka 23 wiersze, panel bohatera z „PA ●…”, grafika celu i lista wrogów w panelu sceny, dziennik walki 3 linie (2, gdy brak miejsca), 10 akcji w dwóch kolumnach po 5 wierszy, podmenu Techniki pionowo w panelu wyboru; sterownik adaptacyjny dalej wygrywa walkę w TTY (`createAdaptiveIO(..., { tty: true })` czyta wiersze akcji z dwóch kolumn).
- [ ] **Step 2:** FAIL. **Step 3:** implementacja (i odczyt dwóch kolumn w `readCombatScreen` w `test/helpers.js`). **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(ui): walka w ramce, akcje w dwóch kolumnach`.

### Task 7: Demo w TTY i za mały terminal

**Files:**
- Modify: `test/e2e.test.js`, `src/ui/screen.js` (komunikat o rozmiarze)
- Test: `test/e2e.test.js`

- [ ] **Step 1: Testy (failing)** – demo w TTY (strzałki) przechodzi do końca; każda klatka (od `\x1b[2J`) ma ≤ 24 wiersze i każdy wiersz ≤ 80 kolumn, ramki domknięte; IO TTY 70×20 – tryb liniowy z „Powiększ okno do 80×24, aby zobaczyć panele.”; zmiana `io.columns` na 70 w trakcie gry – następny ekran liniowy bez wyjątku (Review Focus 3).
- [ ] **Step 2:** FAIL. **Step 3:** implementacja/poprawki. **Step 4:** `npm test` PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `test(e2e): demo w ramkach TTY, za mały terminal`.
