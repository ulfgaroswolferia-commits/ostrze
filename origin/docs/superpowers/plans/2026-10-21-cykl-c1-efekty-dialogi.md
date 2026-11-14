# Cykl C1 – efekty statusu i dialogi – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Efekty statusu (nakładanie, odporność, kumulacja, tyknięcia godzinowe, sen), rozszerzone warunki, akcje, dialogi z testami i scena rozmowy z kwatermistrzem, zapis v4 – grywalne w demo dla obu klas.

**Architecture:** Czyste systemy `src/systems/effects.js`, `actions.js`, `dialogue.js` (stan + dane → wynik/zdarzenia), efekty jako nowe źródło w `STAT_SOURCES`, tyknięcie wołane z `advanceTime`. Warunki w `src/engine/conditions.js` z nową sygnaturą `evaluate(cond, state, data)`. Sceny `dialogue` i `effect` jako cienkie UI; jeden moduł zamiany zdarzeń na komunikaty `src/ui/events.js`.

**Tech Stack:** Node.js ≥ 22, ESM, JSDoc, zero zależności, `node:test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-10-21-cykl-c1-efekty-dialogi-design.md` (binding). Spec główna: `docs/koncepcja-gry.md`.

## Global Constraints

- Zero zależności npm; tylko moduły `node:*`.
- `src/engine/*` (poza `loop.js`) i `src/systems/*` nie importują niczego z `src/ui/`. Silnik może importować systemy.
- Kod i nazwy techniczne po angielsku, komentarze w stylu istniejącego kodu (krótkie JSDoc); treść gry i `id` danych po polsku bez diakrytyków.
- Każdy tekst widoczny dla gracza w `data/ui.json` (klucze z tego planu) lub w plikach `data/*`; żadnych polskich napisów w kodzie poza komunikatami walidacji/błędów.
- Komunikaty walidacji danych: `plik › id › pole: opis` (dla rozmów: `dialogues/<id>.json › …`).
- Liczby balansu w `rules.json` (`effects`, `dialogue`), nie w kodzie.
- Funkcje systemów przy błędzie gracza zwracają `{ ok: false, reason }` (`reason` = klucz `ui.json`) i **nie zmieniają stanu**; rzucają tylko przy błędzie programisty (nieznany `id`, efekt `turn` poza walką, zła ilość).
- Poza walką HP nigdy nie spada poniżej 1 od efektów.
- Jeden widżet wyboru wszędzie; tryb liniowy (bez TTY) musi działać dla każdej nowej decyzji. Teksty w UI: „HP”, nie „ŻYC/PŻ”.
- Testy skryptowe nie zostawiają niewykorzystanych wejść (asercja `InputExhaustedError` na końcu, jak w B2).
- Każde zadanie kończy się zielonym `npm test`, czystym `node bin/game.js --validate` i commitem na gałęzi `cykl-c1`.

## Review Focus

1. Zapis w obozie po rozmowie i wczytanie – akcje rozmowy (pieniądze, przedmioty, XP, efekty) nie mogą zadziałać drugi raz (test w Task 10).
2. `[P] Postać` w środku rozmowy i powrót – akcje węzła nie wykonują się ponownie (np. podwójne `takeMoney`) (test w Task 10).
3. Rozmowa bez wyjścia – po nieudanym teście lub przy niespełnionych `requires` zawsze zostaje dostępna opcja; walidacja odrzuca węzeł bez opcji zawsze dostępnej (test w Task 6, przypadek „jedyna opcja z `check`”).
4. Długi sen z trucizną / krwawieniem poza walką – HP kończy na ≥ 1, efekt mija, komunikaty nie zalewają ekranu (jeden komunikat na efekt na tyknięcie, najwyżej 8 widocznych + „…”) (test w Task 2 i 9).
5. Stare zapisy v3 i zapisy z efektami usuniętymi z danych / efektami `turn` – wczytują się z ostrzeżeniem (test w Task 3).

---

### Task 1: `effects.json`, reguły i walidacja efektów

**Files:**
- Create: `data/effects.json`, `src/systems/effects.js` (na razie `effectById`, `validateEffects`)
- Modify: `data/rules.json`, `data/items.json`, `src/engine/data.js`, `src/systems/items.js`, `test/helpers.js`
- Test: `test/data.test.js`

**Interfaces:**
- Produces: `data.effects` (tablica); `effectById(data, id)` → efekt | `undefined`; `validateEffects(effects, data)` → `string[]` (prefiks `effects.json › <id> › `); `EFFECT_UNITS = ["turn", "hour"]`, `STACK_MODES = ["refresh", "extend", "stack"]`.
- `loadData` ładuje `effects.json` po `perks.json`, przed `items.json`; `minimalData()` dostaje `effects` z prawdziwego pliku.
- `validateItems` sprawdza `throwable.effects[].id`, `consumable.removes[]`, `consumable.applies[]` → istniejące efekty, `applies` tylko `unit: "hour"`.

