# Cykl D1 – mistyka: artefakty i zjawiska (projekt)

> Data: 2026-10-21 · Źródło: `docs/koncepcja-gry.md` (rozdz. 9 „Czas świata”, 10 „Artefakty”, 11 „Zjawiska naturalne”, 15 „Interfejs”) i ustalenia z brainstormingu.
> Poprzedni cykl: `2026-10-21-cykl-c2b-walka-rozszerzenia-design.md` (scalony do `master`), ledger `../plans/2026-10-21-cykl-c2b-ledger.md`.
> Następny: **D2** – podróże i spotkania (rozdz. 13a).
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

Po D1 gracz w demo zdobywa Kamień Zmierzchu (pewny łup po wygranej z bandytami), zakłada go w talizman, widzi jego ładunek na pasku stanu i w opisie, a w odpoczynku może go wystawić – ładunek rośnie szybciej, ale nocą może przyjść złodziej. W tle co dobę może się wylosować zjawisko (zapowiedź na pasku, start, koniec), które zmienia ładowanie artefaktów i modyfikatory gracza oraz wrogów. Zdolności artefaktu działają w walce (podmenu Technik), pasywy – z progów ładunku. Silnik obsługuje też broń-artefakt w slocie `bron` (przykład testowy, bez demo).

**Poza zakresem:** podróże, mapa, prowiant, wpływ zjawisk na podróż (`world.travel` tylko zapisany w danych – D2), nowe sceny walki, istota burzy, Miecz/Włócznia Gwiazd jako treść (E), dar istoty i dług.

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Podział D | D1 mistyka (artefakty + zjawiska), D2 podróże | Decyzja użytkownika; podróże w D2 korzystają z gotowych zjawisk. |
| Demo | 1 artefakt (`kamien_zmierzchu`) + zjawiska losowane w tle; wystawienie w odpoczynku; bez nowych scen | Decyzja użytkownika. |
| Źródło artefaktu | Pewny łup po wygranej z bandytami | Decyzja użytkownika. |
| Broń-artefakt | Silnik + 1 testowy przedmiot `hidden` | Decyzja użytkownika; treść (zależna od klasy, dar istoty) w E. |
| Ryzyko wystawienia | Przerwany sen + złodziej (test Bystrości; kradzież groszy, rzadko artefaktu); bez walki | Decyzja użytkownika. |
| Spięcie z czasem | Jawne kroki w `advanceTime`: regeneracja na każdy odcinek, na pełnej godzinie `rollDaily` (o północy) → `update` → zmiana pory → tyknięcia efektów | Stała, widoczna kolejność; deterministyczne testy; zgodne z pseudokodem koncepcji. |
| Zdolności w walce | Pozycje „Artefakt: {zdolność}” w podmenu „[T] Techniki” | Główna lista zostaje przy 10 pozycjach (budżet 80×24). |
| Ładunek po utracie | Wpis `state.artifacts[id]` zostaje, gdy przedmiot opuszcza torbę | Powrót przedmiotu (odzyskanie od złodzieja w treści E) nie resetuje ładunku. |

## Dane

### `data/items.json` – typ `artifact`

```json
{
  "id": "kamien_zmierzchu", "name": "Kamień Zmierzchu", "type": "artifact", "slot": "talizman",
  "weight": 0.3, "value": 0,
  "charge": { "max": 100, "start": 40 },
  "regen": { "perHour": 4, "conditions": [ { "when": "night", "multiplier": 2 }, { "when": "near:upior", "multiplier": 0 } ], "requiresExposure": false },
  "passive": [ { "minCharge": 75, "modifiers": { "bystrosc": 1 } } ],
  "abilities": [
    { "id": "plonace_ostrze", "name": "Płonące ostrze", "cost": { "type": "percent", "value": 50 }, "apCost": 2, "effect": { "id": "ostrze_ognia", "target": "self", "duration": 3 } },
    { "id": "zaslona_zmierzchu", "name": "Zasłona Zmierzchu", "cost": { "type": "all" }, "requiresFull": true, "apCost": 4, "effect": { "id": "zaslona", "target": "self", "duration": 3 } }
  ],
  "whenEmpty": { "usable": true, "costHp": 10, "text": "Kamień pije z ciebie." },
  "description": "…"
}
```

