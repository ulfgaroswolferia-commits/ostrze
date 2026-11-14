# Cykl B2 – ekwipunek, sklep, menu obozowe – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przedmioty, ekwipunek ze slotami i pasem, waga, pieniądze, sklep z ograniczonym towarem, menu obozowe między scenami i zapis v3 – grywalne w demo dla obu klas.

**Architecture:** Czyste systemy `src/systems/inventory.js` i `src/systems/shop.js` (stan + dane → wynik `{ ok, reason }`), sprzęt jako nowe źródło w `STAT_SOURCES` (`getStats`), UI w `src/ui/` (widżet `select` z `hotkey` i przewijaniem, `campMenu`, ekran ekwipunku, wybór slotu zapisu), sceny `shop` i rozszerzony `reward`. Zapis v3 z migracją i naprawą przy wczytaniu.

**Tech Stack:** Node.js ≥ 22, ESM, JSDoc, zero zależności, `node:test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-10-21-cykl-b2-ekwipunek-sklep-design.md` (binding). Spec główna: `docs/koncepcja-gry.md`.

## Global Constraints

- Zero zależności npm; tylko moduły `node:*`.
- `src/engine/*` (poza `loop.js`) i `src/systems/*` nie importują niczego z `src/ui/`.
- Kod i nazwy techniczne po angielsku, komentarze w stylu istniejącego kodu (krótkie JSDoc); treść gry i `id` danych po polsku bez diakrytyków.
- Każdy tekst widoczny dla gracza w `data/ui.json` (klucze z tego planu) lub w plikach `data/*.json`; żadnych polskich napisów w kodzie poza komunikatami walidacji/błędów (jak dotąd).
- Komunikaty walidacji danych: `plik › id › pole: opis`.
- Liczby balansu w `rules.json` (`inventory`, `shop`), nie w kodzie.
- Funkcje systemów przy błędzie gracza zwracają `{ ok: false, reason }` (`reason` = klucz `ui.json`) i **nie zmieniają stanu**; rzucają tylko przy błędzie programisty (nieznany `id`).
- Pieniądze w groszach (`character.money`, liczba całkowita ≥ 0); skrót waluty `currency.short` = „gr”.
- Jeden widżet wyboru wszędzie; tryb liniowy (bez TTY) musi działać dla każdej nowej decyzji.
- Każde zadanie kończy się zielonym `npm test` i commitem na gałęzi `cykl-b2`.

## Review Focus

1. Zapis w obozie po nagrodzie i wczytanie – nagroda (XP, pieniądze, przedmioty) nie może przyjść drugi raz (test w Task 10).
2. Ten sam przedmiot w dwóch slotach przy 1 sztuce, sprzedaż/wyrzucenie sztuki założonej lub przypiętej – gracz nie może „rozmnożyć” ani zgubić założonego sprzętu (testy w Task 4 i 5).
3. Długie listy (sklep, torba) w terminalu 24-wierszowym – kursor zawsze widoczny, przerysowanie nie rozjeżdża ekranu (test w Task 7).
4. Stare zapisy v2 i zapisy z przedmiotami usuniętymi z danych – wczytują się z ostrzeżeniem zamiast błędu/awarii (test w Task 6).
5. Wpisy liniowe w potoku: pusty Enter w obozie = „Dalej”, litera = skrót – istniejące skrypty e2e z B1 nadal przechodzą bez zmian sekwencji poza nowymi scenami (test w Task 8 i 12).

---

### Task 1: `items.json`, reguły i walidacja przedmiotów

**Files:**
- Create: `data/items.json`
- Modify: `data/rules.json`, `src/engine/data.js`, `test/helpers.js`, `data/ui.json`
- Create: `src/systems/items.js`
- Test: `test/data.test.js`

**Interfaces:**
- Produces: `data.items` (tablica), `SLOTS` i `ITEM_TYPES` z `src/systems/items.js`:
  `export const SLOTS = ["bron", "bron_zapas", "glowa", "tulow", "rece", "nogi", "plaszcz", "talizman", "pas"]`,
  `export const ITEM_TYPES = ["weapon", "armor", "ammo", "throwable", "consumable"]`,
  `export function itemById(data, id)` → przedmiot lub `undefined`,
  `export function validateItems(items, data)` → `string[]` (komunikaty z prefiksem `items.json › <id> › `).
- `minimalData()` w `test/helpers.js` dostaje `items` i `shops` z prawdziwych plików (Task 2 dodaje `shops.json`; do tego czasu `shops: []`).
- `loadData` ładuje `items.json` (po `perks.json`, przed `story.json`).