- [ ] **Step 1: Testy walidacji (failing)** w `test/data.test.js`, na kopii `minimalData()` (dopasowanie `includes`):
  - prawdziwe dane → `[]`
  - `unit: "dzien"` → `effects.json › x › unit: nieznana jednostka "dzien"`
  - `stack: "mnoz"` → `effects.json › x › stack: nieznany tryb "mnoz"`
  - `maxStacks` przy `stack: "refresh"` → `effects.json › x › maxStacks: dozwolone tylko przy stack`
  - `scope: "battlefield"` przy `unit: "hour"` → `effects.json › x › scope: dozwolone tylko dla unit turn`
  - `sleepClears` przy `unit: "turn"` → `effects.json › x › sleepClears: dozwolone tylko dla unit hour`
  - `resist: "latanie"` → `effects.json › x › resist: nieznany atrybut "latanie"`
  - `tick.damage: [5, 2]` → `effects.json › x › tick.damage: oczekiwano [min, max] liczb całkowitych, min ≤ max`
  - `modifiers: { latanie: 1 }` → komunikat `validateModifiers` z prefiksem `effects.json › x › modifiers`
  - powtórzone `id`; nieznane pole `foo` → `effects.json › x › foo: nieznane pole`
  - `rules.effects.resistOutcome: "zignoruj"` → `rules.json › effects.resistOutcome: …`
  - `garniec_wapno.effects[0].id: "brak"` → `items.json › garniec_wapno › effects[0].id: nieznany efekt "brak"`
  - `opatrunek.removes: ["brak"]` → `items.json › opatrunek › removes[0]: nieznany efekt "brak"`
  - `bimber.applies: ["krwawienie"]` → `items.json › bimber › applies[0]: efekt "krwawienie" nie jest godzinowy`
- [ ] **Step 2:** `npm test` – nowe testy FAIL.
- [ ] **Step 3: Implementacja.** `data/effects.json` – dokładnie 10 efektów z tabeli spec („Zestaw na C1”) z nazwami i krótkimi opisami (styl „Styl i ton”); `rules.json`: `"effects": { "resistAttributeMult": 5, "resistOutcome": "cancel", "maxStacksDefault": 3 }` (`RULES_SCHEMA` wymaga, `resistOutcome` ∈ `cancel|shorten`); schemat efektu jak w spec „Dane”; `items.json`: pole `applies` w schemacie `consumable`, nowy przedmiot `bimber` (consumable, `target: "self"`, `apCost` 3, `applies: ["podchmielenie"]`, waga 0.5, wartość 6, krótki opis).
- [ ] **Step 4:** PASS; `node bin/game.js --validate` czyste.
- [ ] **Step 5: Commit** `feat(dane): efekty statusu, reguły efektów i walidacja odwołań`.

### Task 2: System efektów – nakładanie, odporność, kumulacja, tyknięcie, sen

**Files:**
- Modify: `src/systems/effects.js`, `src/systems/stats.js`, `src/engine/time.js`, `src/systems/character.js` (`effects: []`), `src/engine/loop.js`, `src/scenes/rest.js`, `src/systems/inventory.js` (przekazanie `rng` do `advanceTime`)
- Test: `test/effects.test.js` (nowy), `test/time.test.js`, `test/stats.test.js`

**Interfaces:**
- Consumes: `effectById` (Task 1), `getStats` (B1/B2), `rng.int(min, max)`.
- Produces:
  - `hasEffect(state, id)` → bool.
  - `applyEffect(state, data, id, rng, { force = false } = {})` → `{ ok: true, resisted: boolean, stacks: number }`; rzuca przy nieznanym `id` i przy `unit: "turn"` (poza walką). Zachowanie wg spec „Wzory” (odporność `atrybut × resistAttributeMult + other["resist_<id>"]`, `rng.int(1, 100) ≤` wartość; `shorten` = `max(1, floor(duration / 2))`; kumulacja `refresh`/`extend`/`stack`).
  - `removeEffect(state, id)` → `{ ok: true, removed: boolean }`.
  - `tickHour(state, data, rng)` → `Event[]`: `{ type: "efekt_obrazenia", id, damage }` (po obcięciu do HP ≥ 1; zdarzenie tylko gdy `damage > 0`), `{ type: "efekt_koniec", id }`. Najpierw obrażenia wszystkich efektów `hour`, potem odliczanie. Bez `rng` obrażenia = `min` zakresu × stosy.
  - `clearBySleep(state, data, hours)` → `string[]` (zdjęte id z `sleepClears ≤ hours`).
  - `advanceTime(state, minutes, data, rng)` – czwarty parametr; na każdej pełnej godzinie woła `tickHour(state, data, rng)` **przed** `HOURLY_HOOKS`; zdarzenia w kolejności czasu. Wszystkie wywołania w `src/` przekazują `ctx.rng` (`loop.js`, `rest.js`, `useConsumable`).
  - `STAT_SOURCES` + `effectSources`: `{ source: { kind: "effect", id }, modifiers: modifiers × stacks, permanent: false }` dla każdego aktywnego efektu (`state.character?.effects ?? []`).
  - `createCharacter` ustawia `effects: []`.
  - `rest`: po przespaniu `h` godzin `clearBySleep(state, data, h)`; zwracane id trafiają jako zdarzenia `{ type: "efekt_koniec", id }` (komunikaty w Task 7).

