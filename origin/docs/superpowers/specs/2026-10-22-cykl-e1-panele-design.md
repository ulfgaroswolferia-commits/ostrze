# Cykl E1 – interfejs w panelach (projekt)

> Data: 2026-10-22 · Źródło: `docs/koncepcja-gry.md` (rozdz. 15 „Interfejs”), uwagi użytkownika z 2026-10-22 („interfejs musi być podzielony na panele wydzielone graficznie liniami”, „panel bohatera u góry, zawsze widoczny, wartości kolorowane”) i ustalenia z brainstormingu.
> Poprzedni cykl: D2b (scalony do `master` 019588b), ledger `../plans/2026-10-22-cykl-d2b-ledger.md`.
> Cykl E podzielony: **E1 panele** → E2 treść (E2a prolog + akt I, E2b akt II, E2c akt III) → E3 szlif → E4 publikacja.
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

W prawdziwym terminalu (TTY) każdy ekran gry jest ramką 80×24 (lub większą) podzieloną liniami na panele: **panel bohatera** u góry (zawsze widoczny, kolorowane wartości), **panel sceny** (tytuł w ramce, tekst ze stronami), **kolumna poleceń** po prawej (Postać, Ekwipunek, Dziennik, Zapisz, Menu – tylko dostępne), **komunikaty** (do 2 wierszy) i **panel wyboru** u dołu (krótkie wybory w jednej linii, dłuższe pionowo). Walka zachowuje swój układ w ramce z panelem bohatera i akcjami w dwóch kolumnach. Tryb bez terminala (testy, potok) wygląda jak dotąd.

**Poza zakresem:** nowa treść, zmiana nazwy „Krzepa”, mysz, okna przewijane myszą, animacje, biblioteki TUI (możliwe później, jeśli efekt nie wystarczy – decyzja użytkownika).

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Rysowanie | Własny kompozytor ramek, zero zależności | Decyzja użytkownika; bibliotekę można dodać później. |
| Kolory ramek | Linie: ciemna zieleń; tytuły w ramkach: brąz (paleta 256 kolorów, z prostym zamiennikiem) | Decyzja użytkownika. |
| Układ | Bohater u góry; scena + kolumna poleceń (prawa, 17 kolumn); komunikaty; wybór u dołu (hybryda) | Decyzja użytkownika. |
| Tryb liniowy | Bez zmian (ramki tylko w TTY) | Decyzja użytkownika; ponad 770 testów i gra przez potok bez zmian. |
| Architektura | `composeFrame` (czysta funkcja) + `showScreen(ctx, …)` dla scen; `select`/`sliders` w TTY rysują wiersze w panelu wyboru tej samej ramki | Jedno miejsce rysowania, sceny prostsze. |
| Za mały terminal | < 80×24 → układ liniowy + komunikat w linii stanu | Ramka nie mieści się sensownie. |

## Kompozytor (`src/ui/frame.js`)

`composeFrame({ cols, rows, hero, title, body, commands, notices, choices }) → string[]` (dokładnie `rows − 1` wierszy; ostatni wiersz terminala zostaje na pole odpowiedzi):

- `hero`: `{ left, right, lines: [l1, l2] }` albo `null` (przed kreatorem: ramka górna z tytułem gry „OSTRZE GWIAZD”, bez linii bohatera).
- `title`: tytuł sceny wpisany w linię oddzielającą („├─ Zasadzka ───…”), albo brak.
- `body`: lista wierszy (już pomalowanych) – zawijana do szerokości panelu sceny; `commands`: lista `{ key, label, disabled? }` albo `[]` (wtedy brak kolumny, scena na pełną szerokość); `notices`: lista komunikatów; `choices`: lista wierszy panelu wyboru (już ułożonych przez widżet).
- **Wysokości:** ramka górna 1 + bohater 2 + linia tytułu 1; komunikaty 0 (strefa i jej linia znikają) albo 1–2 + linia; wybór 1–6 + linia; ramka dolna 1; scena = reszta (przy 80×24 od 8 do 13 wierszy).
- **Szerokości:** ramka 2 kolumny; kolumna poleceń 17 + separator 1 (gdy są polecenia); tekst sceny `cols − 4 − 18` (przy 80: 58) albo `cols − 4` bez kolumny. Szerokość liczona jak w D1 (`displayWidth`, ⚡ = 2), kolory nie liczą się do szerokości; linie dłuższe niż panel – ucięte z „…”.
- **Strony:** gdy `body` nie mieści się w panelu sceny, kompozytor zwraca też `pages` (lista ramek); `showScreen` pokazuje kolejne strony z „▼ dalej (Enter)” w ostatnim wierszu panelu sceny przed menu.
- **Komunikaty:** gdy jest ich więcej niż 2 – ostatni + „…i N więcej [L]”; `[L]` (w kolumnie poleceń jako „[L] Komunikaty”, gdy są ukryte) pokazuje pełną listę w panelu sceny do Enter.
- **Znaki ramek:** `┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴`; linie ramek w ciemnej zieleni (rola `frame`), tytuły wpisane w ramkę (imię/czas, tytuł sceny) w brązie (rola `frame_title`) – decyzja użytkownika.

