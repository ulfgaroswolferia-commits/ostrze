# Uwagi o balansie: broń dystansowa i ulepszenia

Zapisywane w trakcie wdrażania planu `docs/superpowers/plans/2026-11-02-bron-dystansowa-ulepszenia.md`. To obserwacje do decyzji, a nie zmiany w grze.

## Ulepszenia: ceny i pancerz

- **Koszt:** pełny łańcuch kosztuje 1,5 wartości bazowej. Miecz mistrza: 975 gr, a wartość po ulepszeniu 1625.
- **Lżejsze płyty:** kolczuga, kolczuga strażnicza i półpancerz dostają na 2. stopniu tylko usunięcie kary do PA, bez +5% redukcji. To zgodne ze specem. Pancerz bez kary dostaje +5%, więc te dwie ścieżki trzeba porównać w symulacji.

## Warsztaty: dostęp

- **Kuźnia polowa i Warsztat Brygidy:** oba robią 2. stopień broni białej i pancerza od pierwszej wizyty. Jedynym hamulcem jest cena, więc trzeba sprawdzić, jak wcześnie gracz ma na to pieniądze.
- **Menu:** oferta to 48 wymian u Brygidy i 51 w kuźni polowej, ale gracz widzi tylko to, co ma przy sobie.

## Nowe wartości broni dystansowej

Liczone przeciw wrogowi z obroną 10, dla postaci 5/5 bez tagu.

| Broń | Dystans | Zwarcie | Strzał + ładowanie |
|---|---|---|---|
| Lekka kusza | 35% | 50% | 3 + 6 PA |
| Kusza żołnierska, cesarska | 50% | 30% | 3 + 6 PA |
| Pistolety | 46% | 46% | 3 + 6 PA |
| Rusznica | 46% | 26% | 4 + 6 PA |

- **Lekka kusza:** kosztuje teraz 60 zamiast 33, a ładowanie 6 PA zamiast 4.
- **Spowolnienie:** 50% przy każdym trafieniu działa już na najsłabszym pistolecie, więc to silna kontrola. Priorytet do pomiaru.
- **Rytm walki:** przy 9 PA cykl strzał i ładowanie mieści się w turze, więc postać z dużą zręcznością może strzelać co turę. Taką postać trzeba osobno sprawdzić.

## Ładowanie po walce

- **Koszt:** każda broń dystansowa ma pojemność 1, więc walka kosztuje 1 sztukę amunicji na każdą zużytą broń, w obu slotach, bez PA i bez czasu gry.
- **Po przegranej i ucieczce:** broń też się ładuje. Tak mówi spec, ale ucieczka po strzale daje wtedy następną walkę z pełną bronią.

## Dym

- **Kara −15:** dotyczy każdego ataku wręcz wroga w turze, w której wszedł w zwarcie. Wróg z dużą liczbą PA ma ją na wszystkich ciosach tej tury, nie tylko na pierwszym.
- **Pewny dym:** przez 3 tury wrogi strzelec ma −35, a wchodzący w zwarcie −15. Razem to mocny efekt jednego strzału, szczególnie przeciw grupie.
- **Świeca dymna:** jej premia do ucieczki też spadła z +40 do +20, bo korzysta z tego samego efektu. To może osłabić ją bardziej, niż trzeba.

## Odskok ze strzałem

- **Gotowość po odskoku:** przy 7 PA mieści się tylko po broni za 5 PA. Rusznica i kusze z korbą zostawiają 1 PA, więc bez gotowości.
- **Huk:** obniża morale o 20 wszystkim żywym wrogom, nie tylko celowi, a bandycie z morale 60 zostaje 40.
- **Dym:** każdy strzał bez niewypału z broni palnej daje dym, więc odskok zawsze uruchamia też karę −15 dla wracającego wroga. Trzeba sprawdzić to w pomiarze.
- **Dostępność:** akcja jest w podmenu „Techniki”, a gotowość do ciosu ma własny wiersz w głównym menu. Gracz może jej nie zauważyć.

## Bełty wzmocnione i wybuchowe

- **Odłamki a pancerz:** odłamek 4–8 zadaje średnio 6 przy pancerzu 0 i 4 przy pancerzu 2. Spec mówi „około 4”, czyli to przypadek z pancerzem 2.
- **Bohater bez pancerza:** gdy cel jest w zwarciu, odłamki ranią bohatera za 4–8 z pominięciem jego pancerza, tak samo jak rozerwanie lufy. Dotyczy to też wybuchu przy pudle, który zdarza się w połowie przypadków. Uwzględnienie pancerza to zmiana jednej linii.
- **Liczba celów:** odłamki nie mają limitu. Jeden bełt w gęstą grupę rani każdego wroga w tej samej strefie, a każdy ocalały ma 30% szans na spowolnienie.
- **Pudło:** w połowie przypadków bełt i tak wybucha i rani także cel, więc chybiony strzał wybuchowy średnio coś zadaje.
- **Rodzaj obrażeń:** odłamki są kłute jak bełt, więc upiory prawie ich nie czują.
- **Zabicie odłamkiem:** liczy się jak zwykłe zabicie. Obniża morale pozostałych wrogów i może ściągnąć posiłki, które przychodzą na hałas po zabiciu.
- **Broń na kilka bełtów:** rodzaj bełtu znika dopiero po ostatnim strzale. Dziś każda kusza mieści jeden bełt, więc to się nie ujawnia.