- [ ] **Step 1: Testy (failing)** w `test/effects.test.js` (postać 5/5 z `createCharacter`, RNG z `createRng(seed)`; dla rzutów odporności użyj RNG-atrapy `{ int: () => k }`):
  - `applyEffect(podchmielenie)` → `effects` = `[{ id, remaining: 3, stacks: 1 }]`, `getStats().skills.wymowa` +10 względem stanu bez efektu, `breakdown` zawiera `{ source: { kind: "effect", id: "podchmielenie" }, value: 10 }` dla `wymowa`.
  - odporność: `trucizna` (resist krzepa 5 → 25): atrapa `int → 25` → `resisted: true`, brak efektu; `int → 26` → nałożony; `force: true` przy `int → 1` → nałożony; `resistOutcome: "shorten"` + sukces → `remaining` = 2.
  - kumulacja: `trucizna` ×4 → `stacks` 3 (`maxStacks` 3), `remaining` 4; `podchmielenie` ×2 → `stacks` 1, `remaining` 3 po odliczeniu godziny i ponownym nałożeniu; efekt testowy `extend` (kopia danych, `unit: "hour"`) – drugie nałożenie → `remaining` = duration + 1.
  - `applyEffect(oslepienie)` → rzuca (efekt turowy).
  - `tickHour`: trucizna stacks 2 przy HP 3, atrapa `int → 3` → surowe obrażenia 3 × 2 = 6, HP obcięte do 1, zdarzenie `damage` 2, `remaining` 3; cztery godziny → `efekt_koniec`, efekt zniknął.
  - `advanceTime(state, 120, data, rng)` z trucizną → 2 zdarzenia `efekt_obrazenia` w kolejności czasu, przed haki z `HOURLY_HOOKS` (sprawdź z hakiem testowym).
  - `clearBySleep(state, data, 6)` zdejmuje `zmeczenie`, zostawia `trucizna`; przy 5 h – nie zdejmuje.
  - `removeEffect` nieobecnego → `{ ok: true, removed: false }`.
  - `getStats(..., { permanentOnly: true })` pomija efekty.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja wg Interfaces. **Step 4:** PASS (cały `npm test`, także `time.test.js` z nowym parametrem).
- [ ] **Step 5: Commit** `feat(efekty): nakładanie, odporność, kumulacja, tyknięcia godzinowe i sen`.

### Task 3: Zapis v4 – migracja, walidacja, naprawa

**Files:**
- Modify: `src/config.js` (`SAVE_FORMAT_VERSION` = 4), `src/engine/state.js` (`version: 4`, `world.failedChecks: []`, `world.finishedDialogues: []`), `src/engine/save.js`, `data/ui.json`
- Test: `test/save.test.js`

**Interfaces:**
- Consumes: `effectById` (Task 1).
- Produces: `migrations[3]` (spec „Stan i zapis v4”); schematy: `character.effects` tablica `{ id: string, remaining: integer ≥ 1, stacks: integer ≥ 1 }` (wymagana przy postaci), `world.failedChecks` / `world.finishedDialogues` tablice tekstów; `repairInventory` rozszerzone (albo osobna `repairEffects(state, data)` → `string[]` wołana obok – ta sama kolejność i format ostrzeżeń `load.repaired`): nieznane efekty usunięte, efekty `turn` usunięte, `stacks` > `maxStacks` (albo > 1 przy trybie innym niż `stack`) obcięte. Teksty `load.repair.effects` itd. w `ui.json` (wzorem B2).

- [ ] **Step 1: Testy (failing):** zapis v3 (postać bez `effects`, świat bez `failedChecks`) wczytuje się jako v4 z pustymi tablicami; pełny cykl zapis → wczytanie zachowuje `effects`, `failedChecks`, `finishedDialogues`; zapis z efektem `usuniety` → wczytany bez niego, `warnings` z 1 wpisem zawierającym `usuniety`; efekt `oslepienie` w zapisie → usunięty z ostrzeżeniem; `trucizna` `stacks: 9` → 3 z ostrzeżeniem; `effects: [{ id: "trucizna", remaining: 0, stacks: 1 }]` → `LoadError`; `failedChecks: "x"` → `LoadError`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS (cały `npm test`, łącznie z e2e).
- [ ] **Step 5: Commit** `feat(zapis): format v4 z efektami i stanem rozmów`.

### Task 4: Warunki – nowe klucze i `evaluate(cond, state, data)`

**Files:**
- Modify: `src/engine/conditions.js`, `src/engine/loop.js`, `src/engine/data.js` (wywołania `validateCondition` z pełnymi `opts`)
- Test: `test/conditions.test.js`, `test/data.test.js`

