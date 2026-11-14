# Cykl C2a – rdzeń walki – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turowa walka z PA, dystansem, akcjami gracza, AI wrogów, morale, efektami turowymi (ogłuszenie traci turę, zamroczenie), ekranem 80×24 z dziennikiem, łupem/PD/porażką – sparing i walka z bandytami w demo dla obu klas.

**Architecture:** Czysty silnik `src/systems/combat/` (`state.js`, `formulas.js`, `effects.js`, `actions.js`, `ai.js`, `turn.js`): stan walki w pamięci + dane + RNG → zdarzenia. Scena `combat` i `src/ui/combat_screen.js` tylko rysują i pytają. Porażka w prawdziwej walce = `DefeatError` łapany w `app.js` (wczytanie najnowszego zapisu).

**Tech Stack:** Node.js ≥ 22, ESM, JSDoc, zero zależności, `node:test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-10-21-cykl-c2a-walka-rdzen-design.md` (binding). Spec główna: `docs/koncepcja-gry.md` (rozdz. 7–8).

## Global Constraints

- Zero zależności npm; tylko moduły `node:*`.
- `src/engine/*` (poza `loop.js`) i `src/systems/*` nie importują niczego z `src/ui/`. Silnik może importować systemy.
- Kod i nazwy techniczne po angielsku, krótkie JSDoc w stylu istniejącego kodu; treść gry i `id` danych po polsku bez diakrytyków.
- Każdy tekst widoczny dla gracza w `data/ui.json` (`combat.*`) lub `data/*`; „HP”, nie „ŻYC/PŻ”.
- Komunikaty walidacji: `plik › id › pole: opis` (`art/<id>.txt: …` dla grafik).
- Wszystkie liczby walki w `rules.json › combat` (klucze dokładnie jak w spec), nie w kodzie.
- Funkcje silnika przy błędzie gracza zwracają `{ ok: false, reason }` i nie zmieniają stanu; rzucają przy błędzie programisty.
- RNG wyłącznie przez `rng.int(min, max)` z kontekstu (deterministyczne testy z `createRng(seed)` i atrapami `{ int: () => k }`).
- Jeden widżet wyboru wszędzie; tryb liniowy działa dla każdej decyzji; testy skryptowe zużywają wszystkie wejścia (`InputExhaustedError` na końcu).
- Każde zadanie kończy się zielonym `npm test`, czystym `node bin/game.js --validate` i commitem na gałęzi `cykl-c2a`.

## Review Focus

1. Walka nigdy się nie zawiesza: AI bez sensownej akcji kończy turę, gracz zawsze ma dostępne „Koniec tury”, limit 200 rund (test w Task 7: wróg niezdolny do ataku – walka kończy się remisem po limicie, bez wyjątku).
2. Sparing nigdy nie zabija i nie wczytuje zapisu: HP obu stron ≥ 1, wynik wygrana/porażka bez `DefeatError` (test w Task 7 i 9, 200 ziaren).
3. Przerwanie gry w środku walki (Ctrl+C z zapisem, koniec wejścia) – zapis wskazuje scenę walki sprzed walki, po wczytaniu walka od nowa, bez podwójnego PD/łupu (test w Task 9).
4. Ekran walki w terminalu 80×24 nie przekracza 22 wierszy i nie zawija linii; węższy/niższy – bez grafiki (test w Task 8 z `columns`/`rows`).
5. Ogłuszony (gracz albo wróg) traci dokładnie jedną turę, także gdy ogłuszenie nałożono w jego własnej turze lub tuż przed nią (test w Task 4).

---

### Task 1: Dane walki – wrogowie, grafiki, efekty, przedmioty, reguły; walidacja

