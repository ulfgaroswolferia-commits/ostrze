# Cykl E2b2 – akt II: treść, ludzie i zlecenia – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wypełnić Pogórze treścią aktu II: rozliczanie zleceń u zleceniodawców, gości w lokacjach, pytania t/n i imię w panelu wyboru, cztery nowe lokacje, osiem nowych zleceń (dostarczanie, informacje, szukanie osoby), NPC „do pogadania”, riposty i koniec aktu eskortą Ostromira.

**Architecture:** Trzy małe zmiany silnika (`report`/`completeQuest`, `visitors`, wejście tekstowe w panelu), reszta to dane (`travel.json` lokacje ze `spots`, `quests.json`, `dialogues/*.json`, `maps/pogorze.txt`) pisane według wzorców z E2b1 (miejsca typu `scene` z łańcuchami `if`+flagi, zlecenia `errand` z celami). Testy danych przechodzą każde zlecenie od początku do nagrody na prawdziwych danych.

**Tech Stack:** Node ≥ 22 ESM, `node:test`, dane JSON, zero zależności. Kod i komentarze po angielsku, teksty gry po polsku.

**Spec:** `docs/superpowers/specs/2026-10-24-cykl-e2b2-akt-ii-tresc-design.md` (gałąź `cykl-e2b2`). Wzorce kodu: `src/systems/quests.js`, `src/scenes/map.js`, `src/systems/spots.js`, `test/hub_content.test.js`, `test/map_places.test.js`.

## Decyzje planu względem specyfikacji

1. **`report` w zleceniach `quest`:** na końcu wyprawy scena `quest` z polem `report: "<id>"` ustawia `state.quests[id].reported = true` (status zostaje `active`). `mapOptions` i `tripQuests` pomijają zgłoszone, więc nie są już celem wyprawy ani nie przepadają przy wyjściu fabułą. Zlecenie zamyka akcja `completeQuest` w rozmowie z zleceniodawcą (jej `onComplete` wypłaca nagrodę). Dziennik pokazuje „Zgłoś się: <kto>” z pola `reportTo`.
2. **`visitors`:** gość jest losowany raz przy wejściu w menu miejsc lokacji i zapamiętany w `world.map.visitor` (zapis i ponowne rysowanie nie zmieniają losowania); jednorazowość to flaga ustawiana w scenach gościa i jego `if`.
3. **Wejście tekstowe w ramce:** `askText(io, ui, label)` czyta klawisze (znaki, Backspace, Enter) i odrysowuje linię w panelu wyboru; `confirm` w ramce to dwa wiersze „[T] Tak / [N] Nie” z pytaniem w panelu sceny. Tryb liniowy bez zmian. Sterownik testowy rozbija wieloznakowy token na klawisze + Enter w trybie TTY.
4. **Lokacje bliskie liczone od huba** (jak w E2b1): Stary młyn 35, Trakt kupiecki 45, Leśniczówka 55, Ruiny strażnicy 40 minut; Przełęcz zostaje lokacją tymczasową eskorty.
5. **M2 (stare zapisy):** `loadGame` zamienia `scene.id` usuniętej sceny fabuły na `demo_mapa`, jeśli ta istnieje; zapis ostrzega.
6. Treść tekstowa jest pisana przez wykonawcę po polsku, w tonie z uwag użytkownika (rubaszność, riposty, krótkie zdania); plan wiąże id, mechanikę i flagi.

## Global Constraints

- Node ≥ 22, ESM, zero zależności; `timeout 115 npm test`; `node bin/game.js --validate` → „Dane poprawne.”.
- Teksty gracza w danych albo `data/ui.json`, nie w kodzie; TTY ≥ 80×24 w ramce, tryb liniowy bez zmian; ramka = rows − 1 wierszy, ≤ 200 kolumn.
- Id `^[a-z0-9_]+$`; id miejsca `<lokacja>.<miejsce>`; id scen globalnie unikalne; każdy węzeł rozmowy ma opcję zawsze dostępną.
- Każda lokacja bliska występuje w `data/maps/pogorze.txt` (token `{id}`); grafiki ≤ 48×20, `node bin/game.js --art <id>`.
- Zapis: `SAVE_FORMAT_VERSION` bez zmiany (nowe pola opcjonalne z domyślnymi w `repairQuestState`).
- Commity kończą się: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` i `Claude-Session: https://claude.ai/code/session_01CSUDEqmx6DsMRLPg8xRKSu`.

