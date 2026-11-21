# Podsumowanie stanu projektu — 21.11.2026

## Po co jest ten dokument

To podsumowanie zbiera dotychczasowy stan gry *Ostrze* 2.5D, wykonane prace sprzed dzisiejszej sesji, poprawki z code review oraz doprecyzowane wymagania trybu developerskiego. Ma być punktem wznowienia pracy nad ukończeniem Prologu i Aktu I.

## Ocena stanu

Projekt ma już działający, rozbudowany runtime 2.5D, kompletny szkielet zasad RPG, sekwencję Prologu, grywalne lokacje Aktu I, zapis i odczyt stanu oraz zestaw testów jednostkowych. To wartościowa baza, nad którą można dalej pracować bez przebudowywania od zera.

Nie należy jednak utożsamiać poprawnego builda ani liczby testów z potwierdzeniem, że cały Prolog i Akt I zostały przejściowo zweryfikowane w grze. Pełny audyt ścieżek fabularnych, zapisów, walk i nawigacji pozostaje kolejnym zadaniem.

## Struktura projektu

- `src/game/rules/` — zasady Ostrza: postać, statystyki, rzuty, dialogi, walka, podróż, obóz, czas, świat i zapis.
- `src/game/data/` — dane gry i typy domenowe.
- `src/game/maps/` — mapy Prologu oraz Aktu I.
- `src/game/scenes/PrologueDirector.ts` — orkiestracja Prologu.
- `src/game/scenes/Chapter1Director.ts` — orkiestracja Aktu I, hubu, zadań, podróży i starć.
- `src/engine-bridge/OstrzeEngineState.ts` — połączenie gry z silnikiem oraz rejestr scen.
- `engine/` — submoduł silnika izometrycznego 2.5D.
- `origin/` — odrębna, starsza gra terminalowa i źródło części treści/reguł; nie jest runtime’em aplikacji Vite.

## Ważne prace wykonane przed dzisiejszą sesją

Według wcześniejszego raportu w `podsumowanie20112026.md` wykonano i zweryfikowano następujące prace:

- Konflikt skrótu `[C]` rozwiązano: centrowanie kamery przeniesiono na `[F]` / `[Home]`, a `[C]` pozostawiono dla Skradania.
- Kruche modyfikacje silnika przez `String.replace()` w `vite.config.ts` zastąpiono punktami rozszerzeń silnika: `registerCustomCharacterBaker()` i `registerPropVisualTransform()`.
- Dodano reset runtime’u silnika dla map Ostrza, eliminując niepotrzebne ładowanie domyślnej mapy przy każdej zmianie sceny.
- Dodano `destroy()` i czyszczenie DOM/listenerów dla interfejsów gry.
- Duży `OstrzeModalUi.ts` podzielono na widoki kreatora postaci, karty postaci, dialogów, ogniska i menu pauzy, zachowując jego publiczne API.
- Współdzielone typy i listy rozdziałów (`ChapterId`, `VALID_CHAPTER_IDS`, `isValidChapterId()`, `CHAPTER_DEV_SCENES`) uporządkowano dla zapisów, aplikacji i HUD-a.
- Wydzielono Pixi do chunka `vendor-pixi`.
- Zoptymalizowano sprawdzanie zapisu i renderowanie `CombatTargetOverlay`.
- Ujednolicono escapowanie HTML w widokach gry.
- Raport z poprzedniego etapu podaje: build poprawny, silnik `142/142` testów, gra `64/64` testów. Są to wyniki zapisane w raporcie; nie były ponownie uruchamiane w dzisiejszej sesji.

## Ustalenia z dzisiejszego grill-me

Wymagania dla developerskiego dostępu do lokacji:

1. „Nowa gra” w DEV rozpoczyna czysty Prolog testowy, ale nie kasuje zapisu. Zapis ma pozwalać wrócić do mocnej postaci i zapisanego postępu.
2. Tryb DEV ma mieć bezpośredni selektor lokacji, niezależny od aktualnego postępu fabularnego.
3. Teleport ma zachować postać i stan kampanii, w tym ekwipunek, zadania, czas oraz flagi.
4. Teleport ma być czysty: bez uruchamiania standardowych dialogów, zasadzek, zdarzeń wejścia ani autosave’u.
5. Selektor ma zawierać wszystkie grywalne lokacje Prologu i Aktu I, bez scen technicznych i aren jako osobnych pozycji.

## Zmiany wykonane w tej sesji

### Zapis i nowa gra

