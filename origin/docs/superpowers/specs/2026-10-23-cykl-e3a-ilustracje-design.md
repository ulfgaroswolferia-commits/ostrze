# Cykl E3a – ilustracje (pixel-art w półblokach) – projekt

> Status: wykonany na gałęzi `cykl-e3a` (plan 2026-10-23-cykl-e3a-ilustracje.md, 7 zadań). Rulings: R1 – w układzie „obok” tekst jest zawijany węziej na wszystkich stronach; R2 – próg „nad tekstem” to 8 wierszy.

## Cel

Gra ma **mocno ilustrować to, co się dzieje**: wrogów w walce, rozmówców (portrety), kwatermistrza i sklep, podróż (wymarsz, marsz, obóz, pogoda, spotkania), odpoczynek, mapę, zakończenia. Obrazy to kolorowy pixel-art rysowany półblokami (▀▄) w palecie 256 kolorów; w trybie liniowym zastępuje je automatyczne ASCII.

## Ustalenia z rozmowy

- **Zakres E3a:** silnik grafiki + komplet obrazów dla obecnego dema. Kolejne obrazy powstają razem z treścią E2 (E3b: po jednej serii na akt).
- **Źródło grafik:** wszystkie rysuje asystent jako siatki liter w plikach tekstowych (bez PNG, bez zależności). Podgląd `node bin/game.js --art <id>` służy do oceny i poprawek.
- **ASCII w trybie liniowym:** liczone automatycznie z jasności pikseli; stare `data/art/*.txt` znikają (4 grafiki wrogów przepisane na `.pix`).
- **Okno:** optymalizujemy pod duży terminal (pełny ekran FullHD ≈ 200+ × 50+). W małym oknie (np. 80×24) ilustracji **nie ma**, gra wygląda jak dziś.
- **Limit szerokości ramki** rośnie z 132 do **200** kolumn (puste pasy po bokach pełnego ekranu byłyby marnotrawstwem).

## 1. Format `.pix`

`data/art/<id>.pix` (UTF-8, `#` w pierwszej kolumnie = komentarz):

```
# Bandyta
paleta: a=236 b=94 c=180 d=124 e=250
........aaaa........
.......aaccaa.......
...
```

- `paleta:` – jedna linia, pary `litera=numer` (0–255); litery `a–z`, `.` zarezerwowana na przezroczystość.
- Siatka: wiersze o **równej długości**, **parzysta liczba wierszy** (dwa wiersze pikseli = jeden wiersz komórek).
- Rozmiar zależy od użycia i jest walidowany przy starcie:

| Użycie | pole w danych | maks. rozmiar (px) | komórki |
|---|---|---|---|
| ilustracja sceny / etapu | `art` | 48 × 20 | 48 × 10 |
| portret rozmówcy | `portrait` | 20 × 20 | 20 × 10 |
| wróg w walce | `art` w `enemies.json` | 40 × 16 | 40 × 8 |

- `loadData` czyta `.pix` do `data.art[id] = { w, h, palette, rows }` (zamrożone). Walidator zbiera wszystkie błędy naraz (`art/<plik> › wiersz N: …`): nieznana litera, nierówna szerokość, nieparzysta wysokość, numer poza 0–255, brak `paleta:`, przekroczony rozmiar dla użycia.
- Każde `art`/`portrait` w danych musi wskazywać istniejący plik; plik nieużywany nigdzie jest dozwolony (ostrzeżenia nie ma).

## 2. Renderer (`src/ui/pixels.js`)

`renderPixels(art, { color })` → `string[]` (wiersze komórek, już pomalowane gdy `color`).

- **Kolor** (`color: true`, TTY z 256 kolorami): komórka z górnym pikselem U i dolnym D: oba przezroczyste → spacja; tylko U → `▀` z kolorem czcionki U; tylko D → `▄` z kolorem czcionki D; oba → `▀` z czcionką U i tłem D. Sekwencje `\x1b[38;5;Nm` / `\x1b[48;5;Nm`, reset na końcu wiersza. Przezroczystość zostawia tło terminala.
- **ASCII** (`color: false`, tryb liniowy lub brak 256 kolorów): jasność komórki = średnia jasności nieprzezroczystych pikseli (numer 0–255 → RGB wg xterm → luminancja), znak z rampy ` .:-=+*#%@`; komórka bez żadnego piksela → spacja.
- Funkcje czyste, bez zależności od `io`; wybór trybu robi wołający (`supports256()` + `framesOn(io)`).

## 3. Integracja i układ