## Review Focus

1. Zlecenie wyprawy po zgłoszeniu: brak ponownej wyprawy, brak przepadnięcia, nagroda raz, zapis między powrotem a rozmową (Task 1).
2. Gość w lokacji: losowanie nie zmienia się po zapisie/wczytaniu i po wejściu w miejsce i powrocie; powtarzalny gość nie spamuje po flagach (Task 2).
3. Imię i t/n w ramce: pusty Enter, Backspace na pustym polu, bardzo długie imię, brak znaków pod ramką (Task 3).
4. Każde nowe zlecenie ma osiągalne cele przy dowolnej kolejności odkrywania lokacji i nie utyka (powtórka błędu C1 z E2b1: cel spełniony „z góry”) (Tasks 6–8).
5. Limit aktywnych zleceń (6) przy równoległych zleceniach; niedostępne miejsca/lokacje nie pojawiają się wcześniej niż po odkryciu (Tasks 5–9).

---

### Task 1: Rozliczenie zlecenia u zleceniodawcy (`report`, `completeQuest`), Wilcza nora

**Files:** `src/systems/quests.js`, `src/systems/actions.js`, `src/scenes/schemas.js`, `src/engine/data.js` (walidacja sceny `quest`), `src/scenes/quest.js`, `src/ui/journal_screen.js`, `data/quests.json` (wilcza_nora), `data/dialogues/komendant_raport.json`, `data/travel.json` (spot komendant), `data/ui.json`; testy: `test/quests.test.js`, `test/map_scene.test.js`, `test/hub_content.test.js`, `test/e2e.test.js`

**Interfaces:**
- Produces: pola zlecenia `onComplete` (akcje, także dla `quest`/`escort`), `reportTo` (tekst), `report: boolean`; scena `quest` z `report: "<id>"`; akcja `{ completeQuest: "<id>" }` (walidacja: znane zlecenie; wykonanie: `finishQuest`); `finishQuest(state, data, id, rng): object[]` w `quests.js` (zamyka aktywne zlecenie i wykonuje `onComplete`, raz); `reportedQuest(state, id): boolean`.