**Interfaces:**
- Consumes: `getStats`, `countOf` (`src/systems/inventory.js`), `timeOfDay` (`src/engine/time.js`), `hasEffect` (Task 2).
- Produces:
  - `evaluate(cond, state, data)` – nowe klucze: `item` (tekst = ≥ 1 sztuka albo `{ id, qty }` = ≥ qty sztuk w torbie), `money` (całkowita; `character.money ≥ N`), `attribute: { id, gte }`, `skill: { id, gte }` (wartości końcowe `getStats`), `timeOfDay` (id albo niepusta lista id; bieżąca pora `timeOfDay(state.time.minutes, data.rules)`), `effect` (id aktywnego efektu). Bez postaci: `item`/`money`/`attribute`/`skill`/`effect` → `false`. Klucze łączą się jak dotąd (wszystkie muszą być spełnione), `all`/`any` rekurencyjnie.
  - `validateCondition(cond, path, opts)` – `opts`: `{ vars, attributes, skills, items, timesOfDay, effects }` (listy id); komunikaty: `…item: nieznany przedmiot "x"`, `…attribute.id: nieznany atrybut "x"`, `…skill.id: nieznana umiejętność "x"`, `…timeOfDay: nieznana pora "x"`, `…effect: nieznany efekt "x"`, `…money: oczekiwano liczby całkowitej ≥ 0`, `…attribute.gte: oczekiwano liczby całkowitej`. Gdy lista w `opts` nie podana – odwołanie nie jest sprawdzane (jak dziś `vars`).
  - Helper w `data.js`: `conditionOpts(data)` → pełne `opts`, używany wszędzie, gdzie walidowane są warunki (sceny `if`; Task 6 i 8 też go użyją).
  - `loop.js` woła `evaluate(scene.if, ctx.state, ctx.data)`.

- [ ] **Step 1: Testy (failing)** w `test/conditions.test.js`: każdy nowy klucz prawda/fałsz (`item` tekst i `{id, qty}`, `money` 30 vs 31, `attribute: { id: "sila", gte: 5 }` przy sile 5/6, `skill` z wartością z `getStats` i z efektem `podchmielenie` podbijającym `wymowa`, `timeOfDay: "swit"` o 6:30 i `["dzien","noc"]` o 6:30 → false, `effect`), brak postaci → false, kombinacja `{ money: 2, flag: "x" }`; walidacja każdego komunikatu; istniejące testy przechodzą na nowej sygnaturze. W `test/data.test.js`: scena z `if: { item: "brak" }` → `story.json › a › if.item: nieznany przedmiot "brak"`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(warunki): przedmioty, pieniądze, atrybuty, umiejętności, pora dnia i efekty`.

### Task 5: Akcje – `runActions`

**Files:**
- Create: `src/systems/actions.js`
- Test: `test/actions.test.js`

**Interfaces:**
- Consumes: `addItem`, `removeItem`, `countOf`, `freeCount`, `canAdd` (`inventory.js`), `addXp` (`src/systems/character.js`), `addVar` (`src/systems/vars.js`), `advanceTime` (z `rng`), `applyEffect`, `removeEffect` (Task 2).
- Produces:
  - `ACTION_KEYS = ["giveItem", "takeItem", "giveMoney", "takeMoney", "setFlag", "clearFlag", "addVar", "xp", "time", "addEffect", "removeEffect", "startCombat"]`.
  - `validateActions(actions, path, data)` → `string[]`: tablica obiektów z dokładnie jednym kluczem z `ACTION_KEYS` (`…[0]: oczekiwano jednej akcji`, `…[0].foo: nieznana akcja`); `giveItem`/`takeItem` – id albo `{ id, qty ≥ 1 }`, istniejący, nie `hidden`; `giveMoney`/`takeMoney`/`xp`/`time` – całkowite ≥ 1; `setFlag`/`clearFlag` – tekst; `addVar` – obiekt zmiennych z `rules.vars` z wartościami całkowitymi; `addEffect`/`removeEffect` – istniejący efekt, przy `addEffect` tylko `unit: "hour"`; `startCombat` – obiekt.
  - `runActions(state, data, actions, rng)` → `{ events, combat?: object }`. Zdarzenia: `{ type: "otrzymano", id, qty }`, `{ type: "oddano", id, qty }` (faktycznie oddane – odejmuje tylko wolne sztuki, do zera), `{ type: "pieniadze", delta }` (`takeMoney` do zera), `{ type: "flaga", id, value }`, `{ type: "zmienna", changes }`, `{ type: "xp", amount }`, zdarzenia z `advanceTime` dla `time`, `{ type: "efekt_nalozony", id }`, `{ type: "efekt_odparty", id }`, `{ type: "efekt_koniec", id }` (dla `removeEffect`, gdy zdjęty), `{ type: "za_ciezko", id, qty }` (gdy `canAdd` = false – przedmiot przepada). `startCombat` przerywa dalsze akcje i zwraca `combat` (obiekt z danych).

- [ ] **Step 1: Testy (failing)** – po jednym `test()` na akcję + walidacja każdego komunikatu; `takeItem` 3 opatrunków przy 2 → oddane 2; `takeItem` założonego miecza → oddane 0 (sztuka założona zostaje); `takeMoney 50` przy 30 → `money` 0, `delta` −30; `giveItem kolczuga` przy przeciążeniu (stan z ciężkim przedmiotem testowym) → `za_ciezko`, brak kolczugi; `xp 160` → awans rozpatrywany jak w `reward` (sprawdź `character.xp`); `time 120` → `time.minutes` +120 i zdarzenia tyknięć przy aktywnej truciźnie; `startCombat` w środku listy → akcje po nim się nie wykonują, wynik ma `combat`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(akcje): wspólne akcje dla rozmów i zdarzeń`.

