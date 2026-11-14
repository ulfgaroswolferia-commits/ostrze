# Cykl E2a – prolog i akt I – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zastąpić początek dema prawdziwą fabułą: szkoła → kurier → delegacja → marsz → noc upiorów → przebudzenie z Istotą → świt w Wilczym Brodzie (dalej dotychczasowe sceny demo jako tymczasowy akt II).

**Architecture:** Dwie małe zmiany silnika (`healFull`, `endsTrip`), reszta to dane: nowy wróg, zdarzenia podróży z listami scen, pięć dialogów i przepisane sceny `story.json`. Test e2e i sterownik testowy dostają kroki dla nowych scen.

**Tech Stack:** Node ≥ 22 ESM, `node:test`, dane JSON (`data/`), zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-22-cykl-e2a-prolog-akt1-design.md` (gałąź `cykl-e2a`, zaktualizowana o `master` z E1, E1b, C2c, E3a).

## Global Constraints

- Zero zależności; kod i komentarze po angielsku; teksty gry po polsku; id i klucze bez ogonków; styl treści: rubaszność + nordycka surowość, archaizacja lekka (`docs/koncepcja_dialogi_narracja_i_przyk_ady.md`).
- Commity po polsku, końcówka: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` i `Claude-Session: https://claude.ai/code/session_01CSUDEqmx6DsMRLPg8xRKSu`.
- Każda scena ma unikalne `id` (także te w `scenes` zdarzeń podróży). Zmienne `wola`/`dlug` tylko ±1 na wybór; flagi bez ogonków.
- Walidacja danych: `node bin/game.js --validate` → „Dane poprawne.”; zestaw: `timeout 115 npm test` (858 testów zielonych na starcie planu, po E3a).
- Ramki, walka z ciosami celowanymi (akcje [G][R][N][S]) i ilustracje `.pix` są już w kodzie; testy TTY czytają ramki przez `test/frame_read.js`. Obrazy: format `.pix`, limity scena 48×20, portret 20×20, wróg 40×16; pola `art`/`portrait` (patrz Task 6).
- **R1 (stały):** testy e2e/scenariuszowe związane ze starym przebiegiem dema adaptujemy w miejscu (progi i sens zachowane); adaptacja nie wymaga osobnego rulingu.

## Review Focus

1. Zapis i wczytanie w środku zdarzenia nocy (przed walką, po walce, w rozmowie z Istotą) wznawia się w tym samym miejscu i kończy podróż.
2. Obie klasy (miecz, włócznia) i gracz o niskim HP/głodny przegrywają walkę z upiorami przez `onDefeat` – nigdy `DefeatError`, nigdy blokada.
3. Ulewa (opóźnienie +1 dzień) na dniu 1: zdarzenie `noc_upiorow` odbywa się raz, w dniu 2 trasy, i kończy podróż także wtedy, gdy `daysTotal` urosło do 3.
4. 80×24: sceny z ilustracją (10 wierszy) nie pokazują jej i nie zmieniają stron tekstu; 200×50: pokazują.
5. Gracz, który uciekł przed bandytami lub przegrał sparing: prolog dalej gra, ognisko i noc odbywają się.
6. `healFull` zdejmuje wszystkie efekty (także głód i podchmielenie); po przebudzeniu HP = max.

---

### Task 1: Akcja `healFull`

**Files:** Modify: `src/systems/actions.js`, `data/ui.json` (bez nowych kluczy, jeśli `combat.heal` wystarcza); Test: `test/actions.test.js`.

**Interfaces:**
- Produces: akcja `{ healFull: true }` w `ACTION_KEYS`; `validateAction`: tylko `true` (inaczej błąd „oczekiwano true”); `runActions`: `character.hp = hpMax` (`getStats(state, data).derived.hpMax`), usuwa wszystkie efekty postaci (`character.effects = []`), dopisuje zdarzenie `{ type: "leczenie", amount: <ile HP przybyło> }` (renderuje je `src/ui/events.js`, klucz `combat.heal`).

