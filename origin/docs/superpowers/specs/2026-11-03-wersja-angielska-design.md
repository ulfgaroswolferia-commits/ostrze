# Angielska wersja językowa: projekt

## Cel

Gra ma być w pełni grywalna po angielsku, dla graczy z zagranicy, którzy znajdą ją na npm i GitHubie. Przekład obejmuje całą grę w tym samym tonie co oryginał. Gracz wybiera język przy pierwszym uruchomieniu i może go zmienić w menu głównym.

**Kryteria sukcesu:**

- gracz przechodzi grę od prologu do epilogu po angielsku i nie widzi ani jednego polskiego zdania;
- przekład trzyma ton oryginału: sucho, rubasznie, z przekłuwanymi wymianami zdań jak w angielskim Wiedźminie 3, bez kwiecistych metafor i pseudo-aforyzmów;
- polskie dane pozostają źródłem: zmiana liczby albo mechaniki robi się raz;
- stare zapisy wczytują się w obu językach, a język da się przełączyć w każdej chwili.

**Ustalenia z rozmowy (2026-11-03):**

- zakres to cała gra w pełnej jakości, robiona etapami;
- przekład trzymany w nakładce, czyli wariant A z rozmowy;
- nazwy własne według zasady z angielskiego Wiedźmina (poniżej);
- grosze to po angielsku „groats”, a Krzepa to „Endurance”.

## Stan wyjściowy

- W danych jest około 5700 tekstów, mniej więcej 62 tys. słów. Ponad połowa leży w `travel.json`. Reszta to 159 plików dialogów, `quests.json`, `story.json`, `items.json`, `enemies.json`, `ui.json` i mniejsze pliki.
- Mapy w `data/maps/*.txt` mają polskie podpisy w rysunku (np. „Rzeka”).
- W kodzie jest około 80 polskich napisów. Część z nich to komunikaty walidacji, a część to napisy, które widzi gracz (np. „Wróć”, „Użyj”).
- Dane mają polską odmianę, np. `nameAcc` („Instruktora”) dla wrogów.
- Zapisy gry nie zawierają tekstu, tylko identyfikatory, co sprawdzono na zapisie 3.json.
- Ustawienie grafik leży w `~/.ostrze/config.json` (`src/config.js`: `loadGraphics`, `saveGraphics`). Teksty interfejsu idą przez `t(ui, key, vars)` (`src/ui/strings.js`).

## Część A: mechanizm

### A1. Nakładka językowa

- Przekład leży w `data/lang/en/` i ma ten sam układ plików co `data/`: `items.json`, `dialogues/hieronim.json`, `maps/pogorze.txt` itd.
- Plik nakładki zawiera tylko pola tekstowe, przypisane do tych samych identyfikatorów i ścieżek co w polskim pliku. Nie zawiera liczb, warunków ani akcji.
- Przy języku `en` gra kładzie nakładkę na polskie dane w trakcie ładowania. Wynik ma dokładnie tę samą strukturę co polskie dane, więc reszta kodu się nie zmienia.
- Mapy tekstowe tłumaczy się jako całe pliki, bo podpisy są częścią rysunku. Znaczniki `{id}` muszą zostać te same.
- Pole w nakładce, które nie istnieje w polskim pliku, to błąd walidacji (osierocony wpis).
- Pole liczbowe albo logiczne w nakładce to błąd walidacji: nakładka nie zmienia mechaniki.

Plan ustali dokładny format kluczy, czyli sposób wskazania pola w tablicy po `id` zamiast po indeksie. Jest jeden warunek: dopisanie albo przestawienie polskiego wpisu nie może przesuwać przekładu na inny wpis.

### A2. Wybór języka