### Task 6: System dialogów – dane, walidacja, logika

**Files:**
- Create: `src/systems/dialogue.js`, `data/dialogues/kwatermistrz.json` (wstępnie: minimalna poprawna rozmowa 2 węzły – pełna treść w Task 11)
- Modify: `src/engine/data.js` (ładowanie katalogu `data/dialogues/`, `validateDialogues`), `data/rules.json`, `test/helpers.js` (`dialogues` z prawdziwego katalogu)
- Test: `test/dialogue.test.js`, `test/data.test.js`

**Interfaces:**
- Consumes: `evaluate`, `validateCondition`, `conditionOpts` (Task 4), `validateActions`, `runActions` (Task 5), `getStats`, `advanceTime`.
- Produces:
  - `data.dialogues` – tablica rozmów (pliki `data/dialogues/*.json` posortowane po nazwie; `id` ≠ nazwa pliku → błąd `dialogues/<plik> › id: niezgodne z nazwą pliku`).
  - `rules.json`: `"dialogue": { "minutes": 10, "skillBase": 50, "attributeMult": 10, "chanceMin": 5, "chanceMax": 95 }` (wymagane; `chanceMin ≤ chanceMax`).
  - `validateDialogues(dialogues, data)` → `string[]` – wszystkie reguły z spec „Walidacja danych › dialogues/” (w tym `węzeł nieosiągalny` i `brak opcji zawsze dostępnej`: każdy węzeł z opcjami ma ≥ 1 opcję bez `requires` i bez `check`).
  - `checkChance(state, data, check)` → liczba 5–95 (wzory spec).
  - `optionKey(option, index)` → `option.id ?? String(index)`; `failedKey(dialogId, nodeId, key)` → `"<dialog>:<węzeł>:<key>"`.
  - `nodeView(state, data, dialogId, nodeId, { debug = false } = {})` → `{ speaker, text, isEnd, options: [{ key, label, check?: { name, difficulty, chance }, disabled, reason? }] }`: opcje z niespełnionym `requires` pominięte, chyba że `showLocked` (wtedy `disabled`, `reason: "dialogue.locked"`); nieudany wcześniej test → `disabled`, `reason: "dialogue.failed"`; `label` = tekst opcji (prefiks `[Handel 35]` dokłada UI z `check.name` i `check.difficulty`; `chance` tylko przy `debug`). `name` = nazwa umiejętności/atrybutu z danych.
  - `enterNode(state, data, dialogId, nodeId, rng)` → `{ events }` (akcje węzła przez `runActions`).
  - `chooseOption(state, data, dialogId, nodeId, key, rng)` → `{ next?: nodeId, end?: string, events, check?: { success, chance, roll }, combat? }`; opcja wyszarzona/ukryta → rzuca (błąd programisty); test: `rng.int(1, 100) ≤ chance`, porażka dopisuje `failedKey` do `world.failedChecks`; `goto: "end"` → `end: "end"`, `"end:zgoda"` → `end: "zgoda"`; akcje opcji wykonane po rzucie, przed przejściem; `combat` z `runActions` → `end: "walka"`, `combat`.
  - `finishDialogue(state, data, dialogId, result, rng)` → `{ events }`: `flags["dialog_<id>_<wynik>"] = true`, czas `minutes` (z pliku albo `rules.dialogue.minutes`) przez `advanceTime(…, rng)`.

