# Cykl C2b – rozszerzenia walki – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Walka dwiema brońmi (para włóczni, miecz + sztylet), atak celowany, biegłość w broni, broń palna, upiór z `leap`, wróg strzelający z bliska, pełny dziennik – i testy przejścia demo niezależne od ścieżki RNG.

**Architecture:** Cechy broni z danych (`pair`, `offhand`, `reach`, `masteryType`, pola broni palnej). Nowe moduły silnika: `src/systems/combat/techniques.js` (akcje dwiema brońmi i celowanie), `src/systems/combat/firearm.js`, `src/systems/combat/mastery.js`; reszta dopisana do istniejących modułów `combat/*`. UI: podmenu „[T] Techniki” w scenie walki, pełny dziennik, znacznik pominiętych wpisów.

**Tech Stack:** Node.js ≥ 22, ESM, JSDoc, zero zależności, `node:test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-10-21-cykl-c2b-walka-rozszerzenia-design.md` (binding). Poprzedni: `docs/superpowers/specs/2026-10-21-cykl-c2a-walka-rdzen-design.md` i ledger `docs/superpowers/plans/2026-10-21-cykl-c2a-ledger.md`.

## Global Constraints

- Zero zależności npm; tylko `node:*`.
- `src/engine/*` (poza `loop.js`) i `src/systems/*` nie importują z `src/ui/`.
- Kod po angielsku, krótkie JSDoc; treść i `id` po polsku bez diakrytyków; każdy tekst dla gracza w `data/ui.json` lub `data/*`; „HP”.
- Komunikaty walidacji: `plik › id › pole: opis`.
- Wszystkie nowe liczby walki w `rules.json › combat` (`dual`, `aimed`, `mastery`, `firearm` – dokładnie jak w spec).
- Silnik przy błędzie gracza zwraca `{ ok: false, reason }` bez zmiany stanu; rzuca przy błędzie programisty.
- RNG tylko przez `rng.int(min, max)`; deterministyczne testy (`createRng(seed)`, atrapy).
- Ekran walki przy 80×24: ≤ 22 wiersze, bez zawijania; testy skryptowe zużywają wszystkie wejścia.
- Każde zadanie: zielony `npm test` (czyste wyjście), czyste `node bin/game.js --validate`, commit na `cykl-c2b`.

## Review Focus

1. Rzucona broń nigdy nie znika z ekwipunku: po wygranej, ucieczce, porażce `nonLethal`, przerwaniu gry i śmierci gracza przedmiot dalej jest w torbie (test w Task 4 i 8).
2. Rozerwanie lufy usuwa dokładnie jeden pistolet (także gdy gracz ma dwa) i nigdy nie zostawia broni „w ręku” bez przedmiotu w torbie (test w Task 6).
3. Biegłość nie rośnie przy ucieczce, porażce ani za wrogów zabitych efektem, i nigdy nie przekracza 100 (test w Task 3).
4. Podmenu Technik i pełny dziennik mieszczą się w 24 wierszach także przy 40+ wpisach dziennika (test w Task 7).
5. Posiłki z hałasu przychodzą najwyżej raz i nie łamią numeracji wrogów ani końca walki (test w Task 6).

---

### Task 1: Dane – cechy broni, nowe przedmioty, upiór, spowolnienie, reguły; walidacja

**Files:**
- Create: `data/art/upior_zwiadowca.txt`
- Modify: `data/items.json`, `data/enemies.json`, `data/effects.json`, `data/rules.json`, `data/classes.json`, `data/shops.json`, `src/systems/items.js`, `src/systems/effects.js`, `src/systems/combat/data.js`, `src/engine/data.js` (klasa `masteryStart`, scena `combat.reinforcements`), `data/ui.json` (nazwy rodzajów biegłości `mastery.<rodzaj>`, slot `slot.bron_druga` „Druga ręka”)
- Test: `test/data.test.js`, `test/combat_data.test.js`

