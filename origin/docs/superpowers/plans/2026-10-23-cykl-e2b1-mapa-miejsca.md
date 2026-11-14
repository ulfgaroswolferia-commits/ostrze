# Cykl E2b1 – pobojowisko, mapa, miejsca i zlecenia z celami – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Początek aktu II na pobojowisku i rozdrożu, a potem swobodne chodzenie po mapie Pogórza: lokacje z miejscami, stopniowe odkrywanie, zlecenia z celami (dostarczanie, informacje, szukanie osoby), bliskie i dalekie wyprawy, nowy ekran mapy, zapis v10.

**Architecture:** Nowy moduł `src/systems/places.js` (wiedza gracza o miejscach), rodzaj zlecenia `errand` w `src/systems/quests.js` z celami zatrzaskiwanymi w `state.quests[id].done`, rozszerzona scena `map` (fazy `choose` → `walk` → `place` → `spot` obok dotychczasowych `outbound`/`onsite`/`return`), bliska droga w minutach (`src/scenes/walk.js`). Treść w danych (`travel.json`, `quests.json`, dialogi, `data/maps/pogorze.txt`, grafiki).

**Tech Stack:** Node ≥ 22 ESM, `node:test`, dane JSON, zero zależności. Polskie teksty gry; kod i komentarze po angielsku (jak w reszcie repo).

**Spec:** `docs/superpowers/specs/2026-10-23-cykl-e2b1-mapa-miejsca-design.md` (gałąź `cykl-e2b1`).

## Decyzje planu względem specyfikacji

Spec jest nadrzędny; poniższe rozstrzygają to, czego nie wiązał, albo upraszczają. Wykonawca zapisuje je w ledgerze jako `Ruling:` (bez ponownego rozważania).
1. **Postęp celów zlecenia jest zatrzaskiwany** w `state.quests[id].done: string[]` (id wykonanych celów), nie wyliczany bezstanowo: cel typu `{ item }` przestaje być prawdziwy po oddaniu przedmiotu, więc „wszystkie cele naraz” nie działa. `advanceErrands` bada kolejno pierwszy niezatrzaśnięty cel i zatrzaskuje, aż któryś nie jest spełniony (cel „z góry” zalicza się od razu).
2. **Brak pola `map: {x,y}`** w lokacjach: położenie znacznika wynika z tokenu `{id}` w pliku `data/maps/<region>.txt` (jedno źródło prawdy).
3. **`wilczy_brod` nie jest `secret`**, więc jest widoczny od początku; `world.discovered` i `world.hinted` startują puste (`[]`), migracja 9→10 dodaje puste tablice. Notatki Wojmira dają `hint: "wilczy_las"` (pierwsze „???” na mapie), nie `reveal` huba.
4. **Nowy typ przedmiotu `misc`** (przedmioty fabularne: bez pól specyficznych, nie do użycia, nie do sprzedaży) – `ITEM_TYPES` nie miał takiego typu.
5. **Zlecenia `errand` poza `mapOptions`, `abandonHub` i pytaniem „Ruszać?”** – to cele w miejscach, nie wyprawy.
6. **Droga bliska:** koszt z huba do lokacji bliskiej i z powrotem = `near.minutes`; między dwiema bliskimi = suma. Zlecenia-wyprawy (`quest`/`escort`, dalekie) są dostępne tylko, gdy gracz stoi w hubie.
7. **Miejsca `talk`/`shop`/`rest`/`scene` uruchamiane są przez `runScenes` na syntetycznej jednoelementowej liście scen** o id `miejsce:<lokacja>.<miejsce>` (hooki po scenie – awans i `advanceErrands` – działają bez dodatkowego kodu); przed wejściem `forgetScenes` (rozmowa jest powtarzalna).
8. **Lokacja testowa „Las Rubieży” (`wilczy_las`, 40 min, `danger 2`, `secret`)** należy do E2b1, bo bez bliskiej lokacji nie da się przetestować drogi bliskiej ani celu „zanieś”.

## Uwagi użytkownika po przejściu dema (dopisane w trakcie wykonania; wiążące dla Task 7, 8, 10)

1. **Pobojowisko ma 4 przeszukania** (nie 3): Skarimir, Ragnosława, Wojmir i **porzucony tobołek przewodnika** – w nim wskazówka drogi do celu (przedmiot `mapa_przewodnika` + `hint: "wilczy_las"`), bo cel znał tylko przewodnik. Przewodnika nie ma wśród ciał: tekst mówi, że **uciekł jak zając**. Notatki Wojmira zostają zwykłym łupem (prowiant), bez mapy.
2. **Komendant nie zleca od razu:** 2–3 wymiany, w których wybadywa, kim jest ten obszarpaniec (podejrzliwość); zlecenie Wilczej nory dopiero potem. Dialogi ogólnie o jedną kwestię dłuższe.
3. **Po misji wilków dwie akcje:** powrót do komendanta (rozmowa), zakończenie misji + nagroda + wzmianka o kurierze.
4. **Wieczór po „Czekaj na kuriera”:** scena „Rzuciłeś mistrzowi w twarz…” (`demo_przekora`) jest wyrwana z kontekstu – usunąć lub przepisać tak, by nawiązywała do wydarzeń w Brodzie (usunięcie `demo_przekora`/`demo_posluch` wraz z testami to dopuszczalny ruling).
5. **Task 10 (nowy): czysty ekran** – czyszczenie ma kasować też przewijany bufor (`[3J`), by po odrysowaniu ekranu nie było poprzedniego kontekstu nad oknem.

## Global Constraints

