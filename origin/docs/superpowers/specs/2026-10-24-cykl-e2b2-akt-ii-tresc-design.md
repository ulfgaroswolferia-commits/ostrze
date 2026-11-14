# Cykl E2b2 – akt II: treść, ludzie i zlecenia – projekt

> Data: 2026-10-24 · Źródła: spec E2b1 (tabela planu E2b2), uwagi użytkownika po przejściu dema (balans, rubaszność, NPC „do pogadania”, komendant zostaje w hubie), koncepcja fabuły (akt II).
> Cykl E: … → E2b1 silnik aktu II (scalony) → **E2b2 treść aktu II** → E2c akt III → E3b ilustracje → E3 szlif → E4 publikacja.
> Status: do przeglądu przez użytkownika.

## Cel

Wypełnić Pogórze życiem. Gracz chodzi po okolicy Wilczego Brodu, rozmawia z ludźmi (także takimi, którzy niczego nie dają), podejmuje zlecenia kierujące go z powrotem do znanych miejsc (przedmioty, wiadomości, szukanie osoby), a każde z nich odsłania kawałek fabuły i kolejne miejsca. Akt II kończy się eskortą Ostromira na Przełęcz (flaga `akt2_koniec`). Ton: rubaszny, cięty, z ripostami; mało patosu.

## Zakres

### 1. Zmiany silnika (małe)
1. **Rozliczenie zlecenia u zleceniodawcy.** Nowa akcja `completeQuest: "<id>"` (dialogi, sceny): zamyka aktywne zlecenie `quest`/`errand` i uruchamia jego `onComplete`. Zlecenia `quest` dostają opcjonalne `onComplete` (akcje) i pole `report: true`: scena końcowa wyprawy ustawia tylko flagę `<id>_wykonane`, a nagroda i `done` następują dopiero po rozmowie z klientem. Wilcza nora przechodzi na ten model (komendant: „idź po nagrodę” → rozmowa → nagroda i wzmianka o kurierze).
2. **Odwiedziny w lokacji.** Lokacja może mieć `visitors: [{ id, if?, chance, scenes }]`: przy każdym wejściu w menu miejsc jedno losowanie (z `rng`) dodaje pozycję „Ktoś się kręci…” z krótką sceną (pielgrzym, kupiec, żebrak, który zleca zlecenie). Każdy gość `once` albo powtarzalny wg flagi. Walidacja jak sceny zdarzeń.
3. **Zapytania t/n i imię w panelu wyboru.** W ramce pytanie `confirm` i pole imienia rysowane są w panelu wyboru (nie pod ramką); tryb liniowy bez zmian.
4. **Domknięcia po recenzji E2b1 (M1–M5):** wznowienie komendanta po zapisie, migracja zapisów ze starych scen, naprawa `walk.event`/`spotScene`, `reveal`/`hint` spotów w ukrytych lokacjach, flaga `lek_podjety` przy tablicy.

### 2. Lokacje (bliskie, odkrywane stopniowo)
| id | Nazwa | Czas | Zagrożenie | Odkrywa |
|---|---|---|---|---|
| `wilczy_las` | Las Rubieży (już jest) | 40 min | 2 | plotka Wrzoska, tobołek przewodnika |
| `stary_mlyn` | Stary młyn | 35 min | 1 | zlecenie „Mąka dla młyna” (przedtem plotka) |
| `trakt_kupiecki` | Trakt kupiecki | 45 min | 2 | „Dług kupca” / pielgrzym |
| `lesniczowka` | Leśniczówka | 30 min od lasu | 1 | „List do leśniczego” |
| `ruiny_straznicy` | Ruiny strażnicy | 40 min | 4 | „Zaginiony pasterz Borek” |
| `kamienna_przelecz` | Kamienna Przełęcz (już jest, dzień) | 1 dzień | 3 | eskorta Ostromira (koniec aktu) |

Każda ma 2–4 miejsca (rozmowa, scena, sklep/nocleg tam, gdzie pasuje) i wpis na mapie `pogorze.txt`. Hub dostaje dodatkowych NPC „do pogadania” (patrz 4).

