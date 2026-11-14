# Narzędzia przekładu

Przekład leży w nakładce `data/lang/en/`. Polski tekst w `data/` jest źródłem. Plik nakładki ma postać `{ "<ścieżka>": { "t": "<przekład>", "h": "<skrót polskiego tekstu>" } }`. Mapa regionu to cały plik `data/lang/en/maps/<region>.txt`.

## Zakresy

Każdy wpis należy do jednego zakresu: `wspolne`, `akt1`, `akt2`, `akt3`, `akt4`, `akt5` albo `final`. Tabela i zasady leżą w `src/i18n/scope.js`, bo korzysta z nich też `--validate`. Plik `tools/i18n/scope.mjs` je eksportuje.

- Sceny `story.json` przypisuje prefiks id. Wyjątki są w `SCENE_OVERRIDES`: końcówka `demo_*` (marsz do Wilczego Brodu i tamtejszy postój) należy do `akt2`.
- Miejsca, trasy i regiony `travel.json` dostają zakres swojego regionu. Wyjątki są w `LOCATION_OVERRIDES`: nazwa i krótka nazwa Brzeziny należą do `akt1`, bo wieś stoi w nagłówku od pierwszego ekranu prologu. Trasy, zdarzenia, zadania i dialogi, które ją wymieniają, zostają w zakresie regionu.
- Zdarzenie dostaje najwcześniejszy region ze swojego warunku albo z trasy, która je wywołuje.
- Zadanie dostaje zakres regionu swojego `hub`.
- Dialog dostaje najwcześniejszy zakres sceny, miejsca, zdarzenia albo zadania, które go wywołuje.
- Mapa dostaje zakres swojego regionu.
- Reszta (ui, przedmioty, wrogowie, efekty…) to `wspolne`.

Liczba wpisów w każdym zakresie:

    node tools/i18n/scope.mjs

## Praca nad zakresem

1. Wyciągnij listę braków:

       node tools/i18n/extract.mjs --scope akt1 --kind story --out akt1-story.json

   `--kind` przyjmuje `story`, `dialogues`, `travel`, `quests`, `maps` albo `all` (domyślnie). `--scope` przyjmuje nazwę zakresu albo `all` (domyślnie). Bez `--out` lista idzie na standardowe wyjście. Na liście są tylko wpisy brakujące, nieaktualne albo z pustym przekładem. Każdy wpis ma postać `{ file, path, pl, en: "" }`. Lista idzie plik po pliku, a w pliku w kolejności danych, więc sceny czyta się po kolei. Mapa to jeden wpis z całym polskim tekstem w `pl`. Wpisów `_u1`/`_u2` z `items.json` nie ma na liście: pisze je `node tools/upgrades/generate.mjs` (nazwa ze słownika, opis z przekładu przedmiotu bazowego), więc po przekładzie `items.json` uruchom generator.

2. Wpisz przekład w pole `en`. Wpis z pustym `en` zostaje pominięty.

3. Włóż listę do nakładki:

       node tools/i18n/apply.mjs akt1-story.json

   Najpierw sprawdzana jest cała lista. Jeśli choć jeden wpis jest zły, nic się nie zapisuje. Zły wpis to:
   - nieznany plik albo ścieżka;
   - zmienne `{…}` albo znaczniki mapy `{id}` niezgodne z polskim tekstem;
   - `pl` różne od obecnego polskiego tekstu (wtedy wyciągnij listę od nowa);
   - wpis powtórzony;
   - uszkodzony plik nakładki.

   Skrót `h` liczony jest z obecnego polskiego tekstu. Istniejące wpisy zmieniają się w miejscu, a plik zostaje posortowany po ścieżce, po jednym wpisie w wierszu.

4. Sprawdź zakres:

       node bin/game.js --validate --lang en --strict --scope akt1

## Nieaktualne wpisy

Gdy polski tekst zmieni się po przekładzie, wpis jest nieaktualny:

    node tools/i18n/stale.mjs

Narzędzie wypisuje dla każdego wpisu polski tekst sprzed zmiany, obecny tekst i obecny przekład. Stary tekst odnajduje w historii git pliku po skrócie `h`. Bez gita albo bez trafienia pisze „(nie znaleziono)”.

## Słownik

Słownik `docs/i18n/slownik-en.md` wiąże nazwy. Test `test/i18n_glossary.test.js` sprawdza go razem z formami w `test/fixtures/glossary_forms.json`. Po zmianie polskiego tekstu albo wzorca w słowniku zbuduj ten plik od nowa i przejrzyj wypisane luki:

    node tools/i18n/glossary_forms.mjs

Narzędzie zapisuje krótkie frazy z danych, w których wzorzec trafia (`data`), i zostawia ręczne formy z obocznością (`extra`). Potem wypisuje każde trafienie samego rdzenia nazwy, którego wzorzec nie łapie. Taka luka to albo brakująca forma (popraw wzorzec), albo inne znaczenie, które wzorzec pomija celowo (dopisz uwagę w wierszu słownika). `--quiet` pomija listę luk.

## Ograniczenia

- Nakładka mapy nie ma skrótu. Gdy polska mapa się zmieni, `extract` nie zaproponuje jej ponownie. Żeby przełożyć mapę od nowa, usuń jej plik z `data/lang/en/maps/`.
- `apply` sprawdza całą listę przed zapisem, ale zapisuje pliki po kolei. Jeśli proces padnie w trakcie zapisu, część plików może być już zapisana, a część nie.

Każde narzędzie przyjmuje `--dir <katalog danych>` (domyślnie `data/`) i `--lang` (domyślnie `en`).
