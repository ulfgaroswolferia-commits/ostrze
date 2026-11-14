# Cykl E3b – szczegółowe grafiki

Data: 2026-10-31. Gałąź: `cykl-e3b`. Status: do akceptacji.

## Cel
Gra ma być mocno zilustrowana, a obrazki wyraźnie bardziej szczegółowe niż dzisiejsze szkice. Wzór stylu (inspiracja, nie specyfikacja): pixel-art skrzyni ze zrzutu użytkownika (2026-10-31) – grube ciemne obrysy, 3–4 tony na materiał (drewno, metal), rozbłyski, drobne detale (nity, kłódka, faktura desek). Użytkownik zgadza się, by obrazki były większe i zajmowały więcej miejsca w panelu; zakłada duże okno (pełny ekran fullHD, ok. 200×55).

## Kryterium sukcesu
Każdy obrazek (wrogowie, portrety, sceny) jest przerysowany w nowym rozmiarze i stylu; użytkownik zaakceptował styl na pilotażu i obejrzał serie (`node bin/game.js --art <id>`); testy zielone; tryb liniowy i okno 80×24 działają jak dotąd.

## Rozmiary (piksele; 2 piksele = 1 wiersz terminala)
| rodzaj | dziś | nowy limit |
|---|---|---|
| scena | 48×20 | 96×48 |
| portret | 20×20 | 48×48 |
| wróg | 40×16 | 64×48 |
Limity w `src/engine/pix.js` (`ART_LIMITS`) są górną granicą, więc stare obrazki pozostają poprawne. Paleta: litery `.pix`, do 62 kolorów na obraz (xterm-256).

## Zakres prac
1. **Silnik i układ:** podnieść `ART_LIMITS`; sprawdzić układ ramki (`src/ui/frame.js`: tryby obrazka „obok tekstu / nad tekstem / brak”, `ART_SIDE_TEXT_MIN`, `ART_TOP_TEXT_MIN`) dla nowych rozmiarów w oknach 80×24, 120×35, 160×45, 200×55; obrazek 24 wiersze nad tekstem nie może wypchnąć wyborów poza ekran; ekran walki (wróg 64×48 = 20 wierszy) mieści się obok logu. Testy układu.
2. **Przybornik rysowania** w repo: `tools/art/` (Python, bez zależności poza biblioteką standardową): kształty, obrys, cieniowanie w tonach, rozbłyski, dithering, faktury; zapis `.pix`; podgląd w terminalu. Dokumentacja użycia w `tools/art/README.md`.
3. **Pilotaż 6 obrazków:** scena (karczma), portret (Istota lub kwatermistrz), wróg (wilk), + trzy różne motywy (np. ognisko w nocy, ruiny, wnętrze Wiru). Pokazać użytkownikowi na kilku rozmiarach okna; po akceptacji (lub uwagach) zamrozić styl.
4. **Serie:** 36 wrogów → 36 portretów → 40 scen (łącznie z lokacjami, które dziś używają cudzej grafiki, oraz brakujące portrety hetmana i Pełnomocnika). Po każdej serii: `npm test` zielone, commit, użytkownik ogląda wybrane obrazki.

## Poza zakresem
Animacje, nowa treść i lokacje, zmiana formatu `.pix`, biblioteki zewnętrzne.

## Ryzyka
- Szerokość: 96 kolumn obok tekstu wymaga szerokiego okna; w węższym obrazek idzie nad tekst i zabiera 24 wiersze – sprawdzić przy pilotażu.
- Spójność stylu między ponad 100 obrazkami – dlatego pilotaż i wspólny przybornik.
- Wydajność renderu większych obrazków (półbloki, 256 kolorów) – zmierzyć na największym.