- Node ≥ 22, ESM, zero zależności; testy: `timeout 115 npm test`, walidacja: `node bin/game.js --validate` → „Dane poprawne.”.
- Wszystkie teksty dla gracza po polsku, w `data/ui.json` (klucze w `t(ui, key, params)`), nie w kodzie.
- Ramka tylko w TTY ≥ 80×24, tryb liniowy bez zmian (lista numerowana `[n] …`); ramka ma `rows − 1` wierszy, szerokość ≤ 200.
- Mapa ASCII tylko gdy lewy panel ma ≥ 60 kolumn i ≥ 14 wierszy (`SCENE_MIN_COLS`/`SCENE_MIN_ROWS` w `map_screen.js`), inaczej opis zaznaczonej lokacji.
- `SAVE_FORMAT_VERSION` = 10; zapis w menu miejsc i w trakcie drogi bliskiej wznawia się w tym samym miejscu.
- Id: `^[a-z0-9_]+$`; id miejsca globalnie `<lokacja>.<miejsce>`; id sceny unikalne w story, zdarzeniach i zleceniach.
- Każdy węzeł rozmowy ma opcję zawsze dostępną (walidator); wymagane warunki wyłączają opcję (`requires`), nie ukrywają.
- Grafiki: `.pix` (linia `paleta:` + siatka liter), podgląd `node bin/game.js --art <id>`; wymiary wzoruj na `portret_wszebor.pix` (20×44 wiersze) i `mapa_brod.pix`.
- Każdy commit kończy się stopką: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` i `Claude-Session: https://claude.ai/code/session_01CSUDEqmx6DsMRLPg8xRKSu`.

## Review Focus

1. Zapis w środku rozmowy w miejscu (`miejsce:…` w `dialogueProgress`) nie może zostać skasowany przez `repairDialogues` (zna tylko sceny z story) – wznowienie nie powtarza akcji wejścia (Task 6).
2. Zlecenie `errand` startowane, gdy cel jest już spełniony, i zlecenie ukończone w jednym kroku z kilkoma celami na raz (Task 3).
3. `reveal`/`hint` powtórzone dwa razy i na ukryte miejsce w nieodkrytej lokacji: komunikat tylko raz (Task 1).
4. Droga bliska przerwana zapisem po wyjściu, w trakcie zdarzenia i po nim: czas nie liczy się podwójnie, cel i tak jest osiągnięty (Task 4).
5. Mapa przy 80×24 bez rysunku (lista), przy 200×50 z rysunkiem; wąskie okno nie psuje ramki; tryb liniowy ma pełną listę (Task 5).

---

### Task 1: Wiedza o świecie – `discovered`/`hinted`, warunek `known`, akcje `reveal`/`hint`/`startQuest`, zapis v10

**Files:**
- Create: `src/systems/places.js`, `test/places.test.js`
- Modify: `src/config.js` (`SAVE_FORMAT_VERSION = 10`), `src/engine/state.js`, `src/engine/save.js` (migracja `9`, `WORLD_SCHEMA`, naprawa), `src/engine/conditions.js` (`known`, `opts.places`), `src/systems/actions.js`, `src/ui/events.js`, `data/ui.json`, `test/helpers.js` (bez zmian w tym tasku), `test/save.test.js`, `test/actions.test.js`, `test/conditions.test.js`

**Interfaces:**
- Produces (`places.js`, nie importuje `conditions.js` ani `travel.js` – czyta `data.travel.locations` sam):
  - `placeIds(data): string[]` – id lokacji i miejsc (`"wilczy_brod"`, `"wilczy_brod.karczma"`).
  - `placeById(data, id): { location, spot|null } | undefined`.
  - `isKnown(state, data, id): boolean` – lokacja: `!secret || discovered`; miejsce: jego lokacja znana i `!spot.secret || discovered`.
  - `revealPlace(state, data, id): object[]` – `[{ type: "odkryto", id }]` albo `[]` gdy już znane; `hintPlace(state, data, id): object[]` – `[{ type: "zapowiedz_miejsca", id }]` albo `[]` gdy znane lub zapowiedziane.
  - `repairPlaces(state, data): string[]` – usuwa nieznane id z `world.discovered`/`world.hinted`, zwraca złe id.
- Produces: warunek `{ known: "<id>" }` (walidacja: tekst z `opts.places`); akcje `{ reveal: "<id>" }`, `{ hint: "<id>" }`, `{ startQuest: "<id>" }` (walidacja: znane id miejsca / zlecenia).

- [ ] **Step 1: Testy (RED)** w `test/places.test.js`, `test/conditions.test.js`, `test/actions.test.js`, `test/save.test.js`:
  - `isKnown`: lokacja bez `secret` znana od razu; `secret` – dopiero po `revealPlace`; miejsce `secret` w znanej lokacji; miejsce w nieodkrytej lokacji nieznane (na `structuredClone(minimalData())` z dopisaną lokacją `{ id: "las", secret: true, spots: [{ id: "polana", ... }] }`).
  - `revealPlace` dwa razy → drugi wynik `[]`; `hintPlace` dla znanego → `[]`.
  - `evaluate({ known: "las" }, state, data)` false → true po reveal; `validateCondition({ known: "nieistnieje" })` zwraca błąd „nieznane miejsce”.
  - `runActions` z `reveal`/`hint`/`startQuest` zwraca zdarzenia `odkryto`/`zapowiedz_miejsca`/`zadanie_start`; `validateActions` odrzuca `reveal` z nieznanym id i `startQuest` z nieznanym zleceniem.
  - zapis: `createNewState().world.discovered` i `.hinted` to `[]`; `migrations[9]` dodaje je do zapisu v9 i podbija wersję; `loadGame` usuwa nieznane id z `discovered` z ostrzeżeniem `load.repair.places`.
- [ ] **Step 2:** `timeout 115 node --test test/places.test.js test/conditions.test.js test/actions.test.js test/save.test.js`. Expected: FAIL (brak `places.js`, `known`, akcji, migracji).
- [ ] **Step 3:** Zaimplementuj `places.js`; `state.js` (`discovered: [], hinted: []` w `world`); `config.js`; `migrations[9]` (`world.discovered ??= []`, `world.hinted ??= []`); `WORLD_SCHEMA` (pola `discovered`, `hinted` jako tablice tekstów, w `required`); `repairPlaces` dołączone do listy napraw w `loadGame` + `repairPlaces` w `save.js` z komunikatem `load.repair.places`; `conditionOpts` → `places: placeIds(data)`; `evaluate`: `case "known": return isKnown(state, data, value)`; `actions.js`: `ACTION_KEYS` + walidacja + wykonanie (`startQuest` przez `startQuest` z `quests.js`, zdarzenia dołączone do `events`); `events.js`: przypadki `odkryto` (`event.revealed`) i `zapowiedz_miejsca` (`event.hinted`); `ui.json`: `"event.revealed": "Nowe miejsce na mapie: {name}"`, `"event.hinted": "Słyszysz o czymś w okolicy… (nowe „???” na mapie)"`, `"load.repair.places": "miejsca ({ids})"`. Nazwa w komunikacie: dla miejsca `spot.name`, dla lokacji `location.name`.
- [ ] **Step 4:** ten sam zestaw testów. Expected: PASS; potem `timeout 115 npm test` (pełny) – zielony.
- [ ] **Step 5: Commit** `feat(swiat): wiedza o miejscach (discovered/hinted), warunek known, akcje reveal/hint/startQuest, zapis v10`.