- `slot`: `talizman` albo `bron`. Artefakt ze `slot: "bron"` ma dodatkowo wszystkie pola broni (`skill`, `damageType`, `damage`, `apCost`, `range`, `masteryType`, …) i jest walidowany także jak broń; `slotAccepts` traktuje go jak broń (`bron`, `bron_zapas`; `bron_druga` tylko z `offhand`).
- `charge.max` > 0, `0 ≤ start ≤ max`. `regen.perHour` ≥ 0. `conditions[].when` z zamkniętej listy: `night`, `day`, `in_combat`, `phenomenon:<id istniejącego zjawiska>`, `near:<tag>`; `multiplier` liczba (może być 0).
- `passive[]`: `minCharge` 0–`max`, `modifiers` z katalogu 4.1.
- `abilities[]`: `id` (unikatowe w artefakcie), `name`, `cost.type` ∈ `fixed` (z `value` > 0), `percent` (z `value` 1–100), `all`; `requiresFull` (bool, opcjonalne), `apCost` ≥ 1, `effect { id, target: "self" | "enemy", duration? }` (istniejący efekt).
- `whenEmpty` opcjonalne: `{ usable, costHp ≥ 0, text }` – zdolność przy braku ładunku na koszt dostępna kosztem HP.
- **Unikatowość:** artefakt nigdy w więcej niż 1 sztuce – walidacja `stock`/łupów/nagród (`qty`/`count` ≤ 1) i silnik (`addItem` artefaktu, który już jest w torbie → `{ ok: false, reason: "inv.artifactUnique" }`).
- Nowe przedmioty: `kamien_zmierzchu` (jak wyżej) i `miecz_gwiazd_test` (`hidden: true`, `slot: "bron"`, pola broni jak `miecz_krotki`, `masteryType: "miecz"`, `charge { max: 50, start: 50 }`, `regen { perHour: 2 }`, `passive [{ minCharge: 25, modifiers: { meleeHitChance: 5 } }]`, jedna zdolność `fixed` 10 → `ostrze_ognia` 2 tury) – tylko do testów.

### `data/phenomena.json` (nowy plik)

```json
{
  "id": "burza_iskier", "name": "Iskrząca Burza", "kind": "magiczne",
  "omen": { "hoursBefore": 2, "text": "Powietrze gęstnieje, włosy stają dęba." },
  "duration": [2, 4], "timeOfDay": null, "frequency": { "chancePerDay": 15 },
  "onArtifacts": { "exposed": "full", "carried": { "multiplier": 3 } },
  "modifiers": { "rangedHitChance": -20 }, "bystroscSkillPenalty": -10,
  "enemyModifiers": {}, "blocks": [],
  "world": { "visibility": -20, "travel": "dangerous" }
}
```

- Pola: `id`, `name`, `kind` ∈ `magiczne` | `pogodowe`, `omen { hoursBefore ≥ 0, text }`, `duration [min, max]` (godziny, 1 ≤ min ≤ max ≤ 24), `timeOfDay` (`null` albo niepusta lista id pór z `rules.timeOfDay`), `frequency.chancePerDay` 0–100, `onArtifacts { exposed?: "full" | { multiplier }, carried?: { multiplier } }` (multiplier liczba, może być ujemna = rozładowanie), `modifiers` (katalog 4.1, opcjonalne), `bystroscSkillPenalty` (≤ 0, opcjonalne – jak w `rules.timeOfDay.noc`), `enemyModifiers { <tag>: { hitChance?, damage?, defense? } }` (opcjonalne), `blocks` (lista id umiejętności – broń o tej `skill` nie strzela/nie uderza), `world { visibility, travel }` (walidowane i zapisane; silnik D1 ich nie używa – działanie w D2).
- Zjawiska MVP:

| id | kind | chancePerDay | duration | timeOfDay | onArtifacts | modifiers / inne |
|---|---|---|---|---|---|---|
| `burza_iskier` | magiczne | 15 | [2, 4] | null | exposed full, carried ×3 | `rangedHitChance −20`, `bystroscSkillPenalty −10` |
| `noc_bez_gwiazd` | magiczne | 10 | [3, 6] | ["noc"] | exposed ×−2, carried ×−1 | `enemyModifiers.upior { hitChance: 10, damage: 2 }` |
| `mgla_ciszy` | pogodowe | 15 | [2, 5] | ["swit", "noc"] | – | `blocks ["proch"]`, `skradanie +20` |

- Omen: burza 2 h, noc bez gwiazd 1 h, mgła 1 h (teksty w danych).

### `data/effects.json`

- `ostrze_ognia` („Płonące ostrze”): `unit: "turn"`, `duration: 3`, `modifiers: { extraDamage: { type: "ogien", amount: [2, 4] } }`, `stack: "refresh"` – dodatkowe obrażenia przy każdym ciosie bronią gracza (istniejący mechanizm `extraDamage`).
- `zaslona` („Zasłona”): `unit: "turn"`, `duration: 3`, `modifiers: { damageTaken: { sieczne: 0.6, klute: 0.6, obuchowe: 0.6, ogien: 0.6, palne: 0.6 } }`, `stack: "refresh"`.

### `data/rules.json`

```json
"artifacts": { "carriedRegenMultiplier": 0.5 },
"exposure": { "riskPerHour": 8, "riskPerHourPhenomenon": 15, "catchAttribute": "bystrosc", "catchBase": 20, "catchPerPoint": 6, "thiefMoneyPercent": [20, 40], "thiefArtifactChance": 15 },
"phenomena": { "maxPerDay": 1 }
```

- Przyłapanie złodzieja: `rng.int(1,100) ≤ catchBase + catchPerPoint × bystrosc` (bystrość z `getStats`).

### `data/story.json`

- Łup bandytów w `demo_droga_bandyci` (wygrana): + `kamien_zmierzchu` ×1, pewny (jak istniejące pewne łupy).
- Nowy typ sceny `phenomenon`: `{ "type": "phenomenon", "id": "<zjawisko>", "next": "…" }` – wymusza start zjawiska (tylko silnik i testy; demo z niego nie korzysta).

## Silnik

### `src/systems/artifacts.js`

- **Stan:** `state.artifacts: { [itemId]: { charge: number, exposed: boolean } }`. Wpis tworzony przy pierwszym dodaniu artefaktu do torby (`charge = charge.start`, `exposed = false`); zostaje, gdy przedmiot opuszcza torbę (nie ładuje się wtedy).
- `carriedArtifacts(state, data)` – artefakty obecne w torbie.
- `equippedArtifact(state, data)` → przedmiot artefaktu w `talizman`, w przeciwnym razie artefakt-broń w `bron`, w przeciwnym razie `null`. Pasywy i zdolności tylko z niego.
- `regenerate(state, data, minutes, context)` → zdarzenia. Dla każdego artefaktu w torbie: przy `requiresExposure` i `!exposed` – brak zmian. Inaczej `delta = perHour × minutes / 60 × M`, gdzie `M` = iloczyn mnożników spełnionych warunków (`night` – pora `noc`; `day` – pora `dzien`; `in_combat` – `context.combat`; `near:<tag>` – tag u żywego wroga bieżącej walki albo w `context.sceneTags`; `phenomenon:<id>` – aktywne zjawisko o tym id) × mnożnik zjawiska (`onArtifacts.exposed.multiplier` gdy wystawiony, `onArtifacts.carried.multiplier` w przeciwnym razie; brak = 1) × `carriedRegenMultiplier` (gdy nie jest `equippedArtifact` i nie jest wystawiony). `charge` obcięty do 0…max (zmiennoprzecinkowy). Aktywne zjawisko z `exposed: "full"` i wystawiony artefakt → `charge = max` od razu. Zdarzenie `artefakt_naladowany { id }` przy przejściu z < max do max.
- `passiveModifiers(state, data)` → lista obiektów `modifiers` z `passive` założonego artefaktu, których `minCharge ≤ charge`.
- `abilityOptions(state, data, combat)` → `[{ id, name, apCost, chargeCost, disabled, reason?, viaHp? }]`. Koszt: `fixed` = value, `percent` = max × value / 100, `all` = bieżący ładunek (musi być > 0). Wyszarzenia: `combat.noAp`, `artifact.notFull` (`requiresFull`), `artifact.noCharge` (ładunek < koszt i brak `whenEmpty.usable`); przy `whenEmpty.usable` i braku ładunku – dostępne z `viaHp: costHp` (wyszarzone `artifact.noHp`, gdy HP ≤ costHp).
- `useAbility(state, data, combat, abilityId, target, rng)` → `{ ok, events, reason? }`: odejmuje PA i ładunek (albo HP przez `dealDamage` gracza i zdarzenie z `text`), nakłada efekt przez `applyToPlayer` / `applyToEnemy` (z `duration` zdolności, gdy podane); `target` wymagany dla `effect.target: "enemy"` (żywy wróg). Błąd gracza → `{ ok: false, reason }` bez zmiany stanu.
- `setExposed(state, data, on)` – ustawia `exposed` wszystkich artefaktów w torbie.

