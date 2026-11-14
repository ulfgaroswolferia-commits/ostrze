# Broń dystansowa i ulepszanie przedmiotów: projekt

Data: 2026-11-02. Status: projekt do przeglądu, bez zmian w kodzie.

Spec obejmuje dwie części, które można wdrażać i planować osobno. Liczby są punktem wyjścia i wymagają pomiaru (zob. „Weryfikacja”).

## Cel

**Problem z bronią dystansową.** Przy postaci 5/5 z 7 PA i bez tagu:

- szansa trafienia to 29–30% na dystansie (mediana obrony wroga: 16) i 9–10% w zwarciu;
- podejście kosztuje wroga 2 PA, więc 55 z 56 typów wrogów ma dość PA, żeby podejść i uderzyć w tej samej turze;
- broń zaczyna walkę pusta, jeśli nie załadowano jej w poprzedniej walce;
- strzał i ładowanie kuszy lub pistoletu (9 PA) nie mieszczą się w turze, a niewykorzystane PA przepadają;
- miecz krótki zadaje przeciw pancerzowi 2 około 4,1 na turę, pistolet skałkowy około 1,9, a łuk myśliwski około 0,9.

**Problem ze złotem.** W testowej rozgrywce gracz kończył grę z około 2500 monet bez sensownego celu ich wydania. Kowale nie mają przy tym wyraźnej roli.

**Założenia:**

- droga strzelca odpada, bo gra jest za krótka, żeby rozwinąć umiejętność;
- broń dystansowa uzupełnia broń główną, a nie ją zastępuje;
- to fantasy, więc wiarygodność jest ważna, ale nie musi być realistyczna w każdym szczególe;
- strzał nie może być darmowym, powtarzalnym otwarciem każdej walki bez żadnej ceny.

**Kryteria sukcesu:**

- gracz ma powód nosić broń dystansową w zapasie i decyduje, kiedy użyć strzału;
- miecz dalej wygrywa w ciągłej walce z lekko opancerzonymi;
- broń palna i kusza różnią się zastosowaniem, a nie tylko liczbami;
- złoto ma cel do końca gry, a kowale są powodem, żeby do nich jechać.

## Część A: walka bronią dystansową

### A1. Broń w zapasie i strzał

Broń dystansowa nosi się w slocie `bron_zapas`. Strzał w tym samym ruchu daje się złożyć z istniejących akcji i nie wymaga nowej akcji:

| Krok | PA |
|---|---|
| Zmiana na broń dystansową | 1 |
| Strzał | 3 (rusznica 4) |
| Zmiana na broń główną | 1 |
| Gotowość do walki | 2 |

Razem 7 PA.

**Zmiany w danych i zasadach:**

- koszt strzału: kusze i pistolety 3 PA, rusznica 4 PA;
- koszt ładowania w walce: kusze i broń palna 6 PA. Limit: ładowanie nie może przekroczyć 6 PA, bo postać ze zręcznością 2 ma tylko 6 PA;
- zmiana broni kosztuje 1 PA, gdy do ręki wchodzi albo z niej wychodzi broń z polem `reload`. Inne zamiany nadal kosztują 2 PA.

Łuki w tej części pozostają bez zmian (zob. „Odłożone”).

### A2. Samoczynne ładowanie

Broń w slotach `bron` i `bron_zapas` ładuje się bez kosztu, jeśli gracz ma amunicję:

- po zakończeniu walki;
- przy założeniu broni poza walką.

Bez amunicji broń zostaje pusta, a gra to pokazuje. Ładowanie w trakcie walki pozostaje możliwe, ale kosztuje jak w A1.

### A3. Różne rodzaje broni

Nowe pola broni określają premię do trafienia na dystansie i w zwarciu oraz karę za zwarcie:

| Broń | Na dystansie | W zwarciu | Rola |
|---|---|---|---|
| Lekka kusza | bez premii (29%) | +15, bez kary (44%) | cicha, tania, najlepsza z bliska |
| Kusza żołnierska, cesarska | +15 (44%) | +15, kara −20 (24%) | mocny strzał z daleka |
| Pistolety | +10 (40%) | +10, bez kary (40%) | działa też w zwarciu, huk i dym |
| Rusznica | +10 (40%) | +10, kara −20 (20%) | najmocniejszy strzał, ciężka i głośna |

Procenty dotyczą postaci bez tagu, przy obronie wroga 16.

Opis lekkiej kuszy („Powolna, ale wali mocno”) trzeba napisać od nowa. Jej cenę (dziś 33) trzeba podnieść albo udostępnić ją później, bo jest tańsza od miecza krótkiego.

### A4. Spowolnienie po trafieniu

Trafienie z kusz i broni palnej ma 50% szansy nałożyć istniejący efekt `spowolnienie` (−2 PA i brak ruchu przez 2 tury), z zachowaniem odporności i odparcia efektu.

