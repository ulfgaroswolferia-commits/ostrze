# Cykl D2b – zadania, eskorty, lokacje tymczasowe – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zadania i eskorty z `data/quests.json`, scena `quest` (start/complete/fail), scena `map` w punktach postoju (wyprawa tam → sceny na miejscu → powrót), lokacje tymczasowe, termin wymarszu, przepadanie przy wyjściu fabułą, dziennik [D], zapis v9 – i w demo: eskorta Ostromira ze spotkania w drodze oraz „Wilcza nora” od komendanta z mapą w Wilczym Brodzie.

**Architecture:** `src/systems/quests.js` – czysta logika zadań. Maszyna podróży z D2a przechodzi z `src/scenes/travel.js` do `src/scenes/trip.js` jako `runTrip(ctx, opts)` (kierunek, zadanie, zawrócenie); scena `travel` staje się cienką nakładką. Nowa scena `map` to maszyna faz `choose → outbound → onsite → return` w `world.map`, wznawialna jak podróż.

**Tech Stack:** Node.js ≥ 22, ESM, JSDoc, zero zależności, `node:test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-10-22-cykl-d2b-zadania-eskorty-design.md` (binding). Poprzedni: spec i ledger D2a (`docs/superpowers/plans/2026-10-22-cykl-d2a-ledger.md`).

## Global Constraints

- Zero zależności npm; tylko `node:*`.
- `src/engine/*` (poza `loop.js`) i `src/systems/*` nie importują z `src/ui/` ani `src/scenes/`.
- Kod po angielsku, krótkie JSDoc; treść i `id` po polsku bez diakrytyków; każdy tekst dla gracza w `data/ui.json` lub `data/*`; „HP”.
- Komunikaty walidacji: `plik › sekcja/id › pole: opis` (jak w D2a).
- Liczby: `rules.quests.maxActive = 6`; `deadlineDays` eskorty demo 3; nagrody demo: nora 25 gr; eskorta 40 gr + `prowiant ×2`; napad: `bandyta ×2`, waga 3, `eventChance: 50`; nora: `wilk ×3`.
- RNG tylko przez `rng.int`; sceny wznawialne – stan fazy zapisany w `world.*` przed każdym `await` na IO (jak D2a).
- Ekrany przy 80×24 bez zawijania (≤ 23 linie, ≤ 80 kolumn); testy skryptowe zużywają wszystkie wejścia.
- Heredoc w narzędziu Bash psuje się na długich blokach – edycje przez pliki w scratchpadzie (`edit.py`) albo Edit/Write.
- Każde zadanie: zielony `npm test`, czyste `node bin/game.js --validate`, commit na `cykl-d2b`.

## Plan rulings (przed wykonaniem)

- **R1:** `eventById(data, id)` szuka w `travel.events` i w `events` wszystkich zadań – jedno miejsce wyszukiwania dla `world.travel.event` (zdarzenie zadania wznawia się jak zwykłe). Koszt pomyłki: jedna funkcja.
- **R2:** Scena `quest` i jej handler wchodzą w Task 1 (dane zadań i zdarzenie Ostromira jej używają, a test rejestru wymaga handlera dla każdego typu). Scena `map` – Task 4.
- **R3:** Sceny na miejscu i zdarzenia zadań walidowane tym samym `validateScenes(..., { event: true, taken })` co zdarzenia D2a; zakazane typy zdarzeń + `map`.

## Review Focus

1. Zapis na miejscu zadania po nagrodzie (przed kolejną sceną) i wczytanie przez prawdziwy `saveGame`/`loadGame` – nagroda i `quest complete` nie powtarzają się (test w Task 4).
2. Eskorta przeterminowuje się, gdy gracz jest na innej wyprawie – po powrocie mapa pokazuje komunikat o przepadnięciu i nie ma już tej opcji; zadanie, do którego wyruszono, nigdy nie przepada z terminu (test w Task 2 i 4).
3. Porażka eskorty w ostatnim dniu drogi tam (`day === daysTotal`) – zawrócenie, sceny na miejscu się nie grają, gracz wraca do punktu postoju (test w Task 3).
4. „Dalej fabułą” bez aktywnych zadań (lub tylko z wykonanymi/przepadłymi) – bez pytania o potwierdzenie; odmowa w potwierdzeniu wraca do mapy bez zmian (test w Task 4).
5. Zadanie rozpoczęte w zdarzeniu drogi zanim gracz dotrze do swojego punktu postoju – widoczne w dzienniku od razu, a na mapie dopiero w tym punkcie (test w Task 5).

---

### Task 1: Dane zadań, scena `quest`, walidacja

