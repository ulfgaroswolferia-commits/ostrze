# Cykl C1 – efekty statusu i dialogi (projekt)

> Data: 2026-10-21 · Źródło: `docs/koncepcja-gry.md` (rozdziały 5.4, 6, 12, 14, 16 – etapy 7–8) i ustalenia z brainstormingu.
> Poprzedni cykl: `2026-10-21-cykl-b2-ekwipunek-sklep-design.md` (scalony do `master`), ledger `../plans/2026-10-21-cykl-b2-ledger.md`.
> Następny: **C2 – walka** (inicjatywa, PA, dystans, ataki, AI, morale, ekran ASCII, biegłość w broni) na gotowych efektach z C1.
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

Po C1 gracz w demo rozmawia z kwatermistrzem przed kramem. Widzi opcje zależne od warunków (pieniądze, przedmiot), podejmuje testy umiejętności pokazane wprost (`[Handel 35]`), a nieudanego testu nie może powtarzać. Sukces daje rabat w sklepie. Łyk bimbru nakłada efekt „Podchmielony”, który zmienia statystyki, widać go na pasku stanu i karcie postaci i mija sam po 3 godzinach świata. Opatrunek naprawdę zdejmuje krwawienie, a sen usuwa zmęczenie. W środku rozmowy można zajrzeć do karty postaci. Zapis v4 przechowuje efekty i nieudane testy.

**Poza zakresem:** walka i wszystko, co z niej wynika (C2): efekty `unit: "turn"` w działaniu, `scope: "battlefield"`, `immune`/`effectResist` przeciwników, tyknięcia na początku tury, `startCombat`/`onCombat` w działaniu (w C1 tylko walidacja), biegłość w broni. Reputacja, towarzysze, zapis w trakcie rozmowy.

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Podział cyklu C | C1 = efekty + dialogi, C2 = walka + biegłość | Decyzja użytkownika; obie części dają grywalne demo, walka dostaje własny spec. |
| Architektura | Czyste systemy `effects.js` i `dialogue.js` + cienkie sceny `dialogue` i `effect` | Ten sam kształt co ekwipunek/sklep z B2; logika testowana bez UI; walka w C2 użyje tych samych funkcji. Odrzucone: dialog jako sekwencja scen w `story.json` (rozlewa rozmowy po fabule), dialog w całości w handlerze sceny (testy tylko przez IO). |
| Przerwy w rozmowie | Tylko karta postaci `[P]` | Decyzja użytkownika; ekwipunek i zapis dopiero w obozie po rozmowie – brak zapisu w środku rozmowy, brak „przeczekania” testu. |
| Źródła efektów poza walką | Akcje dialogu, scena `effect`, środki z torby (`removes` / nowe `applies`), odpoczynek | Decyzja użytkownika. |
| Śmierć poza walką | Tyknięcia godzinowe nie zbijają HP poniżej 1 | Śmierć zostaje sprawą walki (C2); trucizna nie zabija we śnie. |
| Efekty `turn` poza walką | Tylko w danych i walidacji; akcje poza walką mogą nakładać wyłącznie efekty `hour` | Poza walką nie ma tur, więc efekt turowy wisiałby bez końca. |
| Warunki | Rozszerzone `conditions.js`, wspólne dla dialogów i pola `if` scen | Jeden moduł warunków (koncepcja, rozdz. 12); nowe klucze od razu działają w fabule. |
| Demo | Rozmowa z kwatermistrzem przed kramem: targ, plotka, bimber | Decyzja użytkownika; wykorzystuje sklep z B2. |

## Dane

### `data/effects.json` (nowy)

Tablica efektów (jak inne pliki danych – tablica z `id`; koncepcja pokazuje słownik, format tablicy jest spójny z resztą danych). Pola:

- `id`, `name` (wyświetlana, np. „Podchmielony”), `description` (krótko, na karcie postaci).
- `unit`: `turn` | `hour`; `duration`: całkowite ≥ 1.
- opcjonalnie `modifiers` (klucze z katalogu, `validateModifiers`), `tick` `{ damage: [min, max], damageType? }` (`damageType` z `DAMAGE_TYPES`; w C1 typ nie ma znaczenia, liczy się w C2), `resist` (id atrybutu), `stack`: `refresh` (domyślnie) | `extend` | `stack`, `maxStacks` (całkowite ≥ 1, tylko przy `stack`, domyślnie `rules.effects.maxStacksDefault`), `scope: "battlefield"` (tylko przy `turn`), `sleepClears` (całkowite ≥ 1, tylko przy `hour` – liczba godzin snu, po której efekt znika), `tick.loseApChance`/`tick.loseAp` (całkowite; używane w C2).
- Inne pola = błąd (C2 dopisze swoje).

**Zestaw na C1** (liczby to punkt startowy balansu, poprawiane w E):

| id | Nazwa | unit / czas | Działanie | resist | stack |
|---|---|---|---|---|---|
| `oslepienie` | Oślepiony | turn 2 | `hitChance` −40, `defense` −10 | krzepa | refresh |
| `ogluszenie` | Ogłuszony | turn 1 | `ap` −4 | krzepa | refresh |
| `rozkojarzenie` | Rozkojarzony | turn 3 | `hitChance` −20, `defense` −15; tick `loseApChance` 30, `loseAp` 2 | bystrosc | extend |
| `zadymienie` | W dymie | turn 3, battlefield | `rangedHitChance` −35, `fleeChance` 40 | – | refresh |
| `podpalenie` | Płonie | turn 2 | tick 3–6 ogien | – | refresh |
| `krwawienie` | Krwawi | turn 3 | tick 1–3 | – | stack (max 3) |
| `strach` | Przerażony | turn 2 | `hitChance` −15, `ap` −1 | krzepa | refresh |
| `trucizna` | Zatruty | hour 4 | tick 1–3 | krzepa | stack (max 3) |
| `zmeczenie` | Zmęczony | hour 12 | `ap` −1, `bystrosc` −1 | – | refresh; `sleepClears` 6 |
| `podchmielenie` | Podchmielony | hour 3 | `wymowa` +10, `strzelecka` −10, `zrecznosc` −1 | – | refresh |

Efekty `ostrze_ognia`, `zaslona`, `spowolnienie` z koncepcji dochodzą w C2 razem z walką (tam mają sens).

### `data/dialogues/<id>.json` (nowy katalog)

Każdy plik to jedna rozmowa; `loadData` ładuje wszystkie `*.json` z katalogu do `data.dialogues` (tablica), `id` w pliku = nazwa pliku bez `.json`.

```json
{
  "id": "kwatermistrz",
  "start": "powitanie",
  "minutes": 15,
  "nodes": {
    "powitanie": {
      "speaker": "Kwatermistrz Dobrogost",
      "text": "…",
      "actions": [],
      "options": [
        { "id": "targ", "text": "Może coś utargujemy?", "check": { "skill": "handel", "difficulty": 35 },
          "success": "targ_ok", "failure": "targ_zle" },
        { "text": "Nalej łyka.", "requires": { "money": 2 },
          "actions": [{ "takeMoney": 2 }, { "addEffect": "podchmielenie" }], "goto": "bimber" },
        { "text": "Bywaj.", "goto": "end" }
      ]
    }
  }
}
```