## Pomiar

Symulator: `node tools/balance/ranged_sim.mjs <zapis|wzorcowy> [--stan przed --kod <katalog>] --json <plik>`, progi: `node tools/balance/ranged_sim.mjs --progi przed.json po.json`. Stan „przed” to eksport gałęzi `master`. Liczby to procenty walk i procenty maksymalnego HP.

- **Zakres:** 82 sceny walki z `travel.json`, `story.json` i `quests.json`, bez sparingu. Poziom bohatera decyduje o weteranach.
- **Warunki:** każda walka osobno, od pełnego HP, bez leczenia, w południe, bez zjawisk. Zdarzeń na drodze nie ma, więc pomiar pomija HP wnoszone do walki, amunicję i zapasy zużyte w drodze oraz to, jak często która scena wypada.
- **Strategie:** `miecz`: cios w głowę i podejście do wroga, tak mierzono weteranów. `miecz_zwykly`: zwykłe ciosy. `miecz_czeka`: gotowość i czekanie na wroga. `strzal`: zmiana broni, strzał, zmiana z powrotem, gotowość, dalej miecz. `odskok`: odskok ze strzałem raz na walkę, przy 1–2 wrogach w zwarciu, dalej miecz. `kusza` i `pistolet`: broń dystansowa jako główna, strzał i ładowanie. `kusza_kiting`: to samo z odejściem od wroga przed strzałem.
- **Stan „przed”:** walka zaczyna się z naładowaną bronią zapasową, choć stary kod nie ładował jej po walce. To zaniża zysk ze zmian w progu 4. Odskoku w starym kodzie nie ma.
- **Werdykt:** rozstrzyga wynik wszystkich scen przebiegu razem. Regiony i pojedyncze sceny są tylko informacją. Stosunek strat dla regionu liczę tylko tam, gdzie miecz traci co najmniej 5% HP.
- **Odrzucone akcje:** 0 we wszystkich przebiegach. W pomiarze jednej akcji 0 w A, C, E, G i H; dla I i J tego licznika jeszcze nie było.

### Przebiegi

- **A:** zapis `3.json`, poziom 12, 9 PA, HP 96, para włóczni, zapasowy pistolet wojskowy. 82 sceny, 400 walk na scenę, bo 2000 zajęłoby około 25 minut na przebieg.
- **C:** bohater wzorcowy: Siła 5, Zręczność 5, poziom 2, 7 PA, HP 46, krótki miecz, pistolet skałkowy. Pogórze, 14 scen, 2000 walk.
- **E:** jak C, z lekką kuszą w zapasie. 1000 walk.
- **G:** jak C, z 9 PA (Zręczność 9). 1000 walk.
- **H:** jak G, z tagiem strzeleckiej i prochu. 1000 walk.
- **I:** jak A, z tagiem i +60 punktami w strzeleckiej i prochu. 400 walk.
- **J:** najnowszy zapis, `auto.json`: poziom 2, 7 PA, HP 39, para włóczni, dodany pistolet skałkowy. Pogórze, 2000 walk.
- **I i J z pierwszego pełnego przebiegu:** ta sama logika walki, inne ziarna. Powtórkę przerwał brak pamięci. Werdykty przeliczyłem z tamtych liczb według obecnych reguł. Próg 4 w J liczony z marginesem 2 punktów, bo tamten plik nie ma wariancji.

### Progi

| Próg | A | C | E | G | H | I | J |
|---|---|---|---|---|---|---|---|
| 1. Miecz bije lekką kuszę (pancerz do 2) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 2a. Odskok nie jest lepszy w każdej scenie | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 2b. Akcja odskoku poniżej 2× dwóch ciosów | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 3. Strzał obniża stratę HP najwyżej o 25% (bez strzelców) | PASS | **FAIL** | PASS | PASS | **FAIL** | PASS | **FAIL** |
| 4. Sceny ze strzelcami nie gorsze niż przed | PASS | PASS | PASS | – | – | – | PASS |
| 5. Zatrzymanie ponad 3 tury w najwyżej 5% walk | PASS | PASS | PASS | PASS | PASS | **FAIL** | PASS |

