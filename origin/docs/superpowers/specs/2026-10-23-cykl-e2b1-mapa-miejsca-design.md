# Cykl E2b1 – pobojowisko, mapa, miejsca i zlecenia z celami – projekt

> Data: 2026-10-23 · Źródła: `docs/koncepcja_fabu_y_i_podzia_na_akty.md` (Akt II: rozdz. 5–6), koncept ekranu `docs/interfejs-mapa.png` (inspiracja, nie wymóg), ustalenia z brainstormingu z użytkownikiem (poniżej), D2b (zadania i eskorty).
> Cykl E: … → E2a prolog + akt I (scalony) → **E2b1 silnik aktu II** → E2b2 treść aktu II (zlecenia, lokacje) → E2c akt III → E3b ilustracje → E3 szlif → E4 publikacja.
> Status: do przeglądu przez użytkownika.

## Cel

Akt II zaczyna się **na pobojowisku** (przeszukanie ciał towarzyszy, rozdroże: odrzucenie marszu do stolicy), a potem gra przechodzi w **swobodne chodzenie po mapie** wokół Wilczego Brodu: lokacje z kilkoma **miejscami** (osoby do rozmowy, sklep, nocleg, tablica zleceń), zlecenia, które każą **wracać do znanych miejsc** (dostarczanie przedmiotów i wiadomości, szukanie osoby), i **stopniowo odsłaniają** kolejne lokacje. E2b1 buduje silnik i ekran mapy oraz Wilczy Bród z jego miejscami; E2b2 wypełnia akt II zleceniami i lokacjami.

## Ustalenia z rozmowy

- **Struktura:** pobojowisko → rozdroże → Wilczy Bród (zgodnie z koncepcją; zmienia koniec aktu I).
- **Zakres (średni):** fabuła + nowy ekran mapy (mapa ASCII regionu + lista „Dokąd iść?” z czasem i zagrożeniem + opis), lokacje z kilkoma miejscami, plotki odsłaniające lokacje.
- **Skala drogi: dwie warstwy.** Bliskie lokacje (25–90 min): jedno wejście, szansa na zdarzenie, bez obozu i głodu. Dalekie (dni): istniejąca podróż z D2a.
- **Nie wszystkie lokacje od razu.** Na początku znany jest tylko Wilczy Bród. Pozostałe pojawiają się na mapie dopiero po rozmowie, plotce lub zleceniu; „???” widać tylko tam, gdzie plotka zapowiada, że coś jest.
- **Zleceń ma być dużo i mają prowadzić z powrotem do znanych miejsc:** dostarczenie przedmiotów, przekazanie informacji, odnalezienie osoby.
- Poza zakresem: akt III, drugi region, pełna lista zleceń (E2b2), ilustracje poza kilkoma potrzebnymi w E2b1 (reszta w E2b2/E3b), ekran mapy w trybie liniowym (tam zostaje lista).

## Przebieg początku (zmiana końca aktu I)

