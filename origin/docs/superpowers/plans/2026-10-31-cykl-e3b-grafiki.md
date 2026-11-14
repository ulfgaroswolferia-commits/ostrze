# Cykl E3b – szczegółowe grafiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przerysować wszystkie 112 obrazków (wrogowie, portrety, sceny) w większym rozmiarze i bardziej szczegółowym stylu, z brakującymi portretami hetmana i Pełnomocnika.

**Architecture:** Najpierw silnik i układ (limity, paleta 62 kolorów, testy układu w kilku oknach), potem przybornik `tools/art/` w repo, pilotaż 6 obrazków z bramką akceptacji stylu przez użytkownika, potem trzy serie rysowania. Obrazki to `data/art/*.pix` (format bez zmian poza szerszą paletą), generowane przyborem.

**Tech Stack:** Node.js (`node --test`), Python 3 (tylko biblioteka standardowa) w `tools/art/`.

**Spec:** `docs/superpowers/specs/2026-10-31-cykl-e3b-grafiki-design.md`

## Global Constraints

- Nowe limity w pikselach (`ART_LIMITS` w `src/engine/pix.js`): scena 96×48, portret 48×48, wróg 64×48. Liczba wierszy parzysta (2 piksele = 1 wiersz terminala).
- Paleta `.pix`: litery `a–z`, `A–Z`, `0–9` (do 62 kolorów), numery 0–255; `.` to przezroczystość.
- Stare obrazki pozostają poprawne do czasu przerysowania (limity to górna granica).
- Zero zależności npm; Python tylko stdlib; `python` jest zainstalowany (`python -I` dla skryptów czytających niezaufane dane nie jest potrzebny – dane własne).
- Okno 80×24 i tryb liniowy bez obrazków działają jak dotąd.
- Styl: inspiracja zrzutem użytkownika (skrzynia): grube ciemne obrysy, 3–4 tony na materiał, rozbłyski, drobne detale i faktury. Obrazki spójne ze sobą (wspólna paleta bazowa w przyborniku).
- `test/` jest w gitignore → nowe testy `git add -f`.
- Commity kończyć: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` i `Claude-Session: https://claude.ai/code/session_01KFjpEdBukLzarHZndF7CGP`.

## Review Focus

- Obrazek 96×48 w oknach 80×24, 120×35, 160×45, 200×55: nigdy nie wypycha wyborów ani paska poza ekran; w oknie za wąskim idzie nad tekst albo znika.
- Ekran walki z wrogiem 64×48 (24 wiersze) mieści się obok logu bez zawijania i bez ucięcia poleceń.
- `.pix` z literami `A–Z`/`0–9` parsuje się; duża litera spoza palety daje czytelny błąd.
- Wydajność: renderowanie największych obrazków nie spowalnia wyświetlania ekranu (pomiar).
- Żaden obrazek po przerysowaniu nie przekracza limitu swojego rodzaju ani nie ma nieparzystej liczby wierszy.

---

### Task 1: Limity i paleta 62 kolorów

**Files:**
- Modify: `src/engine/pix.js` (`ART_LIMITS`, regex litery palety w `parsePix`, komunikat błędu)
- Modify: `test/pix.test.js:12`, `test/data.test.js` (testy komunikatu o limicie 48×20 itp.)
- Test: `test/pix.test.js`

**Interfaces:**
- Produces: `ART_LIMITS = { scene: {w:96,h:48}, portrait: {w:48,h:48}, enemy: {w:80,h:40} }`; `parsePix` przyjmuje litery `[a-zA-Z0-9]`.