- **Próg 1:** wygrane i strata HP, miecz przeciw kuszy: A 100%, 4,9% przeciw 84,6%, 35,5%. C 77,0%, 58,5% przeciw 27,3%, 89,7%. G 89,9%, 43,8% przeciw 70,6%, 62,0%. H 89,9%, 43,8% przeciw 88,1%, 44,9%, a kusza jest lepsza w 3 z 11 scen. I 100%, 4,8% przeciw 97,4%, 16,3%.
- **Obrażenia na turę w zwarciu:** A miecz 46,5, kusza 7,6. C miecz 7,9, kusza 2,7, bo przy 7 PA kusza strzela co drugą turę. G miecz 12,4, kusza 5,8. H miecz 12,4, kusza 8,0. Kusza strzela z bliska od startu, to jej najlepszy przypadek.
- **Próg 2a:** odskok lepszy od miecza z ciosem w głowę w A 20 z 82 scen, C 10 z 14, E 7 z 14, G 11 z 14, H 12 z 14, I 28 z 82, J 6 z 14.
- **Próg 2b:** to porównanie samej akcji odskoku (odejście i strzał) z dwoma zwykłymi ciosami bronią główną, bez ataku obiema bronią pary. Stosunek: A 0,31, C 0,81, E 0,73, G 0,78, H 1,16, I 0,58, J 0,30–0,42. Przy pancerzu 2 w H akcja odskoku zadaje 9,9, a dwa ciosy 6,3.
- **Próg 3, ogółem:** strata HP miecza z ciosem w głowę i ze strzałem. A 14,8% (11,6 → 9,9). C 28,3% (62,2 → 44,6). E 14,3% (62,2 → 53,3). G 24,2% (49,6 → 37,6). H 29,1% (49,6 → 35,1). I 22,2% (11,6 → 9,0). J 33,7% (35,6 → 23,6).
- **Próg 3 a wybór miecza:** względem zwykłych ciosów A ma 28,4%, C 21,6%, J 30,8%. Względem czekania A 19,0%, C 22,8%, J 24,4%. Cios w głowę u postaci 2. poziomu daje mniej niż zwykłe ciosy: C 61,1% wygranych przeciw 67,3%.
- **Próg 3, regiony w A (informacja):** Stolica 28,1% (6,1 → 4,4), Jarnowo 33,4% (6,3 → 4,2), loch 5,0% (60,0 → 57,0), Wir 4,1% (74,7 → 71,6), historia 15,3% (24,1 → 20,4). Na Pogórzu, w Głuszu, w Gwiazdach i na Froncie miecz traci 1,4–3,4% HP, za mało na stosunek. W 7 z 19 scen, gdzie miecz traci co najmniej 5%, spadek przekracza 25%. Najwięcej w `pogon_walka`: 78,2% (9,9 → 2,2).
- **Próg 4:** strzał w scenach ze strzelcami. A 98,3% wygranych i 21,3% HP przed, 99,2% i 12,7% po. C 19,7% i 93,8% przed, 38,7% i 84,6% po. E 10,7% i 97,4% przed, 23,4% i 93,3% po. J 76,8% i 67,2% przed, 95,5% i 40,6% po. Miecz bez zmian we wszystkich przebiegach. Żadna scena nie wyszła gorsza ponad margines (w J stały margines 2 punktów, bez wariancji).
- **Próg 4 w G, H i I:** brak stanu „przed” dla tego samego bohatera, więc porównania nie ma.
- **Próg 5:** odsetek walk z wrogiem zatrzymanym ponad 3 tury z rzędu, dla kuszy, kuszy z odchodzeniem i pistoletu. A 0,6, 3,3 i 0,3%. C 0,3, 1,3 i 0,1%. H 0,2, 2,5 i 0,4%. I 5,7, 17,5 i 3,5%.

### Obserwacje

- **Spowolnienie u strzelca:** przy tagu i wysokich umiejętnościach (I) kusza zatrzymuje wroga ponad 3 tury w 5,7% walk, a z odchodzeniem w 17,5%. W scenach ze strzelcami to 10,9 i 18,0%. Najgorsze sceny: `szeptacz_walka` 54,5% z kuszą, `noc_walka` 69,3% z odchodzeniem. Bez specjalizacji (A, C, G) najwyżej 3,3%.
- **9 PA:** postać strzela i ładuje w każdej turze, 1 strzał na turę zamiast 0,5. Kusza jako broń główna na Pogórzu: 21,5% wygranych przy 7 PA, 56,8% przy 9 PA, 74,1% przy 9 PA z tagiem. Miecz z ciosem w głowę: 61,1% przy 7 PA i 73,8% przy 9 PA.
- **Strzał na start wcześnie w grze:** na Pogórzu (C) strzał podnosi wygrane z 61,1 do 72,9% i obniża stratę HP z 67,3 do 50,3%. W obu scenach ze strzelcami miecz wygrywa 9,8% walk, a strzał 38,7%.
- **Odskok:** względem miecza z ciosem w głowę nie obniża straty HP ogółem: A −13,4%, C 6,9%. Wygrywa w części scen, więc to ruch sytuacyjny.
- **Późna gra (A):** miecz wygrywa 98,3% walk, ze stratą 13,9% HP średnio. Strzał: 98,6% i 10,8%.