W zdarzeniu `noc_upiorow` (`data/travel.json`) po scenie `noc_swit` dochodzą sceny (nadal `endsTrip`, czyli podróż kończy się w Wilczym Brodzie):
1. `noc_pobojowisko` – dialog `pobojowisko` (poranek na polanie; przeszukanie trzech tobołków, każdy raz: Skarimir → sztylet; Ragnosława → 2 opatrunki i amulet strażnika (przedmiot fabularny); Wojmir → 2 prowianty i **notatki z mapą** (przedmiot fabularny `notatki_wojmira`; odkrywa na starcie Wilczy Bród i daje pierwszą wskazówkę mapy). Brak testu; wyjście „Idę dalej.” (nie trzeba przeszukać wszystkiego).
2. `noc_rozdroze` – dialog `rozdroze`: trzy odpowiedzi: odrzucenie marszu do stolicy (`wola` +1, flaga `odrzucil_stolice`), wahanie (flaga `waha_sie`, bez zmiany), ostrożna pokora „najpierw spytam o drogę w Brodzie” (`dlug` +1). Każda prowadzi do tej samej sceny.
3. `noc_bezdroza` – narracja marszu bezdrożami do Wilczego Brodu (czas, mundur szkoły, wzmianka o insygniach).
4. Akcja `reveal: "wilczy_brod"` (patrz niżej) i przybycie; `demo_kurier` przepisana na `brod_przybycie` (strażnica przyjmuje półżywego wędrowca; komendant pyta, kim jest).

Po przybyciu `demo_mapa` (stara scena `map`) zostaje zastąpiona nową sceną `map` huba Wilczy Bród (patrz niżej); wyjście „Czekaj na kuriera” prowadzi do `demo_odpoczynek` → `demo_zapis` → `demo_koniec` jak dotąd (prawdziwy finał aktu II i bramka „wyrusz na przełęcz” dochodzą w E2b2).

## Model świata

### Lokacje i miejsca (`data/travel.json`)
`locations[]` zyskują pola (wszystkie opcjonalne poza dotychczasowymi):
- `map: { x, y }` – położenie znacznika w pliku mapy regionu;
- `near: { minutes }` – lokacja **bliska** (wejście w minutach, bez obozu); brak = dalekie (trasy `routes` w dniach jak dotąd);
- `danger` 1–4 (Bezpiecznie, Niskie, Średnie, Wysokie) – tylko do wyświetlania i do szansy zdarzenia;
- `secret: true` – lokacja ukryta, dopóki nie zostanie odkryta (`reveal`);
- `hint` – tekst „???” (np. „nieznana droga”) pokazywany w „Nieodkryte”, **jeśli** została zapowiedziana (`hinted`);
- `art` – ilustracja (jak w scenach);
- `spots[]` – **miejsca** lokacji: `{ id, name, type: "talk" | "shop" | "rest" | "board" | "scene", ref, if?, secret?, art? }`:
  - `talk` – `ref` = id rozmowy (`dialogues/*.json`), `shop` – id sklepu, `rest` – nocleg (scena `rest`), `scene` – lista scen `scenes[]` uruchamiana jak sceny zdarzeń (`goto: "koniec"` kończy),
  - `board` – **tablica zleceń**: lista zleceń huba, które można podjąć (warunek `requires` zlecenia spełniony, jeszcze nie podjęte).

### Odkrywanie
- `world.discovered`: lista id lokacji i miejsc (`"wilczy_brod"`, `"wilczy_mlyn"`, `"wilczy_brod.karczma"`), stan zapisu.
- `secret: true` na lokacji lub miejscu = widoczne dopiero po odkryciu; lokacje i miejsca bez `secret` są widoczne zawsze, gdy widoczna jest ich lokacja.
- Nowe akcje (dialogi, sceny, zlecenia – wspólny system akcji): `reveal: "<id>"` (dodaje do `discovered`, komunikat „Nowe miejsce na mapie: …”), `hint: "<id>"` (zapowiedź „???”), `startQuest: "<id>"`.
- Nowy warunek `known: "<id>"` (lokacja/miejsce odkryte).

### Zlecenia z celami (`data/quests.json`)
Nowy rodzaj `errand` obok `quest` i `escort`:
```json
{ "id": "maka_dla_mlyna", "kind": "errand", "name": "Mąka dla młyna", "hub": "wilczy_brod",
  "description": "...", "requires": { "known": "wilczy_mlyn" }, "deadlineDays": null,
  "objectives": [
    { "id": "odbierz", "text": "Odbierz worek mąki od kramarza.", "at": "wilczy_brod.kramik", "done": { "item": "worek_maki" } },
    { "id": "zanies",  "text": "Zanieś go młynarzowi Ostapowi.", "at": "wilczy_mlyn.mlynarz", "done": { "flag": "maka_dostarczona" } } ],
  "onComplete": [ { "giveMoney": 8 }, { "xp": 40 }, { "reveal": "wilczy_mlyn.mlyn" } ] }
```
- **Cele (`objectives`)** to uporządkowana lista; cel jest **wykonany**, gdy spełniony jest jego warunek `done` (istniejący język warunków: flaga, przedmiot, zmienna, `known`, `quest`…). Dostarczanie robią zwykłe akcje rozmów (`takeItem`, `setFlag`), szukanie osoby – flaga ustawiana w rozmowie lub scenie; nie ma nowego stanu poza `state.quests[id]` (status, `startedAt`).
- **Bieżący cel** = pierwszy niewykonany; wskazuje `at` (`lokacja` albo `lokacja.miejsce`). Na mapie przy tej lokacji pojawia się znacznik `!`, w menu miejsc przy tym miejscu też.
- **Ukończenie:** po każdej scenie i rozmowie sprawdzane są wszystkie aktywne `errand` (hak po scenie, jak awans); gdy wszystkie cele wykonane → `done`, uruchamiane `onComplete` (akcje) i komunikat. Cel wykonany „z góry” (przedmiot już w torbie) zalicza się od razu.
- Podjęcie: akcja `startQuest` w rozmowie lub wybór z `board`. Limit aktywnych zleceń z `rules.quests.maxActive` bez zmian.
- Walidacja: `at` istnieje, `done` poprawny warunek, `onComplete` poprawne akcje, id celów unikalne.

## Mapa i miejsca – silnik i ekran

- **Scena `map`** (huba) przepisana: wejście → ekran mapy → wybór lokacji → (droga: bliska w minutach z jedną szansą na zdarzenie z tabeli regionu, dalekie – `runTrip` jak w D2a, zadanie tymczasowe jak w D2b) → menu miejsc lokacji → powrót do mapy. Wyjście fabularne (`main`) jak dotąd, dopiero z mapy huba.
- **Menu miejsc lokacji:** lista miejsc (z `!` przy bieżącym celu zlecenia, szare niedostępne `if`), „Wróć na mapę”. Wejście w miejsce: `talk` – rozmowa, `shop` – sklep, `rest` – nocleg, `board` – lista zleceń do podjęcia, `scene` – sceny. Każda czynność kosztuje czas z `rules.dialogue.minutes` / sceny.
- **Droga bliska:** `near.minutes` w obie strony; szansa zdarzenia `rules.travel.localEventChance` (nowa reguła, 0–100; podwyżka przy `danger` ≥ 3); zdarzenie z tabeli `events` regionu, nie `fixed`; zdarzenie nie przerywa `world.map` (po nim gracz dochodzi do celu).
- **Ekran mapy (80×24 i większy):**
  - lewy panel: mapa regionu z `data/maps/<region>.txt` (znaczniki `{id}` w tekście zastępowane przez `[n] Nazwa` dla znanych, `[?]` dla zapowiedzianych, puste dla ukrytych; `@` – „Jesteś tu”); legenda pod mapą; mapa tylko gdy lewy panel ma ≥ 60 kolumn i ≥ 14 wierszy, inaczej lewy panel to opis zaznaczonej lokacji;
  - prawy panel (`select`): „Dokąd iść?” – znane lokacje z czasem i zagrożeniem (`~25 min · Bezpiecznie`, `~1 dzień · Wysokie`), potem „Nieodkryte” (`???`), pole opisu zaznaczonej lokacji;
  - znacznik `!` przy lokacji z bieżącym celem zlecenia; dziennik zdarzeń to obszar komunikatów ramki.
- Dziennik zleceń (`[D]`): aktywne zlecenia z listą celów (✓ wykonany, → bieżący, miejsce docelowe) – także dla `quest` i `escort`.

## Stan i zapis (v10)
- `world.discovered: string[]` (domyślnie `["wilczy_brod"]` po migracji `9 → 10`; zapis sprzed E2b1 w trakcie dema dostaje to samo), `world.hinted: string[]` (puste).
- `world.map`: dodatkowa faza `"place"` (stoimy w lokacji, menu miejsc) z `location`.
- Migracja naprawia nieznane id w `discovered`/`hinted` (usuwa, ostrzeżenie `load.repair.discovered`).

## Dane E2b1

- **Lokacja Wilczy Bród (hub):** miejsca: `komendant` (rozmowa `komendant`, miejsce odkryte od razu), `karczma` „Pod Wilczym Kłem” (rozmowa z karczmarzem Wrzoskiem – nowa `wrzosek.json`: plotki z testem Wymowy odsłaniające lokacje E2b2 i opcja noclegu), `kramik` (sklep `kramarz_brod`, nowy), `tablica` (zlecenia: Wilcza Nora jako pierwsze).
- **Istniejące zlecenia** `wilcza_nora` i `eskorta_ostromira` zostają (rodzaje `quest` i `escort`), podpięte pod tablicę/komendanta.
- **Zlecenie demonstracyjne** `errand` w E2b1: `lek_dla_wrzoska` (zebrać ziela w okolicy lub kupić w kramiku → zanieść karczmarzowi; nagroda: plotka odkrywająca lokację testową), żeby przetestować cały mechanizm cel→cel→nagroda.
- **Mapa:** `data/maps/pogorze.txt` (region Pogórze) ze znacznikami wszystkich planowanych lokacji (ukryte nie rysują się).
- **Przedmioty:** `notatki_wojmira`, `amulet_strazniczy` (fabularne), `worek_maki` i `ziola_dla_wrzoska` do zleceń testowych.
- **Grafiki E2b1:** `pobojowisko`, `rozdroze`, `karczma_pod_wilczym_klem`, `portret_wrzosek`, `portret_kramarz`; reszta w E2b2.

## Plan treści E2b2 (żeby E2b1 zbudować pod to, co nastąpi)

Region Pogórze, lokacje odkrywane po kolei. Zlecenia **kazą wracać do znanych miejsc** (dostarczanie przedmiotów i wiadomości, szukanie osoby):

| # | Zlecenie | Rodzaj | Skąd → dokąd | Odkrywa |
|---|---|---|---|---|
| 1 | Wilcza nora (istniejące) | walka | komendant → Wilcza Nora → komendant | Las Rubieży (patrole po norze) |
| 2 | Lek dla Wrzoska | przedmioty | las (ziela) → karczma | plotkę o młynie |
| 3 | Mąka dla młyna | przedmioty | kramik → młyn | Stary młyn (przedtem plotka) |
| 4 | List do leśniczego | informacja | komendant → Las Rubieży → komendant (odpowiedź) | leśniczówkę |
| 5 | Zaginiony pasterz Borek | **szukanie osoby** | karczma (żona) → las → ruiny/młyn → żona | Ruiny strażnicy (wskazówka) |
| 6 | Światło w młynie | przedmiot + informacja | młyn (noc) → odłamek szkła do kuźni/komendanta | Ruiny strażnicy, rozpoznanie kamienia |
| 7 | Dług kupca | przedmioty | karczma → Trakt kupiecki (Ostromir) → pokwitowanie do karczmy | Trakt kupiecki |
| 8 | Kto pyta o ocalałych | informacja | trakt (podsłuch zwiadowców) → komendant | zapowiedź aktu III, Przełęcz |
| 9 | Amulet z ruin | przedmiot + osoba | ruiny → córka dawnego strażnika w karczmie | pełną wiedzę o technologii |
| 10 | Eskorta Ostromira (istniejąca) | eskorta | trakt → Przełęcz | domyka akt II (flaga `akt2_koniec`) |

Zlecenia 2–9 to zestaw `errand`; osoby: Wrzosek (karczmarz), Ostap (młynarz), leśniczy, żona Borka, kowal, córka strażnika, kupiec Ostromir, komendant Wszebor.

## Testy

- **Dane i walidacja:** lokacje z miejscami (poprawne i błędne `ref`, `spots`, `secret`, `near`), `errand` (cele, `at`, `done`, `onComplete`), akcje `reveal`/`hint`/`startQuest`, warunek `known`.
- **Silnik:** odkrywanie (`reveal` raz, komunikat), bieżący cel i jego `at`, ukończenie zlecenia po ostatnim celu (też cel „z góry”), `onComplete`, podjęcie z `board`, limit zleceń; droga bliska (czas, jedno zdarzenie, bez obozu), dalekie bez zmian.
- **Interfejs:** ekran mapy w 80×24 (lista, bez mapy) i 200×50 (mapa ASCII, `!`, „Nieodkryte”), menu miejsc, dziennik z celami; ramka = rows − 1 wierszy.
- **Zapis:** migracja `9 → 10`, zapis w menu miejsc i w trakcie drogi bliskiej wznawia się w tym samym miejscu.
- **Przebieg:** e2e od pobojowiska przez rozdroże do mapy huba, zlecenie testowe od tablicy do nagrody (obie klasy), `--validate`, pełny zestaw zielony.