**Interfaces:**
- Produces: `MASTERY_TYPES = ["miecz", "wlocznie", "luk", "kusza", "palna", "rzucana"]` (eksport z `src/systems/items.js`); pola broni wg spec „Dane › items.json”; `enemy.leap`; efekt `spowolnienie` z `noMove: true`; `rules.combat.dual|aimed|mastery|firearm` dokładnie jak w spec; `class.masteryStart`; scena `combat` z opcjonalnym `reinforcements: [{ id, count }]`; `sztylet` ×1 w `kramarz_szkolny`.
- Walidacja (komunikaty): `items.json › x › masteryType: nieznany rodzaj "x"`, `… masteryType: brak wymaganego pola` (broń nie `hidden`), `… pair: dozwolone tylko dla broni melee`, `… pair: wyklucza się z offhand`, `… misfireChance: wartość poza zakresem 0–100` (tak samo `burstChance`, `noise`, `smoke`), `… burstDamage: oczekiwano [min, max] …`; `effects.json › x › noMove: dozwolone tylko dla unit turn`; `classes.json › x › masteryStart.y: nieznany rodzaj "y"`; `story.json › s › reinforcements[0].id: nieznany wróg "x"`; `rules.json › combat.aimed.glowa…` przez schemat.

- [ ] **Step 1: Testy walidacji (failing)** – prawdziwe dane `[]`; każdy komunikat z listy; `loadData` zawiera `sztylet`, `pistolet_skalkowy`, `kula_z_prochem`, `upior_zwiadowca` (z grafiką ≤ 40×7), `spowolnienie`.
- [ ] **Step 2:** FAIL. **Step 3:** dane i walidacja. **Step 4:** PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(dane): cechy broni, sztylet, broń palna, upiór i reguły technik`.

### Task 2: Druga ręka – slot `bron_druga`

**Files:**
- Modify: `src/systems/items.js` (`SLOTS`, `slotAccepts`), `src/systems/stats.js` (sprzęt z `bron_druga` – bez modyfikatorów, jak `bron_zapas`), `src/systems/inventory.js` (`swapWeapons` nie rusza `bron_druga`), `src/ui/inventory_screen.js` („Załóż do drugiej ręki” `inv.equipOffhand`; linia slotów pokazuje drugą rękę, gdy zajęta), `src/engine/save.js` (naprawa: broń bez `offhand` w `bron_druga` → zdjęta), `data/ui.json`
- Test: `test/inventory.test.js`, `test/inventory_screen.test.js`, `test/save.test.js`, `test/stats.test.js`

**Interfaces:**
- Produces: `slotAccepts(sztylet, "bron_druga") === true`, `slotAccepts(miecz_krotki, "bron_druga") === false`; `equip(state, data, "sztylet", "bron_druga")`; ten sam sztylet w `bron` i `bron_druga` wymaga 2 sztuk (istniejąca reguła wolnych sztuk).

- [ ] **Step 1: Testy (failing):** `slotAccepts` (sztylet: bron, bron_zapas, bron_druga; miecz: nie bron_druga); `equip` sztyletu do drugiej ręki, `inv.wrongSlot` dla miecza; `swapWeapons` zostawia `bron_druga`; sztylet w drugiej ręce nie zmienia `getStats` (broń z testowym `modifiers` w kopii danych); ekran ekwipunku: akcja „Załóż do drugiej ręki” dla sztyletu, brak dla miecza, linia slotów z „Druga ręka: Sztylet”; naprawa zapisu: `equipped.bron_druga: "miecz_krotki"` → zdjęte z ostrzeżeniem.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ekwipunek): druga ręka na sztylet`.

### Task 3: Biegłość w broni i zapis v6

**Files:**
- Create: `src/systems/combat/mastery.js`
- Modify: `src/systems/character.js` (`createCharacter` → `mastery`), `src/config.js` (6), `src/engine/state.js`, `src/engine/save.js` (`migrations[5]`, schemat, naprawa), `src/systems/combat/formulas.js` (premie), `src/systems/combat/actions.js` + `turn.js` (zapamiętanie rodzaju broni ciosu kończącego, przyrost w `finishCombat`), `src/ui/character_screen.js` (sekcja „Biegłość”), `src/ui/events.js` (zdarzenie `bieglosc`), `data/ui.json`
- Test: `test/combat_mastery.test.js`, `test/save.test.js`, `test/prompt.test.js` (karta), `test/combat_turn.test.js`

