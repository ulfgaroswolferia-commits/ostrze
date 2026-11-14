# Cykl D2a – podróże: mapa, etapy, prowiant, zdarzenia – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scena `travel` ze stałą trasą: etapy dzienne (wymarsz z autozapisem → marsz z ≤ 1 zdarzeniem → obóz z szukaniem pożywienia, posiłkiem i odpoczynkiem), jedzenie jako przedmioty `food` i efekt `glod`, tabela zdarzeń ze spotkaniami jako listami scen, zjawiska `slow`/`dangerous` na drodze, wznawianie z zapisu w każdej fazie (save v8) – i podróż Brzezina → Wilczy Bród w demo.

**Architecture:** `src/systems/travel.js` (stan `world.travel`, losowanie zdarzenia, godzina marszu, koniec etapu, szukanie pożywienia) i `src/systems/food.js` (posiłek, głód, ryzyko) to czysta logika bez UI. `src/scenes/travel.js` to maszyna faz `depart → march → event → camp` zapisana w `world.travel`; spotkania odpala `runScenes` na liście scen zdarzenia z `onScene` zapisującym postęp w `world.travel.eventScene`. Obóz używa istniejącej sceny `rest`.

**Tech Stack:** Node.js ≥ 22, ESM, JSDoc, zero zależności, `node:test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-10-22-cykl-d2a-podroze-design.md` (binding). Poprzedni: `docs/superpowers/specs/2026-10-21-cykl-d1-mistyka-design.md`, ledger `docs/superpowers/plans/2026-10-22-cykl-d1-ledger.md`.

## Global Constraints

- Zero zależności npm; tylko `node:*`.
- `src/engine/*` (poza `loop.js`) i `src/systems/*` nie importują z `src/ui/` ani `src/scenes/`.
- Kod po angielsku, krótkie JSDoc; treść i `id` po polsku bez diakrytyków; każdy tekst dla gracza w `data/ui.json` lub `data/*`; „HP”.
- Komunikaty walidacji: `plik › id › pole: opis` (jak istniejące; przykłady w spec „Walidacja”).
- Liczby podróży tylko w `rules.travel` (dokładnie jak w spec) albo w `travel.json`/danych przedmiotów.
- Silnik przy błędzie gracza zwraca `{ ok: false, reason }` bez zmiany stanu; rzuca przy błędzie programisty/danych.
- RNG tylko przez `rng.int(min, max)`; kolejność rzutów jak w spec (`rollStageEvent`: szansa → wybór ważony → godzina; `forage`: szansa → wybór → ilość; `eatMeal`: ryzyko tylko gdy jest i postać nie ma `safeTagged` wiodącej). Jedzenie bez `heal` nie zużywa rzutu leczenia.
- Wszystkie ekrany przy 80×24 bez zawijania (≤ 23 linie); testy skryptowe zużywają wszystkie wejścia.
- Każde zadanie: zielony `npm test` (czyste wyjście), czyste `node bin/game.js --validate`, commit na `cykl-d2a`.

## Plan rulings (przed wykonaniem)

- **R1:** `eatItem`/`eatMeal` w nowym `src/systems/food.js` (spec wymienia `eatMeal` w `travel.js`) – jedzenie działa też poza podróżą (ekwipunek), a `travel.js` zostaje przy trasie. Koszt pomyłki: przeniesienie eksportu.
- **R2:** Zakończenie zdarzenia przed końcem listy: `goto: "koniec"` (zarezerwowane id, tylko w scenach zdarzeń) – inaczej po wygranej z wilkami weszłaby narracja ucieczki. Ucieczka z walki bez `onFlee` działa jak w fabule (następna scena listy); treść demo zawsze podaje `onFlee`. Koszt pomyłki: jedno pole w walidatorze.
- **R3:** `validateScenes` dostaje parametr `{ file, prefix, known, reserved }`, żeby te same reguły walidowały sceny zdarzeń (`travel.json › events › <zdarzenie> › <scena>`); unikalność id liczona na wspólnym zbiorze fabuła + zdarzenia.