**Files:**
- Create: `data/quests.json` (oba zadania z treścią demo wg spec „Treść demo”), `data/dialogues/komendant.json`, `data/dialogues/ostromir.json`, `src/systems/quests.js` (`validateQuests`, `questById`, `startQuest`, `completeQuest`, `failQuest`, `activeQuests`), `src/scenes/quest.js`
- Modify: `data/travel.json` (lokacje `wilcza_nora`, `kamienna_przelecz` z `temporary: true`; trasy `wilczy_brod_nora`, `wilczy_brod_przelecz`; zdarzenie `kupiec_ostromir`), `data/rules.json` (`quests: { maxActive: 6 }`), `data/ui.json` (komunikaty zadań), `src/systems/travel.js` (`temporary` w schemacie lokacji; R1 w `eventById`), `src/engine/data.js` (wczytanie `quests.json` po `travel.json`, walidacja, sceny zadań i ich zdarzeń przez `validateScenes`, `story`: scena `quest` – id zadania istnieje; `RULES_SCHEMA.quests`), `src/scenes/schemas.js`, `src/scenes/index.js`, `src/ui/events.js` (`zadanie_start`, `zadanie_wykonane`, `zadanie_przepadlo`, `zadanie_limit`), `test/helpers.js` (`minimalData` + `quests`)
- Test: `test/quests.test.js`, `test/data.test.js` (oczekiwane listy)

**Interfaces:**
- Produces: `data.quests` (lista; eskorta ma też `clientGen` – dopełniacz klienta, np. „kupca Ostromira”, wymagany dla `escort`); `questById(data, id)`; `startQuest(state, data, id) → events` (`[{ type: "zadanie_start", id }]` | `[{ type: "zadanie_limit", id }]` | `[]` gdy zadanie już znane); `completeQuest` / `failQuest(state, data, id) → events` (`[]` gdy nie `active`); `activeQuests(state, data, hub?) → quest[]`; `state.quests[id] = { status, acceptedAt, deadline, departed }`; scena `{ type: "quest", start | complete | fail }`.

- [ ] **Step 1: Testy (failing)** – prawdziwe dane: `validateData` `[]`, dwa zadania (pola z spec), nowe lokacje `temporary`, trasy, `kupiec_ostromir` (`once`, waga 2); każdy komunikat z spec „Walidacja”; `quest` w fabule z nieznanym id; zdarzenie zadania `napad_na_woz` znalezione przez `eventById`; `startQuest`: status `active`, `deadline = acceptedAt + 3 × 1440` dla eskorty i `null` dla nory, drugi start → `[]` bez zmian, 7. aktywne → `zadanie_limit` i brak wpisu; `completeQuest`/`failQuest` tylko z `active`; scena `quest` start pokazuje „Nowe zadanie: Wilcza nora.” w komunikatach.
- [ ] **Step 2:** `node --test test/quests.test.js test/data.test.js` – FAIL.
- [ ] **Step 3:** dane, walidacja, system, scena.
- [ ] **Step 4:** `npm test` PASS (nowe zdarzenie w puli zmienia losowania e2e – sterownik `{ trip }` musi odmówić Ostromirowi tak jak wędrowcowi; poprawiać tylko odpowiedzi sterownika, nie asercje), `--validate` „Dane poprawne.”
- [ ] **Step 5: Commit** `feat(zadania): dane zadań i eskort, scena quest, walidacja`.

### Task 2: Stan, termin, przepadanie, opcje mapy, zapis v9

**Files:**
- Modify: `src/systems/quests.js` (`expireQuests`, `abandonHub`, `mapOptions`, `repairQuestState`), `src/engine/state.js` (`world.map: null`), `src/config.js` (`SAVE_FORMAT_VERSION = 9`), `src/engine/save.js` (`migrations[8]`, schemat `quests`, `repairQuests` w `loadGame`), `data/ui.json` (`load.repair.quests`)
- Test: `test/quests.test.js`, `test/save.test.js`

**Interfaces:**
- Produces: `expireQuests(state, data) → events` (aktywne, `!departed`, `deadline !== null && now > deadline` → `failed`, zdarzenie `zadanie_przepadlo { id, expired: true }`); `abandonHub(state, data, hub) → events`; `mapOptions(state, data, hub) → [{ quest, location, days, deadlineLeft }]` (`deadlineLeft` w pełnych dniach w górę albo `null`); `repairQuestState(state, data) → badIds[]`.