- [ ] **Step 1: Testy walidacji (failing).** W `test/data.test.js`, na kopii `minimalData()` z podmienionym przedmiotem, każdy przypadek daje dokładnie oczekiwany komunikat (dopasowanie `includes`):
  - prawdziwe dane: `validateData(await loadData())` → `[]`
  - nieznany `type` → `items.json › x › type: nieznany typ przedmiotu "magia"`
  - broń bez `damage` → `items.json › x › damage: brak wymaganego pola`
  - `damage: [8, 4]` → `items.json › x › damage: oczekiwano [min, max] liczb całkowitych, min ≤ max`
  - `skill: "latanie"` → `items.json › x › skill: nieznana umiejętność "latanie"`
  - `reload.ammo: "miecz_krotki"` → `items.json › x › reload.ammo: oczekiwano przedmiotu typu ammo`
  - pancerz `slot: "bron"` → `items.json › x › slot: niedozwolony slot "bron"`
  - `reduction: { sieczne: 80 }` → `items.json › x › reduction.sieczne: wartość poza zakresem 0–75`
  - pas bez `quickSlots` → `items.json › x › quickSlots: wymagane dla slotu pas`; kaptur z `quickSlots` → `items.json › x › quickSlots: dozwolone tylko dla slotu pas`
  - `modifiers: { latanie: 1 }` → komunikat z `validateModifiers` z prefiksem `items.json › x › modifiers`
  - brak `piesci` → `items.json: brak przedmiotu piesci (weapon, hidden)`
  - nieznane pole broni `reach` → `items.json › x › reach: nieznane pole`
- [ ] **Step 2:** `npm test` – nowe testy FAIL.
- [ ] **Step 3: Implementacja.** `src/systems/items.js`: schematy per typ (pola wymagane/dozwolone wg spec „`data/items.json`”: `weight` typu `number` min 0, `value` całkowite min 0, `apCost` min 1, `range` enum `melee|far|thrown`, `target` enum, `effects[].chance` 1–100, `heal` jak `damage`), walidacja odwołań (umiejętności, `reload.ammo`, `DAMAGE_TYPES` z `modifiers.js`). `validateData` woła `validateItems`. `rules.json`: sekcje `inventory` i `shop` dokładnie jak w spec; `RULES_SCHEMA` je wymaga (`buyBase`, `sellBase` typu `number` > 0 – sprawdzane ręcznie, `minPrice` całkowite ≥ 1, `buyHandelDiv`/`sellHandelDiv` całkowite ≥ 1). `data/items.json`: komplet z tabeli spec (liczby z tabeli; `kusza_lekka` i `kaftan_przeszywany` jak w spec. głównej 5.1/5.2; `garniec_wapno`/`swieca_dymna`/`puszka_szerszeni` wg 5.3 z wagą 1 i wartością 15/20/25; opisy krótkie, w stylu „Styl i ton”). `ui.json`: `currency.short` = `gr`, `slot.<id>` dla 9 slotów (W ręku, Na plecach, Głowa, Tułów, Ręce, Nogi, Płaszcz, Talizman, Pas), `itemType.<typ>` dla 5 typów.
- [ ] **Step 4:** `npm test` – PASS; `node bin/game.js --validate` – brak błędów.
- [ ] **Step 5: Commit** `feat(dane): przedmioty, reguły ekwipunku i sklepu, walidacja`.

### Task 2: `shops.json`, zestaw startowy klas, walidacja

**Files:**
- Create: `data/shops.json`
- Modify: `data/classes.json`, `src/engine/data.js`, `test/helpers.js`
- Test: `test/data.test.js`

**Interfaces:**
- Consumes: `itemById`, `SLOTS`, `ITEM_TYPES` (Task 1).
- Produces: `data.shops`; klasy z `startItems: [{id, qty}]`, `startEquipped: {slot: id}`, `startMoney`; `export function slotAccepts(item, slot)` w `src/systems/items.js` (`weapon` → `bron`|`bron_zapas`, `armor` → `item.slot`, inne → false).

- [ ] **Step 1: Testy (failing):**
  - `shops.json`: towar z nieznanym przedmiotem → `shops.json › s › stock[0].id: nieznany przedmiot "x"`; towar `piesci` → `… stock[0].id: przedmiot ukryty`; `qty: 0` → `… stock[0].qty: wartość mniejsza niż 1`; powtórzony przedmiot → `… stock[1].id: powtórzony przedmiot "opatrunek"`; `buys: ["magia"]` → `shops.json › s › buys[0]: nieznany typ przedmiotu "magia"`; zduplikowane `id` sklepu.
  - `classes.json`: `startItems` z nieznanym przedmiotem; `startEquipped: { tulow: "miecz_krotki" }` → `classes.json › miecz › startEquipped.tulow: przedmiot nie pasuje do slotu`; `startEquipped` z przedmiotem spoza `startItems` → `… startEquipped.bron: przedmiot spoza startItems`; brak `startMoney` → brak wymaganego pola.
  - `slotAccepts`: miecz → `bron` i `bron_zapas` true, `tulow` false; kaptur → `glowa` true; opatrunek → wszędzie false.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `CLASS_SCHEMA` z nowymi polami (wymagane `startItems`, `startEquipped`, `startMoney`), walidacja odwołań; `SHOP_SCHEMA` + walidacja; `loadData` ładuje `shops.json` (po `items.json`). Dane: klasy wg spec (miecz: `miecz_krotki`, `kaftan_przeszywany`, `pas_zwykly`, 2× `opatrunek`, założone `bron`/`tulow`/`pas`, 30 gr; włócznia: `para_wloczni` zamiast miecza). `shops.json`: `kramarz_szkolny` („Kram kwatermistrza”) – `opatrunek` ×4, `napar_ziol` ×2, `kaptur_mysliwego` ×1, `rekawice_lucznicze` ×1, `pas_ladownice` ×1, `luk_mysliwski` ×1, `strzala` ×30, `garniec_wapno` ×2; `buys`: `weapon`, `armor`, `consumable`, `throwable`.