Wybrano spowolnienie zamiast ogłuszenia, bo:

- żaden z 56 typów wrogów nie jest odporny na ogłuszenie, więc 65% szansy zabierałoby turę także bossom;
- spowolnienie działa niezależnie od życia wroga i nie traci sensu pod koniec gry (mediana życia to 45, maksimum 340);
- tworzy wybór, którego wroga zatrzymać.

### A5. Odskok ze strzałem

Nowa akcja na listę technik. Zastępuje odrzuconą gotowość do strzału.

**Koszt:** 5 PA. Rusznica i kusze z korbą (żołnierska, cesarska): 6 PA.

**Warunki:**

- wskazany wróg stoi w zwarciu;
- w `bron_zapas` jest załadowana broń dystansowa;
- w ręku jest broń do walki wręcz albo gracz walczy pięściami;
- gracz nie ma efektu zakazującego ruchu, a umiejętność broni nie jest zablokowana przez zjawisko.

**Kolejność:**

1. Wskazany wróg dostaje darmowy atak, tak jak przy obecnym kroku w tył. Ogłuszony wróg go nie ma. Jeśli gracz ginie, akcja się kończy.
2. Wróg przechodzi na dystans. Pozostali wrogowie zostają w zwarciu.
3. Broń dystansowa przechodzi do ręki, więc jej modyfikatory działają już przy strzale.
4. Strzał w tego wroga bez kary za zwarcie. Pełna ścieżka broni palnej obowiązuje: niewypał, rozerwanie, huk, dym.
5. Broń główna wraca do ręki. Jeśli lufa się rozerwała, zostaje broń główna.

Przy 7 PA i koszcie 5 zostają 2 PA, czyli gotowość do walki.

**Zasady, które muszą zostać:**

- darmowy atak wroga, bo bez niego akcja nie ma ceny;
- odskok od jednego wskazanego wroga, bo gotowość do walki bije każdego podchodzącego, a odskok od wszystkich dawałby przy trzech wrogach około 11,1 obrażenia przy tej samej liczbie ataków na gracza.

**Szacunek przeciw jednemu wrogowi z 6 PA:**

| | Dwa ciosy mieczem | Odskok + gotowość |
|---|---|---|
| Obrażenia, pancerz 2 | 4,1 | 7,1 |
| Obrażenia, pancerz 6 | 1,2 | 5,0 |
| Ataki wroga na gracza | 2 | 2 |

Pustej broni nie da się użyć ponownie bez ładowania za 6 PA, więc w typowej walce to jedna taka akcja.

**Zatrzymanie na dystansie:** spowolnienie po odskoku może zostawić wroga bez broni dystansowej daleko od gracza. To zamierzone, ale trzeba sprawdzić, czy nie da się tego powtarzać zbyt często.

### A6. Dym

Dziś dym pojawia się w 30–40% strzałów i utrudnia tylko strzelanie.

- Strzał z broni palnej zawsze daje dym, z wyjątkiem niewypału.
- Premia do ucieczki w `zadymienie` spada z +40 do +20. Przy pewnym dymie i +40 szansa wynosiłaby 85%.
- Kara −35 do trafienia z dystansu zostaje dla obu stron, a więc także dla kolejnego strzału gracza. To przewaga kuszy.
- **Nowe:** wróg, który w tej turze wszedł w zwarcie przez dym, ma −15 do trafienia do końca swojej tury. Wróg stojący już przy graczu bije normalnie.

Zmiana premii do ucieczki dotyczy też świecy dymnej, bo korzysta z tego samego efektu. To zamierzone.

### A7. Pistolet a kusza

| | Broń palna | Kusza |
|---|---|---|
| Cena strzału | około 9 monet | około 3 monety |
| Niewypał | tak | nie |
| Morale wrogów | huk je obniża | bez efektu, cisza |
| Dym | osłania, ale psuje własny kolejny strzał | brak |
| Drugi strzał w walce | prawie bez szans przez 3 tury | normalny, po ładowaniu |

## Część B: ulepszanie przedmiotów

### B1. Zasada

Ulepszenie to wymiana u kowala: stary przedmiot i pieniądze za nowy, osobny przedmiot. Gra nie dostaje nowego systemu, a ulepszona wersja jest zwykłym wpisem w `items.json`.

- **Zawsze łańcuch.** Dwa stopnie po kolei, bez rozgałęzień. Drugiego stopnia nie da się zrobić bez pierwszego, bo kowal bierze tylko przedmiot po pierwszym stopniu.
- **Biegłość i typ broni** zostają bez zmian, bo wynikają z pól przedmiotu.
- **Waga** ulepszonej wersji jest równa wadze starej. Pilnuje tego test danych.

### B2. Przebieg wymiany