### `src/systems/phenomena.js`

- **Stan:** `state.world.phenomenon: { id, startsAt, endsAt, omenAt, omenShown, started } | null` (minuty absolutne).
- `rollDaily(state, data, rng, dayStart)` – gdy brak zaplanowanego/trwającego zjawiska: po kolei (kolejność w pliku) test `rng.int(1,100) ≤ chancePerDay`; pierwsze trafione – start = `dayStart + 60 × h`, gdzie `h` to losowy element (`rng.int(0, n − 1)` jako indeks) listy godzin 0–23 tej doby, które są zgodne z `timeOfDay` i nie są wcześniejsze niż bieżąca godzina, `endsAt = startsAt + 60 × rng.int(duration)`, `omenAt = max(now, startsAt − 60 × hoursBefore)`. Najwyżej `maxPerDay` (1). Zdarzenie brak (zapowiedź przychodzi z `update`).
- `update(state, data, now)` → zdarzenia w kolejności: `zapowiedz_zjawiska { id }` (pierwszy raz, gdy `now ≥ omenAt` i nie wystartowało), `start_zjawiska { id }` (`now ≥ startsAt`), `koniec_zjawiska { id }` (`now ≥ endsAt`, stan → `null`).
- `forcePhenomenon(state, data, id, rng, now)` – zastępuje zaplanowane/trwające: `startsAt = now`, `endsAt = now + 60 × rng.int(duration)`, zwraca `start_zjawiska`.
- `activePhenomenon(state, data)` → definicja trwającego zjawiska albo `null`.
- `phenomenonModifiers(state, data)` → `modifiers` aktywnego zjawiska (lista 0–1); `phenomenonBystroscPenalty`; `phenomenonEnemyModifiers(state, data, enemy)` → suma `enemyModifiers[tag]` dla tagów wroga; `blockedSkill(state, data, skill)` → bool.
- Każdy dzień losowany dokładnie raz: `advanceTime` woła `rollDaily` na pierwszej pełnej godzinie doby, w której `world.phenomenonRolledDay < bieżący dzień` (potem ustawia pole na bieżący dzień). Gra startująca w środku dnia 1 losuje więc dzień 1 przy pierwszej pełnej godzinie (bez godzin już minionych).

### Spięcie