- [ ] **Step 1: Testy (RED):** zlecenie z `report: true` po scenie `quest { report }` jest `active` i `reported`, nie ma go w `mapOptions`, `abandonHub` go nie traci; akcja `completeQuest` w rozmowie zamyka je, wypłaca `onComplete` raz (drugie wywołanie nic); walidacja: `report` bez `reportTo`, `onComplete` z błędną akcją, `completeQuest` z nieznanym id; dziennik: „Zgłoś się: Komendant Wszebor”; nora: po powrocie status `active`, po rozmowie `komendant_raport` `done`, +25 monet, wzmianka o kurierze w tekście; `kom_po` po rozliczeniu; dotychczasowe testy nory dostosowane (pełny cykl: status po powrocie `active`, rozliczenie osobną rozmową).
- [ ] **Step 2:** `timeout 115 node --test test/quests.test.js test/map_scene.test.js test/hub_content.test.js`. Expected: FAIL.
- [ ] **Step 3:** Zaimplementuj; w `quests.json` nora: usuń `nora_zaplata` i scenę `quest complete`, dodaj scenę `quest { report: "wilcza_nora" }` po `nora_flaga`, `onComplete: [{ giveMoney: 25 }, { xp: 40 }]`, `reportTo: "Komendant Wszebor"`; komendant: sceny `kom_raport` (dialog `komendant_raport`, jeśli `nora_wykonana` i nie `nora_rozliczona`; akcje: `completeQuest`, `setFlag nora_rozliczona`), `kom_po` tylko po `nora_rozliczona`, `kom_odburk` bez zmian.
- [ ] **Step 4:** testy z kroku 2 + pełny zestaw + `--validate`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(zlecenia): rozliczenie u zleceniodawcy – report/completeQuest, nagroda za norę u komendanta`.

---

### Task 2: Goście w lokacjach (`visitors`)

**Files:** `src/systems/travel.js` (schemat/walidacja), `src/engine/data.js` (sceny gości), `src/systems/spots.js` (`rollVisitor`), `src/scenes/map.js`, `src/systems/quests.js` (`repairQuestState`: `map.visitor`), `data/ui.json`; testy `test/places_data.test.js`, `test/map_places.test.js`

**Interfaces:**
- Produces: lokacja `visitors: [{ id, chance: 1–100, if?, scenes }]`; `world.map.visitor: string | null`; `rollVisitor(state, data, locationId, rng): string | null` (jedno `rng.int(1,100)` na gościa w kolejności danych, pierwszy trafiony, tylko z przechodzącym `if`); pozycja menu miejsc `Ktoś się kręci…` (`map.visitorLabel`) uruchamia sceny gościa jak miejsce typu `scene` (id sceny `gosc:<lokacja>.<id>`), po powrocie gość znika do następnego wejścia w lokację.

- [ ] **Step 1: Testy (RED):** walidacja (`chance` 0/101, brak `scenes`, `if` nieznany, id duplikat, sceny w tych samych regułach unikalności); `rollVisitor` przy `rng` zawsze 1 i `chance 100` zwraca gościa, przy `if` niespełnionym `null`; w scenie `map` wejście w lokację losuje gościa raz (zapis i wczytanie w menu miejsc daje tego samego gościa, `map.visitor` zachowane); wizyta u gościa kasuje `map.visitor`; gość z flagą w `if` nie wraca.
- [ ] **Step 2:** `timeout 115 node --test test/places_data.test.js test/map_places.test.js`. Expected: FAIL.
- [ ] **Step 3:** Zaimplementuj; losowanie przy przejściu do fazy `place` z `walk`, z `choose` ("Zostań") i przy tworzeniu mapy; nie przy powrocie ze `spot`.
- [ ] **Step 4:** testy + pełny zestaw. Expected: PASS.
- [ ] **Step 5: Commit** `feat(mapa): goście w lokacjach – losowanie raz na wejście, zapamiętane w zapisie`.

---

### Task 3: Pytania t/n i imię w panelu wyboru

**Files:** `src/ui/prompt.js` (`confirm`, `askText`), `src/ui/menu.js` (jeśli potrzeba), `src/scenes/character_creation.js`, `src/ui/screen.js`, `data/ui.json`, `test/helpers.js` (sterownik: wieloznakowy token → klawisze + Enter w TTY), `test/frame_fixes.test.js`, `test/prompt.test.js`, `test/e2e.test.js`

**Interfaces:**
- Produces: `askText(io, ui, { label, max = 24, initial = "" }): Promise<string>` (w ramce: klawisze, Backspace, Enter, linia `label: tekst▌` jako wiersz panelu wyboru; poza ramką `io.ask(label)` jak dotąd); `confirm(io, ui, question)` w ramce: pytanie dopisane do panelu sceny, wiersze „[T] Tak”, „[N] Nie” (hotkeys t/n, Enter = domyślnie „Nie”), wynik jak dotąd; sterownik testowy w trybie TTY: token tekstowy dłuższy niż 1 znak i nienależący do `KEY_TOKENS` → sekwencja znaków + Enter.

- [ ] **Step 1: Testy (RED):** ramka 80×24: po `confirm` żaden wiersz nie jest dopisany pod ramką (`strayChunks` pusty), pytanie widoczne w panelu sceny, `t`/`n`/Enter działają, błędny klawisz ignorowany; `askText`: wpisanie „Thorgniew”, Backspace usuwa znak, Backspace na pustym nic, Enter na pustym nie zwraca pustego imienia (kreator ponawia z komunikatem), imię dłuższe niż `max` jest ucinane; kreator w TTY nie pisze nic pod ramką; tryb liniowy bez zmian (stare testy zielone).
- [ ] **Step 2:** `timeout 115 node --test test/frame_fixes.test.js test/prompt.test.js`. Expected: FAIL.
- [ ] **Step 3:** Zaimplementuj; popraw testy TTY używające `"Thorgniew"` i `"t"`/`"n"`.
- [ ] **Step 4:** testy + pełny zestaw. Expected: PASS.
- [ ] **Step 5: Commit** `feat(ui): pytania t/n i imię w panelu wyboru`.

---

### Task 4: Domknięcia po recenzji E2b1 (M1–M5) i migracja M2

**Files:** `src/scenes/map.js`, `src/systems/places.js`, `src/systems/quests.js` (`repairQuestState`), `src/engine/save.js`, `src/ui/map_screen.js`, `data/dialogues/wrzosek.json`, testy `test/map_places.test.js`, `test/save.test.js`, `test/places.test.js`

- [ ] **Step 1: Testy (RED):** (M1) zapis w środku rozmowy w miejscu `scene` z `if` zmienianym przez akcje wejścia wznawia ten sam dialog (`runScenes` dla miejsc startuje od zapamiętanej sceny bez ponownej oceny jej `if`: opcja `opts.resume` albo własny pierwszy krok w `spot()`); (M2) zapis ze `scene.id` usuniętej sceny fabuły wczytuje się na `demo_mapa` z ostrzeżeniem; (M4) `reveal` spotu w nieodkrytej lokacji ukrytej zwraca `[]`, `hint` spotu pokazuje „???” lokacji; (M5) `map.spotScene`, `walk.event`, `walk.eventScene` nieistniejące w danych → naprawa do `place`/`choose` bez wyjątku; Wrzosek: podjęcie z tablicy ustawia `lek_podjety` (akcja `startQuest` z tablicy → `setFlag`: pole `onStart` zlecenia, np. `onStart: [{ setFlag: "lek_podjety" }]`).
- [ ] **Step 2–4:** uruchom RED, popraw, uruchom pełny zestaw. Expected: PASS.
- [ ] **Step 5: Commit** `fix(e2b1): domknięcia M1–M5 i migracja starych scen`.

---

### Task 5: Cztery lokacje, mapa i ludzie „do pogadania”

**Files:** `data/travel.json`, `data/maps/pogorze.txt`, `data/dialogues/*.json` (nowe: `ostap`, `lesniczy`, `ostromir_trakt`, `kowal`), `data/art/` (opcjonalnie), `test/acts_data.test.js` (nowy)

**Interfaces (id wiążące):**
- `stary_mlyn` (near 35, danger 1, secret, hint „dym nad rzeką”): `mlynarz` (talk `ostap`), `mlyn` (scene: wejście, noc → `mlyn_noc_*`, gdy `timeOfDay noc`, inaczej dzień), `zona` (chatter).
- `trakt_kupiecki` (near 45, danger 2, secret, hint „wóz na trakcie”): `ostromir` (talk `ostromir_trakt`), `zwiadowcy` (scene, podsłuch, `timeOfDay` zmierzch/noc), `pielgrzym` (chatter).
- `lesniczowka` (near 55, danger 1, secret, hint „komin w lesie”): `lesniczy` (talk `lesniczy`), `pies` (chatter).
- `ruiny_straznicy` (near 40, danger 4, secret, hint „czarne mury”): `ruiny` (scene: przeszukanie), `cien` (scena strachu).
- hub: nowe miejsca `kowal` (talk `kowal`), `zona_borka` (talk, `secret`), `corka` (talk, `secret`); `wilczy_las`: `slady` (scene), `drwal` (chatter).
- Chatter w każdej lokacji: szablon trójstanowy z E2b1 (pierwszy raz / „a to znowu ty” / zbywanie); co najmniej po jednym NPC w hubie i w każdej nowej lokacji; teksty rubaszne, o upiorach, cesarstwie, sąsiadach, kurach.

- [ ] **Step 1: Testy (RED)** `test/acts_data.test.js`: `validateData` czyste; każda nowa lokacja ma `near`, `danger`, `secret`, `hint`, token w mapie i co najmniej jedno miejsce `talk` lub `scene`; każdy chatter ma trzy stany (przejście trzech wizyt daje trzy różne teksty); żaden węzeł rozmowy bez opcji zawsze dostępnej; lokacje niewidoczne bez `reveal` (`isKnown` false na starcie).
- [ ] **Step 2–4:** RED → dane → pełny zestaw. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tresc): lokacje aktu II i ludzie do pogadania`.

---

### Task 6: Zlecenia – przedmioty

**Files:** `data/quests.json`, `data/items.json` (`worek_maki`, `list_komendanta`, `pokwitowanie`), dialogi `wrzosek`, `ostap`, `ostromir_trakt`, `komendant*`, `data/travel.json` (`reveal` w nagrodach), `test/quests_act2.test.js` (nowy)

**Zlecenia (`errand`, `board: true` tam, gdzie `requires` spełnione):**
1. `maka_dla_mlyna` (requires `known stary_mlyn`): `kramik` (kup/odbierz worek: akcja `giveItem worek_maki` w rozmowie z kramarzem) → `stary_mlyn.mlynarz` (oddanie, flaga `ostap_maka`) → `wilczy_brod.karczma` (wiadomość od Ostapa, flaga `wrzosek_wiadomosc`); nagroda 12 gr, 30 XP, `reveal trakt_kupiecki`-hint.
2. `dlug_kupca` (po wizycie w młynie): `wilczy_brod.karczma` (Wrzosek wręcza dług do ściągnięcia, `giveItem` weksel) → `trakt_kupiecki.ostromir` (oddanie, `giveItem pokwitowanie`) → karczma (zwrot, flaga `dlug_oddany`); nagroda 20 gr, 40 XP.

- [ ] **Step 1: Testy (RED)** `test/quests_act2.test.js`: helper przechodzący zlecenie na prawdziwych danych (stan z postacią, `reveal` potrzebnych lokacji, sterownik `createAdaptiveIO` z `{ pick }`): każde zlecenie od podjęcia do nagrody, przy cel „z góry” (przedmiot już w torbie przed podjęciem) i przy odwrotnej kolejności (najpierw miejsce docelowe), w obu klasach; brak utknięcia (`status === "done"`).
- [ ] **Step 2–4:** RED → dane → zestaw. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tresc): zlecenia przedmiotowe – mąka dla młyna, dług kupca`.

---

### Task 7: Zlecenia – informacje

**Zlecenia:**
1. `list_do_lesniczego`: `wilczy_brod.komendant` (list `list_komendanta`, flaga) → `lesniczowka.lesniczy` (odpowiedź ustna `lesniczy_odpowiedz`) → komendant (raport; nagroda 15 gr, 30 XP; odsłania `ruiny_straznicy` hintem).
2. `kto_pyta_o_ocalalych`: `trakt_kupiecki.zwiadowcy` (podsłuch, flaga `zwiadowcy_slysza`; test Skradania z odprawą ciętą ripostą przy porażce i alternatywą Wymowy) → komendant (zapowiedź aktu III, flaga `akt3_zapowiedz`); nagroda 25 gr, 50 XP.
3. `swiatlo_w_mlynie`: `stary_mlyn.mlyn` (noc, odłamek szkła `odlamek_szkla`) → `wilczy_brod.kowal` (rozpoznanie kamienia, flaga `kamien_rozpoznany`); nagroda: wiedza (flaga) i 40 XP.

- [ ] **Step 1–5:** jak w Task 6 (testy w `test/quests_act2.test.js`: ścieżki z testem Skradania w obu wynikach — porażka nie blokuje zlecenia — oraz sceny nocne: noc/dzień). Commit `feat(tresc): zlecenia informacyjne – list, ocalali, światło w młynie`.

---

### Task 8: Zlecenia – osoba, amulet, koniec aktu

**Zlecenia:**
1. `zaginiony_pasterz_borek` (szukanie osoby): `wilczy_brod.zona_borka` (odsłonięta plotką Wrzoska) → `wilczy_las.slady` (ślady, flaga `borek_slady`) → `ruiny_straznicy.ruiny` (Borek ranny; test Medycyny lub opatrunek ratuje go, brak = żyje, ale kaleka; flaga `borek_znaleziony`) → żona (nagroda 30 gr, 60 XP, odsłania `corka`).
2. `amulet_z_ruin` (requires `item amulet_strazniczy` lub flaga z ruin): `ruiny_straznicy` (znak pasuje, flaga `amulet_pasuje`) → `wilczy_brod.corka` (oddanie/rozmowa; wybór: oddać lub zatrzymać – obie zamykają zlecenie, ustawiają `amulet_oddany`/`amulet_zatrzymany`); nagroda wiedza o technologii (flaga), 50 XP.
3. `eskorta_ostromira` (istnieje) – ostatnie: wymaga `flag dlug_oddany` i `known trakt_kupiecki`; po `done` flaga `akt2_koniec`; scena końcowa aktu II (`ending`-owa narracja + zapis) w `story.json` po `demo_mapa`: `main` huba prowadzi do niej tylko przy `akt2_koniec`, inaczej „Zamknij dzień” jak dotąd.

- [ ] **Step 1–5:** testy ścieżek jak wyżej + test: `akt2_koniec` ustawiane tylko po eskorcie, brama aktu otwiera się dopiero wtedy, wcześniej „Zamknij dzień” → `demo_odpoczynek`; limit aktywnych 6 przy równoległych zleceniach. Commit `feat(tresc): szukanie Borka, amulet, eskorta i koniec aktu II`.

---

### Task 9: Riposty i ton w dialogach E2a/E2b1

**Files:** `data/dialogues/kurier.json`, `komendant*.json`, `wrzosek.json`, `kwatermistrz.json`, inne ze skutkiem „sam komunikat o porażce”; testy `test/story_prolog.test.js`, `test/dialogue.test.js`

- [ ] **Step 1: Test (RED):** każdy węzeł `*_zle`/`odprawa`/porażka testu w dialogach z `check` prowadzi do węzła z tekstem co najmniej 120 znaków i zawierającym cudzysłów „…” (riposta), a nie do pustego powrotu; lista węzłów porażek wylicza się z danych (`failure` opcji).
- [ ] **Step 2–4:** RED → przepisanie odpowiedzi na ciętsze (sarkazm, krótkie zdania) → zestaw. Expected: PASS.
- [ ] **Step 5: Commit** `feat(dialogi): riposty po nieudanych próbach`.

---

### Task 10: Grafiki braków i domknięcie

**Files:** `data/art/karczma_pod_wilczym_klem.pix`, `portret_wrzosek.pix`, `portret_kramarz.pix`, `stary_mlyn.pix`, `trakt_kupiecki.pix`, `ruiny_straznicy.pix`, `data/dialogues/wrzosek.json` (portrait), `data/travel.json` (`art` lokacji/miejsc), `test/e2e.test.js`, ledger `docs/superpowers/plans/2026-10-24-cykl-e2b2-ledger.md`, pamięć `ostrze-project-cycles.md`

- [ ] **Step 1: Test e2e (RED):** od szkoły przez pobojowisko, hub, komendant, zlecenie po zleceniu do `akt2_koniec` (klasy `miecz`, `wlocznia`), `flags.akt2_koniec`, wszystkie zlecenia aktu II `done` albo niedostępne zgodnie z fabułą; nic nie jest dopisane pod ramką w TTY 80×24 i 200×50 na ekranach mapy, miejsc, gościa i zgłoszenia.
- [ ] **Step 2:** `timeout 115 node --test test/e2e.test.js`. Expected: FAIL do czasu dopasowania tokenów.
- [ ] **Step 3:** Narysuj grafiki (≤ 48×20, patrz `data/art/*.pix`, podgląd `--art`), podłącz; pełny zestaw i `--validate`.
- [ ] **Step 4:** ledger (`Task N: complete`), notatka w pamięci, commit `test(e2e): akt II od pobojowiska do akt2_koniec; grafiki; ledger E2b2`.
