# Cykl E2e – podróże, ekwipunek i wrogowie (powrót do RPG) – projekt

> Data: 2026-10-26 · Źródła: uwagi użytkownika z testu (26.10), audyt danych `items.json`, `shops.json`, `enemies.json`, `travel.json`, `docs/koncepcja-gry.md` (rozdz. 5, Szkarad ruszniczarz, „Miecz Gwiazd”), `docs/wytyczne-tresci-i-qa.md` (obowiązuje w całości).
> Kolejność cykli: … → E2c (akt III) → **E2e (ten cykl)** → E2f–E2i (akty IV–V, osobny spec) → E3b ilustracje → E3 szlif → E4 publikacja.
> Status: do przeglądu przez użytkownika.

## Problem (audyt)
- **Odległości:** wszystkie przejścia w hubach to 20–50 min (walidator odrzuca >180); dni mają tylko 3 trasy; przejścia Przełęcz → Głuszec (240 min) i Głuszec → Obserwatorium (480 min) to gołe narracje.
- **Podróż jest pusta:** 12 wydarzeń na całą grę (5 warunkowych, 2 fabularne). Szansa wydarzenia lokalnego 25%, maks. jedno na spacer. Zleceń z drogi brak.
- **Wrogowie:** 7 typów; łup to grosze, opatrunek, mięso. Żadnego sprzętu.
- **Ekwipunek:** 46 przedmiotów, 15 nieosiągalnych (kusza, pistolet skałkowy, kolczuga, buty, płaszcz, świeca dymna, puszka szerszeni…). Cała broń gracza to sprzęt ze szkoły (+ łuk ze szkolnego kramu). Sklepy poza szkołą: po 4 pozycje (prowiant, opatrunek, napar, strzała). `strzelecka` i `proch` bez zastosowania.
- **Przyczyna procesu:** lint spójności sprawdzał flagi i przedmioty fabularne, nie sprawdzał, czy każdy przedmiot ma źródło.

## Cel
Z przygody z lekkim rozwojem zrobić RPG: podróż pełna spotkań, realny dobór sprzętu (broń, pancerz, amulety), łup i zakupy, które zmieniają postać, i wrogowie zróżnicowani jak świat. Bez zmian fabuły głównej.

## 1. Podróże i odległości
- **Trzy klasy odległości w hubie:** bliskie 20–60 min, średnie 2–3 h, dalekie 5–8 h. Każdy hub ma 5–6 lokacji, w tym min. 2 bliskie, 2 średnie, 1 dalekie. Istniejące lokacje dostają nowe czasy (np. trakt_kupiecki 180 min, ruiny_straznicy 300 min, wzgórze obserwacyjne daleko); `near.via` zostaje.
- **Odległości także wewnątrz aktu (uwaga użytkownika 26.10):** nie tylko między aktami. Mapa każdego aktu rozciąga się na kilka godzin marszu, a najdalsze miejsca są oddalone o pół dnia. Cel: czas na walki i zdarzenia po drodze oraz powód, by spać w terenie. Dodatkowo każdy hub ma **min. 2 „pola walki”**: lokacje ze spotami typu `hunt` (legowisko, obóz zbójców, bagnisko, ruina z patrolem), w których walka jest głównym zajęciem (1–3 starcia po kolei z nagrodą w łupie i XP, odświeżane po kilku dniach). Gracz ma więc gdzie „spocić się walką”, nie tylko dostać walkę z losowej szansy.
- **Silnik:** limit `near.minutes` 180 → 480. Spacer dłuższy niż 2 h losuje zdarzenia lokalne co 120 min (maks. 3), każde z szansą `localEventChance`; stan w `world.map.walk` (lista zdarzeń, krok). Spacer ≥240 min liczy głód jak zwykły upływ czasu (sprawdzić w planie, czy `advanceTime` to robi; jeśli nie, dodać).
- **Trasy między hubami (1–4 dni, etapy):** Brzezina → Wilczy Bród (2 d, istnieje), **Wilczy Bród → Głuszec** (3 d, przez Kamienną Przełęcz; zastępuje narrację `akt3_wejscie`), **Głuszec → Obserwatorium** (2 d; zastępuje `akt3b_wejscie`), plus 1–2 trasy opcjonalne 4 d (np. Wilczy Bród → Obserwatorium starym szlakiem, z lepszymi wydarzeniami). Trasy odwrotne zostają (`map.leaves`). Trasy mają `fixed` tylko dla zdarzeń fabularnych.
- **Wydarzenia:** z 12 do ≥42 (30 nowych). Tabela per region (`pogorze`, `glusz`, `gwiazdy`), każdy region ≥12, w tym: ≥3 ataki (nowi wrogowie), ≥3 znaleziska ze sprzętem (zwłoki żołnierza, porzucona skrzynia, ruiny kapliczki, obozowisko), ≥3 spotkania z NPC do pogadania lub handlu (wędrowny kupiec ze zmiennym asortymentem, kowal wędrowny, ranny żołnierz), ≥2 zlecenia z drogi (`startQuest`: dostarcz, odszukaj, odprowadź), ≥2 pogodowe/zjawiskowe, ≥1 sytuacja moralna (pomóc, okraść, wydać). `once` dla fabularnych, losowe powtarzalne dla reszty.
- **Rytm:** szansa wydarzenia na etap podnosi się z 40 do 55%; `danger` lokacji podnosi szansę spaceru; szanse w `rules.travel`.
- **Powtarzanie tej samej trasy (uwaga użytkownika 26.10):** szansa zdarzenia na danej trasie maleje z każdym kolejnym przejściem, ale **nigdy nie spada do zera**. Licznik `world.map.passes["<z>><do>"]` (kierunek bez znaczenia: klucz z posortowanych id) rośnie po każdym ukończonym spacerze lub etapie trasy. Wzór: `szansa = max(floor, base × decay^przejścia)`, w `rules.travel.repeat`: `decay` 0,8 i `floor` 8% (dla spaceru), 15% (dla etapu trasy wielodniowej); `base` to zwykła szansa lokacji/etapu. Skutek: pierwsze przejścia dają dużo zdarzeń, po kilku powrotach zostaje rzadkie, ale realne ryzyko (zasadzka, spotkanie). Zdarzenia `once` i fabularne nie podlegają zanikaniu (liczy się tylko losowa pula). Licznik jest w zapisie v12 (migracja: puste `passes`); trasy fabularne z `fixed` zachowują swoje stałe zdarzenia.

