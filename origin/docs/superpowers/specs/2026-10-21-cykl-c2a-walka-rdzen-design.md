# Cykl C2a – rdzeń walki (projekt)

> Data: 2026-10-21 · Źródło: `docs/koncepcja-gry.md` (rozdziały 5, 6, 7, 8, 16 – etap 9) i ustalenia z brainstormingu.
> Poprzedni cykl: `2026-10-21-cykl-c1-efekty-dialogi-design.md` (scalony do `master`), ledger `../plans/2026-10-21-cykl-c1-ledger.md`.
> Następny: **C2b** – atak celowany, broń palna (niewypał, rozerwanie, hałas, posiłki), specjalności włóczni (`reach`, rzut jedną z pary), `leap` upiorów, biegłość w broni.
> Status: zatwierdzony w rozmowie, czeka na przegląd pliku.

## Cel

Po C2a gracz w demo przechodzi sparing z instruktorem (porażka nie kończy gry) i prawdziwą walkę z dwoma bandytami w drodze: wybiera cel, atakuje bronią z ręki, przeładowuje łuk/kuszę, używa opatrunku z pasa albo garnka huku, zmienia broń, zbliża się i odskakuje, broni się, może uciec. Wrogowie działają według AI, uciekają przy spadku morale, zadają efekty (zamroczenie, krwawienie), ogłuszony traci turę. Ekran walki mieści się w 80×24: grafika celu, lista wrogów, dziennik, stan gracza, pas i akcje ze skrótami. Po walce: PD, łup, czas świata; porażka w prawdziwej walce = ekran porażki i wczytanie ostatniego zapisu.

**Poza zakresem (C2b):** atak celowany, broń palna i jej pola (`misfireChance`, `burstChance`, `noise`, `fear`, posiłki), `reach` i rzut włócznią, `leap`, biegłość w broni. **Poza MVP:** zapis w trakcie walki, poddawanie się wrogów, towarzysze.

## Decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Podział C2 | C2a rdzeń, C2b rozszerzenia | Decyzja użytkownika; C2a daje pełną grywalną walkę. |
| Architektura | Czysty silnik `src/systems/combat/*` (stan + dane + RNG → zdarzenia) + cienka scena `combat` | Formuły, AI i całe walki testowalne bez UI (także symulacje balansu). Odrzucone: logika w handlerze sceny (testy tylko przez IO), osobny tryb pętli gry (potrzebny dopiero przy zapisie w walce). |
| Stan walki | W pamięci (`ctx.combat`), nie w zapisie | Zapis w walce poza MVP. Przerwanie gry w walce zapisuje stan sprzed walki (scena `combat` jest bieżąca, nic jeszcze nie przyznano) – po wczytaniu walka od nowa. |
| Ogłuszenie | Ogłuszony traci najbliższą turę (`skipTurn`) | Decyzja użytkownika (dotychczasowe −4 PA było słabe przy 6 PA). |
| Zamroczenie | Gracz: −2 Zręczność, −2 Bystrość, −10 trafienie; wróg: każda jego szansa powodzenia −`dazedPenalty` | Decyzja użytkownika; wrogowie nie mają atrybutów. |
| Źródła ogłuszenia/zamroczenia | Krytyk obuchem (ogłuszenie), trafienie obuchem (zamroczenie), pole `effects` broni i ataków, przedmioty rzucane, także od wrogów | Decyzja użytkownika. |
| Demo | Sparing (bez śmierci) + walka z 2 bandytami | Decyzja użytkownika. |

## Dane

### `data/enemies.json` (nowy)

Tablica wrogów:

```json
{
  "id": "bandyta", "name": "Bandyta", "art": "bandyta",
  "hp": 18, "ap": 6, "initiative": 4, "defense": 10, "armor": 0,
  "reduction": {}, "damageTaken": {}, "immune": [], "effectResist": {},
  "tags": ["czlowiek"], "morale": 60, "ai": "cautious", "xp": 40,
  "attacks": [
    { "name": "Pałka", "damage": [2, 5], "damageType": "obuchowe", "apCost": 3, "hit": 55,
      "effects": [{ "id": "zamroczenie", "chance": 15 }] }
  ],
  "loot": [ { "chance": 100, "giveMoney": 4 }, { "chance": 30, "giveItem": "opatrunek" } ]
}
```

