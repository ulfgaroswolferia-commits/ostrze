# Cykl E2f – zamknięcie Aktu III, Ostrze z nieba, ekran końcowy – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zastąpić urwany dialog z siedmioma zakończeniami na końcu Aktu III dwiema scenami fabularnymi („Szkło, które pamięta” i „Ostrze z nieba”), dać graczowi gwiezdne Ostrze (artefakt w slocie broni, jakość zależna od `glusz_pomoc`) i dodać klasyczny ekran końcowy „THE END” ze spadającymi gwiazdami, używany przez każdą scenę `ending`.

**Architecture:** Dane (dialogi, przedmioty, sceny) + dwa drobne elementy silnika: nowy typ obrażeń `gwiezdne` (upiory mają `damageTaken` 0,1 dla sieczne/kłute, a dla `gwiezdne` brak wpisu = pełne obrażenia) oraz moduł UI `end_screen.js` wzorowany na `title_screen.js`. Ostatni punkt fabuły tego cyklu to **tymczasowe zakończenie** („To jeszcze nie koniec”), które wymieni cykl E2g (Akt IV).

**Tech Stack:** Node.js ≥22, ESM, JSDoc, `node:test`, zero zależności; półbloki ▀ i xterm-256 jak ekran startowy.

**Spec:** `docs/superpowers/specs/2026-10-26-akty-iv-v-design.md` (rozdz. 3, 5 „Zamknięcie Aktu III”, 7).

## Global Constraints
- Zero zależności npm; teksty gry po polsku, id bez diakrytyków; liczby w `rules.json`/danych, nie w kodzie.
- Żadnych etykiet-numerów w tekście dla gracza (spec, rozdz. 1): sceny i przedmioty mają własne nazwy.
- Wytyczne `docs/wytyczne-tresci-i-qa.md` w całości (ton 1/1a, riposty 1.2, zlecenia nie utykają 5.1, źródła przedmiotów 16, wątek główny 18).
- Zapis zostaje w v12: stare zapisy ustawione na scenie `akt3b_final` muszą się wczytać (id pierwszej nowej sceny to `akt3b_final`).
- `docs/` jest śledzone, `test/` jest w `.gitignore`: nowe pliki testów dodawać przez `git add -f`.
- Gałąź `cykl-akty-iv-v` (spec już na niej); `npm test` i `node bin/game.js --validate` zielone przed każdym commitem.

## Review Focus
1. Zapis z końca Aktu III (scena `akt3b_final`, `akt3b_koniec` ustawione) wczytuje się w nowej wersji i prowadzi przez „Szkło” i „Ostrze” do tymczasowego końca (Tasks 2, 4).
2. Ostrze dostaje się **dokładnie raz**, także po wczytaniu zapisu w środku kuźni (Task 3).
3. Gracz bez sojuszników i bez `glusz_pomoc` też dostaje Ostrze (surowe); żadna kombinacja flag nie zostawia gracza bez broni z nieba (Task 3).
4. Gwiezdne obrażenia naprawdę biją upiory (do tej pory 10%), a ekwipunek i karta postaci pokazują nowy typ (Task 1).
5. Ekran końcowy: małe okno (<80×24) i tryb liniowy nie zawieszają się ani nie wymagają klawisza; tryb ramki czeka na Enter i da się go zamknąć (Task 5).

---

## File Structure
- `src/systems/modifiers.js`: `DAMAGE_TYPES` + `"gwiezdne"`; `data/ui.json`: `damage.gwiezdne`, `end.*`.
- `data/items.json`: 4 artefakty (`ostrze_gwiazd_bogdana`, `ostrze_gwiazd_surowe`, `para_gwiazd_bogdana`, `para_gwiazd_surowa`).
- `data/dialogues/szklo_pamieta.json`, `data/dialogues/ostrze_z_nieba.json` (nowe); `data/dialogues/rozdroze_final.json` (usunięty).
- `data/story.json`: sceny `akt3b_final` (Szkło), `akt3b_kuznia` (Ostrze), `akt3b_przejscie` (tymczasowy koniec); usunięte `koniec_*` (7 scen) i stary `akt3b_final`.
- `src/ui/title_screen.js`: eksport pomocników (`FONT`, `hash`, `toLine`, `RESET`) + glify H i N; `src/ui/end_screen.js` (nowy), `src/scenes/ending.js`.
- Testy (nowe): `test/blade.test.js`, `test/act3_close.test.js`, `test/end_screen.test.js`; dostosowane: `finale.test.js` (przepisany), `graph.test.js`, `guidelines.test.js`, `monkey.test.js`, `quests_act3b_2.test.js`, `act3b_start.test.js`, `consistency.test.js`, testy TTY kończące się sceną `ending`.