### 3. Zlecenia (errand, poza nory i eskorty)
Wszystkie `board: true` albo przez rozmowę; cele wskazują miejsca do powrotu.
1. **Wilcza nora** (istniejące): rozliczenie u komendanta (silnik 1.1); po nagrodzie komendant wspomina kuriera i odsłania Las Rubieży / patrole.
2. **Lek dla Wrzoska** (istnieje) → po nagrodzie plotka o młynie.
3. **Mąka dla młyna:** kramik (worek mąki) → Stary młyn (młynarz Ostap) → wiadomość z powrotem do Wrzoska.
4. **List do leśniczego:** komendant (list) → Leśniczówka → odpowiedź z powrotem do komendanta.
5. **Zaginiony pasterz Borek** (szukanie osoby): żona w karczmie → Las → ślady → Ruiny/Młyn (Borek żyje, ranny) → żona.
6. **Światło w młynie:** noc w młynie → odłamek szkła → kuźnia/komendant (rozpoznanie kamienia).
7. **Dług kupca:** karczma → Trakt (Ostromir) → pokwitowanie → karczma.
8. **Kto pyta o ocalałych:** podsłuch zwiadowców na trakcie → komendant (zapowiedź aktu III).
9. **Amulet z ruin:** Ruiny (`amulet_strazniczy` z pobojowiska pasuje do zagadki) → córka dawnego strażnika w karczmie.
10. **Eskorta Ostromira** (istnieje): trakt → Przełęcz; kończy akt (`akt2_koniec`), brama „wyrusz na Przełęcz” z mapy huba.
Limit aktywnych (6) bez zmian; zlecenia wzajemnie odblokowują się przez `requires { known | flag }`.

### 4. Ludzie „do pogadania”
W każdej lokacji min. 1 NPC bez zlecenia i nagrody: ponad dwa stany reakcji (pierwszy raz, „a to znowu ty”, „spać nie możesz, psia mać?”, „idź no człowieku znajdź sobie zajęcie”, „nie mam teraz czasu, muszę się podrapać”), tematy: upiory, cesarstwo, sąsiedzi, kury. Realizacja jak w E2b1 (łańcuch scen z flagami), zebrana w jednym szablonie danych; do tego `visitors` (1.2).

### 5. Ton i dialogi
Przeglądnąć dialogi E2a/E2b1 pod kątem ripost: każda nieudana próba (np. wypytywanie kuriera) kończy się cięta odprawą, nie samym komunikatem. Wytyczne w komentarzu nagłówkowym `data/dialogues/` nie są potrzebne; linia tonu: sarkazm, rubaszność, krótkie zdania.

### 6. Poza zakresem
Balans trafień w głowę, combo i rzut włócznią z dystansu (osobny cykl E2d – walka), akt III, ilustracje (E3b; w E2b2 tylko mapa tekstowa i istniejące grafiki, braki z E2b1: karczma, portrety Wrzoska i kramarza dorysować tu).

## Dane i zapis
Zapis bez zmiany wersji (nowe pola opcjonalne); `quests[id].report` tylko w danych. Migracja M2: scena wskazująca usuniętą scenę fabuły → najbliższa istniejąca (`demo_mapa`).

## Testy
Silnik: `completeQuest`, rozliczenie nory, `visitors` (szansa, `once`, zapis), t/n w ramce (nic pod ramką), M1–M5. Dane: walidacja wszystkich lokacji i zleceń, osiągalność każdego celu (test przechodzący zlecenie po zleceniu na prawdziwych danych), każdy węzeł rozmowy z opcją zawsze dostępną. Przebieg: e2e od szkoły do `akt2_koniec` (obie klasy), `--validate`, pełny zestaw zielony.

## Podział na zadania (szkic)
1) silnik: `completeQuest` + rozliczenie nory; 2) `visitors`; 3) t/n i imię w panelu; 4) domknięcia M1–M5; 5) lokacje + mapa; 6–9) zlecenia w grupach (przedmioty / informacje / osoba / eskorta i koniec aktu); 10) NPC do pogadania i riposty; 11) grafiki braków; 12) e2e i ledger.