**Interfaces:**
- Produces:
  - `masteryTypeOf(item, { thrown = false } = {})` → rodzaj (`rzucana` dla `throwable` i rzutu bronią; `null` dla pięści/hidden bez `masteryType`).
  - `masteryGain(value, enemyXp, rules)` → nowa wartość (`value + enemyXp / xpDiv × (1 − value/100)²`, zaokr. do 0.1, ≤ `max`).
  - `masteryBonuses(state, data, type)` → `{ hit, damagePercent, defense }` (wzory spec; liczby całkowite w dół).
  - `enemy.killedBy` (rodzaj broni ciosu, który zabił; ustawiany przy śmierci od ataku gracza; brak przy śmierci od efektu).
  - `finishCombat` przy `win` (także treningu): przyrost per pokonany wróg z `killedBy`, kolejno, zdarzenia `{ type: "bieglosc", masteryType, before, after }` (tylko gdy przyrost ≥ 0.1).
  - Premie: `playerHitChance` + `hit` rodzaju broni ataku; obrażenia ×(1 + `damagePercent`/100) w `rollDamage` przez `bonusPercent`; obrona gracza (`enemyHitChance`) + `defense` gdy główna broń `melee`.
  - Zapis v6: `character.mastery` (obiekt 6 kluczy, 0–100); `migrations[5]`: zera + `class.masteryStart`; naprawa: obcięcie do 0–100, nieznane klucze usunięte, brakujące = 0.
  - Karta: `char.mastery` „Biegłość:” + `char.masteryEntry` „{name} {value}” dla > 0.

- [ ] **Step 1: Testy (failing):** `masteryGain(15, 40)` = 15 + 2 × 0.7225 = 16.4 (zaokr.); `masteryGain(80, 40)` = 80.1 (80 + 2 × 0.04 = 80.08 → 80.1); `masteryGain(99.9, 1000)` ≤ 100; premie przy 50: hit 7, damagePercent 10, defense 5; `createCharacter` klasa miecza → `mastery.miecz` 15, reszta 0; `finishCombat` wygrana z 2 bandytami zabitymi mieczem → miecz 15 → kolejno; ucieczka/porażka → bez zmian; wróg zabity krwawieniem → bez przyrostu; trening wygrany → przyrost; migracja v5 → v6 (klasa włóczni: `wlocznie` 15), naprawa (150 → 100, `x` usunięty); karta „Miecz 16.4”.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS (cały `npm test`; symulacja C2a nadal w progu).
- [ ] **Step 5: Commit** `feat(walka): biegłość w broni i zapis v6`.

### Task 4: Techniki – dwie bronie i atak celowany

**Files:**
- Create: `src/systems/combat/techniques.js`
- Modify: `src/systems/combat/actions.js` (`ACTION_IDS` + `"techniques"`; `doAction` deleguje id technik), `src/systems/combat/state.js` (`combat.thrown`), `src/systems/combat/turn.js` (po walce `thrown` = null – przedmiot i tak nigdy nie opuszcza torby)
- Test: `test/combat_techniques.test.js`

