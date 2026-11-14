# Cykl E3a – ledger

Wynik: 7 zadań + poprawka po recenzji; 858 testów zielonych; `--validate` OK.

## Rulings
1. R1 (plan) – w układzie „obok” tekst zawijany węziej na wszystkich stronach sceny.
2. R2 (plan) – próg „nad tekstem” to 8 wierszy tekstu (spec poprawiony z 6).
3. T1 – walidacja rozmiaru grafiki wroga (40×16) w `combat/data.js`; `validateArt` sprawdza tylko kształt.
4. T3 – grafika niższa niż 10 wierszy komórek (np. wróg 8 wierszy) pokazuje się też w 80×24, bo próg 8 wierszy tekstu jest spełniony; dane scen i portretów mają 10 wierszy, więc w 80×24 ich nie ma.
5. T4 – pole `art` dozwolone na każdym typie sceny (schemat `common`).
6. T6 – ekran walki bez ramki (praktycznie martwa ścieżka) pokazuje maks. 7 wierszy grafiki; panel w ramce – wszystkie.
7. Final – po recenzji: tryb „nad” wymaga `image.width ≤ L` (w oknach 80–84 kolumn × ≥ 26 wierszy ilustracja 48 px byłaby ucinana „…”); test RED→GREEN, zestaw 858/858.

## Deferred minors
- Tryb „obok” nie sprawdza wysokości (`A ≥ M`); nieosiągalne w grze (`rows ≥ 24`, hero zawsze 2 wiersze).
- `say()` po `showScreen` w trybie „nad” przeskakuje na ostatnią stronę (strona 0 z ilustracją niedostępna).
- Odwołania do grafik bez `Object.hasOwn` (`art: "constructor"`, plik `__proto__.pix`).
- `stageArt` o złym kształcie (string, tablica, wartość nie-string) nie daje błędu walidacji.
- JSDoc `validateTravel` oddzielony od funkcji stałą `STAGE_ART_KEYS`.
- Powielony limit wroga w `combat/data.js` (inny komunikat niż `artRefErrors`).
- Białe znaki na końcu wiersza `.pix` → komunikat „nieznana litera „ ””; powtórzona litera palety po cichu nadpisywana.
- `renderPixels`: rozbijanie wiersza w pętli pikseli (O(w²·h)); bez znaczenia przy 48×20.
- ASCII: piksele o jasności ≈ 0 renderują się jak przezroczyste (ciemne kontury znikają).
- Test e2e kolorów bez `try/finally` przy przywracaniu globalnego stanu kolorów.
- Linie z ANSI szersze niż węższy tekst w trybie „obok” są obcinane, nie zawijane (dziś żadna nie przekracza).

## Kolejne kroki
Spec E2a (prolog i akt I, gałąź `cykl-e2a`) czeka na przegląd; potem E2b/E2c, E3b (ilustracje do aktów), E4.
