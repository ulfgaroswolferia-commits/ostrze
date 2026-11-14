# Cykl D1 – mistyka: artefakty i zjawiska – plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Artefakty (ładunek, regeneracja z warunkami, pasywy, zdolności w walce, użycie na pusto, broń-artefakt), zjawiska (losowanie dzienne, zapowiedź, start, koniec, wpływ na artefakty, gracza i wrogów, blokada broni), wystawienie artefaktu w odpoczynku z ryzykiem złodzieja, pasek stanu – i Kamień Zmierzchu w demo.

**Architecture:** Dwa nowe moduły systemu: `src/systems/artifacts.js` (stan `state.artifacts`, regeneracja, pasywy, zdolności) i `src/systems/phenomena.js` (stan `state.world.phenomenon`, losowanie, aktualizacja, modyfikatory). `advanceTime` woła je jawnie w stałej kolejności. Walka korzysta z nich przez `getStats`, `strike`, `resolveEnemyAttack` i podmenu Technik; odpoczynek – przez `setExposed` i nowy rzut ryzyka.

**Tech Stack:** Node.js ≥ 22, ESM, JSDoc, zero zależności, `node:test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-10-21-cykl-d1-mistyka-design.md` (binding). Poprzedni: `docs/superpowers/specs/2026-10-21-cykl-c2b-walka-rozszerzenia-design.md` i ledger `docs/superpowers/plans/2026-10-21-cykl-c2b-ledger.md`.

## Global Constraints

- Zero zależności npm; tylko `node:*`.
- `src/engine/*` (poza `loop.js`) i `src/systems/*` nie importują z `src/ui/`.
- Kod po angielsku, krótkie JSDoc; treść i `id` po polsku bez diakrytyków; każdy tekst dla gracza w `data/ui.json` lub `data/*`; „HP”.
- Komunikaty walidacji: `plik › id › pole: opis`.
- Wszystkie nowe liczby w `rules.json` (`artifacts`, `exposure`, `phenomena` – dokładnie jak w spec) albo w danych przedmiotów/zjawisk.
- Silnik przy błędzie gracza zwraca `{ ok: false, reason }` bez zmiany stanu; rzuca przy błędzie programisty.
- RNG tylko przez `rng.int(min, max)`; deterministyczne testy (`createRng(seed)`, atrapy).
- Ekran walki przy 80×24: ≤ 22 wiersze, bez zawijania; pickery/podmenu ≤ 23 linie przy 24 wierszach; testy skryptowe zużywają wszystkie wejścia.
- Kolejność zdarzeń na pełnej godzinie: `rollDaily` → `update` (zapowiedź/start/koniec) → `zmiana_pory` → tyknięcia efektów → `HOURLY_HOOKS`; regeneracja na każdy odcinek przed nimi.
- Każde zadanie: zielony `npm test` (czyste wyjście), czyste `node bin/game.js --validate`, commit na `cykl-d1`.

## Review Focus

1. Artefakt nigdy nie występuje w 2 sztukach: łup sceny po wygranej, ponowne przejście sceny, nagroda, zakup – drugi egzemplarz odrzucony bez utraty ładunku (test w Task 2 i 7).
2. Sen 8 h przechodzący przez północ i przez zjawisko: każdy dzień losowany raz, zapowiedź → start → koniec w kolejności, ładunek bez skoków poza 0…max (test w Task 3).
3. Kradzież założonego artefaktu przez złodzieja zdejmuje go ze slotu, pasywy znikają z `getStats`, a pasek stanu i Techniki nie pokazują artefaktu (test w Task 5).
4. Zapis i wczytanie w trakcie zjawiska (zapowiedź już pokazana) nie powtarza zapowiedzi ani nie losuje drugiego zjawiska tego dnia (test w Task 3).
5. Zdolność „all” przy ładunku 0 i `whenEmpty` przy HP ≤ `costHp` – wyszarzona, nigdy nie zabija gracza (test w Task 4).