- [ ] **Step 4:** PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(dane): sklep kwatermistrza i zestawy startowe klas`.

### Task 3: Sprzęt w `getStats` i na karcie postaci

**Files:**
- Modify: `src/systems/stats.js`, `src/ui/character_screen.js`, `data/ui.json`
- Test: `test/stats.test.js`, `test/scenes.test.js` (karta)

**Interfaces:**
- Consumes: `itemById`, `SLOTS` (Task 1).
- Produces: źródło `{ source: { kind: "item", id }, modifiers, permanent: false }` dla każdego założonego slotu poza `bron_zapas` (gdy `state.inventory` brak/`null` → brak źródeł); `stats.derived.armor` (suma `armor` założonych slotów poza `bron_zapas`), `stats.derived.reduction` (`{ [typ]: % }` dla wszystkich 5 typów, suma obcięta do `rules.inventory.maxReductionPercent`). `getStats` przyjmuje stan bez `inventory` (karta w kreatorze).

- [ ] **Step 1: Testy (failing)** w `test/stats.test.js` (stan z postacią 5/5, `inventory: { items, equipped, quickSlots: [] }`):
  - `kaptur_mysliwego` w `glowa` → `attributes.bystrosc` +1 względem stanu bez kaptura, `breakdown.bystrosc` zawiera `{ source: { kind: "item", id: "kaptur_mysliwego" }, value: 1 }`.
  - `kolczuga` w `tulow` → `derived.ap` −1, `skills.skradanie` −20, `derived.armor` 2, `derived.reduction.sieczne` 30.
  - broń z `modifiers` w `bron_zapas` nie działa (użyj przedmiotu testowego w kopii danych).
  - dwa pancerze testowe po `sieczne: 50` → `reduction.sieczne` 75.
  - `permanentOnly: true` pomija sprzęt.
  - stan z `inventory: null` → bez błędu, `derived.armor` 0.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** `equipmentSource` dopisane do `STAT_SOURCES`; `armor`/`reduction` w części pochodnych. Karta: `sourceLabel` dla `kind: "item"` → nazwa przedmiotu; nowe linie po pochodnych: `char.armor` = „Pancerz: {armor} · redukcja: {list}” (tylko niezerowe typy, nazwy z `damage.<typ>` w `ui.json`: sieczne, kłute, obuchowe, ogień, palne; gdy brak – „brak”), `char.weapon` = „Broń: {name}” (założona w `bron` albo nazwa `piesci`).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(statystyki): modyfikatory, pancerz i redukcje ze sprzętu`.

### Task 4: System ekwipunku `inventory.js`

**Files:**
- Create: `src/systems/inventory.js`
- Modify: `src/engine/state.js`, `src/ui/character_screen.js` (linia wagi), `data/ui.json`
- Test: `test/inventory.test.js`

**Interfaces:**
- Consumes: `itemById`, `slotAccepts`, `SLOTS` (Task 1–2), `getStats` (Task 3).
- Produces (wszystkie na `(state, data, …)`; mutujące zwracają `{ ok: true }` lub `{ ok: false, reason }`):
  - `countOf(state, itemId)` → liczba sztuk w torbie; `equippedCount(state, itemId)` → w ilu slotach; `freeCount(state, itemId)` = `countOf − equippedCount`.
  - `addItem(state, data, itemId, qty)` – łączy stosy, **bez** sprawdzania wagi; `removeItem(state, data, itemId, qty)` – tylko z wolnych sztuk (`reason: "inv.notFree"`), usuwa pusty stos i wpis z `quickSlots` przy ostatniej sztuce.
  - `equip(state, data, itemId, slot)` – reasons: `inv.notOwned`, `inv.wrongSlot`, `inv.noFreeCopy`; zajęty slot jest nadpisywany; po zmianie pasa przycina `quickSlots` i zwraca `{ ok: true, trimmed: [id…] }`.
  - `unequip(state, data, slot)` – `inv.emptySlot`; zdejmuje, przycina pas jak wyżej, obcina `hp` do `hpMax` (min 1).
  - `swapWeapons(state)` – zawsze `{ ok: true }`.
  - `quickCapacity(state, data)`; `assignQuick(state, data, itemId)` – `inv.notOwned`, `inv.notQuickType` (tylko `throwable`/`consumable`), `inv.alreadyQuick`, `inv.beltFull`; `unassignQuick(state, itemId)` – `inv.notQuick`.
  - `carriedWeight(state, data)` → liczba (kg); `isOverloaded(state, data)`; `canAdd(state, data, itemId, qty)` → bool (waga po dodaniu ≤ `carry × hardLimitPercent / 100`).
  - `grantStartKit(state, data, classId)` – ustawia `inventory` (jeśli `null`), dodaje `startItems`, zakłada `startEquipped`, `character.money = startMoney`, przypina `consumable`/`throwable` do pasa do pojemności.
  - `createNewState` ustawia `inventory: { items: [], equipped: {}, quickSlots: [] }` (wersja zapisu i pola `world` zmieniają się dopiero w Task 6).
  - Karta postaci: linia `char.weight` = „Waga: {weight}/{carry} kg” (waga zaokrąglona do 0.1).