1. Gra sprawdza, czy gracz ma przedmiot i pieniądze.
2. Przedmiot zostaje zdjęty, jeśli jest założony.
3. Gra zabiera przedmiot i pieniądze.
4. Ulepszona wersja trafia do plecaka.
5. Komunikat przypomina o założeniu przedmiotu. Gracz zakłada go sam.

**Kod:**

- `takeItem` zabiera tylko wolne sztuki i nie przerywa pozostałych akcji. Bez kroku 2 gracz zachowałby stary przedmiot i dostał nowy, dlatego dialogi potrzebują nowej akcji zdejmowania przedmiotu;
- `giveItem` przerywa resztę akcji przy przeciążeniu; przy wymianie nie sprawdza jednak wagi, gdy nowa sztuka waży nie więcej niż to, co wcześniejsze `takeItem` tej opcji zabrały (bohater ponad twardym limitem, np. po zbieraniu lub z głodu, nie traci starej sztuki ani pieniędzy);
- ulepszona broń przychodzi pusta, a załadowany nabój przepada. Ładowanie przy założeniu z A2 to naprawia, więc część B zależy tu od tego fragmentu części A albo wymaga go wcześniej.

### B3. Łańcuchy

| Przedmiot | 1. stopień | 2. stopień |
|---|---|---|
| Miecz, włócznia | lepszy uchwyt: +5 do umiejętności | ostrzenie: +1 przebicia pancerza |
| Pistolet, rusznica | muszka: +5 do umiejętności | lekki spust: mniej niewypałów |
| Kusza | lepsze łoże: +5 do umiejętności | mocniejsze ramię: +1 przebicia pancerza |
| Pancerz na tułów | warstwa skóry: +5% redukcji | lżejsze płyty: bez kary do PA, a gdy kary nie ma, +5% redukcji |

**Dlaczego nie +1 do obrażeń:** przy małych liczbach to duży skok. Miecz przeciw pancerzowi 2 zyskałby około 25%, a +5 do umiejętności daje około 10%, a pistoletowi przy niskim skillu około 17%.

**Działanie bonusów:**

- modyfikatory działają z bronią w ręku, a nie z zapasu ani z drugiej ręki. Dlatego sztylet i sztylet zbójecki, czyli broń do drugiej ręki, nie mają łańcucha;
- ulepszenie nie otwiera perków, bo ich wymagania liczą tylko wartości stałe;
- usunięcie kary do PA (kolczuga, kolczuga strażnicza, półpancerz) to najmocniejsze ulepszenie. Musi być drogie i dostępne tylko jako 2. stopień.

**Zakres pierwszej wersji:** broń bez łuków i broni do drugiej ręki oraz pancerz na tułów, czyli 27 przedmiotów i 54 nowe pozycje. Hełmy i talizmany można dodać później.

### B4. Ceny

- 1. stopień: około 50% wartości przedmiotu;
- 2. stopień: około 100% wartości przedmiotu;
- wartość ulepszonej wersji rośnie o zapłaconą kwotę. Sprzedaż za około 30% wartości nie daje zarobku.

Pełne ulepszenie broni, pistoletu i pancerza z 3. poziomu kosztuje około 700 monet, a broni z 4. poziomu do 975.

### B5. Kowale

| Warsztat | Co ulepsza |
|---|---|
| Kuźnia Zbycha, Kuźnia Bogdana | 1. stopień broni białej i pancerza |
| Kuźnia polowa | 1. i 2. stopień broni białej, pancerza i kusz oraz 1. stopień broni palnej |
| Warsztat Brygidy | 1. i 2. stopień broni białej, pancerza i kusz |
| Skrzynia Szkarada | broń palna, oba stopnie |

**Broń palna w obozie wojskowym:** według fabuły cesarscy znają broń palną, więc jej 1. stopień (muszka) można zrobić już w obozie. Drugi stopień (lekki spust) pozostaje u rusznikarza.

Część warsztatów ma dziś tylko sklep, a część dialog (np. Zbych i Szkarad mają oba), więc plan musi ustalić wejście do wymiany w każdym miejscu. Skrzynia Szkarada jest dostępna dopiero po odnalezieniu go, co ogranicza 2. stopień broni palnej.

Materiały z łupów mogą być częścią ceny, np. skóra dzika na warstwę pod pancerz. To dodatek, nie warunek.

**Dane:** 54 opcje nie powstają ręcznie. Plan wybierze skrypt generujący dane albo wspólny dialog warsztatu, który pokazuje tylko to, co gracz ma przy sobie. Każdy łańcuch musi przejść test danych: spójne identyfikatory, równa waga, wyższa wartość.

### B6. Bełty

Trzeci etap, po częściach A i B, bo ma sens dopiero wtedy, gdy kusza jest warta noszenia.