## Panel bohatera (`src/ui/hero_panel.js`)

`heroPanel(state, data, { cols, combat? }) → { left, right, lines } | null`:

- Ramka górna: lewa „{imię} · poz. {n} · {klasa}”, prawa „Dzień {d}, {hh:mm} · {pora}”.
- Linia 1: `HP` + pasek 10 znaków `█░` + `hp/hpMax` (zielony > 50%, żółty > 25%, czerwony niżej), `XP {xp}/{próg}` (niebieski), efekty godzinowe (`Głód ×2` żółty, inne negatywne czerwone; do 3 + „+N”), po prawej miejsce/podróż jak pasek D2a („Brzezina”, „W drodze 1/2”, „Do: Wilcza Nora 1/1”, „Powrót 1/1”).
- Linia 2: „Broń: {broń w ręku}[ + {druga ręka}]”, „Pas: {szybkie przedmioty}”, po prawej mistyka (zjawisko/zapowiedź, artefakt – fioletowe).
- W walce (`combat`) linia 2: „PA ●●●○○ (3/8)” (niebieskie) + broń + pas – zastępuje linie stanu gracza z dzisiejszego ekranu walki.
- Kolejność ustępowania przy braku miejsca jak w D2a: najpierw mistyka (pełna → krótka → ucięta), potem miejsce, nigdy HP.

## Ekrany (`showScreen` i widżety)

`showScreen(ctx, { title, body, commands = "camp", choices })` – w TTY składa ramkę i rysuje ją, w trybie liniowym robi to, co dziś (linia stanu, komunikaty, tytuł, tekst). `select`, `multiSelect`, `sliders`, `textInput` w TTY przyjmują ramkę bieżącego ekranu (`ctx.frame`) i rysują swoje wiersze w panelu wyboru (przerysowując całą ramkę przy ruchu kursora).

| Ekran | Panel sceny | Kolumna poleceń | Panel wyboru |
|---|---|---|---|
| Menu główne, kreator (bez postaci) | tytuł gry / krok kreatora | brak | opcje, suwaki, pole imienia |
| Narracja, nagroda, efekt, zjawisko | tytuł + tekst | P, E, D, Z, M | `[1] Dalej` (jedna linia) |
| Dialog | mówca w tytule + tekst | P | opcje (pionowo) |
| Sklep | kupiec, pieniądze, waga + lista | P, E | Kup / Sprzedaj / Odejdź, potem lista |
| Ekwipunek | sloty + lista przedmiotów | brak | akcje przedmiotu |
| Karta postaci | atrybuty i umiejętności w dwóch kolumnach | brak | `[Enter] wróć` |
| Odpoczynek | pytanie, suwak godzin, podsumowanie | P, E, D | Tak/Nie, suwak, Dalej |
| Podróż (wymarsz, podsumowanie, obóz) | trasa, dzień, jedzenie, zjawisko | P, E, D, Z, M | Ruszaj / Rozbij obóz / Poszukaj pożywienia |
| Mapa | „{hub} – dokąd?” | P, E, D, Z, M | cele + „dalej fabułą” |
| Dziennik | lista zadań | brak | `[Enter] wróć` |
| Awans | punkty umiejętności / perki | brak | suwaki / lista |
| Walka | grafika celu, lista wrogów, dziennik walki (3 linie; 2, gdy zabraknie miejsca) | brak | 10 akcji w dwóch kolumnach (5 wierszy); podmenu (Techniki, przedmioty, cele) pionowo |

