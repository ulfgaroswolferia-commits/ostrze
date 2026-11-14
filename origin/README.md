# Voided: na przekór gwiazdom

[![npm version](https://img.shields.io/npm/v/ostrze)](https://www.npmjs.com/package/ostrze)
[![npm downloads](https://img.shields.io/npm/dm/ostrze)](https://www.npmjs.com/package/ostrze)

[English version](README.en.md)

Terminalowe RPG po polsku i po angielsku, w mrocznym, słowiańskim fantasy. Jesteś jedynym, który przeżył rzeź delegacji ze szkoły ostrza. Cesarstwo uważa cię za martwego i szuka świadka. Ty szukasz odpowiedzi w Pogórzu, w Głuszcu i na Szklanych Wzgórzach, a na końcu ktoś z gwiazd upomina się o dług.

Gra działa w zwykłym terminalu, bez żadnych zależności. Zwykły tekst, ramki z bloków, ilustracje z półblokowych pikseli.

## Wymagania

- Node.js 22 lub nowszy
- terminal co najmniej 80×24 (przy mniejszym oknie gra przechodzi w prosty tryb liniowy)
- UTF-8 i najlepiej 256 kolorów (bez nich gra działa, ale bez ilustracji, patrz [Grafiki](#grafiki))

## Grafiki

Ilustracje są rysowane z kolorowych półbloków. W menu głównym pozycja **Grafiki** przełącza trzy warianty, a `Enter` zmienia je od razu:

| Wariant | Co widać |
|---|---|
| kolorowe (domyślnie) | ilustracje, ekran startowy i końcowy w kolorze |
| czarno-białe | te same obrazy w odcieniach szarości |
| bez grafik | sam tekst na całą szerokość panelu, ekran startowy i końcowy jako napis |

Ramki i kolory tekstu nie zależą od tego wyboru. Wybór zostaje na następne uruchomienia i jest wspólny dla wszystkich zapisów (`~/.ostrze/config.json`).

**Kiedy ilustracji nie ma albo warto je wyłączyć:**

- Gra sama wyłącza ilustracje, gdy terminal zgłasza mniej niż 256 kolorów albo ustawiono `NO_COLOR`. W menu widać wtedy „Grafiki: niedostępne”. Dotyczy to np. konsoli tekstowej Linuksa (`TERM=linux`), `TERM=xterm`, zwykłego `screen` i `TERM=dumb`.
- Jeśli wiesz, że Twój terminal ma 256 kolorów, a gra ich nie wykrywa (np. Alacritty albo foot po `sudo` lub SSH), uruchom ją z `TERM=xterm-256color ostrze`.
- Gra nie sprawdzi, czy czcionka ma znaki blokowe. Gdy ilustracje wyglądają jak puste prostokąty albo rozjeżdżone paski, zmień czcionkę terminala albo wybierz „bez grafik”.
- Przy oknie za małym na ramkę, poniżej 80×24, gra przechodzi w tryb liniowy bez ramek i ilustracji, a pozycji **Grafiki** nie ma w menu.

## Instalacja i uruchomienie

Z npm:

```
npx ostrze@latest            # jednorazowo, bez instalacji
npm install -g ostrze@latest # na stałe albo aktualizacja; potem polecenie: ostrze
```

Samo `npm install ostrze`, bez `-g`, instaluje grę tylko w bieżącym katalogu. Jeśli masz starszą wersję zainstalowaną globalnie, polecenie `ostrze` dalej ją uruchamia. Zainstalowaną wersję pokaże `npm ls -g ostrze`.

Z paczki lokalnej (`ostrze-0.2.2.tgz`) lub z repozytorium:

```
npx --package=./ostrze-0.2.2.tgz ostrze
npm install -g ./ostrze-0.2.2.tgz
node bin/game.js     # bezpośrednio z katalogu projektu
```

Opcje:

| Opcja | Znaczenie |
|---|---|
| `--seed <liczba>` | ziarno losowości (te same wybory i te same rzuty dają ten sam przebieg) |
| `--scene <id>` | zacznij od wskazanej sceny (do testów i szukania błędów) |
| `--debug` | pokazuj stos błędów |
| `--validate` | sprawdź poprawność plików danych i wyjdź |
| `--lang <pl|en>` | język gry na to jedno uruchomienie, bez zapisu ustawienia |
| `--art <id>` | pokaż grafikę z `data/art` i wyjdź |
| `--help` | pomoc |

Zapisy gry leżą w `~/.ostrze` (zmienna `OSTRZE_HOME` zmienia katalog).

## Język

Gra ma dwie wersje językowe: polską i angielską. Przy pierwszym uruchomieniu w terminalu pyta, w której chcesz grać, i zapamiętuje wybór w `~/.ostrze/config.json` (ustawienie `language`: `"pl"` albo `"en"`). Język można potem zmienić w menu głównym, pozycją **Język**, albo ręcznie w tym pliku.

`--lang pl` lub `--lang en` wymusza język na to jedno uruchomienie. Wtedy gra o nic nie pyta, a przełączenie języka w menu nie zapisuje się do pliku. Bez zapisanego wyboru i bez `--lang` (np. gdy wejście nie jest terminalem) gra jest po polsku. `--validate` sprawdza domyślnie dane polskie; angielskie nakładki sprawdzisz przez `--validate --lang en` (z `--strict` brak przekładu jest błędem). Angielski przekład leży w `data/lang/en/`, a obowiązujące nazwy w `docs/i18n/slownik-en.md`.

## Sterowanie

- strzałki lub cyfry wybierają pozycję w menu, `Enter` albo `1` na ekranach „Dalej” idzie dalej;
- w ramce działają skróty z nawiasów kwadratowych, np. `[P]` Postać, `[E]` Ekwipunek, `[D]` Dziennik, `[Z]` Zapisz grę, `[M]` Menu główne;
- w walce `[A]` atak, `[T]` techniki, `[L]` dziennik walki; ciosy celowane (głowa, tułów, nogi, ogłuszenie) leżą tuż pod atakiem;
- pytania tak/nie i pole imienia pojawiają się w panelu wyboru, nie pod ramką.

## Co jest w grze

- **Prolog i akt I:** szkoła ostrza, kurier z cesarskim listem, marsz, noc upiorów, Istota.
- **Akt II:** pobojowisko, rozdroże, strażnica Wilczy Bród jako hub z mapą okolicy, zlecenia, wyprawa po wilki i eskorta kupca.
- **Akt III:** osada Głuszec i poziom poszukiwań cesarskich zwiadowców (`czujność → pościg → obława`), potem Obserwatorium na Szklanych Wzgórzach, zjawiska z gwiazd i sojusznicy.
- **Akt IV:** front nad Szarą i obóz na Wroniej Górze, Ulfgród w stanie wojennym, noc w pałacu cesarza i lochy pod nim.
- **Akt V i finał:** wyspa Jarnowo, hetman, Łysa Skała, Wir i rozmowa z Istotą; dwa zakończenia i epilog, który pamięta Twoje decyzje.
- ponad 70 zadań, z licznikiem zleceń pobocznych każdego huba w dzienniku; wybory wracają później w wieściach, przy ognisku i w rozmowach;
- walka turowa z punktami akcji, zasięgiem, ciosami celowanymi, parą broni, rzutami i biegłością w broniach; wojsko i panowie lochu rosną w siłę razem z bohaterem;
- mistyka: zjawiska nieba, artefakty, dług i wola jako dwie osie wyborów.

## Zmiany w wersji 0.2.2

**Grafiki i terminale**

- Ilustracje działają w `cmd` i PowerShellu na Windowsie. Wcześniej gra pokazywała tam obrazki ze znaków ASCII, bo nie wykrywała kolorów.
- W menu głównym można wybrać grafiki kolorowe, czarno-białe albo ich brak. Znaki ASCII zniknęły z gry: terminal bez 256 kolorów pokazuje sam tekst.

**Sklep i ekwipunek**

- Karta przedmiotu mówi, na co się go zakłada, i porównuje go w tabeli z tym, co masz założone.
- Trzy lekkie pancerze bez kary do punktów akcji, dobre przeciw pchnięciom i obuchowi: Kaftan włócznika, Karwasze z rogu, Nagolenice skórzane. Karwasze i nagolenice są już w Kuźni Zbycha, więc zniknęły z niej zwykłe karwasze i Buty wędrowca, dostępne u innych kupców.

**Walka**

- Gotowość do ciosu działa z każdą bronią do zwarcia, nie tylko z włóczniami.
- Pełny komplet pancerza nie robi już z bohatera nietykalnego: pancerz powyżej 5 i redukcje powyżej 40% liczą się w połowie. Lekki strój nic nie traci.
- Menu walki pokazuje szansę ucieczki, a każdy wróg w zwarciu obniża ją o 5 punktów zamiast 10.
- Rzucane przedmioty mają +30 do celności. Garnek huku może ogłuszyć także po chybieniu, a gra zawsze mówi, gdy wróg jest odporny na rzucony przedmiot.

**Głód**

- Licznik głodu ma teraz skutki i działa wszędzie, nie tylko w podróży. Pełen jest po 24 godzinach.
- Od 85% można się najeść, zanim zrobi to automat, a brzuch zaczyna przeszkadzać: Siła −1.
- Przy 100% bohater sam zjada posiłek. Bez jedzenia jest głodny: Siła −1, Krzepa −1 i gorsze leczenie snem.
- Od 150% konasz z głodu: dochodzą Zręczność −2 i Bystrość −1.
- Na start dostajesz 3 prowianty zamiast 2.

**Rozwój postaci**

- Cztery nowe perki dla bohaterów z punktami w sile albo zręczności: Pewny chwyt, Wół roboczy, Unik, Szybkie nogi.
- Punkt perka, którego nie ma na co wydać, nie przepada, tylko wraca przy następnym awansie. Dotyczy to także starych zapisów.

**Fabuła**

- Eskortę Ostromira można wznowić po przegranej walce, ucieczce albo po upływie terminu: wóz czeka przy bramie Wilczego Brodu. Nie trzeba już iść po to zlecenie na Trakt.

Stare zapisy wczytują się bez zmian w postępie. Żaden bohater nie dostaje kary za głód w chwili wczytania.

## Dane zamiast kodu

Cała treść leży w `data/` jako JSON, tekst i piksele:

- `story.json` fabuła; `dialogues/` rozmowy; `quests.json` zlecenia; `travel.json` lokacje, miejsca, goście i zdarzenia;
- `items.json`, `enemies.json`, `skills.json`, `classes.json`, `rules.json` mechanika;
- `art/*.pix` ilustracje (sceny 96×48 pikseli, portrety 48×48, wrogowie 64×48; dwa piksele na wiersz terminala), `maps/*.txt` mapy regionów;
- `ui.json` wszystkie napisy interfejsu.

Po zmianie danych uruchom `node bin/game.js --validate`. Walidacja sprawdza odwołania między plikami, warunki, akcje, sceny, zlecenia i grafiki.

## Testy

```
npm test
```

Testy (`node:test`, bez zależności) obejmują silnik, walkę, interfejs w trybie ramek i liniowym, zapis i wczytanie, wszystkie zlecenia oraz przejścia do każdego z siedmiu zakończeń na prawdziwych danych. `test/consistency.test.js` pilnuje spójności flag i przedmiotów.

## Dla piszących treść

Zasady, które wynikły z poprawek i uwag z gry, są w [`docs/wytyczne-tresci-i-qa.md`](docs/wytyczne-tresci-i-qa.md): ton dialogów, stany NPC, zlecenia, które nie mogą utknąć, geometria świata, nazwy akcji w menu. Specyfikacje i plany cykli leżą w `docs/superpowers/`.

## Jak powstała ta gra

Grę zrobiłem razem z Claude Code. Ja wymyśliłem świat, fabułę i to, kto kogo w niej oszuka. Claude pisał kod, testy i pierwsze wersje tekstów, a potem cierpliwie wysłuchiwał, że są do niczego.

Podział pracy był prosty: maszyna w minutę pisze trzy strony dialogu, a ja w kwadrans skreślam z nich wszystko poza dwiema linijkami i żartem o mule. Muł zawsze zostawał.

Rachunek:

- ponad 110 godzin pracy w niecałe trzy tygodnie, w tym kilka dni na przekład na angielski;
- 4 godziny wymyślania świata, zanim AI zobaczyło pierwszy plik. To był najspokojniejszy etap, bo nic się jeszcze nie psuło;
- ponad 570 commitów i ponad 2000 testów, które i tak nie wszystko wyłapały;
- dziesiątki partii rozegranych tylko po to, żeby sprawdzić, czy przespanie nocy w karczmie nie kasuje zadań (kasowało);
- ponad 60 tysięcy słów po polsku i prawie 90 tysięcy po angielsku. Angielska wersja wyszła dłuższa, bo tam nawet muł potrzebuje przedimka.

Najczęstsze zdanie w tym projekcie: „gotowe, działa” (AI). Drugie najczęstsze: „nie działa” (ja).

Czy AI zrobi za ciebie grę? Zrobi. Gorzej, jeśli potem zechcesz w nią zagrać.

## Licencja

Podwójna licencja, autor: Daniel Twiist Antonik (twisterson@gmail.com).

- **Kod** (`bin/`, `src/`, `test/`): [MIT](LICENSE).
- **Treść gry** (`data/`: fabuła, dialogi, grafiki, mapy): [CC BY-NC-SA 4.0](LICENSE-TRESC.md). Wolno kopiować i przerabiać z podaniem autora, bez użycia komercyjnego, przeróbki na tej samej licencji.