**Łańcuch:** zwykły → wzmocniony (+1 do obrażeń) → wybuchowy (obrażenia grupowe, zachowuje +1). Łączny koszt bełtu wybuchowego jest wyższy niż kuli, około 15 monet.

**Bełt ładuje się do kuszy.** Nie jest przedmiotem na pasie, bo to odbierałoby broni rolę jednoczesnego ataku i obrony.

**Działanie wybuchu:**

- przy trafieniu: obrażenia celu i odłamki na wrogów w tej samej strefie, około 4 obrażeń po pancerzu 2;
- odłamki mają około 30% szansy na spowolnienie, bo same obrażenia w typowej walce z dwoma wrogami dają tylko około +1,8;
- przy pudle: około 50% szansy na wybuch przy ziemi, tylko odłamki;
- wybuch przy celu w zwarciu rani też bohatera.

Bełt musi się różnić od garnka huku: garnek ogłusza z bliska, a bełt rani z daleka.

**Kod:** kusza musi przyjmować kilka rodzajów bełtów, a gra musi pamiętać, który jest załadowany. Dziś `reload.ammo` to jeden identyfikator, a `inventory.loaded` to tylko liczba, więc potrzebna jest zmiana zapisu gry i naprawa starych zapisów.

**Przełącznik:** w ekwipunku jest opcja „ładuj wybuchowe: tak/nie”. Bez niej kusza zużywałaby drogie bełty na każdą drobną walkę.

## Odłożone

Te elementy nie wchodzą do pierwszych etapów. Wracają tylko, jeśli gra po zmianach nadal będzie tego potrzebować.

- **Usunięcie łuku z ekwipunku gracza.** Łuk nie spełnia zasady, że broń może czekać napięta lub nabita. Wrogowie z łukami zostają. Wymaga zmian w 18 wpisach sklepów, 7 tabelach łupów, biegłości `luk`, zapisach gry i 48 odwołaniach w testach.
- **Połączenie umiejętności `strzelecka` i `proch`** w jedną o nazwie **„Celność”**, z opisem „kusze i broń palna”. Wiąże się z usunięciem łuku.
- **Perk „Chłodna głowa”:** premia do strzału i ładowanie w zwarciu bez kary. Zależy od rozwiązań, które wrócą. „Pewna ręka”: obniżenie progu z 40 do 25.
- **Kara za ładowanie w zwarciu.** Koszt 6 PA już zniechęca do tego ruchu.
- **Wrogowie, na których zwarcie jest złym wyborem:** powolne maszyny, stwory raniące przy dotyku, cele za przeszkodą.

## Odrzucone

- **Gotowość do strzału** (cała tura na czekanie, strzał w podchodzącego). Przegrywa z szybkim strzałem i gotowością do walki w walkach z grupą, a około 41% prób nie daje żadnych obrażeń. Zastępuje ją odskok ze strzałem.
- **Lekka kusza strzelająca i ładowana co turę.** Dobre liczby, ale nieprawdziwy obraz walki.
- **Bełt wybuchowy na pasie.** Patrz B6.
- **Droższe podejście wroga i trzy strefy odległości.** Zmieniają balans całej gry i wymagają przebudowy AI, interfejsu i scen.

## Kolejność wdrożenia

1. **Część B bez bełtów:** broń i pancerz. Wymaga ładowania przy założeniu z A2.
2. **Część A:** broń, samoczynne ładowanie, spowolnienie, odskok, dym.
3. **B6:** bełty wzmocnione i wybuchowe.

Etapy 1 i 2 można zamienić miejscami, ale etap 3 wymaga obu.

## Weryfikacja

Zgodnie z praktyką projektu dotyczącą balansu i błędów:

- każda zmiana ma testy jednostkowe, w tym dla wszystkich warunków odskoku i wyjątków przy wymianie;
- działanie w grze sprawdza skrypt przechodzący przez prawdziwą ścieżkę, a nie same testy jednostkowe;
- balans mierzy symulacja walk na prawdziwym zapisie gracza, z wydarzeniami włączonymi, jak przy weteranach.

**Co mierzyć przede wszystkim:**

- czy lekka kusza nie wypiera miecza;
- czy odskok ze strzałem nie staje się najlepszym ruchem w każdej walce;
- czy zatrzymywania wroga spowolnieniem nie da się powtarzać zbyt często;
- czy walki ze strzelcami (21 z 83 scen) nie stają się za trudne albo za łatwe;
- czy samoczynne ładowanie i pewny dym nie obniżają trudności ponad zatwierdzony balans;
- ile złota pochłaniają ulepszenia w całej rozgrywce i czy wzrost siły nie psuje balansu późnej gry.

Wszystkie szacunki w tym dokumencie policzono ręcznie z danych gry, bez symulacji, dla postaci 5/5 z 7 PA i bez tagu, bez krytyków i kar za noc.