- [ ] **Step 1: Testy (RED)** w `test/actions.test.js`: (a) po `runActions(state, data, [{ healFull: true }])` postać z HP 1 i efektami `krwawienie`, `glod` ma `hp === hpMax`, `effects.length === 0`, a zdarzenia zawierają `{ type: "leczenie", amount: hpMax − 1 }`; (b) `validateActions([{ healFull: false }], "x", data)` i `[{ healFull: 1 }]` zwracają błąd; `[{ healFull: true }]` – brak błędów; (c) postać z pełnym HP: zdarzenie `leczenie` z `amount: 0` nie jest dopisywane.
- [ ] **Step 2: Run** `node --test test/actions.test.js` – Expected: FAIL („nieznana akcja healFull”).
- [ ] **Step 3: Implement** w `actions.js`.
- [ ] **Step 4: Run** `timeout 115 npm test` i `node bin/game.js --validate` – Expected: zielone.
- [ ] **Step 5: Commit** `feat(silnik): akcja healFull – pełne leczenie i zdjęcie efektów`.

---

### Task 2: `endsTrip` na zdarzeniu podróży

**Files:** Modify: `src/systems/travel.js` (schemat, `EVENT_KINDS`, walidacja), `src/scenes/trip.js`, `docs/koncepcja-gry.md` (rozdz. 13a, jedno zdanie); Test: `test/travel_system.test.js`, `test/trip.test.js`.

**Interfaces:**
- Produces: `EVENT_KINDS = ["encounter", "attack", "weather", "story"]`; pole zdarzenia `endsTrip: boolean` (tylko dla `scenes`, nie dla `phenomenon`); walidacja: `endsTrip: true` wymaga `weight: 0` i że zdarzenie jest wskazane w `fixed` jakiejś trasy (błąd: `endsTrip bez fixed` / `endsTrip z weight > 0`). `trip.js`: po `playEvent` zdarzenia z `endsTrip` pętla `march` kończy etap bez `finishStage`, obozu i podsumowania; `world.travel.day` ustawione na `daysTotal + 1`, `phase` bez zmian znaczenia; `runTrip` wychodzi z pętli, `waitForDawn` + `endTravel` + powiadomienie o przybyciu jak dotąd.

- [ ] **Step 1: Testy (RED):** (a) `validateTravel` odrzuca `endsTrip: true` z `weight: 1`, odrzuca `endsTrip` na zdarzeniu niewskazanym w `fixed`, akceptuje poprawne; (b) `test/trip.test.js`: trasa testowa 2 dni z `fixed` `"2": "koniec_nocy"` (zdarzenie `endsTrip`, jedna scena narracji): `runTrip` kończy się z `world.location === cel`, `world.travel === null`, `time.minutes % 1440 === departHour × 60`, w powiadomieniach „Docierasz do …”, a dzień 2 nie ma obozu ani podsumowania etapu (ekran obozu nie pojawił się w wyjściu); (c) to samo po zapisie i wznowieniu w trakcie zdarzenia (`eventScene` ustawione) – wynik taki sam; (d) ulewa na dniu 1 (`daysTotal` 3): zdarzenie nadal gra się raz w dniu 2 i kończy podróż.
- [ ] **Step 2: Run** testy – Expected: FAIL.
- [ ] **Step 3: Implement** zmiany w `travel.js` i `trip.js`.
- [ ] **Step 4: Run** `timeout 115 npm test` – Expected: zielone.
- [ ] **Step 5: Commit** `feat(silnik): endsTrip – zdarzenie podróży kończące marsz`.

---

### Task 3: Wróg `upior_nocy`

**Files:** Modify: `data/enemies.json`; Test: `test/combat_data.test.js`, `test/combat_sim.test.js`.

**Interfaces:**
- Produces: wróg `upior_nocy` – kopia `upior_zwiadowca` z `hp` 150, `damageTaken` `{ sieczne: 0.1, klute: 0.1, ogien: 2.0 }`, `xp` 0, `loot: []`, `art: "upior_zwiadowca"`, ataki Szpon (hit 70, obrażenia 6–10, `damageType` `sieczne`, efekt krwawienia) i Wycie (strach), `ai: "aggressive"`, `leap: true`.