---

### Task 1: Dane – artefakty, zjawiska, efekty, reguły; walidacja

**Files:**
- Create: `data/phenomena.json`
- Modify: `data/items.json` (`kamien_zmierzchu`, `miecz_gwiazd_test`), `data/effects.json` (`ostrze_ognia`, `zaslona`), `data/rules.json` (`artifacts`, `exposure`, `phenomena`), `src/systems/items.js` (walidacja typu `artifact`), `src/engine/data.js` (wczytanie `phenomena.json`, schemat reguł, unikatowość artefaktów w stock/łupach/nagrodach), `src/scenes/schemas.js` (scena `phenomenon`; pole `loot` sceny `combat`), `data/ui.json` (nazwy warunków regeneracji `artifact.when.<warunek>`, rodzaje zjawisk `phenomenon.kind.<rodzaj>`)
- Test: `test/data.test.js`

**Interfaces:**
- Produces: `data.phenomena` (lista), pola artefaktu i zjawiska wg spec „Dane”; `REGEN_CONDITIONS = ["night", "day", "in_combat"]` + prefiksy `phenomenon:` i `near:` (eksport z `src/systems/items.js`); scena `{ type: "phenomenon", id, next }`; scena `combat` z opcjonalnym `loot: [{ chance, giveItem | giveMoney }]` (ten sam format co łup wroga) – dawany raz po wygranej (wykonanie w Task 4).
- Ruling planu: spec mówi o „pewnym łupie bandytów”; łup per wróg dałby 2 artefakty przy 2 bandytach, więc łup artefaktu idzie na poziom sceny (`loot` sceny `combat`).

- [ ] **Step 1: Testy walidacji (failing)** – prawdziwe dane `[]`; każdy komunikat z listy spec „Walidacja” (kopia danych z jednym błędem na test); `loadData` zawiera `kamien_zmierzchu`, `miecz_gwiazd_test` (`hidden`), trzy zjawiska z tabeli spec (wartości z tabeli), `ostrze_ognia`, `zaslona`, `rules.exposure.riskPerHour === 8`; łup sceny z artefaktem `count`/`qty` 2 → `story.json › s › loot[0]: artefakt może wystąpić najwyżej raz`.
- [ ] **Step 2:** `node --test test/data.test.js` – FAIL.
- [ ] **Step 3:** dane i walidacja (artefakt-broń walidowany też jak broń; `bystroscSkillPenalty` ≤ 0; `enemyModifiers.<tag>` tylko `hitChance|damage|defense`).
- [ ] **Step 4:** `npm test` PASS, `node bin/game.js --validate` → „Dane poprawne.”
- [ ] **Step 5: Commit** `feat(dane): artefakty, zjawiska, efekty i reguły mistyki`.

### Task 2: Artefakty – stan, regeneracja, pasywy, broń-artefakt, zapis v7

**Files:**
- Create: `src/systems/artifacts.js`
- Modify: `src/systems/inventory.js` (`addItem` artefaktu: wpis stanu przy pierwszym dodaniu; drugi egzemplarz → `{ ok: false, reason: "inv.artifactUnique" }`), `src/systems/items.js` (`slotAccepts` dla artefaktu `talizman` / artefaktu-broni), `src/systems/stats.js` (źródło `passiveModifiers`), `src/engine/state.js` (`artifacts: {}`, `world.phenomenon: null`, `world.phenomenonRolledDay: 0`), `src/config.js` (`SAVE_FORMAT_VERSION = 7`), `src/engine/save.js` (`migrations[6]`, naprawa), `data/ui.json`
- Test: `test/artifacts.test.js`, `test/save.test.js`, `test/inventory.test.js`, `test/stats.test.js`

