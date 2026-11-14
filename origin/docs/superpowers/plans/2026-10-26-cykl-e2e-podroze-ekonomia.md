# Cykl E2e – podróże, ekwipunek i wrogowie – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamienić grę z przygodówki w RPG: zróżnicowane odległości (od minut do 4 dni w każdym hubie), gęsta podróż ze zanikającą szansą na powtarzanej trasie, pola walki, ≥100 przedmiotów w stopniach 1–4 ze źródłami (sklepy, łupy, znaleziska), 18 typów wrogów.

**Architecture:** Zmiany silnika są małe i lokalne (`travel.js`, `walk.js`, `spots.js`, `actions.js`, `items.js`, `save.js`), reszta to dane JSON w `data/` oraz testy. Nowy plik `data/loot.json` (tabele losowe) i nowa akcja `giveRandom`. Wszystko, co da się policzyć, jest w `rules.json`, a luki w źródłach przedmiotów zamyka nowy lint `test/economy.test.js`.

**Tech Stack:** Node.js ≥22, ESM, JSDoc, `node:test`, zero zależności. Dane po polsku (id bez diakrytyków).

**Spec:** `docs/superpowers/specs/2026-10-26-cykl-e2e-podroze-ekonomia-design.md`. Wytyczne: `docs/wytyczne-tresci-i-qa.md` (cała lista kontrolna z końca dokumentu obowiązuje w recenzji).

## Global Constraints
- Zero zależności npm; Node ≥22; moduły ES; komentarze i teksty gry po polsku w stylu otoczenia (komentarze kodu po angielsku jak w `src/`).
- Wszystkie liczby balansu w `data/rules.json`, nie w kodzie. Każdy nowy klucz ma walidację w `src/engine/data.js`.
- Zapis: `SAVE_FORMAT_VERSION` 11 → **12** z migracją `11:` w `src/engine/save.js` i testem na zapisie v11.
- Przedmioty: `tier` 1–4; T4 tylko z łupu elitarnego, zlecenia lub znaleziska (nigdy ze sklepu).
- Wspólna reguła zanikania: `szansa = max(floor, base × decay^przejścia)`, `decay` 0,8, `floor` 8% dla spaceru i 15% dla trasy wielodniowej, nigdy 0.
- Katalog `test/` jest w `.gitignore`: nowe pliki testów commitować przez `git add -f`.
- Gałąź `cykl-e2e`; commit po każdym zadaniu; `npm test` i `node bin/game.js --validate` zielone przed każdym commitem.

## Plan rulings
- **R1.** Licznik przejść to `world.passes` (obiekt `klucz → liczba`), nie `world.map.passes` (`world.map` bywa `null`). Rośnie po **ukończonym spacerze** (klucz `passKey(a,b)`) i po **ukończonej podróży** (klucz = id trasy), nie po każdym etapie (inaczej trzydniowa trasa gasłaby sama w sobie).
- **R2.** Spacer nie liczy głodu: głód liczy się tylko w obozie (`eatMeal`). Zdanie ze specu o głodzie na spacerach ≥240 min odpada.
- **R3.** Pole walki to spot `hunt`: jak `scene`, plus `clearedBy` (id sceny `combat` w jego `scenes`) i `cooldownDays` (domyślnie `rules.travel.huntCooldownDays` = 3). Po wizycie, w której padła flaga `combat_<clearedBy>_wygrana`, silnik zapisuje dzień w `world.hunts["<lokacja>.<spot>"]`, kasuje flagę i do upływu cooldownu spot jest niedostępny (podpowiedź `map.huntCooldown`).
- **R4.** `giveRandom` jest zwykłą akcją (jak `giveItem`), więc działa w łupie wrogów, scenach, zdarzeniach i nagrodach zleceń.
- **R5.** Broń `wrecz` (kastet, rękawice nabijane, pięść żelazna) nie ma `masteryType`: o skuteczności decydują atrybuty i umiejętność `wrecz` (kod biegłości już obsługuje brak typu jak u `piesci`). Walidator przestaje wymagać `masteryType` dla `skill: "wrecz"`.
- **R6.** Atak wroga z efektem godzinowym (`trucizna`) jest niedozwolony przez walidator, więc żmija używa `krwawienie`.
- **R7.** Nowy typ przedmiotu `material` (można sprzedawać, bez użycia); `misc` zostaje dla przedmiotów fabularnych.
- **R8.** (decyzja użytkownika 26.10) W każdym hubie najdalsze miejsce leży do **4 dni** drogi. Miejsca poza zasięgiem spaceru (>8 h) to **dalekie miejsca** (`far: { route }`): wybierane z menu mapy, dojście i powrót to pełna podróż trasą (obóz, głód, zdarzenia etapów), a w miejscu działają zwykłe spoty. Zastępuje to pomysł „wypraw” jako zleceń.
- **R10.** (uwaga użytkownika 26.10) W aktach II–III po wykonaniu zleceń bywał moment, w którym nie wiadomo było, co dalej: akt III ruszał dopiero po wizycie na cmentarzu **w nocy** i rozmowie z Istotą, bez żadnej wskazówki, a akt II kończy losowe zdarzenie z Ostromirem. Wątek główny dostaje stały, widoczny cel w dzienniku i awaryjne popchnięcie (Task 9).
- **R9.** (błąd zgłoszony przez użytkownika 26.10) Panel „Dokąd iść?” pokazywał lokacje innych regionów (w Głuszcu: Las Rubieży, Stary młyn, Trakt, Leśniczówka, Ruiny), których nie ma na mapie Głuszca. `destinationEntries` i `undiscoveredLines` filtrują teraz po regionie huba (Task 0).

## Review Focus
1. Zapis w środku spaceru z 2–3 zdarzeniami wznawia się bez ponownego losowania i bez podwójnego liczenia czasu (Task 1).
2. Zapis v11 ze spacerem w toku wczytuje się po migracji i kończy spacer (Task 1).
3. 20 powrotów tą samą trasą nadal czasem daje zdarzenie (floor > 0) i pole walki nie jest farmowalne bez cooldownu (Tasks 1, 2).
4. Ciężki łup (półpancerz 16 kg) przy pełnym udźwigu nie gubi postępu sceny ani flag (`za_ciezko`) (Task 4).
5. Podróż do dalekiego miejsca (3–4 dni) zapisana w środku etapu wznawia się bez utraty dnia, a powrót zawsze jest możliwy (Task 3); każdy wpis panelu „Dokąd iść?” ma swój marker na mapie regionu (Tasks 0, 7).
6. Gracz po wykonaniu zleceń huba nigdy nie zostaje bez wskazówki, co dalej (Task 9).
7. Ekonomia: zarobki do końca aktu II wystarczają na zestaw T2 (broń + tułów + głowa), a T3 nie jest osiągalne przed aktem III (Task 10).