- Wymagane: `id`, `name`, `art`, `hp` (≥ 1), `ap` (≥ 1), `initiative`, `defense` (≥ 0), `attacks` (niepusta), `ai`, `xp` (≥ 0). Opcjonalne (domyślne): `armor` 0, `reduction` {} (typy z `DAMAGE_TYPES`, 0–75), `damageTaken` {} (typ → mnożnik ≥ 0), `immune` [] (id efektów), `effectResist` {} (id efektu → 0–100), `tags` [], `morale` `null` (liczba 0–100 albo `null`), `loot` [].
- Atak: `name`, `apCost` ≥ 1, opcjonalnie `damage` `[min, max]` + `damageType` (wymagane razem; atak bez obrażeń musi mieć `effects`), `hit` (5–95; wymagane, gdy atak ma obrażenia albo `target: "single"`), `range` `melee` (domyślnie) | `far`, `target` `single` (domyślnie) | `all_enemies` (tu: gracz) – w C2a cel to zawsze gracz, `effects` `[{ id, chance 1–100 }]`, `weight` ≥ 1 (domyślnie 1).
- `ai`: `aggressive` | `cautious` | `ranged`.
- `loot`: lista wpisów `{ chance 1–100, <jedna akcja C1>: … }` – dozwolone akcje `giveItem`, `giveMoney`, `setFlag`; rzut na każdy wpis osobno, wykonanie przez `runActions`.
- `art`: id pliku `data/art/<art>.txt`.

**Zestaw demo:**

| id | Kto | HP | PA | Inicj. | Obrona | Atak | AI | Morale | XP | Łup |
|---|---|---|---|---|---|---|---|---|---|---|
| `instruktor` | Instruktor Radogost (sparing) | 30 | 6 | 6 | 15 | Drewniany miecz 2–4 obuchowe, 3 PA, hit 55; `effects: zamroczenie 20` | aggressive | `null` | 30 | – |
| `bandyta` | Bandyta | 18 | 6 | 4 | 10 | Pałka 2–5 obuchowe, 3 PA, hit 55, zamroczenie 15 | cautious | 60 | 40 | 4 gr (100%), opatrunek (30%) |

Liczby to punkt startowy, z symulacją balansu w testach (sekcja „Testy”); poprawiane w E.

### `data/art/` (nowy katalog)

Pliki `<id>.txt`, najwyżej **40 znaków × 7 wierszy** (walidacja przy starcie: `art/<id>.txt: wiersz 3 ma 44 znaki (max 40)`, `art/<id>.txt: 9 wierszy (max 7)`, brak pliku wskazanego przez wroga → błąd). Na C2a: `instruktor.txt`, `bandyta.txt`.

### `data/items.json` (rozszerzenie)

- `weapon`: nowe opcjonalne `effects` `[{ id, chance }]` (efekty `turn`).
- `throwable`: `target` `single_splash` dotyczy celu i wszystkich wrogów **w tym samym paśmie** co cel.
- Nowy przedmiot: `garnek_huku` (throwable, `miotanie`, 3 PA, `single_splash`, `effects: [{ ogluszenie, 70 }]`, waga 1, wartość 20; do kramu ×1). Drewniany miecz instruktora to tylko atak w `enemies.json`, nie przedmiot.

### `data/effects.json` (zmiany)

- `ogluszenie`: `modifiers` usunięte, nowe pole **`skipTurn: true`** (dozwolone tylko przy `unit: "turn"`); `duration` 1, `resist` krzepa, `stack` refresh.
- Nowe `zamroczenie` (Zamroczony): `turn`, 2, `modifiers: { zrecznosc: -2, bystrosc: -2, hitChance: -10 }`, `resist` krzepa, `refresh`, pole **`dazed: true`** (u wroga: każda szansa powodzenia −`dazedPenalty`).

