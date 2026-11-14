# Cykl E2c – akt III: Ucieczka, Cienie i Cesarskie Polowanie – projekt

> Data: 2026-10-24 · Źródła: koncepcja fabularna (akt III, rozdz. 7–10), uwagi użytkownika (akt III większy niż II; podział na dwie odsłony; poziom poszukiwania; trzy drogi z gałęziami w finale), `docs/wytyczne-tresci-i-qa.md` (obowiązuje w całości).
> Cykl E: … → E2b3+E2d (scalone) → **E2c akt III w dwóch odsłonach (IIIa, IIIb)** → E3b ilustracje → E3 szlif → E4 publikacja.
> Status: do przeglądu przez użytkownika.

## Cel
Dać aktowi III wyraźnie więcej treści niż aktowi II (II: 1 hub, 5 lokacji, 8 zleceń): osaczenie przez cesarskich zwiadowców, nowa osada, plotki o ocalałym, ślady technologii obcych, dylematy „długu” i finał z trzema drogami. Ton: rubaszny i cięty (wytyczne 1), ale gęstniejący grozą.

## Podział na odsłony
Każda odsłona to osobny cykl: spec (ten dokument jest wspólny) → plan → wykonanie → recenzja → scalenie na „Merge”.

### IIIa – Osada na uboczu i szepty (rozdz. 7–8)
- **Silnik – poziom poszukiwania** (`world.search`, 0–100, zapis v11): rośnie od głośnych czynów (walka z cesarskimi, pancerz/broń szkoły na widoku, rozgłos, zlecenia oznaczone `search: +n`), maleje od przeczekania (`search: -n`, odpoczynek w ukryciu) i od przebrania. Nowe: warunek `search {min,max}`, akcja `search: ±n`, progi w `rules.search` (np. 25 kontrole zwiadowców w osadzie, 50 patrole na drogach, 75 obława). Wydarzenia i wizyty (`visitors`/`events`) mogą mieć `if search`. Wskaźnik w pasku stanu/mapie (słownie, bez liczby: „spokój / czujność / pościg / obława”).
- **Hub: osada na uboczu** (nazwa w planie), 10–12 miejsc: karczma, kuźnia/handlarz, szałas znachora, cmentarz, dom sołtysa, młyn wodny, kramy wędrownych, ukryta piwnica (kryjówka), tablica ogłoszeń, 2–3 postacie do pogadania. **Lokacje w okolicy:** 6 (trakt omijany, las kłusowników, kamieniołom, opuszczona kapliczka, bagna, wzgórze obserwacyjne), każda z 2–4 miejscami.
- **Zlecenia:** min. 12 (wobec 8 w II), w tym łańcuchy po 3–4 kroki: „Kłusownik i leśniczy”, „Dług młynarza”, „Listy z tamtej strony”, „Kto sprzedał ocalałego”, „Zwiad na wzgórzu”, „Fałszywe papiery”, „Rannego nie zostawia się”, plus losowi goście (wędrowny handlarz, fałszywy pielgrzym, informator zwiadowców).
- **Zwiadowcy:** rozmowy kontrolne (wymowa/skradanie/przebranie), ucieczka lub walka, przesłuchanie wsi. Konsekwencje przez `search` i flagi.
- **Otwarcie aktu** (wytyczne 2.5): zadanie wprowadzające „Przyjęcie w osadzie” (sołtys, 2–3 wymiany nieufności), nie sama scena.
- Zakończenie IIIa: zdarzenie przełomowe (zwiadowcy zdobywają trop, ocalały musi opuścić osadę albo ją obronić) → flaga `akt3a_koniec`, przejście do IIIb.

### IIIb – Ślady z gwiazd i Rozdroże (rozdz. 9–10)
- **Nowy region:** ruiny z technologią obcych, strefa zjawisk (Iskrząca Burza, Noc bez Gwiazd w odsłoniętym terenie), 5–6 lokacji; zjawiska powiązane z miejscami (wydarzenia warunkowe).
- **Zlecenia:** min. 10, łańcuchy odkrywające powiązanie zjawisk z technologią; dylematy „długu”: każdy daje punkty `dlug` albo `wola` zależnie od wyboru (zmienne już istnieją).
- **Finał – „Rozdroże Przeznaczenia”:** trzy drogi z gałęziami:
  1. **Uległość** (`dlug` wysoki): oddanie się Istocie; warianty zależne od zleceń i `search`.
  2. **Opór** (`wola` wysoka): walka z obiema stronami; warianty: sojusznicy z osady, obława.
  3. **Ucieczka** na skraj świata: warianty: sam, z towarzyszami, pozostawiając osadę.
  Zakończenia = sceny `ending` z `if` (zmienne, flagi, `search`); każde z własnym tekstem i zdaniem podsumowującym wybory.
- Zakończenie gry: sekcja finałowa + „Koniec aktu III” (do dalszego rozbudowania w razie potrzeby).

## Zgodność z wytycznymi
Tabela (do wypełnienia w planach IIIa i IIIb): ton i riposty (1.1–1.5), spójność i rozliczanie u zleceniodawcy (2.1–2.6), interfejs (3), walka (4: nowi wrogowie: cesarscy zwiadowcy, kłusownicy, istoty ze stref zjawisk – symulacja ≥200 losowań), dane i QA (5: zlecenia bez utknięcia, odkrywanie, zapis w środku sceny, test na prawdziwych danych, `--validate`, grafiki). Plan każdej odsłony zawiera Review Focus z pkt 5; recenzent sprawdza listę kontrolną.

## Dane i zapis
Zapis v11 (migracja v10→v11: `world.search = 0`). Nowe dane: lokacje/miejsca/goście w `travel.json`, zlecenia w `quests.json`, dialogi, wrogowie, grafiki (≤48×20, portrety 20×20), mapa `data/maps/` nowego regionu, `rules.search`.

## Poza zakresem
Ilustracje poza koniecznym minimum (E3b), nowe klasy postaci, handel między osadami.

## Testy
Silnik: `search` (warunek, akcja, progi, migracja, zapis). Dane: walidacja wszystkich nowych lokacji/zleceń/dialogów, osiągalność każdego celu w dowolnej kolejności odkrywania, test przechodzący zlecenie po zleceniu na prawdziwych danych, wszystkie zakończenia osiągalne, wznowienie zapisu w środku sceny, `guidelines.test.js` (ripostę, postacie do pogadania, portrety). E2E od początku gry do każdego z trzech finałów.

## Podział na zadania (szkic)
**IIIa:** 1) `search` w silniku + zapis v11; 2) wskaźnik w interfejsie; 3) osada: hub i miejsca; 4) lokacje okoliczne; 5) zlecenie wprowadzające i łańcuchy 1–6; 6) łańcuchy 7–12 i goście; 7) zwiadowcy: kontrole, walka, wrogowie; 8) NPC do pogadania i riposty; 9) grafiki; 10) koniec IIIa, e2e, ledger.
**IIIb:** 1) region i lokacje; 2) zjawiska powiązane z miejscami; 3) zlecenia i dylematy; 4) finał: sceny, warunki, trzy drogi z gałęziami; 5) grafiki; 6) e2e do każdego finału, ledger.
