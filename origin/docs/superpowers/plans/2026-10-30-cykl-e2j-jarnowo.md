# Cykl E2j – „Przystań Jarnowo” i „Brama z wiru” – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Otworzyć Akt V: przeprawa z Ulfgrodu na wyspę, hub Przystań Jarnowo (stocznia, kuźnie, Cmentarz Łodzi, obóz hetmana, Dom z Czarnego Szkła), zlecenia z sojusznikami z Aktów III–IV (z wersjami zastępczymi), rozmowa z hetmanem Skjeldomirem i **zlecenie kluczowe „Brama z wiru”** na podejściu do Łysej Skały, gdzie gracz decyduje, czy rozbroić portal (dokładnie jedna z flag `portal_rozbrojony` / `portal_sprawny`). Cykl kończy się tymczasowym „TO JESZCZE NIE KONIEC” u stóp siedziby Istoty (E2k).

**Podział Aktu V (zatwierdzony przez użytkownika 2026-10-30):** E2j = Jarnowo + hetman + Brama z wiru; E2k = Wir na Łysej Skale (walki ze świtą, **obowiązkowe starcie z Istotą w obu wynikach**), koniec wojny, dwa zakończenia. Brama stoi na podejściu do Łysej Skały, siedziba Istoty wyżej: E2k zaczyna się bez nowej podróży („wchodzisz wyżej”). Istota nie reaguje na majstrowanie przy bramie, bo urządzenie pracuje samo, a ona czeka w wirze (jedno zdanie w scenie Bramy).

**Architecture:** Bez nowej mechaniki silnika. Region `jarnowo` jak front i stolica (hub, lokacje `near`, dwie lokacje `far`, zdarzenia regionu, zlecenia `board`, wątek `main`, popchnięcie). Przeprawa `ulfgrod_jarnowo` (scena `travel`, region trasy `jarnowo`, zdarzenia morskie). Decyzja o portalu w spocie lokacji dalekiej `lysa_skala` z potwierdzeniem i opcją „jeszcze nie teraz”.