### `data/rules.json` (rozszerzenie)

```json
"combat": {
  "hitBase": 30, "hitMin": 5, "hitMax": 95, "critMult": 1.5, "meleeStrengthBase": 5,
  "rangedInMeleePenalty": 20, "minStrengthPenalty": 10,
  "bluntCritStun": 50, "bluntDaze": 15, "dazedPenalty": 20,
  "defendPerAp": 5, "defendMinAp": 2,
  "fleeBase": 30, "fleePerZrecznosc": 3, "fleePerMeleeEnemy": 10, "fleeAp": 4,
  "bagUseExtraAp": 2, "moveAp": 2, "swapAp": 2,
  "moraleThreshold": 25, "moraleOnAllyDeath": 20, "lowMoraleHitPenalty": 10, "cautiousHpPercent": 30,
  "missEffectMultiplier": 0.5, "fumbleRoll": 99, "fumbleFart": 8,
  "defaultMinutes": 10, "logSize": 3
}
```

### `data/story.json` – scena `combat`

```json
{ "id": "demo_droga_bandyci", "type": "combat", "enemies": [{ "id": "bandyta", "count": 2 }],
  "start": "far", "canFlee": true, "onFlee": "demo_droga_ucieczka", "minutes": 10 }
```

- `enemies` (niepusta, `{ id, count ≥ 1 }`), opcjonalnie `start` `far` (domyślnie) | `melee`, `canFlee` (domyślnie `true`), `onFlee` (id sceny), `onDefeat` (id sceny), `nonLethal` (domyślnie `false`), `minutes` (domyślnie `rules.combat.defaultMinutes`), `title` (tekst). Wymaga wcześniejszego kreatora.
- Wyniki: wygrana → `goto` sceny (albo kolejna); ucieczka → `onFlee` (brak = dalej jak po wygranej, bez PD i łupu); porażka → `onDefeat` (wtedy HP = 1) albo przy `nonLethal` dalej jak po wygranej (HP = 1, bez PD i łupu); w przeciwnym razie ekran porażki i wczytanie ostatniego zapisu.
- Flagi: `combat_<scena>_wygrana` / `_ucieczka` / `_porazka` (dla `if` w dalszej fabule).
- Scena `dialogue` z `onCombat: { enemies, … }` (pola jak w `combat` bez `id`/`type`): wynik rozmowy `walka` uruchamia tę walkę zaraz po rozmowie (zamiast komunikatu debug z C1); wynik walki jak wyżej.

## Wzory