## Review Focus

1. Zapis ręczny w menu obozu/ekranie wymarszu i w środku spotkania (po nagrodzie, przed kolejną sceną) → wczytanie nie powtarza nagrody, nie losuje zdarzenia drugi raz, nie zjada drugiego posiłku (test w Task 4).
2. Ulewa trwająca przez koniec marszu i następny wymarsz – opóźnienie tylko raz na etap, a `daysTotal` nigdy nie rośnie dwa razy dla tego samego dnia po wczytaniu (test w Task 3 i 4).
3. Gracz bez jedzenia przez 4 obozy – `glod` stoi na 3 stosach, Siła/Krzepa nie schodzą poniżej 0 w `getStats`, sen leczy ×0,5 (nie ×0,125) (test w Task 2).
4. Przegrana z wilkami w zdarzeniu (bez `onDefeat`) → koniec gry jak w fabule, a nie zawieszona podróż; ucieczka → narracja ucieczki i dalszy marsz (test w Task 4).
5. Pasek stanu w podróży z długim imieniem, zjawiskiem i artefaktem przy 80 kolumnach – HP zawsze widoczne, `W drodze 1/2` ustępuje przed HP (test w Task 5).

---

### Task 1: Dane podróży i jedzenia; walidacja

**Files:**
- Create: `data/travel.json` (lokacje, region `pogorze` z `forage`, trasa, 7 zdarzeń z tabeli spec – sceny bandytów jako nowe id `bandyci_zasadzka`, `bandyci_walka`, `bandyci_ucieczka`, story bez zmian do Task 6), `data/dialogues/glodny_wedrowiec.json`, `src/systems/travel.js` (na razie `validateTravel`, `routeById`, `locationById`, `eventById`)
- Modify: `data/items.json` (6 przedmiotów), `data/effects.json` (`glod`), `data/phenomena.json` (`ulewa`), `data/enemies.json` (`wilk`), `data/shops.json` (`kupiec_drogi`, `prowiant` u kramarza), `data/classes.json` (`prowiant` ×2), `data/rules.json` (`travel`), `src/engine/data.js` (wczytanie `travel.json` po `story.json`, `RULES_SCHEMA.travel`, R3), `src/systems/items.js` (`food`), `src/systems/effects.js` (walidacja `noExpire`, `restHealMultiplier`), `src/engine/conditions.js` (walidacja `region`, `travelDay`, `location`; `conditionOpts` + `locations`, `regions`), `test/helpers.js` (`minimalData` + `travel`)
- Test: `test/data.test.js`, `test/travel.test.js` (część walidacji)

**Interfaces:**
- Produces: `data.travel = { locations, regions, routes, events }`; `validateTravel(travel, data) → string[]`; `routeById(data, id)`, `locationById(data, id)`, `eventById(data, id)` (`undefined` gdy brak); pole przedmiotu `food: { order, risk? }`; pola efektu `noExpire`, `restHealMultiplier`; warunki `{ region: id }`, `{ location: id }`, `{ travelDay: { gte?, lte? } }`; `rules.travel` dokładnie jak w spec.

