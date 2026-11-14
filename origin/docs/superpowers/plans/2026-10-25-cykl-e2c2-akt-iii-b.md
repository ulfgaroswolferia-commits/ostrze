# Cykl E2c2 – akt III, odsłona B (ślady z gwiazd, rozdroże, finał) – plan wykonania

> Wykonanie natywne (jak E2c1). Spec: `docs/superpowers/specs/2026-10-24-cykl-e2c-akt-iii-design.md` (IIIb). Wytyczne: `docs/wytyczne-tresci-i-qa.md` (cała lista kontrolna). Lint spójności: `test/consistency.test.js`.

**Goal:** Nowy region ze strefami zjawisk, hub „Obserwatorium”, ≥10 zleceń z dylematami `dlug`/`wola`, sojusznicy, ciągłość z IIIa i aktów I–II oraz finał „Rozdroże Przeznaczenia”: trzy drogi (uległość, opór, ucieczka) z 7 zakończeniami zależnymi od wyborów, sojuszników i losu Głuszca.

**Architecture:** Te same mechanizmy co IIIa: hub + `arriveAt`/`leaves`/`exitWhen`, lokacje z `near.via`, zlecenia errand, dialogi stanowe, goście (`forced`), `search`. Nowe: scena `akt3b_final` (dialog z Istotą) i zakończenia `ending` z warunkami na flagi, zmienne `dlug`/`wola`, sojuszników i `oblawa_ucieczka`.

## Global Constraints
- Cała treść po polsku, ton rubaszny/cięty, ale gęstniejący (wytyczne 1). Każda porażka testu ma ripostę; stały NPC ma stany przed/w toku/po; pogadanki ≥4 stany.
- Zlecenia nie utykają (wytyczne 5.1): przedmioty tylko `misc` (nie do wyrzucenia), odmowa limitu przerywa węzeł, każdy cel odkrywalny w dowolnej kolejności, ścieżka bez rzutu przy każdej decyzji.
- Czasy marszu z `near.via` zgodne z mapą `data/maps/*.txt`.
- Region `gwiazdy`; hub `obserwatorium`; lokacje: `krater_gwiazdy`, `pole_szkla`, `menhiry`, `wrak_maszyny`, `zapadlisko_ciszy`, `ostatnia_strazica`.
- Flagi pamięci do wykorzystania (usunąć z `MEMORY` po użyciu): `dlug_istoty`, `komendant_wie_o_szkole`, `towarzysze_zaufanie`.
- Sojusznicy to flagi: `sojusz_dezerter`, `sojusz_straznicy`, `sojusz_astrolog`, `sojusz_wedrowcy`; „≥2 sojuszników” = dowolna para.

## Review Focus
1. Finał osiągalny z każdej ścieżki: zawsze dostępna co najmniej jedna droga; „opór” wymaga `wola ≥ 2` i da się to zdobyć; każde z 7 zakończeń osiągalne.
2. Zlecenia IIIb nie utykają przy dowolnej kolejności i wysokim `search`; zakończenie odsłony (`akt3b_koniec`) nie przychodzi przed końcem wątków.
3. Przejście IIIa→IIIb z zapisu zrobionego w `akt3a_koniec_scena`/`akt3a_koniec_oblawa`.
4. Zjawiska: scena `phenomenon` w miejscu nie psuje menu (zawsze wyjście), zapis w środku.
5. Ciągłość: oblawa_ucieczka / ocalenie Głuszca zmienia dialogi i zakończenia.

## Zadania
1. **Przejście i hub.** `akt3a_koniec_scena`/`_oblawa` stają się narracjami, dalej `akt3b_wejscie` → `akt3b_mapa` (hub `obserwatorium`, `arriveAt`, `leaves: gluszec`, `exitWhen akt3b_koniec → akt3b_final`) → odpoczynek/zapis/dalej. Region `gwiazdy` + mapa. Hub: ~9 miejsc (obserwatorium, izba, warsztat, tablica, archiwum, taras, studnia…), 3 pogadanki, sklep. Test: przejście, hub.
2. **Lokacje.** 6 lokacji z `near.via`, miejscami, pogadankami i zjawiskami (sceny `phenomenon`/narracje z `addEffect`). Test: geometria, odkrywalność.
3. **Zlecenia 1–5.** Intro u astrologa Hieronima; Szkło z krateru (3 odłamki); Pamięć kamieni (dylemat dlug/wola); Wrak maszyny; Mgła ciszy (zaginiony zwiadowca). Test na prawdziwych danych.
4. **Zlecenia 6–10.** Cesarski dezerter (sojusznik albo wydanie, `search`); Dług Istoty (`dlug_istoty`, dylemat dlug+2 / wola+2); Wieści z Głuszca (`oblawa_ucieczka`, `komendant_wie_o_szkole`); Ostatnia strażnica (sojusznicy, `towarzysze_zaufanie`); Przygotowania (ustawia `akt3b_koniec`). Test.
5. **Finał.** Dialog `rozdroze_final`, flagi `final_*`, 7 zakończeń; test: każde osiągalne z odpowiedniego stanu, żadne nie jest ślepe. Wykorzystanie flag pamięci → `MEMORY`.
6. **Grafiki.** Portrety, obrazy lokacji (7), wrogowie z regionu jeśli są.
7. **E2E, ledger, recenzja (Opus), jedna tura poprawek.** Scalenie na „Merge”.