**Interfaces:**
- Consumes: Task 1 (pola artefaktu).
- Produces:
  - `artifactState(state, itemId)` → `{ charge, exposed } | undefined`.
  - `carriedArtifacts(state, data)` → przedmioty artefaktów w torbie.
  - `equippedArtifact(state, data)` → artefakt z `talizman`, inaczej artefakt-broń z `bron`, inaczej `null`.
  - `regenerate(state, data, minutes, context = {})` → zdarzenia `{ type: "artefakt_naladowany", id }`; `context = { combat?, sceneTags? }`; wzór i warunki wg spec „Silnik › artifacts.js”. Warunek `phenomenon:<id>` i mnożnik zjawiska czytane przez `activePhenomenon` – w tym zadaniu przez parametr `context.phenomenon` (definicja albo `null`); Task 3 podaje go z `advanceTime`.
  - `passiveModifiers(state, data)` → lista obiektów `modifiers`.
  - `setExposed(state, data, on)`.
  - Zapis v7 wg spec „Zapis v7”.

- [ ] **Step 1: Testy (failing):** `addItem` kamienia → `artifactState` `{ charge: 40, exposed: false }`; drugi `addItem` → `inv.artifactUnique`, ładunek bez zmian; usunięcie z torby → wpis zostaje; `regenerate` 60 min dzień, założony → 44; 30 min → 42; noc ×2 → 48; w sakwie (niezałożony) dzień 60 min → 42; `near:upior` przy `context.combat` z żywym upiorem → bez zmiany; `context.phenomenon` = `noc_bez_gwiazd`, założony, zegar w dzień (bez mnożnika nocy), 60 min → 36 (×−1); wystawiony przy `burza_iskier` → 100 od razu i jedno zdarzenie `artefakt_naladowany`; obcięcie do 0 i 100; `requiresExposure` niewystawiony → bez zmiany; pasyw: charge 75 → `getStats` bystrość +1, 74 → bez; `miecz_gwiazd_test` w `bron` → `equippedArtifact` = miecz, pasyw `meleeHitChance +5` w `getStats`; kamień w talizmanie i miecz w `bron` → wygrywa talizman; migracja v6 → v7 (kamień w torbie → wpis 40/false, `phenomenon: null`, `phenomenonRolledDay` = bieżący dzień); naprawa (`charge 150` → 100, nieznane id usunięte, `exposed: true` → false, nieznane `phenomenon.id` → null).
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(artefakty): ładunek, regeneracja, pasywy i zapis v7`.

### Task 3: Zjawiska i spięcie z czasem

**Files:**
- Create: `src/systems/phenomena.js`, `src/scenes/phenomenon.js` (scena `phenomenon`)
- Modify: `src/engine/time.js` (`advanceTime(state, minutes, data, rng, context = {})` – regeneracja na odcinek, `rollDaily` → `update` na pełnej godzinie), `src/systems/stats.js` (`phenomenonModifiers` + kara Bystrości sumowana z nocą), `src/scenes/index.js` (rejestracja sceny)
- Test: `test/phenomena.test.js`, `test/time.test.js`, `test/stats.test.js`, `test/scenes.test.js`

**Interfaces:**
- Consumes: Task 2 (`regenerate` z `context.phenomenon`).
- Produces: `rollDaily(state, data, rng, dayStart)`, `update(state, data, now)` → zdarzenia `{ type: "zapowiedz_zjawiska" | "start_zjawiska" | "koniec_zjawiska", id }`, `forcePhenomenon(state, data, id, rng, now)`, `activePhenomenon(state, data)`, `phenomenonModifiers(state, data)`, `phenomenonBystroscPenalty(state, data)`, `phenomenonEnemyModifiers(state, data, enemy)` → `{ hitChance, damage, defense }` (zera domyślnie), `blockedSkill(state, data, skill)` → bool. Algorytm losowania godziny startu i „każdy dzień raz” – dokładnie wg spec „phenomena.js”.

- [ ] **Step 1: Testy (failing)** (atrapy RNG): `rollDaily` – pierwsze trafione wg kolejności w pliku, najwyżej jedno; `noc_bez_gwiazd` startuje tylko w godzinach nocy; zapowiedź na `startsAt − hoursBefore`, a gdy start bliżej – od razu przy najbliższym `update`; `update` zwraca zapowiedź raz, potem start, potem koniec i czyści stan; sen 8 h od 22:00 z burzą zaplanowaną na 2:00 (2 h): zdarzenia w kolejności i wystawiony kamień = 100 po starcie (Review Focus 2); dzień losowany dokładnie raz – `advanceTime` 30 h wywołuje `rollDaily` dla 2 dni (licznik rzutów atrapy), a po zapisie i wczytaniu w trakcie dnia z pokazaną zapowiedzią – brak ponownej zapowiedzi i drugiego losowania (Review Focus 4); `getStats` przy burzy: `rangedHitChance −20`, kara Bystrości −10 (w nocy −25 razem); `mgla_ciszy` → `blockedSkill(..., "proch") === true`; `phenomenonEnemyModifiers` dla upiora przy `noc_bez_gwiazd` → `{ hitChance: 10, damage: 2, defense: 0 }`, dla bandyty zera; scena `phenomenon` → `start_zjawiska` i przejście do `next`.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja (istniejące wywołania `advanceTime` bez `context` działają jak dotąd). **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(zjawiska): losowanie dzienne, zapowiedź, start i koniec`.

