# Wytyczne treści i QA (od aktu III)

> Źródło: uwagi z testów dem i recenzji cykli A–E2b2. Każda reguła wzięła się z realnej wpadki. Spec i plan każdego cyklu z treścią (akt III i dalej) **muszą** odwoływać się do tego dokumentu, a końcowa recenzja sprawdza zgodność punkt po punkcie (lista kontrolna na końcu).

## 1. Ton i dialogi
1. **Rubaszność i cięty język.** Mało patosu, krótkie zdania, sarkazm. Każdy NPC ma własny głos (komendant burczy, Wrzosek kpi, kramarz targuje się nawet o powietrze).
1a. **Ton słowiański, nie miękki (przegląd E3).** Szorstko, ziemiście, krótko: ludowe przekleństwa (psia mać, psiakrew, licho, czart), przesądy (sól, mora, leszy, strzyga), konkretne rzeczy zamiast psychologii, żadnych współczesnych słów (trauma, stres, termos, projekt). Postacie nie pocieszają, tylko stwierdzają. Powaga zostaje w scenach rzezi, śmierci i finału (tam ton jest oszczędny, nie komiczny). Przewodnik stylu z przeglądu: gałąź cykl-e3, plik scratchpada `tone/style.md` (skrót w tym punkcie wystarcza).
2. **Każda porażka ma ripostę.** Nieudany test (Wymowa, Perswazja, wypytywanie) kończy się cięta odprawą lub ochrzanem w głosie postaci, nigdy samym komunikatem „nie udało się”. Sukces też dostaje komentarz.
3. **Wstępy są powolne i podejrzliwe.** NPC nie wręcza zlecenia obcemu od razu: 2–3 wymiany (kim jesteś, skąd, po co), dopiero potem sprawa. Dialogi są o jedną linię dłuższe, niż się wydaje potrzebne.
4. **NPC „do pogadania”.** W każdej lokacji min. 1 postać bez zlecenia i nagrody, z ≥4 stanami reakcji przy powrotach: pierwsze spotkanie, „a to znowu ty”, „spać nie możesz, psia mać?”, „idź no znajdź sobie zajęcie”, „nie mam czasu, muszę się podrapać”. Tematy: sąsiedzi, kury, upiory, cesarstwo, pogoda. Dane z szablonu łańcucha scen z flagami (jak w hubie Wilczego Brodu).
5. **Gracz mówi własnym głosem.** Opcje dialogowe też mają charakter (grzeczna, cwana, zadziorna), nie „Tak / Nie”.

## 2. Fabuła i spójność
1. **Żadnej sceny wyrwanej z kontekstu.** Scena fabularna odwołuje się tylko do tego, co gracz mógł już zobaczyć (flagi, `questStatus`). Zakończenia aktów i porażek zgodne z faktycznym stanem (np. tekst o „Akcie I” w akcie II to błąd).
2. **Nie każ graczowi czekać w miejscu, gdzie to nie ma sensu.** Czekanie na kuriera, który ma przyjść, zastępuje zadanie lub swobodna akcja, nie ekran „odczekaj”.
3. **Zleceniodawca pozostaje w świecie.** Stały NPC (komendant) reaguje na stan: nie podjęto → „namyślałeś się? grosz nie śmierdzi”; podjęto, a gracz jeszcze tu → burczy, czemu go jeszcze nie ma; wykonano → rozmowa, nagroda **u zleceniodawcy** (`report` / `completeQuest`), nie przy wejściu do sceny.
4. **Przewodnik i ślady.** Jeśli tylko jedna postać zna drogę, jej śmierć/ucieczka zostawia ślad (tobołek, notatka, ciało do przeszukania). Przeszukanie ciał daje wskazówkę do celu; brak ciała tłumaczy narracja („uciekł jak zając”).
5. **Akt rozbudowany.** Akt III ma być wyraźnie większy od II: więcej miejsc, zleceń, NPC i gałęzi (min. ×1,5 treści; więcej zleceń łączących się ze sobą i odkrywających kolejne miejsca). Wprowadzenie aktu: osobne krótkie zadanie otwierające, nie goła scena.
6. **Losowi goście** (pielgrzym, kupiec, żebrak) mogą wręczyć zlecenie. Los tylko przy wejściu do miejsca i po wyprawie, nigdy przy wznowieniu zapisu.