- Rozmowa: `id`, `start` (istniejący węzeł), opcjonalnie `minutes` (całkowite ≥ 0, domyślnie `rules.dialogue.minutes`), `nodes` (obiekt, klucze = id węzłów w formacie identyfikatora).
- Węzeł: `speaker` (tekst), `text` (tekst), opcjonalnie `actions` (tablica akcji wykonywanych przy wejściu), `options` (tablica). Węzeł bez `options` (albo z pustą) kończy rozmowę po Enterze z wynikiem `end`.
- Opcja: `text`; opcjonalnie `id` (identyfikator, unikalny w węźle; **wymagany przy `check`**), `requires` (warunek), `showLocked: true` (opcja z niespełnionym `requires` jest widoczna, wyszarzona, z powodem), `actions`; oraz **dokładnie jedno** z: `goto` (id węzła, `"end"` albo `"end:<wynik>"`, `wynik` w formacie identyfikatora) lub `check` + `success` + `failure` (każde jak `goto`).
- `check`: `{ skill, difficulty }` albo `{ attribute, difficulty }` (`difficulty` całkowite 0–150).
- Akcje (jeden klucz na obiekt): `giveItem` (id lub `{id, qty}`), `takeItem` (jw.), `giveMoney` / `takeMoney` (całkowite ≥ 1), `setFlag` / `clearFlag` (tekst), `addVar` (obiekt `{ zmienna: liczba }` jak scena `var`), `xp` (całkowite ≥ 1), `time` (minuty, całkowite ≥ 1), `addEffect` / `removeEffect` (id efektu), `startCombat` (obiekt walki – w C1 walidowany tylko jako obiekt, kształt w C2).

### `data/story.json` – nowe typy scen

- `dialogue`: `{ "type": "dialogue", "dialogue": "<id>" }` + pola wspólne; wymaga wcześniejszego kreatora (jak `reward`). Opcjonalnie `onCombat` (obiekt – tylko walidowany).
- `effect`: `{ "type": "effect", "add": ["id"…]?, "remove": ["id"…]?, "force": true? }` – co najmniej jedno z `add`/`remove`; wymaga wcześniejszego kreatora.

### `data/items.json` (rozszerzenie)

- `consumable`: `removes` (lista id efektów) **zaczyna działać**; nowe opcjonalne `applies` (lista id efektów `hour`, nakładanych po użyciu przez `applyEffect`).
- `throwable.effects[].id` i `consumable.removes` / `applies` – teraz walidowane jako istniejące efekty (zaległość T1 z ledgera B2: „effect ids unchecked until C”).
- Nowy przedmiot `bimber` (consumable, `applies: ["podchmielenie"]`, waga 0.5, wartość 6) – do sklepu kwatermistrza ×2 (kupiony bimber działa jak łyk w rozmowie).

### `data/shops.json` (rozszerzenie)

Opcjonalne `priceModifiers: [{ "if": <warunek>, "buyPercent": <całkowita>, "sellPercent": <całkowita> }]` (każde z pól procentowych opcjonalne, co najmniej jedno). Spełnione wpisy sumują się per kierunek.

### `data/rules.json` (rozszerzenie)

```json
"effects": { "resistAttributeMult": 5, "resistOutcome": "cancel", "maxStacksDefault": 3 },
"dialogue": { "minutes": 10, "skillBase": 50, "attributeMult": 10, "chanceMin": 5, "chanceMax": 95 }
```

`resistOutcome`: `cancel` (odporność anuluje efekt) | `shorten` (czas o połowę w dół, min. 1).

## Wzory

- **Odporność gracza:** `resist` efektu = id atrybutu; wartość = `atrybut_końcowy × resistAttributeMult + resist_<id efektu>` (modyfikator z `getStats().other`); rzut `rng.int(1, 100) ≤ wartość` → odporność. Efekt bez `resist` albo nałożony z `force` – bez testu.
- **Szansa testu w dialogu:** umiejętność: `skill − difficulty + skillBase`; atrybut: `atrybut × attributeMult − difficulty + skillBase`; obcięta do `chanceMin`–`chanceMax`. Rzut `rng.int(1, 100) ≤ szansa` = sukces. Wartości końcowe z `getStats` (z efektami i sprzętem).
- **Ceny z rabatem:** `buy = max(minPrice, round(value × (buyBase − handel / buyHandelDiv) × (1 + Σ buyPercent / 100)))`, `sell` analogicznie z `Σ sellPercent`; nadal `sell = min(sell, buy)`.
- **Kumulacja:** `refresh` → `remaining = duration`; `extend` → `remaining += 1` (pierwsze nałożenie: `duration`); `stack` → `stacks = min(maxStacks, stacks + 1)`, `remaining = duration`. Modyfikatory i obrażenia tyknięcia × `stacks`.
- **Tyknięcie godzinowe** (każda pełna godzina, przez `HOURLY_HOOKS`): dla każdego efektu `hour` po kolei – obrażenia `rng`-owe z `tick.damage` × `stacks` (HP nie spada poniżej 1), potem `remaining − 1`, przy 0 efekt znika. Kolejność: obrażenia wszystkich efektów, potem odliczanie.
- **Sen:** scena `rest` po przespaniu `h` godzin usuwa każdy efekt z `sleepClears ≤ h` (czas efektów i tak odlicza się przez przesunięcie zegara).

