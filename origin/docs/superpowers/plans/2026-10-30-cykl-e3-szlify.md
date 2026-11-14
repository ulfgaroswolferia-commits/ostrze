# Cykl E3 – szlify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamknąć odroczone drobiazgi z ledgerów (widoczne usterki, luki silnika i zapisów, spójność treści) bez nowej treści i grafik.

**Architecture:** Najpierw audyt kandydatów na bieżącym kodzie (ledger E3), potem trzy fale (widoczne usterki → silnik/zapisy → treść) na gałęzi `cykl-e3`. Każdy naprawiany punkt dostaje test; punkt nieaktualny dostaje wpis w ledgerze z powodem.

**Tech Stack:** Node.js bez zależności, `node --test` (`npm test`), dane w `data/*.json`, dialogi w `data/dialogues/`.

**Spec:** `docs/superpowers/specs/2026-10-30-cykl-e3-szlify-design.md`

## Global Constraints

- Zero zależności npm.
- Testy: `test/` jest w gitignore → nowe pliki dodawać `git add -f`; zestaw `npm test` (ok. 1512 testów) musi pozostać zielony po każdym zadaniu.
- Każda zmiana treści zgodna z `docs/wytyczne-tresci-i-qa.md` i przechodzi `test/content_quality.test.js`, `test/consistency.test.js`, `test/guidelines.test.js`.
- Teksty gry po polsku, wszystkie napisy UI w `data/ui.json`.
- Zmiana formatu zapisu wymaga podbicia wersji i migracji w `src/engine/save.js`.
- Nie ruszać: grafik/portretów (E3b), balansu włóczni, mechanik, nowej treści.
- Commity kończyć: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` oraz `Claude-Session: https://claude.ai/code/session_01KFjpEdBukLzarHZndF7CGP`.

## Review Focus

- Zapis wykonany w środku dialogu/spotu/trasy wczytuje się bez błędu i bez losowania zasadzki od nowa.
- Stary zapis (sprzed zmian) nadal się wczytuje (kompatybilny odczyt lub migracja).
- Walka z Istotą startuje po dialogu bez pustego ekranu, a przerwanie walki nie daje ponownej próby oblanego testu.
- Zerowe zmiany (0 gr, 0 HP) nigdy nie pojawiają się w komunikatach.
- Nowe/zmienione teksty nie wprowadzają anachronizmów ani zdublowanych fraz.

---

### Task 1: Audyt kandydatów i ledger E3

**Files:**
- Create: `docs/superpowers/plans/2026-10-30-cykl-e3-ledger.md`

**Interfaces:**
- Produces: tabela `punkt → werdykt (do zrobienia / nieaktualny: powód) → zadanie`, którą czytają zadania 2–7.

- [ ] **Step 1:** Dla każdego punktu z sekcji „Fala 1/2/3” speca znajdź miejsce w kodzie/danych (`grep`) i sprawdź, czy usterka nadal występuje. Znane z rozpoznania: `failedKey` w `src/systems/dialogue.js:45` już zawiera `dialogId` (klucz `dialog:węzeł:opcja`), więc sprawdź, czy pozostaje realny przypadek „ten sam test z innego węzła”; `lockedHint` (`src/scenes/dialogue.js:16`) zwraca `dialogue.lockedOther` – sprawdź, skąd bierze się podwójne „(niedostępne)” (`menu.unavailable`, `map.spotLocked`).
- [ ] **Step 2:** Zapisz ledger: nagłówek, tabela werdyktów (po jednym wierszu na punkt speca), sekcja „Rulings” (pusta).
- [ ] **Step 3:** Commit `docs: audyt E3`.

### Task 2: Widoczne usterki UI i silnika (fala 1a)

**Files:**
- Modify: `src/scenes/dialogue.js`, `src/systems/dialogue.js`, `src/ui/end_screen.js`, `src/scenes/ending.js`, `src/scenes/combat.js` (jeśli trzeba), `data/ui.json`, miejsca formatujące zmiany pieniędzy/HP (znajdź `grep -rn "pieniadze\|+0\|−0" src`)
- Test: `test/e3_visible.test.js` (nowy)

**Interfaces:**
- Consumes: werdykty z ledgera (Task 1).