## File Structure
- `src/systems/travel.js`: `passKey`, `repeatChance`, `rollLocalEvents`, zmiana `rollStageEvent`, `endTravel`, `LOCATION_SCHEMA` (limit 480), `SPOT_TYPES` + `hunt`, `ROUTE_SCHEMA` bez zmian.
- `src/scenes/walk.js`: spacer wielozdarzeniowy (`legs`, `events`, `step`).
- `src/systems/spots.js`: dostępność `hunt`, `recordHunt`.
- `src/scenes/map.js`: po wizycie `hunt` → `recordHunt`; faza `far` (dalekie miejsca); `src/ui/map_screen.js`: filtr regionu (Task 0) i wpisy `far`.
- `src/systems/actions.js`: akcja `giveRandom`; nowy `src/systems/loot.js`: `rollLootTable`, `validateLootTables`.
- `src/systems/items.js`: pole `tier`, typ `material`; `src/engine/data.js`: wczytanie `loot.json`, walidacja `rules.travel.repeat` i nowych kluczy; `src/engine/save.js`, `src/config.js`: v12.
- Dane: `data/loot.json` (nowy), `items.json`, `enemies.json`, `shops.json`, `travel.json`, `quests.json`, `rules.json`, `ui.json`, `data/art/*.pix`, `data/maps/*.txt`, dialogi nowych NPC.
- Testy (nowe): `test/map_region.test.js`, `test/far_places.test.js`, `test/travel_repeat.test.js`, `test/walk_multi.test.js`, `test/hunt.test.js`, `test/loot.test.js`, `test/economy.test.js`, `test/e2e_economy.test.js`.

---

### Task 0: Błąd mapy – panel „Dokąd iść?” tylko z regionu huba (R9)

**Files:**
- Modify: `src/ui/map_screen.js` (`destinationEntries`, `undiscoveredLines`)
- Test: `test/map_region.test.js`

**Interfaces:** `destinationEntries(state, data, hub)` i `undiscoveredLines(state, data)` zwracają tylko lokacje, których `region` równa się regionowi huba (`locationById(data, hub).region`); `undiscoveredLines` dostaje ten sam filtr (nowy trzeci argument `hub`).

- [ ] **Step 1: Test (failing)** `test/map_region.test.js` na prawdziwych danych: stan w Głuszcu z odkrytymi wszystkimi lokacjami Pogórza i Głuszca: `destinationEntries(state, data, "gluszec")` zawiera wyłącznie lokacje o `region === "glusz"` (dziś zawiera też `wilczy_las`, `stary_mlyn`, `trakt_kupiecki`, `lesniczowka`, `ruiny_straznicy`); to samo w Obserwatorium (tylko `gwiazdy`); `undiscoveredLines` z podpowiedzią (`hinted`) lokacji Pogórza nie pokazuje jej w Głuszcu; każdy wpis `kind: "near"` ma marker `{id}` w `data/maps/<region>.txt`.
- [ ] **Step 2: Uruchom**, oczekiwane FAIL.
- [ ] **Step 3: Zaimplementuj** filtr regionu w obu funkcjach i przekaż `hub` do `undiscoveredLines` w `askDestination`.
- [ ] **Step 4: Uruchom** `npm test`; commit `fix(mapa): panel celów pokazuje tylko lokacje regionu huba`.

### Task 1: Silnik podróży – długie spacery, zanikanie szansy, zapis v12

**Files:**
- Modify: `src/systems/travel.js`, `src/scenes/walk.js`, `src/engine/save.js`, `src/config.js`, `src/engine/state.js`, `src/engine/data.js`, `data/rules.json`
- Test: `test/travel_repeat.test.js`, `test/walk_multi.test.js`, `test/save.test.js` (dopisać migrację v11→v12)

**Interfaces:**
- Produces: `passKey(a: string, b: string): string` (posortowane id złączone `">"`), `repeatChance(base: number, passes: number, repeat: {decay: number, floor: number}): number`, `recordPass(state, key: string): void`, `rollLocalEvents(state, data, rng, danger: number, minutes: number, key: string): string[]` (0–`walkMaxEvents` unikalnych id), `world.passes: Record<string, number>`, `world.hunts: Record<string, number>`, walk w kształcie `{ to, legs: number[]|null, events: string[], step: number, eventScene: string|null }` (parzyste `step` 2i = marsz etapu i, nieparzyste 2i+1 = zdarzenie i).
- Consumes: istniejące `rollLocalEvent` (zastąpione), `advanceTime`, `runScenes`.

`rules.travel` zyskuje: `"repeat": { "decay": 0.8, "floorWalk": 8, "floorStage": 15 }`, `"walkSegmentMinutes": 120`, `"walkMaxEvents": 3`, `"huntCooldownDays": 3`, `"eventChance": 55` (było 40), `"maxNearMinutes": 480`.