- **`advanceTime(state, minutes, data, rng, context = {})`**: dla każdego odcinka (do pełnej godziny zegara) najpierw `regenerate(state, data, długość, context)`; na pełnej godzinie kolejno: `rollDaily` (gdy nowy dzień nie był losowany), `update`, `zmiana_pory`, `tickHour` efektów, `HOURLY_HOOKS`. Zdarzenia w tej kolejności.
- **`getStats`**: nowe źródła modyfikatorów – `passiveModifiers` i `phenomenonModifiers`; kara Bystrości zjawiska sumuje się z karą nocy w testach zależnych od Bystrości.
- **Walka:**
  - czas walki (`advanceTime` po walce i ewentualne odcinki w trakcie) dostaje `context = { combat, sceneTags }`;
  - `enemyHitChance` + `phenomenonEnemyModifiers.hitChance`; obrażenia wroga + `damage`; obrona wroga + `defense`;
  - broń gracza o `skill` z `blocks` aktywnego zjawiska: atak/strzał/celowany wyszarzony z `combat.blockedByPhenomenon` (nie zmienia stanu);
  - `ostrze_ognia` i `zaslona` działają przez istniejące `extraDamage` / `damageTaken` (sprawdzić, że `strike` i `resolveEnemyAttack` je uwzględniają u gracza; jeśli nie – dopisać w jednym miejscu);
  - Techniki: `techniqueActions` dołącza pozycje `artifact:<abilityId>` z `abilityOptions` (gdy jest założony artefakt); `doTechnique({ id: "artifact:<abilityId>", target? })` deleguje do `useAbility`.
- **Odpoczynek** (`src/scenes/rest.js`): przed suwakiem – gdy w torbie jest artefakt – pytanie `rest.expose` (tak/nie, `select`); „tak” → `setExposed(true)`. W każdej przespanej godzinie (po `advanceTime` tej godziny) przy wystawieniu: rzut `rng.int(1,100) ≤ riskPerHour` (albo `riskPerHourPhenomenon`, gdy trwa zjawisko) → zdarzenie `zlodziej`: sen przerwany (pozostałe godziny przepadają, leczenie tylko za przespane), test przyłapania; udany → `zlodziej_przylapany`; nieudany → `zlodziej_kradnie { money }` (`floor(money × rng.int(thiefMoneyPercent) / 100)`), a z szansą `thiefArtifactChance` jeden losowy wystawiony artefakt usunięty z torby i zdjęty ze slotu (`zlodziej_artefakt { id }`). Po odpoczynku `setExposed(false)`.
- **Zapis v7**: `state.artifacts`, `world.phenomenon`, `world.phenomenonRolledDay`. `migrations[6]`: `artifacts` = wpisy `{ charge: start, exposed: false }` dla artefaktów w torbie, `phenomenon: null`, `phenomenonRolledDay` = bieżący dzień. Naprawa: `charge` obcięty do 0…max, nieznane id artefaktów usunięte, `exposed` → `false` (zapis nigdy w trakcie snu), nieznane `phenomenon.id` → `null`.

## Interfejs

- **Pasek stanu** (`statusBar`): po porze doby, w tej kolejności, gdy są: zjawisko – zapowiedź `status.omen` „⚡ {name} za ~{h} h” albo trwające `status.phenomenon` „⚡ {name}” (fiolet); ładunek założonego artefaktu `status.artifact` „◆ {name} {pct}%” (fiolet). Linia przycinana do szerokości terminala (jak dziś).
- **Ekran walki**: wiersz czasu dostaje te same elementy (zjawisko, „◆ {pct}%”); budżet ≤ 22 wiersze bez zmian.
- **Techniki**: pozycje „Artefakt: {nazwa} ({koszt} · {PA} PA)” albo „… (−{hp} HP)” przy `viaHp`; wyszarzenia z powodem; zdolność z `target: "enemy"` przez picker celu z C2a.
- **Ekwipunek / opis przedmiotu**: dla artefaktu – ładunek „{charge}/{max} ({pct}%)”, regeneracja „{perHour}/h” i warunki (nazwy w `ui.json`), pasywy z progami (spełnione oznaczone), zdolności z kosztem.
- **Karta postaci**: sekcja „Artefakt” – nazwa i ładunek założonego artefaktu (gdy jest).
- **Odpoczynek**: pytanie o wystawienie, komunikaty złodzieja i przerwanego snu.
- **Teksty zdarzeń** (`events.js` – dziennik i komunikaty): `zapowiedz_zjawiska` (tekst `omen.text` + nazwa), `start_zjawiska`, `koniec_zjawiska`, `artefakt_naladowany`, użycie zdolności (także kosztem HP z `whenEmpty.text`), `zlodziej`, `zlodziej_przylapany`, `zlodziej_kradnie`, `zlodziej_artefakt`, sen przerwany.