**Tech Stack:** Node.js ≥22, ESM, `node:test`, zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-26-akty-iv-v-design.md` (rozdz. 4, 5 Akt V pkt 1–2, 6–8). Odstępstwa wcześniejszych cykli: ledgery E2g, E2h, E2i. Recenzja planu (Opus, 2026-10-30): uwagi K1–K4, W1–W13 wprowadzone niżej.

## Global Constraints
- Zero zależności; id bez diakrytyków; ton wytycznych 1/1a. Jarnowo: surowo i wojskowo (stocznia, kuźnie, smoła, rusznice), z suchym humorem zmęczonych ludzi; ostatnia scena cyklu cichnie.
- Tło: Wsiewłod właśnie odparł najazd, bohater płynie na wyspę wroga. Przyjmują go, bo przypływa z listem od marszałka/kapitana jako „człowiek, który nie nosi barw” (jedno zdanie w `akt5_wejscie`), a hetman chce wiedzieć, co się stało w Ulfgrodzie.
- Wytyczne `docs/wytyczne-tresci-i-qa.md` w całości (sekcja „Zgodność” niżej).
- Sklepy do T3, **T4 nigdy ze sklepu**. Balans na poziomie 5–6, obie klasy, **oba warianty Ostrza** (Bogdana i surowe). Docelowy poziom po wyspie: ≥ 6 (test XP: zlecenia + pola walki).
- Brak zabijania gracza: ataki i pola walki mają ucieczkę i `onDefeat` (HP 1).
- **Hetman nie walczy z bohaterem w E2j** (kończy wojnę w E2k). Wrogowie wyspy: istniejący Jarnowianie (`jarnowski_strzelec`, `jarnowski_kowal`, `jarnowski_zwiadowca`) w zdarzeniach i polach walki + nowy `straznik_wiru` (technologiczna straż przy Bramie) + nowy `szabrownik_wrakow` (dalekie wraki).
- Ostrze rani istoty przybyszów przez `damageType: "gwiezdne"` i `damageTaken`/`reduction` wroga (nie ma „tagu przybysza”).
- Gałąź `cykl-e2j`; `npm test` i `node bin/game.js --validate` zielone przed każdym commitem; nowe testy przez `git add -f`.
- Flagi: `jarnowo_*` (skutki zleceń), `jarnowo_dowod` (zapis ze szkła w Domu z Czarnego Szkła), `hetman_rozmowa`, `hetman_przekonany` (rozmowa z dowodem), `portal_rozbrojony`, `portal_sprawny`. Czytane w E2j albo wpisane do `MEMORY` z adnotacją „E2k”. Z `MEMORY` zdjąć to, co E2j już czyta: `istota_wyrok`, `istota_przetarg`, `istota_zwloka`, `dlug_splacony`.

## Review Focus
1. Decyzja o portalu: przed nią potwierdzenie i opcja „jeszcze nie teraz” (bez flagi); wybór ustawia dokładnie jedną flagę, raz; wczytanie zapisu w jej środku nie daje obu; porażka albo ucieczka ze `straznik_wiru` przed Bramą nie ustawia flagi i nie blokuje powrotu; z aktu nie da się wyjść bez decyzji.
2. Każde zlecenie ma ≥2 rozstrzygnięcia bez rzutu i bez warunku, nie blokuje się po porażce, rozliczenie u zleceniodawcy (2.3); `zlecenia_jarnowa` liczy rozstrzygnięte; **bez żadnego sojusznika dostępne są ≥3 zlecenia** (wersje zastępcze), więc wątek nie utyka.
3. Teksty nie zakładają sojuszników i wyborów, których gracz mógł nie zrobić (Hieronim tylko pod `sojusz_astrolog`, Tomasz pod `sojusz_dezerter`, wędrowcy pod `sojusz_wedrowcy`, stary żołnierz pod `sojusz_straznicy`, `wojna_*` pod własną flagą); gracz bez żadnej flagi ma spójny przebieg; ton ostrzejszy pod `istota_wyrok`.
4. Hetman: jedno wejście (spot `namiot_hetmana` w lokacji `oboz_hetmana`), rozmowa dostępna bez dowodu, z `jarnowo_dowod` daje `hetman_przekonany`; przejście Smyka to skrót do namiotu bez progu zleceń; brak ślepych węzłów; hetman żyje na starcie E2k.
5. Wyspa zamknięta przed `dlug_splacony`; nie da się wrócić do lochu ani stolicy; po Akcie IV nie ma upiorów (zdarzenia `noc_upiorow`, `bandyci_na_trakcie`, `pielgrzym`, `wilki` i miejskie nie losują się na wyspie ani na morzu); stare zapisy na `akt4c_przejscie` (dawniej zakończenie) wczytują się; zapis w środku przeprawy wznawia się.
6. Zamknięcie huba decyzją o portalu: otwarte zlecenia Jarnowa przepadają z ostrzeżeniem w potwierdzeniu (wzorzec wyjazdu z frontu, E2g).

## Zgodność z wytycznymi
1.2 riposty przy porażce testu; 1.3 krótkie wstępy; 1.4 pogadanka ≥4 stany w każdej lokacji (w dalekich też); 1.5 opcje mówią, co gracz robi; 2.1 warunki na flagach; 2.3 rozliczenie u zleceniodawcy; 5.1 brak utknięcia; 5.2 niezawodne odkrycie Domu z Czarnego Szkła i Łysej Skały bez sojuszników (`reveal` z wątku); 5.4 popchnięcie (gość po 3 zleceniach); 5.7 mapa zgodna z czasami; 5.13 lint spójności; 5.15 grafiki miejsc i portret hetmana szkicem albo jawnie odłożone do E3b; 16 źródła przedmiotów; 17 odległości, ≥12 zdarzeń regionu, ≥2 pola walki; 18 wątek główny.

## File Structure
- `data/travel.json` (region `jarnowo`, hub `przystan_jarnowo`, lokacje, trasy `ulfgrod_jarnowo`, `jarnowo_lysa_skala`, `jarnowo_wraki`, zdarzenia ≥12, ograniczenia regionów dla zdarzeń ogólnych), `data/maps/jarnowo.txt`, `data/shops.json`, `data/enemies.json` (+2), `data/loot.json`, `data/art/*.pix`, `data/dialogues/` (hetman, stoczniowiec, kowal wyspy, Brygida na wyspie, rozstrzygnięcia, `brama_z_wiru`), `data/quests.json` (zlecenia + `watek_jarnowo`), `data/story.json` (`akt5_*`), `data/rules.json` (`zlecenia_jarnowa`).
- Testy (nowe): `test/jarnowo_hub.test.js`, `test/jarnowo_quests.test.js`, `test/jarnowo_story.test.js`; dostosowane: `distances`, `economy`, `consistency`, `graph`, `capital_story`, `loch_story` (`akt4c_przejscie` przestaje być zakończeniem), `act3_close`, `travel_geometry`, `travel`, `data`, `enemies_e2e`, `helpers.pruneMissingQuests`.

---

### Task 1: Region, hub, lokacje i przeprawa
**Files:** `data/travel.json`, `data/rules.json`, `test/helpers.js`, `data/maps/jarnowo.txt`; Test `test/jarnowo_hub.test.js`
**Interfaces:** region `jarnowo`; hub `przystan_jarnowo`: `karczma_stoczniowa` (talk, pogadanka ≥4 stany), `nocleg`, `tablica_jarnowo` (board), `sklep_stoczni` (shop). Lokacje `near`: `stocznia` (≤60), `kuznie` (≤60), `cmentarz_lodzi` (90–480), `oboz_hetmana` (90–480, spot `namiot_hetmana`), `dom_czarnego_szkla` (90–480, `secret` + `hint`, ujawniany przez wątek). Lokacje `far`: `wraki_floty` (2 dni, trasa `jarnowo_wraki`: pole walki, znalezisko, pogadanka, `secret`+`hint`+`reveal`) i `lysa_skala` (3 dni przeprawą łodzią, trasa `jarnowo_lysa_skala`: pole walki ze `straznik_wiru`, znalezisko, pogadanka ≥4 stany, spot `brama`; `secret`+`hint`, `reveal` z wątku). Trasa `ulfgrod_jarnowo` (3 dni, region `jarnowo`). Hub w `HUBS` w `distances.test.js`; mapa zgodna z czasami.
- [ ] Testy (failing), dane, commit.

### Task 2: Wrogowie, zdarzenia, pola walki
**Files:** `data/enemies.json`, `data/loot.json`, `data/travel.json`, `.pix`; Test `test/jarnowo_hub.test.js`
**Interfaces:** `straznik_wiru` (`morale: null`, osłabienia), `szabrownik_wrakow`; tabela `lupy_wyspa` (T≤3). ≥12 zdarzeń z `region: jarnowo` (morskie i wyspiarskie: ataki z ucieczką i `onDefeat`, znaleziska, ludzie, handlarz, sytuacja moralna); zdarzenia ogólne `noc_upiorow`, `bandyci_na_trakcie`, `pielgrzym` ograniczone do regionów aktów I–III, `wilki` bez wyspy. ≥2 pola walki w hubie. Symulacje 200 ziaren: obie klasy × oba Ostrza.
- [ ] Testy (w tym „własnych ≥12, bez upiorów, wilków i patroli miejskich na wyspie/morzu”), dane, commit.

### Task 3: Ludzie i sklepy wyspy
**Files:** dialogi `hetman`, `stoczniowiec`, `kowal_wyspy`, `brygida_wyspa`; `data/shops.json`; Test `test/jarnowo_hub.test.js`
**Interfaces:** hetman Skjeldomir: oś rozmowy „wojna to mój pomysł” (spec), węzeł bez dowodu (`hetman_rozmowa`) i z `jarnowo_dowod` (zapis podważa jego pewność → `hetman_przekonany`); ton ostrzejszy pod `istota_wyrok`, ostrożny pod `istota_przetarg`. Brygida przypływa zawsze (kuła albo widziała Ostrze), Hieronim w wariancie pod `sojusz_astrolog`. Smyk jako gapowicz na łodzi (pod `palac_otwarty`, który ma każdy gracz). Rozmowy bez ślepych węzłów; sklepy 8–15 pozycji, ≤ T3.
- [ ] Testy, dane, commit.

### Task 4: Zlecenia i wątek
**Files:** `data/quests.json`; `rozstrzygniecie_*`; Test `test/jarnowo_quests.test.js`
**Interfaces:** zlecenia z tablicy (każde z wersją bazową bez sojusznika): „Łódź bez załogi” (Cmentarz Łodzi, proch), „Kowal i jego rusznice” (kuźnie), „Wieści z lądu” (warianty nadawcy: Tomasz / wędrowcy / stary żołnierz, bazowo list od komendanta Wszebora), „Przejście Smyka” (skrót do namiotu hetmana), „Rozpoznanie urządzenia” (Brygida zawsze, Hieronim pod `sojusz_astrolog`; ujawnia Łysą Skałę). Dom z Czarnego Szkła: Ostrze rezonuje ze szkłem i odsłania zapis rozmów Istoty z hetmanem (`jarnowo_dowod`). Każde ≥2 rozstrzygnięcia bez rzutu; flagi `jarnowo_*`; `zlecenia_jarnowa` liczy rozstrzygnięte. `watek_jarnowo` (main): znajomi → ≥3 zlecenia → rozmowa z hetmanem → Brama z wiru; popchnięcie po 3 zleceniach.
- [ ] Testy (w tym „bez sojuszników ≥3 zlecenia”), dane, commit.

### Task 5: Brama z wiru
**Files:** `data/dialogues/brama_z_wiru.json`; `data/travel.json` (spot `lysa_skala.brama`); Test `test/jarnowo_story.test.js`
**Interfaces:** opis urządzenia (zależny od rozpoznania i od `istota_*`), potwierdzenie (ostrzeżenie o otwartych zleceniach), wybór „rozbrój” / „zostaw sprawne” / „jeszcze nie teraz” (bez flagi); flaga portalu ustawiana raz (`if` na braku obu).
- [ ] Testy (obie ścieżki, „jeszcze nie teraz”, brak dwóch flag, wznowienie po zapisie, porażka ze strażą), dane, commit.

### Task 6: Wpięcie, lint, bilans, ledger, recenzja
**Interfaces:** `akt4c_przejscie` (ending) → narracja → `akt5_droga` (travel `ulfgrod_jarnowo`) → `akt5_wejscie` → `akt5_mapa` (hub `przystan_jarnowo`, `leaves: loch_pod_palacem`, `starts: watek_jarnowo`, `exitWhen any portal_*` → `akt5a_przejscie`) → `akt5a_przejscie` (ending tymczasowy). Stare zapisy na `akt4c_przejscie` wczytują się.
- [ ] Testy przebiegu od `dlug_splacony` do `akt5a_przejscie` (oba wyniki), XP ≥ poziom 6, lint, pełny `npm test`, ledger `2026-10-30-cykl-e2j-ledger.md`, recenzja Opus, jedna runda poprawek, prośba o scalenie.