### Task 4: Walka – zdolności artefaktu, ogień i zasłona, zjawiska u wrogów, blokada broni, łup sceny

**Files:**
- Modify: `src/systems/artifacts.js` (`abilityOptions`, `useAbility`), `src/systems/combat/techniques.js` (pozycje `artifact:<abilityId>`), `src/systems/combat/strike.js` (`extraDamage` gracza z `getStats` przy ciosie bronią – osobny rzut, typ z efektu, przez `mitigate` z odpornością celu), `src/systems/combat/actions.js` (`resolveEnemyAttack`: `damageTaken` gracza – sprawdzić, że działa dla `zaslona`; modyfikatory zjawiska wroga; wyszarzenie ataku bronią z `blocks` – reason `combat.blockedByPhenomenon`), `src/systems/combat/formulas.js` (`enemyHitChance` + `hitChance` zjawiska; obrona wroga + `defense`), `src/systems/combat/turn.js` (`advanceTime` po walce z `context = { combat, sceneTags }`; łup sceny `loot` raz po wygranej, przez istniejący mechanizm łupu)
- Test: `test/artifacts_combat.test.js`, `test/combat_techniques.test.js`, `test/combat_turn.test.js`

**Interfaces:**
- Consumes: Task 2–3, `strike`, `applyToPlayer`, `applyToEnemy`, `dealDamage`, `techniqueActions`, `doTechnique`.
- Produces: `abilityOptions(state, data, combat)` → `[{ id, name, apCost, chargeCost, disabled, reason?, viaHp? }]`; `useAbility(state, data, combat, abilityId, target, rng)` → `{ ok, events, reason? }`, zdarzenia `{ type: "zdolnosc", artifact, ability, viaHp? }` (+ zdarzenia efektu); `techniqueActions` zawiera `{ id: "artifact:<abilityId>", ... }`; `doTechnique({ id: "artifact:<abilityId>", target? })`. Reasons: `combat.noAp`, `artifact.notFull`, `artifact.noCharge`, `artifact.noHp`, `combat.blockedByPhenomenon`.

