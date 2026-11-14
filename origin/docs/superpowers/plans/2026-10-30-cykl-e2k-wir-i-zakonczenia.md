# Cykl E2k – „Wir na Łysej Skale” i zakończenia – plan implementacji (szkic po recenzji)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zamknąć grę: siedziba Istoty wyżej na Łysej Skale (seria walk ze świtą), rozmowa z Istotą bez maski, **obowiązkowe starcie z Istotą (walka z bossem) w obu wynikach portalu**, koniec wojny Jarnowian (hetman składa bunt) i dwa zakończenia z wariantami: „Święty spokój” (portal rozbrojony, Istota ginie) i „Cisza po wirze” (portal sprawny, Istota pokonana w walce, złamana, ucieka przez wir ze świtą).

**Wymóg użytkownika (2026-10-30):** w finale musi być starcie z Istotą. Niezależnie od flagi portalu gracz walczy z Istotą jako bossem; różni się tylko to, co dzieje się po wygranej. Przegrana walka nie kończy gry (HP 1, powrót do kryjówki, ponowna próba).

**Architecture:** Bez nowej mechaniki silnika. Siedziba Istoty jako hub typu `map` (wzorem lochu z E2i): `wir_lysa_skala` w regionie `wir`; wejście **bez nowej podróży** (z `akt5a_przejscie`: „wchodzisz wyżej”): mapa `akt6_wir_mapa` z `arriveAt: wir_lysa_skala` i **`leaves: przystan_jarnowo`** (to ona porzuca otwarte zlecenia Jarnowa, o czym ostrzega Brama z wiru; `exitWhen` w E2j tego nie robi). Po decyzji o portalu `world.location` = `przystan_jarnowo`, więc nie wolno używać sceny `travel` z trasą spoza Przystani. Miejsca: wejście (≥4 stany zależne od postępu), trzy pojedynki ze świtą (dowolna kolejność), kryjówka (rest), komnata wiru. Zakończenia jako sekwencja narracji pod flagami i dwie sceny `ending` (`zakonczenie_swiety_spokoj`, `zakonczenie_cisza_po_wirze`), zastępujące tymczasowe `akt5a_przejscie`. Ekran końcowy to istniejący `showEndScreen` (THE END, spadające gwiazdy): zdanie podsumowujące wybory idzie w narracji przed nim.

**Tech Stack:** Node.js ≥22, ESM, `node:test`, zero zależności.

**Spec:** `docs/superpowers/specs/2026-10-26-akty-iv-v-design.md` (rozdz. 5 Akt V pkt 2–4, rozdz. 6). Plan poprzedni: `2026-10-30-cykl-e2j-jarnowo.md`.

## Global Constraints
- Ton: Akt V cichnie; ostatnia scena każdego zakończenia ciepła, sucha i śmieszna z wyczerpania, nie patetyczna. Istota („Szklanna”) mówi wolno i ze zmęczeniem; rozmowa nie zmienia wyniku, zmienia ton epilogu.
- Brak trzeciej drogi (spec): bohater nie negocjuje wyniku, nie skacze za Istotą, nie odchodzi.
- Region `wir`: ruling jak `loch` w E2i (bez odległości, pól walki i zdarzeń – wyjątek od 17; pogadanka 4-stanowa w wejściu – 1.4; `forage` niepuste i pasujące do miejsca; mapa tekstowa regionu).
- Balans: poziom 6, 4 kombinacje (miecz/włócznia × Bogdana/surowe) × 200 ziaren; pojedynki 0,75–1; Istota trudniejsza od Pełnomocnika dla tej samej kombinacji, z podłogą 0,4 dla surowej włóczni.
- Gałąź `cykl-e2k`; `npm test` i `--validate` zielone przed każdym commitem.

