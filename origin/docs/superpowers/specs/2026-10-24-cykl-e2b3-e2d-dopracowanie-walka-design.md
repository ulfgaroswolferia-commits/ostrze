# Cykl E2b3 + E2d – dopracowanie aktu II i walka – projekt

> Data: 2026-10-24 · Źródła: backlog E2b2 (odroczone drobiazgi), uwagi z playtestu (balans głowy, para włóczni), polecenie: „dopracować wszystko przed aktem 3”.
> Cykl E: … → E2b2 (scalony) → **E2b3 dopracowanie + E2d walka** → E2c akt III (większy niż II) → E3b ilustracje → E3 szlif → E4 publikacja.
> Zgodność z `docs/wytyczne-tresci-i-qa.md`: dokument powstał razem ze specem; ten cykl realizuje pkt 3.4, 4.1, 4.2, 5.7 i sprawdza resztę regresją.
> Status: do przeglądu przez użytkownika.

## Cel
Zamknąć znane braki aktu II i naprawić walkę, żeby akt III startował z czystym stanem.

## Część A – E2b3 dopracowanie
1. **Wklejanie imienia.** Wklejony tekst w polu imienia zachowuje całość (do limitu pola); dziś zostaje pierwsza litera, bo odczyt klawiszy gubi resztę porcji. Dotyczy też innych pól tekstowych. Test: porcja wieloznakowa do pola w ramce i w trybie linii.
2. **Zakończenie przegranej eskorty.** Tekst końcowy mówi o Akcie II (stan faktyczny), nie o Akcie I; spójny z możliwością ponowienia u Ostromira.
3. **Grafiki:** portrety Wrzoska i kramarza; obrazy Traktu kupieckiego i Leśniczówki (`.pix` ≤48×20, `--art` do oglądu); podpięcie w miejscach/dialogach.
4. **Przegląd tonu aktu II pod wytyczne:** ripostę po każdej nieudanej próbie w dialogach aktów I–II, które jej jeszcze nie mają (lista z grepa po węzłach `fail`), plus NPC „do pogadania” tam, gdzie lokacja ma <1 takiego NPC lub <4 stany. Poprawki tylko w danych.
5. **Uwagi użytkownika z playtestu**, które nadejdą przed implementacją, wchodzą do tej części jako dodatkowe punkty (dopisane do planu).

## Część B – E2d walka
1. **Trafienie w głowę.** Kara bazowa `aimed.glowa.penalty` 30 → 20. Nowy parametr `aimed.glowa.masteryRelief`: każde 25 pkt mistrzostwa używanej broni zdejmuje 5 z kary (min. 0; mistrzostwo broni rzucanej/zasięgowej liczone dla jej rodzaju). Wynik trafienia nadal w `hitMin`–`hitMax`. Opis akcji w interfejsie pokazuje aktualną szansę.
2. **Para włóczni (i ogólnie bronie `pair`+`reach`).**
   - **Combo:** akcja „Cios w parze” wykonuje dwa ciosy (po jednym każdą bronią pary) w jednej akcji za sumę AP z `dual.extraAp`; drugi cios z karą `dual.secondHitPenalty`. Sprawdzić i naprawić, jeśli obecna logika `dual` nie łapie pary włóczni (`reach` wpływa na pierwszy swobodny cios przy zwarciu).
   - **Rzut z dystansu:** jedną włócznią z pary można rzucić we wroga w pasmie dalekim (zasięg `far`), zwykłe trafienie `thrown` (mistrzostwo `rzucana`, kara `oneLeftPenalty` dla pozostałej); rzucona leży przy celu i wraca przez „podnieś”. Dziś rzut działa tylko ze zwarcia lub wcale – naprawić tak, by działał z dystansu.
3. **Testy na prawdziwych danych:** głowa (szansa przy 0 i 100 mistrzostwa), combo pary włóczni, rzut z dystansu, podniesienie, zapis w trakcie walki; symulacja przeżywalności ≥200 losowań na klasę przy standardowych starciach aktu II (widełki w `rules`).

## Poza zakresem
Akt III (osobny cykl E2c), ilustracje poza wymienionymi (E3b), nowe typy broni.

## Dane i zapis
Brak zmiany wersji zapisu (nowe pola tylko w `rules.json`). Walidacja: `masteryRelief` liczba ≥0.

## Testy
Silnik: `masteryRelief`, combo, rzut z dystansu (`test/combat_*`). Dane: ton – test sprawdzający, że każdy węzeł porażki w dialogach aktów I–II ma tekst odprawy (≥1 zdanie narracyjne po wyniku). Wklejanie: test wejścia. `--validate`, pełny zestaw zielony.

## Podział na zadania (szkic)
1) wklejanie tekstu; 2) tekst przegranej eskorty; 3) głowa + `masteryRelief`; 4) combo pary włóczni; 5) rzut z dystansu; 6) riposty i NPC do pogadania (dane); 7) grafiki; 8) symulacja balansu, e2e i ledger.