---

### Task 2: Lokacje z miejscami – schemat, walidacja, nowy typ `misc`, plik mapy regionu

**Files:**
- Modify: `src/systems/travel.js` (`LOCATION_SCHEMA`, `validateTravel`), `src/systems/items.js` (typ `misc`), `src/engine/data.js` (`loadData`: `maps`, walidacja map), `test/helpers.js` (`minimalData`: `maps`), `src/ui/strings.js` bez zmian
- Create: `data/maps/pogorze.txt` (placeholder z tokenami hub i las; pełna wersja w Task 8), `test/places_data.test.js`
- Test: `test/travel.test.js`, `test/data.test.js`

**Interfaces:**
- Consumes: `placeIds`, `validateCondition`, `conditionOpts`, `validateActions` (nie dotyczy), `artRefErrors`.
- Produces: pola lokacji `near: { minutes: 1–180 }`, `danger: 1–4`, `secret: boolean`, `hint: tekst`, `art: id`, `spots: [{ id, name, type: "talk"|"shop"|"rest"|"board"|"scene", ref?, scenes?, if?, secret?, art? }]`; `data.maps: { [regionId]: string }` (zamrożone teksty z `data/maps/*.txt`); `parseMap(text): { lines: string[], tokens: { id, line, col, len }[] }` w `src/ui/map_screen.js` (Task 5) – tu tylko wczytanie surowego tekstu.

- [ ] **Step 1: Testy (RED)** `test/places_data.test.js` (na `structuredClone(minimalData())`), każdy błąd walidacji osobno, komunikaty zaczynają się od `travel.json › locations › <id> ›`:
  - `spots[].type` spoza listy; `talk` z `ref` nieznanej rozmowy; `shop` z nieznanym sklepem; `scene` bez `scenes` lub z pustą listą; `board`/`rest` z `ref`; powtórzone `spots[].id` w lokacji; `near.minutes` 0 i 181; `danger` 5; `art` nieznany; `spots[].if` nieznany warunek.
  - scena w `spots[].scenes` jest walidowana jak scena zdarzenia (zła `goto`), a jej id musi być unikalne globalnie.
  - `mapa`: plik `data/maps/<region>.txt` ma token `{id}` nieznanej lokacji → błąd; lokacja `near` bez tokenu w mapie regionu → błąd; ładowanie danych bez katalogu `maps` → `DataLoadError`.
  - `items.json`: przedmiot `{ type: "misc" }` bez pól dodatkowych jest poprawny; `misc` z polem `damage` nie.
- [ ] **Step 2:** `timeout 115 node --test test/places_data.test.js`. Expected: FAIL (nieznane pola lokacji, brak typu `misc`).
- [ ] **Step 3:** Rozszerz `LOCATION_SCHEMA` (pola opcjonalne) i `validateTravel` o `validateSpots(location, at, data)` (w `travel.js`, bo tam jest `validateCondition`); sceny `spots[].scenes` waliduj w `validateTravelData` (`data.js`) przez istniejące `sceneList` z `event: true` (prefiks `travel.json › locations › <id> › spots › <spot>`); `TYPE_SCHEMAS.misc = { required: [], fields: {} }` i `ITEM_TYPES` + `"misc"`; `readMaps(dir)` w `data.js` (`maps/*.txt` → `{ pogorze: "..." }`, brak katalogu = `DataLoadError`) i dopisanie `maps` do `loadData`/`deepFreeze`; `validateMaps` (tokeny `{id}` → znane lokacje, lokacja `near` musi mieć token); `minimalData()` wczytuje `maps`.
- [ ] **Step 4:** testy z kroku 1 oraz `timeout 115 npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(dane): lokacje z miejscami (spots), typ misc, mapa regionu jako plik`.

---

### Task 3: Zlecenia `errand` – cele, awans, ukończenie, dziennik

**Files:**
- Modify: `src/systems/quests.js`, `src/scenes/after.js` (hook), `src/ui/journal_screen.js`, `src/ui/events.js` (bez nowych typów), `data/ui.json`, `src/engine/data.js` (`validateQuests` już woła się z `validateTravelData`; `quests.json` bez zmian w tym tasku)
- Test: `test/quests.test.js`, `test/journal.test.js`, `test/scenes.test.js` (hook)

**Interfaces:**
- Consumes: `evaluate`, `validateCondition`, `conditionOpts`, `placeIds`, `runActions`, `validateActions`, `startQuest` (rozszerzony).
- Produces:
  - `QUEST_KINDS` + `"errand"`; schemat `ERRAND_SCHEMA` (wymagane: `id, kind, name, hub, description, objectives`; opcjonalne: `requires` (warunek), `deadlineDays` (null lub ≥ 1; brak = bez terminu), `onComplete` (akcje)); `objectives: [{ id, text, at, done }]` – `at` = id lokacji lub miejsca (`placeIds`), `done` = poprawny warunek, id celów unikalne w zleceniu, niepusta lista.
  - `errandProgress(state, data, quest): { objectives: { id, text, at, done: boolean }[], current: object|null, complete: boolean }` (tylko odczyt, wg `state.quests[id].done`).
  - `advanceErrands(state, data, rng): object[]` – dla każdego aktywnego `errand`: zatrzaskuje kolejne spełnione cele; po ostatnim: `status = "done"`, `runActions(onComplete)`, zdarzenia (`zadanie_wykonane` + zdarzenia akcji); powtarza przebieg, dopóki coś się zmienia (łańcuch `startQuest` w `onComplete`).
  - `canStartQuest(state, data, id): boolean` – nie podjęte, spełnione `requires` (dla `errand`), limit `maxActive`.
  - `activeErrands(state, data, hub?)`, `currentObjectives(state, data): { quest, objective }[]` (do znaczników `!` na mapie).
  - `startQuest` dla `errand` tworzy wpis `{ status: "active", acceptedAt, deadline, departed: true, done: [] }` i od razu woła awans pierwszego celu przy najbliższym `advanceErrands` (nie w `startQuest`).
  - `errandHook(ctx)` w `after.js`, dodany do `defaultAfterScene` po `levelUpHook`: `pushEventNotices(ctx, advanceErrands(ctx.state, ctx.data, ctx.rng))`.
  - `mapOptions`, `abandonHub`, `activeQuests(…, hub)` w `map.js` ignorują `errand` (funkcja pomocnicza `tripQuests(state, data, hub)` = aktywne nie-`errand`).