- [ ] **Step 1: Testy (failing):** kamień 60 → „Płonące ostrze” kosztuje 50 (percent), 2 PA, `ostrze_ognia` 3 tury, ładunek 10; cios bronią z `ostrze_ognia` zadaje dodatkowe 2–4 `ogien` (atrapa min/max; upiór z `ogien: 2.0` → ×2); „Zasłona Zmierzchu” przy 99 → `artifact.notFull`, przy 100 → ładunek 0, `zaslona`, cios bandyty ×0.6 (zaokrąglenie jak w `mitigate`); ładunek 0 i HP 30 → zdolność `viaHp: 10`, HP 20 i tekst `whenEmpty`; HP 10 → `artifact.noHp` (Review Focus 5); brak PA → `combat.noAp`; nieudana zdolność nie zmienia stanu (`structuredClone` + `deepEqual`); bez założonego artefaktu – brak pozycji `artifact:*`; `miecz_gwiazd_test` w `bron` – zdolność `fixed` 10 dostępna; `noc_bez_gwiazd` – upiór trafia z `chance` +10 i obrażeniami +2; `mgla_ciszy` + pistolet → atak i celowany wyszarzone z `combat.blockedByPhenomenon`; walka z upiorem (`near:upior`) 60 min → kamień bez przyrostu; łup sceny `loot` z artefaktem dany raz po wygranej, nie po ucieczce/porażce, a przy artefakcie już w torbie – pominięty bez błędu (Review Focus 1).
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** `npm test` PASS (symulacje w progu).
- [ ] **Step 5: Commit** `feat(walka): zdolności artefaktu, zjawiska u wrogów i łup sceny`.

### Task 5: Odpoczynek – wystawienie artefaktu i złodziej

**Files:**
- Modify: `src/scenes/rest.js` (pytanie `rest.expose`, rzut ryzyka po każdej godzinie, przerwanie snu), `src/systems/artifacts.js` (`exposureRisk(state, data, rng)` → zdarzenia złodzieja; usuwanie artefaktu przez `unequip` + `removeItem`), `data/ui.json`
- Test: `test/rest.test.js` (nowy albo w `test/scenes.test.js` – wg istniejącego miejsca testów odpoczynku)

**Interfaces:**
- Consumes: Task 2 (`setExposed`, `carriedArtifacts`), Task 3 (`activePhenomenon`).
- Produces: `exposureRisk(state, data, rng)` → `[]` albo `[{ type: "zlodziej" }, { type: "zlodziej_przylapany" } | { type: "zlodziej_kradnie", money }, ({ type: "zlodziej_artefakt", id })?]` – kolejność rzutów: ryzyko (`riskPerHour` / `riskPerHourPhenomenon`), przyłapanie (`catchBase + catchPerPoint × bystrosc`), procent groszy (`rng.int(20, 40)`), szansa artefaktu (`thiefArtifactChance`), wybór artefaktu (indeks wśród wystawionych). Zdarzenie `zlodziej` przerywa sen.