- Teksty `inv.*` w `ui.json`: notOwned „Nie masz tego przedmiotu.”, wrongSlot „To się tu nie założy.”, noFreeCopy „Brak wolnej sztuki – ta jest już założona.”, notFree „Najpierw zdejmij ten przedmiot.”, emptySlot „Nic tu nie masz.”, notQuickType „Na pas tylko rzeczy do rzucania i środki.”, alreadyQuick „Już jest na pasie.”, beltFull „Brak miejsca na pasie.”, notQuick „Tego nie ma na pasie.”, tooHeavy „Za ciężko – nie uniesiesz więcej.”, trimmed „Z pasa trafia do torby: {items}.”

- [ ] **Step 1: Testy (failing)** – po jednym `test()` na regułę, każdy sprawdza też, że przy `ok: false` stan jest głęboko równy kopii sprzed wywołania (`structuredClone` + `deepEqual`):
  - stosy: `addItem` ×2 opatrunek → jeden wpis `qty: 2`.
  - `equip` miecz do `bron` i drugi raz do `bron_zapas` przy 1 sztuce → `inv.noFreeCopy`; przy 2 sztukach → oba sloty.
  - `equip` kaptur do `tulow` → `inv.wrongSlot`; nieposiadany → `inv.notOwned`.
  - `removeItem` założonego miecza (1 szt.) → `inv.notFree`; po zdjęciu → ok, stos znika.
  - `swapWeapons` z pustym `bron_zapas` → miecz w `bron_zapas`, `bron` puste.
  - pas: `pas_zwykly` (2) – trzecie przypięcie → `inv.beltFull`; przypięcie miecza → `inv.notQuickType`; zmiana na `pas_ladownice` i z powrotem na zwykły przy 3 przypiętych → `trimmed` = ostatni; zdjęcie pasa → `quickSlots` puste.
  - zużycie ostatniego opatrunku (`removeItem`) usuwa go z `quickSlots`.
  - waga: zestaw miecza = 2 + 5 + 0.3 + 0.4 = 7.7 kg (tolerancja 1e-9); `canAdd` kolczugi przy udźwigu 75 i wadze 105 → false (limit 112.5, 105 + 12 = 117), przy wadze 100 → true.
  - `unequip` przedmiotu z `hpMax` +10 przy `hp` = max → `hp` = nowe max.
  - `grantStartKit(…, "wlocznia")` → `equipped.bron === "para_wloczni"`, `money === 30`, `quickSlots` = `["opatrunek"]`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementacja wg Interfaces.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ekwipunek): torba, sloty, pas, waga i zestaw startowy`.

### Task 5: Użycie środków i system sklepu

**Files:**
- Modify: `src/systems/inventory.js`
- Create: `src/systems/shop.js`
- Modify: `data/ui.json`
- Test: `test/inventory.test.js`, `test/shop.test.js`

**Interfaces:**
- Consumes: Task 4, `getStats`, `advanceTime` (`src/engine/time.js`), RNG (`rng.int(min, max)`).
- Produces:
  - `useConsumable(state, data, itemId, rng)` → `{ ok: true, healed, events }` (`events` = wynik `advanceTime` o `rules.inventory.useMinutes`) lub `inv.notOwned` / `inv.notUsable` (typ ≠ `consumable`). Leczenie `floor(rng.int(...heal) × (1 + skill / 100))`, `skill` = `getStats().skills[healSkill]` (brak `healSkill` → 0), obcięte do `hpMax`; zużywa 1 sztukę (wolną albo przypiętą – przypięcie nie blokuje).
  - `shop.js`: `buyPrice(data, item, handel)`, `sellPrice(data, item, handel)` (wzory i `min(sell, buy)` ze spec); `shopStock(state, data, shopId)` → tablica `{id, qty}` (z `world.shops[shopId]` albo kopia `stock` – bez zapisu); `buy(state, data, shopId, itemId, qty)` → `{ ok: true, cost }` lub reasons `shop.noStock`, `shop.noMoney`, `inv.tooHeavy`; `sellable(state, data, shopId)` → `[{ id, qty, price }]` (wolne sztuki, typ w `buys`, nie `hidden`, `value > 0`); `sell(state, data, shopId, itemId, qty)` → `{ ok: true, gain }` lub `shop.notBought`, `inv.notFree`. Każda udana transakcja zapisuje towar do `world.shops[shopId]` (pozycje z `qty` 0 usuwane; sprzedane dopisywane/łączone).
  - Teksty: `inv.notUsable` „Tego się nie używa.”, `shop.noStock` „Kupiec tego już nie ma.”, `shop.noMoney` „Nie stać cię.”, `shop.notBought` „Kupiec tego nie weźmie.”.

- [ ] **Step 1: Testy (failing):**
  - `useConsumable` opatrunek przy `hp` 10/35, medycyna 15, RNG z ustalonym ziarnem → `healed` = `floor(r × 1.15)` (oblicz `r` tym samym ziarnem w teście), `time.minutes` +10, opatrunek −1; przy pełnym HP `healed` 0 i sztuka zużyta; `useConsumable` miecza → `inv.notUsable` bez zmian stanu.
  - ceny `value` 40: handel 0 → kupno 60, sprzedaż 12; handel 50 → 50 i 17 (`round(40 × 0.425)` = 17); handel 100 → 40 i 22; `value` 1 handel 0 → kupno 2, sprzedaż 1 (min 1); dla każdej pary kupno ≥ sprzedaż.
  - `buy` opatrunek ×2 przy 30 gr i handel → pieniądze −koszt, torba +2, `world.shops.kramarz_szkolny` ma opatrunek `qty` 2; `buy` ponad towar → `shop.noStock`; brak pieniędzy → `shop.noMoney`; ponad limit wagi → `inv.tooHeavy` (wszystko bez zmian stanu).
  - `sell` kaftana założonego → `inv.notFree`; amunicji (`ammo` spoza `buys`) → `shop.notBought`; `sellable` nie zawiera `piesci` ani założonych sztuk; sprzedany miecz zapasowy trafia do towaru kupca.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(sklep): ceny, kupno i sprzedaż; użycie środków poza walką`.