- [ ] **Step 1: Testy (RED)** (`test/quests.test.js`, na klonie danych z dopisanym zleceniem testowym `kind: "errand"` z dwoma celami: `{ item: "prowiant" }` i `{ flag: "oddano" }`, `onComplete: [{ giveMoney: 8 }, { xp: 10 }, { reveal: "…" }]`):
  - walidacja: cel bez `at`, `at` nieznane, `done` nieznany warunek, powtórzone id celu, pusta lista celów, `onComplete` z błędną akcją, `errand` z polami `route`/`scenes` (niedozwolone).
  - `errandProgress`: bieżący cel to pierwszy niezatrzaśnięty; po `advanceErrands` z prowiantem w torbie cel 1 zatrzaśnięty (`done: ["…"]`), cel 2 bieżący; po usunięciu prowiantu cel 1 **nadal** zaliczony (zatrzask).
  - cel „z góry”: przedmiot już w torbie przed `startQuest` – po pierwszym `advanceErrands` zatrzaśnięty.
  - oba cele spełnione naraz → jedno wywołanie kończy zlecenie (`status: "done"`), `onComplete` wykonane raz (pieniądze +8), drugie wywołanie nic nie zmienia.
  - łańcuch: `onComplete` z `startQuest` innego `errand`, którego cel jest spełniony, kończy oba w jednym `advanceErrands`.
  - `canStartQuest`: `requires: { known: "x" }` niespełnione → false; limit `maxActive` → false; już podjęte → false.
  - `mapOptions` i `abandonHub` pomijają `errand`.
  - `defaultAfterScene` zawiera `errandHook`; scena `narration` uruchomiona przez `runScenes` po ustawieniu flagi kończy zlecenie.
  - dziennik: `renderJournal` dla aktywnego `errand` pokazuje nazwę, opis i cele: `✓ tekst` (zatrzaśnięty), `→ tekst · <miejsce>` (bieżący), `· tekst` (dalsze); `quest`/`escort` bez zmian.
- [ ] **Step 2:** `timeout 115 node --test test/quests.test.js test/journal.test.js test/scenes.test.js`. Expected: FAIL.
- [ ] **Step 3:** Zaimplementuj w `quests.js` (rozdziel `validateQuest` na `validateTrip` i `validateErrand`, zachowując komunikaty istniejących zleceń), `after.js`, `journal_screen.js` (`journal.objectiveDone`/`Current`/`Pending`, `journal.entryErrand` w `ui.json`; miejsce celu: nazwa lokacji lub „lokacja – miejsce”), `repairQuestState`: wpis zlecenia z `done` zawierającym nieznane id celu → usuń te id; mapa: nowe pola `map` (Task 6) naprawia Task 6.
- [ ] **Step 4:** testy z kroku 1 + `timeout 115 npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(zlecenia): zlecenia errand z celami (zatrzask postępu), hook po scenie, dziennik z celami`.

---

### Task 4: Droga bliska – minuty, zdarzenie lokalne, wznawianie z zapisu

**Files:**
- Create: `src/scenes/walk.js`, `test/walk.test.js`
- Modify: `src/systems/travel.js` (`walkMinutes`, `rollLocalEvent`), `data/rules.json`, `src/engine/data.js` (`RULES_SCHEMA`, walidacja zakresu), `src/systems/quests.js` (`repairQuestState`: pola `map.walk`), `data/ui.json`
- Test: `test/travel_system.test.js`

**Interfaces:**
- Consumes: `advanceTime`, `runScenes`, `createSceneList`, `eventById`, `forgetScenes` (z `trip.js`), `pushEventNotices`.
- Produces:
  - `rules.travel.localEventChance` (0–100, domyślnie 25) i `rules.travel.localDangerBonus` (0–100, domyślnie 20; dodawane przy `danger ≥ 3`).
  - `walkMinutes(data, fromId, toId): number` – hub (lokacja stała bez `near`) ↔ bliska = `near.minutes`; bliska ↔ bliska = suma; ten sam punkt = 0.
  - `rollLocalEvent(state, data, rng, danger): string | null` – jedno losowanie szansy, potem losowanie ważone wśród zdarzeń `weight > 0`, `kind` ∈ {`encounter`, `attack`}, bez `endsTrip`, z przechodzącym `if` i niewidzianych `once`; zero `rng.int` poza tymi dwoma.
  - `walk(ctx, to): Promise<void>` w `walk.js` – steruje `state.world.map.walk = { to, step: 0|1|2, event: string|null|false, eventScene }`: `step 0` → losuje zdarzenie (`false` = brak) i idzie pierwszą połowę minut (zdarzenie ustawia `event`), `step 1` → gra zdarzenie przez `runScenes(…, { endId: EVENT_END, onScene })` ze śledzeniem `eventScene`, `step 2` → druga połowa minut i `state.world.location = to`, `walk = null`. Cały przebieg wznawialny z zapisu w dowolnym kroku.

