# Słownik przekładu na angielski

Ten słownik wiąże każdy przekład. Ta sama rzecz ma wszędzie tę samą angielską nazwę: w grze, w dialogach i w fabule. Kto wprowadza nową nazwę albo nowy termin, dopisuje go tutaj w tym samym commicie. Ton i przykłady są w `docs/i18n/probki-en.md`.

## Zasady

- **Imiona zostają po polsku**, z polskimi znakami: Zbych, Ostap, Bratosław, Brygida.
- **Jedno imię na postać** (decyzja użytkownika z 2026-11-07): dwie różne postaci nie mogą mieć tego samego imienia ani imion różniących się jedną literą. Wspólny słowiański przedrostek nie przeszkadza (Radosz, Radowit, Radogost). W zadaniu 18c zmieniono imiona i od tej pory obowiązują tylko nowe:
  - kupiec Radogost → Sulisław;
  - wartownik w ruinach Wsiebor → Czcibor;
  - goniec Wsiebor → Jarogniew;
  - pogorzelec Wit → Chwalisław;
  - furman Bolek → Sieciech;
  - żołnierz Bolko → Domasław;
  - rymarz Jaromił → Przybysław;
  - „Mistrz Hjalmir Gnieworad” → „Mistrz Gnieworad”.

  Instruktor Radogost, komendant Wszebor, furman Wit i kustosz Jaromir zostają.
