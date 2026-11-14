# Cykl E2i – „Pod pałacem”, „Cisza po cesarzu” i „Dług spłacony” – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Domknąć Akt IV: loch pod Ulfgrodem z serią pojedynków z frakcją Rdzenia i bossem Pełnomocnikiem, scena „Cisza po cesarzu” (porządek po śmierci cesarza, zależny od flag), scena „Dług spłacony” (Istota, ton zależny od `wola` i `dlug`), a na końcu tymczasowe zakończenie przed Aktem V (E2j).

**Architecture:** Bez nowej mechaniki silnika. Loch to kolejny hub typu `map` (jak front i stolica): lokacja `loch_pod_palacem` z miejscami-pojedynkami odblokowywanymi po kolei flagami, miejscem odpoczynku i zapisem; walki w scenach spotów (`onDefeat` = HP 1 i powrót do menu, ucieczka tylko z pierwszych trzech). Po bossie krótka sekwencja narracyjna w `story.json` zastępuje tymczasowe `akt4b_przejscie`.

**Tech Stack:** Node.js ≥22, ESM, `node:test`, zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-26-akty-iv-v-design.md` (Akt IV, kroki 4–6, rozdz. 7). Odstępstwa wcześniejszych cykli: ledgery E2g i E2h.

## Global Constraints
- Zero zależności; id bez diakrytyków; teksty po polsku, ton wytycznych 1/1a. Loch i Pełnomocnik: chłodno, urzędowo, upiornie (język umowy: „klauzula”, „kontrahent”, „zwłoka”); Istota: dostojnie i obco. Zadziorność miasta kończy się za drzwiami lochu.
- Wytyczne `docs/wytyczne-tresci-i-qa.md` w całości, w tym 1.2 (riposty ≥100 znaków z cytatem przy porażce testu), 1.4 (≥4 stany pogadanki w lokacji), 1.5, 16 (źródło każdego przedmiotu), 17, 18; w szczególności 2.1: teksty nie obiecują strat ani wyborów, których nie było.
- T4 nigdy z loch-sklepu (lochu nie ma sklepu); łup z wrogów lochu do T3 (tabela `lupy_loch`).
- Ostrze Gwiazd jest w ekwipunku i ignoruje odporności upiorów i istot przybyszów; balans na poziomie 5, Ostrze, T2–T3, **obie klasy** (miecz i włócznia).
- Gałąź `cykl-e2i`; `npm test` i `node bin/game.js --validate` zielone przed każdym commitem; nowe testy przez `git add -f`.
- Flagi: `loch_*` (postęp), `pelnomocnik_pokonany`, `akt4c_koniec`, `dlug_splacony`; wszystkie ustawiane muszą być czytane (lint spójności).

## Review Focus
1. Gracz po porażce w pojedynku wraca do menu lochu z 1 HP i zawsze może odpocząć; nie da się utknąć bez możliwości dojścia do bossa (kolejność odblokowań, brak martwych miejsc).
2. Każdy pojedynek jest przeżywalny dla obu klas na poziomie 5 (widełki wygranych w teście balansu), boss trudniejszy, ale pokonywalny z opatrunkami.
3. „Cisza po cesarzu” nie odwołuje się do wyborów, których gracz mógł nie zrobić: każda wzmianka o mostach, beczkach, dezerterach, sojuszach stoi pod warunkiem na odpowiadającą flagę (wytyczna 2.1); dla gracza bez żadnej flagi tekst jest spójny.
4. „Dług spłacony”: wypowiedź zależy od `wola` i `dlug`, każda kombinacja (w tym `wola` 0 i `dlug` 0) trafia na jakąś wersję; ustawia `dlug_splacony` i przechodzi do tymczasowego zakończenia.
5. Wczytanie starego zapisu z `akt4b_przejscie` nie psuje stanu (scena zmienia typ, id zostaje) — jak w E2g.
6. Nic w lochu nie jest dostępne przed `akt4b_koniec` (pałac → loch tylko po śmierci cesarza) i nie da się wrócić do lochu po jego zamknięciu.

## File Structure
- `data/travel.json` (lokacja `loch_pod_palacem` w regionie `stolica` + hub lochu, zdarzeń brak), `data/maps/loch.txt`, `data/enemies.json` (+5), `data/loot.json` (`lupy_loch`), `data/art/*.pix` (5 szkiców), `data/dialogues/` (`pelnomocnik`, `istota_dlug`, 4 krótkie przed-pojedynki), `data/story.json` (akt4c_*), `data/quests.json` (wątek `watek_loch`).
- Testy (nowe): `test/loch_enemies.test.js`, `test/loch_hub.test.js`, `test/loch_story.test.js`; dostosowane: `consistency.test.js`, `capital_story.test.js`, `travel.test.js`, `enemies_e2e.test.js`, `data.test.js`.

---

### Task 1: Wrogowie frakcji Rdzenia

**Files:** Modify `data/enemies.json`, `data/loot.json`; Create 5 × `data/art/*.pix`; Test `test/loch_enemies.test.js`

**Interfaces:**
- Produces: wrogowie `straznik_progu` (pancerny, wolny, ~70 HP), `szeptacz` (dystans, efekt `strach`/rozkojarzenie, ~45 HP), `kustos_kabli` (kontroluje pole: efekt ogłuszenia, ~65 HP), `niespiacy` (wariant upiora, `tags: ["upior"]`, odporny na ogłuszenie, ~80 HP), `pelnomocnik` (boss, ~160 HP, trzy ataki, w tym „Klauzula zwłoki” z efektem). Każdy ma `art`, `nameAcc`, łup z `lupy_loch` (T≤3). Tabela `lupy_loch`.

- [ ] **Step 1: Testy (failing):** schemat i grafiki istnieją; biernik; łup bez T4; symulacje 200 ziaren poziom 5 (miecz i włócznia): pojedynek 0,8–1,0, boss 0,5–0,9 (z opatrunkiem); boss ma 3 ataki.
- [ ] **Step 2–4:** dane, szkice `.pix` (generowane, do dopracowania w E3b), commit `feat(loch): wrogowie frakcji Rdzenia`.

### Task 2: Hub „Pod pałacem” i pojedynki

**Files:** Modify `data/travel.json`; Create `data/maps/loch.txt`; Create dialogi przed-pojedynkowe; Test `test/loch_hub.test.js`

**Interfaces:**
- Produces: lokacja `loch_pod_palacem` (region `stolica`, hub, `secret`, odblokowana przez `akt4b_koniec`) ze spotami: `wejscie` (narracja, 4 stany), `straznik_progu`, `szeptacz`, `kustosz_kabli`, `niespiacy` (każdy `scene`: wstęp → walka (`onDefeat` HP 1 → scena porażki z cytatem, `goto: "koniec"`; `onFlee` dla pierwszych trzech) → po walce ustawia `loch_<id>_pokonany`), `kryjowka` (rest), `komnata_rdzenia` (scene, tylko gdy wszystkie cztery flagi; dialog `pelnomocnik` → walka bossa). Kolejność: pierwsze trzy w dowolnej, `niespiacy` po nich. Mapa tekstowa spójna z czasami.
- Wątek `watek_loch` (main, hub lochu, cele: cztery pojedynki → komnata Rdzenia).

- [ ] **Step 1: Testy (failing):** walidacja; kolejność odblokowań (`if`); każda walka ma `onDefeat` z `goto: koniec`; rest dostępny zawsze; brak martwego miejsca (symulacja przejścia całego lochu przez wszystkie spoty); wejście dostępne dopiero po `akt4b_koniec`.
- [ ] **Step 2–4:** dane i teksty (1.2: riposty ≥100 znaków), commit `feat(loch): hub, pojedynki, wątek`.

### Task 3: Pełnomocnik (rozmowa i walka)

**Files:** Create `data/dialogues/pelnomocnik.json`; Test `test/loch_story.test.js`

**Interfaces:**
- Produces: dialog z trzema wejściami zależnymi od flag (`wola` ≥ 3, `dlug` ≥ 3, reszta), ripostami (wymowa/nauka: Pełnomocnik oferuje „aneks” — odmowa daje walkę), brak opcji, po której gracz traci możliwość walki; kończy ustawieniem `loch_komnata_gotowa`.

- [ ] **Step 1: Testy:** brak ślepych węzłów; każde wejście dociera do walki; ripostę przy porażce testu ma każda opcja z `check`.
- [ ] **Step 2–4:** commit `feat(loch): Pełnomocnik`.

### Task 4: Cisza po cesarzu

**Files:** Modify `data/story.json`; Test `test/loch_story.test.js`

**Interfaces:**
- Produces: sekwencja `akt4c_cisza_*`: narracja po bossie z wariantami pod warunkami (`sojusz_dezerter`, `sojusz_straznicy`, `wojna_*` — każda wzmianka tylko pod własną flagą; wariant bazowy bez flag), Wsiewłod przejmuje armię, miasto dostaje komendanta, wyłączenie Rdzenia. Ustawia `akt4c_koniec`.

- [ ] **Step 1: Testy:** gracz bez flag dostaje wariant bazowy; gracz z każdą flagą dostaje dokładnie jej zdanie (grep po treści scen); `akt4c_koniec` ustawiane.
- [ ] **Step 2–4:** commit `feat(akt4): Cisza po cesarzu`.

### Task 5: Dług spłacony i wpięcie w fabułę

**Files:** Create `data/dialogues/istota_dlug.json`; Modify `data/story.json`, `data/dialogues/pisarz.json` (jeśli trzeba); Test `test/loch_story.test.js`

**Interfaces:**
- Produces: dialog z Istotą w pustej komorze Rdzenia, trzy wersje (`wola` ≥ 3: jawna deklaracja zagłady Istoty i poplecznika; `wola` < 3 i `dlug` ≥ 3: ostrożniej, „raty po racie”; reszta: krótko, bez deklaracji); ustawia `dlug_splacony`. `akt4b_przejscie` przestaje być zakończeniem: po `akt4b_koniec` mapa stolicy prowadzi do lochu (`exitWhen` → `akt4c_loch_mapa`), po bossie Cisza → Dług → tymczasowe zakończenie `akt4c_przejscie` („TO JESZCZE NIE KONIEC” przed Aktem V). Stare zapisy na `akt4b_przejscie` wczytują się (scena zmienia typ).

- [ ] **Step 1: Testy:** każda kombinacja `wola`/`dlug` (0, 2, 3, 5) trafia na wersję; `dlug_splacony` ustawione; zapis na `akt4b_przejscie` wczytuje się; cała ścieżka od `akt4b_koniec` do `akt4c_przejscie` przechodzi automatem; `consistency` zielone.
- [ ] **Step 2–4:** commit `feat(akt4): Dług spłacony, wpięcie lochu w fabułę`.

### Task 6: Lint, bilans, ledger i recenzja

- [ ] Rozszerzyć `distances`/`economy`/`consistency`, pełny `npm test`, `--validate`; ledger `docs/superpowers/plans/2026-10-29-cykl-e2i-ledger.md`; review package i końcowa recenzja Opus (Review Focus 1–6), jedna runda poprawek, prośba o scalenie.