- [ ] **Step 1: Testy (RED)**:
  - `walkMinutes`: hub→las 40, las→hub 40, las→inna bliska 40+X, brak ruchu 0.
  - `rollLocalEvent`: przy `localEventChance 0` zawsze `null`; przy 100 zwraca id zdarzenia z puli; nigdy `story`/`weather`/`endsTrip`; `danger 3` podnosi szansę o `localDangerBonus` (test na przygotowanym `rng` z `{int}`); `once` obejrzane pomijane.
  - `walk`: bez zdarzenia czas rośnie dokładnie o `walkMinutes`, `world.location` = cel, brak `world.travel`, brak obozu/głodu; ze zdarzeniem (`localEventChance 100`, pula tylko jedno zdarzenie ze scenami narration) – czas = minuty + czas scen, zdarzenie zagrane raz.
  - zapis w `step 1` w trakcie zdarzenia (`eventScene` ustawione) → po wczytaniu `walk` kończy zdarzenie bez ponownego liczenia pierwszej połowy; łączny czas równy wersji bez zapisu.
  - `repairQuestState` z `map.walk.to` nieznanej lokacji → `walk = null`, faza `choose`.
  - `--validate`: `localEventChance` 101 → błąd w `rules.json`.
- [ ] **Step 2:** `timeout 115 node --test test/walk.test.js test/travel_system.test.js`. Expected: FAIL.
- [ ] **Step 3:** Zaimplementuj `walkMinutes`, `rollLocalEvent` (w `travel.js`), `walk.js`, reguły w `rules.json` + `RULES_SCHEMA`/`validateTravelData`, naprawę w `repairQuestState`.
- [ ] **Step 4:** testy z kroku 1 + `timeout 115 npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(podroz): droga bliska w minutach ze zdarzeniem lokalnym, wznawialna z zapisu`.

---

### Task 5: Ekran mapy – mapa ASCII, lista „Dokąd iść?”, „Nieodkryte”, opis

**Files:**
- Modify: `src/ui/map_screen.js`, `src/ui/camp.js` (rozszerzone `before`), `data/ui.json`, `data/maps/pogorze.txt`
- Test: `test/map_screen.test.js` (nowy), `test/camp.test.js` w istniejącym `ui.test.js` jeśli brak pliku

**Interfaces:**
- Consumes: `isKnown`, `placeById`, `walkMinutes`, `currentObjectives`, `data.maps`.
- Produces w `map_screen.js`:
  - `parseMap(text): { lines: string[], tokens: { id, line, col, len }[] }`.
  - `renderRegionMap(state, data, { region, here, marks, width, height }): string[] | null` – podstawia tokeny: znana lokacja `[n] Nazwa` (n = numer na liście celów), zapowiedziana `[?]`, ukryta – spacje; lokacja z bieżącym celem `!` przed nawiasem; `here` → `@` zamiast numeru z dopiskiem „Jesteś tu” w legendzie; `null`, gdy `width < 60` lub `height < 14` (lub mapa szersza od panelu).
  - `destinationEntries(state, data, hub): { id, location, minutes|days, danger, quest|null, marked, label, description }[]` – znane lokacje (stałe, w kolejności `locations`) poza bieżącą oraz cele-wyprawy (aktywne `quest`/`escort` huba, tylko gdy `state.world.location === hub`); `label` np. `Las Rubieży · ~40 min · Niskie`, `Wilcza Nora · zadanie „…” · 1 dzień`.
  - `undiscoveredLines(state, data): string[]` – po jednej linii `??? · <hint>` na zapowiedzianą, nieodkrytą lokację.
  - `dangerText(ui, n)` (`map.danger.1…4`: Bezpiecznie, Niskie, Średnie, Wysokie); `minutesText(ui, n)` (`~25 min`, `~1 h 30 min`).
  - `campMenu` przyjmuje w `before` elementy `{ id, label, description?, hint?, disabled? }` i opcję `title` (podawane do `select`); zachowanie bez nich bez zmian.

- [ ] **Step 1: Testy (RED)**:
  - `renderRegionMap`: tylko hub znany → w mapie `[1] Wilczy Bród`, brak nazw ukrytych; lokacja zapowiedziana → `[?]`; po `reveal` → `[n] Las Rubieży`; `@` stoi przy bieżącej lokacji; `!` przy lokacji z bieżącym celem; zwraca `null` dla `width 59` i `height 13`; żadna linia nie przekracza `width`.
  - `destinationEntries`: etykiety z czasem i zagrożeniem; lokacje ukryte nie występują; wyprawy `quest` tylko w hubie.
  - ekran w `framesOn` 200×50 (z `createAdaptiveIO([], { tty: true })` i `io.columns/rows` ustawionymi) zawiera mapę, „Dokąd iść?”, linię „Nieodkryte” z `???`; 80×24 – bez mapy, opis zaznaczonej lokacji w lewym panelu; tryb liniowy: lista `[n] …` ze wszystkimi celami; `ramka == rows − 1` wierszy (wzór: `frame.test.js`).
  - `campMenu` z `before: [{ id, label, description, disabled }]` pokazuje opis i nie pozwala wybrać `disabled`.
- [ ] **Step 2:** `timeout 115 node --test test/map_screen.test.js test/ui.test.js`. Expected: FAIL.
- [ ] **Step 3:** Zaimplementuj powyższe; napisz pełny `data/maps/pogorze.txt` (ok. 64×16, rzeka, droga, tokeny `{wilczy_brod}`, `{wilczy_las}`, `{wilcza_nora}`, `{kamienna_przelecz}` oraz miejsca na planowane w E2b2 `{wilczy_mlyn}`, `{trakt_kupiecki}`, `{ruiny_straznicy}` – tokeny lokacji, których jeszcze nie ma w `travel.json`, są **błędem** walidacji z Task 2, więc w E2b1 dopisz tylko istniejące; reszta w E2b2).
- [ ] **Step 4:** testy z kroku 1 + `timeout 115 npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): ekran mapy regionu – mapa ASCII, cele z czasem i zagrożeniem, nieodkryte`.

---

### Task 6: Scena `map` jako hub miejsc – fazy `choose`/`walk`/`place`/`spot`, tablica zleceń