- [ ] **Step 1: Testy (failing)** – prawdziwe dane → `validateData` `[]`; `loadData` zawiera trasę `brzezina_wilczy_brod` (`days` 2, `fixed["1"] === "bandyci_na_trakcie"`), 7 zdarzeń, `ulewa` (`world.travel === "slow"`), `wilk` (łup `mieso` 60), `glod` (`noExpire`, `maxStacks` 3, `restHealMultiplier` 0.5), `rules.travel.eventChance === 40`, start obu klas zawiera `prowiant` ×2; po jednym teście na każdy komunikat z listy spec „Walidacja” plus: zdarzenie `weather` ze `scenes`, scena zdarzenia typu `ending`, `goto` do sceny spoza listy zdarzenia (`nieznana scena`), `goto: "koniec"` w zdarzeniu poprawne / w fabule błąd, `forage.qty` [3, 1], `eventHourRange` ≥ `marchHours`, `startLocation` nieznana, `food.risk.safeTagged` nieznana umiejętność, `travelDay: {}`.
- [ ] **Step 2:** `node --test test/data.test.js test/travel.test.js` – FAIL.
- [ ] **Step 3:** dane i walidacja wg spec „Dane” (wartości i teksty z tabel spec; sceny zdarzeń w stylu demo; `wilki` start `far`, `canFlee: true`, `onFlee` → narracja ucieczki, po wygranej narracja z `goto: "koniec"`).
- [ ] **Step 4:** `npm test` PASS (popraw testy inwentarza/sklepu, które wyliczają start lub stock – tylko oczekiwane listy), `node bin/game.js --validate` → „Dane poprawne.”
- [ ] **Step 5: Commit** `feat(dane): podróże, jedzenie, wilk, ulewa – dane i walidacja`.

### Task 2: Jedzenie i głód

**Files:**
- Create: `src/systems/food.js`
- Modify: `src/systems/effects.js` (`tickHour` pomija spadek `remaining` dla `noExpire`; `restHealMultiplier(state, data)`), `src/systems/inventory.js` (`useConsumable`: przedmiot z `food` → `eatItem`), `src/scenes/rest.js` (leczenie × `restHealMultiplier`, `Math.floor`), `src/systems/combat/…` (przedmiot `food` bez `heal` wyszarzony, powód `combat.noEating`), `data/ui.json` (`combat.noEating` = „Nie czas na jedzenie”)
- Test: `test/food.test.js`, `test/rest.test.js`, `test/effects.test.js`

**Interfaces:**
- Produces:
  - `mealsLeft(state, data) → number` (suma ilości przedmiotów z `food`)
  - `eatItem(state, data, itemId, rng) → { ok: true, events } | { ok: false, reason }` – zużywa 1 sztukę (także przypiętą), zdejmuje 1 stos `glod` (`stacks−1`, przy 0 usuwa; zdarzenie `glod_mniej { stacks }` lub `efekt_koniec`), ryzyko → `applyEffect` + `zatrucie_jedzeniem { id }`; zdarzenie `posilek { id, left }`. Bez przesuwania czasu (w ekwipunku przesuwa `useConsumable` jak dotąd).
  - `eatMeal(state, data, rng) → events` – najniższy `food.order` (remis: kolejność w `items.json`) przez `eatItem`; brak jedzenia → `applyEffect(glod)` i zdarzenie `glod { stacks }`.
  - `restHealMultiplier(state, data) → number` (min z aktywnych efektów, domyślnie 1).
- Consumes: Task 1 (`food`, `glod`).