## 3. Interfejs
1. **„Dalej” działa jednakowo wszędzie:** Enter i „1” przechodzą dalej w każdym miejscu sekwencji. Pytania t/n: cyfry wyłączone.
2. **Pytania w panelu wyboru** (t/n, imię), nie pod ramką.
3. **Czyść ekran** (`CLEAR_SCREEN` z historią) przy zmianie sceny; scena ma się czytać bez kontekstu poprzedniej.
4. **Wklejenie tekstu** do pola imienia zachowuje całość (do limitu).
5. Nowe widoki testować w trybie ramki (TTY ≥80×24) **i** liniowym.

## 4. Walka i balans
1. Cel ataku w głowę (czy inna zaawansowana akcja) musi być realną opcją od początku, a mistrzostwo ją poprawia, nie odblokowuje.
2. **Nic w walce nie dzieje się bez wyboru gracza.** Reakcje i darmowe ciosy są dozwolone tylko po jawnej akcji gracza (np. „Gotowość do ciosu” włóczni). Żadnej automatycznej szkody dla wrogów ani dla gracza w fazie wrogów poza atakami samych wrogów.
3. Każda broń o cechach specjalnych (para, zasięg, rzut) ma test akcji: combo, rzut, podniesienie, wszystko na prawdziwych danych.
3. Każdy nowy wróg/starcie sprawdzić symulacją (min. 200 losowań na klasę postaci): przeżywalność mieści się w widełkach z `rules`.