- [ ] **Step 1: Testy zanikania (failing)** w `test/travel_repeat.test.js`: `repeatChance(55, 0, r) === 55`; `repeatChance(55, 3, r) === Math.round(55*0.8**3)` (28); `repeatChance(55, 30, {decay:0.8, floor:8}) === 8`; funkcja nierosnąca dla 0…30; `passKey("a","b") === passKey("b","a")`; po `recordPass` dwukrotnie `state.world.passes[key] === 2`.
- [ ] **Step 2: Uruchom** `node --test test/travel_repeat.test.js`, oczekiwane FAIL (brak eksportów).
- [ ] **Step 3: Zaimplementuj** trzy funkcje w `travel.js` (zaokrąglenie `Math.round`, wynik nigdy poniżej `floor`); `rollStageEvent` liczy `chance` jako `repeatChance(base, passes[routeId] ?? 0, {decay, floor: floorStage})` dla zdarzeń losowych (trasy `fixed` bez zmian); `endTravel` wywołuje `recordPass(state, travel.route)`.
- [ ] **Step 4: Testy wielozdarzeniowego spaceru (failing)** w `test/walk_multi.test.js` (skryptowe IO, dane z `minimalData`, rng z ziarnem): (a) spacer 300 min do lokacji z `near.minutes: 300` rzuca 2 próby zdarzenia (`floor(300/120)=2`, max 3), a suma `advanceTime` == 300; (b) `walk` przerwany w środku (rzut `InputExhaustedError` na pytaniu z zdarzenia) i zapisany/wczytany kończy się tym samym czasem i tymi samymi zdarzeniami; (c) po ukończonym spacerze `world.passes[passKey(from,to)] === 1`, a po 12 spacerach szansa pojedynczej próby == 8%; (d) spacer <120 min rzuca jedną próbę.
- [ ] **Step 5: Zaimplementuj** `rollLocalEvents` (n prób = `clamp(floor(minutes / walkSegmentMinutes), 1, walkMaxEvents)`, każda z `repeatChance(localEventChance + bonus(danger), passes, {decay, floor: floorWalk})`, bez powtórzenia tego samego zdarzenia w jednym spacerze) i przepisz `walk()` na maszynę `step` (legs = minuty podzielone równo na `k+1` części, ostatnia bierze resztę; zdarzenie i = `events[i]`; po ostatnim marszu `recordPass`). `startWalk(state, data, to)` tworzy `{ to, legs: null, events: [], step: 0, eventScene: null }`; losowanie tylko gdy `legs === null`.
- [ ] **Step 6: Zapis v12.** `SAVE_FORMAT_VERSION = 12`; migracja `11:` dodaje `world.passes = {}`, `world.hunts = {}` i przekształca `world.map.walk` ze starego kształtu (`{to, step, left, event, eventScene}`): `step 0` → `walk = null`; `step 1` → `{to, legs:[0,left], events:[event], step:1, eventScene}`; `step 2` → `{to, legs:[0,left], events:[event], step:2, eventScene:null}`. `WORLD_SCHEMA` dostaje `passes`, `hunts` (`object` z liczbami ≥0). `createState` inicjuje oba pola `{}`. Test w `test/save.test.js`: zapis v11 ze `step: 1` wczytuje się i kończy spacer.
- [ ] **Step 7: Walidacja i reguły.** `LOCATION_SCHEMA`/`validateLocationExtras`: limit `near.minutes` z 180 na `data.rules.travel.maxNearMinutes`; `validateRules` sprawdza `repeat` (decay 0<d<1, floory 1–100, `floorWalk ≤ localEventChance`), `walkSegmentMinutes ≥ 30`, `walkMaxEvents 1–5`, `huntCooldownDays ≥ 1`. Zaktualizuj `data/rules.json`.
- [ ] **Step 8: Uruchom** `npm test` oraz `node bin/game.js --validate`; oczekiwane zielone. Istniejące `test/walk.test.js` i `test/travel_*.test.js` dostosować do nowego kształtu `walk` (zachować ich asercje o czasie i pojedynczym zdarzeniu).
- [ ] **Step 9: Commit** `git add -f test/travel_repeat.test.js test/walk_multi.test.js && git add -A && git commit -m "feat(podróże): długie spacery z kilkoma zdarzeniami, zanikanie szansy na powtarzanej trasie, zapis v12"`.

### Task 2: Silnik ekonomii – `tier`, `material`, `giveRandom`, pole walki

**Files:**
- Modify: `src/systems/items.js`, `src/systems/actions.js`, `src/engine/data.js`, `src/systems/spots.js`, `src/scenes/map.js`, `src/systems/travel.js` (`SPOT_TYPES`), `data/ui.json`, `test/helpers.js` (`minimalData` czyta `loot.json`)
- Create: `src/systems/loot.js`, `data/loot.json` (z jedną tabelą testową `lupy_testowe`), `test/loot.test.js`, `test/hunt.test.js`

**Interfaces:**
- Produces: `rollLootTable(data, tableId: string, rng): { id: string, qty: number }`, `validateLootTables(tables, data): string[]`, akcja `{ giveRandom: "<tableId>" }`, `data.loot: { tables: { id, entries: { item, qty: number | [number, number], weight }[] }[] }`, `COMMON.tier` (integer 1–4), typ `material` w `ITEM_TYPES`/`TYPE_SCHEMAS`, spot `{ type: "hunt", scenes, clearedBy: string, cooldownDays?: number }`, `isHuntReady(state, data, locationId, spot): boolean`, `recordHunt(state, data, locationId, spot): void`.
- Consumes: `runActions`, `placeById`, `evaluate`, `clockOf`.

- [ ] **Step 1: Testy (failing)** `test/loot.test.js`: `rollLootTable` zwraca pozycję z tabeli, ilość w zakresie, rozkład z wagami (10 000 losowań, pozycja z wagą 9 ≥ 85% przy wadze 1 innej); `runActions(state, data, [{giveRandom:"lupy_testowe"}], rng)` dodaje przedmiot i emituje `otrzymano`; walidacja odrzuca nieznaną tabelę, nieznany przedmiot i `weight < 1`; przedmiot `tier` spoza 1–4 odrzucony; waga/typ `material` przechodzi walidację i da się sprzedać (`buys: ["material"]`).
- [ ] **Step 2: Testy `hunt` (failing)** `test/hunt.test.js` na prawdziwych danych z lokacją testową (nadpisanie `travel`): spot `hunt` dostępny na początku; po wizycie z wygraną flaga `combat_<id>_wygrana` jest skasowana, `world.hunts["loc.spot"]` == bieżący dzień, spot niedostępny przez `cooldownDays` (przesuń zegar o 2 dni: wciąż niedostępny; o 3 dni: dostępny); wizyta zakończona ucieczką nie włącza cooldownu; walidacja: `clearedBy` musi wskazywać scenę `combat` z `scenes` spotu.
- [ ] **Step 3: Zaimplementuj** `loot.js` (jedno losowanie `rng.int(1, suma wag)` jak `pick` w `travel.js`, ilość `rng.int(min,max)`), akcję `giveRandom` w `ACTION_KEYS`, `validateAction` i `runActions` (po wylosowaniu zachowuje się jak `giveItem`, w tym `za_ciezko`); dodaj `giveRandom` do `LOOT_ACTIONS` w `src/systems/combat/data.js`; wczytywanie `loot.json` w `loadData`; walidację `data.loot` w kroku walidacji danych; `tier` w `COMMON` oraz reguła: każda niehidden broń i pancerz musi mieć `tier`; walidator nie wymaga `masteryType` dla `skill: "wrecz"` (R5; test: kastet bez `masteryType` przechodzi, miecz bez niego nie).
- [ ] **Step 4: Zaimplementuj** `hunt`: `SPOT_TYPES` + `"hunt"`, schemat spotu (`clearedBy`, `cooldownDays`), `spotScenes` zwraca `spot.scenes` dla `hunt`, `visibleSpots` oznacza `available: false`, gdy `!isHuntReady` (komunikat `map.huntCooldown` w `ui.json`), `map.js::spot()` po `runScenes` woła `recordHunt` (sprawdza flagę, kasuje ją, zapisuje `clockOf(state.time.minutes).day`), `validateScenes` w `data.js` sprawdza sceny `hunt` jak `scene`.
- [ ] **Step 5: Uruchom** `node --test test/loot.test.js test/hunt.test.js` i `npm test`; zielone.
- [ ] **Step 6: Commit** `feat(ekonomia): tier, material, giveRandom i tabele łupów, pola walki (hunt)`.

### Task 3: Dalekie miejsca huba (`far`, 1–4 dni)

**Files:**
- Modify: `src/systems/travel.js` (schemat lokacji, walidacja), `src/ui/map_screen.js` (`destinationEntries`, `destinationLabel`), `src/scenes/map.js` (`choose`, faza `far`), `data/ui.json` (`map.far*`), `src/engine/save.js` (schemat `world.map.far`)
- Test: `test/far_places.test.js`

