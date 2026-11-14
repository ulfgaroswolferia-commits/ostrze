# Ledger cyklu E3 (szlify)

Plan: docs/superpowers/plans/2026-10-30-cykl-e3-szlify.md. Spec: docs/superpowers/specs/2026-10-30-cykl-e3-szlify-design.md.
Pre-flight: zadania dzielą tylko wspólne pliki testowe (`test/e3_*.test.js`) – brak konfliktu interfejsów.

## Audyt (Task 1)
| Punkt | Werdykt | Zadanie |
|---|---|---|
| "+0 gr"/"−0 gr" (`src/ui/events.js:46-65`: delta 0 → "+0", zlodziej_kradnie n=0) | do zrobienia | 2 |
| Podwójne "(niedostępne)" | do sprawdzenia testem (menu.js dopisuje `menu.unavailable` do etykiety, `lockedHint` daje hint osobno) | 2 |
| Pusty "Dalej" przed Istotą | do sprawdzenia testem (`dialogue.js` idzie od razu do `runCombat`) | 2 |
| Ekran końcowy ze statystykami | do zrobienia (`end_screen.js` bez statystyk; `hero:false` już jest, więc paska statusu tam nie ma) | 2 |
| Pasek statusu w epilogu | nieaktualny dla ekranu końcowego; epilog jako narracja – do sprawdzenia | 2 |
| "!" na Galerii luster po oczyszczeniu | do sprawdzenia (`map.js:79` `marked`) | 3 |
| `akt6_epilog_list_nikt` | nieaktualny: id nie istnieje w danych | – |
| `komnata_cisza` | nieaktualny: scena osiągalna (domyślna gałąź po `pelnomocnik_pokonany`) | – |
| Porażki zasadzek obiecują straty | do sprawdzenia testem | 3 |
| `failedChecks` per węzeł | częściowo nieaktualny: klucz już zawiera dialog (`failedKey`), zostaje wariant z jawnym `id` opcji | 4 |
| `map.ambush` przy naprawie (`quests.js:357`) | zeruje się w jednej gałęzi; do sprawdzenia drugiej | 4 |
| `world.ambushes` poza WORLD_SCHEMA | do zrobienia (`spots.js:76-78` używa, schemat nie zna) | 4 |
| `whenEmpty.costHp` ≥ 1 | do zrobienia (`data.js` nie waliduje whenEmpty) | 5 |
| `chanceMax` ≤ 100 | do zrobienia (`data.js:190` tylko INT_MIN1) | 5 |
| scena zdarzenia o id "koniec" | do sprawdzenia | 5 |
| "Jesteś teraz" przy odświeżeniu | do sprawdzenia (`effect.applied`) | 5 |
| Stany powrotu Hjalmar/Smyk/Jadwiga, kapitan, sprzeczności tekstów | do sprawdzenia w danych | 6 |
| Frazy/anachronizmy (większość) | nieaktualne: grep znajduje tylko "Zarząd portu" (kapitan_przystani) | 7 |
| Wróg "Patrol miejski" | do zrobienia (`enemies.json:1310`, tylko `name`; plik `art/patrol_miejski.pix` zostaje) | 7 |

