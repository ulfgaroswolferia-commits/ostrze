# Cykl E3 – szlify (silnik + spójność)

Data: 2026-10-30. Gałąź: `cykl-e3`. Status: do akceptacji.

## Cel
Doprowadzić grę do stanu „bez zgrzytów” przed publikacją: zamknąć odroczone drobiazgi z ledgerów (docs/superpowers/plans/*-ledger.md), które gracz zobaczy lub które psują zapis i logikę. Bez nowej treści i bez grafik (E3b).

## Kryterium sukcesu
Każdy punkt z zakresu jest albo naprawiony z testem (TDD, `test/` jest w gitignore → `git add -f`), albo zapisany w ledgerze E3 jako „nieaktualny” z powodem (zweryfikowany na bieżącym kodzie). Cały zestaw testów zielony. Wytyczne docs/wytyczne-tresci-i-qa.md obowiązują dla każdej zmiany treści.

## Metoda
Najpierw audyt: każdy kandydat jest sprawdzany na aktualnym kodzie (część mogła zostać naprawiona przy okazji). Wynik audytu trafia do ledgera `docs/superpowers/plans/2026-10-30-cykl-e3-ledger.md`. Potem trzy fale, każda kończy się zielonymi testami i commitem.

## Fala 1 – widoczne usterki
- Pusty ekran „Dalej” przed walką z Istotą (`dialogue.onCombat`): walka startuje bez pustego ekranu pośredniego.
- „(niedostępne) (niedostępne)” – jedno oznaczenie.
- „+0 gr” / „−0 gr” (złodziej z pustą sakwą, zdarzenia z kwotą 0): zerowe zmiany się nie wyświetlają.
- Pasek statusu w epilogu: ukryty lub dopasowany do ekranu końcowego.
- Ekran końcowy ze statystykami (dni, poziom, ukończone zlecenia, wybrane zakończenie).
- „!” na Galerii luster po jej oczyszczeniu.
- Martwe gałęzie: `akt6_epilog_list_nikt`, `komnata_cisza` – podłączyć albo usunąć.
- Porażki w zasadzkach obiecują straty, których nie ma (sakwa, broń, buty): tekst zgodny z faktycznymi skutkami.

## Fala 2 – silnik i zapisy
- `failedChecks` kluczowane per dialog + opcja zamiast per węzeł (koniec ponawiania tego samego testu z innego węzła); usunąć obejścia `*_oblany` tylko jeśli są wtedy zbędne.
- Naprawa zapisu zeruje `map.ambush` przy nieznanym spocie; `world.ambushes` wchodzi do WORLD_SCHEMA; wczytanie zapisu w środku spotu nie losuje zasadzki.
- Walidacja danych: `whenEmpty.costHp` ≥ 1, `rules.dialogue.chanceMax` ≤ 100, odrzucenie sceny zdarzenia o id `koniec`, `dlug.splac` z `requires money`.
- Prawdziwy test round-trip zapisu/wczytania na `akt4b_przejscie` i w środku trasy/dialogu.
- Efekt „Jesteś teraz” nie powtarza się przy odświeżeniu aktywnego efektu.

## Fala 3 – spójność treści
- Stany powrotu (wytyczna 1.4) dla Hjalmara, Smyka i Jadwigi; reakcje kwatermistrza i Smyka na własne zlecenia.
- Powitanie kapitana: raz, bez mieszania „ty/pan”.
- Sprzeczności: „pół roku” vs „cztery miesiące”, „wodociągi trzy dni”, „reszta świty” w `komnata_po_r`, „nóż na schodach”, `smyk_wola` „zdobądź papier” mimo dowodu, Jadwiga „Pisarz mówił” bez rozmowy, skarbnik „Wzięłam… wziąłem”, Istota „nie widziałeś od Obserwatorium”, Nieśpiący „dziesięć lat” vs pakt dwadzieścia, Brygida w dwóch miejscach naraz.
- Polszczyzna i anachronizmy: „żadnego sprzeczności”, „ale go nie zaprzecza”, „czy bardziej cię boję”, „do ocenienia”→„do oclenia”, „Z studni”→„Ze studni”, szrapnel, facet, kontakt wzrokowy, opłata manipulacyjna, adwokat, zarząd portu, pozew; pisarz „pan/ty”.
- Nazwa wroga „Patrol miejski” → „Strażnik miejski”.
- `szklo_wola` i `wojna_*` w ostatnich słowach cesarza; wariant epilogu dla `szklo_wola`.
- Nowe asercje w `test/content_quality.test.js` tam, gdzie da się je zautomatyzować (np. zakaz wypisanych anachronizmów, brak powielonych fraz).

## Poza zakresem
Portrety i grafiki (E3b); balans włóczni i trywialni wrogowie (czeka na przejście gry przez użytkownika); luki wyłącznie w testach; migracje starych zapisów demo; nowa treść i mechaniki.

## Ryzyka
- Klucz `failedChecks` zmienia format zapisu → migracja (nowa wersja zapisu) albo kompatybilny odczyt starego klucza.
- Zmiany tekstów nie mogą złamać testów osiągalności scen ani lintu spójności.