- [ ] **Step 1: Test (RED)** w `combat_sim.test.js` (wzór: test „sparing: 200 ziaren” w `combat_scene.test.js`): 200 ziaren × klasy `miecz` i `wlocznia`, walka sceny `{ enemies: [{ id: "upior_nocy", count: 2 }], canFlee: false, onDefeat: "x" }` prowadzona agresywnym graczem (Atak do końca): za każdym razem wynik `defeat`, `combatNext` zwraca `{ goto: "x" }`, HP gracza po walce = 1, brak `DefeatError`; w `combat_data.test.js`: `upior_nocy` przechodzi walidację wrogów.
- [ ] **Step 2: Run** – Expected: FAIL (nieznany wróg).
- [ ] **Step 3: Implement** wpis w `enemies.json`.
- [ ] **Step 4: Run** `timeout 115 npm test` i `--validate` – Expected: zielone.
- [ ] **Step 5: Commit** `feat(dane): wróg upior_nocy – odporny na zwykłą broń`.

---

### Task 4: Prolog – dialogi i sceny przed marszem

**Files:** Create: `data/dialogues/kurier.json`, `delegacja.json`, `towarzysze.json`; Modify: `data/dialogues/kwatermistrz.json` (wzmianka o kurierze), `data/story.json`, `data/ui.json` (jeśli trzeba); Test: `test/dialogue.test.js` (lub nowy `test/story_prolog.test.js`).

**Treść (wiążące elementy; teksty piszemy w stylu z dokumentu):**
- Postacie: Gnieworad (mistrz szkoły, `Hjalmir Gnieworad`), Radogost (instruktor), kurier w czerwonym płaszczu (bezimienny), Skarimir (wesołek, miecz), Ragnosława (zadziorna, włócznia), Wojmir Cienki (nerwowy pisarczyk).
- **`kurier`** (start `przybycie`): kurier czyta Gnieworadowi rozkaz; opcje: *Wymowa 40* „Co tam wiozisz, kurierze?” → sukces: węzeł z treścią („delegacja młodych adeptów do stolicy, imiona wpisane z góry”), akcje `setFlag rozkaz_danina`; porażka: kurier odprawia. *Skradanie 35* „Podsłuchaj ich” (`requires notFlag rozkaz_bez_powrotu`) → sukces: akcje `setFlag rozkaz_bez_powrotu`. Postawa: „Przyjmuję rozkaz.” (`addVar dlug 1`), „Mnie nikt nie pyta?” (`addVar wola 1`), „Bywaj.” (bez zmian) – po jednej opcji wyjścia, każda kończy dialog (`goto end`).
- **`delegacja`** (start `wskazanie`): Gnieworad wskazuje czworo („najmniej ważnych”); opcja *Wymowa 35* „Dlaczego akurat my?” → sukces: `setFlag delegacja_danina`, porażka: Gnieworad ucina; opcja wyjścia.
- **`towarzysze`** (start `brama`): trzy gałęzie rozmowy przy bramie (Skarimir, Ragnosława, Wojmir), każda 2–3 węzły, jedna drobna opcja z `addVar` ±1 (np. pocieszenie Wojmira: `addVar dlug 1` i `setFlag towarzysze_zaufanie`; wyśmianie Skarimira: bez zmian; wyzwanie Ragnosławy: `addVar wola 1`); wyjście „Ruszamy.”.
- **Wstęp (nowe, wiążące):** `start` = `prolog_wstep`; dwie sceny narracji bez testów i zmiennych, bez `time`: `prolog_wstep` (tytuł „Ziemia pod gwiazdami”: cesarstwo i jego porządek – „podatek płacisz, głowy nie podnosisz, o gwiazdach nie gadasz”; spadające gwiazdy, burze iskier i mgły, po których we wsiach ubywa ludzi; urzędnicy piszą „klęski żywiołowe”, chłopi plują przez lewe ramię; bez ujawniania Istoty i długu), `prolog_wstep_wies` (tytuł „Brzezina”: ostatnia wieś przed Pogórzem, szkoła ostrza na skraju, miecz albo włócznia, mistrz Gnieworad; ostatnie zdanie: „Dziś jest zwykły dzień. Tak przynajmniej wygląda od rana.”), po czym `demo_swit`. Każda scena 80–130 słów, styl jak w dokumencie stylu.
- **`story.json`:** kolejność: `prolog_wstep` → `prolog_wstep_wies` → `demo_swit` → `demo_kreator` → `demo_sparing` (+ walka, wygrana/porażka, postawy `var`) → `demo_nagroda` → `prolog_kurier_narracja` (nowa narracja: kurier wjeżdża na plac) → `prolog_kurier` (dialog `kurier`) → `prolog_delegacja` (dialog `delegacja`) → `demo_kram_wstep` → `demo_kram_rozmowa` → `demo_kram` → `prolog_brama` (dialog `towarzysze`) → `prolog_wymarsz` (narracja wymarszu, zastępuje `demo_droga`; bez listu do komendanta) → `demo_podroz` (travel, trasa `brzezina_wilczy_brod`) → reszta bez zmian (zmienia Task 6). Czasy (`time`) tak, by od świtu do wymarszu minął mniej więcej dzień; wymarsz o świcie następnego dnia (podróż i tak czeka do `departHour`).
- Id scen unikalne; nowe flagi bez ogonków.