### Task 6: Zapis v3 – migracja, walidacja, naprawa

**Files:**
- Modify: `src/config.js` (`SAVE_FORMAT_VERSION` = 3), `src/engine/state.js` (`version: 3`, `world.shops: {}`, `world.claimedRewards: []`), `src/engine/save.js`, `src/app.js` (ostrzeżenia z wczytania jako notice), `data/ui.json`
- Test: `test/save.test.js`

**Interfaces:**
- Consumes: `itemById`, `slotAccepts`, `quickCapacity` (Task 1–4).
- Produces: `migrations[2]` (spec „Stan i zapis v3”); `loadGame(slot, data, { warnings } = {})` – opcjonalna tablica, do której trafiają teksty ostrzeżeń (już po polsku, format `load.repaired` z `ui.json`: „Zapis naprawiony: {what}.”); `listSaves` bez zmian zachowania. `app.js` `loadMenu` przekazuje tablicę i robi `pushNotice` dla każdej pozycji (kolor `warn`).
- Naprawa (kolejność): nieznane przedmioty z `items`, `equipped`, `quickSlots`, `world.shops.*` → usunięte; nieznany sklep z `world.shops` → usunięty; założone bez pokrycia (`equippedCount > countOf`) albo w złym slocie (`slotAccepts` false) → zdjęte; `quickSlots` bez sztuk w torbie, duplikaty, ponad `quickCapacity` → przycięte. Każda kategoria daje jedno ostrzeżenie z listą `id`.
- Schematy: `INVENTORY_SCHEMA` (`items: [{id: string, qty: integer ≥ 1}]`, `equipped: object<string>`, `quickSlots: string[]`), `money` integer ≥ 0 wymagane w `CHARACTER_SCHEMA`; `world.shops` obiekt tablic `{id, qty ≥ 0}`, `world.claimedRewards` tablica tekstów. Zły kształt → `LoadError` „niepoprawna struktura (…)”.

- [ ] **Step 1: Testy (failing):** zapis v2 (z `inventory: null`, postacią bez `money`) wczytuje się jako v3 z pustym ekwipunkiem i `money` 0; pełny cykl zapis → wczytanie zachowuje `inventory`, `money`, `world.shops`, `world.claimedRewards`; zapis z `items: [{id: "usuniety", qty: 1}]` + `equipped.bron: "usuniety"` → wczytany bez przedmiotu, `warnings` ma 1 wpis zawierający `usuniety`; miecz założony w `tulow` → zdjęty z ostrzeżeniem; `quickSlots` 3 przy pasie zwykłym → 2; `inventory.items` = `"x"` → `LoadError`; `money: -5` → `LoadError`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja (naprawa jako osobna czysta funkcja `repairInventory(state, data)` → `string[]` w `src/engine/save.js`). **Step 4:** PASS (cały `npm test`, łącznie z e2e).
- [ ] **Step 5: Commit** `feat(zapis): format v3 z ekwipunkiem, migracja i naprawa przy wczytaniu`.

### Task 7: Widżet – skróty literowe, pusty Enter, przewijanie

**Files:**
- Modify: `src/ui/menu.js`, `src/ui/io.js` (`rows`)
- Test: `test/menu.test.js`, `test/io.test.js`

**Interfaces:**
- Produces:
  - `select` – pozycja może mieć `hotkey` (jedna litera): w trybie klawiszy litera bez względu na wielkość wybiera pozycję (wyszarzona – ignorowana); w trybie liniowym odpowiedź równa literze (bez względu na wielkość) też wybiera; etykieta wyświetlana jako `[P] Postać` (prefiks dokłada widżet).
  - `select` opcja `emptyPicksInitial: true` – w trybie liniowym pusta odpowiedź zwraca `initial` (albo pierwszą aktywną).
  - `io.rows`: terminal `output.rows || 24`; skryptowe IO pole `rows: 24` (nadpisywalne w testach jak `columns`).
  - Przewijanie w `select`, `multiSelect`, `sliders` (tryb klawiszy): gdy wierszy listy (bez nagłówków) jest więcej niż `max(3, io.rows − 4)`, widoczne jest okno tej wysokości przesuwane tak, by kursor był widoczny; nad oknem linia `↑ …` (gdy coś jest wyżej), pod nim `↓ …` (gdy niżej) – liczone do wysokości okna. Tryb liniowy wypisuje wszystko (bez zmian).

