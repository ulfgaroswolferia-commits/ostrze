# Cykl D2a – podróże: mapa, etapy, prowiant, zdarzenia (projekt)

> Data: 2026-10-22 · Źródło: `docs/koncepcja-gry.md` (rozdz. 9 „Czas świata”, 11 „Zjawiska”, 13a „Podróże i spotkania”) i ustalenia z brainstormingu.
> Poprzedni cykl: `2026-10-21-cykl-d1-mistyka-design.md` (scalony do `master` 7b951c3), ledger `../plans/2026-10-22-cykl-d1-ledger.md`.
> Następny: **D2b** – zadania, eskorty, lokacje tymczasowe, wynik spotkania → zadanie.
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

Po D2a demo ma prawdziwą podróż: po kramie gracz wyrusza z Wsi Brzeziny do Strażnicy Wilczy Bród (2 dni, 3 przy ulewie). Każdy dzień to etap: o świcie autozapis i ekran podróży (trasa, dzień, prowiant, zjawisko), potem ok. 10 godzin marszu z co najwyżej jednym zdarzeniem (stała scena trasy – bandyci w 1. dniu – albo losowanie z tabeli: pielgrzym, głodny wędrowiec, kupiec, wilki, ulewa, cisza), wieczorem obóz: można poszukać pożywienia w runie leśnym, posiłek zjada się sam (brak → głód), potem znany odpoczynek z wystawieniem artefaktu. Zjawiska z D1 wreszcie działają na drodze: `slow` dokłada dzień, `dangerous` podnosi szansę zdarzenia i wagę ataków. Zapis w dowolnym momencie podróży (także w środku spotkania) wznawia ją bez powtórzenia nagród.

**Poza zakresem (D2b / E):** zadania, eskorty, lokacje tymczasowe, mapa z wyborem celu i trasy, wynik spotkania zamieniany w zadanie, `visibility` w walce, nocne napady na obóz, osobna woda, rozbudowana treść i balans, towary na handel (np. skóry).

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Podział D2 | D2a podróże (mapa, etapy, prowiant, zdarzenia, pogoda), D2b zadania/eskorty/lokacje tymczasowe | Decyzja użytkownika. |
| Wejście w podróż | Scena fabuły `travel` ze stałym celem (`route`) | Decyzja użytkownika; fabuła liniowa, wybór celu w D2b. |
| Etap | Wymarsz o świcie (autozapis, ekran podróży) → marsz ~10 h z ≤ 1 zdarzeniem → obóz (szukanie pożywienia, posiłek, odpoczynek) | Decyzja użytkownika. |
| Prowiant | Jedzenie jako przedmioty z polem `food`; 1 posiłek na obóz automatycznie; brak → efekt `glod` (−1 Siła, −1 Krzepa, sen leczy ×0,5, do 3 stosów) | Decyzja użytkownika (wariant „jeden rodzaj prowiantu” + uwaga o runie leśnym). |
| Pożywienie z natury | Mięso z łupu zwierząt (`bestia`) + „Poszukaj pożywienia” w obozie (test Bystrości, tabela runa regionu); grzyby ryzykowne, Medycyna wiodąca chroni | Uwaga użytkownika: po walce ze zwierzętami i w trakcie podróży można znaleźć jedzenie. |
| Demo | Jedna trasa po kramie; bandyci jako stała scena 1. dnia; 6 zdarzeń w tabeli; nowy wróg `wilk`, zjawisko `ulewa` | Decyzja użytkownika. |
| Zjawiska w podróży | Stan `world.travel` aktywnego zjawiska w godzinach marszu: `slow` ≥ 2 h → +1 dzień (raz na etap); `dangerous` w chwili wymarszu → szansa zdarzenia 60% i ataki ×2 | Decyzja użytkownika; `visibility` dalej nieużywane. |
| Architektura | Handler sceny `travel` z maszyną faz zapisaną w `world.travel`; spotkania to listy scen w `travel.json` odpalane przez `runScenes` | Jedna pętla scen, wznawianie z zapisu bez nowej pętli gry. |
| Wilk | Nie ucieka, ≤ 15 XP | Budżet XP fabuły (500) – zwierzęta to drobnica. |
| Skóra wilka | Pominięta | Brak typu „towar” – handel łupem w E. |

## Dane

### `data/travel.json` (nowy plik)