**Files:**
- Modify: `src/scenes/map.js` (przepisanie wyboru i dodanie faz), `src/systems/quests.js` (`repairQuestState`), `src/engine/save.js` (`repairDialogues`), `src/systems/places.js` (`spotScene`, `visibleSpots`, `boardQuests`), `data/ui.json`, `test/map_scene.test.js` (dostosuj), `src/scenes/schemas.js` (bez zmian pól sceny `map`)
- Test: `test/map_scene.test.js`, `test/map_places.test.js` (nowy)

**Interfaces:**
- Consumes: `destinationEntries`, `renderRegionMap`, `walk`, `runScenes`, `forgetScenes`, `advanceErrands`, `canStartQuest`, `startQuest`, `campMenu`.
- Produces:
  - `state.world.map = { hub, phase: "choose"|"walk"|"place"|"spot"|"outbound"|"onsite"|"return", quest, questScene, spot: string|null, walk: object|null }`; nowa mapa startuje w fazie `place` (gracz stoi w hubie).
  - `places.js`: `spotSceneId(location, spot): "miejsce:<loc>.<spot>"`, `spotScene(data, locationId, spot): { id, type, … }` (talk → `{ type: "dialogue", dialogue: ref, art }`, shop → `{ type: "shop", shop: ref }`, rest → `{ type: "rest" }`, scene → pierwsza z `scenes` i lista `scenes`), `visibleSpots(state, data, locationId)` (znane miejsca; `if` niespełnione = oznaczone jako niedostępne), `boardQuests(state, data, hub)` (zlecenia huba, które `canStartQuest`, w kolejności `quests.json`).
  - `choose`: ekran z Task 5; wybór lokacji bliskiej → `phase: "walk"` i `walk(ctx, to)`, potem `phase: "place"`; wybór wyprawy → dotychczasowy przebieg `outbound` → `onsite` → `return`; „main” (tylko w hubie) jak dotąd, z pytaniem „Ruszać?” tylko przy aktywnych **nie-errandach**.
  - `place`: menu miejsc lokacji (`!` przy bieżącym celu, szare niedostępne, „Wróć na mapę”); wejście → `phase: "spot"`, `spot: id`; `spot`: `forgetScenes` (chyba że `dialogueProgress` ma wpis tej sceny), `runScenes` na jednoelementowej liście (lub liście `scenes` miejsca), powrót do `place`. `board`: lista zleceń do podjęcia (opis w polu informacji), wybór → `startQuest` + komunikat; pusta lista → komunikat „Brak ogłoszeń”.
  - `repairDialogues` rozpoznaje id `miejsce:*` przez `spotScene`.

- [ ] **Step 1: Testy (RED)** w `test/map_places.test.js` (dane: klon z lokacją `wilczy_brod` mającą miejsca i `wilczy_las`; story `{ mapa, koniec }`; sterownik `createAdaptiveIO` ze `{ pick: "…" }`):
  - wejście do `map` w hubie: menu miejsc zawiera komendanta, karczmę, kramik, tablicę; miejsce `secret` niewidoczne do `reveal`.
  - rozmowa w miejscu jest powtarzalna: dwa wejścia do tego samego `talk` rozgrywają ją dwa razy (flagi dialogu decydują o treści); dialog ustawiający flagę kończy cel `errand` zaraz po wyjściu (hook).
  - `board`: zlecenie `errand` z niespełnionym `requires` nie jest na liście; po spełnieniu można je podjąć raz; limit `maxActive` daje komunikat.
  - droga bliska z menu mapy: czas jak `walkMinutes`, `world.location` = cel, menu miejsc celu; powrót do huba symetryczny.
  - `main` w hubie kończy scenę, z pytaniem tylko przy aktywnych `quest`/`escort`; `errand` nie wywołuje pytania i nie przepada.
  - wyprawa po zlecenie `wilcza_nora` działa jak dawniej tylko ze stanu w hubie; w lokacji bliskiej wyprawy nie ma na liście.
  - zapis: w menu miejsc, w trakcie miejsca (`phase: "spot"`, `dialogueProgress["miejsce:…"]`), w trakcie drogi bliskiej – po `loadGame` ta sama faza i ten sam ekran; `repairDialogues` nie kasuje postępu miejsca, kasuje postęp nieznanego `miejsce:x.y`.
  - nieznana lokacja w `map.walk`/`map.spot` → naprawa do `choose`/`place`.
  - `test/map_scene.test.js` (stare testy `nora`/eskorty): dostosuj oczekiwane teksty (`Wilczy Bród – dokąd?` → nowy tytuł „Dokąd iść?”, etykiety), zachowując sprawdzane zachowania (pełny cykl, termin, przepadnięcie, zapis).
- [ ] **Step 2:** `timeout 115 node --test test/map_places.test.js test/map_scene.test.js`. Expected: FAIL.
- [ ] **Step 3:** Zaimplementuj; `map.js` zostaje podzielone na małe funkcje (`choose`, `place`, `spot`, `board`) i pętlę sterującą po `phase`; zachowaj logikę `outbound`/`onsite`/`return` bez zmian.
- [ ] **Step 4:** testy z kroku 1 + `timeout 115 npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(mapa): scena map jako hub miejsc – wybór lokacji, droga bliska, menu miejsc, tablica zleceń`.

---

### Task 7: Pobojowisko i rozdroże – nowy początek aktu II

**Files:**
- Create: `data/dialogues/pobojowisko.json`, `data/dialogues/rozdroze.json`, `data/art/pobojowisko.pix`, `data/art/rozdroze.pix`
- Modify: `data/travel.json` (`noc_upiorow`: sceny po `noc_flaga_insygnia`), `data/items.json` (`notatki_wojmira`, `amulet_strazniczy` typ `misc`), `data/story.json` (`demo_kurier` → `brod_przybycie`), `test/story_act1.test.js`, `test/e2e.test.js`, `test/story_prolog.test.js` (jeśli odwołuje do zmienionych scen)
- Test: `test/story_act2.test.js` (nowy)

