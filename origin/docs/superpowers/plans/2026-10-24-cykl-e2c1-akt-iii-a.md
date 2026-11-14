# Cykl E2c1 – akt III, odsłona A (osada, poszukiwania, szepty) – plan wykonania

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (natywnie) lub superpowers:subagent-driven-development. Kroki z checkboxami.

**Goal:** Silnik poziomu poszukiwania (`world.search`) i cała treść IIIa: nowa osada-hub, 6 lokacji okolicznych, ≥12 zleceń, zwiadowcy, goście, NPC do pogadania, grafiki, przejście z aktu II i zakończenie odsłony.

**Architecture:** `search` to liczba 0–100 w `state.world` (zapis v11) z funkcjami w `src/systems/search.js`, warunkiem `search {min,max}`, akcją `search: ±n` i naturalnym spadkiem na początku nowego dnia. Cała treść idzie w dane (`travel.json`, `quests.json`, `dialogues/`, `enemies.json`, `story.json`, `art/`, `maps/`) na istniejących mechanizmach E2b1/E2b2 (places, spots, errand, visitors, report/completeQuest, questStatus).

**Tech Stack:** Node ≥22 ESM, `node:test`, zero zależności. `timeout 115 npm test`, `node bin/game.js --validate`, `node bin/game.js --art <id>`.

**Spec:** `docs/superpowers/specs/2026-10-24-cykl-e2c-akt-iii-design.md` (IIIa). **Wytyczne obowiązujące:** `docs/wytyczne-tresci-i-qa.md` (każde zadanie treści kończy się sprawdzeniem punktów z listy kontrolnej).

## Global Constraints
- Odpowiedzi użytkownikowi i cała treść gry po polsku; ton rubaszny, cięty (wytyczne 1).
- Zapis: `SAVE_FORMAT_VERSION` 10 → 11; migracja `10: state => ({...state, version: 11, world: {...state.world, search: 0}})`.
- Dane muszą przechodzić `--validate`; każdy nowy klucz warunku/akcji ma walidację w `conditions.js` / `actions.js`.
- Limit aktywnych zleceń `rules.quests.maxActive` = 8 (podnieść do 10 w zadaniu 5, bo III ma więcej równoległych wątków).
- Grafiki: sceny ≤48×20, portrety 20×20 (`.pix`, paleta xterm-256), obejrzeć `--art <id>`.
- Testy zleceń na prawdziwych danych (`loadData()`), nie na atrapach; wzorzec jak `test/quests_act2.test.js`.
- Nazwy robocze (zmienne w trakcie, zapisać w ledgerze): osada **Głuszec**; lokacje: `bor_klusownikow`, `kamieniolom`, `kapliczka_rozstaje`, `bagna_szarej_wody`, `wzgorze_wartownicze`, `stary_trakt`.

## Ciągłość z aktów I–II (obowiązkowe w zadaniach 4–9)
Flagi pamięci, które akt III ma wykorzystać (usunąć z `MEMORY` w `test/consistency.test.js` po użyciu): `kurier_pytal` i `komendant_wie_o_szkole` (karczmarz/sołtys w Głuszcu słyszeli o pytaniach cesarskich), `odrzucil_stolice` / `waha_sie` (ton sołtysa i informatora), `towarzysze_zgineli` / `towarzysze_zaufanie` (cmentarz, wspomnienie Wojmira), `technologia_wiedza` (kowal, znachorka), `dlug_istoty` (zlecenie 12), `ukryte_insygnia` (kontrola zwiadowców). Przedmiot `mapa_przewodnika` ma zastosowanie w zleceniu 5 lub 11.

## Review Focus
1. `search` poza 0–100 (klamra), zapis/wczytanie w środku sceny z `search` ≠ 0, migracja ze starego zapisu.
2. Kontrola zwiadowców nie może zablokować huba: każdy rezultat (zdana, oblana, walka, ucieczka) zostawia grę grywalną i `search` w widełkach.
3. Zlecenia IIIa nie utykają przy dowolnej kolejności odkrywania miejsc i przy wysokim `search` (obława nie zamyka zleceń bez wyjścia).
4. Przejście akt II → III: gra z zapisu po `akt2_koniec` nadal działa; nie da się utknąć w `akt2_koniec_scena`.
5. Wszystkie nowe zdarzenia warunkowe (`if search`) mają ścieżkę, gdy warunek się nie spełnia (puste menu miejsca, brak gościa).

---