- [ ] **Step 1: Testy (failing)** w `test/dialogue.test.js` na rozmowie testowej w kopii danych (węzły: start z opcjami `requires money`, `showLocked item`, `check skill`, `check attribute`, zwykłe `goto`, `end:zgoda`):
  - `nodeView` ukrywa opcję z `requires money 99`, pokazuje wyszarzoną `showLocked` z `reason`, etykieta testu ma `name` „Handel”, `difficulty` 35, bez `chance`; z `debug` – `chance` = `checkChance`.
  - `checkChance`: umiejętność 15, trudność 35 → 30; atrybut 5, trudność 40 → 60; trudność 0 przy umiejętności 100 → 95; trudność 150 → 5.
  - `chooseOption` z atrapą `int → chance` → sukces, `next` = `success`; `int → chance + 1` → porażka, `failedChecks` ma klucz, ponowny `nodeView` – opcja `disabled` z `dialogue.failed`; `chooseOption` na zablokowanej → rzuca.
  - akcje opcji (`takeMoney 2`, `addEffect podchmielenie`) wykonane, zdarzenia zwrócone; akcje węzła tylko w `enterNode`.
  - `finishDialogue(…, "zgoda")` → flaga `dialog_test_zgoda`, `time.minutes` +`minutes`.
  - walidacja (`test/data.test.js`): `start` nieistniejący; `goto: "brak"` → `dialogues/test.json › nodes.a.options[0].goto: nieznany węzeł "brak"`; opcja z `goto` i `check` naraz; `check` bez `id`; powtórzone `id` opcji; `check.skill: "latanie"`; `difficulty: 200`; nieznana akcja; `addEffect: "oslepienie"` (turowy); węzeł nieosiągalny; węzeł, którego jedyna opcja ma `check` → `dialogues/test.json › nodes.a: brak opcji zawsze dostępnej`; `id` ≠ nazwa pliku; prawdziwe dane → `[]`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(dialogi): dane rozmów, walidacja, testy umiejętności i wyniki`.

### Task 7: Komunikaty zdarzeń, pasek stanu i karta postaci z efektami

**Files:**
- Create: `src/ui/events.js`
- Modify: `src/ui/screen.js` (usunięcie `pushTimeNotices` – przeniesione; `statusBar`), `src/ui/character_screen.js`, `src/engine/loop.js`, `src/scenes/rest.js`, `src/ui/inventory_screen.js`, `data/ui.json`
- Test: `test/ui.test.js` (albo `test/events.test.js`), `test/prompt.test.js`

**Interfaces:**
- Consumes: zdarzenia z Task 2 i 5, `effectById`, `itemById`.
- Produces:
  - `pushEventNotices(ctx, events)` – jedna funkcja dla wszystkich typów: `zmiana_pory` → `time.change.<pora>` (jak dotąd, `dim`); `efekt_obrazenia` → `effect.tick` „{name}: −{damage} HP.” (`warn`); `efekt_koniec` → `effect.ended` „Mija: {name}.”; `efekt_nalozony` → `effect.applied` „Jesteś teraz: {name}.”; `efekt_odparty` → `effect.resisted` „Opierasz się: {name}.”; `otrzymano` → `event.got` „Otrzymujesz: {item} ×{qty}.” (bez `×1`); `oddano` → `event.gave` „Oddajesz: {item} ×{qty}.”; `pieniadze` → `event.moneyUp` „+{n} {currency}” / `event.moneyDown` „−{n} {currency}”; `xp` → `event.xp` „+{n} PD”; `za_ciezko` → `event.tooHeavy` „{item} się nie mieści – zostaje.”; `flaga` i `zmienna` – bez komunikatu. Gdy kolejka przekroczy 8 komunikatów z jednego wywołania – 8 + `event.more` „…i {n} więcej.”.
  - `pushTimeNotices` usunięte; wszystkie wywołania (`loop.js`, `rest.js`, `inventory_screen.js`) przechodzą na `pushEventNotices`.
  - `statusBar`: po HP efekty `hour` jako `[{name} {remaining}h]` (`status.effect`), najwyżej 3, potem `status.effectsMore` „+{n}”.
  - Karta postaci: sekcja `char.effects` „Efekty:” z liniami `char.effect` „{name} · zostało {remaining} {unit}” (+ ` ×{stacks}` gdy > 1; `unit` z `effect.unit.hour` „h” / `effect.unit.turn` „tur”), brak efektów – linia nie pojawia się; `sourceLabel` dla `kind: "effect"` → nazwa efektu.

- [ ] **Step 1: Testy (failing):** `pushEventNotices` – każdy typ daje dokładny tekst (przy `currency.short` = „gr”); 10 zdarzeń `efekt_obrazenia` → 8 komunikatów + „…i 2 więcej.”; `statusBar` z `podchmielenie` → zawiera `[Podchmielony 3h]`; z 4 efektami godzinowymi (kopia danych) → 3 + `+1`; karta postaci z `trucizna` ×2 → `Zatruty · zostało 4 h ×2`, rozbicie `wymowa` z `podchmielenie` → `+10 Podchmielony`; istniejące testy pory dnia przechodzą.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ui): komunikaty zdarzeń, efekty na pasku stanu i karcie postaci`.

### Task 8: Środki z efektami i rabaty w sklepie

**Files:**
- Modify: `src/systems/inventory.js` (`useConsumable`), `src/ui/inventory_screen.js`, `src/systems/shop.js`, `src/scenes/shop.js`, `src/engine/data.js` (`priceModifiers` w `SHOP_SCHEMA` + walidacja), `data/ui.json`
- Test: `test/inventory.test.js`, `test/shop.test.js`, `test/data.test.js`, `test/inventory_screen.test.js`