> Hak godzinowy potrzebuje RNG: `advanceTime(state, minutes, data, rng?)` przekazuje `rng` do haków; bez `rng` tyknięcia z obrażeniami biorą minimum zakresu (deterministycznie – używane w testach i miejscach bez RNG). Wszystkie wywołania w grze przekazują `ctx.rng`.

## Moduły

| Plik | Odpowiedzialność |
|---|---|
| `src/systems/effects.js` (nowy) | Czyste funkcje: `effectById`, `validateEffects(effects, data)`, `hasEffect(state, id)`, `applyEffect(state, data, id, rng, { force })` → `{ ok: true, resisted, stacks }` (rzuca przy nieznanym id albo efekcie `turn` poza walką), `removeEffect(state, id)` → `{ ok, removed }`, `tickHour(state, data, rng)` → zdarzenia `{ type: "efekt_obrazenia", id, damage }` / `{ type: "efekt_koniec", id }`, `clearBySleep(state, data, hours)` → lista zdjętych id. Rejestruje hak w `HOURLY_HOOKS` (jak dotychczasowe haki). |
| `src/systems/stats.js` | Nowe źródło `effectSources` (`kind: "effect"`, `id`, `modifiers × stacks`, `permanent: false`). |
| `src/engine/conditions.js` | Nowe klucze: `item` (id lub `{id, qty}` – sztuki w torbie ≥ qty), `money` (≥ N), `attribute: { id, gte }`, `skill: { id, gte }` (wartości końcowe z `getStats`), `timeOfDay` (id pory lub niepusta lista id), `effect` (id aktywnego efektu). Sygnatura `evaluate(cond, state, data)`; `validateCondition` dostaje w `opts` listy id (atrybuty, umiejętności, przedmioty, pory, efekty). |
| `src/systems/dialogue.js` (nowy) | `validateDialogues(dialogues, data)`, `checkChance(state, data, check)`, `nodeView(state, data, dialogId, nodeId, { debug })` → `{ speaker, text, options: [{ key, label, disabled, reason }], isEnd }`, `enterNode(state, data, dialogId, nodeId, rng)` → `{ events }` (akcje węzła), `chooseOption(state, data, dialogId, nodeId, key, rng)` → `{ next } | { end: wynik }` + `{ events, check?: { success, chance, roll } }`, `finishDialogue(state, data, dialogId, result, rng)` → flaga + czas + zdarzenia. `key` opcji = jej `id` albo indeks (opcje bez `id` nie mają testu, więc indeks nie trafia do `failedChecks`). |
| `src/systems/actions.js` (nowy) | `runActions(state, data, actions, rng)` → zdarzenia (`otrzymano`, `oddano`, `pieniadze`, `flaga`, `zmienna`, `xp`, `czas`, `efekt_nalozony`, `efekt_odparty`, `efekt_zdjety`, `za_ciezko`); wspólne dla dialogów (C2 użyje dla łupu). `takeItem`/`takeMoney` odejmują do zera; `giveItem` ponad twardy limit wagi – przedmiot przepada z komunikatem `za_ciezko`. `xp` przez istniejące `addXp` (awans rozpatrywany po scenie, jak dotąd). |
| `src/systems/inventory.js` | `useConsumable`: po leczeniu `removes` (removeEffect) i `applies` (applyEffect z rng); wynik dostaje `removed`, `applied`, `resisted`. |
| `src/systems/shop.js` | `buyPrice`/`sellPrice` dostają procenty z `priceModifiers` (`priceAdjust(state, data, shopId)`). |
| `src/scenes/dialogue.js` (nowy) | Scena `dialogue`: pętla węzłów (`clear`, nagłówek `speaker`, tekst łamany `textWidth`, `select` z opcjami + `[P] Postać`), komunikaty zdarzeń i wyniku testu, `finishDialogue`, potem `campMenu`. |
| `src/scenes/effect.js` (nowy) | Scena `effect` bez UI poza komunikatami (wynik odporności, zdjęcie). |
| `src/scenes/rest.js` | Po odpoczynku `clearBySleep`; komunikaty. |
| `src/ui/events.js` (nowy) | `pushEventNotices(ctx, events)` – jedno miejsce zamiany zdarzeń systemów na komunikaty (`time.change.*` z B2 przeniesione tu z `screen.js`, plus nowe typy). |
| `src/ui/character_screen.js`, `src/ui/screen.js` | Karta: sekcja „Efekty” (`nazwa · zostało {n} h` / `{n} tur`, ×stosy), źródło `effect` w rozbiciu = nazwa efektu. Pasek stanu: `[Podchmielony 2h]` dla efektów `hour` (najwyżej 3, potem `+N`). |
| `src/engine/state.js`, `save.js`, `src/config.js` | Zapis v4: `character.effects`, `world.failedChecks`; migracja i naprawa. |
| `src/engine/data.js` | Ładowanie `effects.json` i katalogu `dialogues/`, walidacja wszystkiego powyżej, nowe typy scen, `priceModifiers`, odwołania efektów w przedmiotach. |

