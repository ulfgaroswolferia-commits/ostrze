# Cykl E2a – ledger

Wynik: 8 zadań + poprawki po recenzji; 895 testów zielonych; `--validate` OK.

## Rulings
1. T1 – test `healFull` używa efektów godzinowych (`trucizna`, `glod`), bo `krwawienie` jest turowe; `healFull` zdejmuje wszystkie efekty i dopiero potem liczy `hpMax` (efekty obniżają maksimum).
2. T2 – komunikat o przybyciu sprawdzany przez `ctx.notices` (pokazuje się na następnym ekranie), nie w tekście wyjścia.
3. T4 – plotka kwatermistrza (`plotka_ok`) przepisana: kurier już był w szkole. Nieudany test Wymowy/Skradania wyszarza opcję (silnik, bez ponawiania); każdy węzeł wyniku wraca do węzła głównego rozmowy.
4. T5 – ognisko to popas w ciągu dnia 1 (część zdarzenia bandytów), bez deklarowanej pory. Istota: bezwarunkowa opcja „Słuchaj dalej.” i dodatkowa „Cesarz?…” przy `rozkaz_danina` (walidator wymaga opcji zawsze dostępnej).
5. T5 – sterownik testowy gra walkę z upiorami nocy zawsze jako porażkę w każdym planie podróży (zamiast opcji `trip.night` z planu); wykrywanie podsumowania porównuje tylko pierwsze 14 znaków (ramka zawija długie linie).
6. T6 – portrety Istoty tylko w węzłach rozmowy po jej pierwszym słowie; pierwsze węzły pokazują ilustrację sceny `noc_istota`.
7. Final – nowe pole sceny `waitUntil` (godzina 0–23): scena zaczyna się o tej godzinie (dziś lub jutro). Użyte w prologu (kurier o 12:00, wymarsz o 6:00) i w nocy (zmierzch 18:00, atak 21:00, przebudzenie 2:00, świt 5:00), więc pasek stanu zgadza się z narracją niezależnie od losowej godziny zdarzenia.
8. Final – `demo_posluch` wymaga `wola ≤ 0`, więc z `demo_przekora` nie grają razem (sprzeczne sceny w tymczasowym akcie II); do przepisania w E2b.

## Deferred minors
- Zdarzenia zadań (`quests.json › events`) omijają walidację `endsTrip` (literówka mogłaby przerwać podróż).
- `komendant.json`: „Komendant odkłada list…” – list z `demo_droga` już nie istnieje (do poprawy w E2b).
- Sceny bandytów w dniu 1 nie wspominają towarzyszy (bohater działa sam, potem siedzi z nimi przy ognisku).
- Pusty test „zdarzenie kind story: losowanie go pomija” (tylko sprawdza dane).
- Test ulewy ustawia `daysTotal = 3` ręcznie, nie przez `finishStage`; brak testu porażki Wymowy w `delegacja`.
- `healFull` nie wysyła zdarzeń `efekt_koniec` (brak komunikatu o zdjętych efektach).
- Sterownik testowy wykrywa noc po tekście „Upiór nocy” zamiast opcji `trip.night`.

## Kolejne kroki
Zlecone przez użytkownika: ozdobne ramki paneli z blokami i wzorem (mała osobna zmiana UI, najpierw brainstorm); potem E2b (akt II), E2c, E3b.
