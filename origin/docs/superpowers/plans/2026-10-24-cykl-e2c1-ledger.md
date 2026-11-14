# SDD ledger — plan: docs/superpowers/plans/2026-10-24-cykl-e2c1-akt-iii-a.md
Wykonanie natywne na gałęzi cykl-e2c1. Spec: docs/superpowers/specs/2026-10-24-cykl-e2c-akt-iii-design.md
Task 1: complete (silnik search: world.search, rules.search, warunek/akcja, spadek o północy, zapis v11; npm test → 1016/1016)
Task 2: complete (wskaźnik Poszukiwania na mapie i w dzienniku; npm test zielony)
Fix: czasy marszu – near.via (Leśniczówka 30 min od Lasu, 70 od strażnicy), mapa Pogórza poprawiona; test travel_geometry
Task 3: complete (akt2_koniec_scena→narracja, akt3_wejscie/mapa(arriveAt)/odpoczynek/zapis/dalej/akt3a_koniec_scena, region glusz; test act3_start; npm test zielony)
Fix: zboże zamiast mąki (zboze_dla_mlyna, worek_zboza, ostap_zboze)
Task 4: complete (hub Głuszec: 12 miejsc, 4 dialogi, sklep, 3 pogadanki x4 stany; test gluszec_hub; npm test 1027/1027). Portrety NPC → Task 9
Task 5: complete (6 lokacji glusz z mapą i pogadankami, zlecenie przyjecie_w_osadzie, sołtys 3 wymiany, nocleg; test act3_locations; npm test 1030/1030)
Awans: punkt atrybutu co 2 poziomy (3., 5., …), bez zamiany perka; rules.leveling.attributeEveryLevels, pending.attributePoints, applyLevelUp(attributes), ekran Atrybuty przed umiejętnościami; testy levelup_attributes + scenes; 1034/1034
Lint: test/consistency.test.js (flagi/przedmioty) + lista flag pamięci do wykorzystania w akcie III (plan: sekcja Ciągłość)
Task 6: complete (zlecenia 1–6: klusownik_i_gajowy, dlug_mlynarza, listy_z_tamtej_strony, kto_sprzedal_ocalalego, zwiad_na_wzgorzu, falszywe_papiery; 5 nowych dialogów, spoty, przedmioty; użyte flagi pamięci kurier_pytal, odrzucil_stolice, waha_sie, towarzysze_zgineli, technologia_wiedza; test quests_act3a_1; 1053/1053)
Task 7: complete (zlecenia 7–12: rannego_nie_zostawia_sie, szara_trzcina, wdowa_po_straznik, najemnik_w_karczmie, zaginiona_karawana, co_widziala_ragnoslawa; goście: najemnik, falszywy_pielgrzym, wedrowny_handlarz; kamieniołom odkrywalny też z plotek Mruka; test quests_act3a_2; 1062/1062)
Task 8: complete (wrogowie zwiadowca_cesarski i klusownik, dialogi kontrola/oblawa/po_zwiadowcach, zdarzenia kontrola_zwiadowcow/patrol_zwiadowcow/klusownicy_w_boru, goście kontrola i oblawa, zakończenie obławy; test scouts z symulacją 200 ziaren; wykorzystane ukryte_insygnia; 1070)
Task 9: complete (16 portretów, 7 obrazów lokacji, 2 grafiki wrogów, map.exitWhen kończy odsłonę od razu po akt3a_koniec, zakończenie obławy osobne; testy act3a_e2e (obie klasy) i guidelines; npm test zielony)