## Stan i zapis v4

```js
character: { ..., effects: [{ id: "podchmielenie", remaining: 3, stacks: 1 }] },
world: { ..., failedChecks: ["kwatermistrz:powitanie:targ"], finishedDialogues: ["demo_kram_rozmowa"] }
```

- `createCharacter` ustawia `effects: []`; `createNewState`: `world.failedChecks: []`, `world.finishedDialogues: []`, `version: 4`.
- `SAVE_FORMAT_VERSION` = 4; `migrations[3]`: `character.effects = []` (gdy jest postać), `world.failedChecks = []`, `world.finishedDialogues = []`.
- Walidacja kształtu: `effects` – tablica `{ id: string, remaining: integer ≥ 1, stacks: integer ≥ 1 }`; `failedChecks` i `finishedDialogues` – tablice tekstów. Zły kształt = `LoadError`.
- Naprawa z ostrzeżeniem (`load.repaired`): nieznane efekty usunięte; efekty `turn` w zapisie (nie powinny tam być poza walką) usunięte; `stacks` ponad `maxStacks` obcięte. Wpisy `failedChecks` do nieistniejących rozmów/opcji zostają (nieszkodliwe).

## Przepływ

### Scena `dialogue`

0. Gdy `scene.id` jest w `world.finishedDialogues` (zapis zrobiony w obozie po rozmowie wskazuje tę scenę): komunikat `dialogue.done` „Ta rozmowa już się odbyła.” i od razu `campMenu` – bez ponownych akcji (pieniądze, przedmioty, XP nie przychodzą drugi raz; ta sama zasada co `claimedRewards` w B2).
1. `enterNode(start)`; komunikaty zdarzeń akcji węzła.
2. Ekran: `clear`, komunikaty, nagłówek `speaker`, tekst, pusta linia, `select`:
   - opcje z `nodeView` (etykieta testu na początku: `[Handel 35] Może coś utargujemy?`; z `--debug`: `[Handel 35 · 42%]`); wyszarzone z powodem w `hint` (`dialogue.failed` „(próba nieudana)”, `dialogue.locked` „(wymaga: {what})”),
   - na końcu `[P] Postać` (`hotkey: "p"`) – karta postaci, powrót do tego samego węzła (bez ponownych akcji węzła).
   - Węzeł bez opcji: `pressEnter`.