## 2. Przeciwnicy (7 → 18)
Nowi (11), każdy z grafiką `.pix` (rysuję sam, jak w E3a) i symulacją ≥200 losowań na klasę:
- **Ludzie:** rabuś (maczuga, jak bandyta, ale z łupem sprzętu), rabuś łucznik (dystans), maruder (wygłodniały dezerter, niska morale, poddaje się/ucieka), herszt zbójców (elita, drop dobrego sprzętu), żołnierz pogranicza i sierżant (mały patrol 3-osobowy: sierżant + 2 żołnierzy; dobry pancerz, krótkie miecze).
- **Bestie z bestiariusza słowiańskiego (małe):** dzik (szarża, mocny pancerz skóry), żmija leśna (trucizna), utopiec (bagna, chwyta i dusi), błędnik (błędny ogniek, oślepienie, odporność na obuchowe), skrzat-złośnik (psotnik, rozkojarzenie, mały HP).
- **Łupy:** `loot` wspiera nowy wpis `giveRandom: { table: "<id>", chance }` – tabela losowa w `data/loot.json` (wagi, ilość). Ludzie dropią sprzęt z tabel zależnych od regionu, bestie – surowce (skóra, kły, żółć) do sprzedaży i do zleceń.
- **Skalowanie:** wrogowie nowi na poziom 1–4, w regionach: pogórze lekki, głuszec średni, gwiazdy trudny (+ wcześniejsze upiory). XP wg istniejącego wzoru; budżet XP sprawdzić symulacją (poziom 3 na końcu aktu II, 4 w III).