**Files:**
- Create: `data/enemies.json`, `data/art/instruktor.txt`, `data/art/bandyta.txt`, `src/systems/combat/data.js` (`enemyById`, `validateEnemies`, `validateArt`)
- Modify: `data/effects.json`, `data/items.json`, `data/rules.json`, `data/shops.json` (garnek ×1), `src/systems/effects.js` (pola `skipTurn`, `dazed`), `src/systems/items.js` (`weapon.effects`), `src/engine/data.js` (ładowanie `enemies.json` po `effects.json` i `data/art/*.txt` do `data.art` – obiekt `{ id: string[] linii }`), `test/helpers.js`
- Test: `test/data.test.js`, `test/combat_data.test.js`

**Interfaces:**
- Produces: `data.enemies` (tablica, schemat spec „Dane › data/enemies.json” + opcjonalne `nameAcc` – biernik nazwy do dziennika, domyślnie `name`; dane demo: „Bandytę”, „Instruktora”), `data.art` (`{ [id]: string[] }`), `enemyById(data, id)`, `validateEnemies(enemies, data)` → `string[]` (prefiks `enemies.json › <id> › `), `validateArt(art)` → `string[]`, `AI_TYPES = ["aggressive", "cautious", "ranged"]`; `rules.combat` dokładnie z bloku spec.
- `minimalData()` dostaje `enemies` i `art` z prawdziwych plików.

- [ ] **Step 1: Testy walidacji (failing)** – prawdziwe dane → `[]`; po jednym przypadku na każde pole: nieznany `ai` (`enemies.json › x › ai: nieznany typ AI "magia"`), atak z `damage` bez `damageType`, atak bez obrażeń i bez `effects` (`… attacks[0]: atak bez obrażeń wymaga effects`), `hit: 99` (`… attacks[0].hit: wartość poza zakresem 5–95`), `effects[0].id: "brak"`, `immune: ["brak"]`, `effectResist: { strach: 150 }`, `morale: 120`, `loot[0]` z akcją `takeMoney` (`… loot[0]: dozwolone akcje giveItem, giveMoney, setFlag`), `loot[0].chance: 0`, `art: "brak"` (`enemies.json › x › art: brak pliku art/brak.txt`); grafika 41 znaków w wierszu (`art/x.txt: wiersz 1 ma 41 znaków (max 40)`), 8 wierszy (`art/x.txt: 8 wierszy (max 7)`); `skipTurn` przy `unit: "hour"` (`effects.json › x › skipTurn: dozwolone tylko dla unit turn`); `weapon.effects[0].id` efekt godzinowy (`items.json › x › effects[0].id: efekt "zmeczenie" nie jest turowy`); brak `rules.combat`.
- [ ] **Step 2:** FAIL. **Step 3:** dane wg spec (tabela „Zestaw demo”, `ogluszenie` z `skipTurn: true` bez `modifiers`, nowe `zamroczenie` z `dazed: true`, `garnek_huku`, sekcja `rules.combat`), grafiki ≤ 40×7 (krótko: postać z drewnianym mieczem / zbir z pałką), walidacja. **Step 4:** PASS, `--validate` czyste.
- [ ] **Step 5: Commit** `feat(dane): wrogowie, grafiki, efekty walki i reguły walki`.

### Task 2: Zapis v5 – `inventory.loaded`

**Files:**
- Modify: `src/config.js` (5), `src/engine/state.js`, `src/engine/save.js`, `data/ui.json`
- Test: `test/save.test.js`

**Interfaces:**
- Produces: `state.inventory.loaded` (`{ [weaponId]: integer ≥ 0 }`), `migrations[4]` (`loaded = {}`), schemat (obiekt liczb całkowitych ≥ 0), naprawa (`load.repair.loaded`): nieznane przedmioty / bez `reload` usunięte, wartości > `capacity` obcięte.

- [ ] **Step 1: Testy (failing):** v4 → v5 z `loaded: {}`; cykl zapis/wczytanie zachowuje `{ luk_mysliwski: 1 }`; `{ miecz_krotki: 1 }` → usunięte z ostrzeżeniem; `{ kusza_lekka: 5 }` → 1 z ostrzeżeniem; `{ luk_mysliwski: -1 }` → `LoadError`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS (cały `npm test`).
- [ ] **Step 5: Commit** `feat(zapis): format v5 ze stanem naładowania broni`.