**Interfaces:**
- Produces: pole lokacji `far: { route: string }` (wyklucza się z `near`); `farTrip(data, locationId): { route: string, days: number }`; wpisy `destinationEntries` rodzaju `{ kind: "far", id, location, route, reverse: boolean, days, danger, label, lines, marked }`; faza mapy `"far"` z `world.map.far = { route, reverse }`.
- Consumes: `runTrip(ctx, { route, reverse })` (`src/scenes/trip.js`), `routeById`, `isKnown`.

Zachowanie: z huba menu mapy pokazuje znane dalekie miejsca z liczbą dni i zagrożeniem; wybór startuje podróż trasą (`runTrip`, z obozem, głodem, zdarzeniami etapów i zapisem po etapie), po dotarciu gracz stoi w dalekim miejscu i widzi jego spoty; jedynym celem w dalekim miejscu jest powrót do huba (ta sama trasa odwrotnie, `reverse: true`). Zlecenia i trasy fabularne bez zmian. Walidacja: `far.route` wskazuje trasę z `to === id` i `from` równym hubowi (lokacja bez `near` i `far`) tego samego regionu, `days ≤ maxRouteDays`, `far` nie występuje razem z `near`/`near.via`.

- [ ] **Step 1: Testy (failing)** `test/far_places.test.js`: (a) schemat odrzuca `far` razem z `near`, trasę o innym `to` i trasę dłuższą niż `maxRouteDays`; (b) z huba `destinationEntries` zawiera wpis `far` z tekstem dni; ukryte (`secret`) dalekie miejsce pojawia się dopiero po `reveal`; (c) w dalekim miejscu jedyny wpis to powrót do huba; (d) skryptowa gra: z huba do `far` (2 dni) kończy się w tym miejscu, spoty widoczne, powrót kończy się w hubie, a zegar przesunął się o co najmniej `days` dni; (e) zapis w środku podróży do dalekiego miejsca (faza `far`) wznawia się na tym samym etapie bez utraty dnia; (f) otwarte zlecenia huba nie giną po wyprawie i powrocie.
- [ ] **Step 2: Uruchom**, oczekiwane FAIL.
- [ ] **Step 3: Zaimplementuj** `far` w schemacie i walidacji; w `destinationEntries` dodaj wpisy `far` (z huba) i wpis powrotu (z dalekiego miejsca, `reverse: true`); w `map.js::choose` wybór wpisu `far` ustawia `phase: "far"` i `world.map.far`, a pętla `map()` obsługuje fazę `far` przez `runTrip`, potem `phase: "place"`, `far: null`, `arrive`.
- [ ] **Step 4: Uruchom** `npm test`, `--validate`; commit `feat(mapa): dalekie miejsca huba osiągane podróżą do 4 dni`.

### Task 4: Przedmioty (58 nowych) i tabele łupów

**Files:**
- Modify: `data/items.json` (tier na wszystkich broniach/pancerzach/artefaktach + nowe), `data/loot.json`, `test/data.test.js` (liczniki)
- Test: `test/items_catalog.test.js`

**Interfaces:**
- Produces: id przedmiotów z tabeli poniżej, tabele łupów `lupy_zbojcy`, `lupy_herszt`, `lupy_zolnierz`, `lupy_bestie`, `lupy_bagno`, `lupy_znalezisko_pogorze`, `lupy_znalezisko_glusz`, `lupy_znalezisko_gwiazdy`.
- Consumes: schemat z Task 2.

Stopnie: T1 szkolne (wartość 25–60), T2 zwykłe (80–150), T3 dobre (220–340), T4 rzadkie (≥500, tylko łup/zlecenia). Pola jak w istniejących przedmiotach (`damageType`, `damage`, `apCost`, `range`, `minStrength`, `masteryType`, `reduction`, `modifiers`); obrażenia i pancerz rosną z `tier` wg widełek poniżej.

| Kategoria | Nowe id (tier) |
|---|---|
| Miecze (`sieczna`, `masteryType: miecz`) | `miecz_zolnierski` (2, 5–10), `miecz_straznika` (3, 7–12), `miecz_mistrza` (4, 9–15), `sztylet_zbojecki` (2, 3–5, offhand), `topor_zbojecki` (2, sieczne 6–11, AP 4), `maczuga_kolkowa` (2, obuchowe 5–10, AP 4), `bulawa` (3, obuchowe 8–14, AP 4) |
| Włócznie (`para`, `reach`, `masteryType: wlocznie`) | `para_wloczni_lowieckich` (2, 4–8), `para_wloczni_strazniczych` (3, 5–10), `para_wloczni_kutych` (4, 7–13) |
| Łuki/kusze (`strzelecka`) | `luk_wojenny` (2, 5–10, AP 4), `luk_zlozony` (3, 7–13), `kusza_zolnierska` (3, 10–17, przeładowanie 4), `kusza_cesarska` (4, 12–20, `armorPierce` 5) |
| Walka wręcz (`wrecz`, bez `masteryType`, R5) | `kastet` (1, obuchowe 2–4, AP 2), `rekawice_nabijane` (2, obuchowe 3–6, AP 2), `piesc_zelazna` (3, obuchowe 5–9, AP 3, `minStrength` 5) |
| Proch (`proch`, `masteryType: palna`) | `pistolet_wojskowy` (3, 12–20), `rusznica` (3, 16–26, AP 6, przeładowanie 6, `minStrength` 5, waga 5, `misfireChance` 18) |
| Tułów | `kurta_skorzana` (1), `skorznia_nabijana` (2), `kolczuga_straznicza` (3), `polpancerz` (3, waga 16, AP −1, skradanie −25) |
| Głowa | `helm_skorzany` (1), `czapa_kolcza` (2), `helm_zelazny` (2), `helm_straznika` (3, `resist_ogluszenie` 25) |
| Ręce | `rekawice_skorzane` (1), `karwasze` (2), `rekawice_kolcze` (3) |
| Nogi | `buty_wedrowca` (2, skradanie +5, `fleeChance` +10), `nagolenniki` (2), `buty_straznika` (3) |
| Płaszcz | `plaszcz_skorzany` (2), `plaszcz_lowczy` (2, skradanie +10), `plaszcz_cesarski` (3) |
| Pas | `pas_zolnierski` (3, `quickSlots` 5) |
| Talizmany (`armor`, slot `talizman`) | `oberog_krwawienia` (2, `resist_krwawienie` 25), `kiel_dzika` (2, `hpMax` +5), `podkowa_szczescia` (2, `fart` +1), `amulet_wilczy` (2, `initiative` +3), `paciorek_pielgrzyma` (2, `wymowa` +5), `talizman_z_odlamka` (3, `effectDuration_strach` −30), `zawieszka_stroza` (3, `resist_ogluszenie` 25, `resist_zamroczenie` 20), `oko_nocy` (3, `bystrosc` +1, `rangedHitChance` +5) |
| Surowce (`material`) | `skora_dzika` (12), `kly_wilcze` (8), `zolc_zmij` (15), `bursztyn_blednika` (25), `rog_utopca` (20), `futro_lisa` (10) |
| Kosztowności (`material`) | `pierscien_zbojecki` (40), `srebrny_kubek` (30), `grzebien_kosciany` (18) |
| Zużywalne/rzucane | `miod_pitny` (leczy 4–8), `oklad_ziolowy` (leczy 8–14), `odtrutka` (zdejmuje `krwawienie`), `flasza_oleju` (rzucana, `podpalenie` 80%) |