## 3. Przedmioty (46 → ≥100)
Nowe pole `tier` 1–4 (1 szkolne, 2 zwykłe, 3 dobre, 4 rzadkie – tylko łup elitarny, zlecenia, znaleziska). Docelowo (≥55 nowych):
- **Miecze (skill `sieczna`):** 4 stopnie + sztylet drugi stopień + 2 bronie obuchowe (maczuga, buława); **pary włóczni:** 4 stopnie; **łuki:** 3 (myśliwski, wojenny, kompozytowy); **kusze:** 3; **broń palna (`proch`):** pistolet skałkowy (T2), pistolet wojskowy (T3), rusznica (T3, ciężka); **bronie `wrecz`:** rękawice nabijane. Zakres obrażeń i koszt AP rosną z `tier`, bez wyjątków w kodzie.
- **Pancerz:** w każdym slocie (tułów 6, głowa 5, ręce 4, nogi 4, płaszcz 4, pas 3) przynajmniej T1–T3; część daje modyfikatory (skradanie, wytrzymałość, odporności).
- **Amulety i talizmany (slot `talizman`):** ≥8, m.in. na strach, krwawienie, upiory (−30% efektu strachu), szczęście (fart), wytrzymałość; część to zwykłe przedmioty, 1–2 artefakty z ładunkiem.
- **Surowce i dobra:** skóra, kły, żółć, klejnoty (sprzedaż). Rzeczy rzucane i mikstury: dodać 5–6.
- **Brak martwych przedmiotów:** 15 dotychczasowych dostaje źródła (kusza w sklepie Wilczego Brodu, pistolet u Szkarada itd.).

## 4. Sklepy i handlarze
- **Wilczy Bród:** kramarz (T1–T2 ekwipunek, mikstury), **kowal** (miecze, włócznie, pancerz T2), **Szkarad ruszniczarz** (proch, pistolety skałkowe, kule; z `docs`), 1 targowisko z wędrownym kupcem (zmienny stan).
- **Głuszec:** kowal Bogdan (T2–T3), handlarz wędrowny (amulety, surowce), znachorka (mikstury T2).
- **Obserwatorium:** zapasy (T2–T3), warsztat Brygidy (amulety T3, narzędzia).
- Każdy sklep ma 10–15 pozycji zależnych od miejsca i regionu, ceny rosną z `tier`, sprzedaż (`buys`) obejmuje surowce. Ulepszanie broni u kowala: poza tym cyklem.

## 5. Zgodność z wytycznymi i lint
- **Nowe lint-testy (`test/consistency.test.js` + `test/economy.test.js`):** (a) każdy przedmiot poza `hidden` ma źródło (sklep, łup wroga, `giveRandom`, znalezisko, nagroda zlecenia/sceny, start klasy); (b) każdy sklep ≥10 pozycji, każdy region ma w sklepach co najmniej broń, pancerz i amulet danego tieru; (c) każdy wróg ma `loot`, ludzie dropią sprzęt; (d) każdy region ≥12 wydarzeń; (e) każdy hub ma 3 klasy odległości; (f) symulacja podróży 3 dni ×200: średnio ≥1,5 wydarzenia; (f2) zanikanie: po 10 przejściach tej samej trasy szansa == `floor` (> 0), po 0 przejściach == `base`, funkcja nierosnąca; (g) tier T4 tylko z łupu elitarnego/zleceń.
- **Wytyczne 1–2:** nowe sceny w tonie słowiańskim, ripostę przy porażce, zlecenia z drogi rozliczane u zleceniodawcy, NPC do pogadania w nowych miejscach; wytyczne 5: zlecenia nie utykają, test na prawdziwych danych, zapis w środku spaceru i etapu, `--validate`, grafiki (11 wrogów).

## 6. Dane i zapis
- Zapis v11 → v12 (nowy kształt `world.map.walk`: lista zdarzeń); migracja przekłada stary spacer na nowy. Nowe pliki: `data/loot.json`; pozostałe w istniejących plikach.
- Poza zakresem: akty IV–V, ulepszanie broni, nowe klasy, handel między osadami, ilustracje poza wrogami (E3b).

## 7. Podział na zadania (szkic planu)
1. Silnik: `near` do 480 min, spacer wielozdarzeniowy ze zanikaniem szansy na powtarzanej trasie, spot `hunt` (pole walki z odświeżaniem), migracja v12, `giveRandom`, pole `tier`, walidacja.
2. Przedmioty (≥55) + `loot.json` + testy.
3. Wrogowie (11) + grafiki + symulacje.
4. Sklepy i handlarze (w tym Szkarad, kowale) + ceny.
5. Geometria: nowe czasy lokacji, trasy hub–hub, zastąpienie narracji `akt3_wejscie`/`akt3b_wejscie`.
6. Wydarzenia (30) w trzech regionach, w tym znaleziska i zlecenia z drogi.
7. Źródła sprzętu w lokacjach, nagrody zleceń, tabele łupów; strojenie XP.
8. Lint-testy, e2e od nowej gry do Obserwatorium, ledger, recenzja końcowa.