**Interfaces:**
- Consumes: Task 1–3, `playerHitChance`, `rollDamage`, `mitigate`, `dealDamage`, `applyToEnemy`, zasady obucha i efektów broni z `actions.js` (wydziel wspólną funkcję ataku `strike(state, data, combat, { weapon, target, rng, hitPenalty, critBonus, damagePercent, skillOverride })` → zdarzenia, jeśli jej nie ma – bez duplikowania logiki).
- Produces:
  - `TECHNIQUE_IDS = ["aimed", "dual", "guard", "throw", "pickup"]`.
  - `dualState(state, data, combat)` → `{ active, main, second, thrownOut }` (`main` – broń z `bron`, `second` – ta sama przy `pair` albo broń z `bron_druga` przy głównej `melee` bez `pair`; `active` false przy `far` w ręku, braku drugiej, rzuconej drugiej).
  - `techniqueActions(state, data, combat)` → `[{ id, apCost, disabled, reason?, label? }]` (reasons: `combat.noAp`, `combat.noTarget`, `combat.noSecond`, `combat.secondThrown`, `combat.notThrown`, `combat.pickUpFar`).
  - `doTechnique(state, data, combat, { id, target?, zone? }, rng)` → `{ ok, events, endTurn }` – wg spec „Walka › Dwie bronie” i „Atak celowany”; `zone` ∈ `glowa|tulow|nogi`; rzut ustawia `combat.thrown = { uid, itemId }`; „Podnieś” czyści; przy parze z rzuconą włócznią zwykły atak ma karę `oneLeftPenalty` (przez `playerHitChance` – parametr `extraPenalty` albo odczyt `combat.thrown`).
  - `playerActions` dostaje pozycję `techniques` (disabled, gdy żadna technika niedostępna – reason `combat.noTechnique`).