- Krótki wybór (wszystkie pozycje mieszczą się w jednej linii panelu, np. „[1] Dalej”) – w jednej linii; inaczej pionowo do 6 wierszy, dłuższe listy przewijane (`menu.more`).
- Kolumna poleceń pokazuje tylko polecenia dostępne w danym miejscu; skróty klawiszowe bez zmian; polecenia nie zajmują numerów w panelu wyboru w TTY (w trybie liniowym numeracja jak dziś).

**Paleta** (`src/ui/colors.js`, nowe role): `frame` (ciemna zieleń – kolor 256 nr 28, `\x1b[38;5;28m`; bez obsługi 256 kolorów – zwykły zielony), `frame_title` (brąz – kolor 256 nr 130, pogrubiony; bez 256 kolorów – żółty), `hp_ok` (zielony), `hp_mid` (żółty), `hp_low` (czerwony, pogrubiony), `xp` (niebieski), `ap` (niebieski), `gold` (żółty), `bad` (czerwony); istniejące `title`, `dim`, `heal`, `warn`, `mystic`, `damage`, `check` bez zmian.

## Tryb liniowy i rozmiar terminala

- `io.isTTY === false` → bez ramek; wszystkie dzisiejsze ekrany wyglądają tak samo (testy skryptowe i potok bez zmian).
- TTY z `io.columns < 80` lub `io.rows < 24` → tryb liniowy, a linia stanu zaczyna się od „Powiększ okno do 80×24, aby zobaczyć panele.” (raz na ekran).
- TTY większy → ramka rośnie: szerzej tekst sceny, wyżej panel sceny; kolumna poleceń stała.

## Testy

- `test/frame.test.js`: wysokości stref (bez komunikatów, z 1, 2, 5 komunikatami; wybór 1 i 6 wierszy), szerokości (każdy wiersz dokładnie `cols` kolumn, ramki domknięte: lewa `│`/`├`/`└`, prawa `│`/`┤`/`┘`), tytuł w ramce, kolumna poleceń i bez niej, zawijanie, strony z „▼ dalej”, obcięcie zbyt długich linii, ⚡ i kolory nie psują szerokości, 80×24 i 120×40.
- `test/hero_panel.test.js`: kolory HP w progach, XP, efekty (głód), miejsce/podróż, broń + druga ręka, pas, mistyka; ustępowanie przy długim imieniu (HP zawsze), wariant walki z PA.
- Testy ekranów w TTY (scripted IO z `tty: true`, `columns: 80, rows: 24`): narracja, dialog, sklep, odpoczynek, podróż, mapa, dziennik, ekwipunek, karta postaci, awans, kreator, menu główne, walka – ramka ≤ 23 wierszy + pole odpowiedzi, każda linia ≤ 80 kolumn, kluczowe treści widoczne, kolumna poleceń z właściwymi pozycjami.
- `test/e2e.test.js`: demo w TTY (strzałki) przechodzi w ramkach; każda klatka (od czyszczenia ekranu) ≤ 24 wiersze i ≤ 80 kolumn; za mały terminal (70×20) – tryb liniowy z komunikatem.
- Wszystkie dotychczasowe testy (tryb liniowy) – zielone bez zmian asercji.

## Kolejność wdrożenia (zadania planu)

1. `composeFrame` + paleta. 2. Panel bohatera. 3. `showScreen` + `select`/`sliders` w panelu wyboru; narracja, nagroda, efekt, zjawisko, menu obozu. 4. Dialog, sklep, odpoczynek, podróż, mapa, dziennik, awans, kreator, menu główne. 5. Ekwipunek, karta postaci, komunikaty `[L]`. 6. Walka. 7. E2e w TTY i za mały terminal.

## Kryterium ukończenia

`npm test` zielone, `--validate` czyste, demo przechodzi w TTY w ramkach 80×24 bez wierszy dłuższych niż 80 kolumn, tryb liniowy bez zmian.
