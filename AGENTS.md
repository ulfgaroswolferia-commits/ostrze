# Tymczasowe przypomnienie — Faza 3 malarskich propów (4 pozostałe grafiki z 8)

> **WAŻNE:** To tymczasowa notatka robocza po osiągnięciu limitu generatora obrazów (**reset kwoty: sobota 28 listopada 2026, ok. godz. 22:13 CET**). Po wygenerowaniu i wdrożeniu poniższych 4 brakujących grafik **usuń ten plik (`AGENTS.md`)**.

Wdrożone już w Fazie 3: `brama_szlaku.jpg` (`exit_path`), `skrzynki_drewniane.jpg` (`dungeon_crate`), `beczka_drewniana.jpg` (`dungeon_barrel`), `beczka_wybuchowa.jpg` (`idPrefix: 'oil_barrel'`).

Pozostałe 4 sprite'y (1024×1024, czyste białe tło `#FFFFFF`, bez cienia, styl jak `src/game/assets/props/skrzynia_zamknieta.jpg`):

1. `stol_drewniany.jpg` (`kind: 'dungeon_table'`) — solidny słowiański drewniany stół z glinianym kubkiem/talerzem, czysta biel między nogami.
2. `filar_kamienny.jpg` (`kind: 'pillar'`) — wysoki omszały pęknięty kamienny filar/obelisk na kwadratowym cokole.
3. `pochodnia_slup.jpg` (`kind: 'torch_sconce'`) — drewniany słup z kutym żelaznym koszem i żarzącymi się węglami (bez wielkiego płomienia — silnik rysuje żywy ogień).
4. `belka_wspornik.jpg` (`kind: 'dungeon_support'`) — drewniany słupek/wspornik ze skośnym zastrzałem, żelazną obejmą i pętlą konopnej liny.

**Po wdrożeniu:** Sprawdzić wszystkie 4 grafiki na ciemnym tle, podpiąć w `src/game/assets/painterlyProps.ts`, dopisać asercje w `tests/verticalSliceFalloutDrakensang.test.ts`, **zweryfikować dopasowanie animacji** (szczególnie wysokość żywego płomienia i iskier nad koszem `pochodnia_slup.jpg` oraz kontaktowe AO/reakcje dla `stol_drewniany.jpg`, `filar_kamienny.jpg`, `belka_wspornik.jpg`), puścić `vitest` + `tsc --noEmit` i **usunąć ten plik `AGENTS.md`**.