Istniejące 15 „martwych” przedmiotów dostaje źródła w Task 6 i 8. Ceny `value` rosną z `tier` (T2 ≈ 100, T3 ≈ 260).

- [ ] **Step 1: Test katalogu (failing)** `test/items_catalog.test.js` na prawdziwych danych: `items.length >= 100`; każda niehidden broń/pancerz ma `tier` 1–4; liczniki: ≥4 miecze/topory/maczugi `sieczna`, ≥3 bronie `wrecz` bez `masteryType`, ≥3 pary włóczni, ≥3 łuki, ≥3 kusze, ≥3 sztuki broni `proch`, pancerz w każdym z slotów `tulow`/`glowa`/`rece`/`nogi`/`plaszcz`/`pas` ma ≥3 stopnie; ≥8 talizmanów; każdy `damage` rośnie ze `tier` w obrębie `masteryType` (średnia obrażeń T3 > T2 > T1).
- [ ] **Step 2: Uruchom**, oczekiwane FAIL (brak `tier`/przedmiotów).
- [ ] **Step 3: Dodaj `tier` do istniejących** (`miecz_krotki` 1, `para_wloczni` 1, `luk_mysliwski` 1, `kusza_lekka` 2, `sztylet` 1, `pistolet_skalkowy` 2, `kaftan_przeszywany` 1, `kolczuga` 2, `kaptur_mysliwego` 1, `rekawice_lucznicze` 1, `buty_podkute` 1, `plaszcz_wedrowca` 1, `pas_zwykly` 1, `pas_ladownice` 2, `kamien_zmierzchu` 3) i dopisz nowe przedmioty z tabeli (opisy po polsku, krótkie, rubaszne).
- [ ] **Step 4: Tabele łupów** w `data/loot.json` (po 6–12 pozycji z wagami): `lupy_zbojcy` (T1–T2 broń/pancerz, kosztowności, strzały), `lupy_herszt` (T2–T3 oraz T4 z łączną wagą ≤8%), `lupy_zolnierz` (T2 pancerz/broń, `pas_zolnierski`, `kusza_zolnierska`), `lupy_bestie` (surowce), `lupy_bagno` (`rog_utopca`, `bursztyn_blednika`, talizmany T2), `lupy_znalezisko_*` (po regionie: pogórze T1–T2, głusz T2–T3, gwiazdy T3 + `talizman_z_odlamka`).
- [ ] **Step 5: Test ciężkiego łupu** (Review Focus 4): gracz z pełnym udźwigiem wygrywa walkę z lootem `polpancerz`; wynik `za_ciezko`, reszta sceny i flagi bez zmian.
- [ ] **Step 6: Uruchom** `npm test` i `--validate`; commit `feat(ekwipunek): 58 nowych przedmiotów w czterech stopniach i tabele łupów`.

### Task 5: Wrogowie (11 nowych), grafiki, symulacje

**Files:**
- Modify: `data/enemies.json`; Create: 11 plików `data/art/<id>.pix` (rysuje asystent skryptem w scratchpad, styl jak E3a, ≤ limit `ART_LIMITS.enemy`); Test: `test/enemies_e2e.test.js`, rozszerzyć `test/combat_sim.test.js`

**Interfaces:**
- Produces: id wrogów: `rabus`, `rabus_lucznik`, `maruder`, `herszt_zbojcow`, `zolnierz_pogranicza`, `sierzant_pogranicza`, `dzik`, `zmija_lesna`, `utopiec`, `blednik`, `skrzat_zlosnik`. Pole `loot` korzysta z `giveRandom`.

| id | hp | def | armor | atak (typ, obr., trafienie, efekt) | ai | xp | łup |
|---|---|---|---|---|---|---|---|
| `rabus` | 26 | 10 | 1 | Maczuga obuchowe 5–9, 65 | aggressive | 45 | 5 gr; `lupy_zbojcy` 40% |
| `rabus_lucznik` | 18 | 12 | 0 | Łuk klute 4–8, 60 (`ranged`) | ranged | 40 | 4 gr; `lupy_zbojcy` 35% |
| `maruder` | 20 | 8 | 0 | Nóż sieczne 3–6, 55; morale 30 | cautious | 30 | 2 gr; `prowiant` 30% |
| `herszt_zbojcow` | 50 | 15 | 3 | Topór sieczne 7–12, 70, `krwawienie` 25%; morale 70 | aggressive | 110 | 20 gr; `lupy_herszt` 100% |
| `zolnierz_pogranicza` | 32 | 14 | 3, `reduction` sieczne 20 | Miecz sieczne 5–9, 65; morale 70 | aggressive | 55 | 6 gr; `lupy_zolnierz` 35% |
| `sierzant_pogranicza` | 40 | 16 | 3 | Miecz sieczne 6–10, 70; morale 80 | aggressive | 80 | 10 gr; `lupy_zolnierz` 70% |
| `dzik` | 30 | 8 | 2 | Kły klute 6–10, 60, `leap` | aggressive | 35 | `mieso` 80%; `skora_dzika` 60% |
| `zmija_lesna` | 8 | 25 | 0 | Ukąszenie klute 2–4, 70, `krwawienie` 60% (R6) | aggressive | 15 | `zolc_zmij` 30% |
| `utopiec` | 35 | 10 | 1 | Uścisk obuchowe 4–8, 65, `zamroczenie` 20% | aggressive | 50 | `lupy_bagno` 60% |
| `blednik` | 16 | 30 | 0 | Żar ogień 3–6, 65, `oslepienie` 30%; `immune: ["oslepienie"]`, `damageTaken: {obuchowe: 0.5, ogien: 1.5}` | ranged | 40 | `bursztyn_blednika` 50% |
| `skrzat_zlosnik` | 10 | 28 | 0 | Psikus obuchowe 1–3, 70, `rozkojarzenie` 50%; morale 40 | cautious | 20 | 5 gr; `lupy_bestie` 30% |