## 5. Dane i QA (lekcje z recenzji)
1. **Zlecenie nigdy nie może utknąć.** Sprawdź: (a) przedmioty zabierane przed startem zlecenia (`startQuest` przed `takeItem`; nie zabieraj bez aktywnego zlecenia), (b) wzorzec „flaga po startQuest” – użyj `questStatus`, (c) ścieżka ponowna po porażce (np. eskorta do podjęcia na nowo), (d) cele osiągalne w **dowolnej kolejności odkrywania** miejsc, (e) każda opcja, która przesuwa fabułę, ma alternatywę bez rzutu (np. „cierpliwie”).
2. **Odkrywanie miejsc:** każde miejsce ma co najmniej jeden niezawodny sposób odkrycia; porażka testu też może coś odsłaniać. Test: z nowej gry da się odkryć wszystkie miejsca.
3. **Test na prawdziwych danych.** `loadData()` bez minimalData: błąd z brakującym `maps` przeszedł wszystkie testy, bo używały atrap. Dla każdego nowego zlecenia test przechodzący całość na prawdziwych danych.
4. **Zapis i wznowienie.** Każdy nowy stan (faza, gość, zlecenie) przetestować po zapisie i wczytaniu w środku sceny; migracja ze starych wersji; bez ponownego losowania.
5. **Limity i konflikty.** Limit aktywnych zleceń (`maxActive`) nie może zamykać opcji na stałe; opcje wykluczające się nie mogą być wybrane obie.
6. **Walidacja:** `node bin/game.js --validate` czyste; każdy nowy warunek/akcja ma sprawdzenie w `data.js`.
7. **Geometria świata.** Czasy marszu muszą zgadzać się z mapą tekstową: lokacja odchodząca od innej ma `near.via` (czas liczony od rodzica), nie od huba. Przy każdej nowej lokacji sprawdź na mapie, kto jest jej sąsiadem, i przejdź trasę hub→A→B w obie strony (test `travel_geometry.test.js`).
8. **Walka widoczna.** Nic nie dzieje się przed pierwszym ruchem gracza (poza `ambush`), a wszystko, co zrobili wrogowie w swojej fazie, jest widoczne (przebieg tury).
9. **Realia świata.** Przedmioty i czynności muszą mieć sens (do młyna nosi się zboże, nie mąkę; kowal kuje, nie szyje). Przy nowym zleceniu sprawdź, czy przedmiot pasuje do miejsca i zleceniodawcy.
10. **Nagrody.** Każde zlecenie coś daje: pieniądze, przedmiot lub PD. Mikrozadanie bez innej nagrody dostaje automatycznie `rules.quests.microXp` (5 PD).
11. **Stan po zakończeniu.** NPC, który dał zlecenie, po jego wykonaniu nie wraca do starej prośby (np. żona Borka): zawsze stany „przed / w toku / po” (wytyczne 2.3).
12. **Rozmówca zna stan gracza.** Jeśli NPC mówi o czymś (światło w młynie, ścieżka, szukany człowiek), to po tym, jak gracz to znalazł lub załatwił, nie odsyła go znowu do tego samego, tylko reaguje (przedmiot, flaga, status zlecenia). Przy każdym dialogu zrób listę: „o czym mówi NPC” × „co gracz mógł już zrobić”. Tematy jednorazowe znikają po użyciu, a w ich miejsce wchodzi reakcja.
13. **Lint spójności (`test/consistency.test.js`).** Flaga, której ktoś wymaga, musi być gdzieś ustawiana; flaga ustawiona musi być czytana albo wpisana do `MEMORY` z powodem; przedmiot fabularny dany graczowi musi być potem wymagany lub zabrany. Akt III musi **użyć** flag pamięci z aktów I–II (m.in. `kurier_pytal`, `komendant_wie_o_szkole`, `odrzucil_stolice`, `waha_sie`, `towarzysze_zgineli`, `towarzysze_zaufanie`, `technologia_wiedza`, `dlug_istoty`), żeby świat pamiętał wybory gracza; po użyciu usuń je z `MEMORY`.
14. **Nazwy akcji w menu to czasowniki, które mają sens dla gracza** (np. „Odejdź od tablicy”, nie „Zostaw ogłoszenia”). Przeczytaj każdy nowy wiersz menu tak, jak zobaczy go gracz, bez kontekstu kodu.
15. **Grafiki:** każde miejsce i NPC z portretem ma `.pix` (≤48×20); `--art <id>` obejrzeć przed scaleniem.
16. **Każdy przedmiot ma źródło (lint ekonomii, `test/economy.test.js`).** Przedmiot w `items.json` musi być w sklepie, w łupie wroga, w tabeli łupów używanej przez `giveRandom`, w nagrodzie/znalezisku albo w starcie klasy; wyjątki są jawne w `NO_SOURCE_OK` z powodem (ukryte). Stopień 4 nigdy ze sklepu; stopnie rosną z regionem (Wilczy Bród ≤ T2, Głuszec i Obserwatorium ≤ T3). Nowy region = nowe sklepy, znaleziska i wrogowie, nie tylko narracja (uwaga z testu 26.10: „grę ratuje sprzęt, łup i podróż, a nie same zlecenia”).
17. **Odległości i podróż.** W każdym hubie lokacje w trzech klasach (≤ 60 min, 90–480 min, dalekie do 4 dni) i co najmniej dwa pola walki (spot `hunt` z cooldownem). Szansa zdarzenia na powtarzanej trasie maleje (`rules.travel.repeat`), ale nigdy do zera. Każdy region ma ≥ 12 zdarzeń (ataki, znaleziska, ludzie, zlecenia z drogi, sytuacje moralne).
18. **Gracz nigdy nie zostaje bez wskazówki, co dalej.** Każdy hub ma zlecenie wątku głównego (`main: true`), którego aktualny krok widać w dzienniku, oraz awaryjne popchnięcie (wizyta w hubie), gdy krok kluczowy nie ruszył. Kluczowy krok fabuły nie zależy od samego losu.

## 6. Proces
1. Spec i plan zawierają sekcję „Zgodność z wytycznymi” z odniesieniem do punktów powyżej, a plan sekcję „Review Focus” złożoną z pozycji z pkt 5.
2. Recenzent końcowy dostaje ten dokument i sprawdza go jako listę kontrolną.
3. Po graniu użytkownika uwagi trafiają **tu** (nowa reguła + powód), żeby się nie powtarzały.

## Lista kontrolna recenzji (kopiuj do raportu)
- [ ] Każda porażka testu ma ripostę
- [ ] Wstęp zlecenia ≥2 wymiany; stały NPC ma stany (nie podjęto / w toku / wykonano)
- [ ] NPC do pogadania w każdej lokacji, ≥4 stany
- [ ] Rozliczenie u zleceniodawcy; scena końcowa spójna ze stanem
- [ ] Zlecenia nie utykają (pkt 5.1) – test na prawdziwych danych
- [ ] Wszystkie miejsca odkrywalne; kolejność dowolna
- [ ] Zapis/wznowienie w środku sceny
- [ ] Dalej = Enter i „1”; pytania w panelu; ramka i tryb liniowy
- [ ] Przegląd etykiet menu i akcji pod kątem sensu dla gracza (na końcu każdego cyklu)
- [ ] Grafiki i portrety obecne; `--validate` i pełny zestaw testów zielone
