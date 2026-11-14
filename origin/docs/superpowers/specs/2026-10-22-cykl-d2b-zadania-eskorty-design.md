# Cykl D2b – zadania, eskorty, lokacje tymczasowe (projekt)

> Data: 2026-10-22 · Źródło: `docs/koncepcja-gry.md` (rozdz. 13a „Podróże i spotkania”, budżet XP z rozdz. 6) i ustalenia z brainstormingu.
> Poprzedni cykl: `2026-10-22-cykl-d2a-podroze-design.md` (scalony do `master` 178c047), ledger `../plans/2026-10-22-cykl-d2a-ledger.md`.
> Następny: **E** – treść, panele interfejsu, publikacja.
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

Po D2b w drodze do Wilczego Brodu można spotkać kupca Ostromira, który zleca eskortę, a w Wilczym Brodzie komendant zleca zadanie „Wilcza nora”. Po scenie kuriera pojawia się **mapa**: lokacje tymczasowe zadań (Wilcza Nora, Kamienna Przełęcz) i „Czekaj na kuriera” (dalej fabułą). Wyprawa do zadania to podróż jak w D2a (etapy, zdarzenia, obóz), sceny na miejscu i powrót na mapę. Eskorta ma klienta, który może przepaść (ucieczka/przegrana w napadzie), i termin wymarszu. Wyjście dalej fabułą z niewykonanymi zadaniami – po potwierdzeniu – kończy je jako przepadłe. Dziennik [D] pokazuje zadania. Zapis w każdej fazie wznawia mapę i wyprawę.

**Poza zakresem (E):** zadania wieloetapowe, zadania między punktami postoju, odległości liczone po grafie mapy, reputacja, historia w dzienniku poza listą zakończonych, poprawka znaczenia `wola`, panele UI (ramki), przeróbka starych zapisów sprzed v9 poza migracją pól.

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Dotarcie do zadań | Scena `map` w punktach postoju; wyprawa tam → na miejscu → powrót | Decyzja użytkownika (fabuła liniowa, swoboda w punktach postoju). |
| Eskorta | Tam i z powrotem, z klientem; przegrana/ucieczka w zdarzeniu eskorty → zadanie przepada, zawrócenie | Decyzja użytkownika. |
| Niewykonane zadania | Należą do punktu postoju; wyjście dalej fabułą (z potwierdzeniem) → przepadają; opcjonalny termin wymarszu `deadlineDays` | Decyzja użytkownika. |
| Demo | Zadanie „Wilcza nora” od komendanta + eskorta Ostromira ze spotkania w drodze; mapa w Wilczym Brodzie | Decyzja użytkownika. |
| Architektura | `runTrip(ctx, opts)` wydzielone z D2a i używane przez sceny `travel` i `map`; `data/quests.json`; scena `quest` (start/complete/fail) | Jedna maszyna podróży, wznawianie jak w D2a. |
| Termin | Liczony od przyjęcia do wymarszu; w drodze nie biegnie | Prosty, czytelny dla gracza. |
| Zdarzenia stałe tras | Tylko w podróżach fabuły (scena `travel`), nie w wyprawach do zadań | Bandyci z 1. dnia drogi z Brzeziny nie wracają. |
| XP | Nagrody za zadania to pieniądze/przedmioty; XP tylko z walk po drodze i na miejscu | Koncepcja 13a; budżet XP. |

## Dane

### `data/travel.json`

- Lokacje: nowe pole opcjonalne `temporary: true`. Nowe lokacje `wilcza_nora` („Wilcza Nora”, short „Wilcza Nora”), `kamienna_przelecz` („Kamienna Przełęcz”, short „Przełęcz”), region `pogorze`, obie `temporary`.
- Trasy: `wilczy_brod_nora` (`wilczy_brod` → `wilcza_nora`, 1 dzień), `wilczy_brod_przelecz` (`wilczy_brod` → `kamienna_przelecz`, 1 dzień); bez `fixed`. Każda trasa może być przebyta w obie strony (`reverse`).
- Nowe zdarzenie `kupiec_ostromir` (`encounter`, waga 2, `once`): narracja + dialog `ostromir` (plik `data/dialogues/ostromir.json`): zgoda → węzeł z `goto` do końca i flaga `ostromir_zgoda`; potem scena `quest` `{ start: "eskorta_ostromira", if: { flag: "ostromir_zgoda" } }`. Odmowa – nic.

### `data/quests.json` (nowy plik)