- [ ] **Step 1: Testy (failing)** – `eatMeal`: jagody przed mięsem przed prowiantem; brak → `glod` 1, 2, 3, 3 (4 obozy) i `getStats` Siła/Krzepa −3, nigdy < 0; posiłek przy `glod` 2 → 1; grzyby: rzut 15 → `trucizna`, 16 → nic, postać z wiodącą `medycyna` → zero rzutów (atrapa rng rzuca przy nadmiarowym rzucie, jak w `rest.test.js`); `noExpire`: 30 h `advanceTime` – `glod` dalej aktywny; `rest`: z `glod` 3 h snu leczą `floor(HEAL × 0.5)` na godzinę; `useConsumable("jagody")` zdejmuje stos i przesuwa czas o `useMinutes`, nie losuje leczenia; w walce jagody wyszarzone z powodem, `ziola_lesne` dostępne.
- [ ] **Step 2:** `node --test test/food.test.js test/rest.test.js test/effects.test.js` – FAIL.
- [ ] **Step 3:** implementacja wg Interfaces.
- [ ] **Step 4:** `npm test` PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(jedzenie): posiłki, głód, ryzyko grzybów, sen przy głodzie`.

### Task 3: System podróży – stan, losowanie, marsz, pożywienie, zapis v8

**Files:**
- Modify: `src/systems/travel.js`, `src/engine/state.js` (`world.location`, `world.travel: null`, `world.eventsSeen: []`), `src/config.js` (`SAVE_FORMAT_VERSION = 8`), `src/engine/save.js` (`migrations[7]`, schemat, `repairTravel` + wywołanie w `loadGame` obok `repairMystic`), `src/engine/conditions.js` (`evaluate`: `region`, `location`, `travelDay`), `data/ui.json` (`load.repair.travel`)
- Test: `test/travel.test.js`, `test/save.test.js`, `test/conditions.test.js`

**Interfaces:**
- Produces:
  - `currentRegion(state, data) → id | null` (region trasy w podróży, inaczej region `world.location`)
  - `startTravel(state, data, routeId)` – stan wg spec; rzuca, gdy `world.location !== route.from`
  - `rollStageEvent(state, data, rng) → { id, hour } | null` (kolejność rzutów jak w spec; `fixed` bez rzutu szansy i wyboru – tylko godzina)
  - `marchHour(state, data, rng, context = {}) → events` (`advanceTime(…, 60, …, { ...context, travel: true })`, `hoursWalked++`, `slowHours++` gdy aktywne zjawisko ma `world.travel === "slow"`)
  - `finishStage(state, data) → { delayed: boolean, by?: id }` (spec; ustawia `delayed`)
  - `forageChance(state, data) → number`, `forage(state, data, rng) → { found: { id, qty } | null, events }` (czas przez `advanceTime(forage.minutes)` przed rzutem; noc = pora `noc` po przesunięciu)
  - `markEventSeen(state, id)`, `endTravel(state, data)`
  - `repairTravel(state, data) → warnings[]` (spec „Zmiany w istniejącym kodzie”)
- Consumes: Task 1 (`data.travel`, `rules.travel`), D1 `activePhenomenon(state, data)`.

- [ ] **Step 1: Testy (failing)** – `startTravel` z innej lokacji rzuca; `rollStageEvent`: dzień 1 → `{ id: "bandyci_na_trakcie", hour }` i tylko 1 rzut (godzina); dzień 2 rzut 41 → `null` i 1 rzut; rzut 40 → wybór ważony (pula bez `weight 0`, bez widzianych `once`, z `if`) – sprawdź granice sum wag; `dangerous` → próg 60, waga `wilki` ×2; pusta pula → `null` bez rzutu wyboru i godziny; `marchHour` ×10 z ulewą 1 h → bez opóźnienia, 2 h → `daysTotal` 3, drugi `finishStage` tego etapu → bez zmian; `forageChance`: Bystrość 5 dzień → 60, noc → 40, ulewa → 50, Bystrość 12 → 90; `forage` sukces dodaje przedmiot z qty z zakresu, porażka nic; warunki `region`/`location`/`travelDay` w podróży i poza nią; save: v7 → v8 dodaje pola, wczytanie z nieznaną trasą → `world.travel` w fazie `depart` bez zdarzenia + ostrzeżenie, nieznana lokacja → `startLocation`.
- [ ] **Step 2:** `node --test test/travel.test.js test/save.test.js test/conditions.test.js` – FAIL.
- [ ] **Step 3:** implementacja.
- [ ] **Step 4:** `npm test` PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(podroz): stan podróży, losowanie zdarzeń, marsz, szukanie pożywienia, zapis v8`.

### Task 4: Scena `travel` – maszyna faz, spotkania, wznawianie