- [ ] **Step 1: Testy (failing):**
  - `select` TTY z pozycjami `[{label:"Dalej"},{label:"Postać",hotkey:"p"}]`, klawisz `P` → 1; tekst zawiera `[P] Postać`.
  - `select` bez TTY: odpowiedź `p` → 1; odpowiedź `""` z `emptyPicksInitial` → 0; bez opcji pusta → komunikat `prompt.invalid`.
  - przewijanie: 40 pozycji, `rows` 14 (okno 10), 15× `<down>` i `<enter>` → wynik 15; ostatni narysowany blok zawiera `Pozycja 16`, nie zawiera `Pozycja 1 ` (spacja/koniec), zawiera `↑ …` i `↓ …`; żaden blok nie ma więcej niż 10 wierszy pozycji + 2 znaczniki + opis.
  - `multiSelect` i `sliders` – po jednym teście przewijania (kursor na `Gotowe` widoczny).
  - `io.test.js`: `createTerminalIO` z wyjściem bez `rows` → `io.rows === 24`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja (wspólna funkcja okna dla trzech widżetów). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(menu): skróty literowe, pusty Enter i przewijanie długich list`.

### Task 8: Menu obozowe i zapis do slotu

**Files:**
- Create: `src/ui/camp.js`, `src/ui/save_screen.js`
- Modify: `src/scenes/errors.js` (`QuitToMenuError`), `src/scenes/narration.js`, `src/scenes/reward.js`, `src/scenes/rest.js`, `src/app.js`, `data/ui.json`
- Test: `test/scenes.test.js`, `test/e2e.test.js` (istniejące muszą przejść)

**Interfaces:**
- Consumes: `select` z `hotkey`/`emptyPicksInitial` (Task 7), `saveGame`, `listSaves` (`src/engine/save.js`), `showCharacter`.
- Produces:
  - `campMenu(ctx, render)` w `src/ui/camp.js`: bez `state.character` → `pressEnter(io, ui)`; z postacią pętla `select` z pozycjami `camp.continue` (Dalej), `camp.character` (Postać, `p`), `camp.inventory` (Ekwipunek, `e`), `camp.save` (Zapisz grę, `z`), `camp.menu` (Menu główne, `m`), `initial: 0`, `emptyPicksInitial: true`. Ekwipunek woła `ctx.showInventory?.(ctx)` – do Task 9 pozycja jest wyszarzona, gdy `ctx.showInventory` brak (Task 9 ustawia domyślną implementację importem w `camp.js` i usuwa ten warunek). Po każdym ekranie `render()`.
  - `QuitToMenuError` – „Menu główne”: `confirm(io, ui, t(ui, "confirm.saveOnExit"))` → `saveGame("auto", state, ctx.rng)` (błąd zapisu → notice `save.failed`, wyjście i tak) → `throw new QuitToMenuError()`. `play()` w `app.js` łapie go przed gałęzią awarii i zwraca `"menu"`.
  - `saveToSlot(ctx)` w `src/ui/save_screen.js`: `listSaves` → pozycje `1`, `2`, `3` (`save.slotEmpty` „{slot} · wolny” albo `load.entry`), `load.back`; zajęty slot → `confirm` `save.overwrite` „Nadpisać zapis {slot}? [t/n]”; potem `saveGame(slot, state, ctx.rng)` → notice `save.done` albo `save.failed`.
  - `narration`, `reward`, `rest`: `pressEnter(..., { onCharacter })` → `campMenu(ctx, render)`. `prompt.enterOrCharacter` usuwany z użycia (klucz może zostać).

- [ ] **Step 1: Testy (failing)** w `test/scenes.test.js` (skryptowe IO bez TTY, scena `narration` z postacią):
  - `""` kończy scenę; `p`, potem `""` → karta postaci w tekście i koniec; `2`, `""`, `""` → to samo numerem (karta czeka na Enter).
  - `z`, `1`, `""` → plik slotu `1` istnieje (`loadGame("1", data)` ma `scene.id` bieżącej sceny), tekst zawiera `Zapisano.`.
  - zajęty slot: `z`, `1`, `n`, `4` (Wróć), `""` → slot nie nadpisany (porównaj `savedAt`).
  - `m`, `t` → odrzucenie `QuitToMenuError`, zapis `auto` istnieje; `m`, `n` → `QuitToMenuError` bez zapisu.
  - narracja przed kreatorem (bez postaci) – `""` kończy, brak listy obozu w tekście.
  - `runApp`: wyjście `m`/`n` z narracji wraca do menu głównego (tekst menu dwukrotnie), brak zapisu `crash`.
  - TTY: `<down>`, `<enter>` otwiera kartę.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS – w tym niezmienione e2e B1 (pusty Enter = Dalej; jeśli e2e z TTY używało `p` – działa jako skrót).
- [ ] **Step 5: Commit** `feat(obóz): menu obozowe ze skrótami, zapis do slotu, powrót do menu`.

### Task 9: Ekran ekwipunku

**Files:**
- Create: `src/ui/inventory_screen.js`
- Modify: `src/ui/camp.js`, `data/ui.json`
- Test: `test/inventory_screen.test.js`

**Interfaces:**
- Consumes: Task 4–5 (`equip`, `unequip`, `swapWeapons`, `assignQuick`, `unassignQuick`, `removeItem`, `useConsumable`, `carriedWeight`, `isOverloaded`, `freeCount`), `getStats`, `select`, `sliders`, `confirm`, `pushNotice`/`flushNotices`.
- Produces: `showInventory(ctx)` (wraca po „Wróć”); `renderItemCard(item, state, data)` → tekst karty przedmiotu (czysta funkcja). `camp.js` używa `showInventory` domyślnie.
- Układ i akcje wg spec „Ekran ekwipunku”. Nagłówek `inv.header` „Ekwipunek · Waga {weight}/{carry} kg · {money} gr” (+ `inv.overloaded` „PRZECIĄŻONY”, kolor `warn`); linia slotów z `slot.*`; pozycje: `nazwa` (+ `×qty` gdy > 1) z `hint`: slot(y) założenia `[W ręku]`, `[pas]`, `za ciężka` gdy `minStrength` > siła. Podmenu: `inv.equip` (broń: `inv.equipHand`/`inv.equipBack`), `inv.unequip`, `inv.swap`, `inv.toBelt`, `inv.fromBelt`, `inv.use`, `inv.drop`, `inv.describe`, `inv.back`. Niedostępne akcje – wyszarzone z `description` = tekst `reason`. Wyniki: notice (`inv.used` „{item}: +{hp} PŻ.”, `inv.dropped` „Wyrzucono: {item} ×{qty}.”, `trimmed`, zmiany pory z `events` jak w pętli – `time.change.<pora>`). Wyrzucenie > 1 sztuki: `sliders` z jednym wierszem (1…wolne) i `confirm` `inv.dropConfirm`. `piesci` niewidoczne.

- [ ] **Step 1: Testy (failing)** (stan z zestawem klasy miecza + `kaptur_mysliwego` + `kusza_lekka`, siła 3, bez TTY):
  - tekst nagłówka zawiera `Waga 12.2/` i `30 gr`; pozycja kuszy ma `za ciężka`.
  - załóż kaptur → `equipped.glowa`; zdejmij kaftan → `equipped.tulow` brak; „Zamień broń” → miecz w `bron_zapas`.
  - opatrunek „Użyj” przy `hp` 10 → `hp` > 10, `time.minutes` +10, notice z `PŻ`.
  - „Wyrzuć” założonego miecza wyszarzone (`Najpierw zdejmij`); wyrzucenie 1 z 2 opatrunków (suwak startuje od 1: odpowiedź `2` = Gotowe, potem `t`) → zostaje 1.
  - `renderItemCard(kusza)` zawiera `8–14`, `5 PA`, `Waga 4`, a kaftana – `sieczne 15%`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ekwipunek): ekran ekwipunku z akcjami i kartą przedmiotu`.