```json
[
  { "id": "wilcza_nora", "kind": "quest", "name": "Wilcza nora", "hub": "wilczy_brod",
    "description": "Komendant płaci za watahę, która porywa owce spod palisady.",
    "location": "wilcza_nora", "route": "wilczy_brod_nora", "deadlineDays": null,
    "scenes": [ /* sceny na miejscu – jak sceny zdarzeń D2a */ ] },
  { "id": "eskorta_ostromira", "kind": "escort", "name": "Eskorta kupca Ostromira", "hub": "wilczy_brod",
    "description": "Odprowadzić wóz Ostromira do Kamiennej Przełęczy.",
    "client": "Kupiec Ostromir", "location": "kamienna_przelecz", "route": "wilczy_brod_przelecz", "deadlineDays": 3,
    "eventChance": 50,
    "events": [ /* zdarzenia tylko w drodze tam – format jak events w travel.json */ ],
    "scenes": [ /* na miejscu */ ] }
]
```

- Pola: `id`, `kind` ∈ `quest` | `escort`, `name`, `hub` (lokacja nie-tymczasowa), `description`, `location` (lokacja **tymczasowa**), `route` (trasa z `hub` do `location` – `from` = `hub`), `deadlineDays` (`null` albo liczba całkowita ≥ 1), `client` (wymagany dla `escort`, zakazany dla `quest`), `eventChance` (opcjonalnie 0–100, tylko dla drogi tam), `events` (opcjonalnie, format zdarzeń z `travel.json`, sceny walidowane tak samo), `scenes` (niepusta lista scen na miejscu; walidacja jak sceny zdarzeń: `goto: "koniec"` kończy, zakazane typy jak w zdarzeniach + `map`).
- Id scen unikalne globalnie (fabuła + zdarzenia drogi + zdarzenia zadań + sceny zadań); id zdarzeń zadań unikalne razem z `travel.json`.

**Treść demo:**

| Zadanie | Na miejscu |
|---|---|
| `wilcza_nora` | narracja (nora w wąwozie, kości owiec) → walka `wilk ×3`, `start: far`, `canFlee`, `onFlee` → narracja „wataha zostaje” + `quest fail`; po wygranej narracja + `quest complete` + `reward { money: 25 }` (wypłata u komendanta opisana w tekście) |
| `eskorta_ostromira` | narracja (Przełęcz, Ostromir płaci) + `quest complete` + `reward { money: 40, items: [{ id: "prowiant", qty: 2 }] }` |

Zdarzenie eskorty `napad_na_woz` (`attack`, waga 3; z `eventChance: 50` i tylko tym zdarzeniem w puli zadania): narracja → walka `bandyta ×2`, `canFlee`, `onFlee` i `onDefeat` → narracja „wóz przepada” + `quest fail`; po wygranej narracja „Ostromir dziękuje” i `goto: "koniec"`. `onDefeat` w zdarzeniu eskorty = przeżywasz z 1 HP (jak walka z `onDefeat`), zadanie przepada.

### `data/story.json`

- Po `demo_kurier`: dialog `komendant` (plik `data/dialogues/komendant.json`, zlecenie: przyjmij / odmów; flaga `nora_zgoda`), scena `quest` `{ start: "wilcza_nora", if: { flag: "nora_zgoda" } }`, scena `demo_mapa` `{ type: "map", hub: "wilczy_brod", title: "Wilczy Bród", main: { label: "Czekaj na kuriera", goto: "demo_odpoczynek" } }`. Dalej bez zmian (odpoczynek → wieczór → zapis → koniec).

### `data/rules.json` – `quests`

`{ "maxActive": 6 }` – limit aktywnych zadań. Start ponad limit: komunikat „Masz już za dużo zadań.” i zadanie nie startuje (status bez zmian).

### Sceny

- `quest`: `{ type: "quest", start | complete | fail: <id> }` (dokładnie jedno), + wspólne `if`, `goto`, `tags`. Start: status `active`, `acceptedAt` = teraz, `deadline` = teraz + `deadlineDays × 24 h` lub `null`; komunikat „Nowe zadanie: {name}”. Ponowny start zadania już znanego – bez zmian. Complete/fail tylko z `active` (inaczej bez zmian); komunikaty „Zadanie wykonane: {name}” / „Zadanie przepadło: {name}”.
- `map`: `{ type: "map", hub, main: { label, goto } }` + `title`, `if`, `tags` (bez `time`, `goto` – wyjście tylko przez `main.goto`).

## Stan i zapis (v9)