- [ ] **Step 1: Testy (failing)** (atrapy RNG, scena przez skryptowe IO): bez artefaktu – brak pytania; „nie” – brak rzutów ryzyka; „tak” i rzut > 8 przez 4 h – sen pełny, `exposed` po śnie false, ładunek wzrósł; rzut ≤ 8 w 2. godzinie – sen przerwany (leczenie tylko za 2 h, czas +2 h), przyłapanie udane – grosze bez zmian; nieudane – grosze −20…40%; artefakt skradziony (założony kamień) – zdjęty z `talizman`, `countOf` 0, wpis `state.artifacts` zostaje, `getStats` bez pasywu, `statusBar` bez „◆” (Review Focus 3, `statusBar` po Task 6 – w tym zadaniu asercja na `equippedArtifact === null` i `getStats`); podczas zjawiska próg 15; wszystkie wejścia zużyte.
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(odpoczynek): wystawienie artefaktów i złodziej`.

### Task 6: UI – pasek stanu, ekran walki, Techniki, opis artefaktu, karta, teksty

**Files:**
- Modify: `src/ui/screen.js` (`statusBar`), `src/ui/combat_screen.js` (wiersz czasu, etykiety „Artefakt: …”), `src/scenes/combat.js` (picker celu dla zdolności `target: "enemy"`), `src/ui/inventory_screen.js` (opis artefaktu), `src/ui/character_screen.js` (sekcja „Artefakt”), `src/ui/events.js` (teksty zdarzeń), `data/ui.json`
- Test: `test/ui.test.js` / `test/screen.test.js` (wg istniejącego miejsca testów `statusBar`), `test/combat_screen.test.js`, `test/combat_scene.test.js`, `test/inventory_screen.test.js`, `test/prompt.test.js`, `test/events.test.js`

**Interfaces:**
- Consumes: Task 2–5 (zdarzenia i odczyty stanu).
- Produces: klucze `status.omen` „⚡ {name} za ~{h} h”, `status.phenomenon` „⚡ {name}”, `status.artifact` „◆ {name} {pct}%”; etykieta techniki `combat.tech.artifact` „Artefakt: {name} ({cost} · {ap} PA)” i `combat.tech.artifactHp` „Artefakt: {name} (−{hp} HP · {ap} PA)”; teksty wszystkich zdarzeń z listy spec „Interfejs › Teksty zdarzeń” (dziennik i komunikaty po scenie/śnie).

- [ ] **Step 1: Testy (failing):** `statusBar` z zapowiedzią burzy za 2 h i kamieniem 64% → zawiera „⚡ Iskrząca Burza za ~2 h” i „◆ Kamień Zmierzchu 64%”, ≤ 80 kolumn (przycięte przy długim imieniu); bez artefaktu i zjawiska – jak dziś; ekran walki z artefaktem i zjawiskiem ≤ 22 wiersze; Techniki z dwiema zdolnościami w TTY przy 24 wierszach ≤ 23 linie, wyszarzenie „Zasłona” z powodem; zdolność przez scenę (`t`, numer, ewentualnie cel) zużywa PA i ładunek; opis kamienia w ekwipunku: „40/100 (40%)”, „4/h”, warunki „noc ×2”, „w pobliżu upiora ×0”, pasyw „od 75%: Bystrość +1”, zdolności z kosztem – bez zawijania przy 80 kolumnach; karta: „Artefakt: Kamień Zmierzchu 40%”; tekst każdego nowego zdarzenia (`pushEventNotices` i `combatEventText` tam, gdzie zdarzenie może się pojawić).
- [ ] **Step 2:** FAIL. **Step 3:** implementacja. **Step 4:** `npm test` PASS.
- [ ] **Step 5: Commit** `feat(ui): pasek stanu, artefakt w walce i opisie, teksty mistyki`.

### Task 7: Demo i e2e – Kamień Zmierzchu po bandytach, talizman, wystawienie

**Files:**
- Modify: `data/story.json` (`demo_droga_bandyci.loot: [{ chance: 100, giveItem: "kamien_zmierzchu" }]`), `test/helpers.js` (driver: krok planu dla pytania o wystawienie, jeśli potrzebny), `test/e2e.test.js`, `test/cli.test.js`
- Test: `test/e2e.test.js`

**Interfaces:**
- Consumes: wszystko powyżej; `createAdaptiveIO(plan, { tty })` z C2b.
- Produces: e2e obu klas (miecz, włócznia) × ziarna 7, 10, 42: wygrana z bandytami → `countOf(kamien_zmierzchu) === 1`; w obozie założenie w `talizman` (`e`, kamień, „Załóż”); odpoczynek z wystawieniem („tak”) → po śnie `artifactState.charge > 40` albo w tekście zdarzenie złodzieja; ścieżka ucieczki – brak kamienia; istniejące testy przejścia nadal zielone; wszystkie wejścia zużyte.

- [ ] **Step 1:** testy e2e (failing). **Step 2:** FAIL. **Step 3:** dane demo + ewentualne dopasowanie drivera i istniejących sekwencji (pytanie o wystawienie pojawia się tylko z artefaktem w torbie). **Step 4:** PASS dla 3 ziaren, `--validate` czyste, ręczny przebieg `printf | node bin/game.js --seed 7` bez błędu (sekwencja nagrana przez driver, jak w C2b).
- [ ] **Step 5: Commit** `test(e2e): Kamień Zmierzchu w demo, talizman i wystawienie`.