- [ ] **Step 1:** Testy (nazwy): `dialogue z onCombat startuje walkę bez pustego ekranu Dalej` (po wyborze opcji kończącej `walka` kolejnym renderem jest ekran walki; zero wywołań `io` czekających na klawisz między nimi); `zmiana pieniędzy równa 0 nie daje komunikatu` (assert: brak „+0 gr” i „−0 gr” w powiadomieniach złodzieja z pustą sakwą i zdarzenia z kwotą 0); `zablokowana opcja nie ma podwójnego (niedostępne)`; `ekran końcowy zawiera statystyki` (dni, poziom, liczba ukończonych zleceń, id zakończenia); `pasek statusu nie jest rysowany w epilogu`.
- [ ] **Step 2:** `npm test -- test/e3_visible.test.js` → FAIL dla punktów potwierdzonych w ledgerze.
- [ ] **Step 3:** Napraw: pominąć zerowe delty tam, gdzie powstają komunikaty; jedno oznaczenie niedostępności; `showEndScreen(ctx)` dostaje podsumowanie z `state` (klucze `end.stats.*` w `ui.json`); sceny `ending`/epilogu bez paska statusu.
- [ ] **Step 4:** Pełny `npm test` zielony; commit `fix: widoczne usterki UI (E3)`.

### Task 3: Treść w scenach fabuły i zasadzkach (fala 1b)

**Files:**
- Modify: `data/story.json`, `data/travel.json`, `data/maps/*`, `data/dialogues/*` (według ledgera)
- Test: `test/e3_visible.test.js`

- [ ] **Step 1:** Testy: `akt6_epilog_list_nikt jest osiągalne albo usunięte` (lint grafu scen z `test/graph.test.js` nie zgłasza martwych scen/gałęzi); `komnata_cisza` j.w.; `porażka w zasadzce nie obiecuje strat, których nie ma` (dla każdej sceny porażki zasadzki: jeśli tekst mówi o utracie sakwy/broni/butów, to sceny dają odpowiedni efekt `money`/`removeItem`, w przeciwnym razie tekst bez takich fraz); `Galeria luster po oczyszczeniu nie ma znacznika "!"`.
- [ ] **Step 2:** Uruchom → FAIL dla potwierdzonych.
- [ ] **Step 3:** Napraw dane: podłącz lub usuń martwe sceny; w tekstach porażek zasadzek albo dodaj realne straty (pieniądze), albo zmień opis na zgodny z faktem (preferuj zmianę opisu); wyłącz „!” po oczyszczeniu.
- [ ] **Step 4:** `npm test` zielony; commit `fix: martwe sceny, porażki zasadzek, Galeria luster (E3)`.

### Task 4: Silnik – testy dialogowe i zapisy (fala 2a)

**Files:**
- Modify: `src/systems/dialogue.js`, `src/engine/save.js`, `src/systems/quests.js`, `src/scenes/map.js`, `src/engine/state.js`
- Test: `test/e3_engine.test.js` (nowy)

**Interfaces:**
- Produces: jeśli klucz `failedChecks` się zmienia – `failedKey(dialogId, nodeId, key)` zachowuje sygnaturę; stare wpisy nadal rozpoznawane.

- [ ] **Step 1:** Testy: `ten sam test (opcja z id) oblany w jednym węźle jest niedostępny z drugiego węzła tego dialogu` (tylko jeśli ledger potwierdza lukę; opcje bez jawnego `id` zostają per węzeł); `stary zapis z failedChecks w starym formacie wczytuje się i blokuje ponowną próbę`; `naprawa zapisu zeruje map.ambush przy nieznanym spocie`; `world.ambushes przechodzi walidację WORLD_SCHEMA i naprawę`; `wczytanie zapisu w środku spotu nie losuje zasadzki`.
- [ ] **Step 2:** Uruchom → FAIL dla potwierdzonych.
- [ ] **Step 3:** Implementacja: dla opcji z `id` klucz `dialogId:*:id` (wariant bez węzła), odczyt sprawdza oba formaty; w `src/systems/quests.js:357–369` naprawa zeruje `map.ambush`; `world.ambushes` do `WORLD_SCHEMA` (`src/engine/save.js:180–197`) z domyślną wartością w `repairState`; w `src/scenes/map.js` zasadzka nie losuje się, gdy `map.spotScene !== null` (wznowienie).
- [ ] **Step 4:** `npm test` zielony; commit `fix: silnik dialogów i zapisów (E3)`.

### Task 5: Silnik – walidacja danych i efekty (fala 2b)

**Files:**
- Modify: `src/engine/data.js`, `src/systems/effects.js` lub `src/scenes/effect.js` (znajdź `Jesteś teraz`), `data/dialogues/*` (`dlug.splac`)
- Test: `test/e3_engine.test.js`