## Walidacja (komunikaty)

- `items.json › x › charge.start: wartość poza zakresem 0–max`, `… regen.conditions[0].when: nieznany warunek "x"`, `… regen.conditions[0].when: nieznane zjawisko "x"`, `… passive[0].minCharge: wartość poza zakresem 0–max`, `… abilities[0].cost.type: nieznany typ "x"`, `… abilities[0].cost.value: wartość poza zakresem 1–100` (percent), `… abilities[0].effect.id: nieznany efekt "x"`, `… abilities[1].id: powtórzony identyfikator "x"`, `… slot: artefakt może być tylko w talizman albo bron`.
- `phenomena.json › x › kind: nieznany rodzaj "x"`, `… duration: oczekiwano [min, max] godzin 1–24`, `… timeOfDay[0]: nieznana pora "x"`, `… frequency.chancePerDay: wartość poza zakresem 0–100`, `… blocks[0]: nieznana umiejętność "x"`, `… enemyModifiers.x.y: nieznany modyfikator`.
- `shops.json › s › stock[0].qty: artefakt może wystąpić najwyżej raz` (tak samo łupy i nagrody).
- `story.json › s › id: nieznane zjawisko "x"` (scena `phenomenon`).

## Testy

- **Jednostkowe:** regeneracja (proporcjonalna dla 30 min i 60 min, każdy warunek, iloczyn mnożników, sakwa ×0.5 vs założony, `requiresExposure`, obcięcie 0/max, ujemny mnożnik `noc_bez_gwiazd`, `exposed: "full"`, zdarzenie naładowania raz); pasywy przy progu i pod progiem w `getStats`; zdolności (`fixed`/`percent`/`all`, `requiresFull`, brak PA, `whenEmpty` kosztem HP i blokada przy niskim HP, efekt na siebie i na wroga, nieudana zdolność nie zmienia stanu – `structuredClone` + `deepEqual`); broń-artefakt w `bron` (pasywy i zdolności działają, atak jak broń); unikatowość (`addItem`, walidacja stock); zjawiska (`rollDaily` – najwyżej jedno, pora zgodna z `timeOfDay`, zapowiedź `hoursBefore` i od razu, gdy start bliżej; każdy dzień losowany raz; 8 h snu przez burzę o 2:00 – zapowiedź, start, ładowanie wystawionego do pełna, koniec, w tej kolejności zdarzeń); modyfikatory gracza i wroga (upiór przy `noc_bez_gwiazd`), blokada `proch` przy `mgla_ciszy`, scena `phenomenon`; ryzyko wystawienia (atrapy RNG: brak zdarzenia, przyłapanie, kradzież groszy, kradzież artefaktu – zdjęty ze slotu i z torby, wpis ładunku zostaje, sen przerwany); migracja v6 → v7 i naprawa; walidacja – każdy komunikat z listy, prawdziwe dane `[]`.
- **Ekran:** pasek stanu ze zjawiskiem i artefaktem ≤ 80 kolumn; ekran walki z artefaktem i zjawiskiem ≤ 22 wiersze; Techniki ze zdolnościami w TTY przy 24 wierszach ≤ 23 linie; opis artefaktu w ekwipunku mieści się bez zawijania.
- **e2e** (adaptacyjny driver z C2b): ścieżka wygranej z bandytami daje `kamien_zmierzchu`; w obozie gracz zakłada go w talizman; w odpoczynku wystawia; po odpoczynku ładunek > 40 albo zdarzenie złodzieja w tekście (driver nie zależy od ścieżki RNG); ziarna 7, 10, 42; wszystkie wejścia zużyte.

## Kryterium ukończenia

Wszystkie testy zielone (`npm test`), `node bin/game.js --validate` bez błędów, demo przechodzi skryptem z artefaktem dla obu klas i trzech ziaren, a w terminalu 80×24 pasek stanu, ekran walki i Techniki ze zdolnościami artefaktu mieszczą się na ekranie.