```json
{
  "locations": [
    { "id": "brzezina", "name": "Wieś Brzezina", "region": "pogorze" },
    { "id": "wilczy_brod", "name": "Strażnica Wilczy Bród", "region": "pogorze" }
  ],
  "regions": {
    "pogorze": {
      "name": "Pogórze",
      "forage": [
        { "item": "jagody", "qty": [1, 3], "weight": 4 },
        { "item": "grzyby", "qty": [1, 2], "weight": 3 },
        { "item": "orzechy", "qty": [1, 2], "weight": 2 },
        { "item": "ziola_lesne", "qty": [1, 1], "weight": 1 }
      ]
    }
  },
  "routes": [
    { "id": "brzezina_wilczy_brod", "from": "brzezina", "to": "wilczy_brod", "days": 2, "region": "pogorze",
      "fixed": { "1": "bandyci_na_trakcie" } }
  ],
  "events": [
    { "id": "pielgrzym", "kind": "encounter", "weight": 3, "once": true, "scenes": [ /* sceny jak w story.json */ ] },
    { "id": "ulewa_nadciaga", "kind": "weather", "weight": 2, "phenomenon": "ulewa" }
  ]
}
```

- **Lokacje:** `id`, `name`, `region` (klucz `regions`).
- **Regiony:** `name`, `forage` (niepusta lista `{ item, qty: [min, max], weight }`; `item` istnieje, 1 ≤ min ≤ max, `weight` ≥ 1).
- **Trasy:** `id`, `from`, `to` (lokacje, różne), `days` ≥ 1, `region`, `fixed` (opcjonalnie: klucz = numer dnia 1…`days` jako tekst, wartość = id zdarzenia; zdarzenie stałe nie jest losowane – jego `weight` może być 0).
- **Zdarzenia:** `id`, `kind` ∈ `encounter` | `attack` | `weather`, `weight` ≥ 0 (0 = tylko jako stałe), `if` (opcjonalnie, warunek jak w scenach), `once` (opcjonalnie), dokładnie jedno z: `scenes` (niepusta lista scen; walidowane jak sceny fabuły: typy, pola, `goto` wewnątrz tej listy) albo `phenomenon` (id z `phenomena.json`; tylko `kind: "weather"`). Id scen zdarzeń są globalnie unikalne (wśród fabuły i wszystkich zdarzeń). Scena zdarzenia nie może być typu `travel`, `character_creation`, `ending` ani `save_point`.
- **Nowe klucze warunków** (`src/engine/conditions.js`, działają wszędzie, poza podróżą zwracają `false` lub działają na lokacji): `region` (region trasy w podróży, poza nią – region `world.location`), `travelDay` (`{ gte?, lte? }`, dzień etapu; poza podróżą `false`), `location` (id `world.location`). `timeOfDay` już istnieje.

### `data/story.json`

- Nowy typ sceny `travel`: `{ "id": "demo_podroz", "type": "travel", "route": "brzezina_wilczy_brod" }` (+ wspólne `goto`, `if`, `tags`; bez `time`). `route` musi istnieć.
- Demo: kram → `demo_droga` (narracja wyjścia, bez zmian) → `demo_podroz` → `demo_kurier` → odpoczynek → zapis → koniec. Sceny `demo_droga_bandyci` i `demo_droga_ucieczka` przenoszą się do zdarzenia `bandyci_na_trakcie` (te same pola, łup Kamień Zmierzchu bez zmian; `onFlee` wskazuje scenę ucieczki w tym zdarzeniu).

### `data/items.json`

- Nowe opcjonalne pole przedmiotu `food` (tylko `type: "consumable"`): `{ "order": 1–9, "risk"?: { "effect": <id>, "chance": 1–100, "safeTagged"?: <id umiejętności> } }`. `order` – kolejność zjadania w obozie (niższy pierwszy: co się psuje, idzie pierwsze). Konsumpcja z `food` nie wymaga `heal`; użyta z ekwipunku poza walką = posiłek (zdejmuje 1 stos `glod`, losuje `risk`). W walce przedmiot z `food` bez `heal` jest niedostępny (wyszarzony, powód „Nie czas na jedzenie”).
- Nowe przedmioty: `prowiant` (Prowiant, 0,5 kg, 3 gr, `food.order` 3), `mieso` (Mięso, 0,6 kg, 2 gr, `order` 2), `jagody` (Jagody, 0,1 kg, 1 gr, `order` 1), `grzyby` (Grzyby, 0,2 kg, 1 gr, `order` 1, `risk { effect: "trucizna", chance: 15, safeTagged: "medycyna" }`), `orzechy` (Orzechy, 0,2 kg, 1 gr, `order` 2), `ziola_lesne` (Zioła leśne – nie jedzenie: konsumpcja `heal [2, 4]`, `healSkill: "medycyna"`, 0,1 kg, 4 gr).
- `startItems` obu klas: + `{ "id": "prowiant", "qty": 2 }`.