- [ ] **Step 1: Testy (failing)** (atrapy RNG): dual aktywne dla pary i miecz+sztylet, nieaktywne dla łuku+sztyletu i miecza bez drugiej; „Atak obiema” 5 PA (3 + 2) przy parze, drugi cios z karą 10 (`chance` w zdarzeniu niższa o 10), przy miecz+sztylet drugi cios obrażeniami sztyletu (2–4) i typem kłute; „Uderz i zasłoń” 4 PA i `defendBonus` = max(…, 10); rzut włócznią z dystansu (umiejętność miotanie), `combat.thrown` ustawione, potem dual nieaktywne i zwykły atak z karą 10; „Podnieś” 2 PA tylko w zwarciu z celem rzutu albo po jego śmierci (inaczej `combat.pickUpFar`); po walce (`finishCombat`) `thrown` null, a `countOf(para_wloczni)` bez zmian (Review Focus 1); celowany w głowę: koszt +1, kara 25, krytyk +20, ogłuszenie 25% (atrapa); tułów: obrażenia +25%; nogi: spowolnienie 40%; upiór z `immune` – brak efektu; nieudana technika nie zmienia stanu (`structuredClone` + `deepEqual`).
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): techniki – dwie bronie, rzut i atak celowany`.

### Task 5: Reach, leap, spowolnienie i wróg strzelający z bliska

**Files:**
- Modify: `src/systems/combat/ai.js`, `src/systems/combat/formulas.js` (`enemyHitChance`: `far` w zwarciu − `rangedInMeleePenalty`), `src/systems/combat/actions.js` (ruch gracza zablokowany przy `noMove` – reason `combat.slowed`)
- Test: `test/combat_ai.test.js`, `test/combat_actions.test.js`

**Interfaces:**
- Produces: AI – wróg z `leap` na dystansie wchodzi w zwarcie za 0 PA raz na turę (zdarzenie `ruch` z `mover: uid`, `leap: true`); wróg wchodzący w zwarcie (ruch lub leap) z graczem, którego główna broń ma `reach`, przy aktywnej parze (nie rzuconej) i graczu nieogłuszonym → darmowy cios gracza (`strike` z Task 4) raz na turę wroga, zdarzenie `atak` z polem `reaction: true`; efekt z `noMove` blokuje ruch i leap (wróg) oraz akcję „move” (gracz); ataki `far` wroga dostępne w obu pasmach (zastępuje Ruling 6 z C2a), w zwarciu kara w `enemyHitChance`; AI `ranged` w zwarciu odskakuje, gdy ma PA na odskok i strzał, inaczej strzela z bliska.

- [ ] **Step 1: Testy (failing):** upiór na dystansie w swojej turze: zdarzenie `leap`, potem atak w tej samej turze (PA nie zmniejszone o ruch); drugi „leap” w tej samej turze niemożliwy; gracz z parą włóczni → wróg podchodzi → zdarzenie `atak` z `reaction: true` przed atakiem wroga; gracz ogłuszony albo po rzucie włócznią → brak reakcji; miecz (bez `reach`) → brak; spowolniony wróg nie podchodzi i nie skacze; spowolniony gracz – „move” wyszarzone z `combat.slowed`; wróg z atakiem `far` w zwarciu atakuje z `chance` o 20 niższą; AI `ranged` z 2 PA w zwarciu strzela (brak PA na odskok + strzał).
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS (symulacje C2a w progu).
- [ ] **Step 5: Commit** `feat(walka): reach, leap, spowolnienie i strzał wroga z bliska`.

### Task 6: Broń palna

**Files:**
- Create: `src/systems/combat/firearm.js`
- Modify: `src/systems/combat/actions.js` (strzał bronią z polami broni palnej przechodzi przez `firearm.js`), `src/systems/combat/state.js` (`combat.reinforced`, numeracja dołączających), `src/systems/inventory.js` (usunięcie założonej broni: `destroyEquipped(state, data, slot)` → zdejmuje i usuwa 1 sztukę)
- Test: `test/combat_firearm.test.js`

**Interfaces:**
- Produces: `misfireChance(state, data, weapon)` = `max(1, misfireChance − fart − floor(proch / misfirePerProch))`; `fireWeapon(state, data, combat, weapon, target, rng)` → zdarzenia: przy niewypale `niewypal` (PA i ładunek zużyte), przy rozerwaniu `rozerwanie` (`destroyEquipped(state, data, "bron")` – usuwa dokładnie 1 sztukę, obrażenia `burstDamage` przez `dealDamage`); przy oddanym strzale: atak (jak dotąd), morale −`fear` u wrogów z morale (zdarzenie `strach_bronia` z `fear`), rzut `noise` → `addReinforcements(state, data, combat, rng)` (raz na walkę, `def.reinforcements`, start `far`, numeracja kontynuowana z istniejących wrogów tego `id`, inicjatywa – dopisani na koniec kolejki), rzut `smoke` → `zadymienie` w `battlefield`.

- [ ] **Step 1: Testy (failing)** (pistolet w kopii stanu, fart 5, proch 20): szansa niewypału 15 − 5 − 2 = 8; niewypał przy atrapie ≤ 8 – brak trafienia, PA −4, `loaded` −1; rozerwanie przy atrapie ≤ 2 – pistolet znika z torby i z `equipped.bron`, HP gracza − 4…8; dwa pistolety w torbie (jeden w ręku) → po rozerwaniu zostaje 1 w torbie, `equipped.bron` puste (Review Focus 2); strach – morale bandyty 60 → 40, upiór (`null`) bez zmian; hałas – posiłki z `reinforcements: [{ id: "bandyta", count: 1 }]` przy dwóch bandytach w walce → nowy „Bandyta 3” na dystansie w kolejce; drugi rzut hałasu → bez kolejnych posiłków (Review Focus 5); bez `reinforcements` → nic; dym – `zadymienie` w `battlefield`; walka kończy się wygraną dopiero po pokonaniu także posiłków.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): broń palna – niewypał, rozerwanie, strach, hałas i dym`.

### Task 7: UI – podmenu Technik, strefy, pełny dziennik, znacznik pominiętych, teksty

**Files:**
- Modify: `src/scenes/combat.js`, `src/ui/combat_screen.js`, `src/ui/events.js`, `data/ui.json`
- Test: `test/combat_scene.test.js`, `test/combat_screen.test.js`, `test/events.test.js`

