# Cykl E1b – nowy układ paneli (projekt)

> Data: 2026-10-22 · Źródło: uwagi użytkownika ze zrzutem `docs/interfejs.png` (okno ok. 220×50): „menu po prawej nic nie robi, a ma dużo miejsca w pionie, dolny panel jest wąski i trzeba go przewijać… lepiej, żeby stałe menu było u dołu, a akcje w prawym panelu… w walce dwa panele: starcie i menu akcji… kreator w wąskim panelu, u góry pusta przestrzeń”. Układ zatwierdzony w rozmowie (tekst po lewej, wybory/akcje po prawej na całą wysokość, stałe menu w linii na dole, walka i kreator w dwóch panelach).
> Poprawia E1 (gałąź `cykl-e1`, niescalona), wykonanie na tej samej gałęzi przed E2a.
> Status: wykonany na gałęzi `cykl-e1b` (plan 2026-10-22-cykl-e1b-uklad.md, 6 zadań).

## Cel

Ramka wypełnia okno (do szerokości 132 kolumn), a jej wysokość jest używana tam, gdzie trzeba: **panel sceny** (lewo) i **panel wyboru** (prawo) mają tę samą, dużą wysokość; **stałe menu** (`[P] Postać … [L] Komunikaty`) to jedna linia na dole. Wybory nie są już wciśnięte w 1–6 wierszy pod tekstem, więc prawie nigdy się nie przewijają. Walka i kreator korzystają z dwóch paneli: po lewej informacja, po prawej akcje/widżet.

**Poza zakresem:** nowa treść, mysz, animacje, zmiana trybu liniowego (bez zmian, bajt w bajt), zmiana ekranów, które dziś nie są w ramce (lista wczytywania, porażka, zapisy).

## Układ

```
┌─ imię · poz. · klasa ───────────────────────────── Dzień, godzina · pora ─┐
│ HP ███ 39/39   XP …                                                      │   panel bohatera (bez zmian, 2 linie)
│ Broń: …   Pas: …                                                         │
├─ tytuł sceny ─────────────────────────────────┬─ tytuł wyboru ───────────┤
│ tekst sceny (zawijany, strony)                │ ▶ [1] Dalej              │
│                                               │   [2] …                  │   prawy panel wyboru, cała wysokość
│                                               │   …                      │
│                                               │ ──────────────────────── │
│                                               │ opis zaznaczonej pozycji │   (wrap, do 4 wierszy; 0, gdy brak)
├───────────────────────────────────────────────┴──────────────────────────┤
│ komunikaty (0–2 wiersze, jak dotąd)                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ [P] Postać  [E] Ekwipunek  [D] Dziennik  [Z] Zapisz grę  [M] Menu  [L] …  │   stałe menu (0 lub 1 wiersz)
└──────────────────────────────────────────────────────────────────────────┘
```

### Geometria (`src/ui/frame.js`)

- **Szerokość ramki** `W = min(cols, 132)`; ramka przy lewej krawędzi (bez centrowania – kursor i `\x1b[2J` bez zmian).
- **Prawy panel** `R = clamp(30, round(W × 0.3), 42)` kolumn tekstu; separator pionowy między panelami; lewy panel tekstu `W − 7 − R` (przy 80: 43; przy 132: 83). Ekran bez wyboru (`choices` puste i brak tytułu wyboru) – lewy panel na całą szerokość `W − 4`.
- **Wysokość** `H = rows − 1`: ramka górna 1, bohater 2 (lub 0 bez bohatera), linia tytułu 1, **środek** (sceny i wyboru) = `H − górna − komunikaty(0 lub n+1) − menu(0 lub 1+1) − dolna 1`. Środek jest taki sam dla obu paneli i **nie zależy od liczby wyborów** (znika `pageRows`/`choiceRows`: strony tekstu liczy sama wysokość panelu).
- **Prawy panel**: tytuł wyboru (jeśli jest) w pierwszym wierszu, potem lista (okno przewijane ze strzałkami „↑ …/↓ …” tylko, gdy lista nie mieści się), na dole opis zaznaczonej pozycji w osobnym polu pod linią (zawijany do `R`, do 4 wierszy; pole znika, gdy żadna pozycja nie ma opisu).
- **Etykiety** dłuższe niż `R − 2` ucinane „…”; ich pełny tekst jest w opisie.
- **Stałe menu**: jedna linia z poleceniami `[X] Etykieta` (nieaktywne przyciemnione), oddzielone dwiema spacjami; gdy nie mieści się w `W − 4`, ostatnie polecenia skracane do `[X]`. Brak poleceń (sklep, walka) – brak linii.
- `composeFrame({ cols, rows, hero, title, body, commands, notices, choices, choiceTitle, choiceInfo, page, bottom }) → { lines, pages, sceneRows, choiceRows }`. `bottom?: { title, lines }` – dolny panel na całą szerokość (dziennik walki), zastępuje strefę komunikatów; jego wysokość `clamp(3, round(rows × 0.16), 8)` wierszy. `choiceRows` (ile wierszy listy mieści prawy panel przy tym ekranie) odczytuje widżet.
- **80×24** dalej działa: prawy panel 30, lewy 43, środek ok. 12 wierszy. Poniżej 80×24 tryb liniowy z komunikatem „Powiększ okno…”, jak dotąd.

