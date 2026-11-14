# SDD ledger — plan: docs/superpowers/plans/2026-10-28-cykl-e2h-ulfgrod.md
Task 1: complete (zasadzka: spot.ambush, world.ambushes, map.ambush; commit prior to 53ab75e)
Tasks 2–7: complete (commit 53ab75e, tests: npm test → 1371/1371, --validate OK)
Ruling: Tasks 2–6 committed together (graf/odległości/wytyczne wymagają treści naraz) — jeden commit zamiast pięciu — koszt: grubszy bisect
Ruling: biuro_pisarza (nowy spot, dialog pisarz) rozlicza zlecenia stolicy zamiast tablicy/Hjalmara — czytelniejsze menu — koszt: jedno miejsce więcej w hubie
Ruling: pałac odkrywa wyłącznie rozmowa ze Smykiem (reveal), komnata tronowa dostępna tylko nocą po palac_otwarty — wątek główny, test pilnuje jedynego reveal
Ruling: zasadzka jako lista scen [reset-flag, wstęp, wybór(dialog), skoki, walka, po, ucieczka, porażka, wyjście] — bez zmian silnika scen, flagi amb_*_walka/ucieczka zerowane w pierwszej scenie
Ruling: ostatnie słowa cesarza zależą od wola/dlug (var ≥ 3), wariant śmierci według flag sojuszy (bunt > zamach > pęknięcie)

## Recenzja końcowa (Opus) – runda poprawek
- Final: fixed I1 zasadzki blokowały Wymowę/Skradanie po porażce rzutu — `retry: true` w 8 opcjach; test „zasadzki: nieudany rzut…” RED→GREEN, suite 1379/1379
- Final: fixed I2 region stolica bez zdarzeń — 12 zdarzeń regionu (4 ataki z ucieczką i porażką, spotkania, handlarz), wilki ograniczone do regionów dziczy; test „stolica: co najmniej dwanaście zdarzeń…” RED→GREEN
- Final: fixed I3 sceny `*_pozno` wypierały warianty pory dnia — wzorzec „raz” (`*_bylo`), teksty bez mostu/beczek, alchemik nie prosi po własnym zleceniu, martwa scena na schodach pałacu usunięta; testy „sceny późno…”, „pałac: schody…” RED→GREEN
- Final: fixed I4 kwatermistrz obiecywał ponowną próbę — odsyła do świątyni; test „kwatermistrz…” RED→GREEN
- Final: fixed I5 ostatni krok wątku — rozbity na „Smyk” i „komnata tronowa”; test „wątek stolicy: ostatni krok…” RED→GREEN
- Final: fixed I6 mapa vs czasy/hinty — przerysowana (wszystko od huba, kierunki zgodne z hintami); test „mapa tekstowa zgadza się…” RED→GREEN
- Final: minor (deferred): `quests.js` naprawa nieznanego spotu nie zeruje `map.ambush`; `map.js:121` stary zapis w środku spotu może losować zasadzkę; `world.ambushes` poza WORLD_SCHEMA; cooldown liczy dzień kalendarzowy
- Final: minor (deferred): brak przekupstwa w zasadzkach, `search` nie podnosi szansy zasadzki, ostatnie słowa cesarza bez `szklo_wola`/`wojna_*`, bunt bez przyczyny śmierci, węszyciel bez noża
- Final: minor (deferred): porażki w zasadzkach obiecują straty, których nie ma (sakwa, broń, buty); wyzysk szulerów (+8 powtarzalnie) i przekupki (darmowy prowiant)
- Final: minor (deferred): smyk_wola mówi „zdobądź papier” mimo dowodu; Smyk „wodociągi trzy dni” sprzeczność; Jadwiga „Pisarz mówił” bez rozmowy; kwatermistrz/Smyk bez reakcji na własne zlecenia; „pół roku” vs „cztery miesiące”; skarbnik „Wzięłam… wziąłem”; `dlug.splac` bez `requires money`
- Final: minor (deferred): polszczyzna („żadnego sprzeczności”, „ale go nie zaprzecza”, „czy bardziej cię boję”, `amb_targ_porazka`, „do ocenienia”→„do oclenia”), współczesne słowa (szrapnel, facet, kontakt wzrokowy, opłata manipulacyjna, adwokat), pisarz „pan/ty”
- Final: minor (deferred): Hjalmar/Smyk/Jadwiga bez stanów powrotu (1.4); brak `portrait` w dialogach stolicy i grafiki pałacu/wejścia zastępcze (do E3b); nazwa wroga „Patrol miejski” → „Strażnik miejski”; symulacje balansu tylko dla miecza (włócznia: targ 0,675, przemytnicy 0,59)