---

### Task 1: Typ obrażeń `gwiezdne` i cztery Ostrza z nieba

**Files:**
- Modify: `src/systems/modifiers.js` (`DAMAGE_TYPES`), `data/ui.json` (`damage.gwiezdne`), `data/items.json`
- Test: `test/blade.test.js`

**Interfaces:**
- Produces: typ obrażeń `"gwiezdne"`; przedmioty (artefakt, `slot: "bron"`, `tier: 4`, `damageType: "gwiezdne"`): `ostrze_gwiazd_bogdana` (miecz, `damage [9,15]`, `armorPierce 4`, pasyw `meleeHitChance +5`, `critChance +5`), `ostrze_gwiazd_surowe` (miecz, `[8,13]`, `armorPierce 3`, pasyw `meleeHitChance +5`), `para_gwiazd_bogdana` (para włóczni, `pair`, `reach`, `throwName "Włócznia"`, `throwSkill "drzewcowa"`, `[7,12]`, `armorPierce 4`, pasyw `meleeHitChance +5`, `critChance +5`), `para_gwiazd_surowa` (`[6,10]`, `armorPierce 3`, pasyw `meleeHitChance +5`). Wszystkie: `charge {max 50, start 50}`, `regen {perHour 2}`, `minStrength 4`, `value 0`, `hidden: false`.
- Consumes: istniejące pola broni (`masteryType`, `skill`) i walidator artefaktów w `items.js`.