**Interfaces:**
- Consumes: `applyEffect`, `removeEffect` (Task 2), `evaluate`, `conditionOpts` (Task 4), `pushEventNotices` (Task 7).
- Produces:
  - `useConsumable(state, data, itemId, rng)` → dotychczasowy wynik + `effects: Event[]` (`efekt_koniec` dla każdego zdjętego z `removes`, `efekt_nalozony`/`efekt_odparty` dla `applies`); ekran ekwipunku przekazuje je do `pushEventNotices` (obok `inv.used`). Przy `heal` brak/`[0,0]` (bimber) – komunikat `inv.used` pomijany, gdy `healed` = 0 i przedmiot nie ma `heal`.
  - `priceAdjust(state, data, shopId)` → `{ buyPercent, sellPercent }` (suma spełnionych wpisów `priceModifiers`, brak → 0/0); `buyPrice(data, item, handel, adjust = { buyPercent: 0, sellPercent: 0 })`, `sellPrice(…)` analogicznie – wzory spec „Ceny z rabatem”; `buy`/`sell`/`sellable` liczą ceny z `priceAdjust`.
  - Walidacja `shops.json`: `priceModifiers[i].if` przez `validateCondition(…, conditionOpts(data))`; `buyPercent`/`sellPercent` całkowite −90…90, co najmniej jedno (`shops.json › s › priceModifiers[0]: wymagane buyPercent lub sellPercent`).
  - Nagłówek sklepu: gdy `buyPercent < 0` lub `sellPercent > 0` – dopisek `shop.discount` „(rabat)”.

- [ ] **Step 1: Testy (failing):** `useConsumable(opatrunek)` przy aktywnym `krwawienie` (nałożone ręcznie do `effects`) → efekt zdjęty, zdarzenie `efekt_koniec`; `useConsumable(bimber)` → `podchmielenie` aktywne; ceny: `value` 40, handel 0, `buyPercent` −10 → kupno 54, `sellPercent` +10 → sprzedaż 13 (`round(40 × 0.3 × 1.1)`); dwa spełnione wpisy −10 i −5 → −15; wpis z niespełnionym `if` ignorowany; `min(sell, buy)` nadal działa; walidacja `priceModifiers` (zły warunek, 95%, brak obu pól); ekran ekwipunku: użycie bimbru pokazuje „Jesteś teraz: Podchmielony.”.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(efekty): środki zdejmują i nakładają efekty; rabaty u kupca`.

### Task 9: Scena `effect` i sen zdejmujący zmęczenie

**Files:**
- Create: `src/scenes/effect.js`
- Modify: `src/scenes/index.js`, `src/scenes/schemas.js`, `src/engine/data.js` (walidacja sceny `effect`, wymaganie kreatora), `src/scenes/rest.js`
- Test: `test/scenes.test.js`, `test/data.test.js`

**Interfaces:**
- Consumes: `applyEffect`, `removeEffect`, `clearBySleep` (Task 2), `pushEventNotices` (Task 7).
- Produces: typ sceny `effect` (`add?: string[]`, `remove?: string[]`, `force?: boolean`; co najmniej jedno z `add`/`remove` – `story.json › e › effect: pusta scena efektu`; efekty istniejące – `… add[0]: nieznany efekt "x"`; w `add` tylko `hour` – `… add[0]: efekt "x" nie jest godzinowy`; wymaga wcześniejszego kreatora jak `reward`). Handler: najpierw `remove`, potem `add`; zdarzenia → `pushEventNotices`; bez czekania na Enter. `rest`: po pętli godzin `clearBySleep(state, data, hours)` → zdarzenia `efekt_koniec` do `pushEventNotices`.

- [ ] **Step 1: Testy (failing):** scena `{ add: ["zmeczenie"] }` → efekt aktywny, w następnym ekranie „Jesteś teraz: Zmęczony.”; `{ remove: ["zmeczenie"] }` → zdjęty, „Mija: Zmęczony.”; `{ add: ["trucizna"], force: true }` przy RNG odpornościowym sukcesie → nałożony; walidacja trzech komunikatów; `rest` 6 h ze `zmeczenie` → zdjęte, „Mija: Zmęczony.”; `rest` 8 h z `trucizna` ×3 przy HP 4 → HP na końcu ≥ 1, efekt zniknął po 4 h, komunikatów ≤ 9 (Review Focus 4).
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(efekty): scena efektu i sen zdejmujący zmęczenie`.

### Task 10: Scena `dialogue`

**Files:**
- Create: `src/scenes/dialogue.js`
- Modify: `src/scenes/index.js`, `src/scenes/schemas.js`, `src/engine/data.js` (scena `dialogue` → istniejąca rozmowa, wymaga kreatora; `onCombat` – obiekt), `data/ui.json`
- Test: `test/scenes.test.js`, `test/data.test.js`

**Interfaces:**
- Consumes: `nodeView`, `enterNode`, `chooseOption`, `finishDialogue` (Task 6), `pushEventNotices` (Task 7), `select` (`hotkey`), `pressEnter`, `showCharacter`, `campMenu`, `clear`, `flushNotices`, `statusBar`, `textWidth`, `wrap`/text helpers z `src/ui/text.js`, `ctx.debug`.
- Produces: typ sceny `dialogue` (`dialogue` wymagane; `onCombat` opcjonalny obiekt). Handler wg spec „Przepływ › Scena dialogue” (krok 0: `finishedDialogues` → `dialogue.done` „Ta rozmowa już się odbyła.” + `campMenu`; etykiety `[{name} {difficulty}] {text}` przez `dialogue.checkLabel` i z debug `dialogue.checkLabelDebug` „[{name} {difficulty} · {chance}%]”; wyszarzone z powodem w `hint` (`dialogue.failed` „(próba nieudana)”, `dialogue.locked` „(wymaga: {what})” – `what` to opis warunku: nazwa przedmiotu / `{n} {currency}`; dla innych warunków `dialogue.lockedOther` „(niedostępne)”); `[P] Postać` (`camp.character`, `hotkey: "p"`) → karta i powrót **bez** `enterNode`; węzeł końcowy → `pressEnter`; komunikaty `dialogue.success` „Udało się.” (`ok`) / `dialogue.failure` „Nie udało się.” (`warn`); koniec → `finishDialogue`, `scene.id` do `world.finishedDialogues`, `campMenu`; wynik `walka` → komunikat debug `dialogue.combatLater` „(walka – w cyklu C2)” tylko przy `ctx.debug`).

