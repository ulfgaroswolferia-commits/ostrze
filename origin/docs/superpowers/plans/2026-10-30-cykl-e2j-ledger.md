# SDD ledger — plan: docs/superpowers/plans/2026-10-30-cykl-e2j-jarnowo.md

Pre-flight: Tasks 1–6 dzielą `watek_jarnowo`/`starts` i trasy; graf-lint wymaga wpięcia, więc cały cykl poszedł w jednym commicie funkcjonalnym.
- Ruling: trasa na wyspę to `loch_jarnowo` (from `loch_pod_palacem`), nie `ulfgrod_jarnowo` — `startTravel` wymaga, by postać stała w `route.from`, a gracz kończy Akt IV w lochu — koszt: nazwa trasy różni się od planu.
- Ruling: zlecenie „Rozpoznanie urządzenia” ma miejsce `przystan_jarnowo.stol_kreslarski` (scena), a `brygida_wyspa` to osobna rozmowa w `kuznie.kuznia_brygidy` — talk-spot nie hostuje scen zleceń.
- Ruling: `szabrownik_wrakow` używa grafiki `szabrownik` (współdzielona do E3b); `straznik_wiru` ma własną `.pix`.
- Ruling: `pielgrzym` ograniczony do regionów aktów I–IV (bez wyspy), `wilki` do regionów dziczy; pozostałe ogólne zdarzenia bez zmian.
- Ruling: strażnik wiru po tuningu (hp 70, armor 4, 9–14): pole walki ×2 daje 0,725–0,975 dla czterech kombinacji (górna granica testu 0,99).
- Ruling: `dlug_splacony` zostaje w `MEMORY` (czyta E2k); `istota_*` zdjęte z `MEMORY` (czyta hetman i Brama).
Tasks 1–6: complete — suite 1455/1455, --validate OK.

## Recenzja końcowa (Opus) – runda poprawek
- Final: fixed C1 obóz hetmana `secret` ujawniany tylko opcjonalną plotką — `reveal: oboz_hetmana` w `biuro` kapitana + gość `goniec_hetmana` (I3); testy „obóz hetmana jest ujawniany…” RED→GREEN, suite 1459/1459
- Final: fixed I1 ostrzeżenie o utracie zleceń — wymóg `leaves: przystan_jarnowo` dopisany do planu E2k (exitWhen nie porzuca zleceń; ruling: otwarte zlecenia zostają `active` do E2k)
- Final: fixed I2 skrót Smyka zostawiał `watek_jarnowo` niedokończony — cel „zlecenia” `any` z `jarnowo_przejscie_uzyte`; test „skrót Smyka nie zostawia wątku niedokończonego” RED→GREEN
- Final: fixed I4 zdarzenia morskie — region `morze` (trasa `loch_jarnowo`) + 8 zdarzeń morskich (także na trasach łodzią do Wraków/Łysej Skały przez `travelDay`); lądowe zdarzenia wyspy tylko przy spacerach (`location`); `cisza`, `kupiec_wedrowny`, `glodny_wedrowiec`, `kupiec_ostromir` ograniczone do regionów aktów I–IV; test „zdarzenia morskie…” RED→GREEN
- Final: fixed I6 test poziomu — PD z wyspy (zlecenia + wątek + pola walki) ≥ różnica `xpToReach(6)−xpToReach(5)`
- Final: fixed (drobne) M2 hetman po `hetman_przekonany` nie powtarza pychy, M3, M4, M5, M6, M7, M9
- Final: Ruling: far routes (`jarnowo_wraki`, `jarnowo_lysa_skala`) zostają w regionie `jarnowo` (walidacja wymaga regionu lokacji docelowej) — zdarzenia morskie rozróżnia `travelDay`
- Final: Ruling: `oboz_hetmana` zostaje `secret` (hint nigdy się nie pokaże – brak akcji `hint` na wyspie); grafiki lokacji wyspy to cudze szkice (obserwatorium, mapa_brod, karczma_pod_wilczym_klem, krater_gwiazdy, pobojowisko, ruiny_straznicy) do E3b; hetman bez portretu; `straznik_wiru` ma tylko tag `przybysz` bez odporności (Ostrze i tak zadaje pełne obrażenia)
- Final: minor (deferred): M1 powitanie kapitana powtarza się przy każdej wizycie i miesza „ty/pan”; M8 Brygida w dwóch miejscach naraz; M10 trywialne pola z szabrownikami ×2 i Jarnowianami (100%), `rabusie_wrakow` bez symulacji, `oko_nocy` dwa razy; M13 „zarząd portu” i „pozew” jako lekkie anachronizmy; `rules.json`/`regions` przeformatowane bez zmiany semantyki