- [ ] **Step 1:** Testy: `ART_LIMITS ma nowe rozmiary` (deepEqual z wartościami wyżej); `parsePix przyjmuje paletę z A–Z i 0–9` (paleta `a=1 Z=2 9=3`, siatka używa wszystkich trzech); `parsePix: litera spoza palety w siatce → PixError "nieznana litera"`; zaktualizuj istniejące asercje o limity (np. grafika 60×20 w `data.test.js` → nowe liczby 96×48).
- [ ] **Step 2:** `node --test test/pix.test.js test/data.test.js` → FAIL.
- [ ] **Step 3:** Zmień stałe i regex (`/^[a-zA-Z0-9]$/`, komunikat „dozwolone a–z, A–Z, 0–9”). Komentarz nad `ART_LIMITS` zaktualizuj.
- [ ] **Step 4:** `npm test` zielony; commit `feat: limity grafik 96×48/48×48/64×48 i paleta 62 kolorów`.

### Task 2: Układ ramki dla dużych obrazków

**Files:**
- Modify: `src/ui/frame.js` (jeśli testy wykażą wypychanie), `src/ui/combat_screen.js:22` okolice
- Test: `test/art_layout.test.js` (nowy)

**Interfaces:**
- Consumes: `compose(io, …)`/`composeFrame` i `ART_SIDE_TEXT_MIN`, `ART_TOP_TEXT_MIN` z `src/ui/frame.js`.

- [ ] **Step 1:** Testy (po jednym na rozmiar okna 80×24, 120×35, 160×45, 200×55): zrób obrazek-testowy 96×48 (scena), 48×48 (portret), 64×48 (wróg) z `parsePix` jednokolorowej siatki; złóż ekran z tekstem 40 linii i 3 wyborami; asercje: liczba wierszy ramki ≤ rows okna, wszystkie wiersze o stałej szerokości, wybory widoczne w ostatnich wierszach, tryb obrazka (`artMode`) = `none` w 80×24 i `side` albo `top` w 200×55 dla sceny. Dodatkowo `ekran walki z wrogiem 64×48: log i polecenia widoczne w 200×55 i 120×35`.
- [ ] **Step 2:** Uruchom → zanotuj, które przypadki padają (FAIL jest oczekiwany tylko tam, gdzie układ wypycha).
- [ ] **Step 3:** Popraw `frame.js`/`combat_screen.js` minimalnie (np. limit wysokości obrazka `top` do połowy `Mt`, obcięcie wrogów szerszych niż panel); ruling w ledgerze, jeśli odstępujesz od planu.
- [ ] **Step 4:** Zmierz czas renderu największego obrazka (`console.time` w teście lub osobnym skrypcie, 100 klatek 96×48 < 1 s) i wpisz wynik do ledgera.
- [ ] **Step 5:** `npm test` zielony; commit `feat: układ ramki dla dużych grafik`.

### Task 3: Przybornik `tools/art/`

**Files:**
- Create: `tools/art/toolkit.py`, `tools/art/README.md`, `tools/art/palette.py`, `tools/art/test_toolkit.py`

**Interfaces:**
- Produces (`toolkit.py`): `Canvas(w, h, palette)` z metodami `px(x,y,c)`, `rect(x0,y0,x1,y1,c)`, `ellipse(cx,cy,rx,ry,c)`, `line(x0,y0,x1,y1,c)`, `poly(points,c)`, `fill_shaded(shape, tones, light=(-1,-1))` (3–4 tony wg normalnej), `outline(c)` (obrys 1 px wokół nieprzezroczystych), `dither(x0,y0,x1,y1,c1,c2,density)`, `noise(x0,y0,x1,y1,tones,seed)`, `glint(x,y,c)`, `save(path, comment)` (zapis `.pix`, litery a–zA–Z0–9 przydzielane z użytych kolorów), `preview()` (wypisuje w terminalu półblokami), `check(kind)` (rozmiar ≤ limit, parzyste wiersze). `palette.py`: wspólna paleta bazowa (xterm-256) – skóry, drewno, metal, kamień, trawa, woda, ogień, szkło, noc, krew – po 4 tony.