- **Inicjatywa** (raz na walkę): gracz `zrecznosc + bystrosc + k10` (wartości końcowe), wróg `initiative + k10`; malejąco, remis wygrywa gracz, między wrogami – kolejność na liście.
- **Szansa trafienia gracza:** `hitBase + umiejętność_broni − obrona_celu + hitChance + (melee ? meleeHitChance : rangedHitChance) − (far w zwarciu ? rangedInMeleePenalty : 0) − minStrengthPenalty × max(0, minStrength − siła)`, obcięta do `hitMin`–`hitMax`. Modyfikatory z `getStats` (sprzęt, efekty, pora dnia). Obrona celu = `defense` wroga + modyfikator `defense` z jego efektów.
- **Szansa trafienia wroga:** `hit ataku − obrona_gracza + hitChance_z_efektów_wroga − (dazed ? dazedPenalty : 0) − (morale < próg ? lowMoraleHitPenalty : 0)`, obcięta. Obrona gracza = `derived.defense` + premia z akcji „Obrona” (`defendPerAp × wydane PA`, do początku następnej tury gracza).
- **Obrażenia:** `surowe = losuj(damage) + (melee ? max(0, siła − meleeStrengthBase) : 0) + damage(mod)`; krytyk (szansa `fart + critChance`, tylko gracz; wróg nie ma krytyków w C2a): `floor(surowe × critMult)` i pomija pancerz płaski; `po_pancerzu = max(0, surowe − max(0, armor_celu − armorPierce))`; `wynik = floor(po_pancerzu × (1 − min(75, redukcja%) / 100) × damageTaken_typu)`; przy trafieniu minimum 1, chyba że `damageTaken_typu = 0`. Gracz: `armor`/`reduction` z `getStats().derived`, `damageTaken` z modyfikatorów.
- **Obuch:** trafienie gracza bronią `damageType: "obuchowe"`: krytyk → szansa `bluntCritStun` na `ogluszenie`; zwykłe trafienie → szansa `bluntDaze` na `zamroczenie`. Wrogowie dostają te same reguły dla ataków obuchowych (krytyków nie mają, więc tylko zamroczenie). Efekty z pola `effects` broni/ataku – dodatkowo, każdy osobnym rzutem.
- **Nałożenie efektu na wroga:** `immune` → brak; `effectResist[id]` → rzut `≤ wartość` = odporność (`resistOutcome` jak u gracza); przy `dazed` u atakującego wroga – szansa efektu jego ataku −`dazedPenalty`.
- **Rzucane:** test `hitBase + miotanie − obrona_celu …` jak atak dystansowy; `battlefield` bez testu; chybienie: każdy efekt szansa × `missEffectMultiplier`, czas −1 (efekt z czasem 0 nie powstaje); rzut `≥ fumbleRoll` (przy `fart ≥ fumbleFart` tylko 100) = efekty na rzucającego.
- **Ucieczka:** `fleeBase + fleePerZrecznosc × zrecznosc + fleeChance − fleePerMeleeEnemy × wrogów_w_zwarciu`, obcięta 5–95; nieudana kończy turę.
- **Morale:** start z danych; `strach` na wrogu → −20 (raz przy nałożeniu); śmierć towarzysza → −`moraleOnAllyDeath` u pozostałych. `cautious` ucieka (znika z walki po swojej turze, „Bandyta 2 ucieka.”) przy HP < `cautiousHpPercent`% albo morale < `moraleThreshold`; pozostałe AI przy morale < progu – kara `lowMoraleHitPenalty`.
- **PD:** suma `xp` pokonanych + połowa (w dół) za uciekających. **Łup:** z pokonanych (nie z uciekających).

## Przebieg walki

1. **Start:** wrogowie z numerami przy `count > 1` (`Bandyta 1`, `Bandyta 2`), HP pełne, pasmo z `start`, morale z danych; inicjatywa; dziennik pusty.
2. **Tura uczestnika:** odnowienie PA (gracz `derived.ap`, wróg `ap` + modyfikator `ap` efektów) → **tyknięcie efektów turowych** (obrażenia `tick`, `loseApChance`/`loseAp` z `rozkojarzenie`) → jeśli efekt `skipTurn` aktywny: tura przepada („{name} jest ogłuszony i traci turę.”) → akcje → **odliczenie** efektów `turn` celu (`remaining − 1`, przy 0 znika). Efekty `battlefield` odliczają się na końcu pełnej rundy. W walce HP gracza od efektów **może** spaść do 0 (inaczej niż poza walką).
3. **Koniec walki:** po każdej akcji: wszyscy wrogowie pokonani lub uciekli → wygrana; gracz HP ≤ 0 → porażka; udana ucieczka → ucieczka.
4. **Po walce:** efekty `turn` (u gracza) znikają; czas świata `+minutes`; wygrana: PD (przez `addXp`), łup (`runActions`), flaga; komunikaty z podsumowaniem; awans po scenie jak dotąd.

### Akcje gracza