### `data/effects.json`

- `glod` (Głodny): `unit: "hour"`, `duration: 1`, nowe pole `noExpire: true` (tylko `unit: "hour"`; efekt nie tyka i nie wygasa z czasem – zdejmuje go posiłek, `removeEffect` albo `clearAll`), `stack: "stack"`, `maxStacks: 3`, `modifiers: { sila: -1, krzepa: -1 }` na stos, nowe pole `restHealMultiplier: 0.5` (mnożnik leczenia we śnie, nie kumuluje się ze stosami).

### `data/phenomena.json`

- `ulewa` (Ulewa): `kind: "pogodowe"`, omen 1 h („Niebo ciemnieje od zachodu, wiatr niesie zapach mokrej ziemi.”), `duration [3, 6]`, `timeOfDay: ["dzien"]`, `chancePerDay 15`, `onArtifacts {}`, `modifiers { rangedHitChance: -10 }`, `world { visibility: -20, travel: "slow" }`.

### `data/enemies.json`

- `wilk` (Wilk / Wilka): hp 14, ap 6, initiative 8, defense 20, armor 0, tagi `["bestia"]`, `morale: null`, ai `aggressive`, xp 12, atak „Kły” 2–5 `klute`, hit 60, apCost 3, efekt `krwawienie` 15%; łup `[{ "chance": 60, "giveItem": "mieso" }]`. Bez ucieczki (brak morale).

### `data/shops.json`

- `kupiec_drogi` (Wóz wędrownego kupca): `prowiant` ×4, `opatrunek` ×2, `napar_ziol` ×1, `strzala` ×10; kupuje `consumable`, `ammo`.
- `kramarz_szkolny`: + `prowiant` ×4.

### `data/rules.json` – sekcja `travel`

```json
"travel": {
  "startLocation": "brzezina",
  "departHour": 6, "marchHours": 10, "eventHourRange": [2, 8],
  "eventChance": 40, "dangerousEventChance": 60, "dangerousAttackWeight": 2,
  "slowMinHours": 2,
  "forage": { "minutes": 60, "base": 30, "perBystrosc": 6, "max": 90, "night": -20, "slow": -10 }
}
```

Wszystkie pola wymagane, liczby całkowite ≥ 0 (`eventChance`, `dangerousEventChance`, `forage.max` ≤ 100; `departHour` 0–23; `eventHourRange` 0 ≤ a ≤ b < `marchHours`); `startLocation` istnieje w `travel.json`.

### Treść zdarzeń demo (`travel.json`)

| Zdarzenie | kind / weight | Przebieg |
|---|---|---|
| `bandyci_na_trakcie` | attack / 0 (stałe, dzień 1) | narracja zasadzki → walka (dotychczasowa `demo_droga_bandyci`, łup Kamień Zmierzchu) → przy ucieczce narracja `demo_droga_ucieczka`. |
| `pielgrzym` | encounter / 3, `once` | narracja: stary pielgrzym opowiada o Wilczym Brodzie i burzach iskier (plotka), dzieli się chlebem: `reward { items: ["prowiant"] }`. |
| `glodny_wedrowiec` | encounter / 2, `once` | dialog (nowy plik `dialogues/glodny_wedrowiec.json`): oddaj prowiant (warunek `item prowiant`; `takeItem` + `addVar wola +1`), odmów, albo – z `item jagody` – oddaj jagody (to samo, `wola +1`). |
| `kupiec_wedrowny` | encounter / 2, `once` | narracja → `shop: kupiec_drogi`. |
| `wilki` | attack / 2 | narracja („Z zarośli wychodzą dwa wilki.”) → walka `wilk ×2`, start `far`, `canFlee: true`; ucieczka – narracja. |
| `ulewa_nadciaga` | weather / 2, `if: { timeOfDay: ["swit", "dzien"] }` | uruchamia `ulewa` (jak scena `phenomenon`, także gdy trwa już inne zjawisko – zastępuje je); komunikat startu zjawiska. |
| `cisza` | encounter / 4 | narracja: jedna linijka o drodze (las, ptaki). |