- [ ] **Step 1: Testy (RED)** (`test/story_prolog.test.js`): `story.start === "prolog_wstep"`, następną sceną jest `prolog_wstep_wies`, potem `demo_swit`; obie to narracje 40–140 słów z tytułem i bez `time`; `--validate`-owe: dialogi `kurier`, `delegacja`, `towarzysze` przechodzą walidację i wszystkie węzły są osiągalne (wzór: testy dialogów w `dialogue.test.js`); logika: w `kurier` sukces testu Wymowy (rng wymuszone `int → 1`) ustawia `rozkaz_danina`, porażka (`int → 100`) nie ustawia, opcja „Przyjmuję rozkaz.” dodaje `dlug`, „Mnie nikt nie pyta?” dodaje `wola`; w `delegacja` sukces ustawia `delegacja_danina`; w `towarzysze` pocieszenie Wojmira ustawia `towarzysze_zaufanie`.
- [ ] **Step 2: Run** testy – Expected: FAIL (brak plików).
- [ ] **Step 3: Napisz** trzy dialogi, korektę `kwatermistrz.json`, sceny w `story.json`.
- [ ] **Step 4: Run** `node bin/game.js --validate` oraz testy z Step 1 – Expected: zielone (pełny zestaw e2e może być czerwony do Task 6 – nie commituj bez Step 5).
- [ ] **Step 5: Adaptuj** czerwone testy (e2e: dwa dodatkowe „Dalej” na początku gry – wstęp; dodaj kroki prologu do skryptów `TO_COURIER`, kroki dialogów kurier/delegacja/brama w trybie liniowym i w TTY; `createAdaptiveIO` nie wymaga zmian dla zwykłych dialogów – odpowiedzi to numery wejść „wyjście”). Run `timeout 115 npm test` – Expected: zielone.
- [ ] **Step 6: Commit** `feat(fabula): prolog – kurier, delegacja, towarzysze`.

---

### Task 5: Akt I – marsz, noc upiorów, przebudzenie

**Files:** Create: `data/dialogues/ognisko.json`, `istota.json`; Modify: `data/travel.json` (zdarzenia `bandyci_na_trakcie` – dodana scena ogniska; nowe `noc_upiorow`; `fixed` dnia 2), `data/story.json` (`demo_kurier` i okolice), `data/ui.json`; Test: `test/story_act1.test.js`.