| Akcja | Skrót | Koszt PA | Uwagi |
|---|---|---|---|
| Atak | `a` | `apCost` broni (pięści, gdy pusto w ręku) | wybór celu, gdy > 1 żywy wróg w zasięgu; broń `melee` – tylko cele w zwarciu; broń z `reload` – wymaga naładowania (`inventory.loaded[id] > 0`, strzał zużywa 1) |
| Przeładuj | `p` | `reload.apCost` | wymaga amunicji `reload.ammo` w torbie; ładuje do `capacity` (zużywa sztuki) |
| Użyj | `u` | koszt przedmiotu (pas) / +`bagUseExtraAp` (torba) | lista: środki i rzucane z pasa, potem z torby; środek – leczenie i `removes`/`applies` jak poza walką, **bez** upływu czasu świata; rzucany – wybór celu (poza `battlefield`) |
| Zmień broń | `z` | `swapAp` | `swapWeapons` z B2 |
| Zbliż się / Odskocz | `b` | `moveAp` | wybór wroga; odskok od wroga w zwarciu z bronią `melee` → darmowy atak tego wroga |
| Obrona | `o` | wszystkie pozostałe, min. `defendMinAp` | +`defendPerAp` obrony za PA do następnej tury gracza; kończy turę |
| Ucieczka | `c` | `fleeAp` | tylko gdy `canFlee`; porażka kończy turę |
| Koniec tury | `k` | – | |
| Dziennik | `l` | – | pełny dziennik walki (przewijany widżetem), powrót bez kosztu |

Akcje niedostępne (za mało PA, brak amunicji, brak celu w zasięgu, `canFlee: false`) – wyszarzone z powodem w `hint`.

### AI wrogów (`src/systems/combat/ai.js`)

- Tura: dopóki PA starcza na sensowną akcję: `aggressive` – na dystansie i ma atak `melee` → „zbliża się” (`moveAp`); w zwarciu → atak; `ranged` – w zwarciu → odskakuje (w C2a gracz nie ma reakcji, więc bez darmowego ataku); na dystansie → atak `far`; `cautious` – jak `aggressive`, ale ucieka (koniec tury, znika) przy niskim HP/morale.
- Wybór ataku: spośród ataków z wystarczającym PA i zasięgiem – losowanie z wagą `weight`.
- Brak sensownej akcji → koniec tury.

## Moduły

| Plik | Odpowiedzialność |
|---|---|
| `src/systems/combat/state.js` | `createCombat(state, data, sceneDef, rng)` → obiekt walki `{ enemies: [{ uid, id, name, hp, hpMax, ap, band, morale, effects, fled, dead }], order, turnIndex, round, playerAp, defendBonus, battlefield: [effects], log: [], outcome: null }`; `livingEnemies`, `enemyByUid`, `isOver`. |
| `src/systems/combat/formulas.js` | `playerHitChance`, `enemyHitChance`, `rollDamage`, `applyDamage` (pancerz → procent → mnożnik), `fleeChance` – czyste, testowane liczbami z koncepcji. |
| `src/systems/combat/effects.js` | Efekty w walce: `applyCombatEffect(target, …)` dla gracza (przez `applyEffect` z C1 z flagą walki – efekty `turn` dozwolone) i wroga (`immune`, `effectResist`), `tickTurn(target)`, `countdownTurn(target)`, `battlefield`. |
| `src/systems/combat/actions.js` | `playerActions(state, data, combat)` → lista z dostępnością i kosztami; `doAction(state, data, combat, action, rng)` → zdarzenia. |
| `src/systems/combat/ai.js` | `enemyTurn(state, data, combat, enemy, rng)` → zdarzenia. |
| `src/systems/combat/turn.js` | `nextTurn(state, data, combat, rng)` – przejście do następnego uczestnika z odnowieniem PA, tyknięciem, `skipTurn`, odliczaniem; `finishCombat(state, data, combat, rng)` → `{ outcome, events }` (PD, łup, czas, czyszczenie efektów). |
| `src/systems/effects.js` | `applyEffect(…, { inCombat })` dopuszcza efekty `turn`; walidacja nowych pól `skipTurn`, `dazed`. |
| `src/scenes/combat.js` (nowy) | Scena `combat`: pętla tur, ekran, wybór akcji i celu, ekran porażki, przejścia `onFlee`/`onDefeat`. |
| `src/ui/combat_screen.js` (nowy) | `renderCombat(state, data, combat, { width, height })` → linie ekranu (czysta funkcja; grafika celu, lista wrogów, dziennik, stan gracza, pas). |
| `src/ui/events.js` | Nowe typy zdarzeń walki → teksty dziennika (`combat.*` w `ui.json`). |
| `src/scenes/dialogue.js` | Wynik `walka` + `onCombat` → walka. |
| `src/engine/data.js` | Ładowanie `enemies.json` i `data/art/*.txt`, walidacja wszystkiego powyżej, scena `combat`, `onCombat`. |
| `src/engine/state.js`, `save.js`, `src/config.js` | Zapis v5: `inventory.loaded`. |