**Pola w danych (wszystkie opcjonalne):**
- `art` na scenach `narration`, `dialogue`, `shop`, `rest`, `map`, `reward`, `ending` (także na scenach w `travel.json › events[].scenes`).
- `portrait` na rozmowie (`dialogues/*.json`), z możliwością nadpisania w węźle.
- `travel.json › stageArt`: `{ depart, march, camp, rain, … }` – ilustracje etapów podróży (klucz = etap lub pogoda).
- Walka: bez zmian w danych (`enemies.json › art`), zmienia się tylko format pliku.

**Układ w ramce** (`io.frame.art = { lines, width }` ustawia ekran; `composeFrame` rozstrzyga):
- **Obok** (szeroko): gdy `sceneWidth − art.width − 2 ≥ 50` – ilustracja po lewej stronie lewego panelu, tekst zawijany do reszty szerokości, obok niej; obraz przyklejony do góry strony.
- **Nad tekstem** (wąsko, ale wysoko): gdy nie obok, a `sceneRows − artRows ≥ 8` – ilustracja na górze, pod nią tekst.
- **Brak** w pozostałych przypadkach (np. 80×24: `sceneRows = 16`). Ilustracja jest wtedy pomijana bez śladu, strony tekstu liczone jak dziś.
- Ilustracja jest **na pierwszej stronie** sceny i nie powtarza się na kolejnych (te dostają cały panel).
- Portret używa tej samej reguły z rozmiarem portretu (20 × 10 komórek).
- Walka: grafika celu jak dziś (kolumna po lewej bloku wrogów, od 84 kolumn w ramce), tylko z nowym formatem; w trybie liniowym ASCII z jasności zastępuje stary rysunek (wyjście trybu liniowego dla wrogów się zmienia – testy adaptujemy).
- Tryb liniowy scen i dialogów: bez ilustracji (jak dziś); ilustracje tylko w ramkach i w walce.

**Zmiany w `frame.js`:** `MAX_WIDTH = 200`; reszta geometrii bez zmian (`R = clamp(round(W·0.3), 30, 42)`, lewy panel `W − 7 − R`). Testy geometrii z limitem 132 aktualizujemy do 200 (okno 220×50: linie ≤ 200, ramka = `rows − 1`).

## 4. Treść E3a (komplet dema, rysuje asystent)

- **Wrogowie (4):** bandyta, wilk, upiór zwiadowca, instruktor.
- **Portrety (4):** komendant Wszebor, kwatermistrz, kupiec Ostromir, głodny wędrowiec.
- **Ilustracje scen i etapów (ok. 12):** szkółka / kwatermistrz (sklep), wymarsz, marsz (las/trakt), obóz, ulewa, spotkanie z wilkami, zasadzka bandytów, odpoczynek, mapa Wilczego Brodu, zakończenie dema, ekran po walce lub nagrodzie (jedna wspólna).
- Po pierwszych 3–4 obrazach asystent pokazuje je w `--art` do oceny przed rysowaniem reszty.

## 5. Poza zakresem

Animacje, obrazy z PNG, ilustracje do aktów E2 (E3b), ekran startowy i obóz w podróży z konceptów (osobna decyzja po E3a), dwa rozmiary tej samej ilustracji dla małych okien.

## 6. Testy

- `.pix`: poprawny plik, każdy z błędów walidatora, limity rozmiaru wg użycia, odwołania `art`/`portrait` do istniejących plików.
- Renderer: kolor (▀/▄/pełna komórka, przezroczystość, reset wiersza), ASCII (rampa, komórki puste), wysokość = `h/2`.
- Układ w ramce: 80×24 – brak ilustracji i strony jak dziś; 160×45 – nad tekstem; 220×50 – obok tekstu; ilustracja tylko na pierwszej stronie; żadna linia > 200 kolumn, ramka = `rows − 1`.
- Dialog z portretem w trzech rozmiarach okna; walka z grafiką w kolorze i w ASCII (tryb liniowy).
- `--art <id>` drukuje obraz (kolor w TTY, ASCII w potoku) i kończy kodem 0; nieznane id → błąd i kod ≠ 0.
- Pełny zestaw `timeout 115 npm test` i `node bin/game.js --validate` zielone.

## 7. Zadania (zarys planu)

1. Format `.pix` – loader, walidator, migracja 4 wrogów, usunięcie `.txt`.
2. `pixels.js` – renderer kolor/ASCII + `--art`.
3. Układ ramki – `io.frame.art`, `composeFrame`, `MAX_WIDTH = 200`, strony tekstu.
4. Pola `art`/`portrait`/`stageArt` – walidacja i podłączenie scen, dialogów, podróży.
5. Walka – nowy format w bloku wrogów, ASCII w trybie liniowym.
6. Treść – portrety i ilustracje dema (z przeglądem pierwszych obrazów).
7. Dokumentacja (rozdz. 15 i 483 koncepcji) i status specu.