- Ustawienie `language` (`"pl"` albo `"en"`) leży w `~/.ostrze/config.json`, obok grafik, i jest wspólne dla wszystkich zapisów.
- Przy pierwszym uruchomieniu, gdy ustawienia nie ma, gra pokazuje jeden ekran „Wybierz język / Choose language”. Potem wybór jest w menu głównym, w wierszu „Język: polski” albo „Language: English”, obok grafik.
- Zmiana języka w menu przeładowuje dane w nowym języku bez wychodzenia z gry.
- Opcja `--lang pl|en` w linii poleceń nadpisuje ustawienie na jedno uruchomienie i go nie zapisuje.
- Ekran tytułowy po angielsku nosi tytuł „Voided: Defying the Stars”.

### A3. Gramatyka

- **Liczba mnoga:** szablony z liczbą dostają formy zależne od języka. Po polsku są trzy formy („1 bełt / 3 bełty / 5 bełtów”), po angielsku dwie („1 bolt / 3 bolts”). Plan ustali format w `ui.json`.
- **Odmiana:** pola przypadków (`nameAcc` i podobne) są w nakładce angielskiej opcjonalne. Gdy ich brak, kod bierze zwykłą nazwę. Walidacja pokrycia ich nie wymaga.
- **Szablony ze zmiennymi** (`{name}`, `{n}`) muszą mieć w przekładzie dokładnie te same zmienne co w polskim tekście, co sprawdza walidacja.

### A4. Napisy w kodzie

- Wszystkie napisy z kodu, które widzi gracz, przechodzą do `ui.json` i dostają przekład. Dotyczy to też ekranu błędu.
- Komunikaty walidacji danych (`--validate`) i błędy wiersza poleceń dla twórcy zostają po polsku. `--help` dostaje przekład, bo czyta go gracz.
- Test pilnuje, żeby w `src/` nie przybywało polskich napisów poza listą wyjątków dla twórcy.

### A5. Brak przekładu i walidacja

- Brakujący tekst gra pokazuje po polsku i nie przerywa.
- `node bin/game.js --validate` wypisuje braki przekładu jako ostrzeżenia, z liczbą brakujących wpisów na plik. Błędy (osierocony wpis, inne zmienne w szablonie, pole liczbowe w nakładce) przerywają walidację jak dziś.
- **Nieaktualny przekład:** nakładka zapamiętuje przy każdym przekładzie krótki skrót polskiego tekstu, z którego powstał. Gdy polski tekst się zmieni, `--validate` ostrzega, że przekład jest nieaktualny. Narzędzie `tools/i18n/` potrafi wypisać takie wpisy z polskim tekstem przed i po zmianie.
- `--validate --lang en --strict` traktuje braki i nieaktualne przekłady jako błąd. Testy używają tego trybu dla plików z ukończonych etapów.

### A6. Generowane dane

`tools/upgrades/generate.mjs` generuje dialogi ulepszeń u kowali. Dostaje angielskie kwestie kowali i generuje także pliki nakładki (`data/lang/en/dialogues/ulepszenia_*.json`). Ręczna edycja wygenerowanych plików w żadnym języku nie wchodzi w grę.

## Część B: przekład

### B1. Ton

- Ton jest taki sam jak po polsku. Wzorem są reguły z pamięci projektu: styl dialogów z Wiedźmina 2 i 3 oraz zakaz AI-slopu.
- Ludzie z gminu mówią prosto i szorstko, żołnierze po żołniersku, a możni gładko, ale nie kwieciście.
- Przekład idzie za sensem i rytmem sceny, nie za każdym słowem. Kalki z polskiego to błąd.
- Przekleństwa i wyrażenia dostają angielskie odpowiedniki o tej samej wadze.
- Polskie realia, takie jak grosze, karczma albo żupan, dostają angielskie słowa z epoki, nie współczesne.

### B2. Słownik

`docs/i18n/slownik-en.md` powstaje przed przekładem treści i każdy etap z niego korzysta.

**Nazwy własne:**