- [ ] **Step 1:** Testy: `whenEmpty.costHp 0 odrzucane przez walidację artefaktów`; `rules.dialogue.chanceMax > 100 odrzucane`; `scena zdarzenia o id "koniec" odrzucana`; `opcja dlug.splac wymaga pieniędzy` (dane); `odświeżenie aktywnego efektu nie powtarza "Jesteś teraz"`; `round-trip zapisu na scenie akt4b_przejscie` (zapis → `loadGame` → ta sama scena, bez błędu; analogicznie w środku trasy i w środku dialogu).
- [ ] **Step 2:** Uruchom → FAIL dla potwierdzonych.
- [ ] **Step 3:** Dodać reguły walidacji w `src/engine/data.js` (komunikaty po polsku w stylu istniejących, np. linia 598), `requires: { money: N }` w opcji spłaty, warunek tekstu efektu.
- [ ] **Step 4:** `npm test` zielony; commit `fix: walidacja danych i efekty (E3)`.

### Task 6: Spójność treści – stany powrotu i sprzeczności (fala 3a)

**Files:**
- Modify: `data/dialogues/*` (Hjalmar, Smyk, Jadwiga, kapitan, kwatermistrz, skarbnik, Istota, Nieśpiący, Brygida), `data/story.json`, `data/travel.json`
- Test: `test/content_quality.test.js`

- [ ] **Step 1:** Testy (w `content_quality.test.js`): `Hjalmar, Smyk i Jadwiga mają stany powrotu` (po zakończonej rozmowie ponowna wizyta daje kwestię inną niż pierwsza, zgodnie z wytyczną 1.4); `powitanie kapitana nie miesza ty/pan` (w jego dialogu brak mieszania form w jednej wypowiedzi) i występuje raz (drugie wejście ma kwestię powrotną); `kwatermistrz i Smyk reagują na własne zlecenia` (węzeł z `questStatus`); `ostatnie słowa cesarza uwzględniają szklo_wola i wojna_*`; `epilog ma wariant dla szklo_wola`.
- [ ] **Step 2:** Uruchom → FAIL.
- [ ] **Step 3:** Dopisz kwestie i warianty (styl: dialogi aktu, zgodnie z tonem miasta/frontu z pamięci projektu); popraw sprzeczności z ledgerów: „pół roku”/„cztery miesiące”, „wodociągi trzy dni”, „reszta świty” w `komnata_po_r`, „nóż na schodach”, `smyk_wola` mimo dowodu, Jadwiga „Pisarz mówił” bez rozmowy (warunek na flagę rozmowy), skarbnik „Wzięłam… wziąłem”, Istota „nie widziałeś od Obserwatorium”, Nieśpiący „dziesięć lat” vs pakt dwadzieścia, Brygida w dwóch miejscach naraz (warunek `if` na jednym z nich).
- [ ] **Step 4:** `npm test` zielony; commit `fix: stany powrotu i sprzeczności (E3)`.

### Task 7: Polszczyzna, anachronizmy, nazwy (fala 3b)

**Files:**
- Modify: `data/**/*.json` (grep po frazach niżej), `data/enemies.json`
- Test: `test/content_quality.test.js`

- [ ] **Step 1:** Test `brak zakazanych fraz i anachronizmów w tekstach gry`: lista (regex, bez rozróżniania wielkości liter) – `żadnego sprzeczności`, `ale go nie zaprzecza`, `czy bardziej cię boję`, `do ocenienia`, `Z studni`, `szrapnel`, `facet`, `kontakt wzrokowy`, `opłata manipulacyjna`, `adwokat`, `zarząd portu`, `pozew`; test `wróg "Patrol miejski" nie istnieje (jest Strażnik miejski)`.
- [ ] **Step 2:** Uruchom → FAIL z listą trafień.
- [ ] **Step 3:** Zamień na formy z epoki (np. „do oclenia”, „Ze studni”, „Strażnik miejski”, „straż portowa”, „skarga”, „rzecznik”), popraw pisarza na jedną formę zwracania się; sprawdź, że id wrogów w walkach/lootach/testach nie pęka (zmieniamy `name`, nie `id`).
- [ ] **Step 4:** `npm test` zielony; commit `fix: polszczyzna i anachronizmy (E3)`.

### Task 8: Zamknięcie cyklu

**Files:**
- Modify: `docs/superpowers/plans/2026-10-30-cykl-e3-ledger.md`

- [ ] **Step 1:** Uzupełnij ledger: werdykt końcowy dla każdego punktu (naprawiony + test / nieaktualny), sekcja „Rulings”, lista tego, co zostaje (E3b, balans po przejściu gry).
- [ ] **Step 2:** `npm test` – cały zestaw zielony (podaj liczbę testów).
- [ ] **Step 3:** Commit `docs: ledger E3`; zostaw gałąź do decyzji o scaleniu.