## Recenzja końcowa (Opus) i tura poprawek
- Final: fixed C1 echo z kamieni – scena wraca do czasu startu zlecenia (questStatus none), „Odchodzę” też startuje zlecenie – review_fixes3 C1
- Final: fixed C2 – map.leaves porzuca zlecenia Wilczego Brodu po wejściu w akt III; maxActive 10 – review_fixes3 C2 (+e2e z 8 otwartymi zleceniami)
- Final: fixed I1 migracja 10→11 przemianowuje zlecenie/cel/flagę/przedmiot mąka→zboże
- Final: fixed I2 przedmioty misc nie do wyrzucenia (inv.storyItem), I3 odmowa startQuest przerywa resztę akcji węzła, najemnik zależny od questStatus
- Final: fixed I4 near.via dla Kamieniołomu (przez Bór) i Bagien (przez Trakt) + walidacja tego samego regionu; I5 kontrola_droga bez karczmy i piwnicy, czerwone płaszcze; I6 retry testów i pamięć o insygniach; I7 goście forced (kontrola, obława); I8 stany „po” (gajowy, stach, radosz, kopacz, furman, sołtys), ukryty ranny; I9 podpowiedź o cmentarzu w zakończeniach zleceń 4 i 5
- Final: fixed minor – literówki i sprzeczności z raportu (dozorca, córka, kowal, halina, furman, znachorka, stach, gajowy, Mruk, akt3_wejscie, Rzeczka w sołtysie), arriveAt/else-if, near.via dead line, MEMORY
- Final: minor (deferred): postacie ze starych zapisów na poziomie ≥3 nie dostają wstecz punktów atrybutów; przebieg tury wrogów przy śmierci gracza (zmiana łamie sterownik testów walki – do osobnego cyklu); perk odblokowany właśnie wybranym atrybutem niedostępny w tym samym awansie; izba bez opłaty pozwala spać; znachorka „na sprzedaż” bez sklepu; „Zapłać teraz” vs test Wymowy (test teraz daje 3 gr więcej)
Task 1–2 (IIIb): complete (przejście IIIa→IIIb, hub Obserwatorium, 6 lokacji Szklanych Wzgórz ze zjawiskami; testy act3b_start, act3b_locations)
Task 3 (IIIb): complete (zlecenia 1–5: przyjecie_w_obserwatorium, szklo_z_krateru, pamiec_kamieni, wrak_maszyny, mgla_ciszy; test quests_act3b_1; fixtures: pruneMissingQuests)
Task 4–5 (IIIb): complete (zlecenia 6–10: cesarski_dezerter, dlug_istoty_zlecenie, wiesci_z_gluszca, ostatnia_strazica_zlecenie, przygotowania; finał rozdroze_final z 7 zakończeniami; testy quests_act3b_2, finale; wykorzystane flagi pamięci dlug_istoty, towarzysze_zaufanie, komendant_wie_o_szkole; 1127/1127)
Task 6 (IIIb): complete (5 portretów, 7 obrazów lokacji; test guidelines)

## IIIb (cykl-e2c2): recenzja końcowa (Opus) i tura poprawek
- Final: fixed C1 – map.starts: zlecenie wejściowe rusza po `leaves` (dotyczyło też IIIa; sceny akt3_przyjecie/akt3b_przyjecie usunięte) – review_fixes4 C1 (oba huby, pełny limit)
- Final: fixed C2 – giveItem bez miejsca przerywa resztę akcji węzła (flaga „wzięty” nie powstaje) – review_fixes4 C2
- Final: fixed I1 kolejność zakończeń (pomoc dla Głuszca przed obławą), I2/I3 zakończenia neutralne wobec liczby i składu sojuszników, I4 Hieronim po wydaniu Tomasza, I5 sakiewka Tomasza = 30 gr, I6 q10_start czeka na rozgrzebane wątki + ostrzeżenie „punkt bez powrotu”, I7 Brygida bez fikcyjnego przedmiotu
- Final: fixed minor – q8_a/p_koniec bramki, tablica_obs jako scena, wartownik zamiast drugiego żołnierza, literówki, czas wejścia w IIIb, usunięte martwe flagi lek_podjety i pytanie_o_dlug (MEMORY = tylko znaczniki dnia)
- Final: minor (deferred): flaga decyzji po odmowie startQuest w kilku węzłach (limit 10 – realnie nieosiągalne po poprawce C1); brak stanów „w toku” u Hieronima/Brygidy/Tomasza; pogadanki szablonowe (tematy kury/upiory/cesarstwo do dopisania w szlifie); przejścia „przez” nieodkryte miejsca (Strażnica przez Krater); test wymowy u żołnierza ponawialny bez limitu; obrazy lokacji IIIb proceduralne (do przerysowania w E3b)

## Końcowe sprawdzenie grafu misji i zleceń (cykl-e3)
- test/graph.test.js: optymistyczny punkt stały po wszystkich źródłach (dialogi, sceny miejsc, zdarzenia, goście, zlecenia, sklepy, łupy, zbieractwo): każde z 38 zleceń da się wziąć i wykonać, wszystkie lokacje i miejsca odkryć, wszystkie zakończenia i flagi/przedmioty wymagane przez dialogi osiągalne, brak martwych węzłów dialogów.
- test/monkey.test.js: 80 losowych graczy przechodzi IIIa i IIIb na prawdziwym silniku (dialogi, sceny miejsc, tablice, goście, zlecenia, czas, noc): 80/80 kończy IIIa i IIIb, finał zawsze ma drogę (uległość i ucieczka), opór dostępny w ~57%, żadne zlecenie IIIb nie jest martwe.
- Znaleziona niespójność: wskaźnik poszukiwań widoczny w hubach, gdzie nic od niego nie zależy (Obserwatorium) – teraz tylko lokacje z `tracksSearch` (Głuszec i okolice).
- Artefakt testu, nie błąd gry: wdowa Jaga odkrywana jest w akcie II przez córkę strażnika (bot dostaje to odkrycie na starcie).