## Ekran walki (80×24)

```
        .-"""-.             BANDYTA 1  HP ██████████░░░░ 71%
       /  o o  \            [Zamroczony 1]
      |   ___   |           ▸ 1 Bandyta 1  71%  dystans
       \  \_/  /              2 Bandyta 2 100%  zwarcie
     /`'-----'`\            · Bandyta 2 chybia.
    /  |  |  |  \           · Trafiasz Bandytę 1 za 6.
                            · Bandyta 1 jest zamroczony.
  Dzień 1, 16:20 · dzień
  Ty: HP 31/35   PA ●●●○○○ (3/6)   [Podchmielony 1h]
  Broń: Łuk myśliwski [naładowana] · Pas: [1] Opatrunek ×2  [2] Garniec z wapnem
▶ [A] Atak (4 PA)
  [P] Przeładuj (1 PA)
  [U] Użyj
  [Z] Zmień broń (2 PA)
  [B] Ruch (2 PA)
  [O] Obrona
  [C] Ucieczka (4 PA)
  [K] Koniec tury
  [L] Dziennik
```

- Górny blok (7 wierszy) ma dwie kolumny: po lewej grafika celu (≤ 40 × 7), po prawej (od kolumny 42) nazwa i pasek HP celu, jego efekty, lista wrogów (≤ 2 wiersze; przy większej liczbie `+N` w ostatnim wierszu) i dziennik (`logSize` = 3 ostatnie wpisy). Pod nim: pasek czasu, stan gracza, broń i pas (3 wiersze), potem akcje w widżecie `select` (pionowo, 9 pozycji + opis). Razem ≤ 22 wiersze przy 80 kolumnach.
- Terminal węższy niż 80 kolumn albo niższy niż 24 wiersze: górny blok bez grafiki (tylko prawa kolumna).
- „Wybrany cel” = ostatnio atakowany żywy wróg (na start pierwszy).
- Tryb liniowy: ten sam ekran bez grafiki, akcje numerami lub literami.
- Ekran porażki: `combat.defeat` „Padasz. Ciemność.” + Enter → wczytanie najnowszego zapisu (największe `savedAt` spośród `auto`/`1`/`2`/`3`; brak → menu główne).

## Sparing

Na sparingu gracz walczy własną bronią, ale scena ma `"training": true` (nowe pole): obrażenia obu stron są obcinane tak, by HP nie spadło poniżej 1 – walka kończy się, gdy HP gracza albo instruktora spadnie do 1 (instruktor „poddaje się” = wygrana, gracz = porażka `nonLethal`). `training` wymaga `nonLethal: true` i `canFlee: false`. Gracz walczy własną bronią (bez podmiany na drewnianą).

## Zapis v5

- `inventory.loaded: { [id broni]: liczba ≥ 0 }`; `createNewState` – `{}`; `migrations[4]` – `{}`; naprawa: nieznane przedmioty i przedmioty bez `reload` usunięte, wartości ponad `capacity` obcięte (ostrzeżenie jak dotąd).
- Stan walki nie trafia do zapisu.

## Walidacja danych

- `enemies.json`: wszystkie pola z „Dane”, ataki, `effects`/`immune`/`effectResist` → istniejące efekty, `loot` (szansa, dozwolone akcje przez `validateActions`), `art` → istniejący plik.
- `art/*.txt`: wymiary.
- `items.json`: `weapon.effects` → istniejące efekty `turn`.
- `effects.json`: `skipTurn`, `dazed` tylko przy `turn` (bool).
- `story.json`: scena `combat` (pola, wrogowie istnieją, `onFlee`/`onDefeat` → istniejące sceny, `training` ⇒ `nonLethal` i `!canFlee`), `dialogue.onCombat` (te same pola).
- `rules.json`: sekcja `combat` (liczby całkowite poza `critMult`, `missEffectMultiplier`).