### Task 3: Stan walki i wzory

**Files:**
- Create: `src/systems/combat/state.js`, `src/systems/combat/formulas.js`
- Test: `test/combat_formulas.test.js`

**Interfaces:**
- Consumes: `getStats` (`attributes`, `skills`, `derived.ap/defense/armor/reduction`, `other`), `itemById`, `enemyById`, `timeOfDay`.
- Produces:
  - `createCombat(state, data, def, rng)` → `combat`: `{ def, enemies: [{ uid, id, name, hp, hpMax, band: "far"|"melee", morale, effects: [], fled: false, dead: false, ap: 0 }], order: ["player" | uid…], turn: 0, round: 1, playerAp: 0, defendBonus: 0, battlefield: [], log: [], outcome: null, xpFled: 0, training: !!def.training }`; `def` = obiekt sceny walki (`enemies`, `start`, `canFlee`, `nonLethal`, `training`, `minutes`). Nazwy: `Bandyta 1`, `Bandyta 2` przy `count > 1`, sama nazwa przy 1; `uid` = `"<id>#<n>"`. `order` wg inicjatywy (spec „Wzory”), remis gracz pierwszy.
  - `livingEnemies(combat)`, `enemyByUid(combat, uid)`, `isOver(combat)` → `"win" | "defeat" | "fled" | null`.
  - `playerHitChance(state, data, combat, weapon, enemy)`, `enemyHitChance(state, data, combat, enemy, attack)`, `rollDamage(rng, { damage, damageType, melee, sila, bonus, critChance })` → `{ raw, crit }`, `mitigate({ raw, crit, armor, armorPierce, reductionPercent, taken })` → liczba, `fleeChance(state, data, combat)`, `dealDamage(combat, target, amount)` – HP nie poniżej 0, przy `combat.training` nie poniżej 1 (gracz: `state.character.hp`; wróg: `enemy.hp`, `dead` przy 0). Wszystkie wg spec „Wzory”, liczby z `rules.combat`.