3. Po wyborze: `chooseOption` → komunikat wyniku testu (`dialogue.success` „Udało się.”, `dialogue.failure` „Nie udało się.”), komunikaty akcji opcji; `next` → `enterNode(next)` i krok 2; `end` → `finishDialogue` (flaga `dialog_<id>_<wynik>`, czas `minutes` z komunikatami o porze), dopisanie `scene.id` do `world.finishedDialogues`, potem `campMenu`.
4. `startCombat` w akcjach (C1): rozmowa kończy się wynikiem `walka` (flaga `dialog_<id>_walka`) i komunikatem debug „walka w C2”; prawdziwa walka w C2.

### Scena `effect`

Dla `remove` – `removeEffect`; dla `add` – `applyEffect(…, { force })`. Komunikaty: `effect.applied` „Jesteś teraz: {name}.”, `effect.resisted` „Opierasz się: {name}.”, `effect.removed` „Mija: {name}.”. Scena nie czeka na Enter (komunikaty pojawią się na następnym ekranie, jak w scenach `flag`/`var`).

### Zdarzenia godzinowe

Komunikaty: `effect.tick` „{name}: −{damage} HP.”, `effect.ended` „Mija: {name}.”. Pokazywane tak jak zmiany pory dnia (na najbliższym ekranie).

### Sklep

Przy zakupie/sprzedaży ceny z `priceModifiers`; nagłówek sklepu przy aktywnym rabacie dopisuje `shop.discount` „(rabat)”.

## Walidacja danych (dopisana do `validateData`)

- `effects.json`: unikalne `id`; pola jak w „Dane”; `unit`/`stack` z list; `maxStacks` tylko przy `stack`; `scope` tylko przy `turn`; `sleepClears` tylko przy `hour`; `resist` – istniejący atrybut; `modifiers` przez `validateModifiers`; `tick.damage` `[min, max]` całkowite, min ≤ max.
- `dialogues/`: `id` = nazwa pliku, unikalne; `start` istnieje; każde `goto`/`success`/`failure` → istniejący węzeł albo `end`/`end:<wynik>`; opcja ma dokładnie jedno z `goto` / (`check` + `success` + `failure`); `check` → istniejąca umiejętność albo atrybut, `difficulty` 0–150; opcje z `check` mają `id`, unikalne w węźle; `requires` przez `validateCondition`; akcje – znane klucze, istniejące przedmioty (nie `hidden`), efekty istniejące i `unit: "hour"`, zmienne z `rules.vars`; węzeł nieosiągalny ze `start` – błąd `dialogues/<id>.json › nodes.<węzeł>: węzeł nieosiągalny` (martwa treść to zwykle literówka w `goto`).
- `story.json`: `dialogue` → istniejąca rozmowa; `effect` → co najmniej jedno z `add`/`remove`, efekty istniejące, w `add` tylko `hour`; obie wymagają wcześniejszego kreatora.
- `items.json`: `throwable.effects[].id`, `consumable.removes`, `consumable.applies` → istniejące efekty; `applies` tylko `hour`.
- `shops.json`: `priceModifiers[].if` przez `validateCondition`, procenty całkowite −90…+90, co najmniej jedno pole.
- Warunki wszędzie (sceny `if`, dialogi, sklepy): nowe klucze z odwołaniami (atrybut, umiejętność, przedmiot, pora, efekt) sprawdzane.
- `rules.json`: sekcje `effects` i `dialogue` (liczby, `resistOutcome` z listy, `chanceMin` ≤ `chanceMax`).

## Obsługa błędów

- Funkcje systemów przy błędzie gracza nie rzucają i nie zmieniają stanu (kontrakt z B2); rzucają przy błędzie programisty (nieznany id, efekt `turn` poza walką).
- `takeItem`/`takeMoney` bez pokrycia (treść przepuściła walidację, np. przez `any` w warunku) – odejmują do zera, bez awarii.
- Rozmowa nigdy nie zostaje bez wyjścia: walidacja wymaga, by każdy węzeł miał co najmniej jedną opcję bez `requires` albo był węzłem końcowym (bez opcji) – inaczej błąd `dialogues/<id>.json › nodes.<węzeł>: brak opcji zawsze dostępnej`. Opcja zablokowana nieudanym testem liczy się jako niedostępna, więc ten warunek dotyczy opcji bez `requires` i bez `check`.