### Task 1: Poziom poszukiwania w silniku
**Files:** Create `src/systems/search.js`, `test/search.test.js`; Modify `src/engine/state.js` (world.search: 0), `src/config.js` (11), `src/engine/save.js` (migracja 10, walidacja pola), `src/engine/conditions.js` (warunek `search`), `src/systems/actions.js` (`ACTION_KEYS` += "search", wykonanie i walidacja), `src/engine/time.js` lub miejsce zmiany dnia (spadek), `data/rules.json` (+`search`), `src/engine/data.js` (schemat `rules.search`).
**Interfaces — Produces:** `addSearch(state, data, delta): number` (klamra 0–100, zwraca nowy poziom), `searchLevel(state, data): "spokoj"|"czujnosc"|"poscig"|"oblawa"` wg `rules.search.levels = {czujnosc: 25, poscig: 50, oblawa: 75}`, `decaySearch(state, data, days)` (−`rules.search.decayPerDay` = 5 na dzień, min 0). Warunek `{"search": {"min"?: n, "max"?: n}}`; akcja `{"search": n}` (n całkowite, ≠ 0).
- [ ] Test (`test/search.test.js`): klamra 0–100; `searchLevel` na progach 24/25/49/50/74/75; warunek min/max; akcja `search: 30` i `-50`; spadek 5/dzień przy `advanceTime` przez północ; migracja z `version: 10` bez `world.search` daje 0; zapis i wczytanie zachowują wartość; `--validate` odrzuca `search: 0` i `search: "x"`.
- [ ] Uruchom (FAIL), zaimplementuj, uruchom (PASS), pełny zestaw zielony. Commit `feat(silnik): poziom poszukiwania`.

### Task 2: Poziom poszukiwania w interfejsie
**Files:** Modify `src/ui/map_screen.js` (linia „Poszukiwania: …” pod nagłówkiem mapy, tylko gdy `world.search > 0` lub aktualny hub ma `showSearch: true`), `src/ui/journal_screen.js` (wiersz), `data/ui.json` (`search.level.spokoj|czujnosc|poscig|oblawa`, `search.label`).
**Interfaces — Consumes:** `searchLevel`.
- [ ] Test: ramka 80×24 i tryb liniowy pokazują „Poszukiwania: czujność”, gdy poziom ≥ 25; ukryte przy 0 poza hubem III. Zero „[[…]]” w wyjściu. Implementacja, zielony zestaw, commit.

### Task 3: Przejście z aktu II i szkielet aktu III
**Files:** Modify `data/story.json` (`akt2_koniec_scena` z `ending` na `narration`; nowe `akt3_wejscie` → `akt3_mapa` (type `map`, hub `gluszec`, main.label „Zamknij dzień”, goto `akt3_odpoczynek`) → `akt3_odpoczynek` (rest) → `akt3_zapis` (save_point) → `akt3_dalej` (flag + `if notFlag akt3a_koniec` + goto `akt3_mapa`) → `akt3a_koniec_scena` (`ending`, `if flag akt3a_koniec`, tekst tymczasowy „Koniec odsłony IIIa”)); `data/travel.json` (location `gluszec` z pustym `spots` na razie, `region: "pogorze"`, wpis na mapie `data/maps/pogorze.txt`); `test/e2e.test.js` (asercja sceny 573: `akt3_mapa`), `test/quests_act2.test.js`.
- [ ] Test: po flagach `akt2_koniec` + zakończeniu eskorty scena to `akt3_wejscie`; z zapisu zapisanego w `akt2_koniec_scena` gra wznawia się w `akt3_wejscie` (migracja sceny w `save.js` repair). Implementacja, commit.

### Task 4: Hub Głuszec – miejsca i NPC do pogadania
**Files:** Modify `data/travel.json` (spots: `karczma_kogut` „Pod Zdechłym Kogutem”, `kuznia`, `znachorka`, `cmentarz`, `soltys`, `mlyn_wodny`, `kramy`, `piwnica` (ukryta, odkrywana zleceniem), `tablica`, + pogadanki `stara_baba`, `chlopiec`, `pijak` po 5 scen wg szablonu `*_0, *_0_f, *_1, *_1_f, *_2` z riposty „a to znowu ty”, „spać nie możesz, psia mać?”, „idź no znajdź sobie zajęcie”, „nie mam czasu, muszę się podrapać”), `data/dialogues/*.json` (soltys, znachorka, kowal_gluszec, handlarz, karczmarz_kogut), `data/art/` (portrety 20×20 + `gluszec.pix`), `data/shops.json` (kramy, kuźnia).
- [ ] Test (`test/gluszec_hub.test.js`): każde miejsce ma ≥1 dostępną pozycję; każdy dialog osiągalny; każda porażka testu ma węzeł ≥100 zn. (istniejący `guidelines.test.js` obejmie); pogadanki mają ≥4 stany; `--validate` czyste. Commit.