**Interfaces:**
- Consumes: `hint`, dialogi, `endsTrip`, `misc`.
- Produces (id wiążące): sceny zdarzenia `noc_pobojowisko` (`dialogue: pobojowisko`, `art: pobojowisko`), `noc_rozdroze` (`dialogue: rozdroze`, `art: rozdroze`), `noc_bezdroza` (narracja, 40–120 słów, z czasem 180 min); flagi `pobojowisko_skarimir|ragnoslawa|wojmir` (każda paczka raz), `odrzucil_stolice`, `waha_sie`; przedmioty `notatki_wojmira`, `amulet_strazniczy`; akcja `hint: "wilczy_las"` w paczce Wojmira. Po zdarzeniu gra jest w Wilczym Brodzie jak dotąd (`endsTrip`).

- [ ] **Step 1: Testy (RED)** `test/story_act2.test.js`:
  - kolejność scen `noc_upiorow`: `…, "noc_swit", "noc_flaga_insygnia", "noc_pobojowisko", "noc_rozdroze", "noc_bezdroza"`; dane przechodzą `validateData`.
  - `pobojowisko`: Skarimir → sztylet, Ragnosława → 2× `opatrunek` + `amulet_strazniczy`, Wojmir → 2× `prowiant` + `notatki_wojmira` + `known`/zapowiedź `wilczy_las` (`world.hinted` zawiera id); każda paczka tylko raz (druga próba wyłączona); „Idę dalej.” zawsze dostępne i kończy rozmowę bez przeszukania.
  - `rozdroze`: odrzucenie → `wola` +1 i flaga `odrzucil_stolice`; wahanie → flaga `waha_sie`, zmienne bez zmian; pokora → `dlug` +1; każda droga trafia na ten sam koniec.
  - e2e: noc upiorów (`playNight`) kończy się w Wilczym Brodzie po pobojowisku i rozdrożu; `towarzysze_zgineli`, `dlug_istoty` jak dotąd; zegar (test `zmierzch/atak/przebudzenie/świt`) nadal zgodny.
- [ ] **Step 2:** `timeout 115 node --test test/story_act2.test.js test/story_act1.test.js`. Expected: FAIL.
- [ ] **Step 3:** Napisz dialogi (węzły: `pobojowisko` – `rozejrzenie` → `skarimir|ragnoslawa|wojmir` → z powrotem do `rozejrzenie`, opcja `dalej`; `rozdroze` – `rozstaje` → `odrzucenie|wahanie|pokora` → `koniec`), po 40–120 słów na węzeł, w tonie konceptu („Ciała nie pachną jeszcze śmiercią…” – dowolne; własne polskie teksty). Dopisz sceny do zdarzenia (`noc_pobojowisko` i `noc_rozdroze` mają `waitUntil` brak; `noc_bezdroza` `time: 180`). Przepisz `demo_kurier` na `brod_przybycie` (strażnica przyjmuje półżywego wędrowca; komendant pyta, kim jest; zachowaj wzmiankę o insygniach i brak „ma być u bram”). Dwie grafiki 48×22 (patrz Global Constraints; `node bin/game.js --art pobojowisko` – obejrzyj wynik, popraw proporcje, paleta jak w `noc_ciemnosc.pix`).
- [ ] **Step 4:** testy z kroku 1 + zaktualizuj `story_act1`/`e2e` (kolejność scen, tokeny sterownika) + `timeout 115 npm test` + `node bin/game.js --validate`. Expected: PASS i „Dane poprawne.”.
- [ ] **Step 5: Commit** `feat(fabula): akt II zaczyna się na pobojowisku i rozdrożu`.

---

### Task 8: Wilczy Bród jako hub – miejsca, Wrzosek, kramik, Las Rubieży, zlecenie testowe, mapa

**Files:**
- Create: `data/dialogues/wrzosek.json`, `data/art/karczma_pod_wilczym_klem.pix`, `data/art/portret_wrzosek.pix`, `data/art/portret_kramarz.pix`
- Modify: `data/travel.json` (lokacje `wilczy_brod` z `spots`, nowa `wilczy_las`), `data/shops.json` (`kramarz_brod`), `data/quests.json` (`lek_dla_wrzoska`), `data/items.json` (`worek_maki`, `ziola_dla_wrzoska` typ `misc`), `data/dialogues/komendant.json` (zlecenie Nory przez `startQuest` + usunięcie wzmianki o liście), `data/story.json` (`demo_mapa` → scena `map` huba z nowym `main`), `data/maps/pogorze.txt`, `data/ui.json`
- Test: `test/story_act2.test.js` (rozszerz), `test/hub_content.test.js` (nowy)

**Interfaces:**
- Produces (id wiążące): lokacja `wilczy_brod` – miejsca `komendant` (`talk`, ref `komendant`), `karczma` (`talk`, ref `wrzosek`), `izba` (`rest`), `kramik` (`shop`, ref `kramarz_brod`), `tablica` (`board`); lokacja `wilczy_las` – `secret: true`, `near: { minutes: 40 }`, `danger: 2`, `hint: "nieznana ścieżka w lesie"`, miejsce `polana` (`scene`: `las_polana_pusto` (if flaga `ziola_zebrane`, goto koniec), `las_polana_zbior`, `las_polana_flaga` (ustawia `ziola_zebrane`), `las_polana_ziola` (reward `ziola_dla_wrzoska`, goto koniec)); zlecenie `lek_dla_wrzoska` (`kind: errand`, `hub: wilczy_brod`, `requires: { known: "wilczy_las" }`, cele: `ziola` – at `wilczy_las.polana`, done `{ item: "ziola_dla_wrzoska" }`; `zanies` – at `wilczy_brod.karczma`, done `{ flag: "wrzosek_ziola_oddane" }`; `onComplete: [{ giveMoney: 10 }, { xp: 30 }]`); dialog `wrzosek` – węzły: `powitanie` (start), `plotki` (opcja z testem Wymowy: sukces → akcja `reveal: "wilczy_las"` + węzeł z opisem lasu, porażka → wątłe plotki; dostępna zawsze druga opcja bez testu), `prosba` (opcja wymaga `known: wilczy_las` i `notFlag: lek_podjety` → `startQuest: "lek_dla_wrzoska"` + flaga), `oddanie` (opcja wymaga `item: ziola_dla_wrzoska` → `takeItem` + flaga `wrzosek_ziola_oddane`), `bywaj`.
- `demo_mapa` zostaje `map` z `hub: wilczy_brod`, `main: { label: "Czekaj na kuriera", goto: "demo_odpoczynek" }`.