### Task 10: Nagroda z przedmiotami i pieniędzmi; kreator wydaje zestaw

**Files:**
- Modify: `src/scenes/schemas.js`, `src/engine/data.js`, `src/scenes/reward.js`, `src/scenes/character_creation.js`, `data/ui.json`
- Test: `test/scenes.test.js`, `test/data.test.js`

**Interfaces:**
- Consumes: `addItem`, `canAdd`, `grantStartKit` (Task 4), `campMenu`, `showInventory`.
- Produces: schemat `reward`: `xp` opcjonalne (integer ≥ 0), `money` (integer ≥ 0), `items` (tablica: string id albo `{id, qty ≥ 1}`); walidacja w `validateScenes`: co najmniej jedno z trzech (`story.json › r › reward: pusta nagroda`), przedmioty istnieją (`… items[0]: nieznany przedmiot "x"`) i nie są `hidden`.
- `reward`: gdy `scene.id` w `world.claimedRewards` → ekran z `reward.claimed` „Ta nagroda jest już odebrana.” i obóz, bez zmian stanu; inaczej: XP (jak dotąd), `money`, przedmioty po kolei; dla przedmiotu, którego `canAdd` = false: ekran `reward.tooHeavy` „{item} się nie mieści.” + `select` `reward.makeRoom` (Wyrzuć coś → `showInventory`, potem ponowna próba) / `reward.leave` (Zostaw); na końcu dopisuje `scene.id` do `world.claimedRewards`. Ekran: `reward.summary` łączy części: `+{xp} PD`, `+{money} gr`, lista przedmiotów (`nazwa ×qty`), separator ` · `.
- Kreator: `grantStartKit(state, data, cls.id)` po zatwierdzeniu; podgląd umiejętności (`preview`) dostaje `classId: cls.id` (zaległość z ledgera B1).