- Cache `hasOstrzeSave()` jest teraz powiązany z surową treścią wpisu w `localStorage`. Dane są walidowane przy pierwszym odczycie lub zmianie treści, a nie parsowane przy każdym renderze HUD-a.
- Zwykła „Nowa gra” kasuje stary zapis, zgodnie z komunikatem potwierdzenia.
- Nowa gra w trybie DEV zachowuje zapis. Menu pauzy informuje, czy jest zapis do wczytania, i jak wrócić do zapisanej postaci oraz ostatniej zapisanej lokacji.
- Powrót do Prologu po porażce zachowuje zapis; reset po porażce i rozpoczęcie nowej gry są rozdzielone semantycznie.
- Rozpoczęcie nowej gry z ekranu powitalnego czyści poprzedni zapis.

### Czyszczenie UI

- `OstrzeModalUi` śledzi aktywną instancję. Utworzenie następnej niszczy poprzednią, przerywa jej listener klawiatury i usuwa jej elementy DOM.

### Selektor lokacji DEV

- Metadane lokacji w `src/game/rules/travel.ts` zawierają teraz przypisanie do Prologu lub Aktu I.
- Selektor DEV korzysta z `OSTRZE_LOCATIONS`, więc lista jest powiązana z katalogiem gry, zamiast powielać identyfikatory w `main.ts`.
- Dostępnych jest 12 grywalnych lokacji: 4 Prologu i 8 Aktu I.
- Teleport ładuje scenę bez wywoływania normalnych metod wejścia w lokację. Aktualizuje aktywny rozdział i `world.location`, zachowuje trwały stan kampanii, ustawia ambience/światło oraz odświeża HUD.
- Przed zmianą aktywowane są właściwe handlery rozdziału. W Aktu I czyszczony jest tymczasowy etap walki i oczekujący kontekst podróży, aby nie uruchomiły się później stare callbacki.
- Selektor jest widoczny tylko w trybie DEV. Tooltip wyjaśnia, że teleport nie uruchamia wydarzeń i zachowuje stan.

### Istotny szczegół zachowania teleportu

Ładowanie nowej mapy silnika czyści aktywną walkę i aktorów opuszczanej sceny. Postać gracza i trwały stan kampanii pozostają zachowane, ale aktywne starcie nie jest przenoszone na mapę docelową. Teleport nie zapisuje automatycznie nowej lokacji.

## Weryfikacja dzisiejszych zmian

- `npm.cmd run build` — **OK** (`tsc --noEmit` oraz `vite build`). Ostatni build przetworzył 1033 moduły.
- `git diff --check` — **OK**; PowerShell/Git wyświetla ostrzeżenia o normalizacji LF/CRLF w dwóch plikach UI.
- Testów Vitest ani ręcznego przejścia gry w przeglądarce dzisiaj nie uruchamiano.
- Vite nadal zgłasza chunk większy niż 500 kB: `vendor-pixi` około 570.80 kB, główny chunk około 1,717.41 kB (około 427.88 kB gzip). Lazy loading przyszłych aktów pozostaje osobnym krokiem.

## Pliki zmienione w tej sesji

W repozytorium głównym:

- `src/game/rules/travel.ts`
- `src/game/scenes/Chapter1Director.ts`
- `src/game/scenes/PrologueDirector.ts`
- `src/game/state/saveManager.ts`
- `src/game/ui/OstrzeModalUi.ts`
- `src/game/ui/views/PauseMenuView.ts`
- `src/main.ts`

W submodule `engine/`:

- `src/ui/hudOverlay.ts` — opis i widoczność selektora developerskiego.

Zmiany są lokalne i nie zostały commitowane. Working tree pozostaje materiałem do dalszej pracy.

## Co dalej przy kończeniu Prologu i Aktu I

1. Użyć `WYTYCZNE_PROLOG_25D.md` jako checklisty Prologu i sprawdzić wszystkie warianty: obie klasy, wynik sparingu, testy dialogowe, walki, porażki, Istotę, pobojowisko i rozdroże.
2. Zebrać kryteria ukończenia Aktu I z `Chapter1Director`, map, danych gry i źródłowej zawartości `origin/`; nie zakładać, że istnienie sceny oznacza pełną implementację.
3. Przejść zapis/odczyt dla każdej lokacji oraz sprawdzić, czy przywracane są rozdział, scena, faza Prologu, czas, postać i flagi.
4. Dodać/uruchomić testy regresji dla świeżo zmienionych przepływów, a następnie wykonać ręczne przejście gry w przeglądarce.
5. Po osiągnięciu kryteriów ukończenia odświeżyć ten dokument oraz wskazać wszystkie znane ograniczenia.

## Punkt wznowienia

Nie zaczynać od nowa ani nie usuwać istniejącego zakresu. Zachować możliwość odzyskania mocnej postaci i dotarcia do każdej z 12 lokacji w DEV. Następny większy etap to rzetelny audyt i dokończenie ścieżek Prologu oraz Aktu I na istniejącej bazie.