- [ ] **Step 1: Testy (failing):** trafienie gracza: umiejętność 35, obrona 10 → 55; `minStrength` 4 przy sile 3 → −10; broń `far` z wrogiem w zwarciu → −20; noc (`rangedHitChance` −15) dla łuku; obcięcie do 5 i 95; trafienie wroga z `dazed` → −20, z morale 20 → −10, gracz z `defendBonus` 10 → −10; obrażenia: kusza 8–14 przebicie 3 przeciw pancerzowi 6 i `damageTaken.klute 0.5` (atrapa RNG 10 → `floor(max(0, 10 − 3) × 1 × 0.5)` = 3), krytyk (×1.5, pomija pancerz), redukcja 30% obcięta do 75 przy sumie 90, minimum 1, `damageTaken` 0 → 0; bonus siły w zwarciu `max(0, siła − 5)`; ucieczka `30 + 3 × 5 − 10 × 1` = 35, obcięcie 5–95; inicjatywa z atrapą RNG (remis → gracz pierwszy); `createCombat` z `count: 2` → nazwy `Bandyta 1/2`, `band` z `start`; `dealDamage` w trybie `training` nie schodzi poniżej 1.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): stan walki, inicjatywa i wzory`.

### Task 4: Efekty w walce – nakładanie, ogłuszenie, zamroczenie, tyknięcia

**Files:**
- Create: `src/systems/combat/effects.js`
- Modify: `src/systems/effects.js` (`applyEffect(…, { force, inCombat })` – przy `inCombat: true` efekty `turn` dozwolone)
- Test: `test/combat_effects.test.js`

**Interfaces:**
- Consumes: `applyEffect`, `effectById`, `createCombat`, `dealDamage`.
- Produces:
  - `applyToEnemy(data, combat, enemy, id, rng, { chancePenalty = 0 } = {})` → `{ applied, resisted, immune }` (`immune` → brak; `effectResist[id]` → rzut `≤` = odporność wg `resistOutcome`; kumulacja jak u gracza; `strach` → morale −20 raz).
  - `applyToPlayer(state, data, id, rng)` → wynik `applyEffect(…, { inCombat: true })`.
  - `startTurnEffects(state, data, combat, who, rng)` → zdarzenia: tyknięcia `tick.damage` × stosy (`efekt_obrazenia` z `target`), `rozkojarzenie` – szansa `loseApChance` utraty `loseAp`; zwraca też `skip: boolean` (aktywny efekt z `skipTurn`).
  - `endTurnEffects(state, data, combat, who)` → `remaining − 1` efektów `turn` celu, zdarzenia `efekt_koniec`.
  - `endRoundBattlefield(combat)` → odliczanie `battlefield`.
  - `isDazed(enemy)`; `clearTurnEffects(state)` (po walce).
  - `who` = `"player"` albo `uid` wroga. Zdarzenia mają pole `target` (`"player"` | `uid`).

- [ ] **Step 1: Testy (failing):** `applyToPlayer(oslepienie)` działa w walce (a `applyEffect` bez `inCombat` dalej rzuca); wróg z `immune: ["oslepienie"]` → `immune: true`; `effectResist: { strach: 100 }` → zawsze odporny; `strach` na wrogu z morale 60 → 40; ogłuszenie nałożone w turze wroga → `startTurnEffects` gracza zwraca `skip: true`, po `endTurnEffects` efekt znika → następna tura `skip: false` (dokładnie jedna utracona tura – Review Focus 5); ogłuszenie nałożone na wroga w turze gracza → wróg traci najbliższą swoją turę; `zamroczenie` u gracza → `getStats().attributes.zrecznosc` −2; `isDazed` wroga → `true`; `krwawienie` ×2 → tyknięcie 2× zakres na początku tury; `zadymienie` odlicza się tylko w `endRoundBattlefield`; `clearTurnEffects` zostawia efekty `hour`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): efekty turowe, ogłuszenie i zamroczenie`.

### Task 5: Akcje gracza

**Files:**
- Create: `src/systems/combat/actions.js`
- Test: `test/combat_actions.test.js`

**Interfaces:**
- Consumes: Task 3–4, `useConsumable` (bez czasu – patrz niżej), `swapWeapons`, `removeItem`, `countOf`, `itemById`.
- Produces:
  - `ACTION_IDS = ["attack", "reload", "use", "swap", "move", "defend", "flee", "end", "log"]`.
  - `playerActions(state, data, combat)` → `[{ id, apCost, disabled, reason? }]` (reasons: `combat.noAp`, `combat.noAmmo`, `combat.notLoaded`, `combat.noTarget`, `combat.noFlee`, `combat.nothingToUse`, `combat.alreadyLoaded`).
  - `attackTargets(state, data, combat)` → uid-y w zasięgu broni; `useOptions(state, data, combat)` → `[{ itemId, from: "belt"|"bag", apCost, needsTarget }]`.
  - `doAction(state, data, combat, { id, target?, itemId? }, rng)` → `{ ok: true, events, endTurn: boolean }` lub `{ ok: false, reason }`. Zachowanie wg spec „Akcje gracza” i „Wzory” (obuch: krytyk → `ogluszenie` szansą `bluntCritStun`, trafienie → `zamroczenie` szansą `bluntDaze`; `weapon.effects` osobnymi rzutami; strzał zużywa `inventory.loaded[id]`; przeładowanie ładuje do `capacity` zużywając amunicję; użycie środka – leczenie z `useConsumable` **bez** `advanceTime` (nowa opcja `useConsumable(…, { advance: false })`); rzucane – trafienie z `miotanie`, `single_splash` na wrogów w paśmie celu, chybienie ×`missEffectMultiplier` i czas −1, rzut ≥ `fumbleRoll` (przy `fart ≥ fumbleFart` tylko 100) → efekty na gracza, `battlefield` bez testu do `combat.battlefield`; przedmiot rzucany zużyty; odskok od wroga w zwarciu z atakiem `melee` → darmowy atak tego wroga; obrona = `defendBonus = defendPerAp × PA`, `endTurn: true`; ucieczka – rzut `fleeChance`, sukces → `combat.outcome = "fled"`, porażka → `endTurn: true`).
  - Zdarzenia (nazwy używane przez Task 8): `atak` `{ attacker, target, hit, damage, crit, chance }`, `przeladowanie` `{ weapon }`, `uzycie` `{ item, target? }`, `leczenie` `{ amount }`, `zmiana_broni`, `ruch` `{ target, band }`, `obrona` `{ bonus }`, `ucieczka` `{ success }`, `wrog_pokonany` `{ target }`, oraz zdarzenia efektów z Task 4 (`efekt_nalozony`/`efekt_odparty`/`efekt_odporny` z `target`).