**Files:**
- Create: `src/scenes/travel.js`, `src/ui/travel_screen.js` (ekran wymarszu, podsumowanie etapu, nagłówek obozu – czyste funkcje renderujące linie)
- Modify: `src/engine/loop.js` (`runScenes(ctx, list, startId, { trackScene, onScene })`; `onScene(id)` wołane przed handlerem; `goto: "koniec"` kończy listę), `src/scenes/schemas.js` (typ `travel { route }`, bez `time`), `src/scenes/index.js`, `src/engine/data.js` (`travel.route` istnieje), `src/ui/camp.js` (eksport wspólnych pozycji: `campItems(ui)` i `handleCampPick(ctx, pick)` dla menu wymarszu/obozu), `data/ui.json` (`travel.*`, `camp.forage`, `camp.pitch`, teksty z spec „Interfejs”)
- Test: `test/travel_scene.test.js`, `test/scenes.test.js`, `test/loop.test.js`

**Interfaces:**
- Produces: handler `travel(ctx, scene)`; `renderDeparture(state, data, { columns }) → string[]`, `renderStageSummary(state, data, summary) → string[]`, `renderCampHeader(state, data) → string`.
- Consumes: Task 2 (`eatMeal`, `mealsLeft`), Task 3 (cały `travel.js`), `rest` (scena), `phenomenon` (scena – start zjawiska pogodowego przez `forcePhenomenon`), `save_point` (autozapis).
- Kolejność zapisu fazy (do wznowienia): `phase` i pola etapu zapisywane w `world.travel` **przed** każdym `await` na IO; `event`/`eventHour` ustawione przed zmianą na `march`; `eventsSeen` dopisane i `event = null` przed powrotem do `march`; `foraged = true` przed pokazaniem wyniku; posiłek i `day++`/`phase = "depart"` jako jeden krok po `rest`.

- [ ] **Step 1: Testy (failing)** – (atrapa rng + skryptowe IO, dane `minimalData` z podmienioną tabelą) pełna podróż 2 dni: autozapis wołany na każdym wymarszu (podmień `saveGame` przez `ctx` lub sprawdź plik w `tmpDir`), zdarzenie stałe dnia 1 (walka z 1 bandytą – strategia z helpers), dzień 2 zdarzenie `cisza`, obóz: szukanie → „Znajdujesz: Jagody ×2.”, posiłek zjada jagody, sen; po końcu `world.location === "wilczy_brod"`, `world.travel === null`, handler zwraca bez `goto`; ulewa 2 h w marszu → 3 dni i komunikat podsumowania; bez jedzenia → „Głód: 1.” w obozie; zdarzenie `weather` → `world.phenomenon.id === "ulewa"`, `started`; `once` nie wraca; wilki: ucieczka → narracja ucieczki, marsz trwa; przegrana bez `onDefeat` → `DefeatError`; **wznowienie** (wyjątek `InputExhaustedError` po N wejściach, potem nowy kontekst z tym samym `state` i dalszymi wejściami): w `depart` (zdarzenie już wylosowane – brak nowych rzutów), w `march` (godzina `hoursWalked` i `slowHours` zachowane; po wczytaniu w trakcie ulewy opóźnienie najwyżej raz – Review Focus 2), w środku `pielgrzym` po nagrodzie (prowiant +1 tylko raz), w `camp` po szukaniu (opcji szukania nie ma); ekran wymarszu i obozu ≤ 23 linie, każda ≤ 80 kolumn (TTY); `runScenes` z `onScene` i `goto: "koniec"`.
- [ ] **Step 2:** `node --test test/travel_scene.test.js test/scenes.test.js test/loop.test.js` – FAIL.
- [ ] **Step 3:** implementacja wg spec „Scena `travel`” i kolejności zapisu wyżej.
- [ ] **Step 4:** `npm test` PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(podroz): scena travel – etapy, spotkania, obóz, wznawianie`.

### Task 5: Interfejs – pasek stanu, ekwipunek, karta postaci, komunikaty

**Files:**
- Modify: `src/ui/screen.js` (`statusBar`: element lokacji `status.location` / `status.travel` „W drodze {day}/{days}”; kolejność ustępowania: mistyka → lokacja → nigdy HP; efekt `noExpire` bez czasu – `status.effectNoTimer`/`status.effectStackedNoTimer`), `src/ui/inventory_screen.js` (akcja „Zjedz” dla `food`; linie karty: `food.meal`, `food.spoils.<order>`, `food.risk`), `src/ui/character_screen.js` (`glod` w efektach bez czasu), `src/ui/events.js` (`posilek`, `glod`, `glod_mniej`, `zatrucie_jedzeniem`, `pozywienie`, `opoznienie`, `dotarcie`), `data/ui.json`
- Test: `test/travel_ui.test.js`, `test/mystic_ui.test.js` (bez zmian zachowania – tylko gdy oczekiwany pasek ma teraz lokację), `test/inventory_screen.test.js`

**Interfaces:**
- Consumes: Task 2 (`eatItem`), Task 3 (`world.location`, `world.travel`, `locationById`).

- [ ] **Step 1: Testy (failing)** – pasek w Brzezinie zawiera `Brzezina`, w podróży `W drodze 1/2`, przy 80 kolumnach z długim imieniem, zjawiskiem i artefaktem: ≤ 80 kolumn i `HP \d+/\d+` (Review Focus 5); `glod` ×2 na pasku bez czasu („Głodny ×2”); karta jagód/grzybów/prowiantu ze wszystkimi liniami ≤ 80 kolumn; „Zjedz” w ekwipunku zdejmuje stos i pokazuje komunikat; komunikaty wszystkich nowych zdarzeń (jak test „teksty zdarzeń mistyki”).
- [ ] **Step 2:** `node --test test/travel_ui.test.js` – FAIL.
- [ ] **Step 3:** implementacja.
- [ ] **Step 4:** `npm test` PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(ui): lokacja na pasku, jedzenie w ekwipunku, komunikaty podróży`.