- [ ] **Step 1:** Napisz `test_toolkit.py` (unittest): `save` + odczyt daje tę samą siatkę; `check("scene")` odrzuca 97×48 i nieparzystą liczbę wierszy; 62 kolory mieszczą się w literach, 63. kolor zgłasza błąd; `outline` dodaje obrys tylko wokół nieprzezroczystych pikseli; wynik pliku parsuje się przez `node -e "import('./src/engine/pix.js')…parsePix"` bez błędu.
- [ ] **Step 2:** `python -m unittest discover tools/art` → FAIL.
- [ ] **Step 3:** Zaimplementuj `toolkit.py` i `palette.py` według sygnatur wyżej (deterministyczne, bez losowości poza ziarnem). `README.md`: jak rysować obraz (przykład 20 linii), jak podglądać (`preview()` i `node bin/game.js --art <id>`), nazewnictwo plików.
- [ ] **Step 4:** Testy Pythona i `npm test` zielone; commit `feat: przybornik rysowania tools/art`.

### Task 4: Pilotaż 6 obrazków i bramka stylu

**Files:**
- Create/Modify: `tools/art/pilot.py`, `data/art/karczma_pod_wilczym_klem.pix` (scena), `data/art/portret_kwatermistrz.pix` lub `data/art/portret_istota.pix` (portret), `data/art/wilk.pix` (wróg), + 3 sceny: `data/art/oboz.pix` (ognisko/noc), `data/art/ruiny_straznicy.pix`, `data/art/pole_szkla.pix`
- Test: `test/art_upgrade.test.js` (nowy)

**Interfaces:**
- Produces: `test/art_upgrade.test.js` z listą `UPGRADED = { enemy: ["wilk"], portrait: [...], scene: [...] }` – test sprawdza, że każdy wymieniony obraz ma pełny nowy rozmiar (w == limit.w, h == limit.h dla swojego rodzaju) i ≤ 62 kolory; kolejne serie dopisują id do tej listy.

- [ ] **Step 1:** Test `art_upgrade.test.js`: dla każdego id z `UPGRADED` (rodzaj wg klucza): obraz istnieje w `data/art`, `w`/`h` równe limitowi rodzaju, liczba kolorów ≤ 62, przechodzi `validateData`.
- [ ] **Step 2:** Uruchom → FAIL (obrazy jeszcze stare).
- [ ] **Step 3:** Narysuj 6 obrazków `pilot.py` w stylu skrzyni z inspiracji (obrys, 3–4 tony, rozbłyski, faktury); zachowaj motywy dotychczasowych obrazków o tych samych id (np. wilk, karczma).
- [ ] **Step 4:** `npm test` zielony; sprawdź wygląd na oknach 200×55 i 120×35 (`node bin/game.js --art <id>` oraz zrzut w teście lub przez `preview()`); commit `art: pilotaż 6 obrazków (nowy styl)`.
- [ ] **Step 5 (BRAMKA):** Zatrzymaj się i pokaż użytkownikowi pilotaż (jak go obejrzeć: `node bin/game.js --art wilk` itd.). Dalej tylko po jego akceptacji lub z uwzględnieniem uwag (korekty zapisz w README przybornika jako „styl”). To jedyna zaplanowana pauza tego planu.

### Task 5: Seria 1 – wrogowie (36)

**Files:**
- Create/Modify: `tools/art/series_enemies.py`, wszystkie `data/art/*.pix` używane jako `art` w `data/enemies.json`
- Test: `test/art_upgrade.test.js`

- [ ] **Step 1:** Wyznacz listę id z `data/enemies.json` (pole `art`); dopisz je do `UPGRADED.enemy` w teście (FAIL).
- [ ] **Step 2:** Narysuj wszystkich wrogów 64×48 (każdy: charakterystyczna sylwetka, broń/wyposażenie z opisu wroga, obrys, światło z lewej góry); wspólne części (hełmy, tarcze) z przyborniku.
- [ ] **Step 3:** `npm test` zielony; obejrzyj 4 losowe (`--art`) i ekran walki w 120×35 i 200×55; commit `art: wrogowie w nowym stylu (seria 1)`.