- [ ] **Step 1: Testy (failing)** – na stanie z zestawem klasy i atrapą RNG: atak mieczem w zwarciu (koszt 3, trafienie/pudło wg `chance`), broń `melee` bez celu w zwarciu → `combat.noTarget`; łuk bez naładowania → `combat.notLoaded`, przeładowanie (1 PA, strzała −1, `loaded.luk_mysliwski` 1), strzał zużywa ładunek; brak strzał → `combat.noAmmo`; opatrunek z pasa (3 PA) vs z torby (5 PA), leczenie bez zmiany `time.minutes`; garnek huku `single_splash`: cel i drugi wróg w tym samym paśmie ogłuszeni, wróg w innym paśmie nie; chybienie rzutem → szansa efektu ×0.5; rzut 99 → ogłuszenie gracza; obuch (pięści) krytyk → ogłuszenie przy RNG ≤ 50; odskok od bandyty w zwarciu → zdarzenie `atak` bandyty; obrona z 4 PA → `defendBonus` 20, `endTurn`; ucieczka przy `canFlee: false` → wyszarzona `combat.noFlee`; za mało PA → `combat.noAp`; nieudana akcja nie zmienia stanu (`structuredClone` + `deepEqual` stanu gry i walki).
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): akcje gracza`.

### Task 6: AI wrogów i morale

**Files:**
- Create: `src/systems/combat/ai.js`
- Test: `test/combat_ai.test.js`

**Interfaces:**
- Consumes: Task 3–5.
- Produces: `enemyTurn(state, data, combat, uid, rng)` → zdarzenia (`atak` z `attacker: uid`, `ruch`, `wrog_ucieka` `{ target }`, efekty). Wróg wydaje PA wg spec „AI wrogów”; wybór ataku z wagą `weight` spośród dostępnych (PA, zasięg pasma); efekty ataku na gracza przez `applyToPlayer` z szansą −`dazedPenalty` przy zamroczonym wrogu; ataki obuchowe wroga → szansa `bluntDaze` na zamroczenie gracza; `cautious` ucieka przy HP < `cautiousHpPercent`% albo morale < `moraleThreshold` (`fled: true`, koniec tury); `onAllyDeath(combat)` – pozostali −`moraleOnAllyDeath` (wołane przy `wrog_pokonany`). Brak sensownej akcji → koniec tury.

- [ ] **Step 1: Testy (failing):** `aggressive` na dystansie → `ruch` (2 PA) i atak w zwarciu w tej samej turze (6 PA: 2 + 3, zostaje 1 – koniec); `ranged` w zwarciu odskakuje; `cautious` przy HP 5/18 ucieka; śmierć towarzysza → morale 60 → 40; dwa ataki z wagą 3:1 – przy atrapie RNG wybór zgodny z wagą; zamroczony wróg – szansa trafienia −20 (sprawdź `chance` w zdarzeniu); wróg bez ataku w zasięgu i bez ruchu (atak `melee`, `canMove` niemożliwe) kończy turę bez pętli.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): AI wrogów i morale`.

