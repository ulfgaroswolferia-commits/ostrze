# SDD ledger — plan: docs/superpowers/plans/2026-10-27-cykl-e2g-pod-czerwonym-sztandarem.md
Pre-flight: Task 1 produces hub/region/trasa consumed by 3-6; Task 2 enemies consumed by 5; Task 4 flags/var consumed by 6. No conflicts.
Task 1: complete (commit 91220ae, tests: npm test → 1314/1314)
Task 2: complete (commit 91220ae)
Task 3: complete (commit 91220ae)
Task 4: complete (commit 91220ae)
Task 3-4: Ruling: tasks 1–4 committed together (graph/distances/guidelines tests were red until content landed) — one commit instead of four — cost: coarser bisect
Task 4: Ruling: zlecenia nie mają requires.known; onStart robi reveal celu — tablica ma pokazywać wszystkie 6 zleceń od razu
Task 4: Ruling: tests: test/ is git-ignored, new tests added with git add -f
Task 4: Ruling: helpers.pruneMissingQuests też wycina region front (fixtures nie znają zleceń frontu)
Task 5: complete (commit 7a422df, tests: npm test → 1317/1317)
Task 6: complete (commit 621e657, tests: npm test → green)
Task 6: Ruling: dodano drugie dalekie miejsce Jar Dezerterów (4 dni) i znalezisko na Wzgórzu — lint odległości z E2e wymaga ≥2 dalekich na hub, 4 dni, pola walki, znaleziska i postaci
Task 7: balans — test bilansu (3 zlecenia < kolczuga z kuźni < 6 zleceń; xp ≥ 2 poziomy), --validate OK
Final: fixed I1 medyczka reaguje na wojna_ranni_* — test "medyczka reaguje…" RED→GREEN
Final: fixed I2 wyjazd do stolicy z potwierdzeniem, skrzynia zostaje — test "wyjazd do stolicy…" RED→GREEN
Final: fixed M1 (kapitan_wola na końcu listy gości), M7 literówka, część M11 (polszczyzna)
Final: Ruling: sojusznicy jako krótkie narracje (bez spotów tomasz_front/wedrowcy_lazaret) — wystarczają jako cameo, rozmowy w E2h — koszt: mniej treści sojuszników
Final: Ruling: flagi wojna_beczki_*/wojna_dezerterzy_* zamiast wojna_proch_*/wojna_szpieg_* (smoła, dezerterzy) — E2h/E3 czytają nowe nazwy; spec do aktualizacji — koszt: poprawka nazw w specu
Final: Ruling: furman przeniesiony na przeprawę; obóz Jarnowian bez pola walki — zostaje do E2h
Final: minor (deferred): M2–M6, M8–M13 (logika tekstów dezerterów, czas w rozstrzygnięciach, zerwany most w opisach, geometria mapy, T3 w kantynie, spójność wola, stany kapitana, teksty „późne” niezależne od wyborów); testy zapisu w środku trasy/dialogu i symulacja 200 podróży