**Treść:**
- **Ognisko (dzień 1):** do zdarzenia `bandyci_na_trakcie` (weight 0, fixed dzień 1) dopisz scenę `bandyci_ognisko` (dialog `ognisko`) po obu wyjściach z walki (wygrana i ucieczka prowadzą do niej; `bandyci_po_walce`/`bandyci_ucieczka` dostają `goto: "bandyci_ognisko"`, a `bandyci_ognisko` ma `goto: "koniec"`). `ognisko` (start `ogien`): Skarimir żartuje, Ragnosława pyta o rozkazy, Wojmir się boi; odpowiedzi: pocieszenie (`addVar dlug 1`), pyskówka (`addVar wola 1`), milczenie; wyjście „Idziemy spać.”.
- **`noc_upiorow`** (`kind: "story"`, `weight: 0`, `endsTrip: true`), `fixed` dnia 2 trasy `brzezina_wilczy_brod`: sceny: narracja zmierzchu (`time` do wieczora; towarzysze przy ogniu) → `phenomenon` `burza_iskier` → narracja ataku → `combat` (`upior_nocy` ×2, `start: "melee"`, `canFlee: false`, `onDefeat: "noc_omdlenie"`, `minutes` zgodne z regułami) → (po „wygranej”, której nie ma, scena nie jest osiągana; brak `onFlee`) → `noc_omdlenie` narracja (ciemność) → `noc_zaglada` narracja (kolejno Ragnosława, Skarimir, Wojmir; `setFlag towarzysze_zgineli`) → `noc_przebudzenie` dialog `istota` → `noc_swit` narracja (wschód, kierunek na Wilczy Bród, mundur szkoły, `setFlag ukryte_insygnia`) → koniec.
- **`istota`** (start `nadejscie`): węzeł wejściowy z akcją `healFull`; Istota: „Tkanka zrośnięta. Rdzeń sprawny. Dług zaciągnięty. Zniszcz to, co zbudowano na tej ziemi.” (+ druga linia z `requires flag rozkaz_danina`: „Rozkaz cesarza nie był poselstwem.”); opcje: pokorna (`addVar dlug 1`), pytająca „Jaki dług?” (`setFlag pytanie_o_dlug`), buntownicza (`addVar wola 1`); każda ustawia `dlug_istoty` (akcja na węźle wejściowym) i kończy dialog.
- **Świt:** `demo_kurier` przepisana na przybycie ocalałego do strażnicy (komendant Wszebor widzi półżywego adepta; wzmianka o insygniach); reszta scen demo bez zmian.

- [ ] **Step 1: Testy (RED)** (`test/story_act1.test.js`): (a) `--validate`; (b) test przebiegu zdarzenia `noc_upiorow` (przez `runTrip` na ustawionym stanie z postacią obu klas, adaptacyjny sterownik walki `{ fight: "lose" }`): po podróży `flags.towarzysze_zgineli`, `flags.dlug_istoty`, `character.hp === hpMax`, brak efektów, lokalizacja `wilczy_brod`, zegar na świcie; (c) odpowiedzi w `istota`: pokorna +1 `dlug`, buntownicza +1 `wola`, pytająca ustawia `pytanie_o_dlug`; linia „Rozkaz cesarza…” tylko z `rozkaz_danina`; (d) zapis w środku zdarzenia (`eventScene` = `noc_zaglada`) i wznowienie kończą podróż tak samo; (e) ognisko ustawia flagi/zmienne wg odpowiedzi.
- [ ] **Step 2: Run** – Expected: FAIL.
- [ ] **Step 3: Napisz** dialogi `ognisko`, `istota`, zdarzenie, scenę `demo_kurier`.
- [ ] **Step 4: Run** `node bin/game.js --validate` i testy Step 1 – Expected: zielone.
- [ ] **Step 5: Commit** `feat(fabula): akt I – ognisko, noc upiorów, przebudzenie`.

---

### Task 6: Ilustracje prologu i aktu I

**Files:** Create: `data/art/*.pix` (6 portretów, 8 scen – lista w specu, sekcja „Ilustracje”, w tym `wstep_gwiazdy` i `wstep_brzezina` dla wstępu); Modify: `data/dialogues/{kurier,delegacja,towarzysze,ognisko,istota}.json` (`portrait` na rozmowie, per-węzeł tam, gdzie mówca się zmienia), `data/story.json`, `data/travel.json` (`art` na scenach prologu i zdarzeń nocy), `test/e2e.test.js`.