### Widżety (`src/ui/menu.js`, `prompt.js`)

- Wszystkie widżety (`select`, `multiSelect`, `sliders`, `textInput`, `confirm`, `pressEnter`) rysują w prawym panelu; okno przewijane (`makeWindow`) bierze pojemność z `choiceRows` zamiast stałego 6. `columns: 2` w ramce znika (lista pionowa).
- Opis zaznaczonej pozycji (dziś jeden wiersz pod listą) idzie do pola opisu panelu; budżet/licznik widżetów (`Wybrane: 3/3`, punkty do rozdania) – do tytułu wyboru panelu.
- `pressEnter` w ramce: wiersz „Enter – dalej” w prawym panelu, bez pisania pod ramką.
- Polecenia obozu (`hidden: true`) – jak dotąd odpowiadają tylko na literę, ale rysuje je stałe menu u dołu, nie kolumna po prawej.

## Walka (inspiracja: koncept użytkownika `docs/interfejs-walka.png` – kierunek, nie wymóg; szczegóły wolno dopasować do możliwości terminala)

```
┌─ bohater · poz. · klasa ── HP ██ 35/35  XP ██ 0/150  PA ●●●●●●● (7/7) ── Dzień, godzina · miejsce ─┐
├─ ARENA WALKI ─────────────── dystans: zwarcie ─┬─ AKCJE I TECHNIKI ────────── skróty ───────────────┤
│  [gracz]        1.5m        [wróg]             │ — ATAKI I BROŃ —                                     │
│  imię           ←→ VS       imię               │ ▶ [1] Atak                              (3 PA)       │
│  klasa          sparing     rola               │   [2] …                                              │
│  HP 35/35 ███                HP 100% ███       │ — TECHNIKI —                                         │
│                              Stan: Tura 1      │   [T] …                                              │
│                                                ├─ opis akcji ─────────────────────────────────────────┤
├─ DZIENNIK ZDARZEŃ ─────────────────────────────┴──────────────────────────────────────────────────────┤
│ [TURA 1] … wpisy dziennika (przewijane), ostatni na dole                                              │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Trzy strefy środka:** lewy panel **arena** (gracz i wróg obok siebie: imię, klasa/rola, pasek HP, dystans „zwarcie/daleko” i znacznik „VS”, stan walki „Tura N (Twój ruch)”; z grafiką ASCII, a po E3a z kolorowym pixel-artem obu postaci; przy wąskim oknie bez grafiki: bloki tekstowe jak dotąd), prawy panel **akcje i techniki**, na dole **dziennik zdarzeń na całą szerokość** (zamiast strefy komunikatów w walce; w walce komunikaty trafiają do dziennika).
- **Akcje pogrupowane** nagłówkami niewybieralnymi (`— ATAKI I BROŃ —`, `— TECHNIKI —`, później `— TECHNIKI WŁÓCZNIKA —` itp.); wiersz: skrót/numer, etykieta po lewej, koszt `(N PA)` wyrównany do prawej; opis zaznaczonej akcji w polu opisu na dole prawego panelu (jak w głównym układzie).
- **Dziennik:** wiersze `[TURA n] tekst` (kolory: wynik gracza, wróg, ostrzeżenia), ostatnie wpisy widoczne, `[L]` otwiera pełny dziennik z przewijaniem strzałkami (Enter wraca). Wysokość panelu dziennika zależy od okna: 3 wiersze przy 24 wierszach, ok. 6–8 przy 50.
- Wybór celu/strefy/przedmiotu: lista w prawym panelu (jak dotąd, pionowo).
- `renderCombat(..., { frame: true })` zwraca osobno: wiersze areny (szerokość lewego panelu, wysokość środka) i wpisy dziennika (do panelu dolnego).
- Podsumowanie walki: arena z wynikiem, prawy panel „Enter”, dziennik z końcowymi wpisami.

## Kreator postaci

- Lewy panel pokazuje **podgląd na żywo**: opis kroku (klasa, atrybuty z krótkim opisem po co, umiejętności wiodące), a na kroku atrybutów i umiejętności także **wartości pochodne** (HP, PA, Obrona, Inicjatywa, Udźwig, szansa na krytyk) liczone z aktualnie wybranych wartości; prawy – widżet (lista klas, suwaki atrybutów, wybór umiejętności).
- `sliders` i `multiSelect` dostają opcjonalne `preview(values) → string[]`, wywoływane po każdej zmianie, a wynik zastępuje treść lewego panelu (przerysowanie ramki, bez pisania pod nią).
- Podsumowanie: lewy panel – karta postaci (dwie kolumny jak w `[P]`), prawy – „Zatwierdź / Zacznij od nowa”.

## Pozostałe ekrany

Narracja, nagroda, dialog (wypowiedź w lewym panelu, odpowiedzi w prawym), sklep (lista towarów z cenami w prawym panelu, opis towaru w polu opisu), odpoczynek, podróż, mapa, awans, ekwipunek i submenu przedmiotu, dziennik, karta postaci: ta sama ramka; ekrany z samym `pressEnter` (karta, dziennik) – prawy panel z „Enter”. Bez nowej treści.

## Decyzje (do zatwierdzenia przy przeglądzie)

| Decyzja | Wybór | Powód / koszt |
|---|---|---|
| Szerokość maksymalna | 132 kolumny, ramka przy lewej krawędzi | Dłuższe linie tekstu męczą oczy; koszt: puste pole po prawej w oknie szerszym niż 132. |
| Prawy panel | 30–42 kolumny, ok. 30% szerokości | Mieści etykiety z podpowiedziami (np. „Atak celowany (4 PA)”); koszt: lewy panel przy 80 kolumnach ma 43. |
| Opis pozycji | Pole opisu na dole prawego panelu, do 4 wierszy | Zamiast jednej linii pod listą; koszt: mniej wierszy listy na małym oknie. |
| Strony tekstu | Zależą tylko od wysokości lewego panelu | Usuwa obejścia `choiceRows`/`pageRows` z E1. |
| Tryb liniowy | Bez zmian | Ponad 800 testów i potok. |

## Testy

- `frame.test.js`: geometria przy 80×24, 120×40, 220×50 (szerokość ≤ 132, wysokość = rows − 1, prawy panel 30/…/42, środek niezależny od liczby wyborów, pole opisu znika bez opisu, stałe menu skracane); lista dłuższa niż panel – okno z „↑ …/↓ …” i kursor widoczny.
- Widżety: kursor zawsze widoczny dla list 1, 5, 12, 30 pozycji w oknach 24 i 50 wierszy; opis zaznaczonej pozycji w polu opisu.
- Walka: lewy panel pokazuje dziennik w ilości zależnej od wysokości; akcje w prawym panelu; `[L]` przewija.
- Kreator: podgląd pochodnych zmienia się po zmianie suwaka; podsumowanie w dwóch panelach.
- e2e: każda klatka z ramką to dokładnie `rows − 1` wierszy (brak luźnego tekstu), szerokość ≤ 132; demo w TTY dla 80×24 oraz 160×45.
- Sterownik testowy (`createAdaptiveIO`) czyta wybory z prawego panelu zamiast z dolnego.
