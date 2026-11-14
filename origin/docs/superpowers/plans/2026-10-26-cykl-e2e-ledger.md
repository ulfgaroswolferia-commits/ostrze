# Cykl E2e – ledger (podróże, ekwipunek, wrogowie, wątek główny)

> Plan: `2026-10-26-cykl-e2e-podroze-ekonomia.md`; spec: `../specs/2026-10-26-cykl-e2e-podroze-ekonomia-design.md`. Wykonanie natywne na gałęzi `cykl-e2e`.

## Co powstało
- **Silnik:** spacery do 8 h z kilkoma zdarzeniami (`rollLocalEvents`, `world.map.walk` z `legs`/`events`/`step`), zanikanie szansy zdarzenia na powtarzanej trasie (`repeatChance`, `world.passes`, próg > 0), zapis v12 z migracją, `tier` i typ `material`, tabele łupów (`data/loot.json`, akcja `giveRandom`), pola walki (`hunt` z cooldownem, `world.hunts`), dalekie miejsca (`far` + faza mapy `far`, do 4 dni), błąd panelu celów (lokacje innych regionów), wątek główny (`main: true`).
- **Dane:** 104 przedmioty (stopnie 1–4), 18 wrogów (11 nowych z grafikami), 10 sklepów, 3 trasy hub–hub i 6 dalekich, 6 pól walki w pobliżu, 45 zdarzeń w podróży, 6 zleceń z drogi, 3 zlecenia wątku głównego.
- **Testy:** 1264 zielone; nowe: `map_region`, `travel_repeat`, `walk_multi`, `loot`, `hunt`, `far_places`, `items_catalog`, `enemies_e2e` (symulacje 200 ziaren), `shops_e2e`, `distances`, `events_e2e`, `main_thread`, `economy`, `e2e_economy`.

## Rulings (z planu i z wykonania)
Plan R1–R10 (patrz plan). Z wykonania:
- Task 2: `tier` dodany do 14 istniejących przedmiotów od razu (walidator go wymaga).
- Task 4: `odtrutka` zdejmuje `trucizna`; `lupy_rzadkie` (T4) to osobna tabela dla dalekich miejsc.
- Task 6: sklep kowala z Brodu scalony z jego miejscem (rozmowa, potem towar na żądanie), Szkarad to sekretne miejsce odkrywane przez kowala; nie przesuwa to numeracji menu w dziesiątkach testów e2e.
- Task 7: `wilcza_nora` zostaje miejscem zlecenia (nie `far`); dalekie miejsca reużywają istniejące grafiki scen (placeholder do E3b); `exitWhen` mapy odsyła gracza do huba; znaleziska w dalekich miejscach to deterministyczne `reward`.
- Task 9: popchnięcia to niewymuszone wizyty (nie `forced`) na początku listy gości; dialog `ostromir_brama` osobno od drogowego; `main` poza limitem `maxActive`.
- Task 10: ceny sprzętu T2 ×0,55 i T3 ×0,5, żeby zestaw T2 (broń + tułów + głowa, ok. 206 gr) był osiągalny z zarobków aktu II (ok. 230 gr); `buty_podkute` i `plaszcz_wedrowca` trafiły do kramiku w Brodzie (były martwe).

## Odłożone (poza zakresem)
- Ulepszanie broni u kowala.
- Własne ilustracje dla 6 dalekich miejsc i portretu Szkarada poza minimum (E3b); dziś reużywają obrazy scen.
- Zdarzenia fabularne na trasach hub–hub (`fixed`); dziś tylko losowa tabela regionu.
- Strojenie XP z walk (poziom 3 na końcu aktu II wynika dziś z XP zleceń).
- Dalsza fabuła: Akty IV–V (osobny spec; to cykl E2f+).

## Do przetestowania ręcznie przez użytkownika
- Podróż Wilczy Bród → Głuszec (3 dni) i Głuszec → Obserwatorium (2 dni), czy tempo zdarzeń jest dobre.
- Pola walki (cooldown 3 dni), dalekie miejsca (2–4 dni): czy trudność i nagrody są w porządku.
- Ceny: czy pierwszy sprzęt T2 kupuje się „po wysiłku”.
- Wątek główny: czy dziennik rzeczywiście zawsze mówi, co dalej, i czy wizyty-wskazówki są czytelne.

## Recenzja końcowa (opus, cała gałąź) – wyniki
Nic krytycznego; 1264 testy zielone przed poprawkami.
- **Naprawione (1267 testów zielonych):** I1 – łupy aktu II (`lupy_herszt`, `lupy_zolnierz`) bez T3/T4, Twierdza graniczna bez T4 (T4 zostaje w dalekich miejscach Głuszca i Gwiazd jako świadoma decyzja: rzadka nagroda za 4-dniową wyprawę); I2 – zlecenia z drogi nie startują po końcu aktu huba (`notFlag` końca aktu); M1 – koniec aktu zamyka wątek główny nawet po ominięciu kroków (obława w Głuszcu).
- **Minory M2–M7 domknięte po recenzji (1274 testy zielone):** M2 zapis ze środka huba dostaje wątek główny przy wejściu w mapę (nigdy drugi raz); M3 tablica nie liczy wątku do limitu; M4 `exitWhen` i naprawa fazy `far` czyszczą `world.travel`; M5 walidator `far` wymaga trasy z huba sceny mapy swojego regionu; M6 szansa zdarzenia na spacerze liczy groźniejszy koniec trasy (tak samo w obie strony); M7 jednorazowe znalezisko, którego nie dało się unieść (`za_ciezko`), nie zużywa zdarzenia (`world.heavyLoot`). Testy: `test/review_fixes_e2e.test.js`.
- **Nie oceniane przez recenzenta:** ton nowych dialogów, wygląd grafik, balans 11 wrogów (sprawdzony symulacjami w testach), statystyki broni względem ceny.

## Wymagania na spec Aktów IV–V (uwaga użytkownika 26.10)
W okolicach stolicy (Akt IV) mają być **zdarzenia napadu przed wejściem do miejsca w hubie** (np. przed wejściem do karczmy lub do innej lokacji huba). Wymaga to nowej funkcji silnika: spot z polem np. `ambush: { chance, scenes }` (losowanie przy wejściu, walka lub scena przed właściwą sceną miejsca, z `if` na stan gracza i `search`, bez zapętlania i z zapisem w środku).