Teksty w duchu gry: słowiańsko, rubasznie u wędrowca, krótko (≤ 80 kolumn na linię po zawinięciu, jak w D1).

## Silnik

### `src/systems/travel.js` (nowy)

- `validateTravel(travel, data)` → lista błędów (struktura, odwołania: lokacje, regiony, przedmioty, zjawiska, `fixed` → zdarzenie, dni w zakresie, sceny zdarzeń przez wspólny walidator scen, unikalność id scen).
- `routeById`, `locationById`, `currentRegion(state, data)`.
- `startTravel(state, data, routeId)` → ustawia `world.travel = { route, day: 1, daysTotal: route.days, phase: "depart", event: null, eventHour: null, eventScene: null, hoursWalked: 0, slowHours: 0, dangerous: false, delayed: false }`; błąd, gdy `world.location !== route.from` (wyjątek – błąd danych/fabuły).
- `rollStageEvent(state, data, rng)` → `{ id, hour } | null`. Kolejność rzutów (stała, do testów): stałe zdarzenie dnia → bez rzutu szansy; inaczej `rng.int(1, 100) ≤ chance` (chance = `dangerousEventChance`, gdy `travel.dangerous`), potem wybór ważony `rng.int(1, suma)` spośród zdarzeń z `weight > 0`, spełnionym `if` i niewidzianych `once` (atak ×`dangerousAttackWeight` przy `dangerous`); na końcu godzina `rng.int(a, b)`. Pusta pula → brak zdarzenia (bez dalszych rzutów).
- `marchHour(state, data, rng, context)` → zdarzenia czasu: `advanceTime(state, 60, data, rng, { ...context, travel: true })`, potem `hoursWalked++`, a gdy aktywne zjawisko (po kroku) ma `world.travel === "slow"` → `slowHours++`.
- `finishStage(state, data)` → po marszu: jeśli `slowHours ≥ slowMinHours` i `!delayed` → `daysTotal++`, `delayed = true`, zwraca `{ delayed: true, by: <id zjawiska> }`.
- `eatMeal(state, data, rng)` → zjada 1 przedmiot `food` o najniższym `order` (przy remisie – kolejność w `items.json`); zdejmuje 1 stos `glod`; `risk`: gdy postać nie ma wiodącej `safeTagged`, `rng.int(1, 100) ≤ chance` → `applyEffect`; zwraca zdarzenia (`posilek { id, left }`, `glod { stacks }` przy braku – wtedy `applyEffect(glod)`, `zatrucie_jedzeniem { id }`). Liczba pozostałych posiłków = suma ilości przedmiotów `food`.
- `forage(state, data, rng)` → `advanceTime(forage.minutes)`, szansa = min(max, base + perBystrosc × Bystrość) + (`night` gdy pora `noc`) + (`slow` gdy aktywne zjawisko `slow`), min 0; rzut `rng.int(1, 100)`; sukces → wybór ważony z `forage` regionu + ilość `rng.int(min, max)` → `addItem`; zwraca `{ found: { id, qty } | null, events }`.
- `endTravel(state, data)` → `world.location = route.to`, `world.travel = null`.

### Scena `travel` (`src/scenes/travel.js`, nowy) – maszyna faz

Handler czyta `world.travel`; gdy `null` → `startTravel`. Pętla, dopóki `day ≤ daysTotal`:

1. **`depart`:** przesunięcie zegara do najbliższej `departHour:00` (dziś, jeśli przed, inaczej jutro; dzień 1 po scenie fabuły zwykle jutro rano – minuty płyną przez `advanceTime`, z regeneracją i zjawiskami); `dangerous` = aktywne zjawisko z `travel: "dangerous"`; `slowHours = 0`, `hoursWalked = 0`, `delayed` bez zmian; autozapis (jak `save_point`); ekran podróży + menu: „Ruszaj w drogę” / Postać / Ekwipunek / Zapisz / Menu (wspólne pozycje z `campMenu`). „Ruszaj” → losowanie zdarzenia (`rollStageEvent`) → zapis w `travel.event`, `travel.eventHour` → faza `march`.
2. **`march`:** godziny `hoursWalked … marchHours−1` przez `marchHour`; gdy `hoursWalked === eventHour` i jest zdarzenie → faza `event`.
3. **`event`:** `kind: "weather"` → start zjawiska jak scena `phenomenon` (komunikat), oznaczenie `once`, powrót do `march`. Sceny → `runScenes` na liście zdarzenia od `eventScene ?? pierwsza`, z opcją śledzenia (`trackScene` zapisuje `world.travel.eventScene` zamiast `state.scene.id`); po końcu listy: `eventsSeen` += id (dla `once`), `event = null`, `eventScene = null` → `march`. Wynik `end` z listy (np. `ending`) kończy grę jak w fabule – niedozwolone typy scen wyklucza walidacja. Przegrana walka bez `onDefeat` → `DefeatError` jak w fabule.
4. Po `marchHours` godzinach → `finishStage` → ekran podsumowania etapu („Uszedłeś dzień drogi.” / „Ulewa – zaszedłeś tylko pół drogi. Do celu dzień dłużej.”) → faza `camp`.
5. **`camp`:** menu obozu: „Poszukaj pożywienia w okolicy” (raz na wieczór, znika po użyciu; flaga `travel.foraged`) / „Rozbij obóz” / Postać / Ekwipunek / Zapisz / Menu. „Rozbij obóz” → `eatMeal` → scena `rest` (z wystawieniem; `restHealMultiplier` z efektów) → `day++`, `foraged = false`, faza `depart`.

Po pętli: `endTravel`, komunikat „Docierasz do: {lokacja}.” i wyjście z handlera (dalej `goto` / następna scena). Każda zmiana fazy zapisuje się w `world.travel` przed czynnością, która może zostać przerwana zapisem/wyjściem, więc wczytanie wznawia: `depart` – od ekranu wymarszu (autozapis ponownie; bez ponownego losowania, jeśli `event` już jest), `march` – od godziny `hoursWalked`, `event` – od `eventScene`, `camp` – od menu obozu (`foraged` zachowane).

### Zmiany w istniejącym kodzie

- `src/engine/loop.js`: `runScenes(ctx, list, startId, { trackScene, onScene })` – `onScene(id)` zamiast sztywnego `state.scene.id` (domyślnie dla fabuły jak dotąd). Lista scen zdarzenia przez `createSceneList`.
- `src/engine/data.js`: wczytanie `travel.json`, walidacja (`validateTravel`), schemat `rules.travel`, scena `travel` (`route` istnieje), globalna unikalność id scen (fabuła + zdarzenia), `startItems`/sklepy z nowymi przedmiotami.
- `src/scenes/schemas.js` + `src/scenes/index.js`: typ `travel { route }`.
- `src/systems/items.js`: walidacja `food` (tylko consumable; `order` 1–9; `risk.effect` istnieje, `chance` 1–100, `safeTagged` istnieje w skills); consumable z `food` może nie mieć `heal`.
- `src/systems/effects.js`: `noExpire` (tylko `unit: "hour"`; tykanie pomija spadek czasu), `restHealMultiplier` (liczba > 0).
- `src/systems/inventory.js` / `src/ui/inventory_screen.js`: „Zjedz” dla przedmiotów `food` poza walką → `eatItem(state, data, id, rng)` (wspólne z `eatMeal`).
- `src/systems/combat/…`: przedmiot `food` bez `heal` niedostępny w walce.
- `src/scenes/rest.js`: mnożnik leczenia `min` z aktywnych efektów (`restHealMultiplier`); bez innych zmian.
- `src/engine/state.js`: `world.location = rules.travel.startLocation`, `world.travel = null`, `world.eventsSeen = []`.
- `src/config.js`: `SAVE_FORMAT_VERSION = 8`; `src/engine/save.js`: `migrations[7]` (dodaje `location` = `startLocation`, `travel: null`, `eventsSeen: []`), schemat, `repairTravel` (nieznana trasa/zdarzenie/scena w `world.travel` → podróż od fazy `depart` bieżącego dnia, bez zdarzenia; nieznana lokacja → `startLocation`; ostrzeżenie `load.repair.travel`).
- `src/engine/conditions.js`: `region`, `travelDay`, `location` (+ walidacja kluczy).

## Interfejs