- [ ] **Step 1: Test (failing)** `test/blade.test.js` na prawdziwych danych: (a) `validateData` czyste, wszystkie cztery przedmioty istnieją i są artefaktami `bron` z `damageType: "gwiezdne"`; (b) upiór nocy (`damageTaken` sieczne 0,1) przyjmuje od Ostrza Bogdana (miecz) co najmniej 5× więcej obrażeń niż od `miecz_krotki` (pętla 200 rzutów `doAction` „attack” ze stałym ziarnem, porównaj sumę HP zdjętego wrogowi); (c) obrażenia rosną: `bogdana` średnio > `surowe` w obu formach; (d) `ui.json` ma `damage.gwiezdne`; (e) karta ekwipunku wypisuje typ obrażeń Ostrza bez „[[”.
- [ ] **Step 2: Uruchom** `node --test test/blade.test.js`, oczekiwane FAIL (nieznany typ obrażeń).
- [ ] **Step 3: Zaimplementuj** `DAMAGE_TYPES` + `"gwiezdne"`, `damage.gwiezdne: "gwiezdne"` w `ui.json`, cztery artefakty w `items.json` (opisy po polsku, krótkie: „Metal z nieba w ręku kowala. Upiory zostawiają go w spokoju tylko do pierwszego cięcia.”).
- [ ] **Step 4: Uruchom** `npm test` i `node bin/game.js --validate`; zielone.
- [ ] **Step 5: Commit** `feat(ostrze): typ obrażeń gwiezdne i cztery Ostrza z nieba`.

### Task 2: „Szkło, które pamięta”

**Files:**
- Create: `data/dialogues/szklo_pamieta.json`
- Modify: `data/story.json` (scena `akt3b_final` zmienia się z dialogu `rozdroze_final` na dialog `szklo_pamieta`, `art: "krater_gwiazdy"`), `data/quests.json` (opis zlecenia `przygotowania`: „Rozdroże jest blisko” → treść wskazująca zagłębienie z odłamkami)
- Test: `test/act3_close.test.js` (część 1)

**Interfaces:**
- Produces: dialog `szklo_pamieta` (start `zapis`), flagi `szklo_wziete`, `szklo_wola`, przedmiot `odlamek_krateru` w plecaku po zakończeniu; scena `akt3b_final` (dialog) prowadzi do `akt3b_kuznia`.
- Consumes: `exitWhen.goto: "akt3b_final"` sceny `akt3b_mapa` (bez zmian id).

Treść: gracz wchodzi w zagłębienie z odłamkami i słyszy zapis rozmowy dwóch głosów (Istota „Szklanna” i Pełnomocnik Rdzenia, mowa umowy: „klauzula”, „kontrahent”, „zwłoka”). Wychodzi z tego pięć faktów (spec, rozdz. 3 krok 3): cesarz ma pakt z Rdzeniem; upiory to straż, a danina jest opłatą; dług bohatera to **wynajem** („narzędzie ma dojść do stolicy, reszta to księgowość”); Istota dwa razy zaprzecza, że chce zniszczyć świat; Pełnomocnik zapowiada „zwłokę w płatności”. Na końcu dwie opcje: **„Zabieram odłamek. Zobaczymy, kto kogo wynajął.”** (`wola +1`, flaga `szklo_wola`) i **„Zabieram odłamek. Dług to dług.”** (`dlug +1`); obie dają `odlamek_krateru` i flagę `szklo_wziete`. Brak opcji „zostaw”.

- [ ] **Step 1: Testy (failing)** `test/act3_close.test.js`: z zapisu na `akt3b_final` (flagi `akt3b_koniec`) skryptowa gra przechodzi dialog obiema opcjami; po każdej gracz ma `odlamek_krateru`, flagę `szklo_wziete`, a `wola` albo `dlug` wzrosło o 1; dialog zawiera słowa „klauzula” i „kontrahent”; wszystkie węzły mają co najmniej jedną opcję (brak ślepych węzłów); tekst bez „[[”.
- [ ] **Step 2: Uruchom**, oczekiwane FAIL.
- [ ] **Step 3: Napisz dialog** (ton wytycznych 1/1a; zapis „brzmi jak spisane na szkle”; krótko, groźnie, z dosadnym komentarzem bohatera); podmień dialog sceny `akt3b_final`.
- [ ] **Step 4: Uruchom** testy i `npm test`; zielone poza testami starego finału (naprawia je Task 4).
- [ ] **Step 5: Commit** `feat(fabuła): Szkło, które pamięta – prawda o pakcie i wynajmie`.

### Task 3: „Ostrze z nieba”

**Files:**
- Create: `data/dialogues/ostrze_z_nieba.json`
- Modify: `data/story.json` (nowa scena `akt3b_kuznia` zaraz po `akt3b_final`, `art: "obserwatorium"`)
- Test: `test/act3_close.test.js` (część 2)

**Interfaces:**
- Produces: dialog `ostrze_z_nieba` (start `kuznia`), flagi `ostrze_odebrane`, `ostrze_bogdana`, `ostrze_surowe`; cztery węzły kucia: `bogdan_miecz`, `bogdan_wlocznie`, `brygida_miecz`, `brygida_wlocznie`; każdy ma akcje `takeItem odlamek_krateru`, `giveItem <ostrze>`, `setFlag ostrze_odebrane` i flagę jakości.
- Consumes: `klasa_miecz`/`klasa_wlocznia`, `glusz_pomoc` (flaga z „Wieści z Głuszca”), przedmioty z Task 1, `odlamek_krateru` z Task 2.

Wybór węzła: opcje startowe z `requires` — `klasa_miecz` + `glusz_pomoc` → `bogdan_miecz`; `klasa_wlocznia` + `glusz_pomoc` → `bogdan_wlocznie`; `klasa_miecz` bez `glusz_pomoc` → `brygida_miecz`; `klasa_wlocznia` bez `glusz_pomoc` → `brygida_wlocznie`. Wszystkie cztery mają `notFlag: ostrze_odebrane`, a po odebraniu zostaje tylko rozmowa na pożegnanie (węzeł `po`). Bogdan przychodzi z wędrowcami (opis: „Przyszedł z Głuszca na piechotę, bo mu wstyd było czekać na wóz”); Brygida kuje „na własny rachunek i bez narzekania”. Ton: sucho, rubasznie; kowal mówi, że „metal się nie zgadza z żelazem, ale się dogada”.

- [ ] **Step 1: Testy (failing)** w `test/act3_close.test.js`: dla czterech kombinacji (klasa × `glusz_pomoc`) skryptowa gra z `akt3b_kuznia` kończy się posiadaniem właściwego Ostrza (`countOf(...) === 1`), brakiem `odlamek_krateru`, flagą jakości i `ostrze_odebrane`; ponowne wejście w scenę (symulacja wczytania zapisu w środku dialogu) **nie** daje drugiego Ostrza; gracz z dowolną kombinacją flag sojuszy (w tym zerową) zawsze dostaje Ostrze; Ostrze da się założyć (`slotAccepts` slot `bron`) i wygrywa z upiorem (`upior_nocy`) w symulacji 20 ziaren częściej niż `miecz_krotki`.
- [ ] **Step 2: Uruchom**, oczekiwane FAIL.
- [ ] **Step 3: Napisz dialog i scenę**; flagi czytane w `requires` (lint spójności).
- [ ] **Step 4: Uruchom** testy i `npm test`; zielone poza starym finałem.
- [ ] **Step 5: Commit** `feat(fabuła): Ostrze z nieba – Bogdan albo Brygida kują z odłamka`.

### Task 4: Wymiana starego finału na tymczasowe zakończenie

**Files:**
- Delete: `data/dialogues/rozdroze_final.json`
- Modify: `data/story.json` (usunąć 7 scen `koniec_*`; dodać `akt3b_przejscie`), `test/finale.test.js` (przepisać), `test/graph.test.js`, `test/guidelines.test.js`, `test/monkey.test.js`, `test/quests_act3b_2.test.js`, `test/act3b_start.test.js`, `test/consistency.test.js` (stała `MEMORY`: `sojusz_dezerter`, `sojusz_straznicy`, `sojusz_astrolog`, `sojusz_wedrowcy` z powodem „odczyt w zakończeniach Aktów IV–V”; flagi `final_*` znikają razem z dialogiem)
- Test: `test/act3_close.test.js` (część 3)

**Interfaces:**
- Produces: scena `akt3b_przejscie` (`type: "ending"`, `art: "koniec"`, tytuł „To jeszcze nie koniec”) po `akt3b_kuznia`, z tekstem: Ostrze w ręce, stolica przed nim, wojna po drodze, „ta opowieść ma ciąg dalszy” (tekst tymczasowy, wymieni go E2g).
- Consumes: sceny z Tasks 2–3.

- [ ] **Step 1: Test (failing)** w `test/act3_close.test.js`: pełna ścieżka od `akt3b_final` przez „Szkło” i kuźnię kończy się sceną `akt3b_przejscie` (`end: true`), a w `story.json` nie ma już scen `koniec_*` ani odwołań do `rozdroze_final`; zapis na `akt3b_final` ze starego `dialogueProgress: { akt3b_final: "final" }` wczytuje się i gra rusza od początku dialogu `szklo_pamieta` (Review Focus 1); `node bin/game.js --validate` czyste.
- [ ] **Step 2: Uruchom**, oczekiwane FAIL.
- [ ] **Step 3: Zmień dane i testy:** usuń `rozdroze_final.json` i 7 scen; dodaj `akt3b_przejscie`; przepisz `finale.test.js` na test nowej ścieżki (zamiast siedmiu zakończeń); w `graph.test.js` usuń oczekiwania zakończeń i dodaj osiągalność `akt3b_przejscie`; w `guidelines.test.js` i `monkey.test.js` usuń liczenie dróg `opor`; w `consistency.test.js` dopisz sojusze do `MEMORY`.
- [ ] **Step 4: Uruchom** pełny `npm test` i `--validate`; zielone.
- [ ] **Step 5: Commit** `feat(fabuła): koniec Aktu III prowadzi przez Szkło i kuźnię, stary finał usunięty`.

### Task 5: Ekran końcowy „THE END” ze spadającymi gwiazdami

**Files:**
- Modify: `src/ui/title_screen.js` (eksport `FONT`, `hash`, `toLine`, `RESET`; glify `H` i `N`), `src/scenes/ending.js`, `data/ui.json` (`end.close`: „Zamknij księgę.”, `end.plain`: „T H E   E N D”)
- Create: `src/ui/end_screen.js`
- Test: `test/end_screen.test.js`; dostosować testy TTY, które kończą się sceną `ending` (jeden dodatkowy Enter na ekranie końcowym)

**Interfaces:**
- Produces: `endLines({ width, height, tick, color }): string[]` (czyste; `height` wierszy po `width` kolumn; deterministyczne dla `tick`), `showEndScreen(ctx): Promise<void>` (w trybie ramki ekran bez paska, animowany przez `choose(..., { animate })` z jednym wpisem „Zamknij księgę.”; w trybie liniowym wypisuje jeden wiersz `end.plain` i nie czeka), `ending` woła `narration` potem `showEndScreen`.
- Consumes: `framesOn`, `sceneFullWidth`, `sceneCapacity`, `showScreen`, `choose`, `useColor` (jak w `src/app.js` dla ekranu startowego).

Wygląd: granatowe niebo z migoczącymi gwiazdami, **kilka gwiazd spadających jednocześnie** (głowa i ogon z gradientem, różne prędkości i kąty, ponowne pojawianie się w cyklu), duży napis **THE END** z glifów 5×7 (skala dobierana do szerokości), delikatne „ściganie” jasnej przekątnej po literach jak w logo, cień grzbietu wzgórza na dole. Bez koloru lub poniżej 40×12: sam wyśrodkowany napis tekstowy.

- [ ] **Step 1: Testy (failing)** `test/end_screen.test.js`: (a) `endLines` zwraca dokładnie `height` wierszy o szerokości widocznej `width` dla kilku rozmiarów (80×22, 120×30, 200×50); (b) deterministyczne: ten sam `tick` daje te same wiersze; dwa różne `tick` (np. 0 i 9) różnią się (gwiazdy się ruszają); (c) w klatce są półbloki ▀ i kody 256 kolorów oraz glify napisu THE END (sprawdź przez wyrenderowanie bez gwiazd lub przez obecność jasnego koloru napisu); (d) `color: false` albo rozmiar <40×12 daje czysty tekst z `THE END` bez sekwencji ESC; (e) scena `ending` w trybie liniowym (`createScriptedIO`) wypisuje tekst, a potem `T H E   E N D` i kończy bez dodatkowego wejścia; (f) w trybie ramki (TTY 80×24) ekran końcowy czeka na Enter, a klatka jest domknięta i ma ≤ 24 wiersze × ≤ 80 kolumn; (g) animacja: dwie klatki z `animate` różnią się.
- [ ] **Step 2: Uruchom**, oczekiwane FAIL.
- [ ] **Step 3: Zaimplementuj** `end_screen.js` (reużyj `FONT`/`hash`/`toLine`; dopisz glify H i N w `title_screen.js`; gwiazdy spadające liczone z `hash(i)`: pozycja startu, prędkość, długość ogona, faza cyklu) oraz podpięcie w `ending.js`.
- [ ] **Step 4: Dostosuj testy TTY** kończące się `ending` (E1, E1b, E2a, E3a, B1 TTY i inne wskazane przez pełny `npm test`): jeden dodatkowy `<enter>` na ekranie końcowym.
- [ ] **Step 5: Uruchom** pełny `npm test`, `--validate`; ręcznie `node bin/game.js --scene akt3b_przejscie` w oknie 120×30 i w liniowym.
- [ ] **Step 6: Commit** `feat(ui): klasyczny ekran końcowy THE END ze spadającymi gwiazdami`.

---

## Self-review
- **Pokrycie specu:** zamknięcie Aktu III (Tasks 2–4), jakość Ostrza zależna od `glusz_pomoc` (Task 3), typ obrażeń wobec upiorów (Task 1), ekran końcowy na prośbę użytkownika (Task 5). Wstęp do Aktu IV i pierwszy hub: poza tym cyklem (E2g).
- **Spójność nazw:** `szklo_pamieta`, `ostrze_z_nieba`, `akt3b_final`/`akt3b_kuznia`/`akt3b_przejscie`, flagi `szklo_wziete`/`szklo_wola`/`ostrze_odebrane`/`ostrze_bogdana`/`ostrze_surowe`, `endLines`/`showEndScreen` użyte jednolicie.
- **Proporcje:** plan to pięć zadań; treść dialogów zostaje autorowi (ton wytycznych), a wartości liczbowe (obrażenia Ostrzy) podano w Task 1.

## Ledger i recenzja końcowa (opus, 4 commity) – wyniki
Nic krytycznego; 1277 testów zielonych przed poprawkami, **1283 po**.
- **Wykonanie:** zadania 2–4 jednym ciągiem (wspólna ścieżka fabularna, przepisanie testów finału), zadania 1 i 5 osobno. Poprawka dwóch okien gry (kolejność `ESC[2J ESC[3J`) na tej samej gałęzi, potwierdzona przez użytkownika.
- **Naprawione po recenzji (test najpierw):** I1 przeciążony bohater nie tracił odłamka i Ostrza (nowe pole przedmiotu `unburdened`: przedmioty fabularne zawsze się mieszczą); I2 stary zapis po zakończonym starym dialogu rozdroza odblokowuje nowe Szkło (naprawa `finishedDialogues` bez flagi `szklo_wziete`); I3 zapis na usuniętej scenie `koniec_*` wraca na `akt3b_final`; M1 test karty przedmiotu naprawiony; M2 czytelne nazwy modyfikatorów na karcie (Trafienie w zwarciu, Odporność: …, Czas trwania: …); M3 ton (sakiewka zamiast portfela, fartuch zamiast kitla, mniej patosu, „cudza myśl” raz); M4 Brygida mówi „z Głuszca nikt nie przyszedł”.
- **Odłożone:** M5 opcja „Poczekam, aż żar się uspokoi.” to pętla bez skutku (bezpieczna); M6 zmienne `wola`/`dlug` czeka na czytelnika w Akcie IV; M7 animacja przerysowuje się co 110 ms także bez kolorów (koszt pomijalny); Hieronim idący z graczem znika z kuźni bez słowa (do dopracowania przy Akcie IV).
- **Nie oceniane:** wygląd animacji w prawdziwym Windows Terminal, balans Ostrzy poza upiorami (ważne od Aktu IV), rzut Parą Gwiazd z nowymi przedmiotami.