## Rulings
- Task 2: Ruling: pusty "Dalej" przed Istotą to końcowe menu obozu po dialogu `istota_bez_maski` (następna scena to walka, nie `onCombat`) — dodane opcjonalne pole sceny `camp: false` zamiast heurystyki — koszt pomyłki: kolejny dialog przed walką musi mieć to pole jawnie.
- Task 2: pasek statusu w epilogu — nieaktualny (ekran końcowy ma `hero:false`); statystyki dodane jako linia (`endStatsLine`, `end.stats`) w ramce jako powiadomienie, w trybie liniowym po napisie.
- Task 2: complete — 1517 testów zielonych.
- Task 3: nieaktualny w całości — porażki 4 zasadzek nie obiecują strat (sprawdzone skryptem po travel.json), "!" na mapie oznacza tylko cel zlecenia (`watek_wir.progi` ma `at: wejscie`, nie galerię), martwych scen brak. Bez zmian w kodzie.
- Task 4: Ruling: `failedChecks` zostaje kluczowane dialog:węzeł:opcja — id opcji NIE są unikalne w obrębie dialogu (np. "dalej" w wielu węzłach, istota.json), więc klucz dialog:id zlałby różne opcje; luka „ten sam test z innego węzła” jest świadomie nienaprawiana — koszt pomyłki: test powtórzony z drugiego węzła można ponowić (dotyczy tylko ręcznie zduplikowanych testów; demo ma obejście flagami).
- Task 4: `map.js` — wznowienie w środku spotu już nie losuje zasadzki (`m.spotScene === null` w warunku); zerowanie `map.ambush` w naprawie jest w gałęzi nieznanego spotu — nieaktualne.
- Task 4: `world.ambushes` dodane do WORLD_SCHEMA (test: poprawny round-trip, uszkodzony → LoadError).
- Task 5: Ruling: walidator schematów (`src/engine/schema.js`) nie zna `max`, więc `chanceMax ≤ 100` jest jawnym sprawdzeniem w `data.js` obok `chanceMin > chanceMax` — koszt pomyłki: brak.
- Task 5: Ruling: "Jesteś teraz" przy odświeżeniu aktywnego efektu zostaje — komunikat jest prawdziwy (efekt zostaje nałożony na nowo), zmiana wymagałaby nowego typu zdarzenia — koszt pomyłki: kosmetyczny.
- Task 5: round-trip zapisu na `akt4b_przejscie` już istnieje (`capital_story.test.js:113`) — nieaktualne.
- Task 5: zrobione z testami: `whenEmpty.costHp ≥ 1`, `chanceMax ≤ 100`, zakaz sceny zdarzenia "koniec", `requires money 10` w spłacie długu przekupki. 1522 testy zielone.
- Task 6: Ruling: stany powrotu zrealizowane małą funkcją silnika — pole dialogu `returnStart` (węzeł startowy po pierwszej rozmowie; flaga `dialog_met_<id>` ustawiana w `finishDialogue`, funkcja `startNodeOf`) zamiast kopiowania łańcuchów scen — dotyczy Smyka, Hjalmara, siostry Jadwigi i kapitana Warsa (to jednocześnie M1 „powitanie kapitana powtarza się”) — koszt pomyłki: nowy plik zapisu nie jest potrzebny (flaga w `flags`), stare zapisy dostają powitanie powrotne tylko po kolejnej rozmowie.
- Task 6: nieaktualne (już naprawione w przeglądzie redakcyjnym): „reszta świty”, „nóż na schodach”, „Pisarz mówił”, „dziesięć lat”, „nie widziałeś od Obserwatorium” (jest „od nocy, w której obudziłeś się…”), „pół roku/cztery miesiące”. Pozostałe punkty (kwatermistrz/Smyk reagują na własne zlecenia, `szklo_wola` w ostatnich słowach cesarza) — świadomie poza E3: to nowa treść, nie szlif.
- Task 7: zrobione — „Zarząd portu” → „Starszyzna portowa”, wróg `patrol_miejski` ma `name: Strażnik miejski` (id i plik grafiki bez zmian), test zakazanych fraz w `content_quality.test.js`. Pozostałe frazy z listy już nie występowały. 1527 testów zielonych.

## Final review (fresh reviewer, najmocniejszy model)
- Final: fixed (Important) podtematy Smyka/Hjalmara/Jadwigi/kapitana wracały do węzła `start` (powitanie pierwszej wizyty) — test `treść: … osobne powitanie przy powrocie` RED→GREEN, suite 1527/1527; test porównuje teraz całe węzły (poza tekstem), więc Minor 2 też załatwiony.
- Final: minor (deferred): w `src/ui/end_screen.js` dwa JSDoc pod rząd (komentarz `showEndScreen` wisi nad `endStatsLine`).
- Final: minor (deferred): `WORLD_SCHEMA.search { max: 100 }` jest po cichu ignorowane, bo `schema.js` nie zna `max` (stan zastany).

## Wynik cyklu
Naprawione z testami: zerowe kwoty, podwójne „(niedostępne)”, statystyki ekranu końcowego, `camp: false` przed walką z Istotą, `world.ambushes` w schemacie, walidacje (`costHp`, `chanceMax`, id „koniec”), wymóg pieniędzy w spłacie długu, `returnStart` (4 postacie), nazwy/anachronizmy. Nieaktualne: martwe sceny, Galeria luster „!”, porażki zasadzek, większość fraz. Poza E3: E3b (grafiki), balans włóczni, kwatermistrz/Smyk reagujący na własne zlecenia, `szklo_wola` w ostatnich słowach cesarza.