- imiona osób zostają polskie (Radogost, Brygida, Zbych, Ostromir);
- nazwy z czytelnym znaczeniem są tłumaczone (Wilczy Bród → Wolf's Ford, Szklane Wzgórza → Glass Hills, Wronia Góra → Crow Mountain, Łysa Skała → Bald Rock);
- nazwy obce brzmieniowo zostają w oryginale (Ulfgród, Jarnowo).

Pełną listę, w tym Szarą, Głuszca, Wir, frakcje, przydomki i rangi, ustala etap 2.

**Atrybuty:**

| PL | EN |
|---|---|
| Siła | Strength |
| Zręczność | Agility |
| Krzepa | Endurance |
| Bystrość | Perception |
| Rozum | Wits |
| Ogłada | Charm |
| Fart | Luck |

**Waluta:** grosze → groats, skrót „gr” zostaje.

Słownik obejmuje też umiejętności, efekty, typy obrażeń, typy broni, perki, zjawiska i stopnie poszukiwań. Test sprawdza, czy nazwy ze słownika są w przekładzie użyte spójnie, czyli tam, gdzie polski tekst ma nazwę ze słownika.

### B3. Etapy

Każdy etap kończy się działającą grą i własnym commitem.

1. **Mechanizm:** część A w całości i przekład `ui.json`.
2. **Słownik i wspólne dane:** słownik, potem przekład przedmiotów, wrogów, efektów, umiejętności, perków, klas, atrybutów, zjawisk i sklepów.
3. **Prolog i akt I:** sceny, dialogi, zadania i zdarzenia tej części. Po tym etapie praca staje. Użytkownik ocenia próbkę tonu, a jego uwagi trafiają do słownika i zasad, zanim pójdą dalsze etapy.
4. **Akt II, akt III, akt IV, akt V:** osobny etap na każdy akt. Każdy obejmuje fabułę, zadania, dialogi, zdarzenia w podróży, mapy i miejsca regionów z danego aktu.
5. **Dopięcie:** zakończenia, epilog, generowane dialogi ulepszeń, README.en (atrybuty według słownika, sekcja o języku), `--strict` dla całej gry i wydanie.

### B4. Kontrola jakości w każdym etapie

- Tłumaczy jeden agent, a drugi sprawdza przekład z polskim oryginałem i z zasadami tonu. Sprawdza sens, ton, słownik, zmienne w szablonach i kalki.
- Przejście skryptem przez prawdziwe ekrany tej części gry po angielsku, tak jak robią to testy e2e. Sam test jednostkowy tego nie zastępuje.
- Sprawdzenie, czy teksty mieszczą się w ramkach i w kartach przedmiotów przy typowej szerokości terminala.
- `--validate --lang en --strict` dla plików etapu.

## Testy

- Pokrycie nakładki dla ukończonych etapów (`--strict`).
- Nakładka nie zmienia mechaniki: dane po nałożeniu przekładu, bez pól tekstowych, są identyczne z polskimi.
- Zmienne w szablonach są zgodne między językami.
- Liczba mnoga daje poprawne formy w obu językach dla 0, 1, 2, 5, 12, 21 i 22.
- Ustawienie języka: pierwszy ekran wyboru, zmiana w menu i `--lang`.
- Stary zapis wczytuje się po angielsku i po polsku.
- Obecne testy działają dalej po polsku, bez zmian w oczekiwanych tekstach.

## Odłożone

- Inne języki niż angielski. Mechanizm ich nie wyklucza, ale nikt ich teraz nie robi.
- Tłumaczenie grafik: rysunki nie mają tekstu poza mapami, które są w zakresie.
- Osobna strona npm albo osobna paczka dla wersji angielskiej. Paczka jest jedna i ma oba języki.

## Ryzyka

- **Objętość.** 62 tys. słów to dużo przekładu i przeglądu. Etapy muszą być na tyle małe, żeby przegląd z oryginałem był rzetelny, a nie pobieżny.
- **Ton.** Przekład maszynowy łatwo spłaszcza i ugrzecznia tekst. Dlatego po etapie 3 jest stop na ocenę użytkownika, zanim pójdzie reszta.
- **Zmiany w polskich tekstach w trakcie prac.** Walidacja pokrycia pokazuje nowe braki, a skrót polskiego tekstu (A5) pokazuje przekłady nieaktualne. Polskie poprawki tekstów w trakcie prac trzeba po każdym etapie przenieść do przekładu.