## Review Focus
1. Starcie z Istotą gra się w obu wynikach portalu; porażka nie kończy gry ani nie omija walki; rozmowa gra się raz (`istota_rozmowa_odbyta`), przy ponownej próbie krótka scena „po porażce”; wygrana prowadzi do właściwego zakończenia wg flagi portalu; dokładnie jedna z `istota_zginela` / `istota_uciekla`.
2. Każda kombinacja flag (brak sojuszników, brak `wojna_*`, oba Ostrza, oba wyniki; `hetman_rozmowa` jest zawsze ustawiona na starcie E2k, warianty to `hetman_przekonany` i `jarnowo_dowod`; skrót Smyka pozwala wejść w Wir z małą liczbą PD, więc balans nie zakłada poziomu 6) daje spójny epilog bez odwołań do niezrobionych wyborów (2.1).
3. Wczytanie zapisu w trakcie walki z Istotą i w epilogu nie zmienia wyniku; `istota_prawda` ustawiana raz.
4. Koniec wojny zależny od `hetman_rozmowa`, `hetman_przekonany`, `jarnowo_*`, `wojna_*`, sojuszników; wariant bazowy bez flag.
5. Stare zapisy na `akt5a_przejscie` wczytują się (scena zmienia typ).

## Zgodność z wytycznymi
1.2, 1.3, 1.4 (wejście 4-stanowe), 1.5, 2.1, 4.3 (symulacje obu klas i obu Ostrzy), 5.1, 5.13 (porządki w `MEMORY`), 5.15 (grafiki Istoty bez maski i świty szkicem albo odłożone do E3b), 16, 18 (`watek_wir`).

---

### Task 1: Świta Istoty i Istota-boss
`data/enemies.json` (+3: `sluga_wiru` (dystans, osłabienia), `straz_szklanna` (pancerz), `istota_szklanna` (boss, `morale: null`, ≥3 ataki, drugi atak specjalny „pękające szkło” – silnik nie ma faz HP), odporności przez `damageTaken`/`reduction`, Ostrze rani przez `damageType: "gwiezdne"`). Łup: przy `portal_rozbrojony` z ciała, przy `portal_sprawny` odłamki „zostawione w biegu” – dwa warianty wroga (`istota_szklanna` i `istota_szklanna_wir`, ten sam statblock, inny łup) albo łup przez scenę po walce. Test `test/wir_enemies.test.js`.

### Task 2: Siedziba Istoty (hub `wir_lysa_skala`)
Wejście (4 stany, różne dla `portal_*`), trzy pojedynki ze świtą (`if notFlag` po wygranej, scena „pusto”), kryjówka, **komnata wiru** po trzech pojedynkach: narracja (różna dla `portal_*`) → rozmowa `istota_bez_maski` (raz; warianty `wola`, `istota_wyrok/przetarg/zwloka`; prawda o niej → `istota_prawda` przy wysłuchaniu) → **walka z Istotą (`canFlee: false`, `onDefeat` → HP 1 → kryjówka, scena „po porażce”)** → wynik `istota_zginela` albo `istota_uciekla` wg flagi portalu. Wątek `watek_wir`. Test `test/wir_hub.test.js`.

### Task 3: Koniec wojny
Narracje: hetman Skjeldomir składa bunt; warianty pod `hetman_rozmowa`, `hetman_przekonany`, `jarnowo_*`, `wojna_*`, sojusznikami; wariant bazowy. Test `test/wir_story.test.js`.

### Task 4: Dwa zakończenia
Wspólna struktura „po wszystkim” (karczma, zupa, listy) z wariantami: kto pisze list i kto siedzi obok (sojusznicy), ceny (`wojna_ranni_*`, `wojna_studnia_zatruta`, `noc_*`, `cesarz_nie_zyje`), Ostrze (nad kominkiem / w pniaku / u kowala wg `istota_wyrok/przetarg/zwloka`; przy `ostrze_bogdana` „Bogdanowi na podkowy”), rozmowa z Istotą (`istota_prawda`), `szklo_wola`; zawsze obecne zdanie podsumowujące wybory. Zdanie o długu czyta `dlug_splacony` (zawsze) i zdejmuje go z `MEMORY`. Test: macierz flag (hetman: bez dowodu / przekonany) → zawsze jedno zakończenie, brak sprzecznych zdań. Zdjąć z `MEMORY` flagi przeczytane w zakończeniach.

### Task 5: Wpięcie, lint, bilans, ledger, recenzja
`akt5a_przejscie` (ending tymczasowy z E2j) → narracja wejścia wyżej → mapa `wir_lysa_skala` → koniec wojny → zakończenie wg wyniku. Przebieg testem od `portal_*` do obu zakończeń; aktualizacja specu (rozdz. 5, 7, 8); recenzja Opus; prośba o scalenie.