### Task 7: Przebieg tur, koniec walki, nagrody, symulacja balansu

**Files:**
- Create: `src/systems/combat/turn.js`
- Test: `test/combat_turn.test.js`, `test/combat_sim.test.js`

**Interfaces:**
- Consumes: Task 3–6, `addXp`, `runActions`, `advanceTime`.
- Produces:
  - `beginTurn(state, data, combat, rng)` → `{ who, skip, events }` – odnowienie PA aktualnego uczestnika (gracz `derived.ap` + `defendBonus` zerowany; wróg `ap` + modyfikatory), `startTurnEffects`.
  - `endTurn(state, data, combat)` → zdarzenia – `endTurnEffects`, przejście do następnego żywego, nieuciekłego uczestnika, na końcu rundy `endRoundBattlefield` i `round + 1`; po rundzie 200 → `combat.outcome = "draw"`.
  - `runEnemyTurns(state, data, combat, rng)` → zdarzenia – pętla tur wrogów aż do tury gracza albo końca walki (skip ogłuszonych).
  - `outcomeOf(state, combat)` → `"win" | "defeat" | "fled" | "draw" | null` (w `training`: HP gracza 1 → `"defeat"`, wszyscy wrogowie HP 1 → `"win"`).
  - `finishCombat(state, data, combat, rng)` → `{ outcome, xp, events }`: `clearTurnEffects`; czas `+minutes`; `win`: PD (pokonani + połowa uciekłych, `addXp`), łup z pokonanych (`runActions` na wpisach, które przeszły rzut `chance`); flagi `combat_<sceneId>_wygrana|_ucieczka|_porazka` (`sceneId` z `combat.def.id`); `draw` traktowany jak `fled`.