- [ ] **Step 1: Testy (failing):** walidacja (pusta nagroda, nieznany przedmiot, `piesci`); `reward` `{xp: 0, money: 20, items: ["kaptur_mysliwego", {id: "strzala", qty: 10}]}` → `money` +20, kaptur i 10 strzał, tekst `+20 gr`; druga egzekucja tej samej sceny (ten sam stan) → bez zmian, tekst `już odebrana`; przeciążenie (siła 2, torba z 70 kg przedmiotów testowych), nagroda `kolczuga`, odpowiedź „Zostaw” → brak kolczugi, scena zaliczona do `claimedRewards`; kreator klasą włóczni → `equipped.bron === "para_wloczni"`, `money` 30.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS (e2e B1 może wymagać dopisania odpowiedzi tylko jeśli zmienił się przepływ – nie powinien).
- [ ] **Step 5: Commit** `feat(nagroda): przedmioty, pieniądze, limit wagi, jednokrotne odbiór; zestaw startowy`.

### Task 11: Scena sklepu

**Files:**
- Create: `src/scenes/shop.js`
- Modify: `src/scenes/index.js`, `src/scenes/schemas.js`, `src/engine/data.js`, `data/ui.json`
- Test: `test/scenes.test.js`, `test/data.test.js`

**Interfaces:**
- Consumes: `shop.js` (Task 5), `carriedWeight`, `canAdd`, `select`, `sliders`, `confirm`, `statusBar`.
- Produces: typ sceny `shop` (`shop` wymagane, id); walidacja `story.json › s › shop: nieznany sklep "x"` i wymaganie wcześniejszego kreatora (jak `reward`/`rest`). Handler wg spec „Sklep”: nagłówek `shop.header` „{name} · Twoje pieniądze: {money} gr · Waga {weight}/{carry} kg”; menu `shop.buy` / `shop.sell` / `shop.leave`; lista kupna `shop.buyEntry` „{name} · {price} gr · ×{qty}” (wyszarzone z `description` = `shop.noMoney` / `inv.tooHeavy`), po wyborze `sliders` (jeden wiersz 1…max) z `note` = suma, potem `confirm` `shop.confirmBuy` „Kupić {name} ×{qty} za {cost} gr? [t/n]”; sprzedaż analogicznie (`shop.sellEntry`, `shop.confirmSell`); notice po transakcji (`shop.bought`, `shop.sold`). Pusta lista → `shop.empty` „Nic tu dla ciebie.” i powrót. Bez obozu po sklepie.

- [ ] **Step 1: Testy (failing):** walidacja nieznanego sklepu; kupno 2 opatrunków (bez TTY: `1`, `1`, `1+`, `2`, `t`, `3`) → pieniądze −2×cena, torba +2; za drogi przedmiot wyszarzony (`(niedostępne)` przy jego numerze); sprzedaż wolnego miecza zapasowego → pieniądze +cena, miecz w `world.shops`; „Odejdź” kończy scenę bez zmian.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(sklep): scena sklepu z kupnem i sprzedażą`.

### Task 12: Demo i e2e dla obu klas

**Files:**
- Modify: `data/story.json`, `test/e2e.test.js`
- Test: `test/e2e.test.js`

**Interfaces:**
- Consumes: wszystko powyżej.
- Demo wg spec „Demo `story.json` po B2”: `demo_nagroda` = `xp` 160, `money` 15, `items: ["kaptur_mysliwego"]`; nowe sceny przed `demo_kurier`: `demo_kram_wstep` (narracja, tytuł „Kram”, 2–3 zdania: kwatermistrz skąpi i zrzędzi, styl „Styl i ton”) i `demo_kram` (`shop: kramarz_szkolny`).
- e2e (bez TTY, ziarno 7): klasa miecza – w obozie po nagrodzie `e`, załóż kaptur, wróć, `p` (karta: `Bystrość` z `Kaptur myśliwego`), `""`; w kramie kup 1 opatrunek, sprzedaj nic, odejdź; w obozie `z` → slot `1`; dojście do końca. Asercje: `equipped.glowa === "kaptur_mysliwego"`, `money === 30 + 15 − cena opatrunku`, opatrunki 3, stan z `loadGame("1")` ma `inventory` równy końcowemu z wyjątkiem zmian po zapisie (zapis był na scenie obozu – porównaj z odczytem tuż po zapisie). Klasa włóczni – pełne przejście z pustymi odpowiedziami w obozie/kramie: `equipped.bron === "para_wloczni"`, `flags.klasa_wlocznia`, `vars.wola === 1`. Istniejące testy e2e B1 zaktualizowane o nowe sceny (kram: `3` = Odejdź).
- [ ] **Step 1:** Testy e2e (failing). **Step 2:** FAIL. **Step 3:** dane demo. **Step 4:** PASS, `node bin/game.js --validate` czyste, ręczny przebieg `printf` przez potok (`node bin/game.js --seed 7` z odpowiedziami) bez błędu.
- [ ] **Step 5: Commit** `feat(demo): nagroda z kapturem, kram kwatermistrza, e2e obu klas`.