## Testy

- `effects.test.js`: nałożenie, odporność (`cancel`/`shorten`, `force`), kumulacja `refresh`/`extend`/`stack` z `maxStacks`, modyfikatory × stosy w `getStats` i w rozbiciu (`kind: "effect"`), tyknięcie godzinowe (obrażenia, min. 1 HP, koniec efektu), `clearBySleep`, błąd przy efekcie `turn`.
- `conditions.test.js`: nowe klucze (prawda/fałsz, warianty `{id, qty}`, lista pór), walidacja odwołań; istniejące testy z nową sygnaturą.
- `dialogue.test.js`: `nodeView` (ukryte/wyszarzone opcje, etykieta testu, debug z szansą), `checkChance` (umiejętność, atrybut, obcięcie), `chooseOption` (sukces/porażka z ustalonym RNG, zapis w `failedChecks`, zablokowanie), akcje, `finishDialogue` (flaga, czas).
- `actions.test.js`: każda akcja, odejmowanie do zera, `giveItem` ponad limit.
- `inventory.test.js`, `shop.test.js`: `removes`/`applies` w `useConsumable`; ceny z `priceModifiers` (rabat, suma wpisów, `min(sell, buy)`).
- `save.test.js`: migracja v3 → v4; naprawa (nieznany efekt, efekt `turn`, stosy ponad limit); zły kształt → `LoadError`.
- `data.test.js`: każda reguła walidacji z komunikatem `plik › id › pole`.
- Sceny (skryptowe IO): dialog – wybór numerem, test z ustalonym ziarnem, nieudany test wyszarzony przy powrocie do węzła, `[P]` w środku rozmowy, koniec → flaga i obóz; scena `effect`; `rest` zdejmuje zmęczenie; pasek stanu i karta z efektem.
- e2e (`createScriptedIO`, obie klasy): miecz – rozmowa z kwatermistrzem (targ – ustalone ziarno daje znany wynik, bimber), w kramie cena z rabatem lub bez zgodnie z flagą, „Podchmielony” na pasku, po odpoczynku efekt zniknął; włócznia – „Bywaj.” i dalej bez zmian.

## Demo `story.json` po C1

Przed `demo_kram` (po `demo_kram_wstep`) nowa scena `demo_kram_rozmowa` (`dialogue: kwatermistrz`). Rozmowa w stylu „Styl i ton” spec. głównej i dokumentów-inspiracji (zrzędliwy, skąpy kwatermistrz, rubasznie, ale bez przesady), 5–8 węzłów:

- **[Handel 35]** targ – sukces: flaga `kwatermistrz_rabat` (sklep: `buyPercent` −10, `sellPercent` +10), porażka: zrzędzenie, bez rabatu, opcja zablokowana.
- **[Wymowa 40]** plotka o kurierze – sukces: flaga `plotka_kurier` (do użycia w późniejszej treści), porażka: zbycie.
- „Nalej łyka” (`requires: money 2`) – `takeMoney 2`, `addEffect podchmielenie`, riposta.
- „Patrz, jaki kaptur” (`requires: item kaptur_mysliwego`, `showLocked`) – riposta (bez skutków mechanicznych).
- „Bywaj.” – `end`.

Kram dostaje `priceModifiers` z flagą rabatu i 2× `bimber` w towarze.

## Zaległości z ledgera B2 włączone do C1

- Walidacja istnienia efektów w przedmiotach (T1).
- `removes` w środkach zaczyna działać.
- Ujednolicenie komunikatów zdarzeń w jednym module (`src/ui/events.js`) – porządkuje `pushTimeNotices` z B2.

## Kryterium ukończenia

Wszystkie testy zielone (`npm test`), `node bin/game.js --validate` bez błędów, demo przechodzi skryptem dla obu klas, a w prawdziwym terminalu rozmowa działa strzałkami, numerami i `[P]`, efekt widać na pasku i karcie, a po czasie znika.
