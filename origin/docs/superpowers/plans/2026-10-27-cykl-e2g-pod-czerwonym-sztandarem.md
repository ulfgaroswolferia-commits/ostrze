# Cykl E2g – „Pod czerwonym sztandarem” (front Aktu IV) – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dać Aktowi IV pierwszy hub: front wojny cesarstwa z Jarnowianami (obóz, 6 bliskich miejsc, 1 dalekie), z sześcioma zleceniami „liść”, których skutki zapisują się we flagach `wojna_*`, nowymi wrogami ludzkimi, sklepami, wątkiem głównym i wejściem po zamknięciu Aktu III. Cykl kończy się tymczasową sceną „To jeszcze nie koniec” (wymieni ją E2h – stolica).

**Architecture:** Dane i szablony z cyklu E2e (huby, `hunt`, `far`, `main`, popchnięcia, zdarzenia regionu) plus jedna nowa zmienna fabularna `zlecenia_frontu` (licznik rozliczonych zleceń). Silnik bez zmian poza dopisaniem zmiennej w `rules.json`.

**Tech Stack:** Node.js ≥22, ESM, `node:test`, zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-26-akty-iv-v-design.md` (rozdz. 5 „Pod czerwonym sztandarem”, 7, 8: cykl E2g).

## Global Constraints
- Zero zależności; id bez diakrytyków; teksty po polsku, ton wytycznych 1/1a (rubaszny, krótki, bez patosu, bez współczesnych słów).
- Wytyczne `docs/wytyczne-tresci-i-qa.md` w całości, w tym: 16 (źródło każdego przedmiotu), 17 (odległości, zdarzenia, pola walki), 18 (wątek główny + popchnięcie), 2.3 (rozliczenie u zleceniodawcy), 1.4 (NPC do pogadania z ≥4 stanami).
- Bohater jest „liściem na wietrze”: żadne zlecenie nie wybiera strony wojny; każde ma co najmniej dwa rozstrzygnięcia i ustawia flagę `wojna_*`.
- Stopnie: front sprzedaje do T3; T4 nigdy ze sklepu. Ostrze Gwiazd (T4) jest już w ekwipunku gracza, więc balans wrogów sprawdzać z nim.
- Gałąź `cykl-e2g`; `npm test` i `node bin/game.js --validate` zielone przed każdym commitem; nowe testy przez `git add -f`.

## Review Focus
1. Każde zlecenie „liść” da się dokończyć w każdym wariancie rozstrzygnięcia i w dowolnej kolejności (żadne nie utyka, flagi `*_zrobione`/`*_zameldowane` czytane).
2. Wątek główny frontu zawsze wskazuje następny krok; po trzech zleceniach kapitan oferuje wyjście do stolicy, ale nie wymusza go (gracz może zrobić więcej).
3. Zapis w środku podróży z Obserwatorium i w środku dialogu rozstrzygającego zlecenie wznawia się bez dublowania nagród.
4. Wrogowie frontu są przeżywalni z Ostrzem i T2 pancerzem (nie zabijają postaci na poziomie 4 w widełkach z testu).
5. Sojusznicy (Tomasz, wędrowcy, stary żołnierz) pojawiają się tylko przy odpowiedniej fladze; ich brak nie blokuje zleceń.

## File Structure
- `data/travel.json`: region `front`, hub `oboz_wronia`, lokacje, trasy, zdarzenia frontu; `data/maps/front.txt`; `data/rules.json` (`vars`: + `zlecenia_frontu`).
- `data/enemies.json`, `data/loot.json`, `data/art/*.pix`; `data/shops.json`; `data/quests.json`; `data/dialogues/*.json` (kapitan, medyczka, cameos, rozstrzygnięcia); `data/story.json`.
- Testy (nowe): `test/front_hub.test.js`, `test/front_enemies.test.js`, `test/front_quests.test.js`, `test/front_story.test.js`; dostosowane: `act3_close.test.js`, `distances.test.js`, `economy.test.js`, `consistency.test.js`.

---

### Task 1: Region „front”, hub Obóz na Wroniej Górze i trasa z Obserwatorium

**Files:** Modify `data/travel.json`, `data/rules.json`; Create `data/maps/front.txt`; Test `test/front_hub.test.js`

**Interfaces:**
- Produces: region `front` (`forage`: jagody, grzyby, orzechy, ziola_lesne), hub `oboz_wronia` („Obóz na Wroniej Górze”), lokacje: `przeprawa_szarej` (30 min), `pole_bitwy` (90), `spalona_wies` (120; „Skjeldowo, pogorzelisko”), `ruiny_fortu` (via `przeprawa_szarej`, 150), `oboz_cesarski_przedni` (300), `oboz_jarnowian_przedni` (360, `danger 4`), dalekie `wzgorze_wisielcow` (`far`, trasa `oboz_wronia_wzgorze` 3 dni), trasa `obserwatorium_front` (3 dni, region `gwiazdy`, z `obserwatorium` do `oboz_wronia`), zmienna `zlecenia_frontu` w `rules.vars`.
- Spoty hubu (szkielety; treść w Task 3): `namiot_sztabu` (talk `kapitan`), `kantyna` (shop `kantyna_frontowa`), `kuznia_polowa` (shop `kuznia_polowa`), `lazaret` (rest + talk `medyczka`), `ognisko` (pogadanka ≥4 stanów), `tablica_front` (board), `tomasz_ognisko` (talk `tomasz_front`, `if sojusz_dezerter`), `wedrowcy_lazaret` (scene, `if sojusz_wedrowcy`).

- [ ] **Step 1: Testy (failing)** `test/front_hub.test.js`: region i hub istnieją, `validateData` czyste; trzy klasy odległości (bliskie ≤60: `przeprawa_szarej`; średnie 90–480: reszta; `far`); marker `{id}` każdej lokacji na `data/maps/front.txt`; trasa `obserwatorium_front` ma 3 dni i `from`/`to` zgodne; zmienna `zlecenia_frontu` w `rules.vars`; wszystkie lokacje ukryte (`secret`) poza hubem i `przeprawa_szarej`, z podpowiedzią; każda lokacja ma co najmniej 2 miejsca; hub ma spoty z listy.
- [ ] **Step 2: Uruchom**, FAIL.
- [ ] **Step 3: Dopisz dane** (mapa tekstowa w stylu reszty, opisy z nutą wojny: dym, wrony, rozdeptane pole, flagi z czerwonym płótnem; grafiki lokacji reużywają istniejące `.pix` jako placeholder do E3b).
- [ ] **Step 4: Uruchom** `npm test` i `--validate`; commit `feat(front): region, hub Obóz na Wroniej Górze i trasa z Obserwatorium`.

### Task 2: Wrogowie frontu, łupy, grafiki

**Files:** Modify `data/enemies.json`, `data/loot.json`; Create 6 plików `data/art/*.pix`; Test `test/front_enemies.test.js`

**Interfaces:**
- Produces: wrogowie `jarnowski_strzelec` (rusznica, `range far`, `damageType palne`, `ai ranged`, hp 24), `jarnowski_kowal` (młot, obuchowe, hp 34, armor 2), `jarnowski_zwiadowca` (hp 26, szybki), `cesarski_pikinier` (hp 36, armor 3, `reduction.sieczne 25`), `cesarski_kusznik` (`range far`, klute, hp 22), `szabrownik` (hp 20, `cautious`, morale 40); tabele łupów `lupy_front_cesarski`, `lupy_front_jarnowski` (T2–T3, w tym `pistolet_wojskowy`, `rusznica` z małą wagą), `lupy_pole_bitwy`.

- [ ] **Step 1: Test (failing):** 6 wrogów z `art`, `nameAcc`, `loot` (ludzie z `giveRandom`); symulacja 200 ziaren z Ostrzem Bogdana i pancerzem T2 (`skorznia_nabijana`, `helm_zelazny`) postaci poziomu 1 (helper `combatState` + wyposażenie): pojedynczy wróg wygrywa ≥ 80%, grupa 3 wrogów 40–85%, mieszana (kusznik + 2 pikinierów) 25–70%; wszystkie tabele łupów używane (lint ekonomii).
- [ ] **Step 2: Uruchom**, FAIL. **Step 3:** dopisz wrogów, tabele i 6 grafik `.pix` (40×16, generowane skryptem jak w E2e), strojenie statystyk do widełek. **Step 4:** `npm test`; commit `feat(front): sześciu wrogów frontu z łupem i grafikami`.

### Task 3: Sklepy, NPC, pogadanki, cameos i popchnięcia

**Files:** Modify `data/shops.json`, `data/travel.json`; Create `data/dialogues/kapitan.json` (szkielet, treść w Task 4), `medyczka.json`, `tomasz_front.json`, `furman_lubomir` (pogadanka jako scena z 4 stanami), `wedrowcy_front.json`; Test `test/front_hub.test.js` (część 2)

**Interfaces:**
- Produces: sklepy `kantyna_frontowa` (12 pozycji: mikstury, odtrutka, amunicja, rzucane) i `kuznia_polowa` (12 pozycji T2–T3, bez T4), spot `ognisko` (4 stany), `medyczka` (lazaret: odpoczynek i rozmowa; reakcja na `wojna_ranni_*`), cameos zależne od flag sojuszy, wizyta-popchnięcie `kapitan_wola` (hub, niewymuszona) gdy `zlecenia_frontu ≥ 3` i `akt4a_koniec` nie ustawione.

- [ ] **Step 1: Testy (failing):** sklepy 10–15 pozycji, bez T4, T3 tylko w kuźni; hub ma ≥1 broń, pancerz, amulet i miksturę w sklepach frontu; `ognisko` ma ≥4 sceny stanów; cameos widoczne tylko z flagą (`sojusz_dezerter`/`sojusz_wedrowcy`); wizyta `kapitan_wola` spełnia warunek tylko po trzech zleceniach.
- [ ] **Step 2–4:** dane i dialogi (rubaszni markietanci, ranni, żołnierze; Tomasz mówi, kogo z dwóch dezerterów podejrzewa), commit `feat(front): kantyna, kuźnia, lazaret, pogadanki i sojusznicy w obozie`.

### Task 4: Zlecenia „liść”, kapitan, wątek główny, pola walki i dalekie miejsce

**Files:** Modify `data/quests.json`, `data/travel.json`, `data/dialogues/kapitan.json`; Create dialogi rozstrzygnięć; Test `test/front_quests.test.js`

**Interfaces:**
- Produces: zlecenia (`kind errand`, `hub oboz_wronia`, `board: true`, każde z 2 celami: rozstrzygnięcie w miejscu i meldunek w `oboz_wronia.namiot_sztabu`), po meldunku `addVar zlecenia_frontu +1`:
  1. **Żołd dla garnizonu** (`ruiny_fortu.brama_fortu`): garnizon fortu nie dostał żołdu od trzech miesięcy i zbliża się bunt; bohater wiezie skrzynię ze sztabu. Dowieźć w całości, zatrzymać prowizję (`dlug`) albo oddać skrzynię prosto garnizonowi, mimo rozkazu. Flagi `wojna_fort_trzyma` / `wojna_fort_oslabiony` (garnizon rozchodzi się do domów) / `wojna_fort_zbuntowany`.
  2. **Most, którego nikt nie pilnuje** (`przeprawa_szarej.most`): obstawić (wymowa/siła), zostawić, spalić. `wojna_most_stoi` / `wojna_most_pusty` / `wojna_most_spalony`.
  3. **Furman z beczkami** (`oboz_jarnowian_przedni.ognisko_jarnowian`): dowieźć cesarskim, zatopić, sprzedać Jarnowianom. `wojna_proch_cesarski` / `wojna_proch_zatopiony` / `wojna_proch_jarnowski`.
  4. **Studnia pod Skjeldowem** (`spalona_wies.studnia`): oczyścić (medycyna), zasypać, zignorować. `wojna_studnia_czysta` / `wojna_studnia_zatruta`.
  5. **Rannych się nie liczy** (`pole_bitwy.pole`): wynieść (z wędrowcami łatwiej), wynieść tylko swoich, zostawić. `wojna_ranni_uratowani` / `wojna_ranni_porzuceni`.
  6. **Dwóch dezerterów, jeden szpieg** (`oboz_cesarski_przedni.namiot_oficera`): wydać jednego, drugiego albo żadnego (z Tomaszem łatwiej). `wojna_szpieg_zdemaskowany` / `wojna_szpieg_wolny`.
  Wątek `watek_front` (`main: true`): „Zgłoś się u kapitana Bratosława” (flaga `kapitan_poznany`) → „Wykonaj zlecenia sztabu (co najmniej trzy)” (`zlecenia_frontu ≥ 3`) → „Ruszaj do Ulfgrodu” (`akt4a_koniec`, ustawiana opcją „Ruszam do stolicy” u kapitana po trzech zleceniach). Koniec aktu zamyka wątek (wzorzec z E2e). Pola walki: `pole_bitwy.szabrownicy`, `oboz_jarnowian_przedni.straz`, `ruiny_fortu.baszta`; dalekie `wzgorze_wisielcow` (hunt, znalezisko, pogadanka).

- [ ] **Step 1: Testy (failing)** `test/front_quests.test.js`: na prawdziwych danych dla każdego z 6 zleceń i każdego rozstrzygnięcia: symulacja (akcje węzłów) kończy zlecenie z nagrodą u kapitana, ustawia dokładnie jedną flagę `wojna_*` z danego zestawu, `zlecenia_frontu` rośnie o 1; zlecenia można robić w dowolnej kolejności; wątek główny prowadzi wskazaniami do `akt4a_koniec`; opcja „Ruszam do stolicy” niedostępna przed trzema zleceniami; wszystkie flagi `*_zrobione`/`*_zameldowane` są czytane; sojusznicy skracają trudność tylko dodatkową opcją, bez blokad.
- [ ] **Step 2–4:** dane i dialogi z ripostami na porażki testów (wytyczna 1.2) i rozliczeniem u kapitana (2.3); commit `feat(front): sześć zleceń „liść” z flagami wojny, kapitan i wątek główny`.

### Task 5: Zdarzenia na drogach frontu

**Files:** Modify `data/travel.json`; Test `test/front_hub.test.js` (część 3)

**Interfaces:** ≥ 10 zdarzeń z `if region front` (ataki z nowymi wrogami, znaleziska `lupy_pole_bitwy`, kantynier-handlarz z `wedrowny_front`, pogadanka z jeńcem, jedna sytuacja moralna z `wola`/`dlug`); region `front` ma ≥ 12 dostępnych zdarzeń; podróż `obserwatorium_front` losuje zdarzenia regionu `gwiazdy` i fabularne (bez `fixed`).

- [ ] **Step 1–4:** testy strukturalne i symulacja 200 podróży (średnio ≥ 1,5 zdarzenia), dane, commit `feat(front): dziesięć zdarzeń na drogach frontu`.

### Task 6: Wpięcie w fabułę, testy zbiorcze i lint

**Files:** Modify `data/story.json`, `test/act3_close.test.js`, `test/consistency.test.js` (`MEMORY`: flagi `wojna_*`, `kapitan_poznany` z powodem „odczyt w Akcie IV h–V”), `test/economy.test.js`, `test/distances.test.js` (front jako czwarty hub); Test `test/front_story.test.js`

**Interfaces:** `akt3b_przejscie` staje się narracją zamykającą Akt III (bez „To jeszcze nie koniec”); dalej `akt4_droga` (`travel`, trasa `obserwatorium_front`), `akt4_wejscie` (narracja „Pod czerwonym sztandarem”), `akt4_mapa` (`map`, `hub oboz_wronia`, `arriveAt`, `leaves obserwatorium`, `starts [watek_front]`, `exitWhen akt4a_koniec → akt4a_przejscie`), `akt4_odpoczynek`/`akt4_zapis`, `akt4a_przejscie` (`ending`, „TO JESZCZE NIE KONIEC”, tymczasowe).

- [ ] **Step 1: Testy (failing):** pełna ścieżka od `akt3b_final` przez kuźnię, trasę (3 etapy, skryptowo bez zdarzeń) i hub do `akt4a_przejscie`; zapis w środku trasy wznawia się; `validateData` czyste; stare zapisy ustawione na `akt3b_przejscie` jako ending wczytują się (scena zmienia typ, id zostaje); lint ekonomii i odległości obejmują front.
- [ ] **Step 2–4:** zmiany `story.json` i testów; commit `feat(fabuła): Akt IV zaczyna się na froncie`.

### Task 7: Bilans, balans, ledger i recenzja

- [ ] **Step 1:** `test/front_story.test.js`: zarobki frontu pokrywają T3 pas/półpancerz dopiero po kilku zleceniach (bilans), poziom postaci po trzech zleceniach ≥ 5 wg XP z zadań.
- [ ] **Step 2:** pełny `npm test`, `--validate`, ręcznie `node bin/game.js --scene akt4_wejscie`.
- [ ] **Step 3:** ledger `docs/superpowers/plans/2026-10-27-cykl-e2g-ledger.md`, recenzja końcowa (świeży recenzent na najmocniejszym modelu z Review Focus), jedna runda poprawek z testami, commit.

---

## Self-review
- **Pokrycie specu:** hub frontu, 5 miejsc + dalekie, 6 zleceń „liść” z flagami `wojna_*`, nowi wrogowie ludzcy, sojusznicy z Aktu III (Task 3–4), wejście z Aktu III (Task 6). Napady przy wejściach do miejsc to E2h (stolica).
- **Spójność nazw:** `oboz_wronia`, `watek_front`, `zlecenia_frontu`, `akt4_*`, `akt4a_koniec`, `wojna_*` jednolicie.
- **Proporcje:** treść dialogów zostaje autorowi; widełki balansu w Task 2 i 7.
