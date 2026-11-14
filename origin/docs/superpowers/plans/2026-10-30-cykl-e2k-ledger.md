# SDD ledger — plan: docs/superpowers/plans/2026-10-30-cykl-e2k-wir-i-zakonczenia.md

Pre-flight: Tasks 1–5 dzielą flagi `istota_zginela/uciekla` i sceny końcowe; graf-lint wymaga wpięcia, więc hub, dialog, koniec wojny i zakończenia poszły jednym commitem funkcjonalnym po commicie wrogów.
- Ruling: jedna postać wroga `istota_szklanna` (bez wariantu łupu); narracja po walce jest neutralna wobec łupu — łup to to, co spada jej z szat w trakcie walki — koszt: brak odmiennej tabeli łupu dla ucieczki.
- Ruling: wąskie widełki balansu Istoty (0,4–0,95): dla poziomu 6 rozrzut kute-miecz vs surowa-włócznia wynosi ~0,5 (Pełnomocnik ma ten sam), więc „trudniejsza od Pełnomocnika” jest sprawdzana względnie (Istota < Pełnomocnik dla tej samej kombinacji) — koszt: miecz z Ostrzem Bogdany ma ~0,93.
- Ruling: sceny huba Wiru z prefiksem `wir_*`/`komnata_wir_*` (kolizja id z lochem).
- Ruling: `akt5a_przejscie` zmienia typ `ending` → `narration` (id zostaje; stare zapisy wczytują się).
- Ruling: lista `MEMORY` skrócona do flag naprawdę nieczytanych w zakończeniach (`szklo_*`, `ostrze_surowe`, znaczniki dnia); `ostrze_surowe` ma tylko wariant tonu przez `istota_*` — koszt: brak zdania o surowym Ostrzu w epilogu.
- Ruling: grafiki `sluga_wiru`, `straz_szklanna`, `istota_szklanna` to wygenerowane szkice do E3b.
Task 1: complete — wrogowie, balans 4 kombinacji.
Tasks 2–5: complete — suite 1491/1491, --validate OK.

## Recenzja końcowa (Opus) – runda poprawek
- Final: fixed I1/I2 Ostrze w epilogu — „Broń z gwiezdnego metalu” (obie klasy), kominek/pniak w karczmie, wariant kowala z Bogdanem, zdanie o Bogdanie tylko bez oddania kowalowi; test „epilog: Ostrze nie przeczy samo sobie” RED→GREEN, suite 1499/1499
- Final: fixed I3 obietnica `istota_wyrok` — `ton_wyrok` tylko przy `portal_rozbrojony`, nowy `ton_wyrok_s` dla portalu sprawnego; test RED→GREEN
- Final: fixed I4 maska/imię Istoty (czarne szkło jako zdjęta przyłbica, „Szklanna” wprowadzone, „pięćdziesiąt lat” → „dłużej, niż cesarz trzyma pakt”); test RED→GREEN
- Final: fixed I5 podsumowanie zależy od wyniku (`akt6_pods_zginela/uciekla`); test RED→GREEN
- Final: fixed I6 testy silnika: od końca wojny do obu zakończeń, stary zapis na `akt5a_przejscie`; pusta asercja zastąpiona
- Final: fixed I7 koniec wojny czyta `jarnowo_wiesc_przekazana` i dowód ze szkła u hetmana; (sojusznicy w końcu wojny — ruling: pojawiają się w listach epilogu)
- Final: fixed (drobne) remis w walce z Istotą → porażka (`onFlee`), „szklany”, „składa broń”, powtórzenie w `wir_wejscie_b`, opcja prawdy znika po wysłuchaniu, komentarz i zawartość `MEMORY`
- Final: Ruling: pojedynki w teście Wiru mają dolne widełki 0,5–0,7 (nie 0,75 z planu), bo surowa włócznia daje 0,625 — koszt: tańszy próg; bez sklepu w Wirze opatrunki z wyspy są jedyną rezerwą
- Final: minor (deferred): „!” na Galerii luster po jej oczyszczeniu; pusty ekran „Dalej” przed walką z Istotą; sprzeczność „reszta świty” w `komnata_po_r`; `akt6_epilog_list_nikt` martwa gałąź; „nóż na schodach” (zamach był w komnacie); `forage: prowiant` w Wirze; pasek statusu w epilogu; usterki silnika „(niedostępne) (niedostępne)” i ekran końcowy bez statystyk; `szklo_wola` bez wariantu w epilogu

## Poprawki i licznik postępu (branch poprawki-e2k-licznik)
- Feature: licznik postępu huba w dzienniku (`hubProgress`, `mainQuestsOf` w `quests.js`; linia „Postęp w <hub>: N% ██░░░” w `journal_screen.js`). Liczy cele wątków głównych (`main`) huba: ukończony wątek = 100%, porzucony zachowuje zatrzaśnięte cele, bieżący cel z licznikiem (`var gte`) daje ułamek. Zlecenia z tablicy nie wchodzą (opcjonalne). Linia pojawia się dopiero po podjęciu wątku. Przy okazji cele wątków w dzienniku są zawijane (wcześniej przekraczały 80 kolumn).
- Fixed: znacznik progów Wiru na wejściu, reszta świty przy rozbrojeniu, martwa gałąź epilogu, „nóż w komnacie”, epilog czyta `szklo_wola`, powitanie kapitana, Brygida w dwóch miejscach, targowanie u przekupki kosztuje 2 gr, szulerzy płacą za wygraną raz (stawka 5 gr pobierana z góry).
- Deferred: pusty ekran „Dalej” przed Istotą (`dialogue.onCombat`), pasek statusu w epilogu, stany powrotu Hjalmara/Smyka/Jadwigi, portret Pełnomocnika, przekupstwo w zasadzkach, ekran końcowy ze statystykami.