- [ ] **Step 1: Testy (failing)** – termin: 3 dni minus 1 minuta → aktywne, + 1 minuta → przepada; `departed: true` nigdy nie przepada; `abandonHub` tylko zadania tego punktu i tylko aktywne; `mapOptions` – kolejność jak w `quests.json`, bez wykonanych/przepadłych, `days` z trasy, `deadlineLeft` (np. 2 przy 1,5 dnia); save v8→v9 (`world.map: null`, `world.travel` bez nowych pól → `reverse: false, quest: null, turnBack: false`); naprawa: nieznane zadanie usunięte + ostrzeżenie, `world.map` z nieznanym `quest` → `phase: "choose"`.
- [ ] **Step 2:** `node --test test/quests.test.js test/save.test.js` – FAIL.
- [ ] **Step 3:** implementacja.
- [ ] **Step 4:** `npm test` PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(zadania): termin, przepadanie, opcje mapy, zapis v9`.

### Task 3: `runTrip` – podróż w obie strony, zdarzenia zadania, zawrócenie

**Files:**
- Create: `src/scenes/trip.js` (maszyna faz z `src/scenes/travel.js` przeniesiona bez zmian zachowania + opcje)
- Modify: `src/scenes/travel.js` (cienka nakładka), `src/systems/travel.js` (`startTravel(state, data, routeId, { reverse, quest })`, `rollStageEvent` – pula i szansa zadania, brak `fixed` przy `quest`/`reverse`; `endTravel` – cel wg kierunku; `turnBack(state)`), `src/ui/travel_screen.js` (pasek trasy i tytuł w kierunku `reverse`), `data/ui.json` (`travel.turnBack`)
- Test: `test/trip.test.js`, `test/travel_scene.test.js` i `test/travel_system.test.js` (bez zmian – muszą zostać zielone)

**Interfaces:**
- Consumes: Task 1 (`questById`, `eventById` z R1, `failQuest`), D2a (`world.travel`, fazy).
- Produces: `runTrip(ctx, { route, reverse = false, quest = null }) → Promise<void>` (wznawia `world.travel`, jeśli istnieje); `world.travel` + `reverse`, `quest`, `turnBack`; `turnBack(state)` – `reverse = !reverse`, `turnBack = true`, `daysTotal = day`, `day = 1`.

- [ ] **Step 1: Testy (failing)** – `runTrip` `reverse`: start w `to`, koniec w `from`; pasek „Wilczy Bród ──●── Wilcza Nora” odwrócony przy powrocie; wyprawa do zadania: bez zdarzenia stałego, szansa 50 i pula tylko `napad_na_woz` (scripted rng: rzut 50 → napad, 51 → nic); porażka eskorty (walka z ucieczką w napadzie, `quest fail`) w dniu 1 z 1 → komunikat „Bez kupca Ostromira nie ma po co iść dalej – zawracasz.”, koniec w `wilczy_brod`, `world.travel === null`; dotychczasowe testy sceny `travel` bez zmian.
- [ ] **Step 2:** `node --test test/trip.test.js test/travel_scene.test.js test/travel_system.test.js` – FAIL (nowe).
- [ ] **Step 3:** wydzielenie i opcje (sprawdzenie zawrócenia po każdym `playEvent`: zadanie wyprawy przestało być `active` i `!reverse` → `turnBack`).
- [ ] **Step 4:** `npm test` PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(podroz): runTrip w obie strony, zdarzenia zadań, zawrócenie eskorty`.

### Task 4: Scena `map` – wybór, wyprawa, na miejscu, powrót, wyjście fabułą

**Files:**
- Create: `src/scenes/map.js`, `src/ui/map_screen.js` (`renderMap(state, data, hub, options, main) → string[]`)
- Modify: `src/scenes/schemas.js` (`map { hub, main: { label, goto }, title? }` bez `time`/`goto`), `src/scenes/index.js`, `src/engine/data.js` (`hub` istnieje i nie jest tymczasowy; `main.goto` istnieje), `src/scenes/travel.js` lub `trip.js` (eksport `forgetScenes`), `data/ui.json` (`map.*`)
- Test: `test/map_scene.test.js`

**Interfaces:**
- Consumes: Task 2 (`expireQuests`, `abandonHub`, `mapOptions`), Task 3 (`runTrip`), D2a (`runScenes` z `onScene`/`endId`, `forgetScenes`).
- Produces: handler `map(ctx, scene) → { goto: main.goto }`; `world.map = { hub, phase, quest, questScene }`.