- **Przydomki z pospolitych słów się tłumaczy** (decyzja użytkownika z 2026-11-04), jak Jaskier → Dandelion w Wiedźminie. Dotyczy to także Mruka: Mruk → Grumble. Przydomek ma brzmieć jak staroświeckie przezwisko, nie jak współczesny slang. Cała lista jest w tabeli „Przydomki”. Muł imieniem Cesarz to Emperor, a „Wasza Wysokość” do muła to Your Highness.
- **Perspektywa słowiańsko-nordycka** (decyzja użytkownika z 2026-11-04): angielskie słowa dobiera się tak, jakby świat był wczesnośredniowieczny, słowiański i nordycki. Bez słów rzymskich, łacińskich i antycznych (centurion, legion, prefect) i bez współczesnych. Setnik → Sotnik. W razie wątpliwości lepsze jest stare słowo germańskie albo angielskie (stronghold, stargazer) albo znane zapożyczenie słowiańskie. Empire, Emperor i Imperial zostają, bo przyjęto je w próbkach.
- **Nazwy miejsc:** tłumaczy się nazwę złożoną z pospolitych słów albo mającą naturalny odpowiednik (Wolf's Ford, Stone Pass, Birchgrove). Wymyślona nazwa własna bez łatwego odpowiednika zostaje (Głuszec, Ulfgród, Jarnowo, Skjeldowo).
- **Wzory nazw**, raz dla wszystkich:
  - „Wieś X”, „Osada X” → samo X (Birchgrove, Głuszec);
  - „Strażnica X” → „X Watchtower”;
  - „Przystań X” → „X Harbour”;
  - „Obóz na X” → „Camp on X”;
  - „… Ciszy” → „… of Silence” (House of Silence, Fog of Silence);
  - „Pod X” (mur, pałac) → „Below X” (Market Below the Wall, Below the Palace);
  - „pod X” przy nazwie osady → „Outside X” (The Well Outside Skjeldowo);
  - karczma „Pod X” to szyld → „the X” (the Dead Cockerel): w prozie i w mowie małe „the”, wielkie tylko na początku zdania; na liście miejsc „The X Tavern” (The Wolf's Fang Tavern);
  - miejsca nad rzeką Szarą → „… on the Grey” (Front on the Grey, Bridge on the Grey, Crossing on the Grey).
- **Nazwy miejsc wielką literą**, także w prozie: the Shipyard, the Waterworks, the Old Mill.
- **Stopień przed imieniem, zawód za imieniem:** Captain Bratosław, ale Grumble the innkeeper.
- **Pisownia brytyjska:** armour, harbour, grey, traveller.
- **Waluta:** grosze → groats, skrót „gr”. Kasza to nigdy „groats”: barley albo porridge.
- **Zwroty do bohatera:** „panie” → sir, „synku” → son, „siostro” → sister, „pachołku” (Szkarad) → boy.

## Jak czytać tabele

Każda tabela ma kolumny PL, EN, wzorzec PL i uwagi.

- **EN** to obowiązująca nazwa. Test szuka jej w przekładzie jako całego słowa. Po niej może stać tylko końcówka liczby mnogiej albo dzierżawcza („s”, „es”, „'s”, „s'”). Apostrof prosty i typograficzny liczą się tak samo.
  - EN z wielką literą (nazwa własna: the Being, Mother, Wolf's Ford) musi stać w przekładzie z tymi samymi literami. Tylko początkowe „the” może być „The” na początku zdania.
  - EN pisane samymi małymi literami (pospolite: survivor, wraith, imperial) może stać w dowolnej wielkości liter.
- **Wzorzec PL** to wyrażenie regularne JavaScriptu z flagą `u`, z rozróżnianiem wielkich liter, zapisane w jednej parze odwróconych apostrofów. Test sam dokłada granice słowa (przed i za wzorcem nie może stać litera). Znak `|` w tabeli zapisuje się jako `\|`.
- Wzorzec zaczęty od `^` musi kończyć się `$` i łapie tylko cały wpis, np. samą nazwę przedmiotu. Takie wzorce mają pospolite słowa (Handel, Siła, Dzik), które w zwykłym zdaniu można oddać inaczej.
- Wiersz bez wzorca to wskazówka, której test nie sprawdza.
- Uwaga „celowo” przy dwóch polskich nazwach z tym samym EN mówi, że to zamierzone.

Test `test/i18n_glossary.test.js` bierze każdy wpis nakładki `data/lang/en/`. Jeśli polski tekst wpisu pasuje do wzorca, angielski musi zawierać EN z tego wiersza. Test pilnuje też samego słownika:

- nie ma powtórzonych PL;
- nie ma dwóch PL z tym samym EN bez słowa „celowo”;
- każdy wzorzec się kompiluje;
- polska nazwa z jednego wiersza, która pasuje do wzorca innego wiersza, ma w swoim EN jego EN;
- każdy wzorzec łapie odmienione formy zapisane w `test/fixtures/glossary_forms.json`. Są to krótkie frazy z danych, plus formy z obocznością (trakt → trakcie, Skała → Skale, Mgła → Mgle).

Plik form buduje `node tools/i18n/glossary_forms.mjs`. Po każdej zmianie wzorca albo polskiego tekstu trzeba go zbudować od nowa. Narzędzie wypisuje też frazy, które łapie sam rdzeń nazwy, a wzorzec nie. Każdą z nich trzeba sprawdzić: albo to brakująca forma (wtedy poprawia się wzorzec), albo inne znaczenie, które wzorzec celowo pomija (wtedy wystarczy uwaga w wierszu).

## Miejsca i regiony

Wszystkie miejsca i regiony z `travel.json` oraz nazwy, które powtarzają się w tekście. Krótka nazwa miejsca (pole `short`) idzie za pełną: Kamienna Przełęcz → Stone Pass, krótko the Pass.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Pogórze | Foothills | `Pogórz(?:e\|a\|u\|em)` | region: the Foothills |
| Wieś Brzezina / Brzezina | Birchgrove | `Brzezin(?:a\|y\|ie\|ę\|ą)` | nazwa pospolita, tłumaczona; „Wieś X” → samo X |
| Wilczy Bród | Wolf's Ford | `Wilcz(?:y\|ego\|ym\|emu) Br(?:ód\|odu\|odzie\|odowi\|odem)` |  |
| Bród (krótko) | the Ford | `(?<!Wilcz\p{L}* )Br(?:ód\|odu\|odzie\|odowi\|odem)` | Wilczy Bród w skrócie; tylko z wielkiej litery, bo małe „bród” to zwykły bród przez rzekę; „Kramik w Brodzie” → Stall at the Ford |
| Strażnica Wilczy Bród | Wolf's Ford Watchtower | `Strażnic(?:a\|y\|ę\|ą\|y) Wilczy Bród` | „Strażnica X” → „X Watchtower” |
| Wilcza Nora | Wolf's Den | `Wilcz(?:a\|ej\|ą) [Nn]or(?:a\|y\|ze\|ę\|ą)` | też tytuł zadania |
| Kamienna Przełęcz | Stone Pass | `Kamienn(?:a\|ej\|ą) Przełęcz(?:\|y\|ą)` |  |
| Las Rubieży | Marchwood | `(?:L(?:as\|asu\|asem\|esie) )?Rubieży` | „rubież” = pogranicze, ang. march |
| Stary młyn nad rzeką | Old Mill by the River | `Stary młyn nad rzeką` |  |
| Stary młyn | Old Mill | `[Ss]tar(?:y\|ego\|ym\|emu) młyn(?:\|a\|ie\|owi\|em)` | krótka nazwa młyna nad rzeką |
| Trakt kupiecki | Merchants' Road | `[Tt]ra(?:kt\|ktu\|ktem\|kcie) [Kk]upieck(?:i\|iego\|im)` |  |
| Leśniczówka | Forester's Lodge | `Leśniczów(?:ka\|ki\|kę\|ką\|ce)` | tylko z wielkiej litery (nazwa miejsca) |
| Ruiny strażnicy | Watchtower Ruins | `[Rr]uin(?:y\|ach\|ami\|om) strażnicy` |  |
| Ostoja zbójców | Brigands' Roost | `Osto(?:ja\|i\|ję\|ją) zbójców` | zbójcy → brigands (jak Herszt zbójców) |
| Twierdza graniczna | Border Stronghold | `[Tt]wierdz(?:a\|y\|ę\|ą\|y) graniczn(?:a\|ej\|ą)` | twierdza → stronghold |
| Osada Głuszec / Głuszec | Głuszec | `Głusz(?:ec\|ca\|cu\|cem\|cowi)` | od „głuszy”, nie od ptaka; zostaje; „Osada X” → samo X |
| Okolice Głuszca | Głuszec Backwoods | `Okolic(?:e\|ach\|ami) Głuszca` | region; „backwoods” oddaje „głuszę” |
| Bór kłusowników | Poachers' Wood | `B(?:ór\|oru\|orze\|orem) kłusowników` |  |
| Stary trakt | Old Road | `[Ss]tar(?:y\|ego\|ym) tra(?:kt\|ktu\|ktem\|kcie)` |  |
| Kapliczka na rozstajach | Crossroads Shrine | `[Kk]aplicz(?:ka\|ki\|kę\|ką\|ce) na rozstajach` | kapliczka → shrine |
| Kamieniołom | the Quarry | `[Kk]amieniołom(?:\|u\|ie\|em)` | nazwa na liście i w „Jesteś w”: The Quarry; krótko i w prozie: the Quarry |
| Bagna Szarej Wody | Greywater Marshes | `Bag(?:na\|ien\|nach\|nami\|nom) Szarej Wody` |  |
| Wzgórze wartownicze | Sentry Hill | `[Ww]zgórz(?:e\|a\|u\|em) wartownicz(?:e\|ego\|ym)` |  |
| Szklane Wzgórza | Glass Hills | `Szklane Wzgórza\|Szklanych Wzgórz(?:ach)?\|Szklanymi Wzgórzami\|Szklanym Wzgórzom` | region (liczba mnoga) |
| Szklane Wzgórze | Glass Hill | `Szklane Wzgórze\|Szklanego Wzgórza\|Szklanemu Wzgórzu\|Szklanym Wzgórz(?:u\|em)` | jedno wzgórze, z Obserwatorium |
| Obserwatorium na Szklanym Wzgórzu | Starwatch on Glass Hill | `Obserwatorium na Szklanym Wzgórzu` |  |
| Obserwatorium | Starwatch | `[Oo]bserwatori(?:um\|ach)` | dom gwiezdników Hieronima; bez łacińskiego „Observatory” |
| Pole Szkła | Glass Field | `[Pp]ol(?:e\|a\|u\|em) [Ss]zkła` |  |
| Krater Spadłej Gwiazdy | Fallen Star Crater | `Krater(?:\|u\|em\|ze) Spadłej Gwiazdy` |  |
| Krąg Menhirów | Standing Stones | `Kr(?:ąg\|ęgu\|ęgiem) Menhirów` | menhiry w tekście: standing stones |
| Wrak Maszyny | Machine Wreck | `[Ww]rak(?:\|u\|iem\|owi) [Mm]aszyny` | też tytuł zadania |
| Zapadlisko Ciszy | Hollow of Silence | `Zapadlisk(?:o\|a\|u\|iem) Ciszy` | „Ciszy” w nazwach zawsze „of Silence” |
| Zapadlisko (krótko) | Hollow | `[Zz]apadlisk(?:o\|a\|u\|iem)(?! Ciszy)` | the Hollow; także małe „zapadlisko” w prozie, bo to to samo miejsce |
| Ostatnia Strażnica | Last Watchtower | `Ostatni(?:a\|ej\|ą) [Ss]trażnic(?:a\|y\|ę\|ą)` | też tytuł zadania |
| Spalona osada | Burnt Settlement | `[Ss]palon(?:a\|ej\|ą) osad(?:a\|y\|zie\|ę\|ą)` | krótko „Pogorzelisko”, patrz niżej |
| Pogorzelisko | Burnt Ground | `[Pp]ogorzelisk(?:o\|a\|u\|iem)` | jedna forma dla krótkiej nazwy i dla Skjeldowa |
| Stara kopalnia | Old Mine | `[Ss]tar(?:a\|ej\|ą) kopalni(?:\|a\|ę\|ą)` |  |
| łódź z nieba | boat from the sky | `[Łł](?:ódź\|odzi\|odzią\|odzie) z nieba` | jak „stone from the sky” |
| Rozbita łódź z nieba | Wrecked Boat from the Sky | `Rozbit(?:a\|ej\|ą) łód(?:ź\|zi\|zią) z nieba` |  |
| Ruiny stacji | Station Ruins | `[Rr]uin(?:y\|ach\|ami) stacji` | obca technika: polski też ma tu nowe słowo, więc „station” celowo |
| Wronia Góra | Crow Mountain | `Wroni(?:a\|ej\|ą) Gór(?:a\|y\|ze\|ę\|ą)` |  |
| Obóz na Wroniej Górze | Camp on Crow Mountain | `[Oo]b(?:óz\|ozie\|ozu) na Wroniej Górze` | „Obóz na X” → „Camp on X” |
| Szara (rzeka) | Grey | `(?<=(?:[Nn]a\|[Dd]o\|[Nn]ad\|[Pp]rzez\|[Zz]a\|[Zz]nad\|[Zz]za\|[Pp]o\|[Oo]d\|[Kk]u\|[Pp]rzy\|[Ww]\|[Ww]zdłuż) )Szar(?:a\|ej\|ą\|ę)(?! [Ww]od)\|(?<=(?:i\|jak) )Szara(?= (?:robi\|zabiera\|płynie\|wylała\|wezbrała\|niesie\|szumi))\|Szara(?= (?:płynie\|wylała\|wezbrała\|niesie\|szumi))` | rzeka: the Grey; wzorzec łapie Szarą po przyimku i jako podmiot przy czasownikach z danych (robi, zabiera) i kilku innych; inne zdania z rzeką jako podmiotem nie są sprawdzane, bo „Szara” na początku zdania bywa przymiotnikiem |
| Front nad Szarą | Front on the Grey | `Fron(?:t\|tu\|tem\|cie) nad Szarą` | region; wzór nad rzeką: „… on the Grey” |
| Przeprawa przez Szarą | Crossing on the Grey | `[Pp]rzepraw(?:a\|y\|ie\|ę\|ą) przez Szarą` |  |
| Most na Szarej | Bridge on the Grey | `[Mm]o(?:st\|stu\|stem\|stowi\|ście) na Szarej` |  |
| Pole sprzed trzech dni | Three Days' Field | `Pol(?:e\|a\|u) sprzed trzech dni` | pole bitwy sprzed trzech dni |
| Skjeldowo | Skjeldowo | `Skjeldow(?:o\|a\|em\|ie\|u)` | nazwa nordycko-słowiańska, zostaje; „pod Skjeldowem” → „Outside Skjeldowo” |
| Skjeldowo, pogorzelisko | Skjeldowo, Burnt Ground | `^Skjeldowo, pogorzelisko$` | ta sama forma co „Pogorzelisko” |
| Ruiny fortu granicznego | Border Fort Ruins | `[Rr]uin(?:y\|ach\|ami) fortu granicznego` |  |
| Przedni obóz cesarski | Imperial Forward Camp | `[Pp]rzedni(?:\|m\|ego) ob(?:óz\|ozie\|ozu) cesarski(?:\|m\|ego)` |  |
| Przedni obóz Jarnowian | Jarnowian Forward Camp | `[Pp]rzedni(?:\|m\|ego) ob(?:óz\|ozie\|ozu) Jarnowian` |  |
| Wzgórze Wisielców | Gallows Hill | `Wzgórz(?:e\|a\|u\|em) Wisielców` |  |
| Jar Dezerterów | Deserters' Ravine | `Jar(?:\|u\|em\|ze) Dezerterów` | jar → ravine |
| Ulfgród | Ulfgród | `Ulfgr(?:ód\|odu\|odzie\|odem\|odowi)` | stolica; zostaje, z kreską nad ó |
| Pod Murem | Below the Wall | `[Pp]od Murem` | dzielnica Ulfgrodu; wzór „Pod X” (mur, pałac) → „Below X” |
| Targ Pod Murem | Market Below the Wall | `Targ(?:\|u\|iem) [Pp]od Murem` |  |
| Zaułek Szklarzy | Glassmakers' Alley | `Zauł(?:ek\|ka\|ku\|kiem) Szklarzy` |  |
| Zaułek Garncarzy | Potters' Alley | `Zauł(?:ek\|ka\|ku\|kiem) Garncarzy` | akt IV; jak Zaułek Szklarzy; zatwierdzone przez użytkownika 2026-11-07 |
| Dom Ciszy | House of Silence | `Dom(?:\|u\|em\|owi) Ciszy` |  |
| Krypta Ciszy | Crypt of Silence | `Kryp(?:ta\|ty\|tę\|tą\|cie) Ciszy` |  |
| Port rzeczny | River Port | `[Pp]or(?:t\|tu\|cie\|tem) rzeczn(?:y\|ego\|ym)` |  |
| Koszary miejskie | Town Barracks | `Koszar(?:y\|ach\|ami) miejsk(?:ie\|ich\|imi)` | koszary → barracks |
| Cmentarz zbiorowy | Common Graveyard | `[Cc]mentarz(?:\|a\|u\|em) zbiorow(?:y\|ego\|ym)` |  |
| Pałac cesarski | Imperial Palace | `[Pp]ała(?:c\|cu\|cem) cesarsk(?:i\|iego\|im)` |  |
| wodociągi | Waterworks | `[Ww]odociąg(?:i\|ów\|ach\|ami)\|[Ww]odociągow(?:y\|ego\|emu\|ym\|a\|ej\|e\|ych)` | nazwa miejsca, z wielkiej litery; Szczur wodociągowy → Waterworks Rat |
| Stare wodociągi | Old Waterworks | `[Ss]tar(?:e\|ych\|ymi) wodociąg(?:i\|ów\|ach\|ami)` |  |
| Opuszczony klasztor | Abandoned Monastery | `[Oo]puszczon(?:y\|ego\|ym) klasztor(?:\|u\|ze\|em)` |  |
| Pod pałacem | Below the Palace | `Pod pałacem\|[Ll]och(?:\|u\|em\|owi\|ów\|ach\|ami) pod pałacem` | region; w zwykłym zdaniu „pod pałacem” jest wolne |
| Loch pod pałacem | Dungeon Below the Palace | `[Ll]och(?:\|u\|em\|owi\|ów\|ach\|ami) pod pałacem` |  |
| Jarnowo | Jarnowo | `Jarnow(?:o\|a\|ie\|em\|u)` | wyspa i przystań; zostaje |
| Wyspa Jarnowa | Jarnowo Island | `Wysp(?:a\|y\|ie\|ę\|ą) Jarnowa` | region |
| Morze przy Jarnowie | Sea off Jarnowo | `Morz(?:e\|a\|u) przy Jarnowie` | region |
| przystań | harbour | `[Pp]rzysta(?:ń\|ni\|nią)` | pisownia brytyjska; kapitan przystani → harbour captain |
| Przystań Jarnowo | Jarnowo Harbour | `Przysta(?:ń\|ni\|nią) Jarnowo` | „Przystań X” → „X Harbour” |
| Stocznia | Shipyard | `[Ss]toczni(?:a\|ę\|ą)?` | nazwa miejsca, z wielkiej litery |
| Kuźnie wyspiarzy | Islanders' Forges | `[Kk]uźni(?:\|e\|ach\|ami\|a) wyspiarzy` |  |
| Cmentarz Łodzi | Boat Graveyard | `Cmentarz(?:\|a\|u\|em) Łodzi` |  |
| Obóz hetmana | Hetman's Camp | `[Oo]b(?:óz\|ozie\|ozu\|ozem) hetmana` |  |
| czarne szkło | black glass | `[Cc]zarn(?:e\|ego\|ym\|ej) [Ss]zk(?:ło\|ła\|le\|łem)` | w prozie małą literą; w nazwie miejsca i na mapie wielką: House of Black Glass, Black Glass; celowo ten sam EN co krótka nazwa |
| Dom z Czarnego Szkła | House of Black Glass | `Dom(?:\|u\|em\|owi) z Czarnego Szkła` |  |
| Wraki floty | Fleet Wrecks | `Wrak(?:i\|ów\|ach\|ami) floty` | tylko z wielkiej litery |
| Łysa Skała | Bald Rock | `Łys(?:a\|ej\|ą) Ska(?:ła\|ły\|łę\|łą\|le)` |  |
| Wir na Łysej Skale | the Whirl on Bald Rock | `Wir(?:\|ze\|u) na Łysej Skale` | miejsce i region |
| Pomost nad wirem | Walkway over the Whirl |  | finał; pomost = walkway (jak w Stoczni), nie bridge |
| Rzeczka | Beckby | `Rzecz(?:ka\|ki\|ce\|kę\|ką)` | gród z rozmów zwiadowców i sołtysa; pospolita nazwa, tłumaczona (beck = strumień, -by = osada) |
| Krwawa Łąka | Bloody Meadow | `Krwaw(?:a\|ej\|ą) Łą(?:ka\|ki\|kę\|ką\|ce)` | pole dawnej bitwy |

## Krótkie nazwy na mapie

Pole `short` w `travel.json`. Nazwy równe pełnej (Wilcza Nora, Głuszec, Ulfgród…) mają wiersz wyżej. Krótka nazwa wspólna dla dwóch miejsc jest wspólna celowo, gdy te miejsca leżą w różnych regionach.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Przełęcz (krótko) | the Pass | `^Przełęcz$` |  |
| Trakt (krótko) | the Road | `^Trakt$` | wspólne celowo: Merchants' Road (Pogórze) i Old Road (Głusz), różne mapy |
| Ruiny (krótko) | the Ruins | `^Ruiny$` |  |
| Bór (krótko) | the Wood | `^Bór$` |  |
| Kapliczka (krótko) | the Shrine | `^Kapliczka$` |  |
| Bagna (krótko) | the Marshes | `^Bagna$` |  |
| Wzgórze (krótko) | the Hill | `^Wzgórze$` | wspólne celowo: Sentry Hill (Głusz) i Gallows Hill (front), różne mapy |
| Krater (krótko) | the Crater | `^Krater$` |  |
| Menhiry (krótko) | the Stones | `^Menhiry$` |  |
| Wrak (krótko) | the Wreck | `^Wrak$` |  |
| Strażnica (krótko) | the Watchtower | `^Strażnica$` | Ostatnia Strażnica |
| Ostoja (krótko) | the Roost | `^Ostoja$` |  |
| Twierdza (krótko) | the Stronghold | `^Twierdza$` |  |
| Kopalnia (krótko) | the Mine | `^Kopalnia$` |  |
| Łódź (krótko) | the Boat | `^Łódź$` |  |
| Stacja (krótko) | the Station | `^Stacja$` |  |
| Obóz (krótko) | the Camp | `^Obóz$` | wspólne celowo: Wronia Góra (front) i obóz hetmana (Jarnowo), różne mapy |
| Przeprawa (krótko) | the Crossing | `^Przeprawa$` |  |
| Pole bitwy (krótko) | the Battlefield | `^Pole bitwy$` |  |
| Fort (krótko) | the Fort | `^Fort$` |  |
| Obóz cesarski (krótko) | the Imperial Camp | `^Obóz cesarski$` |  |
| Obóz Jarnowian (krótko) | the Jarnowian Camp | `^Obóz Jarnowian$` |  |
| Jar (krótko) | the Ravine | `^Jar$` |  |
| Targ (krótko) | the Market | `^Targ$` |  |
| Zaułek (krótko) | the Alley | `^Zaułek$` |  |
| Port (krótko) | the Port | `^Port$` |  |
| Koszary (krótko) | the Barracks | `^Koszary$` |  |
| Cmentarz (krótko) | the Graveyard | `^Cmentarz$` |  |
| Pałac (krótko) | the Palace | `^Pałac$` |  |
| Klasztor (krótko) | the Monastery | `^Klasztor$` |  |
| Loch (krótko) | the Dungeon | `^Loch$` |  |
| Kuźnie (krótko) | the Forges | `^Kuźnie$` |  |
| Wraki (krótko) | the Wrecks | `^Wraki$` |  |
| Czarne Szkło (krótko) | Black Glass | `^Czarne Szkło$` | napis na mapie dla Domu z Czarnego Szkła; celowo ten sam EN co „Czarne Szkło”, tylko wielką literą |
| Wir (krótko) | the Whirl | `^Wir$` | krótka nazwa Wiru na Łysej Skale |

## Karczmy i nazwane miejsca w osadach

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Karczma „Pod Zdechłym Kogutem” | the Dead Cockerel | `Pod Zdechłym Kogutem` | karczma → tavern; w prozie i w mowie: the Dead Cockerel (na początku zdania The); na liście miejsc: The Dead Cockerel Tavern (jak Wolf's Fang) |
| Karczma „Pod Wilczym Kłem” | the Wolf's Fang | `Pod Wilczym Kłem` | na liście miejsc Brodu: The Wolf's Fang Tavern; w prozie i w mowie: the Wolf's Fang (na początku zdania The) |
| Karczma „Pod Pękniętym Dzwonem” | the Cracked Bell | `Pod Pękniętym Dzwonem` | w prozie i w mowie: the Cracked Bell (na początku zdania The); na liście miejsc: The Cracked Bell Tavern |
| Karczma „Pod Kotwicą” | the Anchor | `Pod Kotwicą` | w prozie i w mowie: the Anchor (na początku zdania The); na liście miejsc: The Anchor Tavern |
| Straż Bramy | Gate Watch | `Straż(?:\|y\|ą) Bramy` |  |
| Komnata Rdzenia | Core Chamber | `[Kk]omna(?:ta\|ty\|tę\|tą\|cie) Rdzenia` |  |
| Kramik (miejsce) | Stall | `^Kramik$` | miejsce na mapie Brodu; sklep to Stall at the Ford |
| Tablica ogłoszeń | notice board | `[Tt]ablic(?:a\|y\|ę\|ą) ogłoszeń` | jak ui map.boardTitle „Notice board”; na liście miejsc: Notice board |
| Izba na noc | Room for the night |  | miejsce w Brodzie |
| Polana ziół | Herb glade |  | Las Rubieży; w prozie the glade |
| Stary dąb z wydrążeniem | Old hollow oak |  | Las Rubieży; w zadaniu: the old oak |
| Legowisko w gęstwinie | Lair in the thicket |  | Las Rubieży |
| Ognisko zwiadowców | Scouts' campfire |  | Trakt kupiecki |
| Skrytka pod dębem | Cache under the oak |  | Leśniczówka |
| Sidła w zagajniku | Snares in the copse |  | Leśniczówka |
| Rumowisko | Rubble |  | Ruiny strażnicy |
| Obozowisko herszta | The chief's camp |  | Ostoja zbójców |
| Ukryta spiżarnia | Hidden larder |  | Ostoja zbójców |
| Zbrojownia | Armoury |  | Twierdza graniczna; pisownia brytyjska |
| Krzaki przy trakcie | Bushes by the road |  | Trakt kupiecki |
| Ślady za polaną | Tracks past the glade |  | Las Rubieży |
| Wnętrze młyna | Inside the mill |  | Stary młyn |
| Kruk między kamieniami | Raven among the stones |  | Ruiny strażnicy; zwykły ptak, nie najemnik Kruk |
| Wartownik w bramie | Sentry in the gate |  | Ruiny strażnicy (Czcibor) |
| Wartownik przy palisadzie | Sentry at the palisade |  | Wilczy Bród |
| Brama twierdzy | Stronghold gate |  | Twierdza graniczna |
| Pies przy chacie | Dog by the hut |  | Leśniczówka |
| Kramy wędrownych handlarzy | Traders' stalls |  | Głuszec; sklep to Głuszec Stalls |
| Kuźnia Bogdana: towar | Bogdan: wares |  | Głuszec; krótko, bo „Bogdan's Forge: …” ucina się na liście miejsc |
| Kuźnia Bogdana: ulepszenia | Bogdan: upgrades |  | Głuszec; jak Szkarad: upgrades |
| Szałas znachorki | The wise woman's hut |  | Głuszec (Dobrawa) |
| Dom sołtysa | The reeve's house |  | Głuszec (Wawrzyn) |
| Piwnica pod karczmą | Tavern cellar |  | Głuszec; tytuł sceny: The Cellar |
| Stara baba na ławce | Old woman on a bench |  | Głuszec; mówiący: The Old Woman |
| Chłopiec z kozą | Boy with a goat |  | Głuszec; mówiący: The Boy |
| Pijak pod płotem | Drunk by the fence |  | Głuszec; mówiący: The Drunk |
| Gajówka przy bramie | Gamekeeper's lodge |  | Głuszec (Radowit) |
| Kopacz Jerzy na cmentarzu | Jerzy the digger |  | Głuszec |
| Młyn wodny | Watermill |  | Głuszec (Radosz) |
| Szept przy studni | Whispers at the Well |  | Głuszec, tytuł sceny |
| Polana z sidłami | Clearing with snares |  | Bór kłusowników |
| Zdziczały sójkarz | Jay-whistler gone feral |  | Bór kłusowników; mówiący: The Jay-Whistler |
| Obóz maruderów | Marauders' camp |  | Bór kłusowników |
| Kamień przydrożny | Milestone |  | Stary trakt; kamienie milowe → milestones |
| Wędrowiec na kamieniu | Wanderer on a stone |  | Stary trakt |
| Wąwóz za zakrętem | Gully past the bend |  | Stary trakt; scena: The Broken Wagon |
| Wilki w koleinie | Wolves in the ruts |  | Stary trakt |
| Sakwa pod mostkiem | Bag under the bridge |  | Stary trakt; w tekście saddlebag; krótko, bo dłuższa nazwa ucinała się na liście |
| Grób przy kapliczce | Grave by the shrine |  | Kapliczka na rozstajach |
| Skrzynka przy kapliczce | Box by the shrine |  | Kapliczka na rozstajach |
| Wejście do sztolni | Tunnel mouth |  | Kamieniołom; sztolnia → tunnel |
| Ranny górnik w sztolni | Wounded miner |  | Kamieniołom; celowo ten sam EN co mówiący Ranny górnik (Wounded Miner) |
| Zbutwiała grobla | Rotten causeway |  | Bagna Szarej Wody |
| Trzcinowisko | Reed bed |  | Bagna Szarej Wody; mówiący w dialogu trzcinowiska: The Reed Bed |
| Topiel | Bog pool |  | Bagna Szarej Wody; tytuł sceny The Bog Pool |
| Szałas zielarki | The herbalist's hut |  | Bagna Szarej Wody |
| Szczyt wzgórza | Hilltop |  | Wzgórze wartownicze |
| Stary pasterz | Old shepherd |  | Wzgórze wartownicze; mówiący: The Shepherd |
| Wieża Hieronima | Hieronim's tower |  | Obserwatorium |
| Izba w czeladnej | Servants' quarters |  | Obserwatorium |
| Skrzynie z zapasami | Crates of stores |  | Obserwatorium; sklep to Starwatch Stores |
| Warsztat Brygidy: towar | Brygida: wares |  | Obserwatorium; krótko jak Bogdan: wares |
| Warsztat Brygidy: ulepszenia | Brygida: upgrades |  | Obserwatorium |
| Tablica z notatkami | Note board |  | Obserwatorium; inna niż notice board |
| Archiwum | Archive |  | Obserwatorium; słowo znane każdemu, więc zostaje mimo łacińskiego rodowodu |
| Taras na wieży | Tower terrace |  | Obserwatorium |
| Pomocnik z latarnią | Lad with a lantern |  | Obserwatorium; pomocnik Hieronima → Hieronim's lad, jak forester's lad |
| Kot Kometa | Comet the cat |  | Obserwatorium |
| Wartownik przy bramie | Sentry at the gate |  | Obserwatorium; inny niż Sentry in the gate (Czcibor w Ruinach strażnicy) |
| Skrzynka uczniów | The apprentices' box |  | Obserwatorium |
| Posłaniec z wieży | Messenger from the Tower |  | Obserwatorium, tytuł sceny |
| Pole odłamków | Field of shards |  | Pole Szkła |
| Zbieracz szkła | Glass gatherer |  | Pole Szkła; inny niż Wacław, shard gatherer |
| Odłamki do zebrania | Shards to gather |  | Pole Szkła |
| Patrol na Polu Szkła | Glass Field patrol |  | Pole Szkła; tytuł sceny: Patrol on the Glass Field |
| Kryjówka Wacława | Wacław's hideout |  | Pole Szkła |
| Brzeg krateru | Crater's edge |  | Krater Spadłej Gwiazdy |
| Człowiek na brzegu | Man on the edge |  | Krater Spadłej Gwiazdy; mówiący: Man on the Edge |
| Skrytka pustelnika | The hermit's cache |  | Krater Spadłej Gwiazdy |
| Krąg kamieni | Ring of stones |  | Krąg Menhirów |
| Stara kamieniarka | Old woman of the stones |  | Krąg Menhirów; mówiący: The Woman of the Stones (okłada menhiry mchem, nie kuje) |
| Kamień w kręgu | Stone in the ring |  | Krąg Menhirów |
| Wnętrze wraku | Inside the wreck |  | Wrak Maszyny; mówiący: Inside the Wreck |
| Serce wraku | Heart of the wreck |  | Wrak Maszyny |
| Brzeg zapadliska | Edge of the Hollow |  | Zapadlisko Ciszy |
| Człowiek, który nie mówi | Man who doesn't speak |  | Zapadlisko Ciszy; mówiący: The Mute |
| Sylwetka we mgle | Figure in the fog |  | Zapadlisko Ciszy |
| Gniazdo w Zapadlisku | Nest in the Hollow |  | Zapadlisko Ciszy |
| Brama strażnicy | Watchtower gate |  | Ostatnia Strażnica |
| Wartownik na murze | Sentry on the wall |  | Ostatnia Strażnica |
| Stary żołnierz przy bramie | Old soldier by the gate |  | Ostatnia Strażnica; wiarus → old soldier |
| Maruderzy pod wieżą | Marauders by the tower |  | Ostatnia Strażnica; tytuł sceny: Marauders Below the Tower |
| Szczelina w murze | Crack in the wall |  | Ostatnia Strażnica |
| Zgliszcza z maruderami | Ruins with marauders |  | Spalona osada |
| Ocalała piwnica | Surviving cellar |  | Spalona osada |
| Pogorzelec Chwalisław | Chwalisław in the ashes |  | Spalona osada; pogorzelec nie ma krótkiego angielskiego słowa |
| Zalana sztolnia | Flooded tunnel |  | Stara kopalnia |
| Żyła gwiezdnego żelaza | Vein of star iron |  | Stara kopalnia |
| Pustelnik Rudy | Red the hermit |  | Stara kopalnia; przydomek Rudy → Red |
| Kadłub | Hull |  | Rozbita łódź z nieba |
| Właz | Hatch |  | Rozbita łódź z nieba |
| Astronom Gwidon | Gwidon the stargazer |  | Rozbita łódź z nieba |
| Sala strażników | Guards' hall |  | Ruiny stacji |
| Archiwum stacji | Station archive |  | Ruiny stacji |
| Kustosz Jaromir | Jaromir the keeper |  | Ruiny stacji |
| Kontrola na drodze | Checkpoint on the Road |  | zdarzenie w Głuszy |
| Patrol zwiadowców | Scout Patrol |  | zdarzenie w Głuszy |
| Handlarz ze szlaku | Road Trader |  | zdarzenie; jak sklep Road Trader's Bags |
| Alchemik wędrowny | Travelling Alchemist |  | zdarzenie na Szklanych Wzgórzach; jak sklep Alchemist's Tent |

## Sklepy

Nazwy z `shops.json`.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Kram kwatermistrza | Quartermaster's Stall | `^(?:Kram kwatermistrza)$` |  |
| Wóz wędrownego kupca | Travelling Merchant's Wagon | `^(?:Wóz wędrownego kupca)$` |  |
| Kramik w Brodzie | Stall at the Ford | `^(?:Kramik w Brodzie)$` |  |
| Kramy w Głuszcu | Głuszec Stalls | `^(?:Kramy w Głuszcu)$` |  |
| Wędrowny handlarz | Travelling Trader | `^(?:Wędrowny handlarz)$` |  |
| Zapasy Obserwatorium | Starwatch Stores | `^(?:Zapasy Obserwatorium)$` |  |
| Kuźnia Zbycha | Zbych's Forge | `^(?:Kuźnia Zbycha)$` |  |
| Skrzynia Szkarada | Szkarad's Chest | `^(?:Skrzynia Szkarada)$` |  |
| Kuźnia Bogdana | Bogdan's Forge | `^(?:Kuźnia Bogdana)$` |  |
| Warsztat Brygidy | Brygida's Workshop | `^(?:Warsztat Brygidy)$` |  |
| Wóz kowala wędrownego | Travelling Smith's Wagon | `^(?:Wóz kowala wędrownego)$` |  |
| Torby handlarza ze szlaku | Road Trader's Bags | `^(?:Torby handlarza ze szlaku)$` |  |
| Namiot alchemika | Alchemist's Tent | `^(?:Namiot alchemika)$` |  |
| Kantyna | Sutler's Tent | `^(?:Kantyna)$` |  |
| Kuźnia polowa | Field Forge | `^(?:Kuźnia polowa)$` |  |
| Towary kantyniera | Sutler's Wares | `^(?:Towary kantyniera)$` |  |
| Skład Pod Murem | Store Below the Wall | `^(?:Skład Pod Murem)$` | sklep w dzielnicy Pod Murem; skrócone z „Storehouse Below the Wall”, bo nie mieściło się na liście miejsc przy 80 kolumnach (2026-11-07) |
| Pracownia szklarza | Glassmaker's Workshop | `^(?:Pracownia szklarza)$` |  |
| Kantor portowy | Port Counting House | `^(?:Kantor portowy)$` |  |
| Sklep przy stoczni | Shipyard Shop | `^(?:Sklep przy stoczni)$` |  |

## Terminy stałe

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| grosze (kwota słownie) | groat | `(?:[Jj]eden\|[Dd]wa\|[Dd]wóch\|[Tt]rzy\|[Cc]ztery\|[Kk]ilka\|\p{L}*(?:naście\|nastu\|dzieścia\|dzieści\|dziesiąt\|dziesięciu\|ieście\|ęć\|eść\|siem\|dem\|sta\|set)) grosz(?:\|e\|y\|a\|ach)` | waluta; „kilka groszy” → a few groats; „ani grosza”, „garść groszy” i podobne zwroty są wolne (a penny, a handful of coins) |
| gr (skrót waluty) | gr | `\d+ gr` | skrót zostaje „gr”, jako osobne słowo |
| burza iskier | spark storm | `[Bb]urz(?:a\|y\|ę\|ą\|e\|ami) iskier` | próbki; celowo ten sam EN co nazwa zjawiska „Burza iskier” |
| kamień z nieba | stone from the sky | `[Kk]amie(?:ń\|nia\|niem\|niu) z nieba` | próbki; l. mn. stones from the sky |
| Matka (bogini) | Mother | `Matk(?:a\|i\|ę\|ą\|o\|ce) Bo(?:ska\|skiej\|ską\|sko)\|(?<=Niech (?:cię\|ci\|was\|go\|ją) )Matka` | bogini; „Matka Boska” → Mother of God; zwykła matka („Matka mieszka w Głuszcu”) jest wolna |
| Bóg | God | `B(?:óg\|oga\|ogu\|ogiem\|oże)` | z wielkiej litery; „Bóg zapłać” → God repay you (wiersz niżej), „Boże broń” → God forbid |
| Bóg zapłać | God repay you |  | podziękowanie; wraca w dalszych aktach; nie „God bless you” |
| Kupała | Kupała | `Kupa(?:ła\|ły\|łę\|łą\|le)` | słowiańskie święto, zostaje: Kupała Night |
| zakonnice | nun | `[Zz]akonnic(?:a\|e\|y\|ę\|ą\|ami\|om)` |  |
| Strefa zamknięta | closed ground | `[Ss]tref(?:a\|y\|ie\|ę\|ą) zamknięt(?:a\|ej\|ą)` | mowa strażników z Wiru: krótka i obca; bez współczesnego „restricted area”; EN małą literą, więc w zdaniu może stać „Closed ground.” |
| ocalały | survivor | `[Oo]calał(?:y\|ego\|emu\|ym\|ych\|ymi)` | bohater i ci, których szukają |
| szkoła ostrza | School of the Blade | `[Ss]zko(?:ła\|ły\|łę\|łą\|le) ostrza` |  |
| delegacja | tribute party | `[Dd]elegacj(?:a\|i\|ę\|ą)` | grupa ze szkoły wysłana jako żywa danina |
| danina | tribute | `[Dd]anin(?:a\|y\|ie\|ę\|ą)` | żywa danina → living tribute |
| artefakt | relic | `[Aa]rtefakt(?:\|u\|em\|owi\|y\|ów\|om\|ami\|ach)` | przedmiot z gwiezdną siłą; też rodzaj przedmiotu |
| gwiezdny | star | `[Gg]wiezdn(?:y\|ego\|emu\|ym\|a\|ej\|ą\|e\|ych\|ymi)` | gwiezdne żelazo → star iron; obrażenia gwiezdne → star (też typ obrażeń) |
| upiór | wraith | `[Uu]pi(?:ór\|ora\|orem\|orowi\|orze\|ory\|orów\|orom\|orami\|orach)` |  |
| Noc upiorów | Night of Wraiths | `Noc(?:y)? [Uu]piorów` |  |
| Istota | Being | `Isto(?:ta\|ty\|tą\|tę\|cie)` | ta z gwiazd: the Being; z wielkiej litery |
| Szklanna | Szklanna | `Szklann(?:a\|ej\|ą\|ę)` | imię nadane przez wyspiarzy; zostaje |
| Rdzeń | Core | `Rdze(?:nia\|niem\|niowi\|niu)` | the Core pod pałacem; tylko przypadki zależne, bo mianownik „Rdzeń” bywa też rdzeniem z wraku (przedmiot) |
| Pełnomocnik | Steward | `Pełnomocnik(?:\|a\|iem\|owi\|u)` | sługa Rdzenia: the Steward |
| Wir (ten z gwiazd) | Whirl | `Wir(?:\|u\|em\|owi\|ze)(?! obraca się tak wolno)` | z przedimkiem: the Whirl; z wielkiej litery; wyjątek: „wir” w urządzeniu z wraku, też na początku zdania |
| Schody (poziomy lochu) | Stair | `^Schody(?:, \p{L}+ poziom)?$` | the Stairs, First Level; tylko tytuły i nazwa miejsca, bo w prozie „schody” są zwykłe; „Upiór schodów” → Stair Wraith |
| Ostrze Gwiazd | Blade of the Stars | `Ostrz(?:e\|a\|u\|em) Gwiazd` | nazwa przedmiotu, nie tytuł gry |
| Para Gwiazd | Pair of Stars | `Par(?:a\|y\|ę\|ą\|ze) Gwiazd` | para włóczni |
| Kamień Zmierzchu | Dusk Stone | `Kami(?:eń\|enia\|eniem) Zmierzchu` | relikt |
| obława | manhunt | `[Oo]bła(?:wa\|wy\|wie\|wę\|wą)` | też stopień poszukiwań |
| sztab (wojskowy) | command |  | „pieczęć sztabu” → the command's seal; bez współczesnego „headquarters” i „staff” |
| żołd | pay |  | jak w nazwach Purse of pay, Pay chest |
| plac ćwiczeń | drill yard | `[Pp]la(?:c\|cu\|cem) ćwiczeń` | plac w szkole ostrza, gdzie musztruje Drillmaster; „na placu ćwiczą” to czasownik, wolne |
| walka ćwiczebna | practice bout | `[Ww]alk(?:a\|ę\|i\|ą) ćwiczebn(?:a\|ą\|ej)` | sparing w prologu; tytuł sceny Practice Bout |
| uczeń (prolog) | pupil |  | uczniowie szkoły ostrza: the pupils; zwrot „uczniu” → boy; uczeń Hieronima to apprentice (Zawody) |
| Kram (tytuł sceny) | the Stall | `^Kram$` | scena w prologu: The Stall; kram kwatermistrza w sklepie to Quartermaster's Stall |
| pała (prolog) | club | `pał(?:a\|y\|ę\|ą\|om\|ami\|ach)` | „drewniana pała” w prologu → wooden club; atak wrogów „Pałka” to Cudgel, celowo inne słowo (tu nie „cudgel”) |
| Bywaj. (odpowiedź) | Take care. | `^Bywaj\.$` | cała odpowiedź gracza; w dłuższej kwestii („Dobrze wiedzieć. Bywaj.”) wolno oddać swobodnie |
| Bywajcie. (odpowiedź) | Take care | `^Bywajcie\.$` | cała odpowiedź gracza; do kilku osób → Take care, all.; do jednej osoby w formie grzecznościowej (np. do starszej kobiety) → Take care. |
| Bywaj, dziadku. (odpowiedź) | Take care, grandad. | `^Bywaj, dziadku\.$` | cała odpowiedź gracza |
| Dalej. (odpowiedź) | Onward. | `^Dalej\.$` | tylko kwestia w dialogu; przycisk interfejsu camp.continue „Dalej” to Continue (etykieta, nie mowa) |
| stolica | the capital |  | bez nazwy, póki gracz jej nie zna; Ulfgród ma swój wiersz |
| Wasza Wysokość (do muła) | Your Highness | `Wasz(?:a\|ej\|ą) Wysokoś(?:ć\|ci)` | tak się mówi do muła Cesarza |
| mundur | uniform |  | tylko wojsko: cesarski mundur → imperial uniform; mundur szkoły ostrza → the school's colours albo tunic in the school's colours, nigdy „school uniform” (to dzisiejsi uczniowie) |
| insygnia | insignia | `[Ii]nsygni(?:a\|ów\|ach\|ami)` | insygnia delegacji, szkoły |
| bimber (w prozie) | rotgut | `[Bb]imb(?:er\|ru\|rem\|rze)` | celowo ten sam EN co przedmiot Bimber (Rotgut) |
| zbój / zbójca | brigand | `[Zz]bój(?:e\|ów\|ami\|om\|ach\|ca\|cy\|ców\|com\|cami\|cach)` | jak Herszt zbójców i Ostoja zbójców; przymiotnik zbójecki → brigand's |
| rozbójnik | robber | `[Rr]ozbójni(?:k\|ka\|cy\|ków\|kami\|kom\|kach)` | celowo ten sam EN co wróg Rabuś (Robber) |
| zbir | thug | `[Zz]bir(?:\|a\|y\|ów\|ami\|om\|ach)` |  |
| herszt | chief | `[Hh]ersz(?:t\|ta\|towi\|tem\|cie)` | herszt zbójców → Brigand Chief; sam herszt → the chief |
| wiarus | old soldier |  | stary żołnierz; celowo ten sam EN co mówiący Stary żołnierz (Old Soldier) |
| weksel | promissory note | `[Ww]eks(?:el\|la\|lem\|lu\|le)` | nie „bill” (dziś: rachunek); celowo ten sam EN co przedmiot Weksel kupca |
| pokwitowanie (w prozie) | receipt | `[Pp]okwitowani(?:e\|a\|em\|u)` | celowo ten sam EN co przedmiot Pokwitowanie (Receipt) |
| kłusownik (w prozie) | poacher |  | celowo ten sam EN co wróg Kłusownik (Poacher) |
| Rzeka (napis na mapie) | River |  | mapa Pogórza |
| dalekie szlaki (dni drogi) | distant trails (days away) |  | napis na mapie regionu |
| kontrahent | contracting party |  | chłodny język umowy w zapisie w szkle (Istota i jej strona); wynajem/wynajęty → hire/on hire |
| Nie stać cię (sklep) | Too dear. |  | podpowiedź przy wierszu, na który bohatera nie stać; „Can't afford.” ucinało wiersz Oka nocy u Brygidy |
| gorzałka | vodka |  | nie „hooch” ani „spirits”; jak w Wiedźminie |
| werbować (siłą) | press-gang |  | branka do wojska cesarskiego |
| kwit | chit |  | papierek urzędowy albo zamiast zapłaty: kwity sołtysa Wawrzyna, kwit cesarskich posłańców u Bogdana; inne niż Receipt (pokwitowanie) |
| fałszywy pielgrzym | false pilgrim |  | donosiciel cesarskich w Głuszcu (dialog pielgrzym_falszywy, sołtys) |
| gród (osada warowna) | town |  | sołtys o Beckby: „najbliższy większy gród” → the nearest proper town |
| strzelba | gun |  | stara strzelba gajowego Radowita; nie handgun (to rusznica) |
| wiorsta | mile |  | „na pięć wiorst” → from miles off; „verst” zna mało kto |
| tabliczka (do pisania) | wax tablet |  | zwiadowcy zapisują na niej podejrzanych (kontrola, kontrola_droga); dawniej „notes” |

## Ludy i frakcje

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Cesarstwo | Empire | `[Cc]esarstw(?:o\|a\|u\|em\|ie)` | Empire/Emperor zostają, przyjęte w próbkach |
| Cesarz | Emperor | `[Cc]esarz(?:\|a\|owi\|em\|u)` | też muł imieniem Cesarz: Emperor |
| cesarski / cesarscy | imperial | `[Cc]esars(?:ki\|kiego\|kiemu\|kim\|ka\|kiej\|ką\|kie\|cy\|kich\|kimi\|ku)` | cesarscy → the Imperials; „po cesarsku” → the imperial way |
| czerwone płaszcze | red cloak | `[Cc]zerwon(?:e\|ych\|ym\|y\|ymi) płaszcz(?:\|e\|ach\|u\|ami)` | ludzie cesarza: the Red Cloaks |
| Najazd | the Incursion | `Najaz(?:d\|du\|dowi\|dem)` | jarnowska armia na froncie: the Incursion; z wielkiej litery |
| Próg | the Threshold |  | miejsce w akcie IV; zatwierdzone przez użytkownika 2026-11-07 |
| galeria szeptów | the Gallery of Whispers |  | akt IV; zatwierdzone przez użytkownika 2026-11-07 |
| śluza kablowa | Cable Lock |  | akt IV (pod stolicą); zatwierdzone przez użytkownika 2026-11-07 |
| Jarnowianie / jarnowski | Jarnowian | `[Jj]arnowian(?:\|ie\|in\|ina\|inem\|ach\|ami\|om)\|[Jj]arnowsk(?:i\|iego\|iemu\|im\|a\|iej\|ą\|ie\|ich\|imi)\|[Jj]arnowscy` | Jarnowianie → Jarnowians |
| wyspiarze | islander | `[Ww]yspiar(?:ze\|zy\|z\|zom\|za\|zami\|zach\|zowi)` |  |
| wyspiarski | island | `[Ww]yspiarsk(?:i\|a\|ie\|iej\|ich\|ą\|iego\|im)` | przymiotnik |
| cerkiew | church |  | bez „Orthodox”; decyzja użytkownika 2026-11-07 |
| Cesarscy zwiadowcy | imperial scout | `[Cc]esars(?:ki\|kiego\|kim\|cy\|kich\|kimi\|kiemu) zwiadowc(?:a\|y\|ę\|ów\|om\|ami\|ach\|ą)\|zwiadowc(?:a\|y\|ów\|om\|ami\|ach) cesars(?:cy\|kich\|kimi\|ki)` | też wróg „Cesarski zwiadowca” (Imperial Scout) |

## Mówiący bez imienia

Pole `speaker` w dialogach, gdy mówi ktoś bez imienia albo miejsce. Przedimek „The” stoi w pasku przy jedynym miejscu albo jedynej postaci znanej z roli (The Being, The Forester, The Old Oak, The Battleground, The Crossroads); przypadkowo spotkani ludzie są bez przedimka (Wanderer, Scout, Widow by the Road). Wyrażenia z przyimkiem i nazwy chwil zostają bez niego (Behind the Wagon, Round the Corner, Halt by the Fire).

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Cesarski kurier | Imperial Courier | `^Cesarski kurier$` | w prozie: the courier |
| Brama szkoły | School Gate | `^Brama szkoły$` | brama szkoły ostrza |
| Zza węgła | Round the Corner | `^Zza węgła$` | podsłuchana rozmowa |
| Zza wozu | Behind the Wagon | `^Zza wozu$` | podsłuchani zwiadowcy na Trakcie kupieckim |
| Pobojowisko | the Battleground | `^Pobojowisko$` | ranek po nocy upiorów; inne niż „Pole bitwy” (the Battlefield) na froncie |
| Rozdroże | the Crossroads | `^Rozdroże$` | słup na rozwidleniu w drodze do Brodu |
| Popas przy ognisku | Halt by the Fire | `^Popas przy ognisku$` | postój z delegacją w drodze |
| Stary dąb | the Old Oak | `^Stary dąb$` | dąb z dziuplą w Lesie Rubieży (miejsce: Old hollow oak) |
| Wędrowiec | Wanderer | `^Wędrowiec$` | mówiący; w prozie „wędrowiec” → wanderer |
| Wdowa przy drodze | Widow by the Road | `^Wdowa przy drodze$` |  |
| Córka strażnika | the guard's daughter | `^Córka strażnika$` | jak punkt w Brodzie (The guard's daughter); w pasku mówiącego: The Guard's Daughter |
| Zwiadowca przy koniu | scout by his horse | `^Zwiadowca przy koniu$` | jak punkt na Trakcie kupieckim (Scout by his horse); w pasku mówiącego: Scout by His Horse |
| Żona Borka | Borek's Wife |  | mówiący; punkt w Brodzie: Borek's wife |
| Droga | the Road | `^Droga$` | mówiący przy znaleziskach na drodze; celowo ten sam EN co Trakt (krótko) |
| Astronom Hieronim | Hieronim the Stargazer |  | mówiący (z imieniem, jak Zbych the Smith); w prozie: Hieronim the stargazer; jego „waść” → good sir |
| Głos z rdzenia | Voice from the Machine Core |  | Istota mówi przez rdzeń z wraku (przedmiot Machine core); nie „the Core” spod pałacu; w prozie: the core |
| Głos z kamieni | Voice from the Grave |  | trzy kamienie na grobie (cmentarz w Głuszcu); nie „the Stones” (Krąg Menhirów) |
| Zapis w szkle | Record in the Glass |  | finał aktu III (zagłębienie między odłamkami, akt3b_final); głosy: First Voice, Second Voice |
| Kuźnia w Obserwatorium | Starwatch Forge |  | kucie Ostrza Gwiazd; w prozie: the forge below Starwatch |
| Stary żołnierz | Old Soldier |  | celowo ten sam EN co wiarus; mówiący w Ostatniej Strażnicy (punkt: Old soldier by the gate); w prozie: the old soldier |
| Ranny górnik | Wounded Miner |  | celowo ten sam EN co punkt Ranny górnik w sztolni; mówiący w sztolni Kamieniołomu; w prozie: the miner |
| Najemnik Kruk | Raven the Sellsword |  | mówiący; w prozie: Raven the sellsword |
| Pielgrzym z bukłakiem | Pilgrim with a Wineskin |  | fałszywy pielgrzym w Głuszcu; bukłak → wineskin, jak u znachorki i sołtysa |
| Zaginiony zwiadowca | Lost Scout |  | Tomasz we mgle Zapadliska (punkt: Figure in the fog), potem Tomasz the Scout |
| Gościniec (mówiący) | the Highway |  | mówiący przy znaleziskach koło gościńca; celowo ten sam EN co gościniec (highway) |
| Strumień (mówiący) | the Stream |  | mówiący przy znalezisku nad strumieniem (rozbity obóz) |
| Szkło (mówiący) | the Glass |  | mówiący przy odłamkach na Szklanych Wzgórzach (szept ze szkła, ścieżka z kamieni); inne niż Pole Szkła (Glass Field) |
| Zielarka Żywia | Żywia the Herbalist |  | mówiąca w szałasie zielarki (dostawa kobiałki) |
| Zielarz Mirogost | Mirogost the Herbalist |  | mówiący; w zadaniu: a travelling herbalist |
| Zbłąkany uczeń | Stray Apprentice |  | uczeń Hieronima z kajetem; w zadaniu: a stray apprentice |
| Zbieracz Wacław | Wacław the Shard Gatherer |  | mówiący; jak Zbieracz odłamków (shard gatherer) |
| Umierający żołnierz | Dying Soldier |  | ostatni list żołnierza |
| Świecarz Tobiasz | Tobiasz the Chandler |  | mówiący |
| Uczony Anzelm | Anzelm the Scholar |  | mówiący; astronom z Obserwatorium, sam o sobie: stargazer at Starwatch |
| Skrzynka uczniów, Kryjówka Wacława, Grób przy kapliczce, Skrzynka przy kapliczce, Skrytka pustelnika (mówiący) | The Apprentices' Box, Wacław's Hideout, Grave by the Shrine, Box by the Shrine, The Hermit's Cache |  | w pasku mówiącego wielkimi literami; punkty na mapie jak w tabeli miejsc |

## Stopnie poszukiwań

Poziomy z `ui.json` (`search.level.*`). Wzorzec obejmuje tylko sam wpis.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Poszukiwania | Search | `^Poszukiwania: \{level\}$` | wiersz na mapie: „Search: {level}” |
| spokój (poszukiwania) | calm | `^spokój$` |  |
| czujność | alert | `^czujność$` |  |
| pościg | pursuit | `^pościg$` | w zwykłym tekście „pościg” wolne (chase) |

## Stopnie i godności

Stopień stoi przed imieniem: Captain Bratosław, Sergeant Gniewosz. Wzorzec działa tylko wtedy, gdy po stopniu idzie imię z wielkiej litery.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Komendant | Commander | `[Kk]omendan(?:t\|ta\|towi\|tem\|cie)(?= \p{Lu})` | Komendant Wszebor → Commander Wszebor |
| Kapitan | Captain | `[Kk]apitan(?:\|a\|owi\|em\|ie)(?= \p{Lu})` | kapitan przystani → harbour captain |
| Kapral | Corporal | `[Kk]apral(?:\|a\|owi\|em\|u)(?= \p{Lu})` |  |
| Sierżant | Sergeant | `[Ss]ierżan(?:t\|ta\|towi\|tem\|cie)(?= \p{Lu})` |  |
| Porucznik | Lieutenant | `[Pp]orucznik(?:\|a\|owi\|iem\|u)(?= \p{Lu})` |  |
| Setnik | Sotnik | `[Ss]etnik(?:\|a\|owi\|iem\|u)(?= \p{Lu})` | słowiański stopień, decyzja użytkownika |
| Hetman | Hetman | `[Hh]etman(?:\|a\|owi\|em\|ie)(?= \p{Lu})` | słowo znane po angielsku, zostaje |
| Kwatermistrz | Quartermaster | `[Kk]watermistrz(?:\|a\|owi\|em\|u)(?= \p{Lu})` |  |
| Marszałek | Marshal | `[Mm]arsza(?:łek\|łka\|łkowi\|łkiem\|łku)(?= \p{Lu})` |  |
| Bosman | Boatswain | `[Bb]osman(?:\|a\|owi\|em\|ie)(?= \p{Lu})` |  |
| Szyper | Skipper | `[Ss]zyp(?:er\|ra\|rowi\|rem\|rze)(?= \p{Lu})` |  |
| Siostra | Sister | `[Ss]iostr(?:a\|y\|ze\|ę\|ą\|o)(?= \p{Lu})` | też zwrot „siostro” → sister |
| Mistrz | Master | `[Mm]istrz(?:\|a\|owi\|em\|u)(?= \p{Lu})` |  |
| Instruktor | Drillmaster | `[Ii]nstruktor(?:\|a\|owi\|em\|ze)(?= \p{Lu})` | musztruje w szkole ostrza; bez łacińskiego „Instructor” |

## Przydomki

Przydomek z pospolitego słowa jest tłumaczony (decyzja użytkownika z 2026-11-04), jak Jaskier → Dandelion. Prawdziwe imiona zostają po polsku.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Mruk | Grumble | `Mru(?:k\|ka\|kowi\|kiem\|ku)\|Mrukow(?:y\|ego\|emu\|ym\|a\|ej\|ą\|e\|ych\|ymi)` | karczmarz; mruk = małomówny burczący człowiek; „Mrukowe pchły” → Grumble's fleas |
| Atrament | Ink | `Atramen(?:t\|tu\|towi\|tem\|cie)` | pisarz |
| Pieczątka | Seal | `Pieczą(?:tka\|tki\|tkę\|tką\|tko\|tce)` | skarbnik |
| Łopata | Shovel | `Łopa(?:ta\|ty\|tę\|tą\|to\|cie)` | grabarz |
| Gwóźdź | Nail | `Gw(?:óźdź\|oździa\|oździowi\|oździem\|oździu)` | dłużnik; „Gwoździe” z wielkiej to zwykłe gwoździe |
| Rzepa | Turnip | `Rze(?:pa\|py\|pę\|pą\|po\|pie)` | przekupka |
| Skorupa | Shard |  | alchemik z Zaułka Garncarzy (akt IV); przydomek; zatwierdzone przez użytkownika 2026-11-07 |
| Zgryzota | Gloom | `Zgryzo(?:ta\|ty\|tę\|tą\|to\|cie)` | alchemik; zgryzota = zmartwienie |
| Żerdź | Pole | `Żer(?:dź\|dzi\|dzią)` | przewoźnik |
| Gruby | Paunch | `(?<=[Ss]ierżan\p{L}* )Grub(?:y\|ego\|emu\|ym)` | sierżant; tylko po stopniu, bo „Gruby” na początku zdania to przymiotnik |
| Cienki | the Lean | `(?<=Wojmir\p{L}* )Cienk(?:i\|iego\|iemu\|im)` | Wojmir Cienki → Wojmir the Lean |
| Burczymucha | Crosspatch | `Burczymuch(?:a\|y\|ę\|ą\|o\|sze)` | kwatermistrz; burczymucha = zrzęda, crosspatch to stary przydomek zrzędy |
| Gwizd | Whistle | `Gwiz(?:d\|da\|dowi\|dem\|dzie)` | szuler; z wielkiej litery |
| Smyk | Nipper | `Smy(?:k\|ka\|kowi\|kiem\|ku)` | chłopak; nipper = stare słowo na małego chłopca |
| Kruk | Raven | `Kru(?:k\|ka\|kowi\|kiem\|ku)(?! (?:między kamieniami\|odwraca się do ciebie ogonem))` | najemnik; ptak z Ruin strażnicy („Kruk między kamieniami”, „Kruk odwraca się… ogonem”) jest wyjęty, bo to zwykły raven małą literą |
| Gnat | Bones | `Gna(?:t\|ta\|towi\|tem\|cie)` | kuchcik; gnat = kość |
| Kometa | Comet | `Kome(?:ta\|ty\|tę\|tą\|to\|cie)` | kot |
| Rudy | Red | `Rud(?:y\|ego\|emu\|ym)` | pustelnik i dawny górnik ze Starej kopalni; rudy = rudowłosy; tylko z wielkiej litery; „Rude” w opisie futra to przymiotnik, wolne |

## Zawody

Zawód idzie za imieniem, w prozie małą literą: Grumble the innkeeper, Zbych the smith. W polu `speaker` z wielkiej: Grumble the Innkeeper. Bez wzorca, bo szyk zdania się zmienia.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Karczmarz | innkeeper |  |  |
| Kowal | smith |  | speaker: Zbych the Smith, Bogdan the Smith |
| Kowal polowy | field smith |  | kowal z Kuźni polowej (Field Forge), bez imienia; speaker: Field Smith |
| Młynarz | miller |  |  |
| Młynarka | miller's wife |  |  |
| Kupiec | merchant |  |  |
| Astronom | stargazer |  |  |
| Mechanik | handyman |  | złota rączka od maszyn, nie współczesny mechanik; o kobiecie handywoman: Brygida the Handywoman (speaker); „klucz” w jej rękach to spanner, nie „Key” z zadania |
| Pisarz | scribe |  |  |
| Sołtys | reeve |  |  |
| Rusznikarz | gunsmith |  | speaker: Szkarad the Gunsmith (Rusznikarz Szkarad) |
| Kantynier / Kantynierka | sutler |  |  |
| Znachorka | wise woman |  |  |
| Znachor | cunning man |  | stare angielskie określenie wiejskiego znachora |
| Garbarz | tanner |  |  |
| Kuśnierz | furrier |  |  |
| Medyczka | healer |  |  |
| Szuler | cardsharp |  |  |
| Najemnik | sellsword |  |  |
| Druciarz | tinker |  |  |
| Kopacz | digger |  |  |
| Gajowy | gamekeeper |  |  |
| Leśniczy | forester |  |  |
| Furman | carter |  |  |
| Przewoźnik | ferryman |  |  |
| Pasterz | shepherd |  |  |
| Grabarz | gravedigger |  |  |
| Dozorca | caretaker |  | Wincenty, dozorca Kamieniołomu: Wincenty the caretaker |
| Dłużnik | debtor |  |  |
| Alchemik | alchemist |  |  |
| Zielarz / Zielarka | herbalist |  |  |
| Zbieracz | gatherer |  |  |
| Uczony | scholar |  |  |
| Szewc | cobbler |  |  |
| Świecarz | chandler |  |  |
| Rymarz | saddler |  |  |
| Piekarka | baker |  |  |
| Goniec | runner |  |  |
| Kurier | courier |  |  |
| Przekupka | market woman |  |  |
| Skarbnik | treasurer |  |  |
| Pustelnik | hermit |  |  |
| Celnik | customs man |  | stary celnik Mirosz → Mirosz the customs man |
| Kustosz | keeper |  |  |
| Posłaniec | messenger |  |  |
| Bortnik | beekeeper |  |  |
| Drwal | woodcutter |  |  |
| Cieśla | carpenter |  |  |
| Wartownik | sentry |  |  |
| Strażnik | guard |  |  |
| Zwiadowca | scout |  |  |
| Dowódca patrolu | patrol leader |  |  |
| Herold | herald |  |  |
| Żebrak | beggar |  |  |
| Rybak | fisherman |  |  |
| Żeglarz | sailor |  |  |
| Pielgrzym | pilgrim |  |  |
| Wdowa | widow |  |  |
| Handlarz | trader |  |  |
| Kramarz | pedlar |  |  |
| Kuchcik | kitchen boy |  |  |
| Rzezimieszek | cutthroat |  |  |
| Dezerter | deserter |  |  |
| Uczeń (Hieronima) | apprentice |  |  |
| Złomiarz | scrap man |  |  |
| Gospodyni | farmwife |  | Gospodyni z kurami → Farmwife with hens |
| Pomocnik leśniczego | forester's lad |  | Gniewosz z Leśniczówki |
| Myśliwy | hunter |  |  |
| Górnik | miner |  | ranny górnik z Kamieniołomu |
| Zbieracz odłamków | shard gatherer |  | Wacław z Pola Szkła; sam „Zbieracz” → gatherer |
| Kamieniarz | stonemason |  | kuje nagrobki w Kamieniołomie |
| Wędkarz | angler |  | Bagna Szarej Wody |
| Sójkarz | jay-whistler |  | były leśnik w Borze kłusowników, gwiżdże na sójki |
| Pomocnik (Hieronima) | lad |  | Hieronim's lad, jak forester's lad; mówiący: The Lad |
| Niemy | mute |  | Zapadlisko Ciszy; mówiący: The Mute |

## Terminy interfejsu i walki

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| PA (punkty akcji) | AP | `PA` | skrót; „Punkty akcji” → Action points |
| Punkty akcji | Action points | `^Punkty akcji$` |  |
| Biegłość | mastery | `[Bb]iegłoś(?:ć\|ci\|cią)` | biegłość w broni; EN małą literą, bo słowo pada też w prozie |
| Atak obiema | Strike with both | `^Atak obiema$` | technika walki |
| Uderz i zasłoń | Strike and guard | `^Uderz i zasłoń$` | technika walki |
| Odskok ze strzałem | Step back and shoot | `^Odskok ze strzałem$` | technika walki |
| Gotowość do ciosu | Ready to strike | `^Gotowość do ciosu$` | technika walki |
| Zasłona Zmierzchu | Dusk Shroud | `Zasło(?:na\|ny\|nę\|ną\|nie) Zmierzchu` | zdolność Kamienia Zmierzchu; inna niż efekt „Zasłona” (Veil) |
| Żar ostrza | Blade ember | `^Żar ostrza$` | zdolność Miecza Gwiazd |
| Powrót do ręki | Back to hand | `^Powrót do ręki$` | zdolność Pary Gwiazd |
| Iskry (umiejętność włóczni) | Sparks | `^Iskry$` | zdolność Pary Gwiazd; iskry w prozie wolne |
| Iskra (atak Kustosza) | Spark | `^Iskra$` | atak Kustosza Kabli |
| umiejętność wiodąca | tagged skill | `[Uu]miejętnoś(?:ć\|ci\|cią) wiodąc(?:a\|ą\|ej\|e\|ych\|ymi)` | „wiodąca” sama (karta postaci) → tagged |
| perk / talent | perk | `[Pp]erk(?:\|a\|i\|ów\|iem)\|[Tt]alent(?:\|u\|y\|ów\|em\|ami)` | jedno słowo po angielsku dla obu polskich |
| ładunek | charge | `(?<!każdy \|pan cały \|Zatapiam )[Łł]adun(?:ek\|ku\|kiem\|ki\|ków)` | ładunek artefaktu; „ładunek pełny” → full charge; ładunek wozu („każdy ładunek” przy bramie, akt IV) → load; ładunek łodzi (akt V, zatopiony) → cargo |
| zjawisko | phenomenon | `[Zz]jawisk(?:o\|u\|iem)` | decyzja użytkownika z 2026-11-06: zostaje mimo perspektywy, jako termin gry; l. mn. w osobnym wierszu |
| zjawiska (l. mn.) | phenomena | `[Zz]jawisk(?:\|a\|ami\|ach\|om)` | angielska liczba mnoga jest nieregularna; dopełniacz l. poj. „zjawiska” też tu trafia, więc w takim zdaniu angielski musi mieć „phenomena” albo inne ujęcie |
| pas (do ekwipunku) | belt | `(?<!po )[Pp]as(?:\|a\|ie\|em)` | pas szybkiego dostępu i pas jako część stroju; inne „pasy” (pas ziemi) są w danych rzadkie, sprawdzić przy przekładzie; „po pas” (do talii, trzcinowisko) → to the waist, wyjęte |
| zadanie | quest | `[Zz]adani(?:e\|a\|u\|em\|om\|ami\|ach)\|[Zz]adań` | zadanie z dziennika |
| zlecenie | job | `[Zz]leceni(?:e\|a\|u\|em\|om\|ami\|ach)\|[Zz]leceń` | poboczna robota z tablicy i od ludzi |
| zdolność | ability | `[Zz]dolnoś(?:ć\|ci\|cią\|ciami\|ciach)` | zdolność artefaktu: relic ability |
| niewypał / zawodzi (broń palna) | misfire | `[Nn]iewypa(?:ł\|łu\|ły\|łów\|łem\|łami)` | broń palna, która nie strzeli: misfire (czasownik i rzeczownik); „zawodzi” o pistolecie też → misfires, ale bez wzorca, bo „zawodzi” bywa też płaczem; rdzeń „niewy…” łapie też „niewykonane” i „niewyraźnie”, inne słowa |
| torba | bag | `(?<!z )[Tt]orb(?:a\|y\|ie\|ę\|ą\|ach\|ami)` | decyzja użytkownika z 2026-11-06: w grze zawsze torba, nigdy „plecak” (anachronizm); po angielsku zawsze bag, nigdy pack; „puścić z torbami” = idiom, wolne (to beggar) |
| leszy | leshy | `[Ll]esz(?:y\|ego\|emu\|ym)` | duch lasu ze słowiańskich wierzeń; zostaje jako zapożyczenie |
| mora | night-hag | `[Mm]or(?:a\|y\|ę\|ą)` | słowiańska zmora, która siada śpiącemu na piersi; nigdy „plague” (mór to inne słowo: moru); wzorzec celowo nie łapie innych słów: morze (morza, morzu, morzem), morale |
| strzyga (w porównaniu) | lost soul |  | „snuje się jak strzyga” → drifts round like a lost soul; strzygi jako stwory: wiersz niżej |
| strzyga (stwór) | striga |  | „zza przełęczy przychodzą strzygi” → strigas come from over the pass; zapożyczenie jak w angielskim Wiedźminie, a z kontekstu (nie patrzeć w oczy) jasne, że to upiorny stwór; „lost soul” tylko w porównaniu |
| topielec | drowner |  | ludowy topielec z bagien; celowo ten sam EN co wróg Utopiec (Drowner) |
| błędny ognik | wisp |  | celowo ten sam EN co wróg Błędnik (Wisp) |
| skrzat | hob |  | „figura w czapce”, skrzat z Zapadliska; jak w nazwie wroga Skrzat-złośnik (Vicious Hob) |
| luneta | spyglass |  | ręczna luneta zwiadowcy, Gwidona i patrolu; strzaskany teleskop na kopule to telescope |
| kajet | notebook |  | Gwidon i uczeń Hieronima; jak w przedmiocie Kajet ucznia (Apprentice's notebook) |
| gościniec | highway |  | szeroka droga, po której jeżdżą wozy; nie Old Road (Stary trakt) |
| list gończy | wanted notice | `[Ll]i(?:st\|stu\|stem\|ście) gończ\p{L}*` | bez współczesnego „warrant” |
| znak (amulet strażniczy w mowie) | token |  | „taki znak jak ten twój” → a token like yours; przedmiot to Guard's amulet |
| teleskop | telescope |  | strzaskany teleskop na kopule Obserwatorium; świat zna broń skałkową, więc teleskop pasuje do epoki, a słowo zna każdy (bez rzadkiego „spyglass” dla dużego przyrządu) |
| rozdroże (w przenośni) | the parting of the ways |  | chwila wyboru bez powrotu: „Rozdroże jest blisko” → The parting of the ways is near (zadanie Przygotowania), „rozdroże blisko” (Hieronim); miejsce i mówiący Rozdroże z aktu II to the Crossroads |
| sztolnia | tunnel |  | sztolnia kamieniołomu → the Quarry tunnel; bez rzadkiego „adit” |

## Atrybuty

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Siła | Strength | `^(?:Siła)$` | pospolite słowo: wzorzec tylko na samą nazwę |
| Zręczność | Agility | `Zręcznoś(?:ć\|ci\|cią)` |  |
| Krzepa | Endurance | `Krzep(?:a\|y\|ę\|ą\|ie)` |  |
| Bystrość | Perception | `Bystroś(?:ć\|ci\|cią)` |  |
| Rozum | Wits | `^(?:Rozum)$` | pospolite słowo: wzorzec tylko na samą nazwę |
| Ogłada | Charm | `Ogład(?:a\|y\|ę\|ą\|zie)` |  |
| Fart | Luck | `^(?:Fart)$` | pospolite słowo: wzorzec tylko na samą nazwę |

## Umiejętności i klasy

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Broń sieczna | Bladed weapons | `^(?:Broń sieczna)$` |  |
| Broń drzewcowa | Polearms | `^(?:Broń drzewcowa)$` |  |
| Łuk i kusza | Bow and crossbow | `^(?:Łuk i kusza)$` |  |
| Broń palna | Firearms | `^(?:Broń palna)$` | też biegłość „Broń palna” |
| Walka wręcz | Brawling | `^(?:Walka wręcz)$` |  |
| Miotanie | Throwing | `^(?:Miotanie)$` |  |
| Medycyna | Healing | `^(?:Medycyna)$` |  |
| Skradanie | Stealth | `^(?:Skradanie)$` |  |
| Wymowa | Speech | `^(?:Wymowa)$` |  |
| Handel | Trade | `^(?:Handel)$` |  |
| Wiedza tajemna | Hidden lore | `^(?:Wiedza tajemna)$` |  |
| Klasa miecza | Sword class | `^(?:Klasa miecza)$` | klasa postaci |
| Klasa włóczni | Spear class | `^(?:Klasa włóczni)$` | klasa postaci |

## Biegłości (rodzaje broni)

Z `ui.json` (`mastery.*`). „Broń palna” jest w umiejętnościach.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Miecz | Sword | `^(?:Miecz)$` |  |
| Włócznie | Spears | `^(?:Włócznie)$` |  |
| Łuk | Bow | `^(?:Łuk)$` |  |
| Kusza | Crossbow | `^(?:Kusza)$` |  |
| Rzucana | Thrown | `^(?:Rzucana)$` |  |

## Typy obrażeń

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| sieczne | slashing | `^(?:sieczne)$` |  |
| kłute | piercing | `^(?:kłute)$` |  |
| obuchowe | blunt | `^(?:obuchowe)$` |  |
| ogień | fire | `^(?:ogień)$` |  |
| palne | gunshot | `^(?:palne)$` |  |

## Rodzaje przedmiotów i zjawisk

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Broń | Weapon | `^(?:Broń)$` |  |
| Pancerz | Armour | `^(?:Pancerz)$` |  |
| Amunicja | Ammunition | `^(?:Amunicja)$` |  |
| Do rzucania | Throwing gear | `^(?:Do rzucania)$` |  |
| Środek | Supplies | `^(?:Środek)$` |  |
| Drobiazg | Odds and ends | `^(?:Drobiazg)$` |  |
| Surowiec | Raw goods | `^(?:Surowiec)$` |  |
| magiczne | uncanny | `^(?:magiczne)$` |  |
| pogodowe | weather | `^(?:pogodowe)$` |  |

## Perki

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Szkoła miecza | School of the Sword | `^(?:Szkoła miecza)$` |  |
| Szkoła włóczni | School of the Spear | `^(?:Szkoła włóczni)$` |  |
| Twarda ręka | Heavy hand | `^(?:Twarda ręka)$` |  |
| Lekki krok | Light step | `^(?:Lekki krok)$` |  |
| Twarda skóra | Thick skin | `^(?:Twarda skóra)$` |  |
| Nieugięty | Unbending | `^(?:Nieugięty)$` |  |
| Sokole oko | Hawk eye | `^(?:Sokole oko)$` |  |
| Pewna ręka | Steady hand | `^(?:Pewna ręka)$` |  |
| Czytanie walki | Reading the fight | `^(?:Czytanie walki)$` |  |
| Chłodna głowa | Cool head | `^(?:Chłodna głowa)$` |  |
| Mistrz finty | Master of feints | `^(?:Mistrz finty)$` |  |
| Gadane | Gift of the gab | `^(?:Gadane)$` |  |
| Kupiecka żyłka | Merchant's knack | `^(?:Kupiecka żyłka)$` |  |
| Wyczulony na świat | Attuned to the world | `^(?:Wyczulony na świat)$` |  |
| Cyrulik | Barber-surgeon | `^(?:Cyrulik)$` |  |
| Szczęściarz | Lucky devil | `^(?:Szczęściarz)$` |  |
| Kocie życie | Nine lives | `^(?:Kocie życie)$` |  |
| Pewny chwyt | Sure grip | `^(?:Pewny chwyt)$` |  |
| Wół roboczy | Workhorse | `^(?:Wół roboczy)$` |  |
| Unik | Dodge | `^(?:Unik)$` |  |
| Szybkie nogi | Quick feet | `^(?:Szybkie nogi)$` |  |

## Efekty

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Oślepiony | Blinded | `^(?:Oślepiony)$` |  |
| Ogłuszony | Stunned | `^(?:Ogłuszony)$` |  |
| Zamroczony | Dazed | `^(?:Zamroczony)$` |  |
| Rozkojarzony | Distracted | `^(?:Rozkojarzony)$` |  |
| W dymie | In smoke | `^(?:W dymie)$` |  |
| Płonie | Burning | `^(?:Płonie)$` | rzeczownik: podpalenie → burning, celowo |
| Krwawi | Bleeding | `^(?:Krwawi)$` | rzeczownik: krwawienie → bleeding, celowo |
| Przerażony | Frightened | `^(?:Przerażony)$` |  |
| Zatruty | Poisoned | `^(?:Zatruty)$` |  |
| Zmęczony | Tired | `^(?:Zmęczony)$` |  |
| Podchmielony | Tipsy | `^(?:Podchmielony)$` |  |
| Spowolniony | Slowed | `^(?:Spowolniony)$` |  |
| Płonące ostrze | Burning blade | `^(?:Płonące ostrze)$` |  |
| Wracający grot | Returning spearhead | `^(?:Wracający grot)$` |  |
| Zasłona | Veil | `^(?:Zasłona)$` |  |
| Burczy w brzuchu | Rumbling belly | `^(?:Burczy w brzuchu)$` |  |
| Głodny | Hungry | `^(?:Głodny)$` |  |
| Konający z głodu | Starving | `^(?:Konający z głodu)$` |  |
| Mocny napar | Strong brew | `^(?:Mocny napar)$` |  |
| Natłuszczone ostrze | Greased blade | `^(?:Natłuszczone ostrze)$` |  |
| Najedzony | Well fed | `^(?:Najedzony)$` |  |

Rzeczowniki efektów (pole `noun`) stoją w komunikatach walki po nazwie wroga, więc pasują do każdego rodzaju: „Żmija leśna 2: zatrucie mija.” Karta postaci i znaczniki efektów zostają przy nazwie przymiotnikowej. Rzeczownik pisze się małą literą.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| oślepienie | blindness | `^(?:oślepienie)$` | rzeczownik do Oślepiony |
| ogłuszenie | stun | `^(?:ogłuszenie)$` | rzeczownik do Ogłuszony |
| zamroczenie | daze | `^(?:zamroczenie)$` | rzeczownik do Zamroczony |
| rozkojarzenie | distraction | `^(?:rozkojarzenie)$` | rzeczownik do Rozkojarzony |
| podpalenie | burning | `^(?:podpalenie)$` | rzeczownik do Płonie; to samo słowo co Burning celowo |
| krwawienie | bleeding | `^(?:krwawienie)$` | rzeczownik do Krwawi; to samo słowo co Bleeding celowo |
| strach | fear | `^(?:strach)$` | rzeczownik do Przerażony |
| zatrucie | poison | `^(?:zatrucie)$` | rzeczownik do Zatruty |
| zmęczenie | fatigue | `^(?:zmęczenie)$` | rzeczownik do Zmęczony |
| podchmielenie | tipsiness | `^(?:podchmielenie)$` | rzeczownik do Podchmielony |
| spowolnienie | sluggishness | `^(?:spowolnienie)$` | rzeczownik do Spowolniony |
| głód | hunger | `^(?:głód)$` | rzeczownik do Głodny |
| wygłodzenie | starvation | `^(?:wygłodzenie)$` | rzeczownik do Konający z głodu |
| sytość | fullness | `^(?:sytość)$` | rzeczownik do Najedzony |

## Zjawiska

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Burza iskier (nazwa) | Spark Storm | `^Burza iskier$` | sama nazwa zjawiska; w prozie wiersz „burza iskier”; celowo ten sam EN |
| Noc bez Gwiazd | Starless Night | `Noc(?:y\|ą)? bez [Gg]wiazd` |  |
| Mgła Ciszy | Fog of Silence | `M(?:gła\|gły\|głę\|głą\|gle) [Cc]iszy` | też tytuł zadania |
| Ulewa | Downpour | `^(?:Ulewa)$` |  |
| Gęsta mgła | Thick fog | `^(?:Gęsta mgła)$` |  |
| Upał | Dog days | `^(?:Upał)$` |  |
| Wichura | Gale | `^(?:Wichura)$` |  |
| Grad | Hail | `^(?:Grad)$` |  |
| Przymrozek | Frost | `^(?:Przymrozek)$` |  |

## Wrogowie

Nazwy z `enemies.json`. Weterani o tej samej nazwie co zwykły wróg mają jeden wiersz. Wzorzec obejmuje `name` i `nameAcc`; w dopełnieniu angielski nie ma odmiany. Wielkie litery jak w próbkach: Wraith Scout.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Instruktor Radogost | Drillmaster Radogost | `^(?:Instruktor Radogost)$` | nameAcc „Instruktora” (po polsku sam tytuł) → „Radogost” (po angielsku samo imię): krócej i naturalniej w zdaniu („You hit Radogost for 9 (crit!).”); dziennik walki zawija długie wiersze, więc to nie jest kwestia miejsca |
| Bandyta | Bandit | `^(?:Bandyta\|Bandytę)$` |  |
| Upiór zwiadowca | Wraith Scout | `^(?:Upiór zwiadowca\|Upiora zwiadowcę)$` |  |
| Upiór nocy | Night Wraith | `^(?:Upiór nocy\|Upiora nocy)$` |  |
| Wilk | Wolf | `^(?:Wilk\|Wilka)$` |  |
| Kłusownik | Poacher | `^(?:Kłusownik\|Kłusownika)$` | celowo ten sam EN co „kłusownik” w prozie |
| Rabuś | Robber | `^(?:Rabuś\|Rabusia)$` | celowo ten sam EN co „rozbójnik” w prozie |
| Rabuś łucznik | Robber Archer | `^(?:Rabuś łucznik\|Rabusia łucznika)$` |  |
| Maruder | Marauder | `^(?:Maruder\|Marudera)$` |  |
| Herszt zbójców | Brigand Chief | `^(?:Herszt zbójców\|Herszta zbójców)$` |  |
| Żołnierz pogranicza | Border Soldier | `^(?:Żołnierz pogranicza\|Żołnierza pogranicza)$` |  |
| Sierżant pogranicza | Border Sergeant | `^(?:Sierżant pogranicza\|Sierżanta pogranicza)$` |  |
| Dzik | Boar | `^(?:Dzik\|Dzika)$` |  |
| Żmija leśna | Forest Viper | `^(?:Żmija leśna\|Żmiję leśną)$` |  |
| Utopiec | Drowner | `^(?:Utopiec\|Utopca)$` | ludowy topielec; jak w angielskim Wiedźminie; celowo ten sam EN co „topielec” w prozie |
| Błędnik | Wisp | `^(?:Błędnik\|Błędnika)$` | ZAŁOŻENIE: od błędnych ogników (błądzić), więc will-o'-the-wisp, krótko Wisp; celowo ten sam EN co „błędny ognik” w prozie |
| Skrzat-złośnik | Vicious Hob | `^(?:Skrzat-złośnik\|Skrzata-złośnika)$` | skrzat → hob (domowy duszek z angielskiego folkloru) |
| Jarnowski strzelec | Jarnowian Marksman | `^(?:Jarnowski strzelec\|Jarnowskiego strzelca)$` | strzelec u Jarnowian strzela z rusznicy: marksman |
| Jarnowski kowal | Jarnowian Smith | `^(?:Jarnowski kowal\|Jarnowskiego kowala)$` |  |
| Jarnowski zwiadowca | Jarnowian Scout | `^(?:Jarnowski zwiadowca\|Jarnowskiego zwiadowcę)$` |  |
| Cesarski pikinier | Imperial Pikeman | `^(?:Cesarski pikinier\|Cesarskiego pikiniera)$` |  |
| Cesarski kusznik | Imperial Crossbowman | `^(?:Cesarski kusznik\|Cesarskiego kusznika)$` |  |
| Szabrownik | Looter | `^(?:Szabrownik\|Szabrownika)$` |  |
| Kieszonkowiec | Pickpocket | `^(?:Kieszonkowiec\|Kieszonkowca)$` |  |
| Rzezimieszek z portu | Dockside Cutthroat | `^(?:Rzezimieszek z portu\|Rzezimieszka z portu)$` |  |
| Cesarski węszyciel | Imperial Informer | `^(?:Cesarski węszyciel\|Cesarskiego węszyciela)$` | węszyciel → informer (szpicel) |
| Strażnik miejski | Town Guard | `^(?:Strażnik miejski\|Strażnika miejskiego)$` |  |
| Strażnik Progu | Warden of the Threshold | `Strażnik(?:\|a\|iem\|owi) Progu` |  |
| Szeptacz | Whisperer | `Szeptacz(?:\|a\|em\|owi)` |  |
| Kustosz Kabli | Keeper of the Cables | `Kustosz(?:\|a\|em\|owi) Kabli` |  |
| Nieśpiący | the Sleepless | `Nieśpiąc(?:y\|ego\|emu\|ym)` | z przedimkiem: the Sleepless |
| Pełnomocnik Rdzenia | Steward of the Core | `Pełnomocnik(?:\|a\|iem\|owi\|u) Rdzenia` |  |
| Strażnik Wiru | Warden of the Whirl | `Strażnik(?:\|a\|iem\|owi) Wiru` |  |
| Szabrownik wraków | Wreck Looter | `^(?:Szabrownik wraków\|Szabrownika wraków)$` |  |
| Sługa Wiru | Servant of the Whirl | `Słu(?:ga\|gi\|gę\|gą\|dzy) Wiru` |  |
| Strażnik szklany | Glass Warden | `^(?:Strażnik szklany\|Strażnika szklanego)$` |  |
| Pikinier-weteran | Seasoned Pikeman | `^(?:Pikinier-weteran\|Pikiniera-weterana)$` |  |
| Kusznik-weteran | Seasoned Crossbowman | `^(?:Kusznik-weteran\|Kusznika-weterana)$` |  |
| Węszyciel-weteran | Seasoned Informer | `^(?:Węszyciel-weteran\|Węszyciela-weterana)$` |  |
| Strzelec-weteran | Seasoned Marksman | `^(?:Strzelec-weteran\|Strzelca-weterana)$` |  |
| Kowal-weteran | Seasoned Smith | `^(?:Kowal-weteran\|Kowala-weterana)$` |  |
| Zwiadowca-weteran | Seasoned Scout | `^(?:Zwiadowca-weteran\|Zwiadowcę-weterana)$` |  |
| Strażnik-weteran | Seasoned Guard | `^(?:Strażnik-weteran\|Strażnika-weterana)$` |  |
| Upiór schodów | Stair Wraith | `Upi(?:ór\|ora\|orem\|ory\|orów) schodów` |  |

## Przedmioty

Nazwy z `items.json`. Wielkie litery jak w polskim: tylko pierwsza (Short sword), artefakty wszystkie. Wersje ulepszone mają tę samą nazwę i dopisek w nawiasie, przełożony według ostatniej tabeli.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Pięści | Fists | `^(?:Pięści)$` |  |
| Krótki miecz | Short sword | `^(?:Krótki miecz)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Para włóczni | Pair of spears | `^(?:Para włóczni)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Łuk myśliwski | Hunting bow | `^(?:Łuk myśliwski)$` |  |
| Lekka kusza | Light crossbow | `^(?:Lekka kusza)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Sztylet | Dagger | `^(?:Sztylet)$` |  |
| Pistolet skałkowy | Flintlock pistol | `^(?:Pistolet skałkowy)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Kula z prochem | Paper cartridge | `^(?:Kula z prochem)$` |  |
| Strzała | Arrow | `^(?:Strzała)$` |  |
| Bełt | Bolt | `^(?:Bełt)$` | też nazwa ataku wrogów z kuszą; „pęk bełtów” → a sheaf of bolts |
| Bełty | Bolts | `^(?:Bełty)$` | liczba mnoga; początek opcji wymiany bełtów u kowali („Bolts: 10 plain for reinforced”) |
| Bełt wzmocniony | Reinforced bolt | `^(?:Bełt wzmocniony)$` |  |
| Bełt wybuchowy | Explosive bolt | `^(?:Bełt wybuchowy)$` |  |
| Kaftan przeszywany | Gambeson | `^(?:Kaftan przeszywany)(?: \([^()]*\))?$` | kaftan przeszywany = gambeson; z dopiskiem ulepszeń w nawiasie |
| Kolczuga | Mail shirt | `^(?:Kolczuga)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Kaptur myśliwego | Hunter's hood | `^(?:Kaptur myśliwego)$` |  |
| Rękawice łucznicze | Archer's gloves | `^(?:Rękawice łucznicze)$` |  |
| Buty podkute | Hobnailed boots | `^(?:Buty podkute)$` |  |
| Płaszcz wędrowca | Traveller's cloak | `^(?:Płaszcz wędrowca)$` |  |
| Zwykły pas | Plain belt | `^(?:Zwykły pas)$` |  |
| Pas z ładownicami | Belt with pouches | `^(?:Pas z ładownicami)$` |  |
| Opatrunek | Bandage | `^(?:Opatrunek)$` |  |
| Napar ziół | Herbal brew | `^(?:Napar ziół)$` |  |
| Bimber | Rotgut | `^(?:Bimber)$` | celowo ten sam EN co „bimber” w prozie |
| Potrawka z kaszą | Stew with barley | `^(?:Potrawka z kaszą)$` | kasza → barley albo porridge, nigdy „groats” (to waluta) |
| Napar z korzeni | Root brew | `^(?:Napar z korzeni)$` |  |
| Łój do ostrza | Blade tallow | `^(?:Łój do ostrza)$` |  |
| Garniec z wapnem | Pot of quicklime | `^(?:Garniec z wapnem)$` |  |
| Garnek huku | Thunder pot | `^(?:Garnek huku)$` |  |
| Świeca dymna | Smoke candle | `^(?:Świeca dymna)$` |  |
| Puszka z szerszeniami | Jar of hornets | `^(?:Puszka z szerszeniami)$` |  |
| Miecz Gwiazd (próba) | Sword of the Stars (trial) | `^(?:Miecz Gwiazd \(próba\))$` |  |
| Prowiant | Rations | `^(?:Prowiant)$` |  |
| Mięso | Meat | `^(?:Mięso)$` |  |
| Jagody | Berries | `^(?:Jagody)$` |  |
| Grzyby | Mushrooms | `^(?:Grzyby)$` |  |
| Orzechy | Nuts | `^(?:Orzechy)$` |  |
| Zioła leśne | Wild herbs | `^(?:Zioła leśne)$` |  |
| Amulet strażniczy | Guard's amulet | `^(?:Amulet strażniczy)$` |  |
| Mapa przewodnika | Guide's map | `^(?:Mapa przewodnika)$` |  |
| Ziela z polany | Herbs from the glade | `^(?:Ziela z polany)$` |  |
| Worek zboża | Sack of grain | `^(?:Worek zboża)$` |  |
| List komendanta | Commander's letter | `^(?:List komendanta)$` |  |
| Weksel kupca | Promissory note | `^(?:Weksel kupca)$` | przedmiot; „kupca” pominięte, bo opis nazywa Ostromira, a długa nazwa ucinałaby się na liście; celowo ten sam EN co „weksel” |
| Pokwitowanie | Receipt | `^(?:Pokwitowanie)$` | celowo ten sam EN co „pokwitowanie” w prozie |
| Odłamek szkła | Glass shard | `^(?:Odłamek szkła)$` |  |
| Zaklejony list | Sealed letter | `^(?:Zaklejony list)$` |  |
| Wosk pieczętny | Sealing wax | `^(?:Wosk pieczętny)$` |  |
| Szara trzcina | Grey reed | `^(?:Szara trzcina)$` | też tytuł zadania; jako tytuł zadania wielkimi: Grey Reed (test słownika porównuje tytuły zadań bez wielkości liter) |
| Odłamek z krateru | Crater shard | `^(?:Odłamek z krateru)$` |  |
| Rdzeń maszyny | Machine core | `^(?:Rdzeń maszyny)$` |  |
| Miecz żołnierski | Soldier's sword | `^(?:Miecz żołnierski)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Miecz strażnika | Guard's sword | `^(?:Miecz strażnika)(?: \([^()]*\))?$` | strażniczy / strażnika → guard's; z dopiskiem ulepszeń w nawiasie |
| Miecz mistrza | Master's sword | `^(?:Miecz mistrza)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Sztylet zbójecki | Brigand's dagger | `^(?:Sztylet zbójecki)$` |  |
| Topór zbójecki | Brigand's axe | `^(?:Topór zbójecki)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Maczuga z kolcami | Spiked club | `^(?:Maczuga z kolcami)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Buława | Mace | `^(?:Buława)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Para włóczni łowieckich | Pair of hunting spears | `^(?:Para włóczni łowieckich)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Para włóczni strażniczych | Pair of guard's spears | `^(?:Para włóczni strażniczych)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Para włóczni kutych | Pair of forged spears | `^(?:Para włóczni kutych)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Kastet | Iron knuckles | `^(?:Kastet)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Rękawice nabijane | Studded gloves | `^(?:Rękawice nabijane)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Pięść żelazna | Iron fist | `^(?:Pięść żelazna)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Łuk wojenny | War bow | `^(?:Łuk wojenny)$` |  |
| Łuk złożony | Horn bow | `^(?:Łuk złożony)$` |  |
| Kusza żołnierska | Soldier's crossbow | `^(?:Kusza żołnierska)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Kusza cesarska | Imperial crossbow | `^(?:Kusza cesarska)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Pistolet wojskowy | Soldier's pistol | `^(?:Pistolet wojskowy)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Rusznica | Handgun | `^(?:Rusznica)(?: \([^()]*\))?$` | rusznica → handgun (dawna ręczna broń palna); rusznikarz → gunsmith; z dopiskiem ulepszeń w nawiasie |
| Kurta skórzana | Leather jerkin | `^(?:Kurta skórzana)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Skórznia nabijana | Studded leather | `^(?:Skórznia nabijana)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Kaftan włócznika | Spearman's jacket | `^(?:Kaftan włócznika)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Karwasze z rogu | Horn bracers | `^(?:Karwasze z rogu)$` |  |
| Nagolenice skórzane | Leather greaves | `^(?:Nagolenice skórzane)$` |  |
| Kolczuga strażnicza | Guard's mail | `^(?:Kolczuga strażnicza)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Półpancerz | Half-plate | `^(?:Półpancerz)(?: \([^()]*\))?$` | z dopiskiem ulepszeń w nawiasie |
| Hełm skórzany | Leather helm | `^(?:Hełm skórzany)$` |  |
| Czepiec kolczy | Mail coif | `^(?:Czepiec kolczy)$` |  |
| Hełm żelazny | Iron helm | `^(?:Hełm żelazny)$` |  |
| Hełm strażnika | Guard's helm | `^(?:Hełm strażnika)$` |  |
| Rękawice skórzane | Leather gloves | `^(?:Rękawice skórzane)$` |  |
| Karwasze | Bracers | `^(?:Karwasze)$` |  |
| Rękawice kolcze | Mail gloves | `^(?:Rękawice kolcze)$` |  |
| Buty wędrowca | Traveller's boots | `^(?:Buty wędrowca)$` |  |
| Nagolenniki | Greaves | `^(?:Nagolenniki)$` |  |
| Buty strażnika | Guard's boots | `^(?:Buty strażnika)$` |  |
| Płaszcz skórzany | Leather cloak | `^(?:Płaszcz skórzany)$` |  |
| Płaszcz łowczy | Huntsman's cloak | `^(?:Płaszcz łowczy)$` |  |
| Płaszcz cesarski | Imperial cloak | `^(?:Płaszcz cesarski)$` |  |
| Pas żołnierski | Soldier's belt | `^(?:Pas żołnierski)$` |  |
| Obereg od krwi | Charm against bleeding | `^(?:Obereg od krwi)$` |  |
| Kieł dzika | Boar tusk | `^(?:Kieł dzika)$` |  |
| Podkowa szczęścia | Lucky horseshoe | `^(?:Podkowa szczęścia)$` |  |
| Amulet wilczy | Wolf amulet | `^(?:Amulet wilczy)$` |  |
| Paciorek pielgrzyma | Pilgrim's bead | `^(?:Paciorek pielgrzyma)$` |  |
| Talizman z odłamka | Shard talisman | `^(?:Talizman z odłamka)$` |  |
| Zawieszka stróża | Guardian's pendant | `^(?:Zawieszka stróża)$` |  |
| Oko nocy | Eye of the night | `^(?:Oko nocy)$` |  |
| Skóra dzika | Boar hide | `^(?:Skóra dzika)$` |  |
| Kły wilcze | Wolf fangs | `^(?:Kły wilcze)$` |  |
| Żółć żmii | Viper bile | `^(?:Żółć żmii)$` |  |
| Bursztyn błędnika | Wisp amber | `^(?:Bursztyn błędnika)$` |  |
| Róg utopca | Drowner horn | `^(?:Róg utopca)$` |  |
| Futro lisa | Fox fur | `^(?:Futro lisa)$` |  |
| Pierścień zbójecki | Brigand's ring | `^(?:Pierścień zbójecki)$` |  |
| Srebrny kubek | Silver cup | `^(?:Srebrny kubek)$` |  |
| Grzebień kościany | Bone comb | `^(?:Grzebień kościany)$` |  |
| Miód pitny | Mead | `^(?:Miód pitny)$` |  |
| Okład ziołowy | Herbal poultice | `^(?:Okład ziołowy)$` |  |
| Odtrutka | Antidote | `^(?:Odtrutka)$` |  |
| Flasza oleju | Flask of oil | `^(?:Flasza oleju)$` |  |
| Paczka kupca | Merchant's parcel | `^(?:Paczka kupca)$` |  |
| List gońca | Runner's letter | `^(?:List gońca)$` |  |
| List żołnierza | Soldier's letter | `^(?:List żołnierza)$` |  |
| Kobiałka ziół | Basket of herbs | `^(?:Kobiałka ziół)$` |  |
| Kajet ucznia | Apprentice's notebook | `^(?:Kajet ucznia)$` | uczeń Hieronima; też tytuł zadania; jako tytuł zadania wielkimi: Apprentice's Notebook (test słownika porównuje tytuły zadań bez wielkości liter) |
| Sakiewka odłamków | Pouch of shards | `^(?:Sakiewka odłamków)$` |  |
| Ostrze Gwiazd (kute przez Bogdana) | Blade of the Stars (forged by Bogdan) |  | obejmuje go wiersz terminu |
| Ostrze Gwiazd (surowe) | Blade of the Stars (raw) |  | obejmuje go wiersz terminu |
| Para Gwiazd (kuta przez Bogdana) | Pair of Stars (forged by Bogdan) |  | obejmuje go wiersz terminu |
| Para Gwiazd (surowa) | Pair of Stars (raw) |  | obejmuje go wiersz terminu |
| Mieszek z żołdem | Purse of pay | `^(?:Mieszek z żołdem)$` |  |
| List żelazny | Safe-conduct | `^(?:List żelazny)$` | list żelazny = glejt |
| Skrzynia z żołdem | Pay chest | `^(?:Skrzynia z żołdem)$` |  |
| Naprawione siodło | Mended saddle | `^(?:Naprawione siodło)$` |  |
| Świece woskowe | Wax candles | `^(?:Świece woskowe)$` |  |
| Zwój pustelnika | Hermit's scroll | `^(?:Zwój pustelnika)$` |  |
| Buty wartownika | Sentry's boots | `^(?:Buty wartownika)$` |  |
| Bochen dla grabarza | Loaf for the gravedigger | `^(?:Bochen dla grabarza)$` |  |
| Skrzynka gwoździ | Box of nails | `^(?:Skrzynka gwoździ)$` |  |
| Włócznia (rzut) | Spear | `^(?:Włócznia)$` | nazwa rzuconej włóczni z pary |

## Dopiski ulepszeń

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| (uchwyt) | grip | `(?<=\(\|, )uchwyt(?=\)\|,)` | dopisek ulepszenia w nazwie |
| (ostrzony) | sharpened | `(?<=\(\|, )ostrzony(?=\)\|,)` | dopisek ulepszenia w nazwie |
| (okuty) | reshod | `(?<=\(\|, )okuty(?=\)\|,)` | dopisek ulepszenia w nazwie: broń obuchowa (buława, maczuga, kastet, rękawice nabijane, pięść żelazna) na drugim stopniu, decyzja użytkownika z 2026-11-06 |
| (łoże) | stock | `(?<=\(\|, )łoże(?=\)\|,)` | dopisek ulepszenia w nazwie |
| (ramię) | limb | `(?<=\(\|, )ramię(?=\)\|,)` | dopisek ulepszenia w nazwie |
| (muszka) | sight | `(?<=\(\|, )muszka(?=\)\|,)` | dopisek ulepszenia w nazwie; w opisie ulepszenia też samo sight („New sight fitted”) |
| (spust) | trigger | `(?<=\(\|, )spust(?=\)\|,)` | dopisek ulepszenia w nazwie |
| (skóra) | leather | `(?<=\(\|, )skóra(?=\)\|,)` | dopisek ulepszenia w nazwie |
| (płyty) | plates | `(?<=\(\|, )płyty(?=\)\|,)` | dopisek ulepszenia w nazwie |

## Zadania

Tytuły z `quests.json`, wielkimi literami jak tytuły angielskie, także gdy tytuł to nazwa przedmiotu (Grey Reed, Apprentice's Notebook). Test słownika porównuje tytuły zadań bez wielkości liter. Tytuły równe nazwie miejsca, przedmiotu albo zjawiska mają wiersz tam: Wilcza Nora, Szara trzcina, Kajet ucznia, Wrak Maszyny, Mgła Ciszy, Ostatnia Strażnica.

| PL | EN | wzorzec PL | uwagi |
|---|---|---|---|
| Eskorta kupca Ostromira | Escorting Ostromir the Merchant | `(?:^\|(?<=: ))Eskorta kupca Ostromira(?=\.?$)` |  |
| Lek dla Wrzoska | A Cure for Wrzosek | `(?:^\|(?<=: ))Lek dla Wrzoska(?=\.?$)` |  |
| Zboże dla młyna | Grain for the Mill | `(?:^\|(?<=: ))Zboże dla młyna(?=\.?$)` |  |
| Dług kupca | The Merchant's Debt | `(?:^\|(?<=: ))Dług kupca(?=\.?$)` |  |
| List do leśniczego | A Letter for the Forester | `(?:^\|(?<=: ))List do leśniczego(?=\.?$)` |  |
| Kto pyta o ocalałych | Asking About Survivors | `(?:^\|(?<=: ))Kto pyta o ocalałych(?=\.?$)` | skrócone z „Who's Asking About Survivors”, bo na liście tablicy (24 znaki) ucinało się tylko po angielsku |
| Światło w młynie | Light in the Mill | `(?:^\|(?<=: ))Światło w młynie(?=\.?$)` |  |
| Zaginiony pasterz Borek | Missing: Borek the Shepherd | `(?:^\|(?<=: ))Zaginiony pasterz Borek(?=\.?$)` |  |
| Amulet z ruin | An Amulet from the Ruins | `(?:^\|(?<=: ))Amulet z ruin(?=\.?$)` |  |
| Swój w osadzie | A Place in the Settlement | `(?:^\|(?<=: ))Swój w osadzie(?=\.?$)` |  |
| Kłusownik i gajowy | The Poacher and the Gamekeeper | `(?:^\|(?<=: ))Kłusownik i gajowy(?=\.?$)` |  |
| Dług młynarza | The Miller's Debt | `(?:^\|(?<=: ))Dług młynarza(?=\.?$)` |  |
| Listy z tamtej strony | Letters from the Other Side | `(?:^\|(?<=: ))Listy z tamtej strony(?=\.?$)` |  |
| Kto sprzedał ocalałego | Who Sold the Survivor | `(?:^\|(?<=: ))Kto sprzedał ocalałego(?=\.?$)` |  |
| Zwiad na wzgórzu | Scouting the Hill | `(?:^\|(?<=: ))Zwiad na wzgórzu(?=\.?$)` |  |
| Fałszywe papiery | Forged Papers | `(?:^\|(?<=: ))Fałszywe papiery(?=\.?$)` |  |
| Rannego nie zostawia się | You Don't Leave the Wounded | `(?:^\|(?<=: ))Rannego nie zostawia się(?=\.?$)` |  |
| Wdowa po strażniku | The Guard's Widow | `(?:^\|(?<=: ))Wdowa po strażniku(?=\.?$)` |  |
| Najemnik w karczmie | A Sellsword in the Tavern | `(?:^\|(?<=: ))Najemnik w karczmie(?=\.?$)` |  |
| Zaginiona karawana | The Missing Caravan | `(?:^\|(?<=: ))Zaginiona karawana(?=\.?$)` |  |
| Co widziała Ragnosława | What Ragnosława Saw | `(?:^\|(?<=: ))Co widziała Ragnosława(?=\.?$)` |  |
| Swój w Obserwatorium | A Place at Starwatch | `(?:^\|(?<=: ))Swój w Obserwatorium(?=\.?$)` |  |
| Szkło z krateru | Glass from the Crater | `(?:^\|(?<=: ))Szkło z krateru(?=\.?$)` |  |
| Pamięć kamieni | Memory of the Stones | `(?:^\|(?<=: ))Pamięć kamieni(?=\.?$)` |  |
| Cesarski dezerter | The Imperial Deserter | `(?:^\|(?<=: ))Cesarski dezerter(?=\.?$)` |  |
| Dług Istoty | The Being's Debt | `(?:^\|(?<=: ))Dług Istoty(?=\.?$)` |  |
| Wieści z Głuszca | News from Głuszec | `(?:^\|(?<=: ))Wieści z Głuszca(?=\.?$)` |  |
| Przygotowania | Preparations | `(?:^\|(?<=: ))Przygotowania(?=\.?$)` |  |
| Paczka dla młynarki | A Parcel for the Miller's Wife | `(?:^\|(?<=: ))Paczka dla młynarki(?=\.?$)` |  |
| List od gońca | A Letter from a Runner | `(?:^\|(?<=: ))List od gońca(?=\.?$)` |  |
| Ostatni list żołnierza | A Soldier's Last Letter | `(?:^\|(?<=: ))Ostatni list żołnierza(?=\.?$)` |  |
| Kobiałka dla zielarki | A Basket for the Herbalist | `(?:^\|(?<=: ))Kobiałka dla zielarki(?=\.?$)` |  |
| Odłamki dla zbieracza | Shards for the Gatherer | `(?:^\|(?<=: ))Odłamki dla zbieracza(?=\.?$)` |  |
| Dokąd dalej: Wilczy Bród | Where Next: Wolf's Ford | `(?:^\|(?<=: ))Dokąd dalej: Wilczy Bród(?=\.?$)` |  |
| Dokąd dalej: Głuszec | Where Next: Głuszec | `(?:^\|(?<=: ))Dokąd dalej: Głuszec(?=\.?$)` |  |
| Dokąd dalej: Obserwatorium | Where Next: Starwatch | `(?:^\|(?<=: ))Dokąd dalej: Obserwatorium(?=\.?$)` |  |
| Żołd dla garnizonu | Pay for the Garrison | `(?:^\|(?<=: ))Żołd dla garnizonu(?=\.?$)` |  |
| Most bez strażnika | A Bridge Without a Guard | `(?:^\|(?<=: ))Most bez strażnika(?=\.?$)` |  |
| Furman z beczkami | The Carter with the Barrels | `(?:^\|(?<=: ))Furman z beczkami(?=\.?$)` |  |
| Studnia pod Skjeldowem | The Well Outside Skjeldowo | `(?:^\|(?<=: ))Studnia pod Skjeldowem(?=\.?$)` |  |
| Rannych się nie liczy | The Wounded Don't Count | `(?:^\|(?<=: ))Rannych się nie liczy(?=\.?$)` |  |
| Dwóch dezerterów | Two Deserters | `(?:^\|(?<=: ))Dwóch dezerterów(?=\.?$)` |  |
| Dokąd dalej: front | Where Next: the Front | `(?:^\|(?<=: ))Dokąd dalej: front(?=\.?$)` |  |
| Ogień w Zaułku Szklarzy | Fire in Glassmakers' Alley | `(?:^\|(?<=: ))Ogień w Zaułku Szklarzy(?=\.?$)` |  |
| Zaginiony skarbnik | The Missing Treasurer | `(?:^\|(?<=: ))Zaginiony skarbnik(?=\.?$)` |  |
| Wino dla koszar | Wine for the Barracks | `(?:^\|(?<=: ))Wino dla koszar(?=\.?$)` |  |
| Dług przekupki | The Market Woman's Debt | `(?:^\|(?<=: ))Dług przekupki(?=\.?$)` |  |
| Cmentarz bez nazwisk | A Graveyard Without Names | `(?:^\|(?<=: ))Cmentarz bez nazwisk(?=\.?$)` |  |
| List dla marszałka | A Letter for the Marshal | `(?:^\|(?<=: ))List dla marszałka(?=\.?$)` |  |
| Przemyt z portu | Smuggling from the Port | `(?:^\|(?<=: ))Przemyt z portu(?=\.?$)` |  |
| Smyk i klucz | Nipper and the Key | `(?:^\|(?<=: ))Smyk i klucz(?=\.?$)` |  |
| Dokąd dalej: Ulfgród | Where Next: Ulfgród | `(?:^\|(?<=: ))Dokąd dalej: Ulfgród(?=\.?$)` |  |
| Dokąd dalej: Pod pałacem | Where Next: Below the Palace | `(?:^\|(?<=: ))Dokąd dalej: Pod pałacem(?=\.?$)` |  |
| Łódź bez załogi | A Boat Without a Crew | `(?:^\|(?<=: ))Łódź bez załogi(?=\.?$)` |  |
| Kowal i jego rusznice | The Smith and His Handguns | `(?:^\|(?<=: ))Kowal i jego rusznice(?=\.?$)` |  |
| Wieści z lądu | News from the Mainland | `(?:^\|(?<=: ))Wieści z lądu(?=\.?$)` |  |
| Przejście Smyka | Nipper's Passage | `(?:^\|(?<=: ))Przejście Smyka(?=\.?$)` |  |
| Rozpoznanie urządzenia | Studying the Machine | `(?:^\|(?<=: ))Rozpoznanie urządzenia(?=\.?$)` |  |
| Dokąd dalej: Jarnowo | Where Next: Jarnowo | `(?:^\|(?<=: ))Dokąd dalej: Jarnowo(?=\.?$)` |  |
| Dokąd dalej: Wir | Where Next: the Whirl | `(?:^\|(?<=: ))Dokąd dalej: Wir(?=\.?$)` |  |
| Siodło dla zwiadowców | A Saddle for the Scouts | `(?:^\|(?<=: ))Siodło dla zwiadowców(?=\.?$)` |  |
| Świece na kapliczkę | Candles for the Shrine | `(?:^\|(?<=: ))Świece na kapliczkę(?=\.?$)` |  |
| Zwój dla pustelnika | A Scroll for the Hermit | `(?:^\|(?<=: ))Zwój dla pustelnika(?=\.?$)` |  |
| Żołd przegrany w kości | Pay Lost at Dice | `(?:^\|(?<=: ))Żołd przegrany w kości(?=\.?$)` |  |
| Muł imieniem Cesarz | A Mule Called Emperor | `(?:^\|(?<=: ))Muł imieniem Cesarz(?=\.?$)` | imię muła tłumaczone, bo to żart z cesarza (decyzja użytkownika) |
| Jar bez wyjścia | A Ravine with No Way Out | `(?:^\|(?<=: ))Jar bez wyjścia(?=\.?$)` |  |
| Buty dla wartownika | Boots for the Sentry | `(?:^\|(?<=: ))Buty dla wartownika(?=\.?$)` |  |
| Chleb dla grabarza | Bread for the Gravedigger | `(?:^\|(?<=: ))Chleb dla grabarza(?=\.?$)` |  |
| Gwoździe dla stoczni | Nails for the Shipyard | `(?:^\|(?<=: ))Gwoździe dla stoczni(?=\.?$)` |  |