### Task 6: Seria 2 – portrety (36 + 2 nowe)

**Files:**
- Create/Modify: `tools/art/series_portraits.py`, wszystkie `data/art/portret_*.pix` (+ `data/art/portret_hetman.pix`, `data/art/portret_pelnomocnik.pix`), `data/dialogues/*.json` (pole `portrait` dla hetmana i Pełnomocnika)
- Test: `test/art_upgrade.test.js`

- [ ] **Step 1:** Dopisz id portretów do `UPGRADED.portrait` (FAIL); znajdź dialogi hetmana Skjeldomira i Pełnomocnika (`grep -l "Skjeldomir\|Pełnomocnik" data/dialogues`) – test: ich dialogi mają `portrait` wskazujące istniejący obraz.
- [ ] **Step 2:** Narysuj portrety 48×48 (twarz/ramiona, charakterystyczny rys: wiek, blizny, nakrycie głowy, tło jednolite ciemne), w tym dwa nowe; dodaj pole `portrait` w dialogach.
- [ ] **Step 3:** `npm test` zielony; obejrzyj 4 portrety w ekranie rozmowy (120×35, 200×55); commit `art: portrety w nowym stylu (seria 2)`.

### Task 7: Seria 3a – sceny 1 (20)

**Files:**
- Create/Modify: `tools/art/series_scenes_a.py`, połowa `data/art/*.pix` z rodzaju scena (alfabetycznie pierwsze 20 spoza wrogów i portretów)
- Test: `test/art_upgrade.test.js`

- [ ] **Step 1:** Wyznacz pozostałe obrazki-sceny (112 − wrogowie − portrety), posortuj, weź pierwsze połowę do `UPGRADED.scene` (FAIL).
- [ ] **Step 2:** Narysuj 96×48 (krajobraz/wnętrze: plan pierwszy, drugi, tło; światło i nastrój wg lokacji z `data/travel.json`/`story.json`).
- [ ] **Step 3:** `npm test` zielony; obejrzyj 3 sceny w oknie 200×55 i 120×35; commit `art: sceny w nowym stylu (seria 3a)`.

### Task 8: Seria 3b – sceny 2 (reszta) i lokacje bez własnej grafiki

**Files:**
- Create/Modify: `tools/art/series_scenes_b.py`, reszta `data/art/*.pix` scen; nowe obrazy dla lokacji, które dziś używają cudzej grafiki (wskaż w ledgerze, które i jaki nowy id), `data/travel.json`/`story.json` (pole `art`)
- Test: `test/art_upgrade.test.js`

- [ ] **Step 1:** Dopisz pozostałe sceny do `UPGRADED.scene`; test `lokacje z huba nie dzielą grafiki z inną lokacją` (dla każdego spotu z `art` unikalny id w obrębie huba; lista wyjątków w teście z uzasadnieniem w ledgerze).
- [ ] **Step 2:** Narysuj resztę scen 96×48 oraz brakujące unikalne obrazy lokacji i podepnij je w danych.
- [ ] **Step 3:** `npm test` zielony; commit `art: sceny w nowym stylu (seria 3b)`.

### Task 9: Zamknięcie cyklu

**Files:**
- Create: `docs/superpowers/plans/2026-10-31-cykl-e3b-ledger.md`
- Modify: `test/art_upgrade.test.js`

- [ ] **Step 1:** Zamień test w „wszystkie obrazy w `data/art` mają nowy rozmiar swojego rodzaju” (zamiast listy `UPGRADED`): rodzaj ustalany z użycia (enemy z `enemies.json`, portrait z dialogów/`portrait`, reszta scena).
- [ ] **Step 2:** `npm test` zielony (podaj liczbę testów); ledger: rulings, pomiar wydajności, lista nowych obrazów, zostawione drobiazgi.
- [ ] **Step 3:** Commit `docs: ledger E3b`; gałąź zostaw do decyzji o scaleniu.