- [ ] **Step 1: Testy (failing):** pełna walka z atrapą RNG (gracz zawsze trafia) → `win`, PD 80 za 2 bandytów, łup `giveMoney 4` ×2 = +8 gr, `time.minutes` +10, flaga; jeden bandyta ucieka → PD 40 + 20; porażka gracza → `defeat`, brak PD; wróg niezdolny do działania (data-copy: atak `melee`, `apCost` > PA) i gracz tylko kończy turę → po 200 rundach `draw` bez wyjątku (Review Focus 1); ogłuszony wróg pomijany w `runEnemyTurns`; `training`: HP nigdy < 1, wynik bez `defeat`-ze-śmiercią.
  - `combat_sim.test.js`: 200 ziaren `createRng(seed)`, prosta strategia gracza (atakuj, gdy możesz; lecz się poniżej 40% HP; inaczej koniec tury), postać 1. poziomu z zestawem klasy miecza i klasy włóczni przeciw 2× `bandyta` – wygrane ≥ 60% dla każdej klasy; sparing z `instruktor` – HP gracza nigdy < 1 (Review Focus 2). Jeśli próg nie wychodzi, implementator stroi liczby `bandyta` w `enemies.json` (nie wzory) i zapisuje zmianę w raporcie.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): przebieg tur, koniec walki, nagrody i symulacja balansu`.

### Task 8: Ekran walki i teksty dziennika

**Files:**
- Create: `src/ui/combat_screen.js`
- Modify: `src/ui/events.js` (zdarzenia walki → teksty), `data/ui.json`
- Test: `test/combat_screen.test.js`, `test/events.test.js`

**Interfaces:**
- Consumes: zdarzenia z Task 4–7, `data.art`, `statusBar` (pasek czasu), `formatRemaining`.
- Produces:
  - `combatEventText(ui, data, combat, event)` → tekst wpisu dziennika (lub `null` dla zdarzeń bez wpisu) – klucze `combat.*`: m.in. `combat.hit` „{attacker} trafia {target} za {damage}.”, `combat.hitYou` „{attacker} trafia cię za {damage}.”, `combat.youHit` „Trafiasz {target} za {damage}.”, `combat.crit` „ (krytyk!)”, `combat.miss` „{attacker} chybia.”, `combat.youMiss` „Chybiasz.”, `combat.stunned` „{name} jest ogłuszony i traci turę.”, `combat.youStunned` „Kręci ci się w głowie – tracisz turę.”, `combat.defeated` „{target} pada.”, `combat.flees` „{target} ucieka.”, `combat.reload`, `combat.use`, `combat.move`, `combat.defend`, `combat.fleeOk`, `combat.fleeFail`, `combat.effect`, `combat.resisted`, `combat.immune`. Wróg jako dopełnienie (`{target}` w `combat.youHit` itd.) używa `nameAcc` (z Task 1) z numerem: „Trafiasz Bandytę 1 za 6.”.
  - `renderCombat(state, data, combat, { columns, rows, targetUid })` → `string[]` wg spec „Ekran walki”: górny blok 7 wierszy (grafika ≤ 40 kolumn + prawa kolumna od kolumny 42: nazwa i pasek HP celu, efekty celu, lista wrogów ≤ 2 wiersze z `+N`, ostatnie `logSize` wpisów), pasek czasu, stan gracza (`HP x/y`, `PA ●●●○○○ (3/6)`, efekty), broń (`[naładowana]`) i pas. Przy `columns < 80` lub `rows < 24`: bez grafiki. Każda linia ≤ `columns − 2` (bez zawijania).
  - `combatActionItems(ui, actions)` → pozycje widżetu `select` (`[A] Atak (4 PA)`, hotkeys z spec, wyszarzone z powodem w `hint`).

- [ ] **Step 1: Testy (failing):** każdy typ zdarzenia → dokładny tekst; `renderCombat` przy 80×24 – ≤ 13 linii (blok + 3), żadna dłuższa niż 78, zawiera `Bandyta 1`, `PA ●●●○○○ (3/6)`, `[naładowana]` dla naładowanego łuku; razem z 9 akcjami + opis ≤ 22 (Review Focus 4); przy 60 kolumnach – bez linii grafiki; `combatActionItems` – `[A] Atak (3 PA)` i wyszarzona ucieczka z `(niedostępne)`/powodem.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja (grafiki walidowane w Task 1 mają ≤ 40 znaków). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): ekran walki i dziennik`.

### Task 9: Scena `combat`, porażka, rozmowa z walką

**Files:**
- Create: `src/scenes/combat.js`
- Modify: `src/scenes/index.js`, `src/scenes/schemas.js`, `src/scenes/errors.js` (`DefeatError`), `src/app.js` (łapanie `DefeatError`: ekran porażki `combat.defeat` „Padasz. Ciemność.”, Enter, wczytanie najnowszego zapisu po `savedAt` z `listSaves` spośród `auto`/`1`/`2`/`3`, brak → menu główne), `src/scenes/dialogue.js` (wynik `walka` + `scene.onCombat` → walka przez tę samą funkcję co scena `combat`), `src/engine/data.js` (walidacja sceny `combat` i `onCombat` wg spec), `data/ui.json`
- Test: `test/scenes.test.js`, `test/data.test.js`, `test/app.test.js` (albo `scenes.test.js` dla `runApp`)

**Interfaces:**
- Consumes: Task 3–8, `select`, `pressEnter`, `clear`, `flushNotices`, `pushEventNotices`, `campMenu` (nie po walce – po walce zwykły komunikat podsumowania + `pressEnter`).
- Produces: `runCombat(ctx, def)` → `"win" | "defeat" | "fled" | "draw"` (używany przez scenę i rozmowę); typ sceny `combat` (pola spec); przejścia: handler zwraca `{ goto: def.onFlee }` / `{ goto: def.onDefeat }` (`runScenes` w `loop.js` używa `result.goto` przed `scene.goto`); `fled` → `onFlee`, `defeat` → `onDefeat` (HP = 1) / `nonLethal` (HP = 1, dalej) / inaczej `throw new DefeatError()`; po walce ekran podsumowania (`combat.summaryWin` „Zwycięstwo. +{xp} PD.” + łup przez `pushEventNotices`, `combat.summaryFled`, `combat.summaryLost`). Pętla UI: `clear` → `renderCombat` → `select` akcji (`combatActionItems`) → przy `attack`/rzucanym z celem przy > 1 celu drugi `select` z celami (z „Wróć”) → `doAction` → wpisy dziennika → przy `endTurn`/„Koniec tury” `endTurn` + `runEnemyTurns` + `beginTurn` gracza; `[L]` – pełny dziennik w `select` (tylko „Wróć” aktywne) bez kosztu.