- [ ] **Step 1: Testy (failing)** – pełny cykl: wybór nory → podróż tam → walka (adaptive `{ fight: "win" }`) → „Zadanie wykonane: Wilcza nora.” i +25 gr → powrót → mapa bez nory → „Czekaj na kuriera” zwraca `{ goto }` bez potwierdzenia (Review Focus 4); z aktywną eskortą – potwierdzenie „n” wraca do mapy, „t” → eskorta `failed`, `world.map === null`; eskorta przeterminowana podczas wyprawy do nory → po powrocie komunikat przepadnięcia i brak opcji (Review Focus 2); wznowienie przez prawdziwy zapis (`saveGame`/`loadGame`, `OSTRZE_HOME` w tmp) w fazach `choose`, `outbound`, `onsite` po nagrodzie (Review Focus 1), `return` – nagroda raz; ekran mapy ≤ 23 linie, ≤ 80 kolumn.
- [ ] **Step 2:** `node --test test/map_scene.test.js` – FAIL.
- [ ] **Step 3:** implementacja wg spec „Scena `map`”.
- [ ] **Step 4:** `npm test` PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(zadania): scena map – wyprawy do zadań i powrót`.

### Task 5: Interfejs – dziennik, pasek „Do:/Powrót”, komunikaty

**Files:**
- Create: `src/ui/journal_screen.js` (`renderJournal(state, data) → string[]`, `showJournal(ctx)`)
- Modify: `src/ui/camp.js` (pozycja „Dziennik” `[D]` między Ekwipunkiem a Zapisem we wszystkich menu obozu), `src/ui/screen.js` (`placeText`: „Do: {short} {day}/{days}” w drodze tam do zadania, „Powrót {day}/{days}” przy `reverse`), `data/ui.json` (`journal.*`, `camp.journal`, `status.toQuest`, `status.returning`)
- Test: `test/journal.test.js`, testy z twardymi numerami pozycji menu obozu (przesunięcie po dodaniu `[D]` – tylko oczekiwane numery)

**Interfaces:**
- Consumes: Task 1–2 (`state.quests`, `questById`, `deadline`).

- [ ] **Step 1: Testy (failing)** – dziennik: aktywne (nazwa, cel – nazwa lokacji, „zostały 2 dni” / „bez terminu”, opis zawinięty do 78), zakończone ✓/✗ – najwyżej 5 ostatnich; zadanie z eskorty rozpoczęte w drodze (przed dotarciem do hubu) – w dzienniku od razu (Review Focus 5); `[D]` otwiera dziennik z menu obozu i wraca; pasek w drodze do nory „Do: Wilcza Nora 1/1”, w powrocie „Powrót 1/1”; komunikaty zadań; wszystkie linie ≤ 80 kolumn.
- [ ] **Step 2:** `node --test test/journal.test.js` – FAIL.
- [ ] **Step 3:** implementacja.
- [ ] **Step 4:** `npm test` PASS (popraw numery pozycji menu w istniejących testach i w sterowniku – „Dalej” zostaje [1]), `--validate` czyste.
- [ ] **Step 5: Commit** `feat(ui): dziennik zadań, pasek wyprawy, komunikaty zadań`.

### Task 6: Demo – komendant, mapa, eskorta; e2e

**Files:**
- Modify: `data/story.json` (po `demo_kurier`: dialog `komendant`, `quest start wilcza_nora` z `if: { flag: "nora_zgoda" }`, `demo_mapa` → `main.goto: "demo_odpoczynek"`), `test/helpers.js` (krok `{ map: ["Wilcza Nora", …] }` – na ekranie mapy wybiera kolejne cele po nazwie, potem `main.label`; zgoda w dialogach komendanta i Ostromira gdy krok ma `accept: true`, inaczej odmowa; `{ trip }` obsługuje też drogi wypraw), `test/e2e.test.js`, `test/cli.test.js`
- Test: `test/e2e.test.js`, `test/cli.test.js`

**Interfaces:**
- Consumes: wszystko z Task 1–5.

- [ ] **Step 1: Testy (failing)** – demo obu klas × ziarna 7/10/42 z odmową komendanta i mapą „dalej fabułą” (bez potwierdzenia) do końca; ścieżka miecza z norą: zgoda, `{ map: ["Wilcza Nora"] }` → `quests.wilcza_nora.status === "done"`, +25 gr; eskorta: kopia danych z `kupiec_ostromir` jako zdarzeniem stałym 2. dnia, zgoda, `{ map: ["Kamienna Przełęcz"] }` → `done` albo `failed` (napad) i powrót, a przy `done` +40 gr i prowiant ×2; wyjście z niewykonaną norą – potwierdzenie „t” i `failed`; dotychczasowe asercje demo przeniesione (koniec w `demo_koniec`, `world.location === "wilczy_brod"`).
- [ ] **Step 2:** `node --test test/e2e.test.js test/cli.test.js` – FAIL.
- [ ] **Step 3:** fabuła i sterownik.
- [ ] **Step 4:** `npm test` PASS, `node bin/game.js --validate` → „Dane poprawne.”
- [ ] **Step 5: Commit** `feat(demo): mapa w Wilczym Brodzie, zadanie komendanta, eskorta Ostromira; e2e`.