- [ ] **Step 1: Test danych (failing)** `test/enemies_e2e.test.js`: wszystkie 11 id istnieją; każdy ma `loot` niepuste, ludzie (tag `czlowiek`) mają co najmniej jeden `giveRandom`; bestie mają tag `bestia`; każdy ma `art` o rozmiarze w limicie; `enemies.length === 18`.
- [ ] **Step 2: Dodaj wrogów** (tagi: ludzie `["czlowiek"]`, bestie `["bestia"]`, `blednik`/`skrzat_zlosnik` `["bestia","duch"]`) i narysuj 11 grafik `.pix` (obejrzeć `node bin/game.js --art <id>`).
- [ ] **Step 3: Symulacje** (wytyczne 4): w `combat_sim.test.js` dla klas miecz i włócznia na poziomie 1 z wyposażeniem T1 (200 ziaren): 1 rabuś ≥ 85% wygranych; 2 rabusie + łucznik 45–75%; maruder ≥ 90%; patrol (sierżant + 2 żołnierzy) 20–50%; dzik ≥ 70%; zmija ≥ 90%; utopiec 55–85%; błędnik 55–85%; skrzat ≥ 85%; herszt solo 15–45%. Jeśli wyniki wypadają poza widełkami, stroić `hp`/`hit`, nie widełki.
- [ ] **Step 4: Commit** `feat(walka): 11 nowych wrogów z grafikami i łupem, symulacje`.

### Task 6: Sklepy i handlarze

**Files:**
- Modify: `data/shops.json`, `data/travel.json` (spoty `shop` i `talk` w Wilczym Brodzie, Głuszcu, Obserwatorium), `data/dialogues/*.json` (3–4 nowe rozmowy), `data/art` (portrety, jeśli brak)
- Test: `test/shops_e2e.test.js`

**Interfaces:**
- Produces: sklepy `kramarz_brod` (rozszerzony), `kowal_brod`, `szkarad_ruszniczar`, `kowal_gluszec_sklep`, `handlarz_gluszec` (rozszerzony), `zapasy_obserwatorium` (rozszerzony), `warsztat_brygidy`; spoty `wilczy_brod.kowal`, `wilczy_brod.ruszniczar`, `gluszec.kowal_sklep`, `obserwatorium.warsztat`; dialog `szkarad` (rubaszny ruszniczarz z docs/ koncepcji, 4 stany reakcji wg wytycznych 1.4); wędrowny kupiec w zdarzeniach (Task 8) używa `handlarz_wedrowny` z rotującym zapasem.
- Consumes: przedmioty z Task 4.

Skład: `kramarz_brod`: mikstury, odtrutka, kurta/helm/rękawice skórzane, płaszcz skórzany, 3 talizmany T2 (12 pozycji). `kowal_brod`: kastet, rekawice_nabijane, miecz_zolnierski, topor_zbojecki, maczuga_kolkowa, para_wloczni_lowieckich, sztylet_zbojecki, skorznia_nabijana, kolczuga, helm_zelazny, czapa_kolcza, karwasze, nagolenniki, buty_wedrowca. `szkarad_ruszniczar`: pistolet_skalkowy, kula_z_prochem ×20, luk_wojenny, kusza_lekka, strzała ×20, belt ×20, flasza_oleju, garnek_huku, swieca_dymna, puszka_szerszeni. `kowal_gluszec_sklep` (T2–T3): piesc_zelazna, miecz_straznika, para_wloczni_strazniczych, bulawa, luk_zlozony, kusza_zolnierska, pistolet_wojskowy, kolczuga_straznicza, helm_straznika, rekawice_kolcze, buty_straznika, plaszcz_lowczy, pas_zolnierski. `warsztat_brygidy` (T3): talizman_z_odlamka, zawieszka_stroza, oko_nocy, rusznica, polpancerz, plaszcz_cesarski. Wszystkie sklepy: `buys` rozszerzone o `material`; ceny z `rules.shop`.

- [ ] **Step 1: Test (failing)** `test/shops_e2e.test.js`: każdy z sześciu sklepów ma 10–15 pozycji; `kramarz_szkolny` zostaje T1; w sklepach Wilczego Brodu nie ma przedmiotu T3; w sklepach Głuszca i Obserwatorium nie ma T4; każdy sklep ma przynajmniej jedną broń, pancerz i miksturę; gracz z `startMoney` + 100 gr może kupić pierwszy przedmiot T2 w Wilczym Brodzie (cena ≤ 150); spoty sklepów i rozmowy są widoczne w lokacjach od wejścia do huba; `szkarad` ma ≥4 stany (wytyczne 1.4).
- [ ] **Step 2: Dopisz** sklepy, spoty i dialogi (ton wg wytycznych 1; Szkarad: proch z wyspy rzemieślników, ostrzega przed zwiadowcami; kowale narzekają i targują się).
- [ ] **Step 3: Uruchom** `npm test`; commit `feat(sklepy): kowale, Szkarad ruszniczarz i warsztat Brygidy`.

### Task 7: Geometria – odległości w aktach, trasy między hubami, pola walki, dalekie miejsca

**Files:**
- Modify: `data/travel.json`, `data/story.json` (sceny `akt3_wejscie`, `akt3b_wejscie` → `travel`), `data/maps/*.txt`, `data/dialogues/*.json` (ujawnianie dalekich miejsc), `data/art` (`stageArt`, grafiki miejsc), `data/ui.json`
- Test: `test/travel_geometry.test.js` (rozszerzyć), `test/distances.test.js`

**Interfaces:**
- Produces: nowe czasy `near.minutes` (tabela), trasy hub–hub `wilczy_brod_gluszec` (3 dni, region `pogorze`) i `gluszec_obserwatorium` (2 dni, region `glusz`), sceny `akt3_wejscie` (`type: "travel", route: "wilczy_brod_gluszec"`) i `akt3b_wejscie` (`route: "gluszec_obserwatorium"`) z narracją przybycia po podróży, spoty `hunt`, dalekie miejsca (`far`) z trasami z huba.
- Consumes: spot `hunt` (Task 2), dalekie miejsca (Task 3), wrogowie (Task 5), tabele łupów (Task 4).

Odległości (minuty = spacer, dni = podróż z obozem). Najdalsze miejsce każdego huba: **4 dni**.

| Hub | Bliskie (≤60 min) | Średnie (spacer 1,5–5 h) | Dalekie (podróż) |
|---|---|---|---|
| Wilczy Bród | `stary_mlyn` 35, `lesniczowka` (via `wilczy_las`) 60 | `wilczy_las` 90, `trakt_kupiecki` 180, `ruiny_straznicy` 300 | `wilcza_nora` 1 d (istnieje), `ostoja_zbojcow` 3 d (nowe), `twierdza_graniczna` 4 d (nowe) |
| Głuszec | `kapliczka_rozstaje` 30, `wzgorze_wartownicze` (via kapliczka) 45 | `bor_klusownikow` 120, `kamieniolom` (via bor) 90, `stary_trakt` 210, `bagna_szarej_wody` (via stary_trakt) 150 | `spalona_osada` 2 d, `stara_kopalnia` 4 d |
| Obserwatorium | `pole_szkla` 40 | `menhiry` 120, `wrak_maszyny` (via menhiry) 90, `zapadlisko_ciszy` (via menhiry) 150, `krater_gwiazdy` (via pole_szkla) 180, `ostatnia_strazica` (via krater) 240 | `wrak_gwiazdy` 2 d, `ruiny_stacji` 4 d |