- [ ] **Step 1: Testy (RED)** `test/hub_content.test.js` (prawdziwe dane, `createAdaptiveIO`):
  - `validateData` czyste; miejsca huba i `wilczy_las` jak w Interfaces; każde `art` istnieje.
  - rozmowa z Wrzoskiem: plotka z udanym testem (`rng` `{int: () => 1}`) odkrywa `wilczy_las` (`isKnown` true); bez odkrycia pozycja „Las Rubieży” nie występuje w `destinationEntries`; porażka testu nie odkrywa, ale opcja „spytaj o robotę” (bez testu) pozostaje.
  - pełna ścieżka zlecenia: odkrycie lasu → prośba (`startQuest`) → droga bliska do lasu (`walkMinutes` 40) → `polana` (ziola w torbie, drugi raz „pusto”) → powrót → oddanie ziół → zlecenie `done`, +10 monet, +30 XP; kolejność jak w dzienniku (`✓`/`→`).
  - tablica: pierwszym zleceniem jest Wilcza nora (podjęcie przez `startQuest` z komendanta albo tablicy), `lek_dla_wrzoska` pojawia się dopiero po odkryciu lasu.
  - kramik sprzedaje (np. `prowiant`, `opatrunek`, `ziola_dla_wrzoska`? – nie: ziela tylko z lasu), skupuje `weapon`/`armor`/`consumable`; `misc` nie da się sprzedać.
  - przejście 80×24 i 200×50 (obie klasy `miecz`/`wlocznia`): menu miejsc, mapa i opisy nie zawijają się poza ramkę (`readFrame`, brak linii dłuższych niż szerokość).
- [ ] **Step 2:** `timeout 115 node --test test/hub_content.test.js test/story_act2.test.js`. Expected: FAIL.
- [ ] **Step 3:** Napisz dane i teksty (polskie, w tonie reszty; 40–110 słów na węzeł Wrzoska), narysuj trzy grafiki (karczma 48×22; portrety jak `portret_wszebor.pix`), uzupełnij `pogorze.txt` o tokeny `{wilczy_brod}`, `{wilczy_las}`, `{wilcza_nora}`, `{kamienna_przelecz}`; zdefiniuj `kramarz_brod` w `shops.json` (zapasy: 4 `prowiant`, 3 `opatrunek`, `napar_ziol`, `strzala` ×20; skupuje `weapon`, `armor`, `consumable`, `throwable`); `komendant.json`: węzeł zlecenia ma akcję `startQuest: "wilcza_nora"` zamiast flagi `nora_zgoda` (flagę zostaw, jeśli inne dane jej używają – sprawdź `grep nora_zgoda`).
- [ ] **Step 4:** testy z kroku 1 + `timeout 115 npm test` + `node bin/game.js --validate` + `node bin/game.js --art karczma_pod_wilczym_klem`. Expected: PASS, „Dane poprawne.”, czytelny rysunek.
- [ ] **Step 5: Commit** `feat(tresc): Wilczy Bród jako hub z miejscami, Wrzosek, Las Rubieży i zlecenie Lek dla Wrzoska`.

---

### Task 9: Przebieg e2e, dokumentacja i domknięcie

**Files:**
- Modify: `test/e2e.test.js`, `docs/superpowers/plans/2026-10-23-cykl-e2b1-ledger.md` (tworzy wykonawca), `README`/`docs` jeśli opisują zapis lub mapę (`grep -rn "demo_mapa\|SAVE_FORMAT" docs README.md`)
- Memory: zaktualizuj `ostrze-project-cycles.md` (status E2b1)

- [ ] **Step 1: Test e2e (RED)** w `test/e2e.test.js`: od szkoły przez wymarsz, noc upiorów, pobojowisko (przeszukaj trzech, w tym paczkę Wojmira), rozdroże (odrzuć stolicę), przybycie, mapę huba, rozmowę z Wrzoskiem, odkrycie lasu, zlecenie testowe od tablicy/Wrzoska do nagrody, wyjście „Czekaj na kuriera” do końca dema – klasy `miecz` i `wlocznia`; asercje: flagi (`odrzucil_stolice`, `wrzosek_ziola_oddane`), `quests.lek_dla_wrzoska.status === "done"`, `world.discovered` zawiera `wilczy_las`, wersja zapisu 10, dalsze `demo_*` jak dotąd.
- [ ] **Step 2:** `timeout 115 node --test test/e2e.test.js`. Expected: FAIL do czasu zgodnych tokenów sterownika; dopasuj tokeny (np. `{ pick: "Las Rubieży" }`).
- [ ] **Step 3:** Pełny zestaw: `timeout 115 npm test`, `node bin/game.js --validate`; uruchom grę ręcznie w trybie skryptowym tam, gdzie to możliwe (`node bin/game.js` z wejściem z pliku) i obejrzyj ekrany mapy i miejsc przy 80×24 oraz 200×50.
- [ ] **Step 4:** ledger (`Task N: complete` jak w skillu executing-plans), notatka w pamięci, commit `test(e2e): przebieg pobojowisko → mapa → zlecenie; docs: ledger E2b1`.

---

### Task 10: Czysty ekran – bez poprzedniego kontekstu nad oknem

**Files:** `src/ui/screen.js` (`clear`, `drawFrame`), `src/ui/menu.js` (`makeScreen`, jeśli pisze `[2J`), `test/screens_tty.test.js`

- [ ] **Step 1: Test (RED):** każde pełne odrysowanie w TTY zaczyna się od `[3J[2J[H` (kasuje bufor przewijania), w trybie nie-TTY nic nie jest czyszczone.
- [ ] **Step 2–4:** zmień `clear` i `drawFrame` (jedna stała `CLEAR_SCREEN`); pełny zestaw zielony.
- [ ] **Step 5: Commit** `fix(ui): czyszczenie ekranu kasuje też bufor przewijania`.
