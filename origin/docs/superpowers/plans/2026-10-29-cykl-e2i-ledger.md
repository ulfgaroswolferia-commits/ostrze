# SDD ledger — plan: docs/superpowers/plans/2026-10-29-cykl-e2i-pod-palacem.md

Pre-flight: Task 2 (hub lochu) i Task 5 (wpięcie) dzielą `watek_loch`/`starts`; graf-lint wymaga `starts`, więc zadania 2–5 poszły jednym commitem.
- Ruling: loch to osobny region `loch` (nie `stolica`) — region wymaga niepustego `forage`, mapa tekstowa per region; hub bez `near`/`far` — koszt: dodatkowy region w danych.
- Ruling: Pełnomocnik bez testu rzutu (Wymowa) w rozmowie — nagroda za sukces byłaby kosmetyczna; cztery wejścia (aneks, wola, dług, walka) — koszt: mniej wariantów.
- Ruling: `akt4b_przejscie` zmienia typ z `ending` na `narration` (id zostaje, stare zapisy się wczytują); nowe zakończenie to `akt4c_przejscie`.
- Ruling: Cisza po cesarzu czyta `noc_bunt/zamach/pekniecie` zamiast `sojusz_*` — wariant zgodny z tym, co faktycznie się stało.
Task 1: complete (500bc4e) — wrogowie, balans miecz/włócznia (boss 0,81/0,565).
Tasks 2–5: complete (b7e06b2) — suite 1405/1405, --validate OK.

## Recenzja końcowa (Opus) – runda poprawek
- Final: fixed I1 Pełnomocnik za trudny dla surowego Ostrza — boss hp 185, Egzekucja 10–15; testy „Pełnomocnik z surowym Ostrzem” RED→GREEN, suite 1410/1410 (bogdana miecz 0,895 / włócznia 0,735; surowe 0,725 / 0,40)
- Final: fixed I2 wejście do lochu oblewało `watek_ulfgrod` bez Hjalmara — cel 1 przechodzi też przez `palac_otwarty`; test „wejście do lochu nie oblewa wątku miasta” RED→GREEN
- Final: fixed I3 martwe miejsce po wygranym pojedynku — scena `*_pusto`, flaga tylko raz, cel 1 wątku na `wejscie`; test „po wygranej pojedynku miejsce pokazuje scenę pusto” RED→GREEN
- Final: fixed I4 `akt4b_przejscie` zakładał lokaja — kucharz z obowiązkowej sceny; test „nie zakłada spotkania z lokajem” RED→GREEN
- Final: Ruling: region `loch` bez odległości/pól walki/zdarzeń (wytyczna 17) i bez NPC do pogadania (1.4: czterostanowe `wejscie`) — w lochu nie ma podróży — koszt: wyjątek w lintach; `forage: orzechy` nieużywane
- Final: minor (deferred): Istota „nie widziałeś od Obserwatorium” (widziana w akcie I); brak zdania o powrocie do komory między Ciszą a Długiem; „Z studni” → „Ze studni”; „Za rzeką” a Jarnowo to wyspa, „Łysa Skała” po raz pierwszy w danych; Nieśpiący „dziesięć lat” vs pakt dwadzieścia; martwa `komnata_cisza`; podwójne „Kontrahent.” i brak wariantu „po porażce” w komnacie; odstępstwa od planu (narracje zamiast 4 dialogów, Nieśpiący z ucieczką, brak `loch_komnata_gotowa`, wyższe HP); brak portretów w dialogach lochu; brak prawdziwego testu wczytania zapisu na `akt4b_przejscie`; „coś w rodzaju winy” (1a)

## Poprawki po scaleniu (branch poprawki-e2i)
- fixed: minory E2i M1–M5, M7, M10, M11, M12 (teksty Istoty/Ciszy/zakończenia, lata Nieśpiącego, „Kontrahent” raz, portret Istoty, test starego zapisu `akt4b_przejscie`)
- fixed: minory E2h — decyzja zasadzki przy wznowieniu starego zapisu (`map.js`) i reset `ambush` w naprawie zapisu (`quests.js`); `smyk_wola` nie każe zdobywać papieru temu, kto ma dowód
- nadal odłożone: wyzysk szulerów/przekupki, brak przekupstwa w zasadzkach, stany powrotu Hjalmara/Smyka/Jadwigi, portret Pełnomocnika, wariant „po porażce” w komnacie Rdzenia, martwa `komnata_cisza`