- [ ] **Step 1: Testy (failing)** (skryptowe IO bez TTY, rozmowa testowa w kopii danych, ustalone ziarno/atrapa RNG):
  - wybór numerem przechodzi między węzłami, tekst zawiera `speaker` i `[Handel 35]`; koniec → flaga `dialog_test_end`, `world.finishedDialogues` ma `scene.id`, potem obóz (`""` = Dalej).
  - nieudany test → po powrocie do węzła opcja z `(próba nieudana)` i `(niedostępne)` w linii.
  - `p` w środku rozmowy → karta postaci w tekście, `""`, ten sam węzeł; akcja węzła `takeMoney 2` wykonana **raz** (pieniądze −2, nie −4) (Review Focus 2).
  - zapis w obozie po rozmowie (`z`, `1`), `loadGame("1")`, ponowne uruchomienie sceny na wczytanym stanie → „Ta rozmowa już się odbyła.”, pieniądze/przedmioty bez zmian (Review Focus 1).
  - `--debug` (`ctx.debug = true`) → etykieta z `%`.
  - TTY: `<down>`, `<enter>` wybiera drugą opcję.
  - walidacja: nieznana rozmowa → `story.json › d › dialogue: nieznana rozmowa "x"`; brak kreatora przed sceną.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(dialogi): scena rozmowy z testami, kartą postaci i obozem`.

### Task 11: Demo – rozmowa z kwatermistrzem, rabat, bimber; e2e obu klas

**Files:**
- Modify: `data/dialogues/kwatermistrz.json` (pełna treść), `data/story.json`, `data/shops.json`, `test/e2e.test.js`, `test/cli.test.js` (sekwencja wejść)
- Test: `test/e2e.test.js`

**Interfaces:**
- Consumes: wszystko powyżej.
- Demo wg spec „Demo `story.json` po C1”: scena `demo_kram_rozmowa` (`dialogue: kwatermistrz`) między `demo_kram_wstep` a `demo_kram`; rozmowa 5–8 węzłów z opcjami **[Handel 35]** (sukces → `setFlag kwatermistrz_rabat`; porażka → zrzędzenie), **[Wymowa 40]** (sukces → `setFlag plotka_kurier`), „Nalej łyka” (`requires: { money: 2 }`, `takeMoney 2`, `addEffect podchmielenie`), „Patrz, jaki kaptur” (`requires: { item: "kaptur_mysliwego" }`, `showLocked: true`), „Bywaj.” (`end`); `speaker` „Kwatermistrz Dobrogost” (imię słowiańskie – zgodnie z „Styl i ton”; implementator może dobrać inne w tym stylu); teksty zrzędliwe, rubaszne, krótkie (2–4 zdania na węzeł). `kramarz_szkolny`: `priceModifiers: [{ "if": { "flag": "kwatermistrz_rabat" }, "buyPercent": -10, "sellPercent": 10 }]`, towar + `bimber` ×2.
- e2e (bez TTY, ziarno 7 – implementator ustala, jaki wynik daje targ przy tym ziarnie i dopasowuje asercje; jeśli ziarno 7 nie daje sukcesu targu dla klasy miecza, użyj ziarna, które daje, i opisz to w teście): klasa miecza – w rozmowie targ, „Nalej łyka”, „Bywaj.”; asercje: flaga rabatu zgodna z wynikiem, `podchmielenie` aktywne zaraz po rozmowie, pasek stanu zawiera `[Podchmielony`, w kramie cena opatrunku = `buyPrice` z rabatem (albo bez – zgodnie z flagą), po odpoczynku `demo_odpoczynek` efekt zniknął (3 h), `dialog_kwatermistrz_end`; klasa włóczni – „Bywaj.” od razu, reszta bez zmian (`equipped.bron === "para_wloczni"`, `vars.wola === 1`). Istniejące testy e2e/cli zaktualizowane tylko o nową scenę.

- [ ] **Step 1:** Testy e2e (failing). **Step 2:** FAIL. **Step 3:** dane demo. **Step 4:** PASS, `node bin/game.js --validate` czyste, ręczny przebieg `printf` przez potok (`node bin/game.js --seed 7`) bez błędu.
- [ ] **Step 5: Commit** `feat(demo): rozmowa z kwatermistrzem, rabat i bimber; e2e obu klas`.
