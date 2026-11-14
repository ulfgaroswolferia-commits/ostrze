# Broń dystansowa i ulepszenia: plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dać złotu i kowalom cel przez ulepszanie przedmiotów, a broni dystansowej rolę jednego mocnego strzału na walkę.

**Architecture:** Ulepszenie to zwykły przedmiot w `items.json`, a wymiana to opcja dialogu warsztatu. Oba rodzaje danych tworzy skrypt `tools/upgrades/generate.mjs`. Broń dystansowa zmienia się głównie przez dane, a kod dostaje jedną nową technikę (odskok ze strzałem) w osobnym pliku oraz drobne zmiany w formule trafienia, koszcie zmiany broni i dymie.

**Tech Stack:** Node.js (ESM), `node --test`, dane JSON, walidacja przez `node bin/game.js --validate`.

**Spec:** `docs/superpowers/specs/2026-11-02-bron-dystansowa-ulepszenia-design.md`

## Global Constraints

- Praca na gałęzi `cykl-bron-ulepszenia`, nie na `master`.
- Każdy commit kończy się linią `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Publikacja tylko z kopii `ostrze-gwiazd`, nigdy z tego repozytorium. Ten plan niczego nie publikuje.
- Teksty gry po polsku: naturalne, szorstkie, bez dziwnych metafor i pseudoaforyzmów. Wzorem jest ton istniejących dialogów kowali.
- Ładowanie w walce nigdy nie przekracza 6 PA.
- Ulepszona wersja waży dokładnie tyle co bazowa.
- Modyfikatory działają tylko z bronią w slocie `bron`.
- Błąd znaleziony przy wdrażaniu: najpierw skryptowa reprodukcja, po poprawce weryfikacja tą samą ścieżką.
- Po każdym zadaniu: `npm test` i `node bin/game.js --validate` przechodzą.

## Review Focus

- Gracz ma dwie sztuki przedmiotu, jedną założoną: wymiana zabiera wolną i nie zdejmuje założonej. Test w zadaniu 2.
- Gracz ma dokładnie tyle pieniędzy, ile kosztuje ulepszenie: wymiana się udaje, a stan konta to 0. Test w zadaniu 4.
- Lufa rozrywa się podczas odskoku: w ręku zostaje broń główna, a zapas jest pusty. Test w zadaniu 9.
- Odskok z pięściami albo parą włóczni: broń wraca do poprzedniego układu, a slot drugiej ręki się nie zmienia. Test w zadaniu 9.
- Stary zapis z pustą kuszą i amunicją: broń ładuje się po następnej walce, a zapis bez `loadedAmmo` wczytuje się bez ostrzeżeń. Testy w zadaniach 7 i 11.

---

# Etap 1: ulepszanie broni i pancerza

### Task 1: Ładowanie przy zakładaniu

**Files:**
- Modify: `src/systems/inventory.js` (`equip`, nowe funkcje)
- Test: `test/autoload.test.js`, poprawki w `test/combat_actions.test.js` i innych testach zakładających pustą broń przed walką

**Interfaces:**
- Produces: `loadWeapon(state, data, itemId): void` oraz `loadWorn(state, data): void`, obie w `inventory.js`.

- [ ] **Step 1: Napisz testy w `test/autoload.test.js`**

Stan jak w `mkState()` z `test/combat_actions.test.js`.

```js
test("założenie kuszy z bełtem ładuje ją i zużywa bełt", () => {
  addItem(state, data, "kusza_lekka", 1); addItem(state, data, "belt", 3);
  equip(state, data, "kusza_lekka", "bron_zapas");
  assert.equal(state.inventory.loaded.kusza_lekka, 1);
  assert.equal(countOf(state, "belt"), 2);
});
test("założenie bez amunicji zostawia broń pustą", () => {
  addItem(state, data, "kusza_lekka", 1);
  equip(state, data, "kusza_lekka", "bron");
  assert.equal(state.inventory.loaded.kusza_lekka ?? 0, 0);
});
test("założenie załadowanej broni nie zużywa amunicji", () => {
  addItem(state, data, "kusza_lekka", 1); addItem(state, data, "belt", 3);
  state.inventory.loaded.kusza_lekka = 1;
  equip(state, data, "kusza_lekka", "bron");
  assert.equal(countOf(state, "belt"), 3);
});
```

- [ ] **Step 2: Uruchom:** `node --test test/autoload.test.js`. Oczekiwane: FAIL, broń nie jest załadowana.

- [ ] **Step 3: Zaimplementuj.** `loadWeapon` dopełnia `loaded[id]` do `reload.capacity` z dostępnej amunicji i nic nie robi dla broni bez `reload`. `loadWorn` wywołuje ją dla slotów `bron` i `bron_zapas`. `equip` wywołuje `loadWeapon` po założeniu do tych dwóch slotów. W walce gra nie używa `equip`, tylko `swapWeapons`, której to nie dotyczy.

- [ ] **Step 4: Uruchom:** `npm test`. Popraw testy, które zakładają pustą broń po założeniu, ustawiając jawnie `state.inventory.loaded[id] = 0`. Oczekiwane: PASS.

- [ ] **Step 5: Commit:** `feat: broń ładuje się przy zakładaniu`

### Task 2: Akcja zdejmowania i warunek braku pieniędzy

**Files:**
- Modify: `src/systems/actions.js`, `src/engine/conditions.js`
- Test: `test/upgrades.test.js`

**Interfaces:**
- Produces: akcja `{ "unequipItem": "<id>" }` oraz warunek `{ "moneyBelow": <n> }`.

- [ ] **Step 1: Napisz testy**

```js
test("unequipItem zdejmuje jedyną sztukę", () => {
  runActions(state, data, [{ unequipItem: "miecz_krotki" }], rng);
  assert.equal(state.inventory.equipped.bron, undefined);
  assert.equal(countOf(state, "miecz_krotki"), 1);
});
test("unequipItem nie zdejmuje, gdy jest wolna sztuka", () => {
  addItem(state, data, "miecz_krotki", 1);
  runActions(state, data, [{ unequipItem: "miecz_krotki" }, { takeItem: "miecz_krotki" }], rng);
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(countOf(state, "miecz_krotki"), 1);
});
test("moneyBelow", () => {
  state.character.money = 10;
  assert.equal(evaluate({ moneyBelow: 11 }, state, data), true);
  assert.equal(evaluate({ moneyBelow: 10 }, state, data), false);
});
test("walidacja odrzuca zły unequipItem i moneyBelow", () => { /* nieznany przedmiot; moneyBelow = "x" dają błędy */ });
```

- [ ] **Step 2: Uruchom:** `node --test test/upgrades.test.js`. Oczekiwane: FAIL, nieznana akcja.

- [ ] **Step 3: Zaimplementuj.** Dodaj `unequipItem` do `ACTION_KEYS` z walidacją przez `validateItemRef` (tylko string id). Wykonanie: gdy `freeCount(state, id) < 1`, zdejmij pierwszy slot z tym przedmiotem przez `unequip`. Dodaj `moneyBelow` do `evaluateCharacter` i walidacji obok `money`.

- [ ] **Step 4: Uruchom:** `npm test`. Oczekiwane: PASS.

- [ ] **Step 5: Commit:** `feat: akcja zdejmowania przedmiotu i warunek moneyBelow`

### Task 3: Generator przedmiotów ulepszonych

**Files:**
- Create: `tools/upgrades/generate.mjs`, `tools/upgrades/recipes.mjs`
- Modify: `data/items.json` (wynik generatora)
- Test: `test/upgrades_data.test.js`

**Interfaces:**
- Produces: identyfikatory `<id>_u1` i `<id>_u2`. Eksport `CHAINS` z `recipes.mjs`: `[{ base, from, to, stage, cost, kind, label }]`.

**Zasady generatora.** Zakres to broń bez `hidden`, bez `offhand`, bez `masteryType: "luk"` oraz pancerz o `slot: "tulow"`, razem 27 przedmiotów. Ulepszona wersja kopiuje wszystkie pola bazowego przedmiotu:

| Rodzaj | Warunek | Stopień 1 | Stopień 2 |
|---|---|---|---|
| biała | `range: "melee"` | nazwa `(uchwyt)`, `modifiers[skill] +5` | `(uchwyt, ostrzony)`, `armorPierce +1` |
| palna | `misfireChance` obecne | `(muszka)`, `modifiers[skill] +5` | `(muszka, spust)`, `misfireChance −3`, minimum 1 |
| kusza | `masteryType: "kusza"` | `(łoże)`, `modifiers[skill] +5` | `(łoże, ramię)`, `armorPierce +1` |
| pancerz | `slot: "tulow"` | `(skóra)`, każdy typ w `reduction +5` | `(skóra, płyty)`, usuń `modifiers.ap`, jeśli ujemne, inaczej każdy typ w `reduction +5` |

Cena: `cost1 = ceil(value × 0,5)`, `cost2 = value`. Wartość: `value + cost1` oraz `value + cost1 + cost2`. Opis: opis bazowy i jedno krótkie zdanie o przeróbce, zapisane w `recipes.mjs` dla każdego rodzaju i stopnia.

- [ ] **Step 1: Napisz testy w `test/upgrades_data.test.js`** (na prawdziwych danych, z `CHAINS`)

```js
test("27 łańcuchów po 2 stopnie", () => assert.equal(CHAINS.length, 54));
test("każdy przedmiot istnieje, waży tyle co bazowy i jest droższy od poprzedniego", () => { /* dla każdego wpisu CHAINS */ });
test("drugi stopień bierze przedmiot po pierwszym", () => {
  for (const c of CHAINS.filter((x) => x.stage === 2)) assert.equal(c.from, `${c.base}_u1`);
});
test("miecz krótki", () => {
  const u1 = itemById(data, "miecz_krotki_u1"), u2 = itemById(data, "miecz_krotki_u2");
  assert.equal(u1.modifiers.sieczna, 5);
  assert.equal(u2.modifiers.sieczna, 5);
  assert.equal(u2.armorPierce, 1);
});
test("kolczuga traci karę PA dopiero na drugim stopniu", () => {
  assert.equal(itemById(data, "kolczuga_u1").modifiers.ap, -1);
  assert.equal(itemById(data, "kolczuga_u2").modifiers.ap, undefined);
});
test("pistolet: mniej niewypałów na drugim stopniu", () => assert.equal(itemById(data, "pistolet_skalkowy_u2").misfireChance, 12));
```

- [ ] **Step 2: Uruchom:** `node --test test/upgrades_data.test.js`. Oczekiwane: FAIL, brak modułu.

- [ ] **Step 3: Zaimplementuj `recipes.mjs` i `generate.mjs`.** Generator najpierw usuwa z `items.json` wpisy `_u1` i `_u2`, a potem dopisuje je od nowa, więc można go uruchamiać wielokrotnie. Zachowuje formatowanie JSON z dwiema spacjami.

- [ ] **Step 4: Uruchom:** `node tools/upgrades/generate.mjs && npm test && node bin/game.js --validate`. Oczekiwane: PASS. Testy liczące przedmioty popraw tylko wtedy, gdy liczą wszystkie przedmioty, a nie konkretną kategorię treści. Ulepszeń nie dodawaj do sklepów ani łupów.

- [ ] **Step 5: Commit:** `feat: generator i dane ulepszonych przedmiotów`

### Task 4: Warsztaty

**Files:**
- Modify: `tools/upgrades/generate.mjs`, `data/travel.json`
- Create (z generatora): `data/dialogues/ulepszenia_zbych.json`, `ulepszenia_bogdan.json`, `ulepszenia_polowa.json`, `ulepszenia_brygida.json`, `ulepszenia_szkarad.json`
- Test: `test/upgrades_workshops.test.js`

**Interfaces:**
- Consumes: `CHAINS`, akcja `unequipItem`, warunek `moneyBelow`.

**Oferta warsztatów:**

| Dialog | Biała, pancerz | Kusza | Palna |
|---|---|---|---|
| `ulepszenia_zbych`, `ulepszenia_bogdan` | stopień 1 | brak | brak |
| `ulepszenia_polowa` | stopnie 1–2 | stopnie 1–2 | stopień 1 |
| `ulepszenia_brygida` | stopnie 1–2 | stopnie 1–2 | brak |
| `ulepszenia_szkarad` | brak | brak | stopnie 1–2 |

**Budowa dialogu.** Węzeł `warsztat` ma jedną linię rzemieślnika, dla każdej wymiany dwie opcje oraz zawsze widoczną opcję wyjścia:

```json
{ "id": "u_miecz_krotki_u1", "text": "Krótki miecz: uchwyt (20 gr)", "requires": { "item": "miecz_krotki", "money": 20 },
  "actions": [{ "unequipItem": "miecz_krotki" }, { "takeItem": "miecz_krotki" }, { "takeMoney": 20 }, { "giveItem": "miecz_krotki_u1" }], "goto": "zrobione" }
{ "id": "b_miecz_krotki_u1", "text": "Krótki miecz: uchwyt (20 gr)", "requires": { "item": "miecz_krotki", "moneyBelow": 20 }, "goto": "bez_groszy" }
```

Węzeł `zrobione` przypomina o założeniu przedmiotu, np. „Masz. Tylko załóż, zanim ktoś ci da w łeb.” i wraca do `warsztat`. Węzeł `bez_groszy` odmawia i wraca. Teksty dla każdego warsztatu pisze się osobno, w tonie jego dialogów.

**Miejsca.** Do `data/travel.json` dodaj spot `{ id: "ulepszenia", name: "...: ulepszenia", type: "scene", scenes: [{ id: "ulepszenia_<warsztat>_scena", type: "dialogue", dialogue: "ulepszenia_<warsztat>" }] }` w `wilczy_brod` (Zbych), `gluszec`, `oboz_wronia` i `obserwatorium`. Spot Szkarada w `wilczy_brod` ma `id: "szkarad_ulepszenia"` i taki sam warunek ujawnienia jak obecny spot `szkarad`, czyli `secret: true` i ujawnienie tym samym działaniem co `szkarad`. Sprawdź to w danych przed zapisem.

- [ ] **Step 1: Napisz testy**

```js
test("wymiana zabiera założony miecz i pieniądze, nowy trafia do plecaka", () => {
  state.character.money = 20;
  chooseOption(state, data, "ulepszenia_zbych", "u_miecz_krotki_u1", rng);
  assert.equal(state.inventory.equipped.bron, undefined);
  assert.equal(countOf(state, "miecz_krotki"), 0);
  assert.equal(countOf(state, "miecz_krotki_u1"), 1);
  assert.equal(state.character.money, 0);
});
test("za mało pieniędzy: nic się nie zmienia, odmowa", () => { /* money 19, opcja b_ widoczna, opcja u_ ukryta */ });
test("drugi stopień niedostępny bez pierwszego", () => { /* ulepszenia_polowa: brak u_miecz_krotki_u2, dopóki gracz ma tylko miecz_krotki */ });
test("Zbych nie ma drugiego stopnia, Szkarad nie ma miecza", () => { /* po identyfikatorach opcji w danych */ });
test("Kuźnia polowa robi muszkę, ale nie spust", () => { /* jest u_pistolet_skalkowy_u1, brak u_pistolet_skalkowy_u2 */ });
test("broń w zapasie też podlega wymianie", () => { /* założona w bron_zapas: slot pusty po wymianie */ });
```

`chooseOption` oznacza funkcję wyboru opcji z `src/systems/dialogue.js`. Użyj tej, której używają istniejące testy dialogów.

- [ ] **Step 2: Uruchom:** `node --test test/upgrades_workshops.test.js`. Oczekiwane: FAIL, brak dialogów.

- [ ] **Step 3: Rozbuduj generator o dialogi i dodaj spoty.**

- [ ] **Step 4: Uruchom:** `node tools/upgrades/generate.mjs && npm test && node bin/game.js --validate`. Oczekiwane: PASS.

- [ ] **Step 5: Sprawdź w prawdziwej grze** skryptem przechodzącym przez Wilczy Bród: rozmowa, wymiana, założenie, walka ulepszoną bronią. Oczekiwane: w walce trafienie jest o 5 punktów wyższe.

- [ ] **Step 6: Commit:** `feat: wymiana u kowali i warsztaty ulepszeń`

---

# Etap 2: walka bronią dystansową

### Task 5: Dane broni i formuła trafienia

**Files:**
- Modify: `data/items.json`, `src/systems/items.js` (schemat), `src/systems/combat/formulas.js`, `src/systems/combat/strike.js`
- Test: `test/ranged_weapons.test.js`

**Interfaces:**
- Produces: pola broni `hitFar`, `hitClose`, `noMeleePenalty`, `retreatShotAp`. Opcja `pointBlank` w `strike` i `playerHitChance`.

**Dane:**

| Broń | `apCost` | `reload.apCost` | `hitFar` | `hitClose` | `noMeleePenalty` | `retreatShotAp` |
|---|---|---|---|---|---|---|
| `kusza_lekka` | 3 | 6 | 0 | 15 | true | 5 |
| `kusza_zolnierska`, `kusza_cesarska` | 3 | 6 | 15 | 15 | false | 6 |
| `pistolet_skalkowy`, `pistolet_wojskowy` | 3 | 6 | 10 | 10 | true | 5 |
| `rusznica` | 4 | 6 | 10 | 10 | false | 6 |

Każda z tych broni dostaje `"effects": [{ "id": "spowolnienie", "chance": 50 }]`. `kusza_lekka` dostaje nowy opis i `value: 60`. Łuki bez zmian.

- [ ] **Step 1: Napisz testy.** Postać jak w `mkState()`, południe, `bandyta` o obronie 10.

```js
test("szansa trafienia broni dystansowych", () => {
  const cases = [
    ["kusza_lekka", "far", 35], ["kusza_lekka", "melee", 50],
    ["kusza_zolnierska", "far", 50], ["kusza_zolnierska", "melee", 30],
    ["pistolet_skalkowy", "far", 46], ["pistolet_skalkowy", "melee", 46],
    ["rusznica", "far", 46], ["rusznica", "melee", 26],
  ];
  for (const [id, band, want] of cases) { /* enemy.band = band; assert.equal(playerHitChance(...), want) */ }
});
test("pointBlank: cel na dystansie, ale liczy się bliska premia", () => { /* kusza_lekka, band far, { pointBlank: true } → 50 */ });
test("łuk bez zmian", () => { /* apCost 4, reload 1, kara −20 w zwarciu */ });
test("żadne ładowanie nie przekracza 6 PA", () => { /* wszystkie bronie z reload */ });
test("trafienie może spowolnić", () => { /* strike z fixed(1): efekt spowolnienie na wrogu, jeśli wróg przeżył */ });
```

- [ ] **Step 2: Uruchom:** `node --test test/ranged_weapons.test.js`. Oczekiwane: FAIL.

- [ ] **Step 3: Zaimplementuj.** Dodaj pola do schematu `weapon` w `items.js`. W `playerHitChance` dodaj dla broni dystansowej `(enemy.band === "melee" || pointBlank ? weapon.hitClose : weapon.hitFar) ?? 0`, a `rangedInMeleePenalty` pomijaj przy `weapon.noMeleePenalty`. `strike` przekazuje `pointBlank` do `playerHitChance`. Pole `used` z `strike` zachowuje te wartości, bo rozwija `weapon`.

- [ ] **Step 4: Uruchom:** `node tools/upgrades/generate.mjs && npm test && node bin/game.js --validate`. Popraw testy, które zapisały dawne koszty kusz i broni palnej. Oczekiwane: PASS.

- [ ] **Step 5: Commit:** `feat: nowe koszty, celność i spowolnienie broni dystansowej`

### Task 6: Tania zmiana broni

**Files:**
- Modify: `data/rules.json`, `src/systems/combat/actions.js`, schemat zasad, jeśli jest ścisły
- Test: `test/combat_actions.test.js`

**Interfaces:**
- Produces: `rules.combat.swapRangedAp = 1`; `swapCost(state, data): number` eksportowane z `actions.js`.

- [ ] **Step 1: Napisz testy**

```js
test("zmiana z bronią dystansową kosztuje 1 PA, w obie strony", () => { /* miecz↔kusza_lekka: apCost 1 przed i po zmianie */ });
test("zmiana dwóch broni białych kosztuje 2 PA", () => { /* miecz↔para_wloczni */ });
```

- [ ] **Step 2: Uruchom:** `node --test test/combat_actions.test.js`. Oczekiwane: FAIL.

- [ ] **Step 3: Zaimplementuj `swapCost`.** Zwraca `swapRangedAp`, gdy `bron` albo `bron_zapas` ma pole `reload`, inaczej `swapAp`. Użyj jej w `playerActions` i `doAction`.

- [ ] **Step 4: Uruchom:** `npm test`. Oczekiwane: PASS.

- [ ] **Step 5: Commit:** `feat: tańsza zmiana na broń dystansową`

### Task 7: Ładowanie po walce

**Files:**
- Modify: `src/systems/combat/turn.js`
- Test: `test/autoload.test.js`

**Interfaces:**
- Consumes: `loadWorn(state, data)`.

- [ ] **Step 1: Napisz testy**

```js
test("po wygranej broń w ręku i zapasie jest załadowana", () => { /* loaded 0, 2 bełty, finishCombat → loaded 1, bełty 1 */ });
test("po ucieczce też", () => { /* outcome fled */ });
test("bez amunicji broń zostaje pusta, a walka kończy się normalnie", () => { /* bez wyjątku */ });
test("stary zapis: pusta kusza i bełty ładują się po następnej walce", () => { /* inventory bez wpisu loaded dla kuszy */ });
test("bełt z łupu ładuje broń jeszcze po tej samej walce", () => { /* loadWorn po wypłacie łupów */ });
```

- [ ] **Step 2: Uruchom:** `node --test test/autoload.test.js`. Oczekiwane: FAIL.

- [ ] **Step 3: Wywołaj `loadWorn` na końcu `finishCombat`**, po łupach, dla każdego wyniku walki.

- [ ] **Step 4: Uruchom:** `npm test`. Oczekiwane: PASS.

- [ ] **Step 5: Commit:** `feat: broń ładuje się po walce`

### Task 8: Dym

**Files:**
- Modify: `data/items.json`, `data/effects.json`, `data/rules.json`, `src/systems/combat/ai.js`, `src/systems/combat/formulas.js`
- Test: `test/ranged_smoke.test.js`

**Interfaces:**
- Produces: `rules.combat.smokeEnterPenalty = 15`; pole przejściowe `enemy.enteredSmoke`.

**Dane:** `smoke: 100` dla `pistolet_skalkowy`, `pistolet_wojskowy` i `rusznica`. `zadymienie.modifiers.fleeChance: 20`. Reszta efektu bez zmian.

- [ ] **Step 1: Napisz testy**

```js
test("strzał zawsze daje dym, niewypał nie", () => { /* fireWeapon: fixed(100) → dym; seq z niewypałem → brak */ });
test("wróg wchodzący przez dym ma −15 w tej turze", () => { /* bandyta na dystansie, dym na polu; enemyTurn: chance pierwszego ataku = bazowa − 15 */ });
test("wróg stojący już w zwarciu bije normalnie", () => { /* band melee, dym: chance bazowa */ });
test("kara znika po turze wroga", () => { /* enemy.enteredSmoke falsy po enemyTurn */ });
test("bez dymu wejście nie ma kary", () => { /* brak zadymienia */ });
test("strzał wroga z dystansu dalej ma −35", () => { /* attack.range far */ });
test("ucieczka w dymie ma +20", () => { /* fleeChance rośnie o 20 */ });
```

- [ ] **Step 2: Uruchom:** `node --test test/ranged_smoke.test.js`. Oczekiwane: FAIL.

- [ ] **Step 3: Zaimplementuj.** W `relocate` w `enemyTurn` ustaw `enemy.enteredSmoke = true` przy wejściu w zwarcie, gdy `combat.battlefield` zawiera `zadymienie`. Na końcu `enemyTurn`, także przy wczesnym wyjściu z pętli, usuń to pole. W `enemyHitChance` odejmij `smokeEnterPenalty` dla ataku wręcz przy ustawionym polu.

- [ ] **Step 4: Uruchom:** `node tools/upgrades/generate.mjs && npm test && node bin/game.js --validate`. Popraw test świecy dymnej i testy broni palnej oczekujące dawnych wartości. Oczekiwane: PASS.

- [ ] **Step 5: Commit:** `feat: pewny dym i kara przy wejściu w zwarcie`

### Task 9: Odskok ze strzałem

**Files:**
- Create: `src/systems/combat/retreat_shot.js`
- Modify: `src/systems/combat/actions.js`, `src/systems/combat/techniques.js`, `data/ui.json`
- Test: `test/retreat_shot.test.js`

**Interfaces:**
- Consumes: `isFirearm`, `fireWeapon`, `strike`, `swapWeapons`, `cannotMove`, `blockedSkill`, pola `retreatShotAp`, `pointBlank`.
- Produces: `retreatShotOption(state, data, combat): { apCost, reason? } | null` oraz `doRetreatShot(state, data, combat, uid, rng): object[]`. Eksport `stepBackAttack(state, data, combat, enemy, rng): object[]` z `actions.js`. Technika `id: "odskok"`.

- [ ] **Step 1: Napisz testy.** Miecz w ręku, pistolet załadowany w zapasie, wróg `bandyta` w zwarciu, 7 PA.

```js
test("pełny przebieg: 5 PA, wróg na dystansie, miecz w ręku, pistolet pusty", () => {
  const r = doAction(state, data, combat, { id: "odskok", target: "bandyta#1" }, fixed(100));
  assert.equal(r.ok, true);
  assert.equal(combat.playerAp, 2);
  assert.equal(enemy.band, "far");
  assert.equal(state.inventory.equipped.bron, "miecz_krotki");
  assert.equal(state.inventory.equipped.bron_zapas, "pistolet_skalkowy");
  assert.equal(state.inventory.loaded.pistolet_skalkowy, 0);
});
test("rusznica kosztuje 6 PA", () => {});
test("darmowy atak: atakuje tylko wskazany, ogłuszony nie atakuje", () => {});
test("pozostali wrogowie zostają w zwarciu", () => {});
test("modyfikatory broni z zapasu działają przy strzale", () => { /* pistolet_skalkowy_u1: atak.chance o 5 wyższa */ });
test("lekka kusza używa bliskiej premii", () => { /* atak.chance 50 mimo band far */ });
test("gracz ginie od darmowego ataku: brak strzału, pistolet dalej załadowany", () => {});
test("rozerwanie lufy: w ręku miecz, zapas pusty, pistoletu nie ma", () => {
  // seq([100, 1, 1, 1]): pudło wroga, niewypał, rozerwanie, obrażenia
});
test("pięści: bron pusta przed i po, pistolet w zapasie", () => {});
test("para włóczni wraca do ręki, a drugiej ręki to nie rusza", () => {});
test("wrogowie wracają przez gotowość: darmowy cios przy wejściu", () => { /* techniczna gotowość po odskoku, enemyTurn → reaction */ });
test("brak dostępu z powodu", () => {
  // pusta broń, łuk w zapasie (brak retreatShotAp), wróg na dystansie, spowolnienie gracza,
  // za mało PA, zablokowana umiejętność: po jednym przypadku, reason = klucz ui
});
```

- [ ] **Step 2: Uruchom:** `node --test test/retreat_shot.test.js`. Oczekiwane: FAIL.

- [ ] **Step 3: Zaimplementuj.**
  - Wydziel z `move` w `actions.js` funkcję `stepBackAttack`. Zachowanie kroku w tył się nie zmienia.
  - `retreatShotOption` zwraca `null`, gdy w zapasie nie ma broni z `retreatShotAp`. Inaczej zwraca koszt i ewentualny powód blokady: `combat.notLoaded`, `combat.noTarget`, `combat.slowed`, `combat.noAp`, `combat.blockedByPhenomenon`.
  - `doRetreatShot` działa w kolejności ze specu A5. Odejmij PA, wykonaj `stepBackAttack` i przerwij, gdy `hp <= 0`. Zmień `band`, dodaj zdarzenie `ruch`, wykonaj `swapWeapons`, strzel przez `fireWeapon` albo `strike` z `pointBlank: true`, a na końcu wykonaj `swapWeapons`.
  - Po rozerwaniu `bron` jest puste, więc druga zamiana sama odda broń główną. Sprawdza to test.
  - Dodaj `odskok` do `TECHNIQUE_IDS`, `targetsOf` (wrogowie w zwarciu), `techniqueActions` i `doTechnique`. Zależność `techniques.js` ↔ `actions.js` jest cykliczna, ale działa, bo funkcji używa się dopiero przy wywołaniu.

- [ ] **Step 4: Dodaj teksty do `data/ui.json`:** `combat.tech.odskok` „Odskok ze strzałem”, `combat.techDesc.odskok` z informacją o darmowym ataku wskazanego wroga.

- [ ] **Step 5: Uruchom:** `npm test && node bin/game.js --validate`. Oczekiwane: PASS.

- [ ] **Step 6: Sprawdź w prawdziwej grze** skryptem przez ekran walki: menu technik, wybór celu, komunikaty, a potem darmowy cios z gotowości. Oczekiwane: lista technik pokazuje koszt, a dziennik czytelnie opisuje przebieg.

- [ ] **Step 7: Commit:** `feat: odskok ze strzałem`

### Task 10: Pomiar balansu

**Files:**
- Create: `tools/balance/ranged_sim.mjs`
- Modify: wartości w danych, tylko jeśli pomiar to uzasadni

- [ ] **Step 1: Napisz symulator.** Uruchamia prawdziwe `doAction` i `enemyTurn` po 2000 walk na scenę z ziarnem, na ścieżce gracza z pliku: `node tools/balance/ranged_sim.mjs <zapis> [--stan przed|po]`. Strategie: sam miecz, strzał na początku, odskok ze strzałem przy 1–2 wrogach. Wynik: wygrane, utracone HP, liczba tur.

- [ ] **Step 2: Zmierz na prawdziwym zapisie gracza, z wydarzeniami włączonymi,** na wersji sprzed zmian (`master`) i po zmianach.

- [ ] **Step 3: Sprawdź progi ze specu:**
  - miecz bije lekką kuszę w ciągłej walce z lekko opancerzonymi;
  - odskok nie jest lepszy niż miecz w każdej scenie, a przy wrogach z pancerzem do 2 tura odskoku zadaje mniej niż dwukrotność obrażeń tury z dwoma ciosami mieczem;
  - strzał nie obniża straty HP o więcej niż 25% względem miecza w scenach bez strzelców;
  - w scenach ze strzelcami wyniki nie są gorsze niż przed zmianami;
  - zatrzymanie wroga spowolnieniem nie przekracza 3 tur z rzędu w ponad 5% walk.

Progi w liczbach to założenia planu. Jeśli wyjdą poza nie, zgłoś to użytkownikowi z wynikami i propozycją zmiany danych, zamiast zmieniać balans po cichu.

- [ ] **Step 4: Commit:** `test: symulacja balansu broni dystansowej`

---

# Etap 3: bełty

### Task 11: Rodzaje amunicji

**Files:**
- Modify: `data/items.json`, `src/systems/items.js`, `src/systems/inventory.js`, `src/systems/combat/actions.js`, `src/engine/save.js`
- Test: `test/ammo_kinds.test.js`, `test/save.test.js`

**Interfaces:**
- Produces: pole amunicji `ammoOf: "belt"`, `damageBonus`, `explosive`. Funkcja `pickAmmo(state, data, weapon): string | null` i `loadedAmmoOf(state, weapon): string`. Stan `inventory.loadedAmmo: { [weaponId]: ammoId }` i `inventory.loadExplosive: boolean`.

**Dane:** `belt_wzmocniony` (`ammoOf: "belt"`, `damageBonus: 1`, `value: 5`), `belt_wybuchowy` (`ammoOf: "belt"`, `damageBonus: 1`, `explosive: true`, `value: 10`).

- [ ] **Step 1: Napisz testy**

```js
test("kusza ładuje najlepszy dostępny bełt", () => { /* zwykły + wzmocniony → wzmocniony */ });
test("wybuchowy tylko po włączeniu przełącznika", () => { /* loadExplosive false → wzmocniony; true → wybuchowy */ });
test("sam wybuchowy przy wyłączonym przełączniku nie ładuje się", () => {});
test("pusty zapas: reload niedostępny z combat.noAmmo", () => {});
test("stary zapis bez loadedAmmo wczytuje się bez ostrzeżeń i liczy jako zwykły bełt", () => {});
test("nieznany bełt w loadedAmmo jest naprawiany i zgłaszany", () => {});
test("pistolet nie bierze bełtów", () => {});
```

- [ ] **Step 2: Uruchom:** `node --test test/ammo_kinds.test.js`. Oczekiwane: FAIL.

- [ ] **Step 3: Zaimplementuj.** `pickAmmo` wybiera spośród przedmiotów z `reload.ammo` albo `ammoOf === reload.ammo`, z kolejnością: wybuchowy przy włączonym przełączniku, wzmocniony, zwykły. Zastąp bezpośrednie `countOf(reload.ammo)` w `actions.js`. `loadWeapon` i przeładowanie w walce zapisują `loadedAmmo`. W `save.js` dodaj oba pola jako opcjonalne oraz naprawę nieznanych identyfikatorów w sekcji „loaded weapons”.

- [ ] **Step 4: Uruchom:** `npm test && node bin/game.js --validate`. Oczekiwane: PASS.

- [ ] **Step 5: Commit:** `feat: rodzaje bełtów i zapamiętany ładunek`

### Task 12: Działanie bełtów

**Files:**
- Create: `src/systems/combat/explosive.js`
- Modify: `src/systems/combat/strike.js`, `data/rules.json`, `data/ui.json`, `src/ui/events.js`
- Test: `test/explosive_bolts.test.js`

**Interfaces:**
- Consumes: `loadedAmmoOf`.
- Produces: `explode(state, data, combat, target, { hit }, rng): object[]`. Zasady `rules.combat.explosive = { fragDamage: [4, 8], slowChance: 30, missBurstChance: 50, selfDamage: [4, 8] }`.

- [ ] **Step 1: Napisz testy**

```js
test("wzmocniony: +1 do obrażeń", () => {});
test("trafienie wybuchowym rani wrogów w tej samej strefie i nie rani odległych", () => {});
test("odłamki liczą pancerz i mogą spowolnić", () => {});
test("pudło: połowa szans, same odłamki, sam cel też obrywa odłamkiem", () => {});
test("cel w zwarciu: odłamki ranią bohatera", () => {});
test("cel na dystansie: bohater bez obrażeń", () => {});
test("po śmierci celu odłamki i tak lecą, a zabicie odłamkiem daje biegłość kuszy", () => {});
test("po strzale wpis loadedAmmo znika", () => {});
```

- [ ] **Step 2: Uruchom:** `node --test test/explosive_bolts.test.js`. Oczekiwane: FAIL.

- [ ] **Step 3: Zaimplementuj.** `strike` odczytuje amunicję przed zużyciem, dodaje `damageBonus` do premii obrażeń, usuwa wpis `loadedAmmo`, a przy `explosive` po rozstrzygnięciu ciosu dokłada `explode`. Trafienie w `strike` nie może zwracać wyniku przed wybuchem, więc wcześniejsze `return` przy pudle i śmierci celu trzeba objąć tą ścieżką. Nowe zdarzenie `wybuch` ma tekst w `data/ui.json` i obsługę w `src/ui/events.js`.

- [ ] **Step 4: Uruchom:** `npm test && node bin/game.js --validate`. Oczekiwane: PASS.

- [ ] **Step 5: Commit:** `feat: bełty wzmocnione i wybuchowe`

### Task 13: Wymiana bełtów i przełącznik

**Files:**
- Modify: `tools/upgrades/recipes.mjs`, `tools/upgrades/generate.mjs`, `src/ui/inventory_screen.js`, `data/ui.json`
- Test: `test/upgrades_workshops.test.js`, `test/inventory_screen.test.js`

Wymiana odbywa się paczkami po 10 sztuk, w warsztatach z kuszami. Bełt zwykły na wzmocniony kosztuje 20 gr, a wzmocniony na wybuchowy 100 gr. Łącznie z ceną zwykłego bełtu (około 3 gr) wychodzi około 15 gr za wybuchowy, czyli więcej niż około 9 gr za kulę.

- [ ] **Step 1: Napisz testy**

```js
test("10 bełtów + 20 gr → 10 wzmocnionych", () => {});
test("przy 9 bełtach opcji nie ma", () => {});
test("koszt wybuchowego przewyższa kulę", () => { /* cena zakupu bełtu (value 2 × buyBase 1,5 = 3) + 2 + 10 = 15 > 6 × 1,5 = 9 */ });
test("przełącznik w ekwipunku zmienia loadExplosive i ładowanie po walce", () => {});
```

- [ ] **Step 2: Uruchom:** `node --test test/upgrades_workshops.test.js test/inventory_screen.test.js`. Oczekiwane: FAIL.

- [ ] **Step 3: Zaimplementuj.** Dodaj wpisy bełtów do `CHAINS` z `qty: 10`, tak żeby `requires`, `takeItem` i `giveItem` używały `{ id, qty: 10 }`, bez `unequipItem`. Dodaj akcję przełącznika w menu kuszy na ekranie ekwipunku, z kluczami `inv.loadExplosiveOn` i `inv.loadExplosiveOff`. Wybuchowe tylko w tych warsztatach, które robią 2. stopień kusz.

- [ ] **Step 4: Uruchom:** `node tools/upgrades/generate.mjs && npm test && node bin/game.js --validate`. Oczekiwane: PASS.

- [ ] **Step 5: Sprawdź w prawdziwej grze** skryptem: wymiana paczki, włączenie przełącznika, strzał w grupę, ładowanie po walce. Oczekiwane: wybuch widoczny w dzienniku i zużycie jednego bełtu.

- [ ] **Step 6: Powtórz pomiar z zadania 10** z bełtami wybuchowymi. Wyniki przedstaw użytkownikowi.

- [ ] **Step 7: Commit:** `feat: wymiana bełtów i przełącznik ładowania`