- `state.quests[id] = { status: "active" | "done" | "failed", acceptedAt, deadline: minuta | null, departed: boolean }`.
- `world.map`: `null` albo `{ hub, phase: "choose" | "outbound" | "onsite" | "return", quest, questScene }`.
- `world.travel` (D2a) + pola `reverse` (bool), `quest` (id albo `null`: zdarzenia i szansa zadania na drodze tam; brak zdarzeń stałych), `turnBack` (bool – zawrócenie po porażce).
- Migracja `8 → 9`: `quests` zostaje (pusty obiekt), `world.map = null`, w `world.travel` brakujące pola `reverse: false`, `quest: null`, `turnBack: false`. Naprawa: nieznane zadanie w `quests` – usunięte; `world.map` z nieznanym `hub`/`quest`/`questScene` → `phase: "choose"` (albo `null` przy nieznanym hub); ostrzeżenie `load.repair.quests`.

## Silnik

### `src/systems/quests.js` (nowy)

- `validateQuests(list, data)` – struktura i odwołania (spec „Dane”); sceny przez wspólny walidator z `data.js`.
- `questById`, `activeQuests(state)`, `startQuest(state, data, id)` → zdarzenia (`zadanie_start` | `zadanie_limit`), `completeQuest`, `failQuest` → zdarzenia (`zadanie_wykonane` / `zadanie_przepadlo`), `expireQuests(state, data)` (aktywne, niewyruszone, po terminie → `failed`), `abandonHub(state, data, hub)` (wszystkie aktywne z tym `hub` → `failed`), `mapOptions(state, data, hub)` → lista `{ quest, location, days, deadlineLeft }` (aktywne, nie po terminie, z tym `hub`).

### Wydzielenie podróży (`src/scenes/trip.js`)

- `runTrip(ctx, { route, reverse = false, quest = null, onArrive })` – maszyna faz z `src/scenes/travel.js` (D2a) przeniesiona bez zmian zachowania. Tworzy `world.travel` przy pierwszym wywołaniu (z `reverse`, `quest`), wznawia istniejący. Zdarzenie stałe dnia tylko gdy `quest === null` i `!reverse`. Na drodze tam do zadania (`quest` i `!reverse`): szansa zdarzenia `quest.eventChance ?? rules`, pula = zdarzenia zadania (+ zwykła pula, gdy zadanie nie ma `events`). Gdy w trakcie drogi tam zadanie przestaje być `active` (porażka eskorty): po bieżącym zdarzeniu `turnBack = true`, `reverse = true`, `daysTotal = day` (dni spędzone w drodze tam, łącznie z bieżącym), `day = 1` – reszta bieżącego marszu jest już pierwszym dniem powrotu; komunikat „Bez {clientGen} nie ma po co iść dalej – zawracasz.”; sceny na miejscu nie grają się. Koniec: `world.location` = cel (lub start przy `reverse`), `world.travel = null`.
- `travel` (scena D2a) = `runTrip(ctx, { route: scene.route })`.
- `rollStageEvent` dostaje pulę i szansę z opcji (zgodnie z wyżej).

### Scena `map` (`src/scenes/map.js`)

- Wejście: `world.map` `null` → `{ hub, phase: "choose" }`. `expireQuests` przy każdym wejściu w `choose` (komunikaty).
- `choose`: ekran mapy (spec „Interfejs”), wybór: zadanie → `quests[id].departed = true`, `phase: "outbound"`, `quest: id`; „dalej fabułą” → przy aktywnych zadaniach z tym hubem potwierdzenie (`confirm`), potem `abandonHub`, `world.map = null`, wynik `{ goto: main.goto }`.
- `outbound`: `runTrip({ route, reverse: route.from !== hub, quest })`; po dotarciu (`world.location === quest.location`) → `onsite`; po zawróceniu (dotarcie do hub) → `choose`.
- `onsite`: `runScenes` po scenach zadania od `questScene` (śledzone jak `eventScene`), `endId: "koniec"`; potem `phase: "return"`.
- `return`: `runTrip({ route, reverse: przeciwnie do drogi tam })` → `choose`.
- `forgetScenes` (D2a) przy pierwszym wejściu w sceny zadania i w zdarzenia zadania.

### Pozostałe zmiany

- `src/engine/data.js`: wczytanie `quests.json` (po `travel.json`), walidacja, sceny `quest`/`map`, wspólny zbiór id scen, `rules.quests`.
- `src/scenes/schemas.js`, `src/scenes/index.js`: `quest`, `map`.
- `src/ui/camp.js`: pozycja „Dziennik” `[D]` w menu obozu (we wszystkich miejscach, gdzie jest menu obozu – także wymarsz, mapa).
- `src/ui/journal_screen.js` (nowy): dziennik – aktywne (nazwa, cel, termin „zostały N dni” albo „bez terminu”, opis zawinięty), potem zakończone (`✓` / `✗` + nazwa); ≤ 23 linie, przewijanie jak w ekwipunku nie jest potrzebne przy limicie 6 aktywnych + skrócona lista zakończonych (ostatnie 5).
- `src/ui/screen.js`: pasek – w drodze do zadania „Do: {short} {day}/{days}”, w powrocie „Powrót {day}/{days}” (ta sama reguła ustępowania co D2a).
- `src/ui/events.js`: `zadanie_start`, `zadanie_wykonane`, `zadanie_przepadlo`, `zadanie_limit`.
- `src/engine/state.js`, `src/config.js` (`SAVE_FORMAT_VERSION = 9`), `src/engine/save.js` (`migrations[8]`, `repairQuests`).
- Dialogi demo: `komendant.json`, `ostromir.json`.