- **Ekran podróży** (wymarsz, 80×24): pasek stanu; nagłówek „Droga: Wieś Brzezina → Strażnica Wilczy Bród”; pasek trasy `Brzezina ──●──○── Wilczy Bród` (●/○ dni; przy opóźnieniu dodatkowy ○); „Dzień 1 z 2”; „Prowiant: 3 posiłki” (żółto przy 1, czerwono przy 0 + „Głód!”); zapowiedź / trwające zjawisko z opisem skutku na drogę („Ulewa – marsz będzie wolniejszy”, „Iskrząca Burza – na trakcie niebezpiecznie”); menu.
- **Marsz:** bez ekranu na godzinę; jeden ekran podsumowania etapu (komunikaty czasu, zjawisk, artefaktu z całego marszu zebrane jak w odpoczynku) + Enter.
- **Obóz:** pasek stanu, „Obóz – dzień 1 z 2, prowiant: 2”, menu obozu; po szukaniu pożywienia komunikat („Znajdujesz: Jagody ×2.” / „Nic jadalnego w okolicy.”), po posiłku („Zjadasz: Jagody. Zostało posiłków: 2.” / „Nie masz nic do jedzenia. Głód: 1.”), zatrucie grzybami („Grzyby były nie te…”).
- **Pasek stanu:** w lokacji krótka nazwa lokacji (`Brzezina`), w podróży `W drodze 1/2`; ustępuje przed HP i przed znacznikami mistyki według reguł D1 (mistyka skraca się pierwsza, potem lokacja, HP nigdy).
- **Karta postaci:** `glod` w efektach z rozbiciem źródeł jak inne efekty.
- **Ekwipunek:** opis jedzenia („Posiłek. Psuje się szybko.” wg `order`; ryzyko grzybów: „Mogą zaszkodzić – chyba że znasz się na medycynie.”); akcja „Zjedz”.
- Wszystkie teksty w `ui.json` (`travel.*`, `camp.forage`, `camp.pitch`, `food.*`, `event.*` nowe typy, `load.repair.travel`, `itemType` bez zmian).

## Walidacja (komunikaty)

Po polsku, w stylu istniejących: `travel.json: routes[0].from: nieznana lokacja "x"`, `travel.json: events[2]: wymagane dokładnie jedno z scenes / phenomenon`, `travel.json: events[1].scenes[0].id: id sceny "demo_x" już zajęte`, `travel.json: routes[0].fixed["3"]: dzień poza zakresem 1–2`, `items.json: jagody.food: dozwolone tylko dla consumable`, `effects.json: glod.noExpire: dozwolone tylko dla unit hour`, `story.json: demo_podroz.route: nieznana trasa "x"`.

## Testy

- `test/travel.test.js` (system): walidacja (każdy komunikat wyżej + poprawny plik), `rollStageEvent` (stałe zdarzenie bez rzutów; brak zdarzenia przy rzucie > szansy; wybór ważony; `if` z `region`/`travelDay`/`timeOfDay`; `once`; `dangerous` → 60% i atak ×2; pusta pula), `marchHour`/`finishStage` (slow < 2 h – bez opóźnienia, ≥ 2 h – +1 dzień, tylko raz), `eatMeal` (kolejność `order`, głód + stosy do 3, zdjęcie stosu po posiłku, ryzyko grzybów i ochrona Medycyny), `forage` (szansa z Bystrości, noc, slow, max, ilości, region), `noExpire`, `restHealMultiplier`.
- `test/travel_scene.test.js`: pełna podróż skryptowanym IO (2 dni, stałe zdarzenie, losowe zdarzenie, obóz, szukanie, posiłek, sen), ulewa → 3 dni, głód bez prowiantu, wznowienie z zapisu w każdej fazie (`depart`, `march`, `event` – w środku spotkania bez powtórzenia nagrody, `camp` po szukaniu), autozapis na wymarszu, ekran 80×24 bez zawijania.
- `test/data.test.js`, `test/save.test.js`: wczytanie `travel.json`, migracja v7→v8, `repairTravel`.
- `test/e2e.test.js`: demo dla obu klas × ziarna 7/10/42 przez podróż; ścieżka z ulewą i głodem; ucieczka przed wilkami; `--validate` czyste.

## Kryterium ukończenia

`npm test` zielone, `node bin/game.js --validate` → „Dane poprawne.”, demo przechodzi skryptem przez podróż dla obu klas, zapis/wczytanie w każdej fazie podróży wznawia ją poprawnie, wszystkie ekrany mieszczą się w 80×24.