## Pomiar z bełtami wybuchowymi

Opcja `--belty wybuchowy` symulatora: 300 bełtów wybuchowych w torbie, włączone `loadExplosive`, każda kusza zaczyna walkę z bełtem wybuchowym i po walce bierze następny. Porównanie ze stanem „po” bez bełtów, te same ziarna. Przebiegi A, C i E jak wyżej. Stan „po” bez bełtów na obecnym kodzie dał w A, C i E dokładnie te same liczby co poprzednio.

- **Koszt bełtu:** około 15 gr za sztukę: zwykły bełt w sklepie 3 gr, wymiana na wzmocniony 2 gr, na wybuchowy 10 gr. Kula z prochem kosztuje 9 gr. Wymiana idzie paczkami po 10, za 20 i 100 gr.
- **Gdzie zmiana:** tylko strategie z kuszą. W A i C broń zapasowa to pistolet, więc `strzal` i `odskok` są tam bez zmian. W E zapasowa to lekka kusza.
- **Strzał na start (E):** wygrane 68,0 → 71,9%, strata HP 59,0 → 52,4%. W scenach ze strzelcami 23,4 → 32,3% wygranych. Zużycie 0,93 bełtu na walkę, czyli około 14 gr.
- **Odskok (E):** wygrane 61,2 → 63,6%, strata HP 67,2 → 65,1%. 0,95 bełtu na walkę.
- **Kusza jako broń główna, wcześnie (C i E):** wygrane 21,4 → 40,2%, strata HP 92,0 → 83,8%. 3,57 bełtu na walkę, około 54 gr. Własne odłamki: 10,6 HP na walkę, 23% maksymalnego HP, bo strategia strzela do wroga w zwarciu.
- **Kusza z odchodzeniem, wcześnie (C i E):** wygrane 8,8 → 49,3%, strata HP 96,8 → 72,9%. 3,66 bełtu na walkę, około 55 gr. Własne odłamki 0, bo strzela tylko na dystans.
- **Kusza jako broń główna, późno (A):** wygrane 65,0 → 67,3%, ale strata HP 52,0 → 56,6%. W scenach bez strzelców strata rośnie z 39,8 do 48,4%. 6,71 bełtu na walkę, około 100 gr. Własne odłamki 20,4 HP na walkę, 21% maksymalnego HP.
- **Kusza z odchodzeniem, późno (A):** wygrane 62,5 → 69,5%, strata HP 54,6 → 51,1%. W scenach ze strzelcami 33,5 → 54,1% wygranych. 7,00 bełtu na walkę, około 105 gr. Własne odłamki 11,3 HP na walkę.
- **Próg 1:** dalej PASS. Miecz z ciosem w głowę przeciw kuszy z bełtami, pancerz do 2: A 100%, 4,9% przeciw 89,9%, 39,5%. C 77,0%, 58,5% przeciw 51,0%, 79,4%. Kusza nie jest lepsza w żadnej scenie.
- **Próg 3 w E:** strzał względem miecza z ciosem w głowę obniża stratę HP o 25,4% (62,2 → 46,4), było 14,3%. To FAIL, tuż nad progiem 25%. Względem zwykłych ciosów 18,4%.
- **Próg 5:** kusza z odchodzeniem zatrzymuje wroga ponad 3 tury z rzędu w 11,2% walk w A i 10,5% w C i E. Bez bełtów było 3,3% i 1,3%. To FAIL, bo odłamki spowalniają resztę grupy. Kusza bez odchodzenia: A 3,4%, C 1,9%, E 2,0%, PASS.
- **Progi 2a, 2b i 4:** PASS we wszystkich trzech przebiegach.
- **Pliki:** wyniki były w tymczasowym katalogu sesji i nie zostają w repozytorium. Odtworzenie, z tymi samymi ziarnami: `node tools/balance/ranged_sim.mjs <zapis 3.json> --walk 400 --belty wybuchowy` (A), `node tools/balance/ranged_sim.mjs wzorcowy --region pogorze --walk 2000 --belty wybuchowy` (C), to samo z `--walk 1000 --zapas kusza_lekka` (E), zawsze z `--watki 3 --json <plik>`. Bez `--belty` wychodzi stan „po” do porównania, a progi daje `--progi <przed.json> <plik>`.