**Interfaces:** Consumes: pola `art`/`portrait` i walidację z E3a. Produces: obrazy `portret_kurier`, `portret_gnieworad`, `portret_skarimir`, `portret_ragnoslawa`, `portret_wojmir`, `portret_istota` (≤ 20×20) oraz `wstep_gwiazdy`, `wstep_brzezina`, `kurier_plac`, `ognisko_druzyna`, `noc_upiory`, `noc_ciemnosc`, `noc_istota`, `swit_ocalaly` (≤ 48×20); istniejące `szkolka`, `kram`, `wymarsz`, `mapa_brod` użyte w scenach prologu.

- [ ] **Step 1: Test (RED)** `test/e2e.test.js`: demo prologu i nocy w TTY 200×50 w kolorze (`setColorsEnabled(true)`, `setRich256(true)`, wzór: test „E3a demo w TTY 200×50”) – co najmniej jedna klatka zawiera `▀`/`▄` w scenie nocnej (po dialogu z Istotą), a w 80×24 żadna klatka prologu nie zawiera półbloków.
- [ ] **Step 2: Run** – Expected: FAIL (brak obrazów w danych).
- [ ] **Step 3: Narysuj** obrazy (skrypt pomocniczy poza repozytorium generuje siatki `.pix`; styl jak w E3a), podepnij pola. Pokaż użytkownikowi arkusz podglądu przed commitem.
- [ ] **Step 4: Run** `timeout 115 npm test` i `node bin/game.js --validate` – Expected: zielone.
- [ ] **Step 5: Commit** `feat(art): ilustracje prologu i aktu I`.

---

### Task 7: Spięcie, sterownik testowy, e2e

**Files:** Modify: `test/helpers.js` (`createAdaptiveIO` – krok `trip` obsługuje zdarzenie nocy), `test/e2e.test.js` (stałe `FULL`, `TO_COURIER`, `FROM_COURIER`, `assertDemoResult`), inne testy zależne od starych ID/scen; `docs/koncepcja-gry.md` (rozdz. 13: status MVP).

**Interfaces:**
- `createAdaptiveIO` krok `{ trip: { fight, accept?, forage?, interruptAt?, techniques?, night? } }` – `night: "lose"` (domyślnie, gdy walka w podróży to `upior_nocy`) odpowiada na ekran walki z upiorami przegraną (`{ fight: "lose" }`) i przechodzi dialog Istoty (pierwsza opcja), narracje i `Dalej`; nie wymaga zmian dla innych zdarzeń.

- [ ] **Step 1: Test (RED)** w `e2e.test.js`: `demo B1 bez TTY` i `demo B1 w trybie TTY` przechodzą od menu do `demo_koniec` z nowym prologiem i nocą (oczekiwane flagi: `klasa_miecz`, `rozkaz_danina` ustawione przez skrypt, `towarzysze_zgineli`, `dlug_istoty`, `combat_demo_sparing_walka_wygrana`; `world.location === "wilczy_brod"`); wariant klasy włóczni (sparing przegrany, ucieczka przed bandytami) dociera do tego samego końca; test zapisu w środku nocy (`^C`, wczytanie, dokończenie) daje ten sam stan co przejście bez przerwy.
- [ ] **Step 2: Run** `node --test test/e2e.test.js` – Expected: FAIL.
- [ ] **Step 3: Implement** zmiany w sterowniku i skryptach e2e; dostosuj asercje (`assertDemoResult`: `dlug`/`wola` wynikają z odpowiedzi skryptu, poziom i perk jak dotąd).
- [ ] **Step 4: Run** `timeout 115 npm test` i `node bin/game.js --validate` – Expected: zielone.
- [ ] **Step 5: Commit** `test(e2e): demo z prologiem i nocą upiorów`.

---

### Task 8: Dokumentacja

**Files:** Modify: `docs/koncepcja-gry.md` (rozdz. 13 – status: prolog i akt I zrealizowane; akt II tymczasowy), `docs/superpowers/specs/2026-10-22-cykl-e2a-prolog-akt1-design.md` (status: wykonany).

- [ ] **Step 1:** Zaktualizuj dokumenty.
- [ ] **Step 2: Run** `timeout 115 npm test` – Expected: zielone.
- [ ] **Step 3: Commit** `docs: status E2a`.