**Interfaces:**
- Consumes: `techniqueActions`, `doTechnique` (Task 4), nowe zdarzenia (Tasks 3–6).
- Produces: pozycja `[T] Techniki` (hotkey `t`) na liście akcji (10 pozycji); podmenu Technik (`select` z wyszarzeniami i powodem w `hint`, „Wróć”), po wyborze celu (jeśli potrzebny) i strefy (`combat.zone.glowa` „Głowa (+1 PA, −25)”, `tulow`, `nogi`, „Wróć”) wykonanie `doTechnique`; rysowanie jak pickery z C2a (górny blok + podmenu, ≤ 23 linie przy 24 wierszach); pełny dziennik `[L]`: `select` z wszystkimi wpisami (każdy wiersz = wpis, kursor na ostatnim, okno przewijania widżetu, „Wróć”) – mieści się w 24 wierszach przy 40+ wpisach (Review Focus 4); znacznik: gdy od ostatniego rysowania doszło więcej wpisów niż `logSize`, pierwsza linia dziennika `combat.logMore` „(+{n} wcześniej – [L])”; teksty nowych zdarzeń: `atak` z `reaction` („Twoja włócznia dosięga {target} za {damage}.”), `ruch` z `leap` („{name} skacze na ciebie!”), `niewypal`, `rozerwanie`, `strach_bronia`, `posilki`, `bieglosc` („Biegłość: {name} {after}.”), rzut bronią, podniesienie.

- [ ] **Step 1: Testy (failing):** każdy nowy tekst zdarzenia; lista akcji ma `[T] Techniki` i 10 pozycji, ekran ≤ 22 linie przy 80×24; podmenu Technik w TTY przy 24 wierszach ≤ 23 linie; atak celowany w głowę przez scenę (wejścia: `t`, numer techniki, cel, strefa) zużywa PA 4 (miecz 3 + 1); pełny dziennik z 45 wpisami w TTY przy 24 wierszach – żadna klatka > 24 linii, ostatni wpis widoczny; znacznik `(+2 wcześniej – [L])` po turze wrogów z 5 wpisami; wszystkie wejścia zużyte.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): techniki w menu, pełny dziennik i znacznik pominiętych wpisów`.

### Task 8: Adaptacyjny driver testów, demo i e2e obu klas

**Files:**
- Modify: `test/helpers.js` (driver), `test/e2e.test.js`, `test/cli.test.js`
- Test: `test/e2e.test.js`

**Interfaces:**
- Consumes: wszystko powyżej; scena walki w trybie liniowym (ekran tekstowy, akcje numerami/literami).
- Produces: `createAdaptiveIO(plan, { tty = false })` w `test/helpers.js` – skryptowe IO, które poza sceną walki podaje kolejne wejścia z `plan` (lista jak dotąd), a w scenie walki samo odpowiada wg strategii przekazanej w `plan` w miejscu walki (`{ fight: "win" | "lose" | "flee", techniques?: [...] }` – np. `{ fight: "win", techniques: ["dual"] }`): czyta bieżący ekran (ostatni wydruk), wybiera „Atak”/technikę na pierwszym żywym celu, opatrunek z pasa poniżej 40% HP, „Koniec tury”, gdy nic nie stać; po podsumowaniu wraca do `plan`. Testy przejścia demo (B1, B2, C1, C2a) przechodzą na driver – bez stałych sekwencji walki.
- e2e: klasa miecza – w kramie kupuje sztylet (`buy`), w obozie zakłada go do drugiej ręki (`e`, sztylet, „Załóż do drugiej ręki”), walka z bandytami z techniką „Atak obiema” (driver), wygrana; klasa włóczni – sparing z rzutem włócznią i podniesieniem, walka z bandytami wygrana; obie: `character.mastery` miecz / włócznie > 15 po walkach, `countOf(para_wloczni)` 1 po walkach (Review Focus 1), flagi, wszystkie wejścia zużyte. Ziarno dowolne stałe (driver nie zależy od ścieżki RNG – test przechodzi dla 3 różnych ziaren: 7, 10, 42).

- [ ] **Step 1:** Driver + testy e2e (failing). **Step 2:** FAIL. **Step 3:** przejście istniejących testów na driver. **Step 4:** PASS dla 3 ziaren, `--validate` czyste, ręczny przebieg `printf` przez potok bez błędu (sekwencja dla ziarna 7 dobrana ręcznie tylko na potrzeby tego jednego sprawdzenia).
- [ ] **Step 5: Commit** `test(e2e): adaptacyjny driver walk; demo z technikami i biegłością`.