### Task 5: Lokacje okolicy i zlecenie wprowadzające
**Files:** Modify `data/travel.json` (6 lokacji z `near.minutes`, `danger`, 2–4 miejsca, `art`, `secret: true` gdzie odkrywane zleceniami), `data/maps/pogorze.txt`, `data/quests.json` (`przyjecie_w_osadzie` – errand o 3 wymianach nieufności sołtysa, nagroda i odkrycie `bor_klusownikow`, `stary_trakt`), `data/rules.json` (`quests.maxActive: 10`), dialogi, `data/art/`.
- [ ] Test na prawdziwych danych: z nowej gry po `akt2_koniec` da się odkryć wszystkie 6 lokacji dowolną kolejnością zleceń (symulacja odkrywania wg wytycznych 5.2); zlecenie wprowadzające nie utyka (wytyczne 5.1). Commit.

### Task 6: Zlecenia 1–6 (łańcuchy)
**Files:** `data/quests.json`, dialogi, scenariusze wypraw. Zlecenia: (1) **Kłusownik i leśniczy** – 4 kroki, wybór strony; (2) **Dług młynarza** – 3 kroki, prośba o zwłokę; (3) **Listy z tamtej strony** – cmentarz → kapliczka → sołtys; (4) **Kto sprzedał ocalałego** – 4 kroki, trop do informatora; (5) **Zwiad na wzgórzu** – wspólny z zadaniem `search` −; (6) **Fałszywe papiery** – kowal/handlarz, odblokowuje przebranie (`search: -15` po ukończeniu).
Każde zlecenie: `report`/`completeQuest` u zleceniodawcy, `onStart`/`onComplete`, brak zabierania przedmiotów bez aktywnego zlecenia, `questStatus` zamiast flagi po `startQuest`, ścieżka bez rzutu przy każdej decyzji fabularnej.
- [ ] Test `test/quests_act3a_1.test.js` (jak `quests_act2`): każde zlecenie przechodzi od startu do nagrody na prawdziwych danych; po porażce testu da się dokończyć; kolejność celów dowolna. Commit.

### Task 7: Zlecenia 7–12 i goście
**Files:** `data/quests.json`, `data/travel.json` (`visitors` w Głuszcu i okolicy: wędrowny handlarz, fałszywy pielgrzym, informator zwiadowców – z zleceniami), dialogi. Zlecenia: (7) **Rannego nie zostawia się** (kamieniołom, medycyna), (8) **Bagnisty skarb** (bagna, `search +10`), (9) **Wdowa po strażniku** (kontynuacja `corka`/amulet z II), (10) **Najemnik w karczmie** (opcja walki/przekupstwa), (11) **Zaginiona karawana** (stary trakt), (12) **Co widziała Ragnosława** (wątek Istoty, odsłania wątek IIIb).
- [ ] Test `test/quests_act3a_2.test.js` jak w Task 6 plus `visitors` (los, `once`, brak ponownego losowania po wznowieniu). Commit.

### Task 8: Zwiadowcy: kontrole, wrogowie, konsekwencje
**Files:** `data/enemies.json` (`zwiadowca_cesarski`, `kusownik`), `data/travel.json` (zdarzenie `kontrola_zwiadowcow` z `if {"search": {"min": 25}}` w Głuszcu i na drodze, patrol z `min: 50`, obława z `min: 75`), dialogi `kontrola.json` (wymowa/skradanie/przebranie – flaga `papiery_fałszywe` ułatwia; ripostę po porażce; zawsze opcja bez rzutu: przeczekać w piwnicy → `search −`), walki (`sim` ≥200 losowań na klasę, widełki z `rules`).
- [ ] Test: każde rozwiązanie kontroli zostawia `search` w 0–100 i grę grywalną; zdarzenie z `if` nie psuje menu gdy warunek fałszywy; symulacja przeżywalności; zapis w środku kontroli i wznowienie. Commit.

### Task 9: Zakończenie IIIa i grafiki
**Files:** `data/story.json` (zdarzenie przełomowe: zlecenie 12 lub `search ≥ 75` ustawia `akt3a_koniec`; tekst `akt3a_koniec_scena`), `data/art/*.pix` (wszystko, czego brakuje wg `guidelines.test.js`: portrety dialogowych NPC i obrazy lokacji).
- [ ] Test e2e: z nowej gry (obie klasy) do `akt3a_koniec_scena` na prawdziwych danych; `guidelines.test.js` zielony (portrety/obrazy); `--validate`; pełny zestaw. Ledger `docs/superpowers/plans/2026-10-24-cykl-e2c1-ledger.md`. Commit.

### Task 10: Recenzja i poprawki
- [ ] Recenzent (Opus) na całej gałęzi z listą kontrolną z `docs/wytyczne-tresci-i-qa.md` i sekcją Review Focus; jedna tura poprawek (każda poprawka RED→GREEN), minor do ledgera; scalenie dopiero na „Merge” użytkownika.

## Zgodność z wytycznymi (skrót)
Ton/riposty: zadania 4, 6–8. Spójność i rozliczanie u zleceniodawcy: 5–7, 9. Interfejs: 2. Walka: 8. Dane/QA: testy w każdym zadaniu, Review Focus. Grafiki: 4, 5, 9.
