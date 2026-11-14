# Cykl E2h – „Ulfgród w stanie wojennym” i „Noc długich noży” – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dać Aktowi IV stolicę: hub Ulfgród z dzielnicami, **zasadzkami przed wejściem w miejsce**, zadziornymi dialogami miejskimi, zleceniami i wątkiem „dowód, że nie jestem martwy”, a na końcu scenę **Noc długich noży** (śmierć cesarza, trzy warianty). Cykl kończy się tymczasowym zakończeniem „TO JESZCZE NIE KONIEC” przed lochem (E2i).

**Architecture:** Jedna nowa funkcja silnika (pole spotu `ambush`: losowanie przy wejściu, scena/walka przed sceną miejsca, decyzja zapisana w stanie mapy, żeby wznowienie po zapisie grało tę samą listę scen) plus treść w istniejących szablonach z E2e/E2g (region, hub, lokacje `near`/`far`, `hunt`, wątek `main`, popchnięcie, zdarzenia regionu).

**Tech Stack:** Node.js ≥22, ESM, `node:test`, zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-26-akty-iv-v-design.md` (rozdz. 5 „Ulfgród w stanie wojennym”, „Noc długich noży”, rozdz. 7, uwaga o tonie miasta). Odstępstwa E2g zapisane w `docs/superpowers/plans/2026-10-27-cykl-e2g-ledger.md` (flagi `wojna_beczki_*`, `wojna_dezerterzy_*`).

## Global Constraints
- Zero zależności; id bez diakrytyków; teksty po polsku, ton wytycznych 1/1a, **ale w stolicy zadziorny i cwaniacki** (riposty, targowanie, półsłówka, drwiny z możnych: przekupki, szulerzy, węszyciele, Smyk, Hjalmar „który nic nie widział”); front i Jarnowo zostają surowe.
- Wytyczne `docs/wytyczne-tresci-i-qa.md` w całości, w tym 16 (źródło każdego przedmiotu), 17 (odległości, zdarzenia, pola walki), 18 (wątek główny + popchnięcie), 2.3 (rozliczenie u zleceniodawcy), 1.4 (NPC do pogadania, ≥4 stany), riposta przy porażce w zasadzce.
- Stolica sprzedaje do T3; **T4 nigdy ze sklepu**. Ostrze Gwiazd jest w ekwipunku, więc balans wrogów z Ostrzem i T2–T3 pancerzem.
- Zasadzki **tylko w nowym hubie**: istniejące huby i testy menu nie zmieniają numeracji ani losowań.
- Dowolna zmiana stanu mapy dla zasadzki musi przeżyć zapis/wczytanie (wersja zapisu zostaje 12 albo rośnie z naprawą w `src/engine/save.js`).
- Gałąź `cykl-e2h`; `npm test` i `node bin/game.js --validate` zielone przed każdym commitem; nowe testy przez `git add -f` (katalog `test/` jest w .gitignore).

## Review Focus
1. Zasadzka przy wejściu nie zapętla się, nie gra się drugi raz po wczytaniu zapisu w jej środku i nie powtarza po porażce w nieskończoność (cooldown dobowy); ucieczka i porażka zawsze wracają do menu miejsc.
2. Zasadzka nie blokuje zleceń: wejście do miejsca z celem zlecenia zawsze w końcu dochodzi do sceny miejsca (także po ucieczce).
3. Każdy z trzech wariantów Nocy długich noży (bunt Tomasza, zamach starego żołnierza, pęknięcie paktu) daje `cesarz_nie_zyje` i dokładnie jeden z flag wariantu; gracz bez sojuszy nie traci dostępu do sceny.
4. Wątek główny stolicy zawsze wskazuje następny krok; pałac jest zamknięty do chwili odblokowania i nie da się do niego wejść bokiem (zlecenia, zdarzenia, `reveal`).
5. Wrogowie miejscy są przeżywalni (poziom 4, Ostrze, T2); zasadzka na niskim `search` nie jest zabójcza dla gracza po porażce w poprzedniej.
6. Zadziorny ton nie psuje czytelności: opcje dialogowe mówią, co gracz zrobi (wytyczna 1.5), a żart nie zasłania informacji o zleceniu.

## File Structure
- `src/systems/spots.js` (`rollAmbush`, `ambushScenes`), `src/scenes/map.js` (wejście w spot), `src/engine/data.js` lub walidator spotów (pole `ambush`), `src/engine/state.js`/`save.js` (jeśli nowy stan).
- `data/travel.json` (region `stolica`, hub `ulfgrod`, lokacje, trasy, zdarzenia), `data/maps/stolica.txt`, `data/enemies.json`, `data/loot.json`, `data/art/*.pix`, `data/shops.json`, `data/quests.json`, `data/dialogues/*.json`, `data/story.json`, `data/rules.json` (jeśli nowe zmienne).
- Testy (nowe): `test/ambush.test.js`, `test/capital_hub.test.js`, `test/capital_quests.test.js`, `test/capital_night.test.js`, `test/capital_story.test.js`; dostosowane: `distances.test.js`, `economy.test.js`, `consistency.test.js`, `front_story.test.js`, `helpers.js` (pruneMissingQuests: region `stolica`).

---

### Task 1: Zasadzka przy wejściu w miejsce (silnik)

**Files:** Modify `src/systems/spots.js`, `src/scenes/map.js`, walidator spotów w `src/engine/data.js`; Test `test/ambush.test.js`

**Interfaces:**
- Produces: pole spotu `ambush: { chance: 1–100, if?: condition, scenes: Scene[] }`. `rollAmbush(state, data, locationId, spot, rng) -> boolean` (warunek `if`, szansa `chance`, `search` podnosi szansę przez istniejący mechanizm gracza z `rules.search`, **cooldown: raz na dobę na spot**, zapis w `state.world.ambushes[locationId.spotId] = dzień`). W `map.js` wejście w spot ze `spotScene === null` losuje zasadzkę, zapisuje wynik w `mapState.ambush` (true/false), a lista scen to `[...ambush.scenes, ...spotScenes]`; wznowienie po zapisie używa zapisanego wyniku bez ponownego losowania. Ostatnia scena zasadzki spada w scenę miejsca (`goto` pominięte); porażka w walce zasadzki (`onDefeat`) i ucieczka (`onFlee`) kończą się scenami z `goto: "koniec"` (powrót do menu miejsc).
- Walidacja: `chance` 1–100, `scenes` niepuste, id scen unikalne w całym pliku, `ambush` tylko na spotach typu `talk`/`shop`/`rest`/`scene` (nie `board`, nie `hunt`).

- [ ] **Step 1: Testy (failing):** (a) `chance: 100` → zasadzka gra się przy pierwszym wejściu, drugie wejście tego samego dnia nie; następnego dnia znów; (b) `if` niespełniony → brak; (c) zapis w środku walki zasadzki → po wczytaniu ta sama lista scen, brak ponownego losowania i brak podwójnego czasu; (d) ucieczka i porażka kończą w menu miejsc; (e) walidacja błędnych pól; (f) spot z `board`/`hunt` + `ambush` to błąd; (g) istniejące huby bez `ambush` zachowują się identycznie (cały `npm test` zielony).
- [ ] **Step 2–4:** implementacja, `npm test`, commit `feat(silnik): zasadzka przy wejściu w miejsce huba`.

### Task 2: Region „stolica”, hub Ulfgród i droga z frontu

**Files:** Modify `data/travel.json`, `data/rules.json` (jeśli trzeba), `test/helpers.js`; Create `data/maps/stolica.txt`; Test `test/capital_hub.test.js`

**Interfaces:**
- Produces: region `stolica` (`forage` skąpy: miasto), hub `ulfgrod` („Ulfgród”) ze spotami: `karczma` (talk Hjalmar, „Pod Pękniętym Dzwonem”, pogadanka ≥4 stany), `nocleg` (rest), `tablica_ulfgrod` (board), `sklep_hurtownika` (shop), `smyk_ulica` (talk Smyk). Lokacje `near`: `targ_pod_murem` (30 min), `zaulek_szklarzy` (60), `dom_ciszy` (90), `port_rzeczny` (150), `koszary` (240), `cmentarz_zbiorowy` (360); `palac` (`secret`, `if flag palac_otwarty`, 120 min, spoty dodane w Task 6). Lokacje `far` (≥2, jedna 4 dni, różne dni): `stare_wodociagi` (3 dni), `opuszczony_klasztor` (4 dni). Trasa `oboz_wronia_ulfgrod` (`from oboz_wronia`, `to ulfgrod`, 3 dni, region `front`). Każda lokacja ma ≥2 spoty, ukryte `secret` z `hint` poza pierwszą, każda bliska ≥1 pogadankę (≥4 stany), każde dalekie: pole walki, znalezisko i pogadankę (lint z E2e).
- Mapa tekstowa `stolica.txt` ze znacznikami `{id}` zgodna z czasami marszu (uwaga z recenzji E2g: geometria mapy musi pasować do `near.minutes`).

- [ ] **Step 1: Testy (failing):** istnienie i walidacja; trzy klasy odległości; markery na mapie; trasa 3 dni; `helpers.pruneMissingQuests` obcina region `stolica` w fikstur-testach; hub dopisany do `HUBS` w `distances.test.js`.
- [ ] **Step 2–4:** dane (spoty z placeholderami narracji), commit `feat(stolica): region Ulfgród, hub i lokacje`.

### Task 3: Wrogowie miejscy, zasadzki i pola walki

**Files:** Modify `data/enemies.json`, `data/loot.json`, `data/travel.json`, `test/ambush.test.js`; Create `data/art/*.pix`; Test `test/capital_enemies.test.js`

**Interfaces:**
- Produces: cztery wrogowie: `kieszonkowiec` (cautious, ucieka), `cesarski_weszyciel` (nóż + zatruta igła, `effects` osłabienie), `patrol_miejski` (pałka, hełm; grupa 2), `rzezimieszek_z_portu` (obuchowe, 45 hp). Tabele łupów `lupy_miasto` (T≤3). Zasadzki (`ambush`) na wejściach: `karczma` (kieszonkowcy), `targ_pod_murem` (rzezimieszki), `koszary` (patrol miejski, tylko gdy `search` ≥ 40), `port_rzeczny` (węszyciel + rzezimieszek, tylko po zmroku); każda zasadzka ma ripostę: walka, test `wymowa` (cwana riposta, bez walki), `skradanie` (omiń), ucieczka. Pola walki w pobliżu ≥2 (`cmentarz_zbiorowy.wlamywacze`, `port_rzeczny.przemytnicy`) i po jednym na dalekim miejscu.
- Balans: widełki win-rate z 200 ziaren (poziom 4, Ostrze, `skorznia_nabijana`, `helm_zelazny`): pojedynczy wróg 0,8–1, zasadzka wieloosobowa 0,35–0,9.

- [ ] **Step 1: Testy (failing):** statystyki i grafiki wrogów, łupy bez T4, widełki, każda zasadzka ma ≥3 rozwiązania i riposty; porażka nie zostawia gracza bez wyjścia (Review Focus 1, 5).
- [ ] **Step 2–4:** dane i grafiki (generator `.pix` jak w E2g), commit `feat(stolica): wrogowie miejscy i zasadzki przy wejściach`.

### Task 4: Ludzie i sklepy miasta (zadziorny ton)

**Files:** Modify `data/shops.json`, `data/dialogues/*.json`, `data/travel.json`; Test `test/capital_hub.test.js` (część 2)

**Interfaces:**
- Produces: dialogi `hjalmar` (karczmarz, nic nie widział, ale „wie, kto widział”), `smyk` (przewodnik z ulicy, odkrywa tajne przejścia `reveal`), `przekupka`, `szulerzy` (mini-gra kośćmi jako rzut `check`), `siostra_domu_ciszy`, `kwatermistrz_koszar`; sklepy `sklep_hurtownika` (T2–T3: pancerz, broń, amulety, materiały, 10–15 pozycji), `szklarz` (przedmioty alchemiczne i odłamki, T2–T3), `kantor_portowy` (skupuje materiały dobrze). Każde miejsce w hubie i lokacjach ma kogoś do pogadania (≥4 stany: pora dnia, `zlecenia_stolicy`, `wojna_*` z frontu, `sojusz_*`). Reakcje na flagi frontu: np. Hjalmar wspomina `wojna_most_zerwany`, targowisko komentuje `wojna_beczki_*`.
- Ton: dialogi pisane z ripostami (opcje gracza też mogą być cwane), z przynajmniej jedną pogawędką-zagadką na lokację.

- [ ] **Step 1: Testy (failing):** sklepy w widełkach i bez T4; każda lokacja ma pogadankę ≥4 stany; dialogi mają portrety (wytyczna 5.7, użyj istniejących `portret_*`, brakujące do E3b); żaden węzeł nie jest ślepy; reakcje na min. 3 flagi `wojna_*`.
- [ ] **Step 2–4:** dane i commit `feat(stolica): ludzie, sklepy i dialogi miasta`.

### Task 5: Zlecenia stolicy i wątek „dowód, że nie jestem martwy”

**Files:** Modify `data/quests.json`, `data/dialogues/*.json`, `data/travel.json`, `data/rules.json` (zmienna `zlecenia_stolicy`); Test `test/capital_quests.test.js`

**Interfaces:**
- Produces: ≥8 zleceń `errand` na `tablica_ulfgrod` (`board: true`, po 2 cele, `onStart` z `reveal`), każde z ≥2 rozstrzygnięciami i flagą `stolica_*` (np. `Kto pali w Zaułku Szklarzy`, `Zaginiony skarbnik`, `Wino dla koszar`, `Dług przekupki`, `Cmentarz bez nazwisk`, `List dla marszałka`, `Przemyt z portu`, `Smyk i klucz`); wątek `watek_ulfgrod` (`main`): (1) pogadaj z Hjalmarem i Smykiem, (2) zdobądź dowód, że ocalały jeszcze żyje i widział daninę (dokument/pieczęć z Domu Ciszy lub kwatermistrza koszar, `dowod_zywego`), (3) dostań się do pałacu (`palac_otwarty` po trzech zleceniach stolicy + dowodzie), (4) Noc długich noży. Popchnięcie: Smyk po trzech zleceniach sam przychodzi (`smyk_wola` jako gość).
- Zlecenia stolicy zwiększają `zlecenia_stolicy`; każde `onComplete` zgodne z ekonomią (lint: sześć zleceń nie przewyższa ceny wszystkiego z kuźni).

- [ ] **Step 1: Testy (failing):** każde zlecenie × rozstrzygnięcie kończy się meldunkiem i dokładnie jedną flagą rodziny; dowolna kolejność; wątek zawsze wskazuje krok; pałac zamknięty do `palac_otwarty` (próba `reveal` i wejścia bokiem odbija się); zapis w środku rozmowy nie dubluje nagród (Review Focus 2, 4).
- [ ] **Step 2–4:** dane i commit `feat(stolica): zlecenia i wątek główny stolicy`.

### Task 6: Pałac i Noc długich noży

**Files:** Modify `data/travel.json` (spoty pałacu), `data/dialogues/*.json`, `data/story.json`; Test `test/capital_night.test.js`

**Interfaces:**
- Produces: lokacja `palac` (spoty: `brama_palacu`, `schody_sluzby`, `komnata_tronowa` z ukrytą sceną), dialog `cesarz` (Ragnomir Siwy: starzec, sam, kot, spisuje sny; ostatnie słowa zależą od `wola`, `dlug`, `szklo_wola` i wyborów z frontu `wojna_*`), trzy warianty sceny śmierci: `noc_bunt` (`sojusz_dezerter`: Tomasz otwiera bramy), `noc_zamach` (`sojusz_straznicy`: stary żołnierz), `noc_pekniecie` (bez sojuszy: pakt sam pęka od Ostrza), wybór wariantu według flag (priorytet: bunt, zamach, pęknięcie), każdy ustawia `cesarz_nie_zyje`, dokładnie jedną z `noc_bunt`/`noc_zamach`/`noc_pekniecie` i `akt4b_koniec`. Bohater tylko widzi (bez opcji zabicia cesarza).
- Wejście do pałacu tylko przez wątek (Task 5); `akt4b_koniec` kończy odsłonę `akt4_stolica_mapa` i prowadzi do `akt4b_przejscie` (ending „TO JESZCZE NIE KONIEC”, tymczasowe do E2i).

- [ ] **Step 1: Testy (failing):** trzy warianty skryptowo (flagi sojuszy), priorytet wariantów, gracz bez sojuszy dochodzi do końca, wariant nie blokuje się na braku postaci, ostatnie słowa cesarza różnią się dla `wola` wysokiej i niskiej, żaden węzeł `cesarz` nie jest ślepy (Review Focus 3).
- [ ] **Step 2–4:** dane i commit `feat(stolica): Noc długich noży w trzech wariantach`.

### Task 7: Wpięcie w fabułę, lint, bilans, ledger i recenzja

**Files:** Modify `data/story.json`, `test/front_story.test.js`, `test/consistency.test.js`, `test/economy.test.js`, `test/distances.test.js`, `docs/superpowers/specs/2026-10-26-akty-iv-v-design.md` (nowe nazwy flag E2g); Test `test/capital_story.test.js`; Create `docs/superpowers/plans/2026-10-28-cykl-e2h-ledger.md`

**Interfaces:** `akt4a_przejscie` przestaje być zakończeniem: po wyjeździe kapitana narracja „Droga do Ulfgrodu” → `akt4_stolica_droga` (travel `oboz_wronia_ulfgrod`) → `akt4_stolica_wejscie` (narracja) → `akt4_stolica_mapa` (`map`, hub `ulfgrod`, `arriveAt`, `leaves oboz_wronia`, `starts [watek_ulfgrod]`, `exitWhen akt4b_koniec → akt4b_przejscie`) → odpoczynek/zapis/dzień → `akt4b_przejscie` (ending tymczasowy). Stare zapisy na `akt4a_przejscie` wczytują się (scena zmienia typ, id zostaje, jak w E2g).

- [ ] **Step 1: Testy (failing):** pełna ścieżka od kapitana (`akt4a_koniec`) przez trasę (3 etapy, skryptowo), hub, zlecenia, pałac, do `akt4b_przejscie`; zapis w środku trasy; flagi `stolica_*`, `noc_*`, `dowod_zywego`, `palac_otwarty` czytane lub w `MEMORY` z powodem „odczyt w Akcie IV h–V”; bilans: trzy zlecenia stolicy nie wystarczą na całość T3 ze sklepu, osiem tak.
- [ ] **Step 2–4:** zmiany, pełny `npm test`, `node bin/game.js --validate`, ręcznie `node bin/game.js --scene akt4_stolica_wejscie`; ledger; recenzja końcowa (świeży recenzent, najmocniejszy model, z Review Focus); jedna runda poprawek z testami; commit.

---

## Self-review
- **Pokrycie specu:** hub z dzielnicami, zasadzki przy wejściu (Task 1+3), ton miasta (Task 4), Noc długich noży w 3 wariantach (Task 6), sklepy T3 bez T4 (Task 4), wątek główny (Task 5). Loch, Pełnomocnik, pojedynki i „Dług spłacony” to E2i; Jarnowo to E2j.
- **Spójność nazw:** `ulfgrod`, `watek_ulfgrod`, `zlecenia_stolicy`, `palac_otwarty`, `dowod_zywego`, `cesarz_nie_zyje`, `noc_bunt`/`noc_zamach`/`noc_pekniecie`, `akt4b_koniec`, `akt4_stolica_*` jednolicie.
- **Ryzyka:** skala (≈8 zleceń, 3 klasy lokacji, 4 wrogów, ~10 dialogów) – treść pisana generatorami jak w E2g; zasadzka w silniku to jedyna zmiana wspólna, chroniona testem (g) o niezmienionych hubach.