## Obsługa błędów

- Silnik walki nie rzuca przy błędzie gracza (akcja niedostępna → `{ ok: false, reason }` jak w B2); rzuca przy błędzie programisty.
- HP wroga nigdy poniżej 0; wróg z HP 0 jest `dead` i znika z listy celów.
- Walka ma limit 200 rund (zabezpieczenie przed pętlą AI) – po nim remis = ucieczka obu stron, komunikat; test pilnuje, że demo nigdy do niego nie dochodzi.

## Testy

- `combat/formulas.test.js`: szansa trafienia (przykład z koncepcji: umiejętność 35, obrona 10 → 55), kary (`minStrength`, `far` w zwarciu, pora dnia), obcięcie 5–95; obrażenia: kolejność pancerz → procent → mnożnik (upiór: pancerz 6, kusza 8–14 przebicie 3), krytyk pomija pancerz, minimum 1, `damageTaken` 0; ucieczka.
- `combat/effects.test.js`: `skipTurn` (ogłuszony traci turę – gracz i wróg), `zamroczenie` (gracz: atrybuty; wróg: każda szansa −20), `immune`, `effectResist`, tyknięcie na początku tury po odnowieniu PA, odliczanie na końcu tury celu, `battlefield` na końcu rundy, efekty `turn` znikają po walce.
- `combat/actions.test.js`: każda akcja (koszty, wyszarzenia z powodem), przeładowanie i `loaded`, pas vs torba (+2 PA), rzucane (trafienie, chybienie ×0.5 i −1, krytyczna porażka, `single_splash` w paśmie), obuch (krytyk → ogłuszenie, trafienie → zamroczenie), odskok → darmowy atak, obrona do następnej tury, ucieczka.
- `combat/ai.test.js`: trzy typy, wybór ataku z wagą, ucieczka `cautious`, morale (śmierć towarzysza), limit PA.
- `combat/turn.test.js`: inicjatywa (remis = gracz), kolejność, koniec walki, PD (połowa za uciekających), łup, czas, flagi, limit rund.
- Symulacja balansu: postać 1. poziomu klasy miecza i włóczni z zestawem startowym przeciw 2 bandytom – wygrana w ≥ 60% z 200 ziaren; sparing – nigdy HP < 1.
- `save.test.js`: migracja v4 → v5, naprawa `loaded`.
- `data.test.js`: każda reguła walidacji.
- Sceny (skryptowe IO): walka do wygranej, ucieczka → `onFlee`, porażka → ekran i wczytanie, sparing (porażka i wygrana bez śmierci), `[L]` dziennik, wybór celu, TTY strzałkami; rozmowa z `onCombat`.
- e2e obu klas: przez sparing i walkę z bandytami (ustalone ziarno), asercje PD, łupu, flag.

## Demo `story.json` po C2a

- Po `demo_sparing` (narracja) nowa scena `demo_sparing_walka` (`combat`: `instruktor`, `start: "melee"`, `training`, `nonLethal`, `canFlee: false`). Narracja `demo_sparing` skracana tak, by prowadziła do walki; po walce krótki komentarz instruktora zależny od flagi (`if`) – dwie narracje `demo_sparing_wygrana` / `demo_sparing_porazka`.
- Przed `demo_kurier`: narracja `demo_droga` (wyjście za bramę po sprawunek, zasadzka – 2–3 zdania) i walka `demo_droga_bandyci` (2× `bandyta`, `start: "far"`, `canFlee: true`, `onFlee: "demo_droga_ucieczka"` – narracja o ucieczce przez krzaki).
- Teksty w stylu „Styl i ton” spec. głównej.

## Kryterium ukończenia

Wszystkie testy zielone (`npm test`), `node bin/game.js --validate` bez błędów, symulacja balansu w progu, demo przechodzi skryptem dla obu klas przez obie walki, a w prawdziwym terminalu ekran walki mieści się w 80×24 i działa strzałkami oraz skrótami literowymi.