Nowe trasy dalekie (`routes`, z huba do miejsca): `wilczy_brod_ostoja` 3 d, `wilczy_brod_twierdza` 4 d, `gluszec_osada` 2 d, `gluszec_kopalnia` 4 d, `obserwatorium_wrak` 2 d, `obserwatorium_stacja` 4 d; region trasy = region huba. Każde dalekie miejsce ma 3 spoty: `hunt` z elitarnym starciem (herszt/sierżant z patrolem/bestie), spot `scene` ze znaleziskiem (`giveRandom` z `lupy_znalezisko_<region>`; dla miejsc 4-dniowych z szansą na T4) oraz `talk` z NPC do pogadania (≥4 stany, wytyczne 1.4). Miejsca są `secret` z `hint` i ujawniane przez `reveal` w rozmowach (Szkarad, kowal, Halina, Hieronim, Brygida), a `hint` pojawia się wcześniej. Pola walki (po 2 w hubie, `cooldownDays` 3): Wilczy Bród `wilczy_las.legowisko` (dzik + wilki), `ruiny_straznicy.oboz_zbojcow` (rabusie + łucznik); Głuszec `bor_klusownikow.oboz_maruderow`, `bagna_szarej_wody.topiel` (utopiec + błędnik); Obserwatorium `pole_szkla.patrol` (patrol pogranicza), `zapadlisko_ciszy.gniazdo` (błędniki + skrzat).

- [ ] **Step 1: Testy (failing)** `test/distances.test.js`: każdy hub ma lokacje w trzech klasach (≤60 min, 90–480 min, `far`); najdalsze `far` każdego huba ma trasę o `days === 4`; każde `far` ma 3 spoty (w tym `hunt` i `talk`); dwie trasy hub–hub istnieją, `story.json` używa ich w `travel`; wszystkie trasy ≤ `maxRouteDays`; każde `hunt` ma `clearedBy` wskazujące walkę w swoich `scenes`; każde miejsce da się odkryć z nowej gry (wytyczne 5.2); **każda lokacja regionu ma marker `{id}` w `data/maps/<region>.txt`** (dalekie miejsca też, na krawędzi mapy z liczbą dni); skryptowa podróż Wilczy Bród → Głuszec trasą 3-dniową kończy się w `gluszec` z zapisem po każdym etapie. `travel_geometry.test.js`: dostosować do nowych czasów i markerów.
- [ ] **Step 2: Zmień dane** (czasy, trasy, spoty `hunt`, dalekie miejsca z trasami i spotami, `reveal`/`hint` w rozmowach), dopisz markery `{id}` w `data/maps/*.txt`, narysuj grafiki dalekich miejsc (≤48×20); sceny `akt3_wejscie`/`akt3b_wejscie` rozbić na `travel` + narrację przybycia z zachowanym tekstem (czas daje trasa).
- [ ] **Step 3: Uruchom** `npm test`, `--validate`; e2e: nowa gra → Głuszec → Obserwatorium przechodzi (istniejące testy `act3a_e2e`, `act3b_*` dostosować do nowych `travel`).
- [ ] **Step 4: Commit** `feat(geometria): odległości w aktach, dalekie miejsca do 4 dni, trasy hub–hub i pola walki`.

### Task 8: Wydarzenia w podróży (30 nowych) i zlecenia z drogi

**Files:**
- Modify: `data/travel.json` (`events`), `data/quests.json` (6 zleceń z drogi), `data/dialogues/*.json`, `data/art`
- Test: `test/events_e2e.test.js`

**Interfaces:**
- Produces: po 10 nowych zdarzeń na region (`if: {"region": "pogorze"|"glusz"|"gwiazdy"}`), w każdym regionie: 3 ataki (z wrogów Task 5; waga 2–3), 3 znaleziska (`encounter` z `giveRandom` z `lupy_znalezisko_<region>`, część `once`), 2 spotkania z NPC do pogadania/handlu (jedno z `wedrowny_kupiec` ze zmiennym zapasem), 1 zlecenie z drogi (`once`, `startQuest`), 1 sytuacja moralna (pomóc/okraść/wydać, wpływ na `wola`/`dlug` lub `search`). Zlecenia z drogi: `pogorze`: `zgubiony_wor_furmana`, `list_do_mlyna_ranny_goniec`; `glusz`: `ranny_zolnierz_nad_strumieniem`, `kosci_na_gosciancu`; `gwiazdy`: `zgubiony_astronom`, `odlamki_dla_kowala`. Każde zlecenie rozliczane u zleceniodawcy w hubie (wytyczne 2.3), z nagrodą (grosze, przedmiot lub XP).

- [ ] **Step 1: Test (failing)** `test/events_e2e.test.js`: `events.length >= 42`; każdy region ≥12 zdarzeń dostępnych w nim (`if.region` lub brak); w każdym regionie ≥3 ataki, ≥3 znaleziska z `giveRandom`, ≥2 spotkania z NPC, ≥1 zlecenie; symulacja 200 podróży 3-dniowych (rng z ziarnem, tylko `rollStageEvent`) ma średnio ≥1,5 zdarzenia; każde zdarzenie przechodzi przez `runScenes` na prawdziwych danych bez utknięcia; każde zlecenie z drogi da się wykonać w kolejności dowolnej z odkrywaniem (wytyczne 5.1–5.2); porażka testu w zdarzeniu kończy się ripostą (2).
- [ ] **Step 2: Napisz zdarzenia i zlecenia** (ton: wytyczne 1 i 1a; `once` dla fabularnych, losowe powtarzalne; wszystkie `kind: attack` z `canFlee`; NPC do pogadania z ≥4 stanami).
- [ ] **Step 3: Uruchom** `npm test`, `--validate`; commit `feat(podróże): 30 nowych zdarzeń i 6 zleceń z drogi`.

### Task 9: Prowadzenie gracza – wątek główny zawsze wskazuje następny krok (R10)

**Files:**
- Modify: `data/quests.json` (po jednym zleceniu wątku głównego na hub: `watek_wilczy_brod`, `watek_gluszec`, `watek_obserwatorium`), `data/story.json` (`starts` w scenach `map`), `data/travel.json` (cmentarz, wizyty `forced`, `kupiec_ostromir`), `data/dialogues/*.json` (Halina, sołtys, Hieronim: wskazówki), `data/ui.json`
- Test: `test/main_thread.test.js`