- [ ] **Step 1: Testy (failing)** (skryptowe IO, atrapa/ziarno RNG):
  - walka z 1 bandytą do wygranej (wejścia: numery akcji, `k`) → flaga `combat_x_wygrana`, PD, łup, podsumowanie; wszystkie wejścia zużyte.
  - ucieczka udana → scena `onFlee` następna.
  - porażka w prawdziwej walce → `DefeatError`; `runApp`: ekran „Padasz. Ciemność.”, wczytanie najnowszego zapisu (dwa zapisy o różnych `savedAt` – wczytany nowszy), brak `crash`.
  - sparing (`training`, `nonLethal`) – porażka → gra idzie dalej, HP 1, bez `DefeatError`.
  - przerwanie gry w walce (`InputExhaustedError` w środku) → zapis `auto` wskazuje scenę walki, `character.xp`/pieniądze jak przed walką; po wczytaniu walka od nowa (Review Focus 3).
  - `l` – dziennik, `w`/Wróć – powrót bez utraty PA.
  - TTY: `<down>` + `<enter>` wybiera drugą akcję.
  - rozmowa z wynikiem `end:walka` i `onCombat` → walka i flaga.
  - walidacja: nieznany wróg, `onFlee` do nieistniejącej sceny, `training` bez `nonLethal`, brak kreatora wcześniej.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(walka): scena walki, porażka i walka z rozmowy`.

### Task 10: Demo – sparing i bandyci; e2e obu klas

**Files:**
- Modify: `data/story.json`, `test/e2e.test.js`, `test/cli.test.js`
- Test: `test/e2e.test.js`

**Interfaces:**
- Consumes: wszystko powyżej.
- Demo wg spec „Demo `story.json` po C2a”: `demo_sparing` skrócona do wstępu, `demo_sparing_walka` (`instruktor`, `start: "melee"`, `training`, `nonLethal`, `canFlee: false`), `demo_sparing_wygrana` / `demo_sparing_porazka` (narracje z `if` na flagach `combat_demo_sparing_walka_wygrana` / `_porazka`), przed `demo_kurier`: `demo_droga` (narracja, zasadzka) i `demo_droga_bandyci` (2× `bandyta`, `start: "far"`, `canFlee: true`, `onFlee: "demo_droga_ucieczka"`), `demo_droga_ucieczka` (narracja; przechodzi dalej do `demo_kurier`). Teksty w stylu „Styl i ton”, 2–4 zdania.
- e2e (bez TTY, ustalone ziarno – implementator dobiera ziarno i prostą sekwencję akcji, przy której klasa miecza wygrywa sparing i walkę z bandytami, a klasa włóczni przegrywa sparing i ucieka bandytom; ziarna opisane w teście): asercje flag wyniku, PD, łupu (pieniądze), `inventory.loaded` bez zmian (brak łuku), wszystkie wejścia zużyte; istniejące testy e2e/cli zaktualizowane tylko o nowe sceny.

- [ ] **Step 1:** Testy e2e (failing). **Step 2:** FAIL. **Step 3:** dane demo. **Step 4:** PASS, `node bin/game.js --validate` czyste, ręczny przebieg `printf` przez potok (`node bin/game.js --seed 7`) bez błędu.
- [ ] **Step 5: Commit** `feat(demo): sparing z instruktorem i zasadzka bandytów; e2e obu klas`.