## Interfejs

- **Mapa** (80×24): pasek stanu; tytuł „{hub} – dokąd?”; wiersze celów: „{lokacja} · {zadanie|eskorta} „{name}” · {days} dzień/dni[ · termin: zostało N dni]”; ostatni wiersz – `main.label` „(dalej fabułą)”; potem pozycje menu obozu (Dziennik, Postać, Ekwipunek, Zapisz, Menu).
- **Potwierdzenie wyjścia:** „Masz niewykonane zadania – przepadną. Ruszać?” (t/n).
- **Komunikaty:** „Nowe zadanie: {name}.”, „Zadanie wykonane: {name}.”, „Zadanie przepadło: {name}.”, „{client} nie doczekał – zadanie przepadło.”, „Bez {clientGen} nie ma po co iść dalej – zawracasz.” (tekst w `ui.json` z formą klienta w danych: pole `clientGen` – dopełniacz, wymagane dla eskorty), „Wracasz do: {hub}.”
- **Dziennik [D]** – jak wyżej.
- Wszystkie teksty w `ui.json`, linie ≤ 80 kolumn.

## Walidacja (komunikaty)

W stylu istniejącym (`plik › sekcja › id › pole: opis`), m.in.: `quests.json › wilcza_nora › location: lokacja nie jest tymczasowa`, `quests.json › x › route: trasa nie łączy wilczy_brod z wilcza_nora`, `quests.json › x › client: wymagane dla eskorty`, `quests.json › x › client: dozwolone tylko dla eskorty`, `quests.json › x › deadlineDays: wartość mniejsza niż 1`, `quests.json › x › hub: lokacja tymczasowa nie może być punktem postoju`, `story.json › a › start: nieznane zadanie "x"`, `story.json › a › quest: wymagane dokładnie jedno z start / complete / fail`, `story.json › m › hub: nieznana lokacja "x"`, `quests.json › x › scenes › s › id: id sceny "s" już zajęte`.

## Testy

- `test/quests.test.js`: walidacja (każdy komunikat), start/complete/fail (statusy, zdarzenia, idempotencja), limit aktywnych, `expireQuests` (termin, wyruszone nie przepadają), `abandonHub`, `mapOptions`.
- `test/trip.test.js` (lub rozszerzenie `travel_scene`): `runTrip` w odwrotnym kierunku (lokacja docelowa = start trasy), zdarzenia zadania i `eventChance`, brak zdarzeń stałych w wyprawie, zawrócenie po porażce eskorty (dni powrotu, brak `onArrive`), scena `travel` z D2a bez zmian zachowania (dotychczasowe testy zielone).
- `test/map_scene.test.js`: pełny cykl wyprawy (wybór → tam → na miejscu → powrót → wybór → dalej fabułą), potwierdzenie i przepadanie, przeterminowana eskorta, wznowienie z zapisu (prawdziwy `saveGame`/`loadGame`) w każdej fazie bez powtórzenia nagrody, ekran mapy i dziennika ≤ 23 linie i ≤ 80 kolumn.
- `test/save.test.js`: migracja v8→v9, `repairQuests`.
- `test/e2e.test.js`: demo obu klas × ziarna 7/10/42 z mapą („dalej fabułą” bez zadań i z wykonaniem Wilczej Nory); ścieżka z eskortą (kopia danych z `kupiec_ostromir` jako zdarzeniem stałym 2. dnia); odmowa komendanta; wyjście z niewykonanymi zadaniami – przepadają. Sterownik `{ trip }` obsługuje mapę i dziennik (krok `{ map: [cel, …] }` – wybiera kolejne cele po nazwie, na końcu „dalej fabułą”).

## Kryterium ukończenia

`npm test` zielone, `node bin/game.js --validate` → „Dane poprawne.”, demo przechodzi skryptem z mapą, zadaniem i eskortą dla obu klas, zapis/wczytanie w każdej fazie mapy i wyprawy wznawia je poprawnie, ekrany mieszczą się w 80×24.