### Task 6: Demo – podróż w fabule; e2e

**Files:**
- Modify: `data/story.json` (`demo_podroz` `{ type: "travel", route: "brzezina_wilczy_brod" }` po `demo_droga`; usunięcie `demo_droga_bandyci`, `demo_droga_ucieczka` – ich treść już w zdarzeniu `bandyci_na_trakcie`; `demo_kurier` po podróży), `test/helpers.js` (krok adaptacyjnego IO `{ trip: { forage: true|false, fight: "win"|"flee" } }` – odpowiada na wymarsz, podsumowania, menu obozu, wystawienie (nie), suwak snu (max), sklep (wyjście), dialog wędrowca (pierwsza dostępna opcja), walki wg `fight`; kończy się na komunikacie dotarcia), `test/e2e.test.js`
- Test: `test/e2e.test.js`, `test/cli.test.js`

**Interfaces:**
- Consumes: wszystko z Task 1–5.

- [ ] **Step 1: Testy (failing)** – demo obu klas × ziarna 7/10/42 przechodzi do końca z `{ trip: { forage: true, fight: "win" } }`: Kamień Zmierzchu zdobyty w dniu 1, `world.location === "wilczy_brod"`, ekran końca; ścieżka „ulewa + głód”: ziarno (znajdź i zapisz w teście) albo podmieniona tabela/`chancePerDay` w kopii danych, bez prowiantu i bez szukania → komunikat głodu i 3 dni; ucieczka przed wilkami (kopia danych z `wilki` jako stałe zdarzenie dnia 2) → narracja ucieczki i dotarcie; wczytanie autozapisu z dnia 2 w CLI wznawia wymarsz dnia 2; dotychczasowe asercje demo (bandyci, łup, kurier, odpoczynek) przeniesione.
- [ ] **Step 2:** `node --test test/e2e.test.js test/cli.test.js` – FAIL.
- [ ] **Step 3:** fabuła i driver.
- [ ] **Step 4:** `npm test` PASS, `node bin/game.js --validate` → „Dane poprawne.”
- [ ] **Step 5: Commit** `feat(demo): podróż Brzezina → Wilczy Bród; e2e przez podróż`.