**Interfaces:**
- Produces: zlecenia `kind: "main"`-podobne (zwykłe `errand`, bez terminu, bez możliwości porzucenia przez opuszczenie huba) z listą `objectives`, których `done` odpowiadają krokom wątku, np. Głuszec: (1) „Przyjmij się w osadzie” → (2) „Zbadaj trop: wzgórze albo sprzedawca nazwisk” → (3) „Odwiedź cmentarz po zmroku” → (4) „Opowiedz o głosie siostrze Halinie” (koniec = `akt3a_koniec`); Wilczy Bród: (1) „Zgłoś się do komendanta” → … → (n) „Odprowadź Ostromira na Przełęcz”; Obserwatorium: do `akt3b_koniec`; wizyta `forced` z wskazówką (sołtys/Halina/Hieronim), gdy wszystkie kroki poprzedzające krok kluczowy są spełnione, a krok kluczowy nie ruszył od jednego dnia.
- Consumes: `currentObjectives`, `starts` sceny `map`, `visitors[].forced`, warunki `questStatus`/`timeOfDay`.

Reguły: kluczowy krok nigdy nie zależy od samego losu (zdarzenie Ostromira staje się zdarzeniem `once` o wadze 6 i dodatkowo ogłoszeniem na tablicy w Wilczym Brodzie od komendanta, gdy `dlug_oddany`); wymóg „w nocy” przy cmentarzu zostaje, ale cel w dzienniku mówi „po zmroku”, a opis cmentarza w dzień zawiera zdanie wskazujące porę.

- [ ] **Step 1: Testy (failing)** `test/main_thread.test.js` na prawdziwych danych, trzy huby: (a) z nowej gry na starcie huba wątek jest aktywny i ma cel; (b) po symulowanym wykonaniu wszystkich zleceń pobocznych (flagi/`questStatus`) przed krokiem kluczowym `currentObjectives` zawiera krok kluczowy z nazwą miejsca; (c) w stanie „kroki poprzedzające spełnione, krok kluczowy nietknięty od 1 dnia” wejście do huba losuje wizytę `forced` ze wskazówką; (d) akt II: bez losowego zdarzenia da się podjąć eskortę Ostromira (ogłoszenie na tablicy) i zakończyć akt; (e) ukończenie ostatniego kroku ustawia flagę końca aktu (`akt2_koniec`, `akt3a_koniec`, `akt3b_koniec`); (f) wątek główny nie jest tracony po opuszczeniu huba i nie wchodzi w limit `maxActive`.
- [ ] **Step 2: Uruchom**, oczekiwane FAIL.
- [ ] **Step 3: Dopisz dane** (cele z krótkimi, rubasznymi opisami; `starts` w scenach `map`; wizyty `forced`; ogłoszenie Ostromira; zdanie o porze przy cmentarzu).
- [ ] **Step 4: Uruchom** `npm test`, `--validate`; commit `feat(fabuła): wątek główny z widocznym celem i awaryjnym popchnięciem w każdym hubie`.

### Task 10: Lint ekonomii, e2e, balans i recenzja

**Files:**
- Create: `test/economy.test.js`, `test/e2e_economy.test.js`, `docs/superpowers/plans/2026-10-26-cykl-e2e-ledger.md`
- Modify: `test/consistency.test.js` (jeśli trzeba), `docs/wytyczne-tresci-i-qa.md` (nowa reguła „każdy przedmiot ma źródło”), `data/rules.json` (strojenie XP/cen)

**Interfaces:** Consumes: wszystko powyżej.

- [ ] **Step 1: Lint źródeł (failing przed domknięciem luk)** `test/economy.test.js` na prawdziwych danych: (a) każdy przedmiot poza `hidden`, `misc` i `ammo` bazowymi ma źródło (stock sklepu, `loot` wroga, tabela `loot.json` użyta przez dowolną akcję `giveRandom`, `giveItem` w scenie/zdarzeniu/zleceniu/nagrodzie, start klasy, `forage`); (b) T4 występuje wyłącznie w tabelach `lupy_herszt`/`lupy_zolnierz`, nagrodach zleceń lub znaleziskach, nigdy w sklepie; (c) każdy sklep ma 10–15 pozycji; (d) każdy region ma sklep z bronią, pancerzem i amuletem swojego tieru (pogórze T1–T2, głusz T2–T3, gwiazdy T3); (e) każdy wróg ma `loot`; ludzie dropią `giveRandom`; (f) każdy hub ma 3 klasy odległości; (g) każdy region ≥12 zdarzeń; (h) wyjątki (`hidden`, `misc`) wypisane jawnie w stałej `NO_SOURCE_OK` z powodem.
- [ ] **Step 2: E2E ekonomii (Review Focus 5)** `test/e2e_economy.test.js`: skryptowa gra bota (miecz i włócznia) od Brzeziny do Obserwatorium z walczeniem, zbieraniem łupu i zakupami; po akcie II suma zarobionych groszy ≥ cena (broń T2 + tułów T2 + helm T2) przy `handel` ze startu; w akcie I–II żaden przedmiot T3 nie jest osiągalny (sklep ani łup); `proch` i `strzelecka` mają osiągalną broń przed końcem aktu II; poziom postaci na końcu aktu II ≥3 (strojenie XP z `enemies.json`/zleceń; jeśli test nie przechodzi, stroić dane, nie asercję).
- [ ] **Step 3: Uruchom** pełny `npm test`, `node bin/game.js --validate`, ręcznie `node bin/game.js --scene` dla trzech wydarzeń w trzech regionach i jednego pola walki; sprawdź w trybie ramki (≥80×24) i liniowym.
- [ ] **Step 4: Ledger** `docs/superpowers/plans/2026-10-26-cykl-e2e-ledger.md`: wnioski, deviations od specu (R1–R8), odłożone sprawy (ulepszanie broni, ilustracje poza wrogami, rękawice nabijane).
- [ ] **Step 5: Recenzja końcowa** (świeży recenzent z listą kontrolną z `docs/wytyczne-tresci-i-qa.md`), poprawki; commit `feat(e2e): lint źródeł przedmiotów, e2e ekonomii, ledger`.

---

## Self-review
- **Pokrycie specu:** §1 odległości i zanikanie → Tasks 1, 6; wydarzenia → Task 7; §2 wrogowie → Task 4; §3 przedmioty → Task 3; §4 sklepy → Task 5; §5 lint → Task 8; §6 zapis → Task 1. Odchylenia opisane w Plan rulings.
- **Spójność nazw:** `passKey`, `repeatChance`, `recordPass`, `rollLocalEvents`, `recordHunt`, `isHuntReady`, `rollLootTable`, `world.passes`, `world.hunts` użyte identycznie w Tasks 1–2, 6, 8.
- **Proporcje:** tabele zastępują listy kroków tam, gdzie decyzja jest w danych, a ciało funkcji zostawiono implementatorowi.
